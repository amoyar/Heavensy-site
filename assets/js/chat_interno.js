// ═══════════════════════════════════════════════
//  CHAT INTERNO — HEAVENSY
//  Sala general + privados + menciones + typing
// ═══════════════════════════════════════════════

// ── STATE ──
let ciSocket        = null;
let ciCurrentUser   = null;   // { id, name, role, company_id }
let ciActiveChat    = 'general'; // 'general' | sala_id | user_id
let ciParticipants  = [];     // usuarios habilitados para el chat
let ciSalas         = [];     // salas temáticas: [{ id, name, desc, members[], color }]
let ciEditingSalaId = null;   // sala que se está editando (null = crear nueva)
let ciOnlineUsers   = {};     // { user_id: { name, role, online } }
let ciMessages      = { general: [] }; // { room_id: [msg,...] }
let ciUnread        = { general: 0 };  // contadores no leídos
let ciTypingTimers  = {};     // timers para typing
let ciTypingUsers   = {};     // { room: [user_name,...] }
let ciMentionIndex  = -1;     // índice en el popup de menciones
let ciIsAdmin       = false;
let ciTypingTimeout = null;
let ciWasTyping     = false;
let ciTotalUnread   = 0;

const CI_ROOM_PREFIX   = 'chat_interno:';
const CI_TYPING_DELAY  = 2500; // ms sin escribir para emitir stop

// ── INIT ──
async function initChat_internoPage() {
  try {
    const token = localStorage.getItem('token');
    if (!token) return;
    const payload = JSON.parse(atob(token.split('.')[1]));
    ciCurrentUser = {
      id:         payload.user_id || payload.sub || payload.email,
      name:       payload.username || payload.name || payload.email || 'Usuario',
      role:       payload.role || 'usuario',
      company_id: payload.company_id || ''
    };
    ciIsAdmin = ['admin','superadmin','owner'].includes(ciCurrentUser.role);

    if (ciIsAdmin) {
      document.getElementById('ci-admin-btn').style.display = '';
    }

    // Nombre de empresa en el header
    ciLoadCompanyName();

    // Cargar participantes habilitados
    await ciLoadParticipants();

    // Conectar socket
    await ciConnectSocket();

    // Cargar historial general
    await ciLoadHistory('general');

    // Cargar salas temáticas
    await ciLoadSalas();

    // Watcher scroll
    ciInitScrollWatcher();

  } catch (e) {
    console.error('Error init chat interno:', e);
  }
}

// ── SOCKET ──
async function ciConnectSocket() {
  // Evitar doble conexión si el socket ya está activo
  if (ciSocket && ciSocket.connected) return;
  // Desconectar socket anterior si existe pero no está conectado
  if (ciSocket) { ciSocket.disconnect(); ciSocket = null; }

  if (typeof io === 'undefined') {
    await new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.socket.io/4.5.4/socket.io.min.js';
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }

  const token = localStorage.getItem('token');
  ciSocket = io(API_BASE_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000
  });

  ciSocket.on('connect', () => {
    console.log('✅ Chat interno conectado');
    // Unirse al room general de la empresa
    ciSocket.emit('join_internal_chat', {
      company_id: ciCurrentUser.company_id,
      user_id:    ciCurrentUser.id,
      user_name:  ciCurrentUser.name,
      role:       ciCurrentUser.role
    });
  });

  ciSocket.on('disconnect', () => {
    console.log('❌ Chat interno desconectado');
    ciUpdateOnlineList({});
  });

  // Usuarios online actualizados
  ciSocket.on('internal_users_online', (data) => {
    ciOnlineUsers = data.users || {};
    ciUpdateOnlineList(ciOnlineUsers);
  });

  // Mensaje general recibido
  ciSocket.on('internal_message', (msg) => {
    ciReceiveMessage('general', msg);
  });

  // Mensaje privado recibido
  ciSocket.on('internal_private_message', (msg) => {
    const roomId = msg.from_id === ciCurrentUser.id ? msg.to_id : msg.from_id;
    if (msg.from_id === ciCurrentUser.id) return; // ya renderizado localmente en ciEnviar
    ciReceiveMessage(roomId, msg);

    // Si viene de alguien nuevo, agregar su chat a privados
    if (!ciMessages[roomId]) {
      ciMessages[roomId] = [];
      ciAddPrivateChatItem(msg.from_id, msg.from_name, msg.from_role);
    }
  });

  // Typing
  ciSocket.on('internal_typing', (data) => {
    if (data.user_id === ciCurrentUser.id) return;
    const room = data.room || 'general';
    if (!ciTypingUsers[room]) ciTypingUsers[room] = {};
    ciTypingUsers[room][data.user_id] = data.user_name;
    ciShowTyping(room);

    clearTimeout(ciTypingTimers[data.user_id]);
    ciTypingTimers[data.user_id] = setTimeout(() => {
      delete ciTypingUsers[room][data.user_id];
      ciShowTyping(room);
    }, CI_TYPING_DELAY + 500);
  });

  ciSocket.on('internal_typing_stop', (data) => {
    const room = data.room || 'general';
    if (ciTypingUsers[room]) {
      delete ciTypingUsers[room][data.user_id];
      ciShowTyping(room);
    }
  });

  // Mención
  ciSocket.on('internal_mention', (data) => {
    if (data.to_id === ciCurrentUser.id) {
      ciShowMentionToast(data);
    }
  });

  // Nota anclada recibida
  ciSocket.on('internal_pinned_note', (nota) => {
    if (nota.room_id === ciActiveChat && nota.from_id !== ciCurrentUser.id) {
      ciMostrarNota(nota);
    }
  });

  // Confirmación de nota recibida
  ciSocket.on('internal_note_confirmed', (data) => {
    if (!ciActiveNota || ciActiveNota.id !== data.nota_id) return;
    if (!ciActiveNota.confirmations.includes(data.user_id)) {
      ciActiveNota.confirmations.push(data.user_id);
    }
    ciRenderNotaConfirmations(ciActiveNota);
    ciCheckNotaResuelta();
  });

  // Nota resuelta (todos confirmaron)
  ciSocket.on('internal_note_resolved', (data) => {
    if (ciActiveNota?.id === data.nota_id) ciOcultarNota();
  });

  // Mensaje de sala temática
  ciSocket.on('internal_room_message', (msg) => {
    ciReceiveMessage(msg.room_id, msg);
  });

  // Nueva sala creada por otro usuario
  ciSocket.on('internal_room_created', (data) => {
    const sala = data.room;
    if (!sala) return;
    if (!ciSalas.find(s => s.id === sala.id)) {
      ciSalas.push(sala);
      ciMessages[sala.id] = [];
      ciUnread[sala.id]   = 0;
    }
    ciRenderSalasList();
    if (sala.members.includes(ciCurrentUser.id)) {
      ciSocket.emit('join_internal_room', {
        room_id: sala.id, company_id: ciCurrentUser.company_id, user_id: ciCurrentUser.id
      });
    }
  });

  // Participantes actualizados
  ciSocket.on('internal_participants_updated', () => {
    ciLoadParticipants();
  });

  // Votación recibida de otro usuario
  ciSocket.on('internal_votacion', (v) => {
    if (v.room_id !== ciActiveChat) return;
    ciPinVotacion(v);
  });

  // Voto emitido (actualizar porcentajes en todos)
  ciSocket.on('internal_voto', (data) => {
    if (data.votacion) {
      ciUpdateVotacionUI(data.vot_id, data.votacion);
      ciUpdatePinnedVotacion(data.votacion);
    }
  });

  // Tarea recibida de otro usuario
  ciSocket.on('internal_tarea', (t) => {
    if (t.room_id !== ciActiveChat) return;
    if (document.querySelector(`[data-tarea-id="${t.id}"]`)) return; // ya renderizado
    ciRenderTareaCard(t, false);
  });

  // Tarea completada por alguien
  ciSocket.on('internal_tarea_completada', (data) => {
    const card = document.querySelector(`[data-tarea-id="${data.tarea_id}"]`);
    if (!card) return;
    // Si el tarea actualizado muestra todos los responsables completados → marcar card
    const tarea = data.tarea;
    if (tarea) {
      const allDone = tarea.responsables.every(r =>
        tarea.completada_por.includes(r.user_id || r)
      );
      if (allDone) card.querySelector('.ci-card-tarea')?.classList.add('done');
    }
    // Si fue el usuario actual quien completó, ya se actualizó localmente
    if (data.user_id !== ciCurrentUser.id) {
      const btn = card.querySelector('.ci-tarea-check-btn');
      if (btn && data.user_id === ciCurrentUser.id) {
        btn.classList.add('done');
        btn.innerHTML = '<i class="fas fa-check"></i>Completada';
        btn.disabled = true;
      }
    }
  });

  // Confirmación de votación
  ciSocket.on('internal_vot_confirmada', (data) => {
    if (!ciPinnedVotacion || ciPinnedVotacion.id !== data.vot_id) return;
    if (!ciPinnedVotacion.confirmaciones) ciPinnedVotacion.confirmaciones = [];
    if (!ciPinnedVotacion.confirmaciones.includes(data.user_id)) {
      ciPinnedVotacion.confirmaciones.push(data.user_id);
      ciAllPinnedVots[ciPinnedVotacion.room_id] = ciPinnedVotacion;
      _ciRenderPinnedVot(ciPinnedVotacion);
    }
  });

  // Notificación de nueva tarea asignada (campanita)
  ciSocket.on('internal_task_notification', (data) => {
    ciShowTaskBellNotification(data);
  });
}

// ── NOMBRE EMPRESA ──
async function ciLoadCompanyName() {
  const el = document.getElementById('ci-company-name');
  if (!el) return;

  // Intentar desde localStorage o config
  try {
    const cfg = JSON.parse(localStorage.getItem('company_config') || '{}');
    if (cfg.name) { el.textContent = cfg.name; return; }
  } catch (e) {}

  // Fallback: obtener desde API
  try {
    const res = await apiCall(`/api/companies/${ciCurrentUser.company_id}`);
    if (res.ok) {
      const name = res.data?.company?.name || res.data?.name || ciCurrentUser.company_id;
      el.textContent = name;
      return;
    }
  } catch (e) {}

  // Último fallback: company_id
  el.textContent = ciCurrentUser.company_id || '';
}

// ── CARGAR PARTICIPANTES ──
async function ciLoadParticipants() {
  try {
    const res = await apiCall(`/api/internal-chat/${ciCurrentUser.company_id}/participants`);
    if (res.ok) {
      ciParticipants = res.data.participants || [];
    } else {
      // Fallback: cargar usuarios de la empresa
      const usersRes = await apiCall(`/api/companies/${ciCurrentUser.company_id}/users`);
      if (usersRes.ok) {
        ciParticipants = (usersRes.data.users || []).map(u => ({
          user_id:  u.user_id || u._id,
          name:     u.username || u.name || u.email,
          role:     u.role || 'usuario',
          enabled:  true
        }));
      }
    }
  } catch (e) {
    console.warn('No se pudieron cargar participantes:', e.message);
    ciParticipants = [];
  }
}

// ── CARGAR HISTORIAL ──
async function ciLoadHistory(roomId) {
  try {
    const endpoint = roomId === 'general'
      ? `/api/internal-chat/${ciCurrentUser.company_id}/history`
      : `/api/internal-chat/${ciCurrentUser.company_id}/private/${roomId}/history`;

    const res = await apiCall(endpoint);
    if (res.ok) {
      const msgs = res.data.messages || [];
      ciMessages[roomId] = msgs;
      if (ciActiveChat === roomId) ciRenderFeed(roomId);
    }
  } catch (e) {
    // Historial vacío es válido al inicio
    if (!ciMessages[roomId]) ciMessages[roomId] = [];
    if (ciActiveChat === roomId) ciRenderFeed(roomId);
  }
}

