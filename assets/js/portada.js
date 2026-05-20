function cerrarSesionPortada() {
  localStorage.clear();
  sessionStorage.clear();
  window.location.href = 'portada.html';
}

function toggleHvNav() {
  var user = document.querySelector('.hv-nav-user');
  var dd = document.getElementById('hv-user-dropdown');
  var open = !dd.classList.contains('open');
  dd.classList.toggle('open', open);
  user.classList.toggle('open', open);
}
document.addEventListener('click', function(e) {
  if (!e.target.closest('.hv-nav-user-wrap')) {
    var dd = document.getElementById('hv-user-dropdown');
    if (dd) dd.classList.remove('open');
    var u = document.querySelector('.hv-nav-user');
    if (u) u.classList.remove('open');
  }
});

// Mostrar nav según sesión
(function() {
  var token      = localStorage.getItem('token');
  var linkPlanes = document.getElementById('nav-link-planes');
  var btnLogin   = document.getElementById('nav-btn-login');
  var userWrap   = document.getElementById('nav-user-wrap');

  if (token) {
    if (linkPlanes) linkPlanes.style.display = 'none';
    if (btnLogin)   btnLogin.style.display   = 'none';
    if (userWrap)   userWrap.style.display    = 'flex';
  } else {
    if (linkPlanes) linkPlanes.style.display = '';
    if (btnLogin)   btnLogin.style.display   = '';
    if (userWrap)   userWrap.style.display    = 'none';
  }
})();

