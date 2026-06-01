// ═══════════════════════════════════════════════
//  CHAT INTERNO — HEAVENSY
//  Sala general + privados + menciones + typing
// ═══════════════════════════════════════════════

// ── STATE ──
let ciSocket        = null;
let _ciAuthRetried  = false;  // evita bucle de reintento de auth del socket
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
// ── RESET: limpia el estado del chat al cambiar de empresa ──
// Desconecta el socket viejo y vacía salas, mensajes, privados, notas,
// votaciones y presencia, para no mezclar datos entre empresas.
function ciResetEstadoChat() {
  // Desconectar socket de la empresa anterior
  try {
    if (ciSocket) {
      ciSocket.removeAllListeners && ciSocket.removeAllListeners();
      ciSocket.disconnect();
    }
  } catch (e) {}
  ciSocket = null;
  _ciAuthRetried = false;
  _ciBackgroundReady = false;

  // Vaciar estado por-empresa
  ciActiveChat   = 'general';
  ciParticipants = [];
  ciSalas        = [];
  ciOnlineUsers  = {};
  ciMessages     = { general: [] };
  ciUnread       = { general: 0 };
  ciTypingUsers  = {};
  ciTypingTimers = {};
  ciAllPinnedVots  = {};
  ciPinnedVotacion = null;
  ciAllPinnedNotas = {};
  ciActiveNota     = null;
  ciTotalUnread    = 0;

  // Limpiar el feed y las listas visibles del DOM (si están montadas)
  const feed = document.getElementById('ci-feed');
  if (feed) feed.innerHTML = '';
  const chatList = document.getElementById('ci-chat-list');
  if (chatList) chatList.innerHTML = '';

  // Resetear el header del chat al estado por defecto (general), para que no
  // quede mostrando la sala/usuario de la empresa anterior.
  const hAvatar = document.getElementById('ci-header-avatar');
  if (hAvatar) { hAvatar.innerHTML = '<i class="fas fa-hashtag"></i>'; hAvatar.style.background = ''; }
  const hName = document.getElementById('ci-header-name');
  if (hName) hName.textContent = 'general';
  const hSub = document.getElementById('ci-header-sub');
  if (hSub) hSub.textContent = 'Sala principal del equipo';

  // Ocultar paneles que puedan haber quedado de la empresa anterior
  const stack = document.getElementById('ci-pinned-stack');
  if (stack) stack.style.display = 'none';
  const onlineList = document.getElementById('ci-online-list');
  if (onlineList) onlineList.innerHTML = '';
  const onlineCount = document.getElementById('ci-online-count');
  if (onlineCount) onlineCount.textContent = '0';
}

// ── IDENTIDAD: parsea el token y setea ciCurrentUser ──
// Detecta cambio de empresa: si el token trae otro company_id que el actual,
// re-setea la identidad (no es no-op). Esto evita seguir mostrando los chats
// de la empresa anterior tras un switch-company.
function _ciSetupIdentity() {
  const token = localStorage.getItem('token');
  if (!token) return false;
  let payload;
  try {
    payload = JSON.parse(atob(token.split('.')[1]));
  } catch (e) {
    console.error('ci: token inválido', e);
    return false;
  }

  const nuevoCompanyId = payload.company_id || '';
  // Si ya hay identidad y es de la MISMA empresa, no hay nada que hacer
  if (ciCurrentUser && ciCurrentUser.company_id === nuevoCompanyId) {
    return true;
  }
  // Si había identidad de OTRA empresa, limpiar el estado antes de re-setear
  if (ciCurrentUser && ciCurrentUser.company_id !== nuevoCompanyId) {
    ciResetEstadoChat();
  }

  const rawRole = payload.role
    || (Array.isArray(payload.roles) && payload.roles[0])
    || 'usuario';

  ciCurrentUser = {
    id:         payload.user_id || payload.sub || payload.email,
    name:       payload.username || payload.name || payload.email || 'Usuario',
    role:       rawRole,
    company_id: payload.company_id || ''
  };
  window.ciCurrentUser = ciCurrentUser;

  const adminRoles = ['admin', 'superadmin', 'owner', 'ADMIN_ROL', 'SUPER_ADMIN_ROL', 'OWNER_ROL'];
  const allRoles   = payload.role
    ? [payload.role]
    : (Array.isArray(payload.roles) ? payload.roles : []);
  ciIsAdmin = allRoles.some(r => adminRoles.includes(r));

  return true;
}

// ── BACKGROUND: conexión + recepción de mensajes/badges SIN render de UI ──
// Se llama una vez al cargar la app (desde el router), para que el usuario
// reciba mensajes y vea el badge de no leídos esté en la página que esté.
let _ciBackgroundReady = false;
async function ciInitBackground() {
  // _ciSetupIdentity primero: detecta cambio de empresa y, si lo hay, resetea
  // el estado (lo que pone _ciBackgroundReady en false para re-ejecutar todo).
  if (!_ciSetupIdentity()) return;  // sin token, no hay nada que conectar
  if (_ciBackgroundReady) return;

  try {
    // Cargar participantes (necesario para unirse a rooms privados de todos
    // y para que los privados entrantes tengan nombre/rol al crear su item)
    await ciLoadParticipants();

    // Cargar no leídos persistidos desde el backend (sobreviven a refresh/logout)
    await ciLoadUnreadCounts();

    // Conectar socket (registra todos los listeners de recepción)
    await ciConnectSocket();

    // Unirse a general + rooms privados con todos los participantes,
    // así llegan los mensajes aunque no se haya abierto ese chat
    _ciJoinAllPrivateRooms();

    _ciBackgroundReady = true;
    console.log('✅ Chat interno: background conectado');
  } catch (e) {
    console.error('Error en ciInitBackground:', e);
  }
}
window.ciInitBackground = ciInitBackground;

// Carga los no leídos persistidos desde el backend y actualiza ciUnread + badges.
// Se llama al iniciar para que el contador sobreviva a refresh, logout y reconexión.
async function ciLoadUnreadCounts() {
  if (!ciCurrentUser || !ciCurrentUser.company_id) return;
  try {
    const res = await apiCall(`/api/internal-chat/${ciCurrentUser.company_id}/unread`);
    if (res && res.ok && res.data && res.data.counts) {
      const counts = res.data.counts;
      // Poblar ciUnread con lo que viene del servidor (fuente de verdad al iniciar)
      Object.keys(counts).forEach(roomId => {
        ciUnread[roomId] = counts[roomId];
      });
      // Refrescar badges visibles (item por item + total del sidebar)
      Object.keys(counts).forEach(roomId => ciUpdateUnreadBadge(roomId));
      ciUpdateSidebarBadge();
    }
  } catch (e) {
    console.error('ci: error cargando no leídos:', e);
  }
}
window.ciLoadUnreadCounts = ciLoadUnreadCounts;

// Persiste en el backend que el usuario leyó una conversación (fire-and-forget).
// isPrivate=true cuando roomId es el user_id del otro (privado).
function ciMarkRead(roomId, isPrivate) {
  if (!ciCurrentUser || !ciCurrentUser.company_id || !roomId) return;
  try {
    apiCall(`/api/internal-chat/${ciCurrentUser.company_id}/mark-read`, {
      method: 'POST',
      body: JSON.stringify({ room_id: roomId, is_private: !!isPrivate })
    });
  } catch (e) {
    console.error('ci: error marcando leído:', e);
  }
}
window.ciMarkRead = ciMarkRead;

async function initChat_internoPage() {
  try {
    // Asegurar identidad + conexión (si el background ya corrió, esto es no-op)
    if (!_ciSetupIdentity()) return;
    await ciInitBackground();

    if (ciIsAdmin) {
      const adminBtn = document.getElementById('ci-admin-btn');
      if (adminBtn) adminBtn.style.display = '';
    }

    // Nombre de empresa en el header
    ciLoadCompanyName();

    // Conectar socket (idempotente: si ya está conectado, solo refresca presencia)
    await ciConnectSocket();

    // Cargar historial general
    await ciLoadHistory('general');

    // Cargar salas temáticas
    await ciLoadSalas();

    // Restaurar chats privados previos desde servidor
    await _ciRestorePrivados();

    // Unirse preventivamente a rooms privados con todos los participantes
    _ciJoinAllPrivateRooms();

    // Watcher scroll
    ciInitScrollWatcher();

    // Inicializar emoji picker (desde ci-emoji.js + emoji.js)
    if (typeof window.ciInitEmoji === 'function') {
      window.ciInitEmoji();
    }

    // Inicializar gestor de adjuntos (desde ci-attach.js)
    if (typeof window.ciInitAttach === 'function') {
      // Configurar (ci-attach no puede acceder a let-locales del módulo)
      window.ciAttachConfig = {
        apiBase:   (typeof API_BASE_URL !== 'undefined') ? API_BASE_URL : '',
        companyId: ciCurrentUser.company_id,
        get token() { return localStorage.getItem('token'); },
        // Cuando cambia la cola de adjuntos, refrescar el estado del botón enviar
        // (debe habilitarse si hay adjuntos aunque no haya texto escrito).
        onQueueChange: (count) => {
          const input   = document.getElementById('ci-input');
          const sendBtn = document.getElementById('ci-send-btn');
          if (sendBtn) {
            const hasText = !!(input && input.value.trim());
            sendBtn.disabled = !hasText && count === 0;
          }
        },
      };
      window.ciInitAttach();
    }

    // Inicializar reply (desde ci-reply.js)
    if (typeof window.ciInitReply === 'function') {
      window.ciInitReply();
    }

    // Inicializar grabación de audio (desde ci-audio.js)
    if (typeof window.ciInitAudio === 'function') {
      window.ciInitAudio();
    }

    // Inicializar reproductor de audio custom (desde ci-audio-player.js)
    if (typeof window.ciInitAudioPlayer === 'function') {
      window.ciInitAudioPlayer();
    }

    // Cerrar menús "..." al hacer click fuera
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.ci-msg-menu-wrap')) {
        document.querySelectorAll('.ci-msg-menu').forEach(m => {
          m.style.display = 'none';
          const a = m.closest('.ci-msg-actions');
          if (a) a.classList.remove('menu-open');
        });
      }
    });

  } catch (e) {
    console.error('Error init chat interno:', e);
  }
}

// ── SOCKET ──
function _ciSendJoin() {
  // Siempre enviar join para refrescar presencia online
  if (!ciSocket || !ciCurrentUser) return;
  ciSocket.emit('join_internal_chat', {
    token:      localStorage.getItem('token'),  // identidad verificada en el backend
    company_id: ciCurrentUser.company_id,
    user_id:    ciCurrentUser.id,
    user_name:  ciCurrentUser.name,
    role:       ciCurrentUser.role
  });

  // Re-unirse a todos los rooms — necesario tras reconexión (el servidor
  // pierde la membresía de rooms cuando el socket se desconecta)
  _ciRejoinAllRooms();
}

function _ciRejoinAllRooms() {
  if (!ciSocket || !ciCurrentUser) return;

  // Salas donde el usuario es miembro
  (ciSalas || []).forEach(sala => {
    if (sala.members && sala.members.includes(ciCurrentUser.id)) {
      ciSocket.emit('join_internal_room', {
        room_id:    sala.id,
        company_id: ciCurrentUser.company_id,
        user_id:    ciCurrentUser.id
      });
    }
  });

  // Rooms privados con cada participante habilitado
  (ciParticipants || []).filter(p => p.enabled && p.user_id !== ciCurrentUser.id).forEach(p => {
    ciSocket.emit('join_internal_private', {
      from_id:    ciCurrentUser.id,
      to_id:      p.user_id,
      company_id: ciCurrentUser.company_id
    });
  });
}