// ── RECIBIR MENSAJE ──
function ciReceiveMessage(roomId, msg) {
  if (!ciMessages[roomId]) ciMessages[roomId] = [];
  ciMessages[roomId].push(msg);

  if (ciActiveChat === roomId) {
    ciAppendMessage(msg, roomId);
    ciScrollBottom();
  } else {
    // Incrementar no leídos
    ciUnread[roomId] = (ciUnread[roomId] || 0) + 1;
    ciUpdateUnreadBadge(roomId);
    ciTotalUnread++;
    ciUpdateSidebarBadge();
  }

  // Actualizar preview en sidebar
  ciUpdateChatPreview(roomId, msg.text || '');

  // Notificar si hay mención a este usuario
  if (msg.text && msg.text.includes('@' + ciCurrentUser.name) && msg.from_id !== ciCurrentUser.id) {
    ciShowMentionToast({ from_name: msg.from_name, text: msg.text });
  }
}

// ── ENVIAR MENSAJE ──
function ciEnviar() {
  const input = document.getElementById('ci-input');
  const text  = (input.value || '').trim();
  if (!text) return;

  const msg = {
    from_id:   ciCurrentUser.id,
    from_name: ciCurrentUser.name,
    from_role: ciCurrentUser.role,
    text:      text,
    timestamp: new Date().toISOString(),
    company_id: ciCurrentUser.company_id
  };

  // Si está en modo nota, enviar como nota anclada
  if (ciNotaMode) {
    ciEnviarNota(text);
    input.value = '';
    input.style.height = 'auto';
    document.getElementById('ci-send-btn').disabled = true;
    ciToggleNotaMode(); // desactivar modo nota
    ciStopTyping();
    return;
  }

  if (ciActiveChat === 'general') {
    ciSocket.emit('internal_message', msg);
    ciReceiveMessage('general', { ...msg, own: true });
  } else {
    const privateMsg = {
      ...msg,
      to_id: ciActiveChat,
      room: `private:${[ciCurrentUser.id, ciActiveChat].sort().join(':')}`
    };
    ciSocket.emit('internal_private_message', privateMsg);
    ciReceiveMessage(ciActiveChat, { ...privateMsg, own: true });
  }

  // Detectar menciones y emitirlas
  const mentions = ciExtractMentions(text);
  mentions.forEach(name => {
    const participant = ciParticipants.find(p => p.name === name);
    if (participant) {
      ciSocket.emit('internal_mention', {
        from_id:   ciCurrentUser.id,
        from_name: ciCurrentUser.name,
        to_id:     participant.user_id,
        text:      text,
        room:      ciActiveChat,
        company_id: ciCurrentUser.company_id
      });
    }
  });

  // Limpiar input
  input.value = '';
  input.style.height = 'auto';
  document.getElementById('ci-send-btn').disabled = true;

  // Detener typing
  ciStopTyping();
}

// ── TYPING ──
function ciHandleInput(e) {
  const input = e.target;
  // Auto-resize
  input.style.height = 'auto';
  input.style.height = Math.min(input.scrollHeight, 120) + 'px';

  // Habilitar/deshabilitar botón enviar
  document.getElementById('ci-send-btn').disabled = !input.value.trim();

  // Mention autocomplete
  ciCheckMention(input);

  // Typing emit
  if (input.value.trim()) {
    if (!ciWasTyping) {
      ciWasTyping = true;
      ciSocket?.emit('internal_typing', {
        user_id:   ciCurrentUser.id,
        user_name: ciCurrentUser.name,
        room:      ciActiveChat,
        company_id: ciCurrentUser.company_id
      });
    }
    clearTimeout(ciTypingTimeout);
    ciTypingTimeout = setTimeout(ciStopTyping, CI_TYPING_DELAY);
  } else {
    ciStopTyping();
  }
}

function ciStopTyping() {
  if (ciWasTyping) {
    ciWasTyping = false;
    ciSocket?.emit('internal_typing_stop', {
      user_id:   ciCurrentUser.id,
      room:      ciActiveChat,
      company_id: ciCurrentUser.company_id
    });
  }
  clearTimeout(ciTypingTimeout);
}

function ciHandleKey(e) {
  // Enter sin Shift → enviar
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    const popup = document.getElementById('ci-mention-popup');
    if (popup.classList.contains('open')) {
      ciSelectMentionItem();
    } else {
      ciEnviar();
    }
    return;
  }
  // Navegación en popup de menciones
  if (document.getElementById('ci-mention-popup').classList.contains('open')) {
    if (e.key === 'ArrowDown') { e.preventDefault(); ciMentionNav(1); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); ciMentionNav(-1); }
    if (e.key === 'Escape')    { ciCloseMentionPopup(); }
  }
}

// ── MENTION AUTOCOMPLETE ──
function ciCheckMention(input) {
  const val    = input.value;
  const cursor = input.selectionStart;
  const before = val.slice(0, cursor);
  const match  = before.match(/@(\w*)$/);

  if (match) {
    const query = match[1].toLowerCase();
    const results = ciParticipants.filter(p =>
      p.name.toLowerCase().includes(query) && p.user_id !== ciCurrentUser.id
    );
    ciShowMentionPopup(results);
  } else {
    ciCloseMentionPopup();
  }
}

function ciShowMentionPopup(results) {
  const popup = document.getElementById('ci-mention-popup');
  if (!results.length) { ciCloseMentionPopup(); return; }

  popup.innerHTML = results.map((p, i) => `
    <div class="ci-mention-item${i === 0 ? ' focused' : ''}"
         data-name="${p.name}" data-idx="${i}"
         onmousedown="ciPickMention('${p.name}')">
      <div class="ci-mention-item-avatar">${ciInitials(p.name)}</div>
      <span class="ci-mention-item-name">${p.name}</span>
      <span class="ci-mention-item-role">${p.role}</span>
    </div>
  `).join('');

  popup.classList.add('open');
  ciMentionIndex = 0;
}

function ciCloseMentionPopup() {
  const popup = document.getElementById('ci-mention-popup');
  popup.classList.remove('open');
  popup.innerHTML = '';
  ciMentionIndex = -1;
}

function ciMentionNav(dir) {
  const items = document.querySelectorAll('.ci-mention-item');
  if (!items.length) return;
  items[ciMentionIndex]?.classList.remove('focused');
  ciMentionIndex = (ciMentionIndex + dir + items.length) % items.length;
  items[ciMentionIndex]?.classList.add('focused');
}

function ciSelectMentionItem() {
  const focused = document.querySelector('.ci-mention-item.focused');
  if (focused) ciPickMention(focused.dataset.name);
}

function ciPickMention(name) {
  const input  = document.getElementById('ci-input');
  const val    = input.value;
  const cursor = input.selectionStart;
  const before = val.slice(0, cursor).replace(/@\w*$/, `@${name} `);
  const after  = val.slice(cursor);
  input.value  = before + after;
  input.focus();
  ciCloseMentionPopup();
}

function ciTriggerMention() {
  const input = document.getElementById('ci-input');
  input.value += '@';
  input.focus();
  ciCheckMention(input);
}

function ciExtractMentions(text) {
  const matches = text.match(/@(\w+)/g) || [];
  return matches.map(m => m.slice(1));
}

// ── RENDER FEED ──
function ciRenderFeed(roomId) {
  const feed = document.getElementById('ci-feed');
  const msgs = ciMessages[roomId] || [];

  feed.innerHTML = '';

  if (!msgs.length) {
    feed.innerHTML = `
      <div class="ci-empty">
        <i class="fas fa-comments"></i>
        <p>Sé el primero en escribir algo</p>
      </div>`;
    return;
  }

  // Agrupar por fecha
  let lastDate = '';
  let lastAuthor = '';

  msgs.forEach((msg, i) => {
    const dateStr = ciFormatDate(msg.timestamp);
    if (dateStr !== lastDate) {
      const sep = document.createElement('div');
      sep.className = 'ci-date-sep';
      sep.innerHTML = `<span>${dateStr}</span>`;
      feed.appendChild(sep);
      lastDate   = dateStr;
      lastAuthor = '';
    }

    const continued = lastAuthor === msg.from_id &&
      i > 0 && (new Date(msg.timestamp) - new Date(msgs[i-1].timestamp)) < 120000;

    feed.appendChild(ciBuildMsgEl(msg, continued));
    lastAuthor = msg.from_id;
  });

  ciScrollBottom();
}

function ciAppendMessage(msg, roomId) {
  const feed = document.getElementById('ci-feed');

  // Quitar empty state si existe
  const empty = feed.querySelector('.ci-empty');
  if (empty) empty.remove();

  const msgs = ciMessages[roomId] || [];
  const idx  = msgs.length - 1;
  const prev = msgs[idx - 1];
  const continued = prev && prev.from_id === msg.from_id &&
    (new Date(msg.timestamp) - new Date(prev.timestamp)) < 120000;

  feed.appendChild(ciBuildMsgEl(msg, continued));
}

function ciBuildMsgEl(msg, continued) {
  const isOwn = msg.from_id === ciCurrentUser.id || msg.own;
  const div   = document.createElement('div');
  div.className = `ci-msg${isOwn ? ' own' : ''}${continued ? ' continued' : ''}`;

  const initials  = ciInitials(msg.from_name || '?');
  const roleLabel = ciRoleLabel(msg.from_role);
  const timeStr   = ciFormatTime(msg.timestamp);
  const textHtml  = ciFormatText(msg.text || '');

  div.innerHTML = `
    <div class="ci-msg-avatar">${initials}</div>
    <div class="ci-msg-body">
      <div class="ci-msg-meta">
        <span class="ci-msg-author${isOwn ? ' me' : ''}">${escapeHtml(msg.from_name || 'Usuario')}</span>
        <span class="ci-msg-role ${msg.from_role || ''}">${roleLabel}</span>
        <span class="ci-msg-time">${timeStr}</span>
      </div>
      <div class="ci-msg-text">${textHtml}</div>
    </div>
    <div class="ci-msg-actions">
      ${!isOwn ? `<button class="ci-msg-action-btn" onclick="ciIniciarPrivado('${msg.from_id}','${escapeHtml(msg.from_name||'')}')" title="Mensaje privado"><i class="fas fa-reply"></i></button>` : ''}
    </div>
  `;
  return div;
}

function ciFormatText(text) {
  // Escapar HTML primero
  let html = escapeHtml(text);
  // Resaltar menciones
  html = html.replace(/@(\w+)/g, (m, name) => {
    const isSelf = name === ciCurrentUser.name;
    return `<span class="ci-mention${isSelf ? ' me' : ''}">@${name}</span>`;
  });
  return html;
}

// ── TYPING DISPLAY ──
function ciShowTyping(room) {
  if (room !== ciActiveChat) return;
  const typingEl = document.getElementById('ci-typing');
  const textEl   = document.getElementById('ci-typing-text');
  const users    = Object.values(ciTypingUsers[room] || {});

  if (users.length === 0) {
    typingEl.style.display = 'none';
  } else if (users.length === 1) {
    textEl.textContent = `${users[0]} está escribiendo...`;
    typingEl.style.display = 'flex';
  } else {
    textEl.textContent = `${users.slice(0,-1).join(', ')} y ${users[users.length-1]} están escribiendo...`;
    typingEl.style.display = 'flex';
  }
}

// ── ONLINE LIST ──
function ciUpdateOnlineList(users) {
  const list   = document.getElementById('ci-online-list');
  const count  = document.getElementById('ci-online-count');
  const online = Object.values(users).filter(u => u.online && u.id !== ciCurrentUser.id);

  count.textContent = online.length;

  if (!online.length) {
    list.innerHTML = '<div style="font-size:11px;color:#9BA3C0;padding:4px 6px">Solo tú</div>';
    return;
  }

  list.innerHTML = online.map(u => `
    <div class="ci-online-user" onclick="ciIniciarPrivado('${u.id}','${escapeHtml(u.name||'')}')" title="Mensaje privado">
      <div class="ci-online-user-avatar">
        ${ciInitials(u.name)}
        <div class="ci-online-user-dot"></div>
      </div>
      <span class="ci-online-user-name">${escapeHtml(u.name || 'Usuario')}</span>
    </div>
  `).join('');
}

// ── TABS ──
let ciActiveFilter = 'todos';

function ciFilterTab(tab) {
  ciActiveFilter = tab;

  ['todos','general','salas','privados'].forEach(t => {
    document.getElementById(`ci-tab-${t}`)?.classList.toggle('active', t === tab);
  });

  ['general','salas','privados'].forEach(t => {
    const panel = document.getElementById(`ci-panel-${t}`);
    if (panel) panel.style.display = (tab === 'todos' || tab === t) ? '' : 'none';
  });
}

