// ── ASISTENTE VIRTUAL INTERNO — HEAVENSY ──
// Secretaria asistente para usuarios con empresa activa en el SPA

(function() {
  var STORAGE_KEY = 'hva_msgs';
  var QR_KEY      = 'hva_qr_hidden';

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

    // Toggle
    function toggleChat() {
      _isOpen = !_isOpen;
      bubble.classList.toggle('open', _isOpen);
      panel.classList.toggle('open', _isOpen);
      if (_isOpen && input) setTimeout(function(){ input.focus(); }, 280);
      if (_isOpen) scrollToBottom();
    }

    bubble.addEventListener('click', toggleChat);
    if (closeBtn) closeBtn.addEventListener('click', toggleChat);

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