(function() {
  const btn = document.getElementById('chatBubbleBtn');
  const panel = document.getElementById('chatPanel');
  const closeBtn = document.getElementById('chatCloseBtn');
  const input = document.getElementById('chatInput');
  const sendBtn = document.getElementById('chatSendBtn');
  const messagesEl = document.getElementById('chatMessages');
  const quickRepliesEl = document.getElementById('quickReplies');

  // Toggle chat
  function toggleChat() {
    const isOpen = panel.classList.toggle('open');
    btn.classList.toggle('open', isOpen);
    if (isOpen) {
      setTimeout(() => input.focus(), 300);
      scrollToBottom();
    }
  }

  btn.addEventListener('click', toggleChat);
  closeBtn.addEventListener('click', toggleChat);

  // Auto-open after 4s with a greeting (only once)
  setTimeout(() => {
    if (!panel.classList.contains('open')) {
      toggleChat();
    }
  }, 4000);

  function scrollToBottom() {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function getTime() {
    return new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
  }

  let chatMsgs = JSON.parse(localStorage.getItem('hv_chat_msgs') || '[]');

  function addMessage(text, sender, skipSave) {
    const msg = document.createElement('div');
    msg.className = 'msg ' + sender;
    if (sender === 'bot') {
      msg.innerHTML = `
        <div class="msg-avatar">H</div>
        <div>
          <div class="msg-bubble">${text}</div>
          <span class="msg-time">${getTime()}</span>
        </div>`;
    } else {
      msg.innerHTML = `
        <div>
          <div class="msg-bubble">${text}</div>
          <span class="msg-time">${getTime()}</span>
        </div>`;
    }
    messagesEl.appendChild(msg);
    scrollToBottom();
    if (!skipSave) {
      chatMsgs.push({ text: text, sender: sender });
      localStorage.setItem('hv_chat_msgs', JSON.stringify(chatMsgs));
    }
  }

  // Load saved messages from localStorage
  (function loadSavedMsgs() {
    if (chatMsgs.length > 0) {
      messagesEl.innerHTML = '';
      chatMsgs.forEach(function(m) { addMessage(m.text, m.sender, true); });
      if (localStorage.getItem('hv_chat_qr_hidden') === '1') {
        quickRepliesEl.style.display = 'none';
      }
    }
  })();

  function showTyping() {
    const typing = document.createElement('div');
    typing.className = 'typing-indicator';
    typing.id = 'typingIndicator';
    typing.innerHTML = `
      <div class="msg-avatar" style="width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,#8E89E8,#5E75BE);display:flex;align-items:center;justify-content:center;font-size:.8rem;color:#fff;flex-shrink:0;">H</div>
      <div class="typing-dots"><span></span><span></span><span></span></div>`;
    messagesEl.appendChild(typing);
    scrollToBottom();
  }

  function removeTyping() {
    const t = document.getElementById('typingIndicator');
    if (t) t.remove();
  }

  // Bot responses map
  const responses = {
    'cómo funciona': '¡Genial pregunta! 🚀 Heavensy es una plataforma que conecta emprendedores con una red de aliados y herramientas de gestión. En 3 pasos: te registras, configuras tu perfil y empiezas a expandir tu red. ¿Te gustaría saber más sobre algún paso?',
    'planes': '💎 Tenemos planes para cada etapa:\n\n• <strong>Starter</strong> — gratis, ideal para comenzar\n• <strong>Pro</strong> — para escalar tu red\n• <strong>Enterprise</strong> — solución completa\n\n¿Te explico en detalle alguno?',
    'precios': '💎 Tenemos planes para cada etapa:\n\n• <strong>Starter</strong> — gratis, ideal para comenzar\n• <strong>Pro</strong> — para escalar tu red\n• <strong>Enterprise</strong> — solución completa\n\n¿Te explico en detalle alguno?',
    'unirme': '¡Nos encantaría tenerte en Heavensy! 🎉 El proceso es muy sencillo:\n\n1. Haz clic en <strong>"Empezar gratis"</strong>\n2. Completa tu perfil\n3. Conecta con tu primera red\n\n¿Tienes alguna pregunta antes de comenzar?',
    'resultados': '📊 Nuestros miembros reportan en promedio:\n\n• +70% en ganancias el primer año\n• 28 hrs ahorradas por semana\n• Red de +190 aliados activos\n\nComo Sofía M. de Colombia que creció un 81%. ¿Quieres ver más casos?',
    'default': '¡Gracias por tu mensaje! 😊 Un miembro de nuestro equipo te responderá muy pronto. También puedes escribirnos directamente por WhatsApp para una respuesta más rápida. ¿Hay algo más en lo que pueda ayudarte?'
  };

  function getBotResponse(text) {
    const lower = text.toLowerCase();
    for (const key of Object.keys(responses)) {
      if (key !== 'default' && lower.includes(key)) {
        return responses[key];
      }
    }
    return responses['default'];
  }

  function sendMessage(text) {
    if (!text.trim()) return;

    // Hide quick replies after first user message
    quickRepliesEl.style.display = 'none';
    localStorage.setItem('hv_chat_qr_hidden', '1');

    addMessage(text, 'user');
    input.value = '';
    sendBtn.disabled = true;

    showTyping();
    const delay = 1000 + Math.random() * 800;
    setTimeout(() => {
      removeTyping();
      addMessage(getBotResponse(text), 'bot');
      sendBtn.disabled = false;
    }, delay);
  }

  // Send on button click
  sendBtn.addEventListener('click', () => sendMessage(input.value));

  // Send on Enter
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendMessage(input.value);
  });

  // Enable/disable send button
  input.addEventListener('input', () => {
    sendBtn.disabled = input.value.trim().length === 0;
  });
  sendBtn.disabled = true;

  // Quick reply handler
  window.sendQuickReply = function(el, text) {
    el.disabled = true;
    sendMessage(text);
  };

})();