function ciSwitchTab() {}

// ── ABRIR CHAT GENERAL ──
function ciOpenGeneral() {
  ciActiveChat = 'general';

  // Marcar activo en sidebar
  document.querySelectorAll('.ci-chat-item').forEach(el => el.classList.remove('active'));
  document.getElementById('ci-general-item')?.classList.add('active');

  // Header
  document.getElementById('ci-header-avatar').innerHTML = '<i class="fas fa-hashtag"></i>';
  document.getElementById('ci-header-name').textContent = 'general';
  document.getElementById('ci-header-sub').textContent  = 'Sala principal del equipo';

  // Limpiar no leídos
  ciUnread['general'] = 0;
  ciUpdateUnreadBadge('general');

  // Render
  ciRenderFeed('general');
  ciRestorePinnedBanners('general');
  ciShowTyping('general');
  ciStopTyping();
}

// ── INICIAR PRIVADO ──
function ciIniciarPrivado(userId, userName) {
  if (userId === ciCurrentUser.id) return;

  ciActiveChat = userId;
  if (!ciMessages[userId]) ciMessages[userId] = [];

  ciAddPrivateChatItem(userId, userName, ciOnlineUsers[userId]?.role || '');

  // Marcar activo
  document.querySelectorAll('.ci-chat-item').forEach(el => el.classList.remove('active'));
  document.getElementById(`ci-priv-${userId}`)?.classList.add('active');

  // Header
  const avatar = document.getElementById('ci-header-avatar');
  avatar.innerHTML = ciInitials(userName);
  avatar.style.background = 'linear-gradient(135deg,#8e84fa 0%,#91c0ff 55%)';

  const isOnline = ciOnlineUsers[userId]?.online;
  document.getElementById('ci-header-name').textContent = userName;
  document.getElementById('ci-header-sub').textContent  = isOnline ? '● En línea' : '○ Desconectado';

  // Limpiar no leídos
  ciUnread[userId] = 0;
  ciUpdateUnreadBadge(userId);

  // Cambiar a tab privados
  ciSwitchTab('privados');

  // Render + historial
  ciRenderFeed(userId);
  ciLoadHistory(userId);
  ciShowTyping(userId);
  ciStopTyping();
  ciRestorePinnedBanners(userId);

  // Unirse al room privado via socket
  ciSocket?.emit('join_internal_private', {
    from_id:   ciCurrentUser.id,
    to_id:     userId,
    company_id: ciCurrentUser.company_id
  });
}

function ciAddPrivateChatItem(userId, userName, role) {
  if (document.getElementById(`ci-priv-${userId}`)) return; // ya existe

  const list = document.getElementById('ci-privados-list');
  const item = document.createElement('div');
  item.className = 'ci-chat-item';
  item.id = `ci-priv-${userId}`;
  item.onclick = () => ciIniciarPrivado(userId, userName);

  const isOnline = !!ciOnlineUsers[userId]?.online;
  item.innerHTML = `
    <div class="ci-chat-item-avatar">
      ${ciInitials(userName)}
      <div class="ci-online-dot ${isOnline ? 'online' : ''}"></div>
    </div>
    <div class="ci-chat-item-info">
      <div class="ci-chat-item-name">${escapeHtml(userName)}</div>
      <div class="ci-chat-item-last" id="ci-priv-last-${userId}">Toca para chatear</div>
    </div>
    <div class="ci-unread-badge" id="ci-badge-${userId}" style="display:none">0</div>
  `;
  list.appendChild(item);
}

// ── BADGES ──
function ciUpdateUnreadBadge(roomId) {
  const count = ciUnread[roomId] || 0;
  const badge = document.getElementById(roomId === 'general' ? 'ci-general-badge' : `ci-badge-${roomId}`);
  if (badge) {
    badge.textContent = count;
    badge.style.display = count > 0 ? 'flex' : 'none';
  }
}

function ciUpdateSidebarBadge() {
  const badge = document.getElementById('ci-nav-badge');
  if (!badge) return;
  const total = Object.values(ciUnread).reduce((a, b) => a + b, 0);
  badge.textContent = total > 99 ? '99+' : total;
  badge.style.display = total > 0 ? 'flex' : 'none';
}

function ciUpdateChatPreview(roomId, text) {
  const truncated = text.length > 30 ? text.slice(0, 30) + '...' : text;
  if (roomId === 'general') {
    const el = document.getElementById('ci-general-last');
    if (el) el.textContent = truncated;
  } else {
    const el = document.getElementById(`ci-priv-last-${roomId}`);
    if (el) el.textContent = truncated;
  }
}

// ── MENTION TOAST ──
function ciShowMentionToast(data) {
  const existing = document.getElementById('ci-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'ci-toast';
  toast.className = 'ci-notif-toast';
  toast.innerHTML = `
    <div class="ci-notif-toast-icon">${ciInitials(data.from_name || '?')}</div>
    <div class="ci-notif-toast-body">
      <div class="ci-notif-toast-title">@mención de ${escapeHtml(data.from_name || 'alguien')}</div>
      <div class="ci-notif-toast-msg">${escapeHtml((data.text || '').slice(0, 60))}</div>
    </div>
  `;
  toast.onclick = () => {
    toast.remove();
    if (window.location.hash !== '#chat_interno') window.location.hash = 'chat_interno';
  };
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 5000);
}

// ── TASK BELL NOTIFICATION ──
function ciShowTaskBellNotification(data) {
  // Update bell dot in navbar
  const bell = document.querySelector('.hv-nav-bell');
  if (bell) {
    let dot = bell.querySelector('.hv-nav-bell-dot');
    if (!dot) {
      dot = document.createElement('span');
      dot.className = 'hv-nav-bell-dot';
      dot.textContent = '0';
      bell.appendChild(dot);
    }
    const count = parseInt(dot.textContent || '0') + 1;
    dot.textContent = count;
    dot.style.display = '';
  }

  // Show toast notification
  const existing = document.getElementById('ci-task-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id        = 'ci-task-toast';
  toast.className = 'ci-notif-toast';
  toast.innerHTML = `
    <div class="ci-notif-toast-icon" style="background:linear-gradient(135deg,#10b981,#059669)">
      <i class="fas fa-tasks" style="color:#fff;font-size:13px"></i>
    </div>
    <div class="ci-notif-toast-body">
      <div class="ci-notif-toast-title">Tarea asignada por ${escapeHtml(data.from_name || 'alguien')}</div>
      <div class="ci-notif-toast-msg">${escapeHtml((data.desc || '').slice(0, 60))}</div>
    </div>
  `;
  toast.onclick = () => {
    toast.remove();
    if (window.location.hash !== '#chat_interno') window.location.hash = 'chat_interno';
    if (data.room_id && data.room_id !== ciActiveChat) {
      if (data.room_id === 'general') ciOpenGeneral();
      else ciOpenSala(data.room_id);
    }
  };
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 6000);
}

// ── MODAL PARTICIPANTES ──
function ciAbrirParticipantes() {
  const overlay = document.getElementById('ci-modal-participantes');
  overlay.classList.add('open');
  ciRenderParticipantsModal();
}

function ciCerrarParticipantes() {
  document.getElementById('ci-modal-participantes').classList.remove('open');
}

function ciRenderParticipantsModal() {
  const list = document.getElementById('ci-participants-list');
  if (!ciParticipants.length) {
    list.innerHTML = '<p style="text-align:center;color:#9BA3C0;font-size:13px;padding:20px">No hay usuarios en la empresa</p>';
    return;
  }

  list.innerHTML = ciParticipants.map(p => `
    <div class="ci-participant-item">
      <div class="ci-participant-avatar">${ciInitials(p.name)}</div>
      <div class="ci-participant-info">
        <div class="ci-participant-name">${escapeHtml(p.name)}</div>
        <div class="ci-participant-role">${p.role || 'usuario'}</div>
      </div>
      <button class="ci-toggle ${p.enabled ? 'on' : ''}"
              id="ci-toggle-${p.user_id}"
              onclick="ciToggleParticipant('${p.user_id}', this)">
      </button>
    </div>
  `).join('');
}

function ciToggleParticipant(userId, btn) {
  btn.classList.toggle('on');
  const participant = ciParticipants.find(p => p.user_id === userId);
  if (participant) participant.enabled = btn.classList.contains('on');
}

async function ciGuardarParticipantes() {
  try {
    const enabled = ciParticipants.filter(p => p.enabled).map(p => p.user_id);
    await apiCall(`/api/internal-chat/${ciCurrentUser.company_id}/participants`, {
      method: 'PUT',
      body: JSON.stringify({ enabled_users: enabled })
    });
    ciSocket?.emit('internal_participants_updated', { company_id: ciCurrentUser.company_id });
    ciCerrarParticipantes();
  } catch (e) {
    console.error('Error guardando participantes:', e);
  }
}

// ── UTILS ──
function ciInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(' ').filter(p => p && !/^\d/.test(p));
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
}

function ciRoleLabel(role) {
  const map = {
    admin:        'Admin',
    superadmin:   'Super',
    profesional:  'Prof.',
    secretaria:   'Sec.',
    aliado:       'Aliado',
    owner:        'Owner'
  };
  return map[role] || '';
}

function ciFormatDate(ts) {
  if (!ts) return 'Hoy';
  const d     = new Date(ts);
  const today = new Date();
  const diff  = Math.floor((today - d) / 86400000);
  if (diff === 0) return 'Hoy';
  if (diff === 1) return 'Ayer';
  return d.toLocaleDateString('es-CL', { day: 'numeric', month: 'long' });
}

