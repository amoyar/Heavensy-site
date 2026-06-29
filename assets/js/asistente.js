// ── ASISTENTE VIRTUAL INTERNO — HEAVENSY ──
// Secretaria asistente para usuarios con empresa activa en el SPA
//
// ── BITÁCORA ──
// [v2026.06.29-1] asistente.js
// 2026-06-29 | La burbuja ahora se puede ARRASTRAR (recuerda posición en localStorage),
//   OCULTAR (botón × al pasar el mouse) y REABRIR (pestaña en el borde derecho). El panel
//   de chat se reposiciona pegado a la burbuja donde quede. Todo inyectado desde el JS,
//   sin tocar index.html. Click vs arrastre se distingue por umbral de 5px.

(function() {
  var STORAGE_KEY = 'hva_msgs';
  var QR_KEY      = 'hva_qr_hidden';
  var POS_KEY     = 'hva_pos';            // posición de la burbuja (arrastre)
  var HIDDEN_KEY  = 'hva_bubble_hidden';  // burbuja oculta por el usuario

  var _msgs    = [];
  var _isOpen  = false;

  // ── RESPUESTAS INTERNAS ──
  var _respuestas = {
    'conversaci': 'Las conversaciones se gestionan desde el menú lateral 💬. Filtra por canal (WhatsApp, Instagram, etc.), revisa los no leídos y responde directamente. También puedes ver el historial completo de cada contacto. ¿Tienes alguna duda específica?',
    'embudo':     'Los embudos te ayudan a organizar contactos por etapa de venta 🎯. Ve a <strong>Embudos</strong>, crea columnas y arrastra contactos. Puedes enviar mensajes grupales a toda una columna con un clic. ¿Quieres saber cómo crear un embudo?',
    'funnel':     'Los embudos te ayudan a organizar contactos por etapa de venta 🎯. Ve a <strong>Embudos</strong>, crea columnas y arrastra contactos. Puedes enviar mensajes grupales a toda una columna con un clic.',
    'agenda':     'Desde <strong>Agenda</strong> puedes ver y gestionar todas tus citas 📅. Configura tu disponibilidad horaria en <strong>Configuración → Horarios</strong>. Los clientes pueden agendar directamente desde tu perfil público. ¿Necesitas ayuda con algo específico?',
    'cita':       'Para crear una cita manual, ve a <strong>Agenda</strong> y haz clic en el día y hora deseados 📅. También puedes agendar desde la vista de conversación del contacto. ¿Te ayudo con algo más?',
    'seguimiento':'El seguimiento te permite llevar fichas clínicas o de cliente detalladas 📋. Accede desde el menú → <strong>Seguimiento</strong>, busca el contacto y registra evoluciones, notas y adjuntos. ¿En qué módulo necesitas ayuda?',
    'contacto':   'Los contactos se crean automáticamente cuando alguien te escribe por primera vez 👤. Desde la conversación puedes ver su ficha, agregar notas, tags y asignarlo a embudos. ¿Qué necesitas hacer con un contacto?',
    'mensaje':    'Puedes enviar mensajes masivos desde <strong>Mensajes</strong> en el menú 📤. Selecciona destinatarios, escribe el mensaje, adjunta archivos y envía. También puedes programar envíos para más tarde. ¿Necesitas ayuda con algún envío?',
    'masivo':     'Los mensajes masivos se envían desde la sección <strong>Mensajes</strong> 📤. Puedes filtrar por tags, embudos o canales para segmentar bien a tus destinatarios.',
    'configuraci':'En <strong>Configuración</strong> ajustas el perfil de tu empresa, horarios de atención, respuestas automáticas del bot y más ⚙️. También puedes integrar Google Calendar. ¿Qué aspecto quieres configurar?',
    'bot':        'Tu asistente IA se configura desde <strong>Configuración → Bot</strong> 🤖. Puedes personalizar el tono, agregar conocimientos específicos de tu empresa y definir cuándo el bot toma el control de la conversación.',
    'calendario': 'El calendario muestra todas tus citas y eventos 📆. Puedes integrarlo con Google Calendar desde <strong>Configuración → Integraciones</strong> para mantener todo sincronizado.',
    'plan':       'Puedes ver y cambiar tu plan desde <strong>Mi Perfil</strong> → haz clic en el lápiz junto a "Plan activo" 💎. Allí encontrarás las opciones con sus características y precios. ¿Quieres que te explique las diferencias entre planes?',
    'pago':       'Los pagos y suscripciones se gestionan desde <strong>Mi Perfil → Plan activo</strong> 💳. Si tienes un problema con un cobro, escríbenos a pagos@heavensy.cl y lo resolvemos.',
    'notificaci': 'Las notificaciones aparecen en el ícono de campana en la barra superior 🔔. Puedes configurar qué notificaciones recibir desde <strong>Configuración → Notificaciones</strong>.',
    'dashboard':  'El dashboard muestra un resumen de tu actividad: conversaciones recientes, citas del día, contactos nuevos y métricas clave 📊. Los datos se actualizan en tiempo real.',
    'perfil':     'Desde <strong>Mi Perfil</strong> puedes actualizar tus datos, cambiar tu foto, contraseña y ver el historial de servicios 👤. Los cambios de email requieren verificación por código.',
    'hola':       '¡Hola! 👋 ¿En qué te puedo ayudar hoy? Puedo orientarte con conversaciones, embudos, agenda, seguimiento, mensajes masivos o configuración.',
    'gracias':    '¡Con gusto! 😊 Estoy aquí siempre que lo necesites. ¿Hay algo más en lo que pueda ayudarte?',
    'default':    'Entendido 😊 Puedo ayudarte con: conversaciones, embudos, agenda, seguimiento, contactos, mensajes masivos, configuración y planes. ¿Sobre qué te gustaría saber más?'
  };

  function _getResponse(text) {
    var lower = text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
    for (var key in _respuestas) {
      if (key !== 'default' && lower.includes(key)) return _respuestas[key];
    }
    return _respuestas['default'];
  }

  // ── INIT ──
  function init() {
    _msgs = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');

    var bubble = document.getElementById('hva-bubble');
    var panel  = document.getElementById('hva-panel');
    var input  = document.getElementById('hva-input');
    var sendBtn= document.getElementById('hva-send');
    var closeBtn=document.getElementById('hva-close');
    var qrWrap = document.getElementById('hva-quick');

    if (!bubble || !panel) return;

    // ── Posicionar el panel pegado a la burbuja (siga donde siga) ──
    function positionPanel() {
      var b = bubble.getBoundingClientRect();
      var pw = panel.offsetWidth || 340;
      var ph = panel.offsetHeight || 480;
      var gap = 12;
      var left = b.right - pw;            // alinear a la derecha de la burbuja
      var top  = b.top - ph - gap;        // preferir arriba de la burbuja
      if (top < 8) top = b.bottom + gap;  // si no cabe arriba, ponerlo abajo
      if (left < 8) left = 8;
      if (left + pw > window.innerWidth  - 8) left = window.innerWidth  - pw - 8;
      if (top  + ph > window.innerHeight - 8) top  = window.innerHeight - ph - 8;
      if (top < 8) top = 8;
      panel.style.left = left + 'px';
      panel.style.top = top + 'px';
      panel.style.right = 'auto';
      panel.style.bottom = 'auto';
    }

    // Toggle
    function toggleChat() {
      _isOpen = !_isOpen;
      bubble.classList.toggle('open', _isOpen);
      panel.classList.toggle('open', _isOpen);
      if (_isOpen) positionPanel();
      if (_isOpen && input) setTimeout(function(){ input.focus(); }, 280);
      if (_isOpen) scrollToBottom();
    }

    // ── Envolver la burbuja para arrastrarla y ocultarla (sin tocar el HTML) ──
    var wrap = document.createElement('div');
    wrap.className = 'hva-wrap';
    bubble.parentNode.insertBefore(wrap, bubble);
    wrap.appendChild(bubble);

    // Botón ocultar (×) — aparece al pasar el mouse por la burbuja
    var hideBtn = document.createElement('button');
    hideBtn.type = 'button';
    hideBtn.className = 'hva-hide-btn';
    hideBtn.title = 'Ocultar asistente';
    hideBtn.setAttribute('aria-label', 'Ocultar asistente');
    hideBtn.innerHTML = '&times;';
    wrap.appendChild(hideBtn);

    // Pestaña para volver a mostrar la burbuja
    var reopen = document.createElement('button');
    reopen.type = 'button';
    reopen.className = 'hva-reopen';
    reopen.title = 'Mostrar secretaria virtual';
    reopen.setAttribute('aria-label', 'Mostrar secretaria virtual');
    reopen.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
    document.body.appendChild(reopen);

    // ── Posición guardada ──
    function applyPos(left, top) {
      wrap.style.left = left + 'px';
      wrap.style.top = top + 'px';
      wrap.style.right = 'auto';
      wrap.style.bottom = 'auto';
    }
    try {
      var savedPos = JSON.parse(localStorage.getItem(POS_KEY) || 'null');
      if (savedPos && typeof savedPos.left === 'number') applyPos(savedPos.left, savedPos.top);
    } catch (e) {}

    // ── Arrastre ──
    var dragging = false, moved = false, sx = 0, sy = 0, ox = 0, oy = 0;
    function dragDown(e) {
      if (e.button != null && e.button !== 0) return;
      var pt = e.touches ? e.touches[0] : e;
      var r = wrap.getBoundingClientRect();
      sx = pt.clientX; sy = pt.clientY; ox = r.left; oy = r.top;
      dragging = true; moved = false;
      document.addEventListener('mousemove', dragMove);
      document.addEventListener('mouseup', dragUp);
      document.addEventListener('touchmove', dragMove, { passive: false });
      document.addEventListener('touchend', dragUp);
    }
    function dragMove(e) {
      if (!dragging) return;
      var pt = e.touches ? e.touches[0] : e;
      var dx = pt.clientX - sx, dy = pt.clientY - sy;
      if (!moved && (Math.abs(dx) + Math.abs(dy)) > 5) moved = true;
      if (!moved) return;
      if (e.cancelable) e.preventDefault();
      var sz = wrap.offsetWidth || 52;
      var nl = Math.max(4, Math.min(window.innerWidth  - sz - 4, ox + dx));
      var nt = Math.max(4, Math.min(window.innerHeight - sz - 4, oy + dy));
      applyPos(nl, nt);
      if (_isOpen) positionPanel();
    }
    function dragUp() {
      document.removeEventListener('mousemove', dragMove);
      document.removeEventListener('mouseup', dragUp);
      document.removeEventListener('touchmove', dragMove);
      document.removeEventListener('touchend', dragUp);
      dragging = false;
      if (moved) {
        var r = wrap.getBoundingClientRect();
        localStorage.setItem(POS_KEY, JSON.stringify({ left: r.left, top: r.top }));
      }
    }
    wrap.addEventListener('mousedown', dragDown);
    wrap.addEventListener('touchstart', dragDown, { passive: true });

    // Click en la burbuja: abre el chat SOLO si no hubo arrastre
    bubble.addEventListener('click', function (e) {
      if (moved) { e.preventDefault(); e.stopPropagation(); return; }
      toggleChat();
    });
    if (closeBtn) closeBtn.addEventListener('click', toggleChat);

    // ── Ocultar / mostrar ──
    function hideBubble() {
      if (_isOpen) toggleChat();
      wrap.classList.add('hva-hidden');
      reopen.classList.add('show');
      localStorage.setItem(HIDDEN_KEY, '1');
    }
    function showBubble() {
      wrap.classList.remove('hva-hidden');
      reopen.classList.remove('show');
      localStorage.removeItem(HIDDEN_KEY);
    }
    hideBtn.addEventListener('mousedown', function (e) { e.stopPropagation(); });
    hideBtn.addEventListener('click', function (e) { e.stopPropagation(); hideBubble(); });
    reopen.addEventListener('click', showBubble);
    if (localStorage.getItem(HIDDEN_KEY) === '1') {
      wrap.classList.add('hva-hidden');
      reopen.classList.add('show');
    }

    // Al redimensionar: mantener la burbuja dentro de la pantalla y reubicar el panel
    window.addEventListener('resize', function () {
      var r = wrap.getBoundingClientRect();
      var sz = wrap.offsetWidth || 52;
      if (wrap.style.left) {
        applyPos(
          Math.max(4, Math.min(window.innerWidth  - sz - 4, r.left)),
          Math.max(4, Math.min(window.innerHeight - sz - 4, r.top))
        );
      }
      if (_isOpen) positionPanel();
    });

    // Cargar historial
    var msgsEl = document.getElementById('hva-messages');
    if (_msgs.length > 0) {
      msgsEl.innerHTML = '';
      _msgs.forEach(function(m){ _addMsg(m.text, m.sender, true); });
      if (localStorage.getItem(QR_KEY) === '1' && qrWrap) qrWrap.style.display = 'none';
    } else {
      // Mensaje de bienvenida
      setTimeout(function(){
        _addMsg('¡Hola! Soy tu secretaria virtual ✨ Estoy aquí para orientarte con cualquier duda sobre Heavensy. ¿En qué te puedo ayudar hoy?', 'bot', false);
      }, 600);
    }

    // Enviar
    function send(text) {
      if (!text || !text.trim()) return;
      if (qrWrap) { qrWrap.style.display = 'none'; localStorage.setItem(QR_KEY,'1'); }
      _addMsg(text, 'user', false);
      if (input) input.value = '';
      if (sendBtn) sendBtn.disabled = true;
      _showTyping();
      var delay = 900 + Math.random() * 700;
      setTimeout(function(){
        _removeTyping();
        _addMsg(_getResponse(text), 'bot', false);
        if (sendBtn) sendBtn.disabled = false;
      }, delay);
    }

    if (sendBtn) sendBtn.addEventListener('click', function(){ send(input.value); });
    if (input) {
      input.addEventListener('keydown', function(e){ if (e.key === 'Enter') send(input.value); });
      input.addEventListener('input', function(){ if (sendBtn) sendBtn.disabled = !input.value.trim(); });
      if (sendBtn) sendBtn.disabled = true;
    }

    // Quick replies
    window.hvaSendQR = function(el, text) {
      el.disabled = true;
      send(text);
    };
  }

  function _addMsg(text, sender, skipSave) {
    var msgsEl = document.getElementById('hva-messages');
    if (!msgsEl) return;
    var time = new Date().toLocaleTimeString('es', { hour:'2-digit', minute:'2-digit' });
    var div = document.createElement('div');
    div.className = 'hva-msg ' + sender;
    if (sender === 'bot') {
      div.innerHTML =
        '<div class="hva-msg-avatar"><i class="fas fa-star" style="font-size:12px"></i></div>' +
        '<div><div class="hva-msg-bubble">' + text + '</div><div class="hva-msg-time">' + time + '</div></div>';
    } else {
      div.innerHTML =
        '<div><div class="hva-msg-bubble">' + text + '</div><div class="hva-msg-time">' + time + '</div></div>';
    }
    msgsEl.appendChild(div);
    scrollToBottom();
    if (!skipSave) {
      _msgs.push({ text: text, sender: sender });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(_msgs));
    }
  }

  function _showTyping() {
    var msgsEl = document.getElementById('hva-messages');
    if (!msgsEl) return;
    var div = document.createElement('div');
    div.className = 'hva-typing'; div.id = 'hva-typing-ind';
    div.innerHTML =
      '<div class="hva-msg-avatar"><i class="fas fa-star" style="font-size:12px"></i></div>' +
      '<div class="hva-typing-dots"><span></span><span></span><span></span></div>';
    msgsEl.appendChild(div);
    scrollToBottom();
  }

  function _removeTyping() {
    var t = document.getElementById('hva-typing-ind');
    if (t) t.remove();
  }

  function scrollToBottom() {
    var msgsEl = document.getElementById('hva-messages');
    if (msgsEl) msgsEl.scrollTop = msgsEl.scrollHeight;
  }

  // Esperar a que el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();