(function () {
  var DURATION = 85000; // ms para un ciclo completo (igual que antes)
  var img = new Image();
  img.src = '../assets/img/aurorazul4.jpg.jpeg';
  var isPaused = false;
  var offset   = 0;
  var lastTime = null;
  var section, grid, cards, gridLeft, cardYBase;

  function initBgDivs() {
    cards.forEach(function (card) {
      if (card.querySelector('.card-aurora-bg')) return;
      var bg = document.createElement('div');
      bg.className = 'card-aurora-bg';
      card.insertBefore(bg, card.firstChild);
    });
  }

  function animate(ts) {
    // — Mover el carrusel —
    if (lastTime !== null && !isPaused) {
      var dt       = ts - lastTime;
      var halfW    = grid.scrollWidth / 2;          // ancho de un set de cards
      offset       = (offset + halfW * dt / DURATION) % halfW;
      grid.style.transform = 'translateX(-' + offset + 'px)';
    }
    lastTime = ts;

    // — Calcular tamaño cover de la imagen sobre la sección —
    var sr = section.getBoundingClientRect();
    var bgW, bgH;
    if (img.naturalWidth && img.naturalHeight) {
      var ia = img.naturalWidth / img.naturalHeight;
      var sa = sr.width / sr.height;
      if (ia > sa) { bgH = sr.height; bgW = bgH * ia; }
      else         { bgW = sr.width;  bgH = bgW / ia; }
    } else {
      bgW = sr.width; bgH = sr.height;
    }
    var ox = (sr.width  - bgW) / 2;
    var oy = (sr.height - bgH) / 2;

    // — Actualizar fondo de cada card + efecto luz central en icono —
    var sectionCenterX = sr.left + sr.width / 2;
    var maxDist = sr.width * 0.42;
    cards.forEach(function (card) {
      var bg = card.querySelector('.card-aurora-bg');
      if (!bg) return;
      var cardX = card.offsetLeft - offset + gridLeft;
      var cardY = card.offsetTop  + cardYBase;
      bg.style.backgroundSize     = bgW + 'px ' + bgH + 'px';
      bg.style.backgroundPosition = (ox - cardX + 40) + 'px ' + (oy - cardY + 40) + 'px';

      // Intensidad de luz según distancia al centro (curva coseno suave)
      var cardScreenCenterX = sr.left + cardX + card.offsetWidth / 2;
      var dist = Math.abs(cardScreenCenterX - sectionCenterX);
      var t = Math.max(0, Math.cos(Math.min(dist / maxDist, 1) * Math.PI / 2));
      t = Math.pow(t, 1.5); // afinar la curva: más rápido en los bordes

      var emoji = card.querySelector('.rubro-emoji');
      if (!emoji) return;
      // Interpolar color base #82A8FF → blanco puro
      var r = Math.round(130 + 125 * t);
      var g = Math.round(168 + 87  * t);
      var b = 255;
      emoji.style.color = 'rgb(' + r + ',' + g + ',' + b + ')';
      // Glow proporcional a la intensidad
      if (t > 0.02) {
        var s1 = (7 * t).toFixed(1);
        var s2 = (16 * t).toFixed(1);
        var a1 = (0.75 * t).toFixed(2);
        var a2 = (0.45 * t).toFixed(2);
        emoji.style.filter = 'drop-shadow(0 0 ' + s1 + 'px rgba(160,195,255,' + a1 + ')) drop-shadow(0 0 ' + s2 + 'px rgba(110,160,255,' + a2 + '))';
      } else {
        emoji.style.filter = 'none';
      }
    });

    requestAnimationFrame(animate);
  }

  function init() {
    section  = document.querySelector('.para-quien');
    grid     = section.querySelector('.rubros-grid');
    cards    = section.querySelectorAll('.rubro-card');

    // En mobile: solo agregar fondos, sin animación de movimiento
    if (window.innerWidth <= 768) {
      initBgDivs();
      return;
    }

    // Posición estática del grid y su contenedor dentro de la sección
    gridLeft  = grid.offsetLeft;
    var el = grid.offsetParent;
    while (el && el !== section) { gridLeft += el.offsetLeft; el = el.offsetParent; }
    cardYBase = grid.offsetTop;
    el = grid.offsetParent;
    while (el && el !== section) { cardYBase += el.offsetTop; el = el.offsetParent; }

    initBgDivs();
    grid.addEventListener('mouseenter', function () { isPaused = true; });
    grid.addEventListener('mouseleave', function () { isPaused = false; });
    requestAnimationFrame(animate);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

/* ── CLOUDS CANVAS + SKY PARALLAX ── */
(function () {
  var skyEl  = document.getElementById('sky-bg');
  var canvas = document.getElementById('cloud-canvas');
  var ctx    = canvas.getContext('2d');
  var W, H;

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', function () { resize(); buildClouds(); });

  /* ── Generador de nubes ── */
  function rnd(a, b) { return a + Math.random() * (b - a); }

  // Cada nube: lista de "puffs" (gradiente radial), posición, velocidad parallax
  var layerDefs = [
    { n:5,  speedY:0.80, sMin:20,  sMax:38,  opMin:0.12, opMax:0.22 }, // muy lejanas
    { n:4,  speedY:1.00, sMin:30,  sMax:52,  opMin:0.18, opMax:0.30 }, // medias
    { n:3,  speedY:1.25, sMin:38,  sMax:62,  opMin:0.22, opMax:0.36 }, // menos lejanas
  ];

  var clouds = [];

  function buildCloud(layer) {
    var base = rnd(layer.sMin, layer.sMax);
    var puffs = [];
    var numTops = Math.round(rnd(6, 11));

    // ── Base plana inferior (ellipse achatada) ──
    puffs.push({ ox:0, oy: base*0.18, rx: base*2.1, ry: base*0.55, base: true });

    // ── Cuerpo central: varios puffs solapados ──
    var bodyCount = Math.round(rnd(4, 7));
    for (var i = 0; i < bodyCount; i++) {
      var t = i / (bodyCount - 1);
      puffs.push({
        ox: (t - 0.5) * base * rnd(2.8, 3.6),
        oy: rnd(-base*0.1, base*0.15),
        r:  base * rnd(0.75, 1.05),
        body: true
      });
    }

    // ── Cúpulas superiores (montículos) ──
    for (var j = 0; j < numTops; j++) {
      var a = (j / (numTops - 1)) * Math.PI;
      var spread = base * rnd(1.6, 2.5);
      puffs.push({
        ox:  Math.cos(a) * spread,
        oy: -Math.abs(Math.sin(a)) * base * rnd(0.5, 1.0) - base * 0.1,
        r:   base * rnd(0.38, 0.72),
        top: true
      });
    }

    // ── Sombra volumétrica interior (base azul-gris) ──
    puffs.push({ ox: base*0.1, oy: base*0.25, r: base*1.5, shadow: true });

    return {
      x:      rnd(-200, W + 200),
      baseY:  rnd(H * 0.1, (document.body.scrollHeight || H * 4) * 0.70),
      opacity: rnd(layer.opMin, layer.opMax),
      speedY:  layer.speedY,
      driftV:  rnd(-0.012, 0.012),
      puffs:   puffs,
    };
  }

  function buildClouds() {
    clouds = [];
    layerDefs.forEach(function (layer) {
      for (var i = 0; i < layer.n; i++) {
        clouds.push(buildCloud(layer));
      }
    });
  }
  // Esperar a que la página esté cargada para tener la altura real
  if (document.readyState === 'complete') {
    buildClouds();
  } else {
    window.addEventListener('load', buildClouds);
  }

  /* ── Dibujar una nube ── */
  function drawCloud(c, scrollY) {
    var cy = c.baseY - scrollY * c.speedY;
    // desvanece nubes que se acercan al borde inferior de pantalla
    var fadeStart = H * 0.60;
    var fadeEnd   = H * 0.80;
    var fadeFactor = cy < fadeStart ? 1 : cy > fadeEnd ? 0 : 1 - (cy - fadeStart) / (fadeEnd - fadeStart);
    if (fadeFactor <= 0) return;
    ctx.save();
    ctx.globalAlpha = c.opacity * fadeFactor;

    c.puffs.forEach(function (p) {
      var px = c.x + p.ox;
      var py = cy  + p.oy;
      var grd;

      if (p.shadow) {
        // Sombra volumétrica interior: azul-gris, muy difuminada
        grd = ctx.createRadialGradient(px, py + p.r*0.1, p.r*0.1, px, py, p.r);
        grd.addColorStop(0,   'rgba(160,185,220,0.28)');
        grd.addColorStop(0.5, 'rgba(160,185,220,0.12)');
        grd.addColorStop(1,   'rgba(160,185,220,0)');
        ctx.beginPath();
        ctx.arc(px, py, p.r, 0, Math.PI*2);
        ctx.fillStyle = grd;
        ctx.fill();

      } else if (p.base) {
        // Base plana: ellipse achatada blanco-grisácea
        ctx.save();
        ctx.scale(1, p.ry / p.rx);
        var bpx = px, bpy = (py) * (p.rx / p.ry);
        grd = ctx.createRadialGradient(bpx, bpy, p.rx*0.05, bpx, bpy, p.rx);
        grd.addColorStop(0,   'rgba(230,240,255,0.85)');
        grd.addColorStop(0.6, 'rgba(220,233,252,0.45)');
        grd.addColorStop(1,   'rgba(210,228,250,0)');
        ctx.beginPath();
        ctx.arc(bpx, bpy, p.rx, 0, Math.PI*2);
        ctx.fillStyle = grd;
        ctx.fill();
        ctx.restore();

      } else if (p.body) {
        // Cuerpo: blanco puro con borde suavísimo
        grd = ctx.createRadialGradient(px, py - p.r*0.2, p.r*0.05, px, py, p.r);
        grd.addColorStop(0,   'rgba(255,255,255,0.85)');
        grd.addColorStop(0.4, 'rgba(255,255,255,0.65)');
        grd.addColorStop(0.7, 'rgba(240,248,255,0.3)');
        grd.addColorStop(1,   'rgba(225,240,255,0)');
        ctx.beginPath();
        ctx.arc(px, py, p.r, 0, Math.PI*2);
        ctx.fillStyle = grd;
        ctx.fill();

      } else if (p.top) {
        // Cúpulas: blanco brillante en el centro, borde translúcido
        grd = ctx.createRadialGradient(px, py - p.r*0.25, p.r*0.04, px, py, p.r);
        grd.addColorStop(0,   'rgba(255,255,255,0.80)');
        grd.addColorStop(0.4, 'rgba(250,252,255,0.55)');
        grd.addColorStop(0.75,'rgba(235,245,255,0.25)');
        grd.addColorStop(1,   'rgba(220,237,255,0)');
        ctx.beginPath();
        ctx.arc(px, py, p.r, 0, Math.PI*2);
        ctx.fillStyle = grd;
        ctx.fill();
      }
    });

    ctx.restore();
  }

  /* ── Loop de animación ── */
  var scrollY = 0;
  var smoothY = 0;
  window.addEventListener('scroll', function () { scrollY = window.scrollY; }, { passive: true });

  var lastTs = null;
  function animate(ts) {
    var dt = lastTs ? Math.min(ts - lastTs, 50) : 16;
    lastTs = ts;
    ctx.clearRect(0, 0, W, H);

    // lerp muy sutil — sigue el scroll casi instantáneo pero con leve suavidad
    smoothY += (scrollY - smoothY) * 0.03;

    var maxScroll = document.body.scrollHeight - window.innerHeight;
    var rawPct = smoothY / Math.max(1, maxScroll);
    var pct = 20 + Math.pow(rawPct, 3) * 80;
    skyEl.style.backgroundPositionY = pct + '%';

    clouds.forEach(function (c) {
      // deriva horizontal muy suave
      c.x += c.driftV;
      // wrap
      if (c.x >  W + 400) c.x = -400;
      if (c.x < -400)     c.x =  W + 400;

      drawCloud(c, smoothY);
    });


    requestAnimationFrame(animate);
  }
  requestAnimationFrame(function(ts){ lastTs = ts; requestAnimationFrame(animate); });

})();

/* ── SHOOTING STAR on steps line ── */
(function() {
  var stepsEl = document.querySelector('.steps');
  if (!stepsEl) return;

  var stepNums = stepsEl.querySelectorAll('.step-num');
  var glowMem = [0, 0, 0]; // stored glow per number, decays slowly
  var cv = document.createElement('canvas');
  cv.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:0;';
  stepsEl.style.position = 'relative';
  stepsEl.appendChild(cv);

  var DURATION = 4200; // ms per cycle — longer to allow pause after reaching 3
  var TAIL = 180;      // px tail length
  var start = null;

  function drawStar(ctx, hx, hy, ts, progress, isMobile) {
    // Fade in/out at ends
    var alpha = 1;
    if (progress < 0.06) alpha = progress / 0.06;
    if (progress > 0.93) alpha = (1 - progress) / 0.07;
    ctx.globalAlpha = alpha;

    var TAIL = 180;

    if (isMobile) {
      // ── Vertical tail (going downward) ──
      var tailY = hy - TAIL;
      var grad = ctx.createLinearGradient(hx, tailY, hx, hy);
      grad.addColorStop(0,    'rgba(148,151,244,0)');
      grad.addColorStop(0.3,  'rgba(160,170,255,0.18)');
      grad.addColorStop(0.65, 'rgba(190,210,255,0.55)');
      grad.addColorStop(0.88, 'rgba(230,240,255,0.92)');
      grad.addColorStop(1,    'rgba(255,255,255,0)');
      ctx.beginPath();
      ctx.moveTo(hx, tailY);
      ctx.lineTo(hx, hy);
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Head glow — elongated vertically
      ctx.save();
      ctx.translate(hx, hy);
      ctx.scale(1, 3.5);
      var glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 9);
      glow.addColorStop(0,   'rgba(255,255,255,0.95)');
      glow.addColorStop(0.3, 'rgba(210,225,255,0.5)');
      glow.addColorStop(0.65,'rgba(148,151,244,0.2)');
      glow.addColorStop(1,   'rgba(148,151,244,0)');
      ctx.beginPath();
      ctx.arc(0, 0, 9, 0, Math.PI * 2);
      ctx.fillStyle = glow;
      ctx.fill();
      ctx.restore();

      // Core
      var core = ctx.createRadialGradient(hx, hy, 0, hx, hy, 3);
      core.addColorStop(0, 'rgba(255,255,255,1)');
      core.addColorStop(1, 'rgba(200,220,255,0)');
      ctx.beginPath();
      ctx.arc(hx, hy, 3, 0, Math.PI * 2);
      ctx.fillStyle = core;
      ctx.fill();

      // Sparkle rays — vertical direction
      var sparkle = progress < 0.05 ? progress / 0.05 : progress > 0.92 ? (1 - progress) / 0.08 : 1;
      var pulse = 0.7 + 0.3 * Math.sin(ts * 0.018);
      var rays = [
        [1, 0, 14], [-1, 0, 14],   // left/right
        [0, 1, 22], [0, -1, 10],   // down (along travel) / up (shorter)
        [0.7, 0.7, 8], [-0.7, 0.7, 8], [0.7, -0.7, 8], [-0.7, -0.7, 8]
      ];
      rays.forEach(function(r) {
        var dx = r[0], dy = r[1], len = r[2] * pulse;
        var rg = ctx.createLinearGradient(hx, hy, hx + dx*len, hy + dy*len);
        rg.addColorStop(0,   'rgba(255,255,255,' + (0.95 * sparkle) + ')');
        rg.addColorStop(0.4, 'rgba(200,220,255,' + (0.5 * sparkle) + ')');
        rg.addColorStop(1,   'rgba(148,151,244,0)');
        ctx.beginPath();
        ctx.moveTo(hx, hy);
        ctx.lineTo(hx + dx*len, hy + dy*len);
        ctx.strokeStyle = rg;
        ctx.lineWidth = r[2] > 10 ? 1.5 : 1;
        ctx.stroke();
      });

    } else {
      // ── Horizontal tail (going rightward) ──
      var tailX = hx - TAIL;
      var grad = ctx.createLinearGradient(tailX, hy, hx, hy);
      grad.addColorStop(0,    'rgba(148,151,244,0)');
      grad.addColorStop(0.3,  'rgba(160,170,255,0.18)');
      grad.addColorStop(0.65, 'rgba(190,210,255,0.55)');
      grad.addColorStop(0.88, 'rgba(230,240,255,0.92)');
      grad.addColorStop(1,    'rgba(255,255,255,0)');
      ctx.beginPath();
      ctx.moveTo(tailX, hy);
      ctx.lineTo(hx, hy);
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Head glow — elongated horizontally
      ctx.save();
      ctx.translate(hx, hy);
      ctx.scale(3.5, 1);
      var glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 9);
      glow.addColorStop(0,   'rgba(255,255,255,0.95)');
      glow.addColorStop(0.3, 'rgba(210,225,255,0.5)');
      glow.addColorStop(0.65,'rgba(148,151,244,0.2)');
      glow.addColorStop(1,   'rgba(148,151,244,0)');
      ctx.beginPath();
      ctx.arc(0, 0, 9, 0, Math.PI * 2);
      ctx.fillStyle = glow;
      ctx.fill();
      ctx.restore();

      // Core
      var core = ctx.createRadialGradient(hx, hy, 0, hx, hy, 3);
      core.addColorStop(0, 'rgba(255,255,255,1)');
      core.addColorStop(1, 'rgba(200,220,255,0)');
      ctx.beginPath();
      ctx.arc(hx, hy, 3, 0, Math.PI * 2);
      ctx.fillStyle = core;
      ctx.fill();

      // Sparkle rays — horizontal direction
      var sparkle = progress < 0.05 ? progress / 0.05 : progress > 0.92 ? (1 - progress) / 0.08 : 1;
      var pulse = 0.7 + 0.3 * Math.sin(ts * 0.018);
      var rays = [
        [0, 1, 14], [0, -1, 14],
        [1, 0, 22], [-1, 0, 10],
        [0.7, 0.7, 8], [-0.7, 0.7, 8], [0.7, -0.7, 8], [-0.7, -0.7, 8]
      ];
      rays.forEach(function(r) {
        var dx = r[0], dy = r[1], len = r[2] * pulse;
        var rg = ctx.createLinearGradient(hx, hy, hx + dx*len, hy + dy*len);
        rg.addColorStop(0,   'rgba(255,255,255,' + (0.95 * sparkle) + ')');
        rg.addColorStop(0.4, 'rgba(200,220,255,' + (0.5 * sparkle) + ')');
        rg.addColorStop(1,   'rgba(148,151,244,0)');
        ctx.beginPath();
        ctx.moveTo(hx, hy);
        ctx.lineTo(hx + dx*len, hy + dy*len);
        ctx.strokeStyle = rg;
        ctx.lineWidth = r[2] > 10 ? 1.5 : 1;
        ctx.stroke();
      });
    }

    ctx.globalAlpha = 1;
  }

  function draw(ts) {
    if (!start) start = ts;
    var elapsed = (ts - start) % DURATION;
    var travelFraction = 0.72;
    var rawProgress = elapsed / DURATION;
    var progress = Math.min(rawProgress / travelFraction, 1);
    var inTravel = rawProgress < travelFraction;

    var W = cv.offsetWidth;
    var H = cv.offsetHeight;
    cv.width  = W;
    cv.height = H;

    var ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, W, H);

    var isMobile = window.innerWidth <= 768;

    // ── Calcular posición del head ──
    var headX, headY, stepPositions;

    if (isMobile) {
      // Vertical: estrella baja por el centro, pasando por cada step-num
      var stepsRect = stepsEl.getBoundingClientRect();
      stepPositions = Array.from(stepNums).map(function(num) {
        var r = num.getBoundingClientRect();
        return r.top + r.height / 2 - stepsRect.top;
      });
      headX = W / 2;
      headY = stepPositions[0] + (stepPositions[stepPositions.length - 1] - stepPositions[0]) * progress;
    } else {
      // Horizontal: estrella viaja de izquierda a derecha
      var lineY = 29;
      var x1 = W * 0.1666 + 16;
      var x2 = W * 0.8333 - 16;
      var lineW = x2 - x1;
      headX = x1 + lineW * progress;
      headY = lineY;
      stepPositions = [x1, x1 + lineW * 0.5, x2];
    }

    // ── Glow en los números ──
    stepNums.forEach(function(num, i) {
      var dist = isMobile
        ? Math.abs(headY - stepPositions[i])
        : Math.abs(headX - stepPositions[i]);
      var proximity = Math.max(0, 1 - dist / 38);
      proximity = Math.min(proximity, 0.65);
      if (inTravel && proximity > glowMem[i]) {
        glowMem[i] = proximity;
      } else {
        glowMem[i] = Math.max(0, glowMem[i] - 0.012);
      }
      var g = glowMem[i];
      if (g > 0.01) {
        num.style.boxShadow =
          '0 4px 16px rgba(20,30,90,0.5), ' +
          '0 0 ' + Math.round(10*g) + 'px ' + Math.round(4*g) + 'px rgba(148,151,244,' + (0.7*g) + '), ' +
          '0 0 ' + Math.round(20*g) + 'px ' + Math.round(7*g) + 'px rgba(137,185,248,' + (0.4*g) + ')';
        num.style.transform = 'scale(' + (1 + 0.04*g) + ')';
      } else {
        num.style.boxShadow = '0 4px 16px rgba(20,30,90,0.5)';
        num.style.transform = 'scale(1)';
      }
    });

    // ── Pausar entre ciclos ──
    if (!inTravel) {
      requestAnimationFrame(draw);
      return;
    }

    drawStar(ctx, headX, headY, ts, progress, isMobile);
    requestAnimationFrame(draw);
  }

  window.addEventListener('load', function() {
    requestAnimationFrame(draw);
  });
})();