function ciFormatTime(ts) {
  if (!ts) return '';
  try {
    return new Date(ts).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}

function ciScrollBottom() {
  const feed = document.getElementById('ci-feed');
  if (feed) {
    feed.scrollTop = feed.scrollHeight;
    document.getElementById('ci-scroll-btn').style.display = 'none';
  }
}

function ciInitScrollWatcher() {
  const feed = document.getElementById('ci-feed');
  const btn  = document.getElementById('ci-scroll-btn');
  if (!feed || !btn) return;
  feed.addEventListener('scroll', () => {
    const distFromBottom = feed.scrollHeight - feed.scrollTop - feed.clientHeight;
    btn.style.display = distFromBottom > 120 ? 'flex' : 'none';
  });
}

// ═══════════════════════════════════════════════
//  TOOLBAR + EXPANDIBLE
// ═══════════════════════════════════════════════

function ciTogglePlus() {
  const menu = document.getElementById('ci-plus-menu');
  const btn  = document.getElementById('ci-plus-btn');
  const open = menu.classList.toggle('open');
  btn.classList.toggle('active', open);
}

// Cerrar al click fuera
document.addEventListener('click', function(e) {
  if (!e.target.closest('#ci-plus-btn') && !e.target.closest('#ci-plus-menu')) {
    document.getElementById('ci-plus-menu')?.classList.remove('open');
    document.getElementById('ci-plus-btn')?.classList.remove('active');
  }
});

// ═══════════════════════════════════════════════
//  VOTACIÓN
// ═══════════════════════════════════════════════

function ciAbrirVotacion() {
  document.getElementById('ci-vot-pregunta').value = '';
  document.querySelectorAll('#ci-vot-opciones input').forEach((inp, i) => {
    inp.value = '';
    inp.placeholder = `Opción ${i + 1}`;
  });
  document.getElementById('ci-modal-votacion').classList.add('open');
}

function ciCerrarVotacion() {
  document.getElementById('ci-modal-votacion').classList.remove('open');
}

function ciVotAgregarOpcion() {
  const container = document.getElementById('ci-vot-opciones');
  const count = container.children.length + 1;
  if (count > 6) return;
  const row = document.createElement('div');
  row.className = 'ci-vot-opcion-row';
  row.innerHTML = `
    <input type="text" class="ci-form-input" placeholder="Opción ${count}">
    <button class="ci-vot-remove-btn" onclick="ciVotRemoveOpcion(this)"><i class="fas fa-times"></i></button>
  `;
  container.appendChild(row);
}

function ciVotRemoveOpcion(btn) {
  btn.closest('.ci-vot-opcion-row').remove();
}

function ciEnviarVotacion() {
  const pregunta = document.getElementById('ci-vot-pregunta').value.trim();
  if (!pregunta) { document.getElementById('ci-vot-pregunta').focus(); return; }

  const opciones = Array.from(document.querySelectorAll('#ci-vot-opciones input'))
    .map(inp => inp.value.trim()).filter(Boolean);
  if (opciones.length < 2) { alert('Agrega al menos 2 opciones'); return; }

  const votacion = {
    id:         'vot_' + Date.now(),
    type:       'votacion',
    room_id:    ciActiveChat,
    company_id: ciCurrentUser.company_id,
    from_id:    ciCurrentUser.id,
    from_name:  ciCurrentUser.name,
    from_role:  ciCurrentUser.role,
    pregunta,
    opciones:       opciones.map(o => ({ texto: o, votos: [] })),
    members:        [...new Set([ciCurrentUser.id, ...ciGetRoomMembers(ciActiveChat)])],
    confirmaciones: [],
    timestamp:      new Date().toISOString()
  };

  ciSocket?.emit('internal_votacion', votacion);
  ciPinVotacion(votacion);
  ciCerrarVotacion();

  apiCall(`/api/internal-chat/${ciCurrentUser.company_id}/rooms/${ciActiveChat}/votacion`, {
    method: 'POST', body: JSON.stringify(votacion)
  }).catch(() => {});
}

function ciRenderVotacionCard(v, own) {
  const feed = document.getElementById('ci-feed');
  const empty = feed.querySelector('.ci-empty');
  if (empty) empty.remove();

  const total = v.opciones.reduce((s, o) => s + o.votos.length, 0);
  const yaVote = v.opciones.some(o => o.votos.includes(ciCurrentUser.id));
  const allVoted = v.members.every(id => v.opciones.some(o => o.votos.includes(id)));

  const div = document.createElement('div');
  div.className = `ci-msg${own ? ' own' : ''}`;
  div.dataset.votId = v.id;

  const opcionesHtml = v.opciones.map((o, i) => {
    const pct    = total > 0 ? Math.round((o.votos.length / total) * 100) : 0;
    const voted  = o.votos.includes(ciCurrentUser.id);
    const voters = o.votos.map(uid => {
      const u = ciOnlineUsers[uid] || {};
      return u.name || uid;
    }).join(', ');
    return `
      <button class="ci-vot-option-btn${voted ? ' voted' : ''}"
              onclick="ciVotar('${v.id}', ${i})"
              ${yaVote || allVoted ? 'disabled' : ''}>
        <div class="ci-vot-option-bar" style="width:${pct}%"></div>
        <span class="ci-vot-option-text">${escapeHtml(o.texto)}</span>
        <span class="ci-vot-option-pct">${pct}%</span>
      </button>
      ${voters ? `<div class="ci-vot-voters"><i class="fas fa-user" style="margin-right:3px;font-size:9px"></i>${escapeHtml(voters)}</div>` : ''}
    `;
  }).join('');

  const pendientes = v.members.filter(id => !v.opciones.some(o => o.votos.includes(id))).length;

  div.innerHTML = `
    <div class="ci-msg-avatar">${ciInitials(v.from_name)}</div>
    <div class="ci-msg-body">
      <div class="ci-msg-meta">
        <span class="ci-msg-author${own ? ' me' : ''}">${escapeHtml(v.from_name)}</span>
        <span class="ci-msg-time">${ciFormatTime(v.timestamp)}</span>
      </div>
      <div class="ci-card-votacion">
        <div class="ci-card-header">
          <div class="ci-card-icon"><i class="fas fa-poll"></i></div>
          <div>
            <div class="ci-card-title">${escapeHtml(v.pregunta)}</div>
            <div class="ci-card-meta">${allVoted ? '✓ Votación cerrada' : `Faltan ${pendientes} voto${pendientes !== 1 ? 's' : ''}`}</div>
          </div>
        </div>
        ${opcionesHtml}
      </div>
    </div>
  `;
  feed.appendChild(div);
  ciScrollBottom();
}

// ── VOTACIÓN ANCLADA ──────────────────────────────────────────────────────────

let ciPinnedVotacion   = null; // votación del chat activo
let ciAllPinnedVots    = {};   // roomId → votacion

function ciPinVotacion(v) {
  ciPinnedVotacion = v;
  ciAllPinnedVots[v.room_id] = v;
  const el = document.getElementById('ci-pinned-vot');
  if (!el) return;
  el.style.display = 'block';
  _ciRenderPinnedVot(v);
}

function ciUnpinVotacion(clearStorage = true) {
  if (clearStorage && ciPinnedVotacion) delete ciAllPinnedVots[ciPinnedVotacion.room_id];
  ciPinnedVotacion = null;
  const el = document.getElementById('ci-pinned-vot');
  if (el) el.style.display = 'none';
}

function ciUpdatePinnedVotacion(v) {
  if (!ciPinnedVotacion || ciPinnedVotacion.id !== v.id) return;
  ciPinnedVotacion = v;
  _ciRenderPinnedVot(v);
}

function _ciRenderPinnedVot(v) {
  document.getElementById('ci-pinned-vot-pregunta').textContent = v.pregunta || '';

  const total          = v.opciones.reduce((s, o) => s + (o.votos?.length || 0), 0);
  const yaVote         = v.opciones.some(o => o.votos?.includes(ciCurrentUser.id));
  const allVoted       = v.members?.every(id => v.opciones.some(o => o.votos?.includes(id)));
  const confirmaciones = v.confirmaciones || [];
  const allConfirmed   = v.members?.every(id => confirmaciones.includes(id));
  const yaConfirme     = confirmaciones.includes(ciCurrentUser.id);
  const pendVotos      = v.members?.filter(id => !v.opciones.some(o => o.votos?.includes(id))).length ?? 0;

  // Meta: votos pendientes mientras no todos votaron, confirmaciones después
  document.getElementById('ci-pinned-vot-meta').textContent = !allVoted
    ? `${pendVotos} voto${pendVotos !== 1 ? 's' : ''} pendiente${pendVotos !== 1 ? 's' : ''}`
    : `${confirmaciones.length}/${v.members?.length} confirmado${confirmaciones.length !== 1 ? 's' : ''}`;

  // Encontrar ganador (solo si todos votaron)
  let winnerIdx = -1;
  if (allVoted && total > 0) {
    let maxVotos = -1;
    v.opciones.forEach((o, i) => {
      if ((o.votos?.length || 0) > maxVotos) { maxVotos = o.votos.length; winnerIdx = i; }
    });
  }

  const optsEl = document.getElementById('ci-pinned-vot-opciones');
  optsEl.innerHTML = v.opciones.map((o, i) => {
    const pct     = total > 0 ? Math.round(((o.votos?.length || 0) / total) * 100) : 0;
    const voted   = o.votos?.includes(ciCurrentUser.id);
    const isWinner = allVoted && i === winnerIdx;
    return `
      <button class="ci-pinned-vot-btn${voted ? ' voted' : ''}${isWinner ? ' winner' : ''}"
              onclick="ciVotar('${v.id}',${i})"
              ${yaVote || allVoted ? 'disabled' : ''}>
        <div class="ci-pinned-vot-bar" style="width:${pct}%"></div>
        <span class="ci-pinned-vot-label">${escapeHtml(o.texto)}</span>
        <span class="ci-pinned-vot-pct">${pct}%</span>
      </button>`;
  }).join('');

  // Botón confirmar (aparece cuando todos votaron)
  const el = document.getElementById('ci-pinned-vot');
  let confirmEl = el.querySelector('.ci-pvot-confirm');
  if (!confirmEl) {
    confirmEl = document.createElement('div');
    confirmEl.className = 'ci-pvot-confirm';
    el.appendChild(confirmEl);
  }
  if (allVoted) {
    confirmEl.innerHTML = yaConfirme
      ? `<button class="ci-pvot-confirm-btn confirmed" disabled><i class="fas fa-check"></i> Confirmado</button>`
      : `<button class="ci-pvot-confirm-btn" onclick="ciConfirmarVotacion('${v.id}')"><i class="fas fa-check"></i> Entendido</button>`;
    confirmEl.style.display = '';
  } else {
    confirmEl.style.display = 'none';
  }

  // Cerrar solo cuando todos confirmaron
  if (allConfirmed) setTimeout(() => ciUnpinVotacion(), 2000);
}

function ciConfirmarVotacion(votId) {
  if (!ciPinnedVotacion || ciPinnedVotacion.id !== votId) return;
  if (!ciPinnedVotacion.confirmaciones) ciPinnedVotacion.confirmaciones = [];
  if (ciPinnedVotacion.confirmaciones.includes(ciCurrentUser.id)) return;

  ciPinnedVotacion.confirmaciones.push(ciCurrentUser.id);
  ciAllPinnedVots[ciPinnedVotacion.room_id] = ciPinnedVotacion;
  _ciRenderPinnedVot(ciPinnedVotacion);

  ciSocket?.emit('internal_vot_confirmada', {
    vot_id:     votId,
    user_id:    ciCurrentUser.id,
    room_id:    ciActiveChat,
    company_id: ciCurrentUser.company_id
  });
}

function ciUpdateVotacionUI(votId, v) {
  const card = document.querySelector(`[data-vot-id="${votId}"]`);
  if (!card || !v) return;

  const total    = v.opciones.reduce((s, o) => s + (o.votos?.length || 0), 0);
  const yaVote   = v.opciones.some(o => o.votos?.includes(ciCurrentUser.id));
  const allVoted = v.members?.every(id => v.opciones.some(o => o.votos?.includes(id)));

  card.querySelectorAll('.ci-vot-option-btn').forEach((btn, i) => {
    const o   = v.opciones[i];
    if (!o) return;
    const pct    = total > 0 ? Math.round(((o.votos?.length || 0) / total) * 100) : 0;
    const voted  = o.votos?.includes(ciCurrentUser.id);
    const bar    = btn.querySelector('.ci-vot-option-bar');
    const pctEl  = btn.querySelector('.ci-vot-option-pct');
    if (bar)   bar.style.width    = pct + '%';
    if (pctEl) pctEl.textContent  = pct + '%';
    btn.classList.toggle('voted', voted);
    btn.disabled = yaVote || allVoted;
  });

  const pendientes = v.members?.filter(id => !v.opciones.some(o => o.votos?.includes(id))).length ?? 0;
  const meta = card.querySelector('.ci-card-meta');
  if (meta) meta.textContent = allVoted ? '✓ Votación cerrada' : `Faltan ${pendientes} voto${pendientes !== 1 ? 's' : ''}`;
}

function ciVotar(votId, opcionIdx) {
  if (!ciPinnedVotacion || ciPinnedVotacion.id !== votId) return;

  // Evitar doble voto
  const yaVote = ciPinnedVotacion.opciones.some(o => o.votos?.includes(ciCurrentUser.id));
  if (yaVote) return;

  ciSocket?.emit('internal_voto', {
    vot_id:     votId,
    opcion_idx: opcionIdx,
    user_id:    ciCurrentUser.id,
    user_name:  ciCurrentUser.name,
    room_id:    ciActiveChat,
    company_id: ciCurrentUser.company_id
  });

  // Actualizar estado local y re-renderizar pinned
  const o = ciPinnedVotacion.opciones[opcionIdx];
  if (o) o.votos.push(ciCurrentUser.id);
  _ciRenderPinnedVot(ciPinnedVotacion);
}

// ═══════════════════════════════════════════════
//  DATEPICKER PROGRAMADO (ci-pdp-*)
// ═══════════════════════════════════════════════

let ciPdpDate  = null;
let ciPdpMonth = null;

function ciPdpInit() {
  const now  = new Date();
  ciPdpMonth = { year: now.getFullYear(), month: now.getMonth() };
  const hourSel = document.getElementById('ci-pdp-hour');
  const minSel  = document.getElementById('ci-pdp-min');
  if (!hourSel || !minSel) return;
  hourSel.innerHTML = Array.from({length: 24}, (_, i) =>
    `<option value="${i}">${String(i).padStart(2,'0')}</option>`).join('');
  minSel.innerHTML  = ['00','15','30','45'].map(m =>
    `<option value="${m}">${m}</option>`).join('');
  hourSel.value = '9';
  minSel.value  = '00';
  ciPdpDate = null;
  ciPdpRender();
  ciPdpUpdateDisplay();
}

function ciPdpToggle() { /* inline — no popup */ }

function ciPdpPrevMonth() {
  ciPdpMonth.month--;
  if (ciPdpMonth.month < 0) { ciPdpMonth.month = 11; ciPdpMonth.year--; }
  ciPdpRender();
}

function ciPdpNextMonth() {
  ciPdpMonth.month++;
  if (ciPdpMonth.month > 11) { ciPdpMonth.month = 0; ciPdpMonth.year++; }
  ciPdpRender();
}

function ciPdpRender() {
  if (!ciPdpMonth) return;
  const { year, month } = ciPdpMonth;
  const labelEl = document.getElementById('ci-pdp-month-label');
  if (labelEl) labelEl.textContent = `${CI_DP_MONTHS[month]} ${year}`;
  const grid = document.getElementById('ci-pdp-days');
  if (!grid) return;
  const today   = new Date();
  let startDay  = new Date(year, month, 1).getDay();
  startDay      = startDay === 0 ? 6 : startDay - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev  = new Date(year, month, 0).getDate();
  let html = '';
  for (let i = startDay - 1; i >= 0; i--)
    html += `<button class="ci-dp-day other-month" disabled>${daysInPrev - i}</button>`;
  for (let d = 1; d <= daysInMonth; d++) {
    const date    = new Date(year, month, d);
    const isToday = date.toDateString() === today.toDateString();
    const isSel   = ciPdpDate && date.toDateString() === ciPdpDate.toDateString();
    const isPast  = date < new Date(today.getFullYear(), today.getMonth(), today.getDate());
    html += `<button class="ci-dp-day${isToday ? ' today' : ''}${isSel ? ' selected' : ''}"
      onclick="ciPdpSelectDay(${year},${month},${d})"
      ${isPast ? 'disabled' : ''}>${d}</button>`;
  }
  const total = startDay + daysInMonth;
  const rem   = total % 7 === 0 ? 0 : 7 - (total % 7);
  for (let i = 1; i <= rem; i++)
    html += `<button class="ci-dp-day other-month" disabled>${i}</button>`;
  grid.innerHTML = html;
}

function ciPdpSelectDay(year, month, day) {
  ciPdpDate = new Date(year, month, day);
  ciPdpRender();
  ciPdpUpdateDisplay();
}

function ciPdpUpdateDisplay() { /* inline — display is always the calendar itself */ }

function ciPdpClear() {
  ciPdpDate = null;
  ciPdpRender();
  ciPdpUpdateDisplay();
}

function ciPdpConfirm() {
  ciPdpUpdateDisplay();
}

function ciPdpGetValue() {
  if (!ciPdpDate) return null;
  const hour = parseInt(document.getElementById('ci-pdp-hour')?.value || '9');
  const min  = parseInt(document.getElementById('ci-pdp-min')?.value  || '0');
  const d    = new Date(ciPdpDate);
  d.setHours(hour, min, 0, 0);
  return d.toISOString();
}

// ═══════════════════════════════════════════════
//  MENSAJE PROGRAMADO
// ═══════════════════════════════════════════════

function ciAbrirProgramado() {
  document.getElementById('ci-prog-texto').value = '';
  ciPdpInit();
  document.getElementById('ci-modal-programado').classList.add('open');
}

function ciCerrarProgramado() {
  document.getElementById('ci-modal-programado').classList.remove('open');
}

function ciEnviarProgramado() {
  const texto  = document.getElementById('ci-prog-texto').value.trim();
  const sendAt = ciPdpGetValue();

  if (!texto) { document.getElementById('ci-prog-texto').focus(); return; }
  if (!sendAt) { alert('Selecciona la fecha y hora de envío'); return; }
  if (new Date(sendAt) <= new Date()) { alert('La fecha/hora debe ser en el futuro'); return; }

  const prog = {
    id:         'prog_' + Date.now(),
    type:       'programado',
    room_id:    ciActiveChat,
    company_id: ciCurrentUser.company_id,
    from_id:    ciCurrentUser.id,
    from_name:  ciCurrentUser.name,
    from_role:  ciCurrentUser.role,
    texto,
    send_at:    sendAt,
    timestamp:  new Date().toISOString()
  };

  // Mostrar confirmación en el feed
  ciRenderProgramadoCard(prog, true);
  ciCerrarProgramado();

  apiCall(`/api/internal-chat/${ciCurrentUser.company_id}/rooms/${ciActiveChat}/programado`, {
    method: 'POST', body: JSON.stringify(prog)
  }).catch(() => {});
}

function ciRenderProgramadoCard(p, own) {
  const feed = document.getElementById('ci-feed');
  const empty = feed.querySelector('.ci-empty');
  if (empty) empty.remove();

  const sendDate = new Date(p.send_at);
  const dateStr  = sendDate.toLocaleDateString('es-CL', { day: 'numeric', month: 'long' });
  const timeStr  = sendDate.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });

  const div = document.createElement('div');
  div.className = `ci-msg${own ? ' own' : ''}`;
  div.innerHTML = `
    <div class="ci-msg-avatar">${ciInitials(p.from_name)}</div>
    <div class="ci-msg-body">
      <div class="ci-msg-meta">
        <span class="ci-msg-author${own ? ' me' : ''}">${escapeHtml(p.from_name)}</span>
        <span class="ci-msg-time">${ciFormatTime(p.timestamp)}</span>
      </div>
      <div class="ci-card-programado">
        <div class="ci-card-header">
          <div class="ci-card-icon" style="background:rgba(14,165,233,.1);color:#0ea5e9"><i class="fas fa-clock"></i></div>
          <div>
            <div class="ci-card-title">Mensaje programado</div>
            <div class="ci-card-meta">Se enviará el ${dateStr} a las ${timeStr}</div>
          </div>
        </div>
        <div class="ci-card-prog-text">${escapeHtml(p.texto)}</div>
        <div class="ci-card-prog-time"><i class="fas fa-calendar-alt"></i>${dateStr} · ${timeStr}</div>
      </div>
    </div>
  `;
  feed.appendChild(div);
  ciScrollBottom();
}