async function ciConnectSocket() {
  // Si el socket ya está conectado, solo refrescar presencia y salir
  if (ciSocket && ciSocket.connected) {
    _ciSendJoin();
    return;
  }
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
    _ciSendJoin();
  });

  ciSocket.on('disconnect', () => {
    console.log('❌ Chat interno desconectado');
    ciUpdateOnlineList({});
  });

  // Si el servidor rechaza el join por sesión inválida, intentar refrescar el
  // token y reconectar UNA vez (evita quedar conectado pero sin recibir nada).
  ciSocket.on('internal_chat_joined', async (res) => {
    if (res && res.ok === false && !_ciAuthRetried) {
      _ciAuthRetried = true;
      try {
        if (typeof _tryRefreshToken === 'function') {
          await _tryRefreshToken();
        }
      } catch (e) {}
      _ciSendJoin();  // reintentar con el token actualizado
    } else if (res && res.ok) {
      _ciAuthRetried = false;  // join exitoso, resetear el flag
    }
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

  // Mensaje de sala temática recibido
  ciSocket.on('internal_room_message', (msg) => {
    const roomId = msg.room_id;
    if (!roomId) return;
    if (!ciMessages[roomId]) ciMessages[roomId] = [];
    ciReceiveMessage(roomId, msg);
  });

  // Mensaje privado recibido
  ciSocket.on('internal_private_message', (msg) => {
    if (msg.from_id === ciCurrentUser.id) return; // ya renderizado localmente en ciEnviar
    const roomId = msg.from_id; // roomId en frontend = user_id del otro

    // Asegurar que el item del sidebar existe ANTES de incrementar unread
    // (sin esto, el badge nunca se actualiza porque su elemento DOM no existe)
    if (!document.getElementById(`ci-priv-${msg.from_id}`)) {
      ciAddPrivateChatItem(msg.from_id, msg.from_name, msg.from_role);
      if (!ciMessages[msg.from_id]) ciMessages[msg.from_id] = [];
      if (!ciUnread[msg.from_id])   ciUnread[msg.from_id]   = 0;
    }

    // Ahora sí procesar el mensaje (incrementa unread + actualiza badge)
    // ciReceiveMessage ya actualiza el preview del sidebar (incluyendo archivos)
    ciReceiveMessage(roomId, msg);
  });

  // Typing
  ciSocket.on('internal_typing', (data) => {
    if (data.user_id === ciCurrentUser.id) return;
    // En privados, el 'room' que llega es el ciActiveChat del emisor (= mi id).
    // Para mostrarlo en MI lista, la clave debe ser el emisor (data.user_id).
    let room = data.room || 'general';
    if (room === ciCurrentUser.id) room = data.user_id;  // privado cruzado → usar emisor
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
    let room = data.room || 'general';
    if (room === ciCurrentUser.id) room = data.user_id;  // privado cruzado → usar emisor
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

  // Nota anclada recibida (de otro usuario)
  ciSocket.on('internal_pinned_note', (nota) => {
    if (nota.from_id === ciCurrentUser.id) return;  // la mía ya la agregué local
    // Agregar al stack si pertenece al chat abierto
    if (_ciActiveRoomMatchesNota(nota)) {
      ciAddNotaToStack(ciActiveChat, nota);
    } else {
      // Guardar en su sala aunque no esté abierta (para verla al entrar)
      const key = nota.room_id;
      if (!ciAllPinnedNotas[key]) ciAllPinnedNotas[key] = [];
      if (!ciAllPinnedNotas[key].some(n => _ciNotaId(n) === _ciNotaId(nota))) {
        ciAllPinnedNotas[key].unshift(nota);
      }
    }
  });

  // Confirmación de nota recibida
  ciSocket.on('internal_note_confirmed', (data) => {
    // Buscar la nota en cualquier sala del cache por id
    let target = null;
    Object.keys(ciAllPinnedNotas).forEach(key => {
      (ciAllPinnedNotas[key] || []).forEach(n => {
        if (_ciNotaId(n) === data.nota_id) target = n;
      });
    });
    if (!target) return;
    if (!target.confirmations) target.confirmations = [];
    if (!target.confirmations.includes(data.user_id)) {
      target.confirmations.push(data.user_id);
    }
    ciRenderPinnedStack(ciActiveChat);
    ciCheckNotaResuelta(target);
  });

  // Nota resuelta (todos confirmaron)
  ciSocket.on('internal_note_resolved', (data) => {
    ciRemoveNotaFromStack(data.nota_id);
  });

  // Nota eliminada por otro usuario (creador o admin)
  ciSocket.on('internal_nota_deleted', (data) => {
    ciRemoveNotaFromStack(data.nota_id);
  });

  // Votación eliminada por otro usuario (creador o admin)
  ciSocket.on('internal_votacion_deleted', (data) => {
    const votId  = data.vot_id;
    const roomId = data.room_id;
    if (roomId && ciAllPinnedVots[roomId]?.id === votId) {
      delete ciAllPinnedVots[roomId];
    }
    if (ciPinnedVotacion?.id === votId) {
      ciUnpinVotacion(false);
    }
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
    // Para privados: asegurar que estamos en el room privado
    if (v.room_id?.startsWith('private:') && v.room_id.includes(ciCurrentUser.id)) {
      const parts = v.room_id.replace('private:', '').split(':');
      const otherId = parts.find(id => id !== ciCurrentUser.id);
      if (otherId) {
        ciSocket?.emit('join_internal_private', {
          from_id: ciCurrentUser.id, to_id: otherId, company_id: ciCurrentUser.company_id
        });
        if (!ciMessages[otherId]) ciMessages[otherId] = [];
        if (!ciUnread[otherId])   ciUnread[otherId]   = 0;
      }
    }
    const isForThisChat = v.room_id === ciActiveChat ||
      (v.room_id?.startsWith('private:') && v.room_id.includes(ciCurrentUser.id));
    if (!isForThisChat) return;
    ciPinVotacion(v);
  });

  // Voto emitido (actualizar porcentajes en todos)
  ciSocket.on('internal_voto', (data) => {
    if (!data.votacion) return;
    const v = data.votacion;
    // Sincronizar ciPinnedVotacion con estado del servidor
    if (ciPinnedVotacion && ciPinnedVotacion.id === v.id) {
      ciPinnedVotacion.opciones = v.opciones;
      ciAllPinnedVots[ciPinnedVotacion.room_id] = ciPinnedVotacion;
      _ciRenderPinnedVot(ciPinnedVotacion);
    }
    ciUpdateVotacionUI(v.id, v);
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
    // 1. Cargar todos los usuarios de la empresa (fuente de verdad)
    const usersRes = await apiCall(`/api/internal-chat/${ciCurrentUser.company_id}/members`);
    const allUsers = (usersRes.ok ? (usersRes.data.users || []) : []).map(u => ({
      user_id: u.user_id,
      name:    u.name,
      role:    u.role || 'usuario',
      enabled: true
    }));

    // 2. Si hay una config de participantes guardada, aplicar el filtro
    const partRes = await apiCall(`/api/internal-chat/${ciCurrentUser.company_id}/participants`);
    if (partRes.ok && partRes.data.participants && partRes.data.participants.length > 0) {
      const enabledIds = new Set(partRes.data.participants);
      allUsers.forEach(u => { u.enabled = enabledIds.has(u.user_id); });
    }
    // Sin config guardada → todos habilitados (ya es el default)

    ciParticipants = allUsers;
  } catch (e) {
    console.warn('No se pudieron cargar participantes:', e.message);
    ciParticipants = [];
  }
}

// ── CARGAR VOTACIÓN ACTIVA ──
async function _ciLoadActiveVotacion(roomId) {
  try {
    // Para privados, construir el room_id en formato private:
    const apiRoomId = (!_ciIsSala(roomId) && roomId !== 'general')
      ? 'private:' + [ciCurrentUser.id, roomId].sort().join(':')
      : roomId;

    const res = await apiCall(
      `/api/internal-chat/${ciCurrentUser.company_id}/rooms/${encodeURIComponent(apiRoomId)}/votacion/active`
    );
    if (res.ok && res.data.votacion) {
      ciPinVotacion(res.data.votacion);
    } else {
      ciUnpinVotacion(false);
    }
  } catch(e) {
    ciUnpinVotacion(false);
  }
}

// ── PRE-JOIN ROOMS PRIVADOS ──
function _ciJoinAllPrivateRooms() {
  // Unirse preventivamente al room privado con cada participante habilitado
  // Esto garantiza recibir eventos aunque no se haya abierto el chat aún
  ciParticipants.filter(p => p.enabled && p.user_id !== ciCurrentUser.id).forEach(p => {
    ciSocket?.emit('join_internal_private', {
      from_id:    ciCurrentUser.id,
      to_id:      p.user_id,
      company_id: ciCurrentUser.company_id
    });
  });
}

// ── HELPER: detectar si un roomId es sala temática ──
function _ciIsSala(roomId) {
  if (!roomId || roomId === 'general') return false;
  // Fuente única de verdad: la lista cargada de salas
  return ciSalas.some(s => s.id === roomId);
}

// Un room es privado si no es el general ni una sala temática
// (entonces el roomId es el user_id del otro participante).
function _ciIsPrivateRoom(roomId) {
  return !!roomId && roomId !== 'general' && !_ciIsSala(roomId);
}

// ── RESPONSIVE: Toggle sidebar ──
function ciToggleSidebar() {
  const page = document.querySelector('.ci-page');
  if (!page) return;
  const isMobile = window.matchMedia('(max-width: 768px)').matches;
  const icon = document.getElementById('ci-toggle-sidebar-icon');

  if (isMobile) {
    // En móvil: clase sidebar-open controla si está visible
    page.classList.toggle('sidebar-open');
    if (icon) {
      icon.className = page.classList.contains('sidebar-open')
        ? 'fas fa-chevron-left'
        : 'fas fa-chevron-right';
    }
  } else {
    // En desktop: clase sidebar-collapsed controla si está oculta
    page.classList.toggle('sidebar-collapsed');
    if (icon) {
      icon.className = page.classList.contains('sidebar-collapsed')
        ? 'fas fa-chevron-right'
        : 'fas fa-chevron-left';
    }
  }
}

// Helper: cerrar sidebar al abrir un chat (solo móvil)
function _ciAutoCloseSidebarMobile() {
  if (!window.matchMedia('(max-width: 768px)').matches) return;
  const page = document.querySelector('.ci-page');
  if (page && page.classList.contains('sidebar-open')) {
    page.classList.remove('sidebar-open');
    const icon = document.getElementById('ci-toggle-sidebar-icon');
    if (icon) icon.className = 'fas fa-chevron-right';
  }
}

// ── CARGAR HISTORIAL ──
async function ciLoadHistory(roomId) {
  try {
    // Determinar endpoint según tipo de room
    let endpoint;
    if (roomId === 'general') {
      endpoint = `/api/internal-chat/${ciCurrentUser.company_id}/history`;
    } else if (_ciIsSala(roomId)) {
      // Sala temática — usar ID de sala directamente
      endpoint = `/api/internal-chat/${ciCurrentUser.company_id}/rooms/${roomId}/history`;
    } else {
      // Privado — roomId es el user_id del otro usuario
      endpoint = `/api/internal-chat/${ciCurrentUser.company_id}/private/${roomId}/history`;
    }

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

  // Verificar que el chat esté montado en el DOM, no solo que sea el chat activo
  const chatIsMounted = !!document.getElementById('ci-feed');
  const showInline    = chatIsMounted && ciActiveChat === roomId;

  if (showInline) {
    ciAppendMessage(msg, roomId);
    ciScrollBottom();
    // El usuario está viendo este chat → marcar como leído en el backend,
    // así no reaparece como no leído tras un refresh.
    if (msg.from_id !== ciCurrentUser.id) {
      ciMarkRead(roomId, _ciIsPrivateRoom(roomId));
    }
  } else {
    // Incrementar no leídos
    ciUnread[roomId] = (ciUnread[roomId] || 0) + 1;
    ciUpdateUnreadBadge(roomId);
    ciTotalUnread++;
    ciUpdateSidebarBadge();

    // Mostrar toast solo si el mensaje no es del usuario actual
    if (msg.from_id !== ciCurrentUser.id) {
      ciShowMessageToast(roomId, msg);
    }
  }

  // Actualizar preview en sidebar
  ciUpdateChatPreview(roomId, msg.text || '', msg);

  // Notificar si hay mención a este usuario
  if (msg.text && msg.text.includes('@' + ciCurrentUser.name) && msg.from_id !== ciCurrentUser.id) {
    ciShowMentionToast({ from_name: msg.from_name, text: msg.text });
  }
}

// ── ENVIAR MENSAJE ──
async function ciEnviar() {
  const input = document.getElementById('ci-input');
  const text  = (input.value || '').trim();

  // Hay adjuntos pendientes?
  const hasAttach = typeof window.ciAttachHasPending === 'function' && window.ciAttachHasPending();

  // Si no hay texto ni adjuntos, salir
  if (!text && !hasAttach) return;

  // Si está en modo nota, NO permitir adjuntos (las notas son texto)
  if (ciNotaMode) {
    if (!text) return;
    ciEnviarNota(text);
    input.value = '';
    input.style.height = 'auto';
    document.getElementById('ci-send-btn').disabled = true;
    ciToggleNotaMode();
    ciStopTyping();
    return;
  }

  // Subir adjuntos si hay
  let attachments = [];
  if (hasAttach) {
    const sendBtn = document.getElementById('ci-send-btn');
    let prevBtnHtml = '';
    if (sendBtn) {
      sendBtn.disabled = true;
      prevBtnHtml = sendBtn.innerHTML;
      sendBtn.innerHTML = '<span class="ci-send-spinner"></span>';
    }
    try {
      attachments = await window.ciAttachUploadAll();
    } catch (e) {
      console.error('Error subiendo adjuntos:', e);
    }
    // Restaurar el ícono del botón
    if (sendBtn && prevBtnHtml) sendBtn.innerHTML = prevBtnHtml;
    if (!attachments.length) {
      // Falló la subida: no enviar nada y reactivar botón
      if (sendBtn) sendBtn.disabled = !input.value.trim();
      return;
    }
  }

  // Tomar la cita pendiente (si existe). Solo se adjunta al PRIMER mensaje
  // cuando hay múltiples adjuntos, para no duplicar la cita en cada uno.
  const replyTo = (typeof window.ciGetReplyTo === 'function') ? window.ciGetReplyTo() : null;

  // Si solo hay texto, enviar un único mensaje (comportamiento original)
  // Si hay adjuntos, enviar N mensajes (uno por adjunto), el último lleva el texto
  const messagesToSend = [];
  if (attachments.length) {
    attachments.forEach((att, i) => {
      const isLast  = (i === attachments.length - 1);
      const isFirst = (i === 0);
      messagesToSend.push({
        text:       isLast ? text : '',
        attachment: att,
        reply_to:   isFirst ? replyTo : null,
      });
    });
  } else {
    messagesToSend.push({ text, attachment: null, reply_to: replyTo });
  }

  for (const m of messagesToSend) {
    // ID generado en cliente: permite citar el mensaje propio inmediatamente
    // y que el "saltar al original" funcione en el lado del emisor.
    const clientMsgId = 'cm_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    const msg = {
      message_id: clientMsgId,
      from_id:    ciCurrentUser.id,
      from_name:  ciCurrentUser.name,
      from_role:  ciCurrentUser.role,
      text:       m.text,
      attachment: m.attachment,
      reply_to:   m.reply_to,
      timestamp:  new Date().toISOString(),
      company_id: ciCurrentUser.company_id
    };

    if (ciActiveChat === 'general') {
      ciSocket.emit('internal_message', msg);
      ciReceiveMessage('general', { ...msg, own: true });
    } else if (ciSalas.some(s => s.id === ciActiveChat)) {
      const salaMsg = { ...msg, room_id: ciActiveChat };
      ciSocket.emit('internal_room_message', salaMsg);
      ciReceiveMessage(ciActiveChat, { ...salaMsg, own: true });
    } else {
      const privateMsg = {
        ...msg,
        to_id: ciActiveChat,
        room:  `private:${[ciCurrentUser.id, ciActiveChat].sort().join(':')}`
      };
      ciSocket.emit('internal_private_message', privateMsg);
      ciReceiveMessage(ciActiveChat, { ...privateMsg, own: true });
    }
  }

  // Detectar menciones (solo si hay texto)
  if (text) {
    const mentions = ciExtractMentions(text);
    mentions.forEach(name => {
      const participant = ciParticipants.find(p => p.name === name);
      if (participant) {
        ciSocket.emit('internal_mention', {
          from_id:    ciCurrentUser.id,
          from_name:  ciCurrentUser.name,
          to_id:      participant.user_id,
          text:       text,
          room:       ciActiveChat,
          company_id: ciCurrentUser.company_id
        });
      }
    });
  }

  // Limpiar input, cola de adjuntos y cita pendiente
  input.value = '';
  input.style.height = 'auto';
  document.getElementById('ci-send-btn').disabled = true;
  if (typeof window.ciAttachClear === 'function') window.ciAttachClear();
  if (typeof window.ciClearReply  === 'function') window.ciClearReply();

  ciStopTyping();
}

// ── TYPING ──
function ciHandleInput(e) {
  const input = e.target;
  // Auto-resize
  input.style.height = 'auto';
  input.style.height = Math.min(input.scrollHeight, 120) + 'px';

  // Habilitar/deshabilitar botón enviar (también si hay adjuntos pendientes)
  const hasAttach = typeof window.ciAttachHasPending === 'function' && window.ciAttachHasPending();
  document.getElementById('ci-send-btn').disabled = !input.value.trim() && !hasAttach;

  // Mention autocomplete
  ciCheckMention(input);

  // Typing emit
  if (input.value.trim()) {
    if (!ciWasTyping) {
      ciWasTyping = true;
      const isPriv = _ciIsPrivateRoom(ciActiveChat);
      ciSocket?.emit('internal_typing', {
        user_id:   ciCurrentUser.id,
        user_name: ciCurrentUser.name,
        room:      ciActiveChat,
        to_id:     isPriv ? ciActiveChat : null,  // privado: destinatario para armar el room
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
    const isPriv = _ciIsPrivateRoom(ciActiveChat);
    ciSocket?.emit('internal_typing_stop', {
      user_id:   ciCurrentUser.id,
      room:      ciActiveChat,
      to_id:     isPriv ? ciActiveChat : null,
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
  const mentionOpen = document.getElementById('ci-mention-popup').classList.contains('open');
  if (mentionOpen) {
    if (e.key === 'ArrowDown') { e.preventDefault(); ciMentionNav(1); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); ciMentionNav(-1); }
    if (e.key === 'Escape')    { ciCloseMentionPopup(); }
    return;
  }
  // Escape fuera del popup → salir del modo nota si está activo
  if (e.key === 'Escape' && ciNotaMode) {
    e.preventDefault();
    ciSalirModoNota();
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
      p.enabled && p.name.toLowerCase().includes(query) && p.user_id !== ciCurrentUser.id
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
  if (!feed) return; // chat no montado
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
    const dateStr = ciFormatDate(msg.timestamp || msg.created_at);
    if (dateStr !== lastDate) {
      const sep = document.createElement('div');
      sep.className = 'ci-date-sep';
      sep.innerHTML = `<span>${dateStr}</span>`;
      feed.appendChild(sep);
      lastDate   = dateStr;
      lastAuthor = '';
    }

    const continued = lastAuthor === msg.from_id &&
      i > 0 && (new Date(msg.timestamp || msg.created_at) - new Date(msgs[i-1].timestamp || msgs[i-1].created_at)) < 120000;

    feed.appendChild(ciBuildMsgEl(msg, continued));
    lastAuthor = msg.from_id;
  });

  ciScrollBottom();
}

function ciAppendMessage(msg, roomId) {
  const feed = document.getElementById('ci-feed');
  if (!feed) return; // chat no montado

  // Quitar empty state si existe
  const empty = feed.querySelector('.ci-empty');
  if (empty) empty.remove();

  const msgs = ciMessages[roomId] || [];
  const idx  = msgs.length - 1;
  const prev = msgs[idx - 1];
  const continued = prev && prev.from_id === msg.from_id &&
    (new Date(msg.timestamp || msg.created_at) - new Date(prev.timestamp || prev.created_at)) < 120000;

  feed.appendChild(ciBuildMsgEl(msg, continued));
}

function ciBuildMsgEl(msg, continued) {
  const isOwn = msg.from_id === ciCurrentUser.id || msg.own;
  const div   = document.createElement('div');
  div.className = `ci-msg${isOwn ? ' own' : ''}${continued ? ' continued' : ''}`;
  if (msg.message_id) div.dataset.messageId = msg.message_id;

  const initials   = ciInitials(msg.from_name || '?');
  const roleLabel  = ciRoleLabel(msg.from_role);
  const timeStr    = ciFormatTime(msg.timestamp || msg.created_at);
  const textHtml   = ciFormatText(msg.text || '');
  const attachHtml = _ciRenderAttachment(msg.attachment);
  const replyHtml  = _ciRenderReplyTo(msg.reply_to);

  // Datos para citar este mensaje (en data-* para que ciSetReply los lea)
  // Guardamos como JSON safe → un ID temporal en memoria sería más limpio,
  // pero data-attrs ya funcionan y sobreviven re-renders parciales.
  const msgRefId = msg.message_id || '';

  div.innerHTML = `
    <div class="ci-msg-avatar">${initials}</div>
    <div class="ci-msg-body">
      <div class="ci-msg-meta">
        <span class="ci-msg-author${isOwn ? ' me' : ''}">${escapeHtml(msg.from_name || 'Usuario')}</span>
        <span class="ci-msg-role ${msg.from_role || ''}">${roleLabel}</span>
        <span class="ci-msg-time">${timeStr}</span>
      </div>
      <div class="ci-msg-content">
        ${replyHtml}
        ${attachHtml}
        ${textHtml ? `<div class="ci-msg-text">${textHtml}</div>` : ''}
        <div class="ci-msg-actions">
          ${msgRefId ? `<button class="ci-msg-action-btn" data-action="reply" title="Responder"><i class="fas fa-reply"></i></button>` : ''}
          ${!isOwn ? `
            <div class="ci-msg-menu-wrap">
              <button class="ci-msg-action-btn" data-action="more" title="Más">
                <i class="fas fa-ellipsis-v"></i>
              </button>
              <div class="ci-msg-menu" style="display:none">
                <button class="ci-msg-menu-item" data-action="private"><i class="fas fa-comment"></i> Mensaje privado</button>
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    </div>
  `;

  // Listeners delegados al div del mensaje
  div.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;

    if (action === 'reply') {
      e.stopPropagation();
      if (window.ciSetReply) window.ciSetReply(msg);
    } else if (action === 'more') {
      e.stopPropagation();
      const menu    = btn.parentElement.querySelector('.ci-msg-menu');
      const actions = btn.closest('.ci-msg-actions');
      const willOpen = menu.style.display === 'none';
      // Cerrar otros menús abiertos y quitarles el "pin"
      document.querySelectorAll('.ci-msg-menu').forEach(m => {
        if (m !== menu) {
          m.style.display = 'none';
          const a = m.closest('.ci-msg-actions');
          if (a) a.classList.remove('menu-open');
        }
      });
      menu.style.display = willOpen ? 'block' : 'none';
      // Mantener las acciones visibles mientras el menú está abierto
      // (sin esto, al salir el mouse el overflow:hidden recorta el menú)
      if (actions) actions.classList.toggle('menu-open', willOpen);
    } else if (action === 'private') {
      e.stopPropagation();
      ciIniciarPrivado(msg.from_id, msg.from_name || '');
    }
  });

  // Click en una cita renderizada → salta al mensaje original
  const replyEl = div.querySelector('.ci-msg-reply');
  if (replyEl && replyEl.dataset.replyTo) {
    replyEl.addEventListener('click', () => {
      if (window.ciJumpToMessage) window.ciJumpToMessage(replyEl.dataset.replyTo);
    });
  }

  return div;
}

// Renderiza la cita (reply_to) arriba del mensaje
function _ciRenderReplyTo(rt) {
  if (!rt || !rt.message_id) return '';
  const name = escapeHtml(rt.from_name || 'Usuario');
  let preview = '';
  if (rt.text && rt.text.trim()) {
    preview = escapeHtml(rt.text.trim());
  } else if (rt.attachment_type === 'image') preview = '📷 Foto';
  else if (rt.attachment_type === 'video')   preview = '🎥 Video';
  else if (rt.attachment_type === 'audio')   preview = '🎵 Audio';
  else if (rt.attachment_type)               preview = '📎 Archivo';

  // Thumbnail si la cita es de una imagen
  const thumb = (rt.attachment_type === 'image' && rt.attachment_url)
    ? `<img class="ci-msg-reply-thumb" src="${(rt.attachment_url || '').replace(/"/g, '&quot;')}" alt="" />`
    : '';

  return `
    <div class="ci-msg-reply" data-reply-to="${escapeHtml(rt.message_id)}" title="Ir al mensaje original">
      <div class="ci-msg-reply-texts">
        <div class="ci-msg-reply-name">${name}</div>
        <div class="ci-msg-reply-text">${preview}</div>
      </div>
      ${thumb}
    </div>`;
}

// Renderiza el attachment dentro del mensaje según su tipo
function _ciRenderAttachment(att) {
  if (!att || !att.url) return '';
  const safeName = escapeHtml(att.name || 'archivo');
  const safeUrl  = (att.url || '').replace(/"/g, '&quot;');

  if (att.type === 'image') {
    return `
      <div class="ci-msg-attach ci-attach-image">
        <a href="${safeUrl}" target="_blank" rel="noopener noreferrer" title="Abrir en pestaña nueva">
          <img class="ci-msg-img" src="${safeUrl}" alt="${safeName}" />
        </a>
      </div>`;
  }
  if (att.type === 'video') {
    return `
      <div class="ci-msg-attach ci-attach-video">
        <video class="ci-msg-video" src="${safeUrl}" controls preload="metadata"></video>
      </div>`;
  }
  if (att.type === 'audio') {
    const dur = att.duration ? _ciFmtAudioTime(att.duration) : '0:00';
    return `
      <div class="ci-msg-attach ci-audio-player" data-audio-state="paused" data-audio-url="${safeUrl}" data-audio-name="${safeName}">
        <audio class="ci-audio-engine" src="${safeUrl}" preload="metadata"></audio>
        <div class="ci-audio-main">
          <button class="ci-audio-play" type="button" aria-label="Reproducir">
            <i class="fas fa-play"></i>
          </button>
          <div class="ci-audio-body">
            <div class="ci-audio-track" role="slider" aria-label="Progreso del audio" tabindex="0">
              <div class="ci-audio-track-fill"></div>
              <div class="ci-audio-track-handle"></div>
            </div>
            <div class="ci-audio-time">
              <span class="ci-audio-current">0:00</span>
              <span class="ci-audio-duration">${dur}</span>
            </div>
          </div>
        </div>
        <div class="ci-audio-controls">
          <button class="ci-audio-ctrl ci-audio-back" type="button" aria-label="Retroceder 10 segundos" title="Retroceder 10s">
            <i class="fas fa-rotate-left"></i>
          </button>
          <button class="ci-audio-ctrl ci-audio-fwd" type="button" aria-label="Adelantar 10 segundos" title="Adelantar 10s">
            <i class="fas fa-rotate-right"></i>
          </button>
          <button class="ci-audio-ctrl ci-audio-speed" type="button" aria-label="Velocidad de reproducción" title="Velocidad">1x</button>
          <button class="ci-audio-ctrl ci-audio-download" type="button" aria-label="Descargar audio" title="Descargar">
            <i class="fas fa-download"></i>
          </button>
        </div>
      </div>`;
  }
  // Documento (PDF, Word, Excel, ZIP, etc.) → abrir en pestaña nueva
  const sizeStr = att.size ? _ciFormatSize(att.size) : '';
  const mime    = att.mime_type || '';
  const icon    = mime.includes('pdf')           ? 'fa-file-pdf'
                : mime.includes('word')          ? 'fa-file-word'
                : mime.includes('sheet') || mime.includes('excel')       ? 'fa-file-excel'
                : mime.includes('presentation') || mime.includes('powerpoint') ? 'fa-file-powerpoint'
                : mime.includes('zip') || mime.includes('rar')           ? 'fa-file-archive'
                : 'fa-file';
  return `
    <a class="ci-msg-attach ci-attach-doc" href="${safeUrl}" target="_blank" rel="noopener noreferrer" title="Abrir ${safeName} en pestaña nueva">
      <div class="ci-attach-doc-icon"><i class="fas ${icon}"></i></div>
      <div class="ci-attach-doc-info">
        <div class="ci-attach-doc-name">${safeName}</div>
        <div class="ci-attach-doc-size">${sizeStr}</div>
      </div>
      <span class="ci-attach-doc-download" title="Abrir">
        <i class="fas fa-external-link-alt"></i>
      </span>
    </a>`;
}

function _ciFormatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}

// Formatea segundos a "m:ss" para el reproductor de audio
function _ciFmtAudioTime(secs) {
  if (!secs || !isFinite(secs) || secs < 0) return '0:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return m + ':' + (s < 10 ? '0' : '') + s;
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
  if (!typingEl || !textEl) return;  // chat no montado o elementos ausentes
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
  if (!list || !count) return; // sidebar no montado

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

function ciSwitchTab(tab) { if (tab) ciFilterTab(tab); }

// ── ABRIR CHAT GENERAL ──
function ciOpenGeneral() {
  ciActiveChat = 'general';
  _ciAutoCloseSidebarMobile();

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
  ciUpdateSidebarBadge();
  ciMarkRead('general', false);  // persistir

  // Render
  ciRenderFeed('general');
  _ciLoadActiveVotacion('general');
  ciRestorePinnedBanners('general');
  ciShowTyping('general');
  ciStopTyping();
}

// ── INICIAR PRIVADO ──
function ciIniciarPrivado(userId, userName) {
  if (userId === ciCurrentUser.id) return;

  ciActiveChat = userId;
  _ciAutoCloseSidebarMobile();
  if (!ciMessages[userId]) ciMessages[userId] = [];

  ciAddPrivateChatItem(userId, userName, ciOnlineUsers[userId]?.role || '');

  // Persistir en localStorage para restaurar tras refresh
  _ciSavePrivado(userId, userName);

  // Marcar activo
  document.querySelectorAll('.ci-chat-item').forEach(el => el.classList.remove('active'));
  document.getElementById(`ci-priv-${userId}`)?.classList.add('active');

  // Header
  const avatar = document.getElementById('ci-header-avatar');
  avatar.innerHTML = ciInitials(userName);
  avatar.style.background = 'linear-gradient(135deg,#8e84fa 0%,#91c0ff 55%)';

  const isOnline = ciOnlineUsers[userId]?.online;
  document.getElementById('ci-header-name').textContent = userName;
  const subEl = document.getElementById('ci-header-sub');
  subEl.innerHTML = isOnline
    ? '<span class="ci-header-dot online"></span> En línea'
    : '<span class="ci-header-dot"></span> Desconectado';

  // Limpiar no leídos
  ciUnread[userId] = 0;
  ciUpdateUnreadBadge(userId);
  ciUpdateSidebarBadge();
  ciMarkRead(userId, true);  // persistir (privado)

  // Cambiar a tab privados
  ciSwitchTab('privados');

  // Render + historial
  ciRenderFeed(userId);
  ciLoadHistory(userId);
  _ciLoadActiveVotacion(userId);
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

function _ciSavePrivado(userId, userName) {
  // No se necesita guardar localmente — el servidor persiste los mensajes
}

async function _ciRestorePrivados() {
  try {
    const res = await apiCall(`/api/internal-chat/${ciCurrentUser.company_id}/my-privates`);
    if (!res.ok || !res.data.privates) return;

    for (const priv of res.data.privates) {
      const otherId = priv.other_id;
      // Nombre: desde servidor > participantes > online > fallback
      const participant = ciParticipants.find(p => p.user_id === otherId);
      const onlineUser  = ciOnlineUsers[otherId];
      const otherName   = priv.other_name && priv.other_name !== otherId
                          ? priv.other_name
                          : participant?.name || onlineUser?.name || 'Usuario';

      if (!document.getElementById(`ci-priv-${otherId}`)) {
        ciAddPrivateChatItem(otherId, otherName, participant?.role || onlineUser?.role || '');
        if (!ciMessages[otherId]) ciMessages[otherId] = [];
        if (!ciUnread[otherId])   ciUnread[otherId]   = 0;
        ciLoadHistory(otherId);
        // Re-unirse al room privado del socket para recibir eventos en tiempo real
        ciSocket?.emit('join_internal_private', {
          from_id:    ciCurrentUser.id,
          to_id:      otherId,
          company_id: ciCurrentUser.company_id
        });
      }

      // Preview con el remitente del último mensaje (si lo hay)
      if (priv.last_text || priv.last_attachment) {
        ciUpdateChatPreview(otherId, priv.last_text || '', {
          from_id:    priv.last_from_id,
          from_name:  priv.last_from_name,
          text:       priv.last_text,
          attachment: priv.last_attachment
        });
      }
    }
  } catch(e) {
    console.warn('No se pudieron restaurar privados:', e.message);
  }
}

function ciAddPrivateChatItem(userId, userName, role) {
  if (document.getElementById(`ci-priv-${userId}`)) return; // ya existe

  const list = document.getElementById('ci-privados-list');
  if (!list) return; // sidebar no montado (usuario en otra página)

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
  // Buscar el badge correcto según tipo de room
  let badgeId;
  if (roomId === 'general')       badgeId = 'ci-general-badge';
  else if (_ciIsSala(roomId))     badgeId = `ci-sala-badge-${roomId}`;
  else                             badgeId = `ci-badge-${roomId}`;
  const badge = document.getElementById(badgeId);
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

// Texto de preview de un mensaje (texto, o etiqueta del adjunto si no hay texto)
function _ciMsgPreviewText(msg) {
  if (!msg) return '';
  if (msg.text && msg.text.trim()) return msg.text;
  if (msg.attachment) {
    const t = msg.attachment.type;
    return t === 'image' ? '📷 Foto'
         : t === 'video' ? '🎥 Video'
         : t === 'audio' ? '🎵 Audio'
         : '📎 ' + (msg.attachment.name || 'Archivo');
  }
  return '';
}

function ciUpdateChatPreview(roomId, text, msg) {
  // Si no hay texto pero hay adjunto, mostrar un preview según el tipo
  let preview = text || '';
  if (!preview && msg) preview = _ciMsgPreviewText(msg);
  const truncated = preview.length > 30 ? preview.slice(0, 30) + '...' : preview;

  let el;
  if (roomId === 'general')   el = document.getElementById('ci-general-last');
  else if (_ciIsSala(roomId)) el = document.getElementById(`ci-sala-last-${roomId}`);
  else                         el = document.getElementById(`ci-priv-last-${roomId}`);
  if (!el) return;

  // Prefijo con el nombre de quien escribió (Opción 3): ayuda a saber de quién
  // es el mensaje, sobre todo en salas. Si lo envié yo, uso "Tú:".
  let senderPrefix = '';
  if (msg && msg.from_id) {
    const isMine = msg.from_id === (ciCurrentUser && ciCurrentUser.id);
    const name   = isMine ? 'Tú' : (msg.from_name || '');
    if (name) {
      senderPrefix = `<span class="ci-chat-item-sender">${escapeHtml(name)}:</span> `;
    }
  }

  if (senderPrefix) {
    el.innerHTML = senderPrefix + escapeHtml(truncated);
  } else {
    el.textContent = truncated;
  }
}

// ── MESSAGE TOAST (notificación al recibir mensaje fuera del chat activo) ──
function ciShowMessageToast(roomId, msg) {
  // Determinar título según tipo de chat
  let title;
  if (roomId === 'general') {
    title = `${msg.from_name} en General`;
  } else if (_ciIsSala(roomId)) {
    const sala = ciSalas.find(s => s.id === roomId);
    title = `${msg.from_name} en ${sala?.name || 'sala'}`;
  } else {
    title = `Mensaje de ${msg.from_name}`;
  }

  const existing = document.getElementById('ci-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'ci-toast';
  toast.className = 'ci-notif-toast';
  toast.innerHTML = `
    <div class="ci-notif-toast-icon">${ciInitials(msg.from_name || '?')}</div>
    <div class="ci-notif-toast-body">
      <div class="ci-notif-toast-title">${escapeHtml(title)}</div>
      <div class="ci-notif-toast-msg">${escapeHtml(_ciMsgPreviewText(msg).slice(0, 80))}</div>
    </div>
  `;
  toast.onclick = () => {
    toast.remove();
    const wasInChat = window.location.hash === '#chat_interno';
    if (!wasInChat) {
      window.location.hash = 'chat_interno';
      // Esperar a que el módulo se monte antes de abrir el chat
      setTimeout(() => {
        if (roomId === 'general')      ciOpenGeneral();
        else if (_ciIsSala(roomId))    ciOpenSala(roomId);
        else                            ciIniciarPrivado(roomId, msg.from_name);
      }, 300);
    } else {
      if (roomId === 'general')      ciOpenGeneral();
      else if (_ciIsSala(roomId))    ciOpenSala(roomId);
      else                            ciIniciarPrivado(roomId, msg.from_name);
    }
  };
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 5000);
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
async function ciAbrirParticipantes() {
  const overlay = document.getElementById('ci-modal-participantes');
  overlay.classList.add('open');
  // Mostrar estado de carga mientras se refrescan los datos
  const list = document.getElementById('ci-participants-list');
  if (list) list.innerHTML = '<p style="text-align:center;color:#9BA3C0;font-size:13px;padding:20px"><i class="fas fa-spinner fa-spin"></i> Cargando...</p>';
  await ciLoadParticipants();
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

  // Mostrar todos los usuarios con su estado habilitado/deshabilitado
  list.innerHTML = ciParticipants.map(p => `
    <div class="ci-participant-item">
      <div class="ci-participant-avatar">${ciInitials(p.name)}</div>
      <div class="ci-participant-info">
        <div class="ci-participant-name">${escapeHtml(p.name)}</div>
        <div class="ci-participant-role">${p.role || 'usuario'}</div>
      </div>
      <button class="ci-toggle ${p.enabled ? 'on' : ''}"
              id="ci-toggle-${p.user_id}"
              onclick="ciToggleParticipant('${p.user_id}', this)"
              title="${p.enabled ? 'Deshabilitar acceso' : 'Habilitar acceso'}">
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
    const res = await apiCall(`/api/internal-chat/${ciCurrentUser.company_id}/participants`, {
      method: 'PUT',
      body: JSON.stringify({ enabled_users: enabled })
    });
    if (!res.ok) throw new Error('Error al guardar participantes');
    // Recargar para reflejar el estado guardado
    await ciLoadParticipants();
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
  const d      = new Date(ts);
  const today  = new Date();
  const dLocal = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const tLocal = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diff   = Math.floor((tLocal - dLocal) / 86400000);
  if (diff === 0) return 'Hoy';
  if (diff === 1) return 'Ayer';
  return d.toLocaleDateString([], { day: 'numeric', month: 'long' });
}

function ciFormatTime(ts) {
  if (!ts) return '';
  try {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
  // Prevenir doble click
  const saveBtn = document.querySelector('#ci-modal-votacion .ci-modal-save');
  if (saveBtn && saveBtn.disabled) return;
  if (saveBtn) saveBtn.disabled = true;

  const pregunta = document.getElementById('ci-vot-pregunta').value.trim();
  if (!pregunta) {
    document.getElementById('ci-vot-pregunta').focus();
    if (saveBtn) saveBtn.disabled = false;
    return;
  }

  const opciones = Array.from(document.querySelectorAll('#ci-vot-opciones input'))
    .map(inp => inp.value.trim()).filter(Boolean);
  if (opciones.length < 2) {
    showToast('Agrega al menos 2 opciones', 'warning');
    if (saveBtn) saveBtn.disabled = false;
    return;
  }

  // Determinar room_id y tipo de chat
  const isPrivado = !_ciIsSala(ciActiveChat) && ciActiveChat !== 'general';
  const roomId    = isPrivado
    ? 'private:' + [ciCurrentUser.id, ciActiveChat].sort().join(':')
    : ciActiveChat;

  const votacion = {
    id:             'vot_' + Date.now(),
    type:           'votacion',
    room_id:        roomId,
    chat_type:      isPrivado ? 'private' : (_ciIsSala(ciActiveChat) ? 'sala' : 'general'),
    to_id:          isPrivado ? ciActiveChat : null,
    company_id:     ciCurrentUser.company_id,
    from_id:        ciCurrentUser.id,
    from_name:      ciCurrentUser.name,
    from_role:      ciCurrentUser.role,
    pregunta,
    opciones:       opciones.map(o => ({ texto: o, votos: [] })),
    members:        [...new Set([ciCurrentUser.id, ...ciGetRoomMembers(ciActiveChat)])],
    confirmaciones: [],
    timestamp:      new Date().toISOString()
  };

  ciSocket?.emit('internal_votacion', votacion);
  ciPinVotacion(votacion);
  ciCerrarVotacion();

  // Persistir en backend según tipo
  if (isPrivado) {
    apiCall(`/api/internal-chat/${ciCurrentUser.company_id}/private-votacion`, {
      method: 'POST', body: JSON.stringify(votacion)
    }).catch(() => {});
  } else {
    apiCall(`/api/internal-chat/${ciCurrentUser.company_id}/rooms/${ciActiveChat}/votacion`, {
      method: 'POST', body: JSON.stringify(votacion)
    }).catch(() => {});
  }

  // Reactivar el botón (modal puede reutilizarse)
  if (saveBtn) saveBtn.disabled = false;
}

function ciRenderVotacionCard(v, own) {
  const feed = document.getElementById('ci-feed');
  const empty = feed.querySelector('.ci-empty');
  if (empty) empty.remove();

  const total = v.opciones.reduce((s, o) => s + o.votos.length, 0);
  const yaVote = v.opciones.some(o => o.votos.includes(ciCurrentUser.id));
  const allVoted = v.members.length > 0 &&
                  v.members.every(id => v.opciones.some(o => o.votos.includes(id)));

  const div = document.createElement('div');
  div.className = `ci-msg${own ? ' own' : ''}`;
  div.dataset.votId = v.id;

  const opcionesHtml = v.opciones.map((o, i) => {
    const pct    = total > 0 ? Math.round((o.votos.length / total) * 100) : 0;
    const voted  = o.votos.includes(ciCurrentUser.id);
    const voters = o.votos.map(uid => {
      const u = ciOnlineUsers[uid] || {};
      const p = ciParticipants.find(x => x.user_id === uid) || {};
      return u.name || p.name || uid;
    }).join(', ');
    return `
      <button class="ci-vot-option-btn${voted ? ' voted' : ''}"
              onclick="ciVotar('${v.id}', ${i})"
              ${allVoted ? 'disabled' : ''}>
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
let ciPendingVoteIdx   = {};   // votId → opcionIdx (selección pendiente sin enviar)

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
  // allVoted: todos los members han votado al menos en una opción
  const allVoted = (v.members||[]).length > 0 &&
                   (v.members||[]).every(id => v.opciones.some(o => o.votos?.includes(id)));
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
    const pct      = total > 0 ? Math.round(((o.votos?.length || 0) / total) * 100) : 0;
    const voted    = o.votos?.includes(ciCurrentUser.id);
    const isWinner = allVoted && i === winnerIdx;
    // Marca la opción que el usuario ha pre-seleccionado (sin enviar aún)
    const isPending = !yaVote && ciPendingVoteIdx[v.id] === i;
    return `
      <button class="ci-pinned-vot-btn${voted ? ' voted' : ''}${isWinner ? ' winner' : ''}${isPending ? ' pending' : ''}"
              onclick="ciVotar('${v.id}',${i})"
              ${(allVoted || yaVote) ? 'disabled' : ''}>
        <div class="ci-pinned-vot-bar" style="width:${pct}%"></div>
        <span class="ci-pinned-vot-label">${escapeHtml(o.texto)}</span>
        <span class="ci-pinned-vot-pct">${pct}%</span>
      </button>`;
  }).join('');

  // Botón confirmar (cambia según estado)
  const el = document.getElementById('ci-pinned-vot');
  let confirmEl = el.querySelector('.ci-pvot-confirm');
  if (!confirmEl) {
    confirmEl = document.createElement('div');
    confirmEl.className = 'ci-pvot-confirm';
    el.appendChild(confirmEl);
  }

  if (!yaVote && !allVoted) {
    // Antes de votar: botón "Votar" — habilitado solo si hay selección pendiente
    const hasPending = ciPendingVoteIdx[v.id] !== undefined;
    confirmEl.innerHTML = `<button class="ci-pvot-confirm-btn"${hasPending ? '' : ' disabled'} onclick="ciConfirmarVoto('${v.id}')"><i class="fas fa-paper-plane"></i> Votar</button>`;
    confirmEl.style.display = '';
  } else if (allVoted) {
    // Después de que todos votaron: botón "Entendido" para confirmar el cierre
    confirmEl.innerHTML = yaConfirme
      ? `<button class="ci-pvot-confirm-btn confirmed" disabled><i class="fas fa-check"></i> Confirmado</button>`
      : `<button class="ci-pvot-confirm-btn" onclick="ciConfirmarVotacion('${v.id}')"><i class="fas fa-check"></i> Entendido</button>`;
    confirmEl.style.display = '';
  } else {
    confirmEl.style.display = 'none';
  }

  // Cerrar solo cuando todos confirmaron
  if (allConfirmed) setTimeout(() => ciUnpinVotacion(), 2000);

  // Botón eliminar visible solo si es creador o admin
  const soyCreador = v.from_id === ciCurrentUser.id;
  let delBtn = el.querySelector('.ci-pvot-delete-btn');
  if (soyCreador || ciIsAdmin) {
    if (!delBtn) {
      delBtn = document.createElement('button');
      delBtn.className = 'ci-pvot-delete-btn';
      delBtn.title = 'Eliminar votación';
      delBtn.innerHTML = '<i class="fas fa-trash"></i>';
      delBtn.onclick = () => ciEliminarVotacion(v.id);
      el.appendChild(delBtn);
    } else {
      delBtn.onclick = () => ciEliminarVotacion(v.id);
    }
  } else if (delBtn) {
    delBtn.remove();
  }
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
    room_id:    ciPinnedVotacion.room_id,
    chat_type:  ciPinnedVotacion.chat_type || 'sala',
    to_id:      ciPinnedVotacion.to_id || null,
    company_id: ciCurrentUser.company_id
  });
}

function ciUpdateVotacionUI(votId, v) {
  const card = document.querySelector(`[data-vot-id="${votId}"]`);
  if (!card || !v) return;

  const total    = v.opciones.reduce((s, o) => s + (o.votos?.length || 0), 0);
  const yaVote   = v.opciones.some(o => o.votos?.includes(ciCurrentUser.id));
  const allVoted = (v.members||[]).length > 0 &&
                  (v.members||[]).every(id => v.opciones.some(o => o.votos?.includes(id)));

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
    btn.disabled = allVoted; // solo bloquear cuando todos votaron
  });

  const pendientes = v.members?.filter(id => !v.opciones.some(o => o.votos?.includes(id))).length ?? 0;
  const meta = card.querySelector('.ci-card-meta');
  if (meta) meta.textContent = allVoted ? '✓ Votación cerrada' : `Faltan ${pendientes} voto${pendientes !== 1 ? 's' : ''}`;
}

function ciVotar(votId, opcionIdx) {
  // Si la votación no está activa en el pinned, buscarla en el registro
  if (!ciPinnedVotacion || ciPinnedVotacion.id !== votId) {
    const vFound = Object.values(ciAllPinnedVots).find(v => v.id === votId);
    if (vFound) ciPinnedVotacion = vFound;
    else return;
  }

  // Si el usuario ya votó, no puede cambiar
  const yaVote = ciPinnedVotacion.opciones.some(o => o.votos?.includes(ciCurrentUser.id));
  if (yaVote) return;

  // Solo guardar la selección local (sin emitir todavía)
  // El usuario puede cambiar la opción cuantas veces quiera antes de confirmar
  ciPendingVoteIdx[votId] = opcionIdx;
  _ciRenderPinnedVot(ciPinnedVotacion);
}

function ciConfirmarVoto(votId) {
  if (!ciPinnedVotacion || ciPinnedVotacion.id !== votId) return;
  const opcionIdx = ciPendingVoteIdx[votId];
  if (opcionIdx === undefined) return;

  // Registrar voto localmente
  ciPinnedVotacion.opciones.forEach(o => {
    if (o.votos) o.votos = o.votos.filter(id => id !== ciCurrentUser.id);
  });
  const o = ciPinnedVotacion.opciones[opcionIdx];
  if (o) {
    if (!o.votos) o.votos = [];
    o.votos.push(ciCurrentUser.id);
  }

  // Limpiar selección pendiente (ya votó)
  delete ciPendingVoteIdx[votId];

  // Emitir al servidor
  ciSocket?.emit('internal_voto', {
    vot_id:     votId,
    opcion_idx: opcionIdx,
    user_id:    ciCurrentUser.id,
    user_name:  ciCurrentUser.name,
    room_id:    ciPinnedVotacion.room_id,
    chat_type:  ciPinnedVotacion.chat_type || 'sala',
    to_id:      ciPinnedVotacion.to_id || null,
    company_id: ciCurrentUser.company_id
  });

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
  // Ocultar el aviso de confirmación de una vez anterior
  const aviso = document.getElementById('ci-prog-aviso');
  if (aviso) aviso.style.display = 'none';
  ciPdpInit();
  document.getElementById('ci-modal-programado').classList.add('open');
  // Cargar los programados pendientes de la sala actual
  ciLoadProgramadosPendientes();
}

function ciCerrarProgramado() {
  document.getElementById('ci-modal-programado').classList.remove('open');
}

// Carga y muestra los mensajes programados pendientes de la sala/chat actual
function ciLoadProgramadosPendientes() {
  const cont = document.getElementById('ci-prog-pendientes');
  const list = document.getElementById('ci-prog-pendientes-list');
  if (!cont || !list || !ciCurrentUser) return;

  const roomId = ciActiveChat;
  const isPrivado = !_ciIsSala(roomId) && roomId !== 'general';
  const backendRoom = isPrivado
    ? 'private:' + [ciCurrentUser.id, roomId].sort().join(':')
    : roomId;

  // Título según la sala
  const titleEl = document.getElementById('ci-prog-pendientes-title');
  if (titleEl) {
    let salaNombre = 'este chat';
    if (roomId === 'general') salaNombre = 'general';
    else if (isPrivado) salaNombre = 'este privado';
    else { const s = ciSalas.find(x => x.id === roomId); if (s) salaNombre = s.name; }
    titleEl.textContent = `Programados en ${salaNombre}`;
  }

  apiCall(`/api/internal-chat/${ciCurrentUser.company_id}/rooms/${encodeURIComponent(backendRoom)}/programados`, {
    method: 'GET'
  }).then(res => {
    const progs = (res.ok && Array.isArray(res.data?.programados)) ? res.data.programados : [];
    _ciRenderProgramadosPendientes(progs);
  }).catch(() => {
    _ciRenderProgramadosPendientes([]);
  });
}

function _ciRenderProgramadosPendientes(progs) {
  const cont   = document.getElementById('ci-prog-pendientes');
  const list   = document.getElementById('ci-prog-pendientes-list');
  const countEl = document.getElementById('ci-prog-pendientes-count');
  if (!cont || !list) return;

  if (!progs || progs.length === 0) {
    cont.style.display = 'none';
    list.innerHTML = '';
    return;
  }

  cont.style.display = 'block';
  if (countEl) countEl.textContent = progs.length;

  list.innerHTML = progs.map(p => {
    const d       = new Date(p.send_at);
    const dateStr = d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
    const timeStr = d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
    const rel     = _ciTiempoRelativo(d);
    const puedeCancelar = p.from_id === ciCurrentUser.id || ciIsAdmin;

    const cancelBtn = puedeCancelar
      ? `<button class="ci-prog-cancel-btn" onclick="ciCancelarProgramado('${p.id}')"><i class="fas fa-trash"></i> Cancelar</button>`
      : '';

    return `
      <div class="ci-prog-pend-item" id="ci-prog-pend-${p.id}">
        <div class="ci-prog-pend-main">
          <div class="ci-prog-pend-text">${escapeHtml(p.texto || '')}</div>
          <div class="ci-prog-pend-time">
            <i class="fas fa-calendar-alt"></i>${dateStr} · ${timeStr}
            ${rel ? `<span class="ci-prog-pend-rel">· ${rel}</span>` : ''}
          </div>
        </div>
        ${cancelBtn}
      </div>
    `;
  }).join('');
}

// Devuelve un texto relativo ("en 14 h", "en 3 días") o '' si ya pasó o es inválida
function _ciTiempoRelativo(date) {
  const diff = date.getTime() - Date.now();
  if (isNaN(diff) || diff <= 0) return '';
  const mins = Math.round(diff / 60000);
  if (mins < 60) return `en ${mins} min`;
  const horas = Math.round(mins / 60);
  if (horas < 24) return `en ${horas} h`;
  const dias = Math.round(horas / 24);
  return `en ${dias} día${dias !== 1 ? 's' : ''}`;
}

async function ciCancelarProgramado(progId) {
  const ok = await ciConfirmar({
    titulo:    'Cancelar mensaje programado',
    mensaje:   '¿Cancelar este mensaje? No se enviará.',
    confirmar: 'Cancelar envío',
    cancelar:  'Volver',
    peligro:   true
  });
  if (!ok) return;

  try {
    const res = await apiCall(`/api/internal-chat/${ciCurrentUser.company_id}/programados/${progId}`, {
      method: 'DELETE'
    });
    if (res.ok) {
      // Quitar del DOM y recargar la lista
      const el = document.getElementById(`ci-prog-pend-${progId}`);
      if (el) el.remove();
      ciLoadProgramadosPendientes();
      showToast('Mensaje programado cancelado', 'success');
    } else {
      showToast(res.data?.error || 'No se pudo cancelar', 'error');
    }
  } catch (e) {
    showToast('Error al cancelar', 'error');
  }
}

function ciEnviarProgramado() {
  const texto  = document.getElementById('ci-prog-texto').value.trim();
  const sendAt = ciPdpGetValue();

  if (!texto) { document.getElementById('ci-prog-texto').focus(); return; }
  if (!sendAt) { showToast('Selecciona la fecha y hora de envío', 'warning'); return; }
  if (new Date(sendAt) <= new Date()) { showToast('La fecha/hora debe ser en el futuro', 'warning'); return; }

  // En privados el room_id debe ser 'private:a:b' (igual que al listar y al
  // enviar), no el userId suelto. Así el GET de pendientes lo encuentra y el
  // scheduler lo despacha al room correcto.
  const isPrivadoP = !_ciIsSala(ciActiveChat) && ciActiveChat !== 'general';
  const progRoomId = isPrivadoP
    ? 'private:' + [ciCurrentUser.id, ciActiveChat].sort().join(':')
    : ciActiveChat;

  const prog = {
    id:         'prog_' + Date.now(),
    type:       'programado',
    room_id:    progRoomId,
    company_id: ciCurrentUser.company_id,
    from_id:    ciCurrentUser.id,
    from_name:  ciCurrentUser.name,
    from_role:  ciCurrentUser.role,
    texto,
    send_at:    sendAt,
    timestamp:  new Date().toISOString()
  };

  // Persistir en backend, luego refrescar la lista de pendientes del modal.
  // La ruta lleva el progRoomId (con private: si corresponde) para que el
  // _deny_if_no_room_access valide bien y el room quede consistente.
  apiCall(`/api/internal-chat/${ciCurrentUser.company_id}/rooms/${encodeURIComponent(progRoomId)}/programado`, {
    method: 'POST', body: JSON.stringify(prog)
  }).then(() => {
    ciLoadProgramadosPendientes();
  }).catch(() => {});

  // Limpiar el campo de texto para poder programar otro, sin cerrar el modal
  document.getElementById('ci-prog-texto').value = '';

  // Aviso de confirmación DENTRO del modal (más visible que el toast)
  const d = new Date(sendAt);
  const dStr = d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
  const tStr = d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
  ciMostrarAvisoProgramado(`Mensaje programado para el ${dStr} · ${tStr}`);
}

// Muestra el aviso verde de confirmación dentro del modal por unos segundos
let _ciAvisoTimer = null;
function ciMostrarAvisoProgramado(texto) {
  const aviso = document.getElementById('ci-prog-aviso');
  const txt   = document.getElementById('ci-prog-aviso-text');
  if (!aviso) return;
  if (txt) txt.textContent = texto;
  aviso.style.display = 'flex';
  clearTimeout(_ciAvisoTimer);
  _ciAvisoTimer = setTimeout(() => { aviso.style.display = 'none'; }, 4000);
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
    ? ciParticipants.filter(p => p.enabled)
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
  // Prevenir doble click
  const saveBtn = document.querySelector('#ci-modal-tarea .ci-modal-save');
  if (saveBtn && saveBtn.disabled) return;
  if (saveBtn) saveBtn.disabled = true;

  const desc       = document.getElementById('ci-tarea-desc').value.trim();
  const fecha      = ciDpGetValue();
  const prioridad  = document.getElementById('ci-tarea-prioridad').value;
  const calendario = document.getElementById('ci-tarea-calendario').checked;

  if (!desc) {
    document.getElementById('ci-tarea-desc').focus();
    if (saveBtn) saveBtn.disabled = false;
    return;
  }

  const responsables = Array.from(
    document.querySelectorAll('#ci-tarea-responsables input:checked')
  ).map(cb => {
    const row = cb.closest('.ci-member-row');
    return {
      user_id: cb.value,
      name:    row.querySelector('.ci-member-row-name')?.textContent || cb.value
    };
  });

  if (!responsables.length) {
    showToast('Selecciona al menos un responsable', 'warning');
    if (saveBtn) saveBtn.disabled = false;
    return;
  }

  const isPrivadoT = !_ciIsSala(ciActiveChat) && ciActiveChat !== 'general';
  const tareaRoomId = isPrivadoT
    ? 'private:' + [ciCurrentUser.id, ciActiveChat].sort().join(':')
    : ciActiveChat;

  const tarea = {
    id:           'tarea_' + Date.now(),
    type:         'tarea',
    room_id:      tareaRoomId,
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

  const tareaEndpoint = isPrivadoT
    ? `/api/internal-chat/${ciCurrentUser.company_id}/private-tarea`
    : `/api/internal-chat/${ciCurrentUser.company_id}/rooms/${ciActiveChat}/tarea`;
  apiCall(tareaEndpoint, { method: 'POST', body: JSON.stringify(tarea) }).catch(() => {});

  // Reactivar el botón (modal puede reutilizarse)
  if (saveBtn) saveBtn.disabled = false;
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
let ciActiveNota     = null; // (compat) última nota interactuada
let ciAllPinnedNotas = {};   // roomId → [notas]  (array por sala)
let ciPinnedExpanded = false; // si la pila está expandida (Ver todas)
const CI_PINNED_VISIBLE = 4;  // notas visibles antes de "Ver todas"

function ciToggleNotaMode() {
  ciNotaMode = !ciNotaMode;
  _ciApplyNotaMode();
}

// Sale del modo nota (cancelar). Limpia el input si tenía texto de nota.
function ciSalirModoNota() {
  if (!ciNotaMode) return;
  ciNotaMode = false;
  _ciApplyNotaMode();
  // Limpiar el texto que se hubiera escrito para la nota
  const input = document.getElementById('ci-input');
  if (input) { input.value = ''; input.focus(); }
}

// Aplica el estado visual del modo nota (entrar o salir)
function _ciApplyNotaMode() {
  const btn      = document.getElementById('ci-nota-toggle');
  const inputBox = document.getElementById('ci-input-box');
  const input    = document.getElementById('ci-input');
  const typeRow  = document.getElementById('ci-nota-type-row');

  if (btn) btn.classList.toggle('active', ciNotaMode);
  if (inputBox) inputBox.classList.toggle('nota-mode', ciNotaMode);
  if (input) input.placeholder = ciNotaMode
    ? '📌 Escribe la nota anclada...'
    : 'Escribe un mensaje... usa @ para mencionar';

  // Mostrar/ocultar el selector de tipo (Importante / Casual)
  if (typeRow) typeRow.style.display = ciNotaMode ? 'flex' : 'none';
}

// Tipo de nota seleccionado al crear ("casual" por defecto)
let ciNotaTipo = 'casual';
function ciSetNotaTipo(tipo) {
  ciNotaTipo = (tipo === 'importante') ? 'importante' : 'casual';
  document.querySelectorAll('.ci-nota-type-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tipo === ciNotaTipo);
  });
  const hint = document.getElementById('ci-nota-type-hint');
  if (hint) {
    hint.textContent = (ciNotaTipo === 'importante')
      ? 'Requiere confirmación de lectura'
      : 'Sin confirmación · expira en 24h';
  }
}

function ciEnviarNota(text) {
  const roomId   = ciActiveChat;
  const isPrivadoN = !_ciIsSala(roomId) && roomId !== 'general';
  const notaRoomId = isPrivadoN
    ? 'private:' + [ciCurrentUser.id, roomId].sort().join(':')
    : roomId;

  const tipo = ciNotaTipo;
  // Solo las importantes requieren confirmación → llevan members.
  // Las casuales no piden confirmación → members vacío.
  const members = (tipo === 'importante') ? ciGetRoomMembers(roomId) : [];

  const notaIdUnico = 'nota_' + Date.now();
  const nota = {
    id:            notaIdUnico,
    nota_id:       notaIdUnico,
    room_id:       notaRoomId,
    company_id:    ciCurrentUser.company_id,
    text:          text,
    tipo:          tipo,
    from_id:       ciCurrentUser.id,
    from_name:     ciCurrentUser.name,
    members:       members,
    confirmations: [],
    timestamp:     new Date().toISOString()
  };

  // Emitir vía socket
  ciSocket?.emit('internal_pinned_note', nota);

  // Agregar localmente al array de la sala y re-renderizar
  ciAddNotaToStack(ciActiveChat, nota);

  // Resetear el tipo a casual para la próxima
  ciSetNotaTipo('casual');

  // Persistir en backend
  const notaEndpoint = isPrivadoN
    ? `/api/internal-chat/${ciCurrentUser.company_id}/private-nota`
    : `/api/internal-chat/${ciCurrentUser.company_id}/rooms/${roomId}/pinned`;
  apiCall(notaEndpoint, { method: 'POST', body: JSON.stringify(nota) }).catch(() => {});
}

function ciGetRoomMembers(roomId) {
  if (roomId === 'general') {
    return ciParticipants.filter(p => p.enabled).map(p => p.user_id);
  }
  const sala = ciSalas.find(s => s.id === roomId);
  if (sala) return [...sala.members];
  // Privado: los dos usuarios
  return [ciCurrentUser.id, roomId];
}

// Normaliza el id de la nota (algunas vienen con id, otras con nota_id)
function _ciNotaId(nota) {
  return nota.nota_id || nota.id;
}

// Agrega una nota al array de su sala (evita duplicados por id)
function ciAddNotaToStack(roomKey, nota) {
  // roomKey puede ser ciActiveChat (sala/privado-userId); normalizamos al room_id real de la nota
  const key = _ciRoomKeyForNota(nota) || roomKey;
  if (!ciAllPinnedNotas[key]) ciAllPinnedNotas[key] = [];
  const nid = _ciNotaId(nota);
  // Evitar duplicado
  if (!ciAllPinnedNotas[key].some(n => _ciNotaId(n) === nid)) {
    ciAllPinnedNotas[key].unshift(nota); // más reciente primero
  }
  ciActiveNota = nota;
  if (_ciActiveRoomMatchesNota(nota)) ciRenderPinnedStack(ciActiveChat);
}

// Determina la clave de almacenamiento local para una nota (la sala activa)
function _ciRoomKeyForNota(nota) {
  // Si la nota es de un privado (room_id 'private:a:b'), la guardamos bajo ciActiveChat
  // para que coincida con cómo el frontend identifica el chat abierto.
  if (nota.room_id && nota.room_id.startsWith('private:')) {
    return ciActiveChat; // el privado abierto
  }
  return nota.room_id;
}

// ¿La nota pertenece al chat actualmente abierto?
function _ciActiveRoomMatchesNota(nota) {
  if (!nota.room_id) return false;
  if (nota.room_id.startsWith('private:')) {
    // private:a:b debe contener mi id y el del chat abierto
    const expected = 'private:' + [ciCurrentUser.id, ciActiveChat].sort().join(':');
    return nota.room_id === expected;
  }
  return nota.room_id === ciActiveChat;
}

// Render principal de la pila de notas para la sala activa
function ciRenderPinnedStack(roomKey) {
  const stack  = document.getElementById('ci-pinned-stack');
  const listEl = document.getElementById('ci-pinned-list');
  const countEl = document.getElementById('ci-pinned-count');
  const toggleAll = document.getElementById('ci-pinned-toggle-all');
  if (!stack || !listEl) return;

  const notas = ciAllPinnedNotas[roomKey] || [];
  if (notas.length === 0) {
    stack.style.display = 'none';
    listEl.innerHTML = '';
    return;
  }

  stack.style.display = 'block';
  if (countEl) countEl.textContent = notas.length;

  // Mostrar máximo CI_PINNED_VISIBLE salvo que esté expandido
  const visibles = ciPinnedExpanded ? notas : notas.slice(0, CI_PINNED_VISIBLE);

  if (toggleAll) {
    if (notas.length > CI_PINNED_VISIBLE) {
      toggleAll.style.display = 'inline';
      toggleAll.textContent = ciPinnedExpanded ? 'Ver menos' : `Ver todas (${notas.length})`;
    } else {
      toggleAll.style.display = 'none';
    }
  }

  listEl.innerHTML = visibles.map(nota => _ciRenderNotaCard(nota)).join('');
}

// Render de una tarjeta de nota individual
function _ciRenderNotaCard(nota) {
  const nid       = _ciNotaId(nota);
  const esImportante = nota.tipo === 'importante';
  const soySender = nota.from_id === ciCurrentUser.id;
  const yaConfirme = (nota.confirmations || []).includes(ciCurrentUser.id);
  const puedeBorrar = soySender || ciIsAdmin;

  // Confirmaciones (solo importantes)
  let confsHtml = '';
  let confirmBtnHtml = '';
  if (esImportante) {
    const members = nota.members || [];
    const confirmations = nota.confirmations || [];
    const total = members.filter(id => id !== nota.from_id).length;
    const confirmed = confirmations.filter(id => id !== nota.from_id).length;

    let chips = '';
    confirmations.filter(id => id !== nota.from_id).forEach(id => {
      const part = ciParticipants.find(p => p.user_id === id) || ciOnlineUsers[id] || {};
      chips += `<span class="ci-pinned-chip confirmed"><i class="fas fa-check"></i>${ciInitials(part.name || id)}</span>`;
    });
    members.filter(id => !confirmations.includes(id) && id !== nota.from_id).forEach(id => {
      const part = ciParticipants.find(p => p.user_id === id) || ciOnlineUsers[id] || {};
      chips += `<span class="ci-pinned-chip pending"><i class="fas fa-clock"></i>${ciInitials(part.name || id)}</span>`;
    });
    confsHtml = `<div class="ci-pinned-confirmations">${chips}<span class="ci-pinned-frac">${confirmed}/${total}</span></div>`;

    if (!soySender && !yaConfirme) {
      confirmBtnHtml = `<button class="ci-pinned-confirm-btn" onclick="ciConfirmarNota('${nid}')"><i class="fas fa-check"></i> Visto bueno</button>`;
    } else {
      confirmBtnHtml = `<button class="ci-pinned-confirm-btn confirmed" disabled><i class="fas fa-check"></i> Confirmado</button>`;
    }
  }

  const deleteBtn = puedeBorrar
    ? `<button class="ci-pinned-delete-btn" onclick="ciEliminarNota('${nid}')" title="Eliminar nota"><i class="fas fa-trash"></i></button>`
    : '';

  const tipoClass = esImportante ? 'importante' : 'casual';

  return `
    <div class="ci-pinned-card ${tipoClass}" id="ci-pinned-card-${nid}">
      <div class="ci-pinned-card-main">
        <div class="ci-pinned-card-head">
          <span class="ci-pinned-author">${escapeHtml(nota.from_name || 'Usuario')}</span>
          ${esImportante ? '<span class="ci-pinned-badge">Importante</span>' : ''}
        </div>
        <div class="ci-pinned-text">${escapeHtml(nota.text || '')}</div>
        ${confsHtml}
      </div>
      <div class="ci-pinned-card-actions">
        ${confirmBtnHtml}
        ${deleteBtn}
      </div>
    </div>
  `;
}

function ciTogglePinnedAll() {
  ciPinnedExpanded = !ciPinnedExpanded;
  ciRenderPinnedStack(ciActiveChat);
}

// Mantener compatibilidad: ciMostrarNota ahora agrega al stack
function ciMostrarNota(nota) {
  ciAddNotaToStack(ciActiveChat, nota);
}

function ciConfirmarNota(notaId) {
  // Buscar la nota en el stack de la sala activa
  const notas = ciAllPinnedNotas[ciActiveChat] || [];
  const nota  = notas.find(n => _ciNotaId(n) === notaId);
  if (!nota) return;
  if ((nota.confirmations || []).includes(ciCurrentUser.id)) return;

  if (!nota.confirmations) nota.confirmations = [];
  nota.confirmations.push(ciCurrentUser.id);
  ciActiveNota = nota;

  // Re-render
  ciRenderPinnedStack(ciActiveChat);

  // Emitir confirmación
  ciSocket?.emit('internal_note_confirmed', {
    nota_id:    _ciNotaId(nota),
    room_id:    nota.room_id,
    user_id:    ciCurrentUser.id,
    user_name:  ciCurrentUser.name,
    company_id: ciCurrentUser.company_id,
    confirmations: nota.confirmations
  });

  // Persistir
  apiCall(`/api/internal-chat/${ciCurrentUser.company_id}/rooms/${nota.room_id}/pinned/${_ciNotaId(nota)}/confirm`, {
    method: 'PUT',
    body: JSON.stringify({ user_id: ciCurrentUser.id })
  }).catch(() => {});

  // Verificar si todos confirmaron → quitar del stack
  ciCheckNotaResuelta(nota);
}

function ciCheckNotaResuelta(nota) {
  if (!nota || nota.tipo !== 'importante') return;
  const members = nota.members || [];
  const pendientes = members.filter(
    id => !(nota.confirmations || []).includes(id) && id !== nota.from_id
  );
  if (members.length > 0 && pendientes.length === 0) {
    // Todos confirmaron — quitar del stack tras una breve pausa
    setTimeout(() => {
      ciRemoveNotaFromStack(_ciNotaId(nota));
    }, 800);
  }
}

// Quita una nota del stack por id y re-renderiza
function ciRemoveNotaFromStack(notaId) {
  Object.keys(ciAllPinnedNotas).forEach(key => {
    ciAllPinnedNotas[key] = (ciAllPinnedNotas[key] || []).filter(n => _ciNotaId(n) !== notaId);
  });
  ciRenderPinnedStack(ciActiveChat);
}

function ciRestorePinnedBanners(roomId) {
  // Notas (array): re-render inmediato desde cache, luego refrescar del backend
  ciPinnedExpanded = false;
  ciRenderPinnedStack(roomId);
  ciLoadPinnedNotes(roomId);

  // Votación
  const vot = ciAllPinnedVots[roomId];
  if (vot) ciPinVotacion(vot);
  else ciUnpinVotacion(false);
}

// Carga las notas ancladas de una sala/chat desde el backend
function ciLoadPinnedNotes(roomId) {
  if (!ciCurrentUser) return;
  const isPrivado = !_ciIsSala(roomId) && roomId !== 'general';
  // En privados el backend usa la ruta de sala con el room_id 'private:a:b'.
  // Pero el endpoint GET /pinned es por <room_id> de sala; para privados las
  // notas se guardan con room_id 'private:...'. Usamos el mismo endpoint con
  // el identificador correcto.
  const backendRoom = isPrivado
    ? 'private:' + [ciCurrentUser.id, roomId].sort().join(':')
    : roomId;

  apiCall(`/api/internal-chat/${ciCurrentUser.company_id}/rooms/${encodeURIComponent(backendRoom)}/pinned`, {
    method: 'GET'
  }).then(res => {
    if (res.ok && res.data && Array.isArray(res.data.notes)) {
      // Normalizar y guardar bajo la clave del chat abierto (roomId)
      ciAllPinnedNotas[roomId] = res.data.notes.map(n => ({
        ...n,
        id: n.nota_id || n.id || n._id,
        nota_id: n.nota_id || n.id || n._id,
        confirmations: n.confirmations || [],
        members: n.members || [],
        tipo: n.tipo || 'casual',
      }));
      // Solo re-render si seguimos en el mismo chat
      if (ciActiveChat === roomId) ciRenderPinnedStack(roomId);
    }
  }).catch(() => {});
}

function ciOcultarNota() {
  const stack = document.getElementById('ci-pinned-stack');
  if (stack) stack.style.display = 'none';
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
      // Precargar historial de la sala
      ciLoadHistory(sala.id);
    }
  });
}

// Render lista de salas en el sidebar
function ciRenderSalasList() {
  const container = document.getElementById('ci-salas-list');
  if (!container) return; // sidebar no montado
  if (!ciSalas.length) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = ciSalas.map(sala => {
    const isMember  = sala.members.includes(ciCurrentUser.id);
    const lastMsg   = (ciMessages[sala.id] || []).slice(-1)[0];
    const lastBody  = lastMsg ? _ciMsgPreviewText(lastMsg).slice(0, 35) : (sala.desc || 'Sin mensajes aún');
    // Prefijo con el remitente del último mensaje (Opción 3)
    let lastHtml;
    if (lastMsg && lastMsg.from_id) {
      const isMine = lastMsg.from_id === ciCurrentUser.id;
      const sName  = isMine ? 'Tú' : (lastMsg.from_name || '');
      lastHtml = sName
        ? `<span class="ci-chat-item-sender">${escapeHtml(sName)}:</span> ${escapeHtml(lastBody)}`
        : escapeHtml(lastBody);
    } else {
      lastHtml = escapeHtml(lastBody);
    }
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
          <div class="ci-sala-last" id="ci-sala-last-${sala.id}">${lastHtml}</div>
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
  _ciAutoCloseSidebarMobile();

  // Asegurar join al room socket de esta sala
  ciSocket?.emit('join_internal_room', {
    room_id:    salaId,
    company_id: ciCurrentUser.company_id,
    user_id:    ciCurrentUser.id
  });

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
  ciUpdateSidebarBadge();
  ciMarkRead(salaId, false);  // persistir (sala)

  // Render + historial
  ciRenderFeed(salaId);
  ciLoadHistory(salaId);
  _ciLoadActiveVotacion(salaId);
  ciShowTyping(salaId);
  ciStopTyping();
  ciRestorePinnedBanners(salaId);
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
    ? ciParticipants.filter(p => p.enabled && p.user_id !== ciCurrentUser.id)
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
  // Prevenir doble click
  const saveBtn = document.querySelector('#ci-modal-privado .ci-modal-save');
  if (saveBtn && saveBtn.disabled) return;
  if (saveBtn) saveBtn.disabled = true;

  const sel = document.querySelector('input[name="ci-privado-persona"]:checked');
  if (!sel) {
    showToast('Selecciona una persona', 'warning');
    if (saveBtn) saveBtn.disabled = false;
    return;
  }
  const userId   = sel.value;
  const userName = sel.dataset.name;
  ciCerrarNuevoPrivado();
  ciIniciarPrivado(userId, userName);

  // Reactivar el botón (modal puede reutilizarse)
  if (saveBtn) saveBtn.disabled = false;
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
    ? ciParticipants.filter(p => p.enabled)
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
  // Prevenir doble click — desactivar el botón mientras se procesa
  const saveBtn = document.querySelector('#ci-modal-sala .ci-modal-save');
  if (saveBtn && saveBtn.disabled) return;
  if (saveBtn) saveBtn.disabled = true;

  const nombre  = (document.getElementById('ci-sala-nombre').value || '').trim();
  const desc    = (document.getElementById('ci-sala-desc').value   || '').trim();
  const members = Array.from(
    document.querySelectorAll('#ci-sala-members-list input[type="checkbox"]:checked')
  ).map(cb => cb.value);

  if (!nombre) {
    document.getElementById('ci-sala-nombre').focus();
    document.getElementById('ci-sala-nombre').style.borderColor = '#ef4444';
    if (saveBtn) saveBtn.disabled = false;
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
      if (res.ok) {
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

  // Reactivar el botón (estará disabled si el modal se reutiliza)
  if (saveBtn) saveBtn.disabled = false;

  // Cambiar a tab salas
  ciSwitchTab('salas');
}

// Eliminar sala
async function ciEliminarSala() {
  if (!ciEditingSalaId) return;
  const sala = ciSalas.find(s => s.id === ciEditingSalaId);
  if (!sala) return;

  const ok = await ciConfirmar({
    titulo:  'Eliminar sala',
    mensaje: `¿Eliminar la sala "${sala.name}"? Esta acción no se puede deshacer.`,
    confirmar: 'Eliminar',
    cancelar:  'Cancelar',
    peligro:   true
  });
  if (!ok) return;

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

// ═══════════════════════════════════════════════
//  ELIMINAR NOTA Y VOTACIÓN (solo creador o admin)
// ═══════════════════════════════════════════════

async function ciEliminarNota(notaId) {
  // Buscar la nota en el stack de la sala activa
  const notas = ciAllPinnedNotas[ciActiveChat] || [];
  const nota  = notas.find(n => _ciNotaId(n) === notaId);
  if (!nota) return;

  // Validación cliente (backend valida también)
  if (nota.from_id !== ciCurrentUser.id && !ciIsAdmin) return;

  const ok = await ciConfirmar({
    titulo:    'Eliminar nota',
    mensaje:   '¿Eliminar la nota anclada? Esta acción no se puede deshacer.',
    confirmar: 'Eliminar',
    cancelar:  'Cancelar',
    peligro:   true
  });
  if (!ok) return;

  // Quitar localmente del stack y re-renderizar
  ciRemoveNotaFromStack(notaId);

  // Notificar a los demás
  ciSocket?.emit('internal_nota_deleted', {
    nota_id:    notaId,
    room_id:    nota.room_id,
    company_id: ciCurrentUser.company_id
  });

  // Persistir borrado
  try {
    const res = await apiCall(
      `/api/internal-chat/${ciCurrentUser.company_id}/notas/${notaId}`,
      { method: 'DELETE' }
    );
    if (!res.ok) {
      showToast(res.data?.error || 'No se pudo eliminar la nota', 'error');
    }
  } catch (e) {
    console.warn('Error eliminando nota:', e.message);
  }
}

async function ciEliminarVotacion(votId) {
  const v = ciPinnedVotacion;
  if (!v || v.id !== votId) return;

  // Validación cliente (backend valida también)
  if (v.from_id !== ciCurrentUser.id && !ciIsAdmin) return;

  const ok = await ciConfirmar({
    titulo:    'Eliminar votación',
    mensaje:   `¿Eliminar la votación "${v.pregunta}"? Esta acción no se puede deshacer.`,
    confirmar: 'Eliminar',
    cancelar:  'Cancelar',
    peligro:   true
  });
  if (!ok) return;

  try {
    const res = await apiCall(
      `/api/internal-chat/${ciCurrentUser.company_id}/votaciones/${votId}`,
      { method: 'DELETE' }
    );
    if (!res.ok) {
      showToast(res.data?.error || 'No se pudo eliminar la votación', 'error');
      return;
    }
  } catch (e) {
    console.warn('Error eliminando votación:', e.message);
    return;
  }

  // Limpiar estado local
  delete ciAllPinnedVots[v.room_id];
  ciUnpinVotacion(false);

  // Notificar a los demás
  ciSocket?.emit('internal_votacion_deleted', {
    vot_id:     votId,
    room_id:    v.room_id,
    chat_type:  v.chat_type || (_ciIsSala(v.room_id) ? 'sala' : (v.room_id?.startsWith('private:') ? 'private' : 'general')),
    to_id:      v.to_id || null,
    company_id: ciCurrentUser.company_id
  });
}

// ═══════════════════════════════════════════════
//  MODAL DE CONFIRMACIÓN CUSTOM
// ═══════════════════════════════════════════════
//  Reemplaza el confirm() nativo con un modal con estilo Heavensy.
//  Retorna una Promise<boolean>.
//
//  Uso:
//    const ok = await ciConfirmar({
//      titulo:    'Eliminar sala',
//      mensaje:   '¿Estás seguro?',
//      confirmar: 'Eliminar',
//      cancelar:  'Cancelar',
//      peligro:   true   // botón rojo en vez de violeta
//    });
function ciConfirmar(opts = {}) {
  const {
    titulo    = 'Confirmar',
    mensaje   = '¿Estás seguro?',
    confirmar = 'Aceptar',
    cancelar  = 'Cancelar',
    peligro   = false,
    soloAceptar = false   // si true, muestra un solo botón (modo aviso)
  } = opts;

  return new Promise(resolve => {
    // Quitar cualquier modal previo
    const existing = document.getElementById('ci-modal-confirmar');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'ci-modal-overlay open';
    overlay.id        = 'ci-modal-confirmar';
    overlay.style.cssText = 'display:flex;align-items:center;justify-content:center;z-index:9999';

    const btnColor = peligro
      ? 'background:#ef4444;color:#fff;border:none'
      : 'background:linear-gradient(135deg,#8e84fa 0%,#91c0ff 55%);color:#fff;border:none';
    const iconColor = peligro ? '#ef4444' : '#8e84fa';
    const icon      = peligro ? 'fa-exclamation-triangle' : 'fa-question-circle';

    overlay.innerHTML = `
      <div class="ci-modal" style="width:380px;max-width:90vw">
        <div class="ci-modal-body" style="text-align:center;padding:24px 22px 8px">
          <div style="width:54px;height:54px;border-radius:50%;background:${peligro ? '#fee2e2' : '#eef0fa'};display:flex;align-items:center;justify-content:center;margin:0 auto 14px">
            <i class="fas ${icon}" style="color:${iconColor};font-size:24px"></i>
          </div>
          <div style="font-size:16px;font-weight:700;color:#383838;margin-bottom:8px">${escapeHtml(titulo)}</div>
          <div style="font-size:13px;color:#6b7194;line-height:1.5">${escapeHtml(mensaje)}</div>
        </div>
        <div class="ci-modal-footer" style="justify-content:center;gap:8px;padding-top:16px">
          ${soloAceptar ? '' : `<button id="ci-confirmar-cancel" style="padding:9px 20px;border-radius:10px;border:1px solid #e4e9f5;background:#fff;color:#9BA3C0;font-size:13px;font-weight:600;cursor:pointer;font-family:'DM Sans',sans-serif">${escapeHtml(cancelar)}</button>`}
          <button id="ci-confirmar-ok" style="${btnColor};padding:9px 20px;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;font-family:'DM Sans',sans-serif">${escapeHtml(confirmar)}</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const cleanup = (result) => {
      overlay.remove();
      document.removeEventListener('keydown', onKey);
      resolve(result);
    };

    const onKey = (e) => {
      if (e.key === 'Escape') cleanup(false);
      else if (e.key === 'Enter') cleanup(true);
    };

    document.getElementById('ci-confirmar-ok').onclick     = () => cleanup(true);
    const cancelBtn = document.getElementById('ci-confirmar-cancel');
    if (cancelBtn) cancelBtn.onclick = () => cleanup(false);
    overlay.onclick = (e) => { if (e.target === overlay) cleanup(false); };
    document.addEventListener('keydown', onKey);

    // Focus seguro: cancelar si existe, sino aceptar
    setTimeout(() => {
      const f = document.getElementById('ci-confirmar-cancel') || document.getElementById('ci-confirmar-ok');
      if (f) f.focus();
    }, 50);
  });
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
    // Info usuario privado — buscar nombre en ciOnlineUsers, ciParticipants y historial
    const onlineUser      = ciOnlineUsers[ciActiveChat];
    const participantUser = ciParticipants.find(p => p.user_id === ciActiveChat);
    const otherName       = onlineUser?.name || participantUser?.name || ciActiveChat;
    const otherRole       = onlineUser?.role || participantUser?.role || '';
    const isOnline        = !!onlineUser?.online;
    ciAbrirInfoModal({
      tipo:    'privado',
      nombre:  otherName,
      desc:    'Chat privado',
      avatar:  null,
      color:   'linear-gradient(135deg,#8e84fa 0%,#91c0ff 55%)',
      members: [
        { id: ciActiveChat,    name: otherName,          role: otherRole,          online: isOnline },
        { id: ciCurrentUser.id, name: ciCurrentUser.name, role: ciCurrentUser.role, online: true }
      ]
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
      const online = ciOnlineUsers[uid] || {};
      const part   = ciParticipants.find(p => p.user_id === uid) || {};
      const name   = online.name || part.name || uid;
      const role   = online.role || part.role || '';
      return { id: uid, name, role, online: !!online.online };
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
  showToast('Próximamente: visualizador de archivos compartidos', 'info');
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
window.ciEliminarNota        = ciEliminarNota;
window.ciEliminarVotacion    = ciEliminarVotacion;
window.ciOpenSala            = ciOpenSala;
window.ciUpdateMemberCount   = ciUpdateMemberCount;
window.ciAbrirParticipantes  = ciAbrirParticipantes;
window.ciCerrarParticipantes = ciCerrarParticipantes;
window.ciToggleParticipant   = ciToggleParticipant;
window.ciGuardarParticipantes = ciGuardarParticipantes;

// Init page — requerido por el router
window.initChat_internoPage = initChat_internoPage;
window.ciToggleSidebar      = ciToggleSidebar;
window.ciFilterTab          = ciFilterTab;
window.ciAddBtnClick        = ciAddBtnClick;
window.ciAbrirVotacion      = ciAbrirVotacion;
window.ciCerrarVotacion     = ciCerrarVotacion;
window.ciEnviarVotacion     = ciEnviarVotacion;
window.ciVotAgregarOpcion   = ciVotAgregarOpcion;
window.ciVotRemoveOpcion    = ciVotRemoveOpcion;
window.ciVotar              = ciVotar;
window.ciConfirmarVoto      = ciConfirmarVoto;
window.ciConfirmarVotacion  = ciConfirmarVotacion;
window.ciConfirmar          = ciConfirmar;
window.ciAbrirProgramado    = ciAbrirProgramado;
window.ciCerrarProgramado   = ciCerrarProgramado;
window.ciEnviarProgramado   = ciEnviarProgramado;
window.ciAbrirTarea         = ciAbrirTarea;
window.ciCerrarTarea        = ciCerrarTarea;
window.ciEnviarTarea        = ciEnviarTarea;
window.ciCompletarTarea     = ciCompletarTarea;
window.ciTareaUpdateCount   = ciTareaUpdateCount;
window.ciSelPrio            = ciSelPrio;
window.ciDpToggle           = ciDpToggle;
window.ciDpPrevMonth        = ciDpPrevMonth;
window.ciDpNextMonth        = ciDpNextMonth;
window.ciDpSelectDay        = ciDpSelectDay;
window.ciDpClear            = ciDpClear;
window.ciDpConfirm          = ciDpConfirm;
window.ciPdpPrevMonth       = ciPdpPrevMonth;
window.ciPdpNextMonth       = ciPdpNextMonth;
window.ciCrearPrivado       = ciCrearPrivado;
window.ciCerrarNuevoPrivado = ciCerrarNuevoPrivado;