(function() {
const section = document.querySelector('.members');
  if (!section) return;

  // Mark cards as ready (hidden) only after DOM is loaded
  const allCards = section.querySelectorAll('.member-card');
  allCards.forEach(function(c) { c.classList.add('anim-ready'); });

  let triggered = false;
  const obs = new IntersectionObserver(function(entries) {
    if (triggered) return;
    if (!entries[0].isIntersecting) return;
    triggered = true;
    obs.disconnect();

    const cards = section.querySelectorAll('.member-card');
    cards.forEach(function(card, i) {
      setTimeout(function() {
        card.classList.remove('anim-ready');
        card.classList.add('anim-visible');
      }, i * 200);
    });
  }, { threshold: 0.15 });

  obs.observe(section);
})();

(function() {
  var cards   = Array.from(document.querySelectorAll('.member-slider .mcn-card'));
  var dots    = Array.from(document.querySelectorAll('.slider-dot'));
  if (!cards.length) return;
  var current = 0;
  var busy    = false;

function show(idx, dir) {
    if (busy) return;
    busy = true;
    var next = (idx + cards.length) % cards.length;
    if (next === current) { busy = false; return; }

    var exitClass  = dir > 0 ? 'exit-left'   : 'exit-right';
    var enterClass = dir > 0 ? 'enter-right'  : 'enter-left';

    var outCard = cards[current];
    var inCard  = cards[next];

    // Step 1: exit current card
    outCard.classList.add(exitClass);

    outCard.addEventListener('animationend', function onOut() {
      outCard.removeEventListener('animationend', onOut);
      outCard.style.display = 'none';
      outCard.classList.remove(exitClass);
      dots[current].classList.remove('active');
      current = next;
      dots[current].classList.add('active');

      // Step 2: enter next card immediately after
      inCard.style.display = 'flex';
      inCard.classList.add(enterClass);
      inCard.addEventListener('animationend', function onIn() {
        inCard.removeEventListener('animationend', onIn);
        inCard.classList.remove(enterClass);
        busy = false;
      });
    });
  }

  cards[0].style.display = 'flex';

  document.getElementById('ms-prev').addEventListener('click', function() { show(current - 1, -1); });
  document.getElementById('ms-next').addEventListener('click', function() { show(current + 1,  1); });
  dots.forEach(function(d) {
    d.addEventListener('click', function() {
      var idx = parseInt(d.dataset.idx);
      show(idx, idx > current ? 1 : -1);
    });
  });

  // Make slider container relative for absolute positioning during transition
  var slider = document.querySelector('.member-slider');
  if (slider) slider.style.position = 'relative';
})();