// ═══════════════════════════════════════════════
//  DATEPICKER TAREA
// ═══════════════════════════════════════════════

let ciDpDate  = null;
let ciDpMonth = null;
const CI_DP_MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const CI_DP_MONTHS_SHORT = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];

function ciDpInit() {
  const now  = new Date();
  ciDpMonth  = { year: now.getFullYear(), month: now.getMonth() };

  const hourSel = document.getElementById('ci-dp-hour');
  const minSel  = document.getElementById('ci-dp-min');
  if (!hourSel || !minSel) return;

  hourSel.innerHTML = Array.from({length: 24}, (_, i) =>
    `<option value="${i}">${String(i).padStart(2,'0')}</option>`).join('');
  minSel.innerHTML  = ['00','15','30','45'].map(m =>
    `<option value="${m}">${m}</option>`).join('');

  // Default time 09:00
  hourSel.value = '9';
  minSel.value  = '00';

  ciDpRender();

  // Cerrar al click fuera
  document.addEventListener('click', function _dpOutside(e) {
    if (!e.target.closest('#ci-dp-wrap') && !e.target.closest('#ci-dp-popup')) {
      document.getElementById('ci-dp-popup')?.classList.remove('open');
    }
  });
}

function ciDpToggle() {
  const popup = document.getElementById('ci-dp-popup');
  popup.classList.toggle('open');
  if (popup.classList.contains('open')) ciDpRender();
}

function ciDpPrevMonth() {
  ciDpMonth.month--;
  if (ciDpMonth.month < 0) { ciDpMonth.month = 11; ciDpMonth.year--; }
  ciDpRender();
}

function ciDpNextMonth() {
  ciDpMonth.month++;
  if (ciDpMonth.month > 11) { ciDpMonth.month = 0; ciDpMonth.year++; }
  ciDpRender();
}

function ciDpRender() {
  if (!ciDpMonth) return;
  const { year, month } = ciDpMonth;
  const labelEl = document.getElementById('ci-dp-month-label');
  if (labelEl) labelEl.textContent = `${CI_DP_MONTHS[month]} ${year}`;

  const grid      = document.getElementById('ci-dp-days');
  if (!grid) return;
  const today     = new Date();
  const todayStr  = today.toDateString();
  let startDay    = new Date(year, month, 1).getDay(); // 0=Dom
  startDay = startDay === 0 ? 6 : startDay - 1;         // Lun=0..Dom=6

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev  = new Date(year, month, 0).getDate();
  let html = '';

  for (let i = startDay - 1; i >= 0; i--)
    html += `<button class="ci-dp-day other-month" disabled>${daysInPrev - i}</button>`;

  for (let d = 1; d <= daysInMonth; d++) {
    const date     = new Date(year, month, d);
    const isToday  = date.toDateString() === todayStr;
    const isSel    = ciDpDate && date.toDateString() === ciDpDate.toDateString();
    const isPast   = date < new Date(today.getFullYear(), today.getMonth(), today.getDate());
    html += `<button class="ci-dp-day${isToday ? ' today' : ''}${isSel ? ' selected' : ''}"
      onclick="ciDpSelectDay(${year},${month},${d})"
      ${isPast ? 'disabled' : ''}>${d}</button>`;
  }

  const total     = startDay + daysInMonth;
  const remaining = total % 7 === 0 ? 0 : 7 - (total % 7);
  for (let i = 1; i <= remaining; i++)
    html += `<button class="ci-dp-day other-month" disabled>${i}</button>`;

  grid.innerHTML = html;
}

function ciDpSelectDay(year, month, day) {
  ciDpDate = new Date(year, month, day);
  ciDpRender();
  ciDpUpdateDisplay();
}

function ciDpUpdateDisplay() {
  const display  = document.getElementById('ci-dp-display');
  const clearBtn = document.getElementById('ci-dp-clear-btn');
  if (!display) return;
  if (!ciDpDate) {
    display.textContent    = 'Sin fecha límite';
    if (clearBtn) clearBtn.style.display = 'none';
    return;
  }
  const hour    = document.getElementById('ci-dp-hour')?.value || '9';
  const min     = document.getElementById('ci-dp-min')?.value  || '00';
  const dateStr = `${ciDpDate.getDate()} ${CI_DP_MONTHS_SHORT[ciDpDate.getMonth()]} ${ciDpDate.getFullYear()}`;
  display.textContent = `${dateStr} · ${String(hour).padStart(2,'0')}:${min}`;
  if (clearBtn) clearBtn.style.display = '';
}

function ciDpClear() {
  ciDpDate = null;
  ciDpUpdateDisplay();
  document.getElementById('ci-dp-popup')?.classList.remove('open');
}

function ciDpConfirm() {
  ciDpUpdateDisplay();
  document.getElementById('ci-dp-popup')?.classList.remove('open');
}

function ciDpGetValue() {
  if (!ciDpDate) return null;
  const hour = parseInt(document.getElementById('ci-dp-hour')?.value || '9');
  const min  = parseInt(document.getElementById('ci-dp-min')?.value  || '0');
  const d    = new Date(ciDpDate);
  d.setHours(hour, min, 0, 0);
  return d.toISOString();
}

// ═══════════════════════════════════════════════
//  ASIGNAR TAREA
// ═══════════════════════════════════════════════

function ciSelPrio(btn) {
  document.querySelectorAll('.ci-prio-chip').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('ci-tarea-prioridad').value = btn.dataset.value;
}

function ciAbrirTarea() {
  document.getElementById('ci-tarea-desc').value  = '';
  document.getElementById('ci-tarea-prioridad').value = 'normal';
  document.getElementById('ci-tarea-calendario').checked = false;
  // Reset prioridad chips
  document.querySelectorAll('.ci-prio-chip').forEach(b => b.classList.remove('active'));
  document.querySelector('.ci-prio-chip[data-value="normal"]')?.classList.add('active');
  ciDpDate = null;
  ciDpInit();

  // Cargar responsables
  const container = document.getElementById('ci-tarea-responsables');
  const participants = ciParticipants.length
    ? ciParticipants
    : Object.values(ciOnlineUsers).map(u => ({ user_id: u.id, name: u.name, role: u.role }));

  container.innerHTML = participants.map(p => `
    <label class="ci-member-row">
      <input type="checkbox" value="${p.user_id}" onchange="ciTareaUpdateCount()">
      <div class="ci-member-row-avatar">${ciInitials(p.name)}</div>
      <span class="ci-member-row-name">${escapeHtml(p.name)}</span>
      <span class="ci-member-row-role">${p.role || ''}</span>
    </label>
  `).join('');

  ciTareaUpdateCount();
  document.getElementById('ci-modal-tarea').classList.add('open');
}

function ciCerrarTarea() {
  document.getElementById('ci-modal-tarea').classList.remove('open');
}

function ciTareaUpdateCount() {
  const count = document.querySelectorAll('#ci-tarea-responsables input:checked').length;
  document.getElementById('ci-tarea-resp-count').textContent =
    `${count} seleccionado${count !== 1 ? 's' : ''}`;
}

function ciEnviarTarea() {
  const desc       = document.getElementById('ci-tarea-desc').value.trim();
  const fecha      = ciDpGetValue();
  const prioridad  = document.getElementById('ci-tarea-prioridad').value;
  const calendario = document.getElementById('ci-tarea-calendario').checked;

  if (!desc) { document.getElementById('ci-tarea-desc').focus(); return; }

  const responsables = Array.from(
    document.querySelectorAll('#ci-tarea-responsables input:checked')
  ).map(cb => {
    const row = cb.closest('.ci-member-row');
    return {
      user_id: cb.value,
      name:    row.querySelector('.ci-member-row-name')?.textContent || cb.value
    };
  });

  if (!responsables.length) { alert('Selecciona al menos un responsable'); return; }

  const tarea = {
    id:           'tarea_' + Date.now(),
    type:         'tarea',
    room_id:      ciActiveChat,
    company_id:   ciCurrentUser.company_id,
    from_id:      ciCurrentUser.id,
    from_name:    ciCurrentUser.name,
    from_role:    ciCurrentUser.role,
    desc,
    responsables,
    fecha_limite: fecha || null,
    prioridad,
    calendario,
    completada_por: [],
    timestamp:    new Date().toISOString()
  };

  ciSocket?.emit('internal_tarea', tarea);
  ciRenderTareaCard(tarea, true);
  ciCerrarTarea();

  apiCall(`/api/internal-chat/${ciCurrentUser.company_id}/rooms/${ciActiveChat}/tarea`, {
    method: 'POST', body: JSON.stringify(tarea)
  }).catch(() => {});
}

function ciRenderTareaCard(t, own) {
  const feed = document.getElementById('ci-feed');
  const empty = feed.querySelector('.ci-empty');
  if (empty) empty.remove();

  const prioChip = t.prioridad !== 'normal'
    ? `<span class="ci-tarea-chip ${t.prioridad}"><i class="fas fa-flag"></i>${t.prioridad.toUpperCase()}</span>`
    : '';

  const respChips = t.responsables.map(r =>
    `<span class="ci-tarea-chip responsable"><i class="fas fa-user"></i>${escapeHtml(r.name)}</span>`
  ).join('');

  const fechaChip = t.fecha_limite
    ? (() => {
        const fd = new Date(t.fecha_limite);
        const ds = fd.toLocaleDateString('es-CL', { day:'numeric', month:'short', year:'numeric' });
        const ts = fd.toLocaleTimeString('es-CL', { hour:'2-digit', minute:'2-digit' });
        return `<span class="ci-tarea-chip fecha"><i class="fas fa-calendar"></i>${ds} · ${ts}</span>`;
      })()
    : '';

  const soyResponsable = t.responsables.some(r => r.user_id === ciCurrentUser.id);
  const yaComplete = t.completada_por.includes(ciCurrentUser.id);

  const div = document.createElement('div');
  div.className = `ci-msg${own ? ' own' : ''}`;
  div.dataset.tareaId = t.id;
  div.innerHTML = `
    <div class="ci-msg-avatar">${ciInitials(t.from_name)}</div>
    <div class="ci-msg-body">
      <div class="ci-msg-meta">
        <span class="ci-msg-author${own ? ' me' : ''}">${escapeHtml(t.from_name)}</span>
        <span class="ci-msg-time">${ciFormatTime(t.timestamp)}</span>
      </div>
      <div class="ci-card-tarea">
        <div class="ci-card-header">
          <div class="ci-card-icon"><i class="fas fa-tasks"></i></div>
          <div>
            <div class="ci-card-title">Tarea asignada</div>
            <div class="ci-card-meta">${t.responsables.length} responsable${t.responsables.length !== 1 ? 's' : ''}</div>
          </div>
        </div>
        <div class="ci-card-tarea-desc">${escapeHtml(t.desc)}</div>
        <div class="ci-card-tarea-meta">${respChips}${fechaChip}${prioChip}</div>
        ${soyResponsable ? `
          <button class="ci-tarea-check-btn${yaComplete ? ' done' : ''}"
                  onclick="ciCompletarTarea('${t.id}')"
                  ${yaComplete ? 'disabled' : ''}>
            <i class="fas fa-check"></i>${yaComplete ? 'Completada' : 'Marcar como completada'}
          </button>` : ''}
      </div>
    </div>
  `;
  feed.appendChild(div);
  ciScrollBottom();
}

function ciCompletarTarea(tareaId) {
  ciSocket?.emit('internal_tarea_completada', {
    tarea_id:   tareaId,
    user_id:    ciCurrentUser.id,
    user_name:  ciCurrentUser.name,
    room_id:    ciActiveChat,
    company_id: ciCurrentUser.company_id
  });

  const btn = document.querySelector(`[data-tarea-id="${tareaId}"] .ci-tarea-check-btn`);
  if (btn) {
    btn.classList.add('done');
    btn.innerHTML = '<i class="fas fa-check"></i>Completada';
    btn.disabled = true;
  }

  apiCall(`/api/internal-chat/${ciCurrentUser.company_id}/rooms/${ciActiveChat}/tarea/${tareaId}/completar`, {
    method: 'PUT', body: JSON.stringify({ user_id: ciCurrentUser.id })
  }).catch(() => {});
}

// ═══════════════════════════════════════════════
//  NOTA ANCLADA
// ═══════════════════════════════════════════════

let ciNotaMode    = false;  // true = próximo envío es nota anclada
let ciActiveNota     = null; // nota del chat activo
let ciAllPinnedNotas = {};   // roomId → nota

function ciToggleNotaMode() {
  ciNotaMode = !ciNotaMode;
  const btn      = document.getElementById('ci-nota-toggle');
  const inputBox = document.getElementById('ci-input-box');
  const input    = document.getElementById('ci-input');

  btn.classList.toggle('active', ciNotaMode);
  inputBox.classList.toggle('nota-mode', ciNotaMode);
  input.placeholder = ciNotaMode
    ? '📌 Escribe la nota anclada...'
    : 'Escribe un mensaje... usa @ para mencionar';
}

function ciEnviarNota(text) {
  const roomId   = ciActiveChat;
  const members  = ciGetRoomMembers(roomId);
  const nota = {
    id:            'nota_' + Date.now(),
    room_id:       roomId,
    company_id:    ciCurrentUser.company_id,
    text:          text,
    from_id:       ciCurrentUser.id,
    from_name:     ciCurrentUser.name,
    members:       members,
    confirmations: [],
    timestamp:     new Date().toISOString()
  };

  // Emitir vía socket
  ciSocket?.emit('internal_pinned_note', nota);

  // Mostrar localmente
  ciMostrarNota(nota);

  // Persistir en backend
  apiCall(`/api/internal-chat/${ciCurrentUser.company_id}/rooms/${roomId}/pinned`, {
    method: 'POST',
    body: JSON.stringify(nota)
  }).catch(() => {});
}

function ciGetRoomMembers(roomId) {
  if (roomId === 'general') {
    return Object.keys(ciOnlineUsers);
  }
  const sala = ciSalas.find(s => s.id === roomId);
  if (sala) return [...sala.members];
  // Privado: los dos usuarios
  return [ciCurrentUser.id, roomId];
}

function ciMostrarNota(nota) {
  ciActiveNota = nota;
  ciAllPinnedNotas[nota.room_id] = nota;

  const banner   = document.getElementById('ci-pinned-banner');
  const textEl   = document.getElementById('ci-pinned-text');
  const confsEl  = document.getElementById('ci-pinned-confirmations');
  const confirmBtn = document.getElementById('ci-pinned-confirm-btn');

  textEl.textContent = nota.text;
  banner.style.display = 'flex';

  // Renderizar chips de confirmación
  ciRenderNotaConfirmations(nota);

  // El remitente no necesita confirmar la suya propia
  const yaConfirme = nota.confirmations.includes(ciCurrentUser.id);
  const soySender  = nota.from_id === ciCurrentUser.id;

  if (soySender || yaConfirme) {
    confirmBtn.classList.add('confirmed');
    confirmBtn.innerHTML = '<i class="fas fa-check"></i> Confirmado';
    confirmBtn.disabled = true;
  } else {
    confirmBtn.classList.remove('confirmed');
    confirmBtn.innerHTML = '<i class="fas fa-check"></i> Visto bueno';
    confirmBtn.disabled = false;
  }
}

function ciRenderNotaConfirmations(nota) {
  const confsEl = document.getElementById('ci-pinned-confirmations');
  if (!confsEl) return;

  const isPrivado = nota.members.length === 2;
  const pendientes = nota.members.filter(id => !nota.confirmations.includes(id) && id !== nota.from_id);
  const confirmados = nota.confirmations;

  let html = '';

  confirmados.forEach(id => {
    const user = ciOnlineUsers[id] || {};
    const name = user.name || id;
    html += `<span class="ci-pinned-chip confirmed"><i class="fas fa-check"></i>${ciInitials(name)}</span>`;
  });

  pendientes.forEach(id => {
    const user = ciOnlineUsers[id] || {};
    const name = user.name || id;
    html += `<span class="ci-pinned-chip pending"><i class="fas fa-clock"></i>${ciInitials(name)}</span>`;
  });

  const total    = nota.members.filter(id => id !== nota.from_id).length;
  const confirmed = confirmados.length;
  html += `<span style="font-size:10px;color:#92400e;margin-left:4px">${confirmed}/${total}</span>`;

  confsEl.innerHTML = html;
}

function ciConfirmarNota() {
  if (!ciActiveNota) return;
  if (ciActiveNota.confirmations.includes(ciCurrentUser.id)) return;

  ciActiveNota.confirmations.push(ciCurrentUser.id);

  // Actualizar UI
  ciRenderNotaConfirmations(ciActiveNota);

  const confirmBtn = document.getElementById('ci-pinned-confirm-btn');
  confirmBtn.classList.add('confirmed');
  confirmBtn.innerHTML = '<i class="fas fa-check"></i> Confirmado';
  confirmBtn.disabled = true;

  // Emitir confirmación
  ciSocket?.emit('internal_note_confirmed', {
    nota_id:    ciActiveNota.id,
    room_id:    ciActiveNota.room_id,
    user_id:    ciCurrentUser.id,
    user_name:  ciCurrentUser.name,
    company_id: ciCurrentUser.company_id,
    confirmations: ciActiveNota.confirmations
  });

  // Persistir en backend
  apiCall(`/api/internal-chat/${ciCurrentUser.company_id}/rooms/${ciActiveNota.room_id}/pinned/${ciActiveNota.id}/confirm`, {
    method: 'PUT',
    body: JSON.stringify({ user_id: ciCurrentUser.id })
  }).catch(() => {});

  // Verificar si todos confirmaron
  ciCheckNotaResuelta();
}

function ciCheckNotaResuelta() {
  if (!ciActiveNota) return;
  const pendientes = ciActiveNota.members.filter(
    id => !ciActiveNota.confirmations.includes(id) && id !== ciActiveNota.from_id
  );
  if (pendientes.length === 0) {
    // Todos confirmaron — desaparecer con animación
    setTimeout(() => {
      const banner = document.getElementById('ci-pinned-banner');
      if (banner) {
        banner.style.transition = 'opacity .4s, transform .4s';
        banner.style.opacity    = '0';
        banner.style.transform  = 'translateY(-10px)';
        setTimeout(() => {
          banner.style.display = 'none';
          banner.style.opacity = '';
          banner.style.transform = '';
        }, 400);
      }
      ciActiveNota = null;
    }, 600);
  }
}

function ciRestorePinnedBanners(roomId) {
  // Nota
  const nota = ciAllPinnedNotas[roomId];
  if (nota) ciMostrarNota(nota);
  else ciOcultarNota(false);

  // Votación
  const vot = ciAllPinnedVots[roomId];
  if (vot) ciPinVotacion(vot);
  else ciUnpinVotacion(false);
}

function ciOcultarNota(clearStorage = true) {
  const banner = document.getElementById('ci-pinned-banner');
  if (banner) banner.style.display = 'none';
  if (clearStorage && ciActiveNota) delete ciAllPinnedNotas[ciActiveNota.room_id];
  ciActiveNota = null;
}

// ═══════════════════════════════════════════════
//  SALAS TEMÁTICAS
// ═══════════════════════════════════════════════

const CI_SALA_COLORS = [
  'linear-gradient(135deg,#8e84fa,#91c0ff)',
  'linear-gradient(135deg,#34d399,#6ee7b7)',
  'linear-gradient(135deg,#f59e0b,#fcd34d)',
  'linear-gradient(135deg,#f87171,#fca5a5)',
  'linear-gradient(135deg,#60a5fa,#93c5fd)',
  'linear-gradient(135deg,#a78bfa,#c4b5fd)',
  'linear-gradient(135deg,#fb7185,#fda4af)',
  'linear-gradient(135deg,#2dd4bf,#99f6e4)',
];

// Cargar salas desde API
async function ciLoadSalas() {
  try {
    const res = await apiCall(`/api/internal-chat/${ciCurrentUser.company_id}/rooms`);
    if (res.ok) {
      ciSalas = (res.data.rooms || []).map((r, i) => ({
        id:      r._id || r.id,
        name:    r.name,
        desc:    r.description || '',
        members: r.members || [],
        color:   r.color || CI_SALA_COLORS[i % CI_SALA_COLORS.length]
      }));
    }
  } catch (e) {
    // Sin salas aún — estado vacío normal
    ciSalas = [];
  }
  ciRenderSalasList();
  // Unirse a los rooms de cada sala vía socket
  ciSalas.forEach(sala => {
    if (sala.members.includes(ciCurrentUser.id)) {
      ciSocket?.emit('join_internal_room', {
        room_id:    sala.id,
        company_id: ciCurrentUser.company_id,
        user_id:    ciCurrentUser.id
      });
      if (!ciMessages[sala.id]) ciMessages[sala.id] = [];
      if (!ciUnread[sala.id])   ciUnread[sala.id]   = 0;
    }
  });
}

// Render lista de salas en el sidebar
function ciRenderSalasList() {
  const container = document.getElementById('ci-salas-list');
  if (!ciSalas.length) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = ciSalas.map(sala => {
    const isMember  = sala.members.includes(ciCurrentUser.id);
    const lastMsg   = (ciMessages[sala.id] || []).slice(-1)[0];
    const lastText  = lastMsg ? (lastMsg.text || '').slice(0, 35) : (sala.desc || 'Sin mensajes aún');
    const unread    = ciUnread[sala.id] || 0;
    const memberCount = sala.members.length;
    const isActive  = ciActiveChat === sala.id;
    const canEdit   = ciIsAdmin;

    return `
      <div class="ci-sala-item${isActive ? ' active' : ''}" id="ci-sala-${sala.id}"
           onclick="ciOpenSala('${sala.id}')">
        <div class="ci-sala-avatar" style="background:${sala.color}">
          ${sala.name.charAt(0).toUpperCase()}
        </div>
        <div class="ci-sala-info">
          <div class="ci-sala-name">${escapeHtml(sala.name)}</div>
          <div class="ci-sala-last">${escapeHtml(lastText)}</div>
          <div class="ci-sala-members"><i class="fas fa-users" style="font-size:8px;margin-right:3px"></i>${memberCount} miembro${memberCount !== 1 ? 's' : ''}</div>
        </div>
        ${unread > 0 ? `<div class="ci-unread-badge" id="ci-sala-badge-${sala.id}">${unread}</div>` : `<div class="ci-unread-badge" id="ci-sala-badge-${sala.id}" style="display:none">0</div>`}
        ${canEdit ? `<button class="ci-sala-edit-btn" onclick="event.stopPropagation();ciEditarSala('${sala.id}')" title="Editar sala"><i class="fas fa-pencil-alt"></i></button>` : ''}
      </div>
    `;
  }).join('');
}

// Abrir sala
function ciOpenSala(salaId) {
  const sala = ciSalas.find(s => s.id === salaId);
  if (!sala) return;

  ciActiveChat = salaId;

  // Inicializar mensajes si no existen
  if (!ciMessages[salaId]) ciMessages[salaId] = [];

  // Marcar activo en sidebar
  document.querySelectorAll('.ci-chat-item, .ci-sala-item').forEach(el => el.classList.remove('active'));
  document.getElementById(`ci-sala-${salaId}`)?.classList.add('active');

  // Header
  const avatar = document.getElementById('ci-header-avatar');
  avatar.innerHTML = sala.name.charAt(0).toUpperCase();
  avatar.style.background    = sala.color;
  avatar.style.borderRadius  = '10px';
  avatar.style.fontSize      = '15px';

  document.getElementById('ci-header-name').textContent = sala.name;
  document.getElementById('ci-header-sub').innerHTML =
    `<span class="ci-sala-header-badge"><i class="fas fa-users"></i>${sala.members.length} miembro${sala.members.length !== 1 ? 's' : ''}</span>
     ${sala.desc ? `<span style="margin-left:6px">${escapeHtml(sala.desc)}</span>` : ''}`;

  // Limpiar no leídos
  ciUnread[salaId] = 0;
  ciUpdateUnreadBadge(salaId);

  // Render + historial
  ciRenderFeed(salaId);
  ciLoadHistory(salaId);
  ciShowTyping(salaId);
  ciStopTyping();
  ciRestorePinnedBanners(salaId);

  // Unirse al room socket si no estaba
  ciSocket?.emit('join_internal_room', {
    room_id:    salaId,
    company_id: ciCurrentUser.company_id,
    user_id:    ciCurrentUser.id
  });
}

// Abrir modal para crear sala
function ciAddBtnClick() {
  if (ciActiveFilter === 'privados') ciAbrirNuevoPrivado();
  else ciAbrirNuevaSala();
}

function ciAbrirNuevoPrivado() {
  const lista = document.getElementById('ci-privado-lista');
  if (!lista) return;

  // Personas disponibles: participantes excluyendo al usuario actual
  const personas = ciParticipants.length
    ? ciParticipants.filter(p => p.user_id !== ciCurrentUser.id)
    : Object.values(ciOnlineUsers).filter(u => u.id !== ciCurrentUser.id)
        .map(u => ({ user_id: u.id, name: u.name, role: u.role }));

  lista.innerHTML = personas.map(p => `
    <label class="ci-member-row" style="cursor:pointer">
      <input type="radio" name="ci-privado-persona" value="${p.user_id}" data-name="${escapeHtml(p.name || '')}">
      <div class="ci-member-row-avatar">${ciInitials(p.name)}</div>
      <span class="ci-member-row-name">${escapeHtml(p.name)}</span>
      <span class="ci-member-row-role">${p.role || ''}</span>
    </label>
  `).join('') || '<p style="color:#9ba3c0;font-size:12px;padding:8px">No hay participantes disponibles</p>';

  document.getElementById('ci-modal-privado').classList.add('open');
}

function ciCerrarNuevoPrivado() {
  document.getElementById('ci-modal-privado').classList.remove('open');
}

function ciCrearPrivado() {
  const sel = document.querySelector('input[name="ci-privado-persona"]:checked');
  if (!sel) { alert('Selecciona una persona'); return; }
  const userId   = sel.value;
  const userName = sel.dataset.name;
  ciCerrarNuevoPrivado();
  ciIniciarPrivado(userId, userName);
}

function ciAbrirNuevaSala() {
  ciEditingSalaId = null;
  document.getElementById('ci-modal-sala-title').innerHTML =
    '<i class="fas fa-layer-group" style="color:#8e84fa;margin-right:8px"></i>Nueva sala';
  document.getElementById('ci-sala-save-label').textContent = 'Crear sala';
  document.getElementById('ci-sala-delete-btn').style.display = 'none';
  document.getElementById('ci-sala-nombre').value = '';
  document.getElementById('ci-sala-desc').value   = '';
  ciRenderMembersList([]);
  document.getElementById('ci-modal-sala').classList.add('open');
}

// Abrir modal para editar sala existente
function ciEditarSala(salaId) {
  const sala = ciSalas.find(s => s.id === salaId);
  if (!sala) return;
  ciEditingSalaId = salaId;

  document.getElementById('ci-modal-sala-title').innerHTML =
    '<i class="fas fa-pencil-alt" style="color:#8e84fa;margin-right:8px"></i>Editar sala';
  document.getElementById('ci-sala-save-label').textContent = 'Guardar cambios';
  document.getElementById('ci-sala-delete-btn').style.display = ciIsAdmin ? '' : 'none';
  document.getElementById('ci-sala-nombre').value = sala.name;
  document.getElementById('ci-sala-desc').value   = sala.desc || '';
  ciRenderMembersList(sala.members);
  document.getElementById('ci-modal-sala').classList.add('open');
}

function ciCerrarNuevaSala() {
  document.getElementById('ci-modal-sala').classList.remove('open');
  ciEditingSalaId = null;
}

// Render lista de miembros con checkboxes
function ciRenderMembersList(selectedIds) {
  const container = document.getElementById('ci-sala-members-list');
  const participants = ciParticipants.length
    ? ciParticipants
    : Object.values(ciOnlineUsers).map(u => ({ user_id: u.id, name: u.name, role: u.role }));

  if (!participants.length) {
    container.innerHTML = '<div style="text-align:center;padding:16px;color:#9BA3C0;font-size:12px">No hay usuarios disponibles</div>';
    return;
  }

  container.innerHTML = participants.map(p => {
    const checked = selectedIds.includes(p.user_id);
    return `
      <label class="ci-member-row">
        <input type="checkbox" value="${p.user_id}"
               ${checked ? 'checked' : ''}
               onchange="ciUpdateMemberCount()">
        <div class="ci-member-row-avatar">${ciInitials(p.name)}</div>
        <span class="ci-member-row-name">${escapeHtml(p.name)}</span>
        <span class="ci-member-row-role">${p.role || ''}</span>
      </label>
    `;
  }).join('');

  ciUpdateMemberCount();
}

function ciUpdateMemberCount() {
  const checked = document.querySelectorAll('#ci-sala-members-list input[type="checkbox"]:checked').length;
  document.getElementById('ci-sala-members-count').textContent =
    `${checked} seleccionado${checked !== 1 ? 's' : ''}`;
}

// Guardar sala (crear o editar)
async function ciGuardarSala() {
  const nombre  = (document.getElementById('ci-sala-nombre').value || '').trim();
  const desc    = (document.getElementById('ci-sala-desc').value   || '').trim();
  const members = Array.from(
    document.querySelectorAll('#ci-sala-members-list input[type="checkbox"]:checked')
  ).map(cb => cb.value);

  if (!nombre) {
    document.getElementById('ci-sala-nombre').focus();
    document.getElementById('ci-sala-nombre').style.borderColor = '#ef4444';
    return;
  }

  // Siempre incluir al creador
  if (!members.includes(ciCurrentUser.id)) members.push(ciCurrentUser.id);

  const colorIdx = ciEditingSalaId
    ? ciSalas.findIndex(s => s.id === ciEditingSalaId) % CI_SALA_COLORS.length
    : ciSalas.length % CI_SALA_COLORS.length;
  const color = CI_SALA_COLORS[colorIdx];

  try {
    if (ciEditingSalaId) {
      // Editar
      const res = await apiCall(
        `/api/internal-chat/${ciCurrentUser.company_id}/rooms/${ciEditingSalaId}`,
        { method: 'PUT', body: JSON.stringify({ name: nombre, description: desc, members, color }) }
      );
      if (res.ok || true) {
        const idx = ciSalas.findIndex(s => s.id === ciEditingSalaId);
        if (idx >= 0) ciSalas[idx] = { ...ciSalas[idx], name: nombre, desc, members, color };
      }
    } else {
      // Crear
      const tempId = 'sala_' + Date.now();
      const newSala = { id: tempId, name: nombre, desc, members, color };

      try {
        const res = await apiCall(
          `/api/internal-chat/${ciCurrentUser.company_id}/rooms`,
          { method: 'POST', body: JSON.stringify({ name: nombre, description: desc, members, color }) }
        );
        if (res.ok && res.data.room) {
          newSala.id = res.data.room._id || res.data.room.id || tempId;
        }
      } catch (e) {
        // Modo offline: usar tempId
      }

      ciSalas.push(newSala);
      ciMessages[newSala.id] = [];
      ciUnread[newSala.id]   = 0;

      // Notificar a miembros via socket
      ciSocket?.emit('internal_room_created', {
        room:       newSala,
        company_id: ciCurrentUser.company_id
      });
    }
  } catch (e) {
    console.warn('Error guardando sala:', e.message);
    // Guardar localmente aunque falle el backend
    if (!ciEditingSalaId) {
      const tempId  = 'sala_' + Date.now();
      const newSala = { id: tempId, name: nombre, desc, members, color };
      ciSalas.push(newSala);
      ciMessages[tempId] = [];
      ciUnread[tempId]   = 0;
    }
  }

  ciRenderSalasList();
  ciCerrarNuevaSala();

  // Cambiar a tab salas
  ciSwitchTab('salas');
}

// Eliminar sala
async function ciEliminarSala() {
  if (!ciEditingSalaId) return;
  const sala = ciSalas.find(s => s.id === ciEditingSalaId);
  if (!sala) return;

  if (!confirm(`¿Eliminar la sala "${sala.name}"? Esta acción no se puede deshacer.`)) return;

  try {
    await apiCall(
      `/api/internal-chat/${ciCurrentUser.company_id}/rooms/${ciEditingSalaId}`,
      { method: 'DELETE' }
    );
  } catch (e) { /* continuar localmente */ }

  ciSalas = ciSalas.filter(s => s.id !== ciEditingSalaId);
  delete ciMessages[ciEditingSalaId];
  delete ciUnread[ciEditingSalaId];

  if (ciActiveChat === ciEditingSalaId) ciOpenGeneral();

  ciRenderSalasList();
  ciCerrarNuevaSala();
}

// Socket: recibir mensaje de sala
// (ya manejado por ciReceiveMessage — el room_id es el sala.id)

// Socket: nueva sala creada por otro usuario
// (se registra en initChat_internoPage via socket event)

// ═══════════════════════════════════════════════
//  MENÚ 3 PUNTOS
// ═══════════════════════════════════════════════

function ciToggleMenu() {
  const dropdown = document.getElementById('ci-menu-dropdown');
  dropdown.classList.toggle('open');

  // Ajustar opciones según tipo de chat activo
  const isPrivado = ciActiveChat !== 'general' && !ciSalas.find(s => s.id === ciActiveChat);
  const addItem   = document.getElementById('ci-menu-add');
  const infoLabel = document.getElementById('ci-menu-info-label');

  if (isPrivado) {
    if (addItem)   addItem.style.display   = 'none';
    if (infoLabel) infoLabel.textContent   = 'Ver información del usuario';
  } else {
    if (addItem)   addItem.style.display   = 'flex';
    if (infoLabel) infoLabel.textContent   = 'Ver información del grupo';
  }
}

function ciMenuInfo() {
  ciCloseMenu();
  const isPrivado = ciActiveChat !== 'general' && !ciSalas.find(s => s.id === ciActiveChat);

  if (isPrivado) {
    // Info usuario privado
    const user = ciOnlineUsers[ciActiveChat] || { name: ciActiveChat, role: '', online: false };
    ciAbrirInfoModal({
      tipo:    'privado',
      nombre:  user.name || ciActiveChat,
      desc:    user.role || '',
      avatar:  null,
      color:   'linear-gradient(135deg,#8e84fa 0%,#91c0ff 55%)',
      members: [{ id: ciActiveChat, name: user.name || ciActiveChat, role: user.role || '', online: !!user.online }]
    });
  } else if (ciActiveChat === 'general') {
    ciAbrirInfoModal({
      tipo:    'general',
      nombre:  'general',
      desc:    'Sala principal del equipo',
      avatar:  null,
      color:   'linear-gradient(135deg,#5a79d4,#91c0ff)',
      members: Object.values(ciOnlineUsers).map(u => ({ id: u.id, name: u.name, role: u.role, online: u.online }))
    });
  } else {
    const sala = ciSalas.find(s => s.id === ciActiveChat);
    if (!sala) return;
    const members = sala.members.map(uid => {
      const u = ciOnlineUsers[uid] || {};
      return { id: uid, name: u.name || uid, role: u.role || '', online: !!u.online };
    });
    ciAbrirInfoModal({
      tipo:    'sala',
      id:      sala.id,
      nombre:  sala.name,
      desc:    sala.desc || '',
      avatar:  sala.avatar || null,
      color:   sala.color,
      members
    });
  }
}

function ciAbrirInfoModal(data) {
  const overlay = document.getElementById('ci-modal-info');
  const avatar  = document.getElementById('ci-info-avatar-display');
  const nombre  = document.getElementById('ci-info-nombre');
  const desc    = document.getElementById('ci-info-desc');
  const membersLabel = document.getElementById('ci-info-members-label');
  const membersList  = document.getElementById('ci-info-members-list');

  // Guardar contexto
  overlay.dataset.tipo   = data.tipo;
  overlay.dataset.salaId = data.id || '';

  // Avatar
  avatar.style.background = data.color || 'linear-gradient(135deg,#8e84fa,#91c0ff)';
  if (data.avatar) {
    avatar.innerHTML = `<img src="${data.avatar}">`;
  } else {
    avatar.innerHTML = data.tipo === 'general'
      ? '<i class="fas fa-hashtag"></i>'
      : `<span>${ciInitials(data.nombre)}</span>`;
  }

  // Campos
  nombre.value = data.nombre;
  desc.value   = data.desc || '';

  // Campos solo lectura en privado/general
  const editable = data.tipo === 'sala';
  nombre.readOnly = !editable;
  desc.readOnly   = !editable;
  nombre.style.opacity = editable ? '1' : '.7';
  desc.style.opacity   = editable ? '1' : '.7';
  document.querySelectorAll('.ci-info-edit-btn').forEach(b => b.style.display = editable ? 'flex' : 'none');
  document.querySelector('.ci-info-footer').style.display = editable ? '' : 'none';

  // Miembros
  membersLabel.textContent = `Miembros (${data.members.length})`;
  membersList.innerHTML = data.members.map(m => `
    <div class="ci-info-member-row">
      <div class="ci-info-member-avatar">
        ${ciInitials(m.name)}
        <div class="ci-info-member-dot ${m.online ? 'online' : ''}"></div>
      </div>
      <div class="ci-info-member-info">
        <div class="ci-info-member-name">${escapeHtml(m.name)}</div>
        <div class="ci-info-member-role">${m.role || ''}</div>
      </div>
      ${editable && m.id !== ciCurrentUser.id ? `
        <button class="ci-info-member-remove" onclick="ciInfoQuitarMiembro('${m.id}')" title="Quitar de la sala">
          <i class="fas fa-times"></i>
        </button>` : ''}
    </div>
  `).join('');

  overlay.classList.add('open');
}

function ciCerrarInfo() {
  document.getElementById('ci-modal-info').classList.remove('open');
}

function ciInfoGuardar() {
  const overlay = document.getElementById('ci-modal-info');
  const salaId  = overlay.dataset.salaId;
  if (!salaId) return;

  const nombre = document.getElementById('ci-info-nombre').value.trim();
  const desc   = document.getElementById('ci-info-desc').value.trim();

  const idx = ciSalas.findIndex(s => s.id === salaId);
  if (idx < 0) return;

  ciSalas[idx].name = nombre;
  ciSalas[idx].desc = desc;

  // Actualizar header si está activa
  if (ciActiveChat === salaId) {
    document.getElementById('ci-header-name').textContent = nombre;
  }

  // Persistir en backend
  apiCall(`/api/internal-chat/${ciCurrentUser.company_id}/rooms/${salaId}`, {
    method: 'PUT',
    body: JSON.stringify({ name: nombre, description: desc, members: ciSalas[idx].members, color: ciSalas[idx].color })
  }).catch(() => {});

  ciRenderSalasList();
  ciCerrarInfo();
}

function ciInfoQuitarMiembro(userId) {
  const overlay = document.getElementById('ci-modal-info');
  const salaId  = overlay.dataset.salaId;
  if (!salaId) return;

  const sala = ciSalas.find(s => s.id === salaId);
  if (!sala) return;

  sala.members = sala.members.filter(id => id !== userId);

  // Quitar del DOM
  const row = [...document.querySelectorAll('.ci-info-member-row')]
    .find(r => r.querySelector(`[onclick*="${userId}"]`));
  if (row) row.remove();

  // Actualizar contador
  document.getElementById('ci-info-members-label').textContent = `Miembros (${sala.members.length})`;

  // Persistir
  apiCall(`/api/internal-chat/${ciCurrentUser.company_id}/rooms/${salaId}`, {
    method: 'PUT',
    body: JSON.stringify({ name: sala.name, description: sala.desc, members: sala.members, color: sala.color })
  }).catch(() => {});
}

function ciInfoCambiarAvatar() {
  document.getElementById('ci-info-avatar-input').click();
}

function ciInfoAvatarSelected(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    document.getElementById('ci-info-avatar-display').innerHTML = `<img src="${ev.target.result}">`;
  };
  reader.readAsDataURL(file);
}

function ciMenuAgregar() {
  ciCloseMenu();
  // Reutiliza el modal de editar sala
  if (ciActiveChat === 'general') {
    ciAbrirParticipantes();
  } else {
    ciEditarSala(ciActiveChat);
  }
}

function ciMenuArchivos() {
  ciCloseMenu();
  alert('Próximamente: visualizador de archivos compartidos.');
}

function ciCloseMenu() {
  document.getElementById('ci-menu-dropdown')?.classList.remove('open');
}

// Cerrar menú al hacer clic fuera
document.addEventListener('click', function(e) {
  if (!e.target.closest('#ci-menu-btn') && !e.target.closest('#ci-menu-dropdown')) {
    ciCloseMenu();
  }
});

// Exponer funciones globales necesarias
window.ciSwitchTab        = ciSwitchTab;
window.ciOpenGeneral      = ciOpenGeneral;
window.ciIniciarPrivado   = ciIniciarPrivado;
window.ciEnviar           = ciEnviar;
window.ciHandleKey        = ciHandleKey;
window.ciHandleInput      = ciHandleInput;
window.ciTriggerMention   = ciTriggerMention;
window.ciPickMention      = ciPickMention;
window.ciScrollBottom     = ciScrollBottom;
window.ciToggleNotaMode      = ciToggleNotaMode;
window.ciConfirmarNota       = ciConfirmarNota;
window.ciCerrarInfo          = ciCerrarInfo;
window.ciInfoGuardar         = ciInfoGuardar;
window.ciInfoQuitarMiembro   = ciInfoQuitarMiembro;
window.ciInfoCambiarAvatar   = ciInfoCambiarAvatar;
window.ciInfoAvatarSelected  = ciInfoAvatarSelected;
window.ciToggleMenu          = ciToggleMenu;
window.ciMenuInfo            = ciMenuInfo;
window.ciMenuAgregar         = ciMenuAgregar;
window.ciMenuArchivos        = ciMenuArchivos;
window.ciAbrirNuevaSala      = ciAbrirNuevaSala;
window.ciEditarSala          = ciEditarSala;
window.ciCerrarNuevaSala     = ciCerrarNuevaSala;
window.ciGuardarSala         = ciGuardarSala;
window.ciEliminarSala        = ciEliminarSala;
window.ciOpenSala            = ciOpenSala;
window.ciUpdateMemberCount   = ciUpdateMemberCount;
window.ciAbrirParticipantes  = ciAbrirParticipantes;
window.ciCerrarParticipantes = ciCerrarParticipantes;
window.ciToggleParticipant   = ciToggleParticipant;
window.ciGuardarParticipantes = ciGuardarParticipantes;