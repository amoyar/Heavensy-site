// ── MODO PREVIEW (dentro de iframe) ──
(function() {
  if (window.self === window.top) return;
  document.documentElement.classList.add('in-preview');
  // Bloquear navegación: interceptar todos los clicks en <a>
  document.addEventListener('click', function(e) {
    var a = e.target.closest('a');
    if (a) { e.preventDefault(); e.stopPropagation(); }
  }, true);
  // Bloquear botones que naveguen (formularios, etc.)
  document.addEventListener('submit', function(e) { e.preventDefault(); }, true);
})();

// ── NAV STATE ──
(function() {
  var token      = localStorage.getItem('token');
  var linkPlanes = document.getElementById('nav-link-planes');
  var btnLogin   = document.getElementById('nav-btn-login');
  var userWrap   = document.getElementById('nav-user-wrap');
  if (token) {
    if (linkPlanes) linkPlanes.style.display = 'none';
    if (btnLogin)   btnLogin.style.display   = 'none';
    if (userWrap)   userWrap.style.display   = 'flex';
    var name = localStorage.getItem('user_name') || localStorage.getItem('username') || 'Usuario';
    var usernameEl = document.getElementById('nav-username');
    var avatarEl   = document.getElementById('nav-avatar');
    if (usernameEl) usernameEl.textContent = name;
    if (avatarEl)   avatarEl.textContent   = name.charAt(0).toUpperCase();
  } else {
    if (linkPlanes) linkPlanes.style.display = '';
    if (btnLogin)   btnLogin.style.display   = '';
    if (userWrap)   userWrap.style.display   = 'none';
  }
})();

function toggleHvNav() {
  var user = document.querySelector('.hv-nav-user');
  var dd   = document.getElementById('hv-user-dropdown');
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


// ── ESTADO GLOBAL ──
var _carReal = 0;
var _carTotal = 0;
var _carPaused = false;
var _carPos = 0;
var _carLastTime = null;
var _carRaf = null;
var _carImgW = 0;
var _progNombreActual = '';
var _progIdx = 0;
var _commentAnonimo = false;

// ── RENDER PROGRAMA (sin reload) ──
function renderProg(prog, idx) {
  if (!prog) return;
  idx = idx || 0;

  // Reset secciones opcionales
  ['prog-modulos-wrap','prog-includes-wrap','prog-requisitos-wrap',
   'prog-media-wrap','prog-galeria-wrap','cupos-wrap'].forEach(function(id) {
    var el = document.getElementById(id); if (el) el.style.display = 'none';
  });
  var oldBtn = document.querySelector('.btn-ver-todo-temario');
  if (oldBtn) oldBtn.remove();
  if (_carRaf) { cancelAnimationFrame(_carRaf); _carRaf = null; }

  // Hero
  var hero = document.getElementById('prog-hero');
  if (hero) {
    if (prog.img) {
      hero.style.background = prog.color || 'linear-gradient(135deg,#9497F4,#89B9F8)';
      hero.style.backgroundImage = 'url(' + prog.img + ')';
      hero.style.backgroundSize = 'cover';
      var pos = prog.imgPosition || {x:50, y:50};
      hero.style.backgroundPosition = pos.x + '% ' + pos.y + '%';
    } else {
      hero.style.backgroundImage = '';
      hero.style.backgroundPosition = '50% 50%';
      hero.style.background = prog.color || 'linear-gradient(135deg,#9497F4,#89B9F8)';
    }
  }
  var titleEl = document.getElementById('prog-title');
  if (titleEl) {
    titleEl.textContent = prog.nombre || '';
    titleEl.style.fontFamily = prog.tituloFont ? ("'" + prog.tituloFont + "', sans-serif") : '';
    titleEl.style.fontSize   = prog.tituloSize  ? (prog.tituloSize + 'px') : '';
  }
  _progNombreActual = prog.nombre || '';

  // Colores
  if (prog.bgColor)     { document.documentElement.style.setProperty('--bg', prog.bgColor); document.body.style.background = prog.bgColor; }
  if (prog.colorNavy)   document.documentElement.style.setProperty('--navy',    prog.colorNavy);
  if (prog.colorText)   document.documentElement.style.setProperty('--text',    prog.colorText);
  if (prog.colorTextLt) document.documentElement.style.setProperty('--text-lt', prog.colorTextLt);
  if (prog.btnStart && prog.btnEnd) document.documentElement.style.setProperty('--btn', 'linear-gradient(90deg,' + prog.btnStart + ' 0%,' + prog.btnEnd + ' 100%)');
  if (prog.cardOpacity !== undefined) applyCardOpacity(prog.cardOpacity);
  if (prog.tipo) applyProgTipo(prog.tipo); else applyProgTipo('');
  var chipEl = document.getElementById('prog-tipo-chip');
  if (chipEl) {
    chipEl.textContent = prog.tipo || '';
    chipEl.style.display = prog.tipo ? '' : 'none';
  }

  // Descripción
  applyDesc(prog.desc || '');

  // Precio
  var precioEl = document.getElementById('prog-precio');
  if (precioEl) precioEl.textContent = prog.precio || '—';
  var precioLabelEl = document.getElementById('prog-precio-label');
  if (precioLabelEl) precioLabelEl.textContent = prog.precioTipo === 'mensual' ? 'Precio mensual' : 'Inversión total';

  // Meta → info grid
  var meta   = prog.meta || '';
  var partes = meta.split('·').map(function(s){ return s.trim(); });
  var encMatch = meta.match(/(\d+)\s*encuentros?/i);
  var durMatch = meta.match(/de\s+(\d+\s+\S+)/i);
  var encuentros = encMatch ? encMatch[1] : '—';
  var duracion   = durMatch ? durMatch[1].trim() : '—';
  var FREQ_NICE  = {'Diaria':'Diaria','Lun-Vie':'Lun — Vie','Fin de semana':'Fines de semana','1 vez/sem':'1 vez por semana','2 veces/sem':'2 veces por semana','3 veces/sem':'3 veces por semana','Quincenal':'Quincenal','Mensual':'Mensual'};
  var frecuencia = partes.length >= 3 ? (FREQ_NICE[partes[1]] || partes[1]) : '';
  var modalidad  = partes[partes.length - 1] || '—';
  var ieEl = document.getElementById('info-encuentros'); if (ieEl) ieEl.textContent = encuentros !== '—' ? encuentros + ' sesiones' : '—';
  var idEl = document.getElementById('info-duracion');   if (idEl) idEl.textContent = duracion;
  var ifEl = document.getElementById('info-frecuencia'); if (ifEl) ifEl.textContent = frecuencia || '—';
  var imEl = document.getElementById('info-modalidad');  if (imEl) imEl.textContent = modalidad;

  // Creador
  var c = prog.creador;
  if (c) {
    var avatarEl = document.getElementById('creator-avatar');
    var badgeEl  = null; // badge eliminado
    var nameEl   = document.getElementById('creator-name');
    var specsEl  = document.getElementById('creator-specs');
    var expWrap  = document.getElementById('creator-exp');
    var expTxt   = document.getElementById('creator-exp-txt');
    if (nameEl)  nameEl.textContent  = c.nombre || '—';
    if (specsEl) specsEl.textContent = c.especialidad || '';
    if (badgeEl) badgeEl.textContent = c.tipo === 'empresa' ? 'Empresa' : 'Profesional';
    if (c.foto && avatarEl) {
      avatarEl.innerHTML = '<img src="' + c.foto + '" alt="' + (c.nombre||'') + '">';
    } else if (avatarEl) {
      avatarEl.textContent = (c.nombre || '?').trim().split(' ').map(function(w){ return w[0]; }).slice(0,2).join('').toUpperCase();
    }
    if (c.experiencia && parseInt(c.experiencia) > 0) {
      if (expWrap) expWrap.style.display = 'flex';
      if (expTxt)  expTxt.textContent    = c.experiencia;
    }
  }

  // Galería
  if (prog.galeria && prog.galeria.length > 0) {
    var gWrap = document.getElementById('prog-galeria-wrap');
    if (gWrap) gWrap.style.display = '';
    carouselInit(prog.galeria, prog.galeriaOri || 'h');
  }

  // Requisitos
  if (prog.requisitos && prog.requisitos.length > 0) {
    var rWrap = document.getElementById('prog-requisitos-wrap');
    var rList = document.getElementById('prog-requisitos-list-view');
    if (rWrap) rWrap.style.display = '';
    if (rList) rList.innerHTML = prog.requisitos.map(function(r){ return '<li>' + r + '</li>'; }).join('');
  }

  // Qué incluye
  if (prog.includes && prog.includes.length > 0) {
    var incWrap = document.getElementById('prog-includes-wrap');
    var incList = document.getElementById('prog-includes-list-view');
    if (incWrap) incWrap.style.display = '';
    if (incList) {
      incList.innerHTML = prog.includes.map(function(item) {
        var icoClass = item.icono && item.icono.includes('fab') ? 'fab ' + item.icono.replace(' fab','').trim() : 'fas ' + item.icono;
        return '<div class="include-item"><div class="include-icon"><i class="' + icoClass + '"></i></div><span class="include-text">' + item.texto + '</span></div>';
      }).join('');
    }
  }

  // Módulos
  if (prog.modulos && prog.modulos.length > 0) {
    var mWrapM = document.getElementById('prog-modulos-wrap');
    var mList  = document.getElementById('prog-modulos-list-view');
    if (mWrapM) mWrapM.style.display = '';
    if (mList) {
      var MAX_V = 8;
      mList.innerHTML = prog.modulos.slice(0, MAX_V).map(function(m, i) {
        return '<div class="modulo-item"><div class="modulo-bubble">' + (i+1) + '</div><div class="modulo-content"><div class="modulo-ttl">' + (m.titulo||'') + '</div>' + (m.desc ? '<div class="modulo-dsc">' + m.desc + '</div>' : '') + '</div></div>';
      }).join('');
      if (prog.modulos.length > MAX_V) {
        var btnVT = document.createElement('button');
        btnVT.className = 'btn-ver-todo-temario';
        btnVT.innerHTML = '<i class="fas fa-list-ol"></i> Ver todo el temario (' + prog.modulos.length + ')';
        btnVT.onclick = (function(mods){ return function(){ abrirModalTemario(mods); }; })(prog.modulos);
        mList.parentElement.appendChild(btnVT);
      }
    }
  }

  // Media
  var mImgEl   = document.getElementById('prog-media-img');
  var mVidWrap = document.getElementById('prog-media-video-wrap');
  var mFrame   = document.getElementById('prog-media-iframe');
  var mVideoEl = document.getElementById('prog-media-video');
  if (mImgEl)   mImgEl.style.display   = 'none';
  if (mVidWrap) mVidWrap.style.display = 'none';
  if (mVideoEl) mVideoEl.style.display = 'none';
  if (mFrame)   mFrame.src             = '';
  if (prog.media) {
    var mWrapMedia = document.getElementById('prog-media-wrap');
    if (mWrapMedia) mWrapMedia.style.display = '';
    if (prog.media.tipo === 'imagen') {
      if (mImgEl) { mImgEl.src = prog.media.src; mImgEl.style.display = 'block'; }
    } else if (prog.media.tipo === 'video_file') {
      if (mVideoEl) { mVideoEl.src = prog.media.src; mVideoEl.style.display = 'block'; }
    } else if (prog.media.tipo === 'video') {
      var embedUrl = progVideoEmbed(prog.media.src);
      if (embedUrl && mFrame && mVidWrap) { mFrame.src = embedUrl; mVidWrap.style.display = 'block'; }
    }
  }

  // Cupos
  if (prog.mostrarCupos && prog.cupos) {
    var cuposTotal  = parseInt(prog.cupos) || 0;
    var tomados     = parseInt(localStorage.getItem('cupos_tomados_' + idx) || '0');
    var disponibles = Math.max(0, cuposTotal - tomados);
    var cuposWrap = document.getElementById('cupos-wrap');
    var cuposNum  = document.getElementById('cupos-num');
    if (cuposWrap) cuposWrap.style.display = '';
    if (cuposNum)  cuposNum.textContent = disponibles > 0 ? disponibles + (disponibles === 1 ? ' cupo' : ' cupos') : 'Sin cupos disponibles';
    var btnRes = document.getElementById('btn-reservar');
    if (btnRes && disponibles === 0) {
      btnRes.style.opacity = '0.5'; btnRes.style.pointerEvents = 'none';
      btnRes.innerHTML = '<i class="fas fa-times-circle"></i>Sin cupos disponibles';
    }
  }
}

// ── IIFE — carga inicial ──
(function() {
  var params    = new URLSearchParams(window.location.search);
  var isPreview = params.get('preview') === '1';
  var idx       = parseInt(params.get('idx') || '0', 10);
  var prog      = isPreview
    ? JSON.parse(localStorage.getItem('ep_prog_preview') || 'null')
    : JSON.parse(localStorage.getItem('ep_programas') || '[]')[idx];

  if (!prog) {
    var t = document.getElementById('prog-title');
    if (t) t.textContent = isPreview ? 'Abre el formulario para previsualizar' : 'Programa no encontrado';
    return;
  }

  _progIdx = idx;
  renderProg(prog, idx);

  // Share URL
  var shareInput = document.getElementById('share-url');
  if (shareInput) shareInput.value = window.location.href;

  // Reseñas
  renderComentarios(idx);
  var token  = localStorage.getItem('token');
  var pagado = localStorage.getItem('prog_pagado_' + idx) || localStorage.getItem('hv_prog_reserva');
  if (token && pagado) {
    var btnWrap = document.getElementById('prog-comment-btn-wrap');
    if (btnWrap) btnWrap.style.display = '';
  } else if (token && !pagado) {
    var noMsg = document.getElementById('prog-no-pago-msg');
    if (noMsg) noMsg.style.display = '';
  }
})();

function carouselInit(imgs, ori) {
  _carTotal = imgs.length;
  _carReal  = 0;
  var track = document.getElementById('car-track');
  var dots  = document.getElementById('car-dots');
  var wrap  = document.querySelector('.carousel-track-wrap');
  if (!track) return;

  // Aplicar orientación al contenedor
  if (wrap) {
    wrap.style.aspectRatio = ori === 'v' ? '3/4' : '16/9';
  }
  track.style.transition = 'none';

  // Clones: último al principio, primero al final
  var all = [imgs[imgs.length - 1]].concat(imgs).concat([imgs[0]]);
  track.innerHTML = all.map(function(src) {
    return '<img src="' + src + '" alt="" style="object-fit:' + (ori==='v'?'contain':'cover') + '">';
  }).join('');

  // Dots (solo imágenes reales)
  if (dots) dots.innerHTML = imgs.map(function(_, i) {
    return '<div class="carousel-dot' + (i===0?' active':'') + '" onclick="carouselGo(' + i + ')"></div>';
  }).join('');

  // Iniciar loop RAF
  if (_carRaf) cancelAnimationFrame(_carRaf);
  _carImgW = 0; _carPos = 0; _carPaused = false; _carLastTime = null;
  _carRaf = requestAnimationFrame(carouselTick);
  // Pausar al hover/touch (una sola vez por instancia del DOM)
  var carWrap = document.querySelector('.carousel-wrap');
  if (carWrap && !carWrap._carListened) {
    carWrap._carListened = true;
    carWrap.addEventListener('mouseenter', function() { _carPaused = true; });
    carWrap.addEventListener('mouseleave', function() { _carPaused = false; _carLastTime = null; });
    carWrap.addEventListener('touchstart', function() { _carPaused = true; }, {passive:true});
    carWrap.addEventListener('touchend', function() { _carPaused = false; _carLastTime = null; });
  }
}

function carouselTick(ts) {
  var track = document.getElementById('car-track');
  var wrap  = document.querySelector('.carousel-track-wrap');
  if (!track || !wrap) { _carRaf = requestAnimationFrame(carouselTick); return; }
  var imgW = wrap.clientWidth;
  if (imgW <= 0) { _carRaf = requestAnimationFrame(carouselTick); return; }
  if (_carImgW === 0) {
    _carImgW = imgW;
    _carPos  = imgW; // absIdx 1 = primera imagen real
  } else {
    _carImgW = imgW; // actualiza al redimensionar
  }
  if (!_carPaused) {
    if (_carLastTime !== null) {
      var delta = ts - _carLastTime;
      _carPos += (_carImgW / 5000) * delta; // 1 imagen cada 5 s
    }
    _carLastTime = ts;
  } else {
    _carLastTime = null;
  }
  // Loop sin corte: al llegar al clon final, salta al inicio real
  if (_carPos >= (_carTotal + 1) * _carImgW) _carPos -= _carTotal * _carImgW;
  track.style.transition = 'none';
  track.style.transform  = 'translateX(-' + _carPos + 'px)';
  // Actualizar dot activo
  var absIdx = Math.round(_carPos / _carImgW);
  _carReal = ((absIdx - 1) % _carTotal + _carTotal) % _carTotal;
  document.querySelectorAll('.carousel-dot').forEach(function(d, i) {
    d.classList.toggle('active', i === _carReal);
  });
  _carRaf = requestAnimationFrame(carouselTick);
}

function carouselMove(dir) {
  if (!_carImgW) return;
  var absIdx = Math.round(_carPos / _carImgW) + dir;
  if (absIdx <= 0)            absIdx += _carTotal;
  if (absIdx >= _carTotal + 1) absIdx -= _carTotal;
  _carPos = absIdx * _carImgW;
  _carLastTime = null;
}

function carouselGo(realIdx) {
  if (!_carImgW) return;
  _carReal = realIdx;
  _carPos  = (realIdx + 1) * _carImgW;
  _carLastTime = null;
}

// ── COMPARTIR ──
function copiarLink() {
  var url = document.getElementById('share-url')?.value || window.location.href;
  navigator.clipboard.writeText(url).then(function() {
    mostrarToastProg('¡Link copiado!', '#10b981');
    var btn = document.getElementById('btn-copy-link');
    if (btn) { btn.innerHTML = '<i class="fas fa-check"></i> Copiado'; setTimeout(function(){ btn.innerHTML = '<i class="fas fa-copy"></i> Copiar link'; }, 2000); }
  }).catch(function() {
    document.getElementById('share-url')?.select();
    document.execCommand('copy');
    mostrarToastProg('¡Link copiado!', '#10b981');
  });
}

function compartirWA() {
  var params = new URLSearchParams(window.location.search);
  var idx    = params.get('idx') || '0';
  var progs  = JSON.parse(localStorage.getItem('ep_programas') || '[]');
  var prog   = progs[parseInt(idx)] || {};
  var url    = window.location.href;
  var msg    = encodeURIComponent('¡Mira este programa: *' + (prog.nombre||'Programa') + '*! 🌟\n' + url);
  document.getElementById('btn-share-wa').href = 'https://wa.me/?text=' + msg;
}

// ── RESEÑAS ──
var _commentStars = 5;

function renderComentarios(idx) {
  var comments = JSON.parse(localStorage.getItem('prog_comments_' + idx) || '[]');
  var list  = document.getElementById('prog-comments-list');
  var empty = document.getElementById('prog-comments-empty');
  if (!list) return;
  if (comments.length === 0) { if (empty) empty.style.display = ''; list.innerHTML = ''; return; }
  if (empty) empty.style.display = 'none';
  var isOwner = !!localStorage.getItem('ep_programas');
  list.innerHTML = comments.map(function(c, i) {
    var esAnonimo = c.anonimo && !isOwner;
    var nombreMostrado = esAnonimo ? 'Anónimo' : (c.nombre || 'Usuario');
    var badgeAnonimo   = (c.anonimo && isOwner) ? '<span class="review-anon-badge">anónimo</span>' : '';
    var stars = '';
    for (var s = 1; s <= 5; s++) stars += s <= c.estrellas ? '★' : '☆';
    var avHtml = esAnonimo
      ? '<i class="fas fa-user-secret" style="font-size:16px;color:rgba(255,255,255,0.9)"></i>'
      : (c.foto ? '<img src="' + c.foto + '">' : nombreMostrado.charAt(0).toUpperCase());
    var fecha = c.fecha ? new Date(c.fecha).toLocaleDateString('es-CL', {day:'numeric',month:'long',year:'numeric'}) : '';
    var deleteBtn = isOwner
      ? '<button class="review-delete-btn" onclick="eliminarComentario(' + idx + ',' + i + ')" title="Eliminar reseña"><i class="fas fa-trash"></i></button>'
      : '';
    return '<div class="review-card">' +
      '<div class="review-av' + (esAnonimo ? ' review-av-anon' : '') + '">' + avHtml + '</div>' +
      '<div class="review-body">' +
        '<div class="review-header">' +
          '<span class="review-name">' + nombreMostrado + badgeAnonimo + '</span>' +
          '<div style="display:flex;align-items:center;gap:8px">' +
            '<span class="review-stars">' + stars + '</span>' +
            deleteBtn +
          '</div>' +
        '</div>' +
        '<p class="review-text">' + (c.texto || '') + '</p>' +
        '<div class="review-date">' + fecha + '</div>' +
      '</div>' +
    '</div>';
  }).join('');
}

function eliminarComentario(idx, commentIdx) {
  var comments = JSON.parse(localStorage.getItem('prog_comments_' + idx) || '[]');
  comments.splice(commentIdx, 1);
  localStorage.setItem('prog_comments_' + idx, JSON.stringify(comments));
  renderComentarios(idx);
  mostrarToastProg('Reseña eliminada', '#ef4444');
}

function abrirModalTemario(modulos) {
  var body = document.getElementById('temario-modal-body');
  if (body) {
    body.innerHTML = modulos.map(function(m, i) {
      return '<div class="modulo-item">' +
        '<div class="modulo-bubble">' + (i + 1) + '</div>' +
        '<div class="modulo-content">' +
          '<div class="modulo-ttl">' + (m.titulo || '') + '</div>' +
          (m.desc ? '<div class="modulo-dsc">' + m.desc + '</div>' : '') +
        '</div>' +
      '</div>';
    }).join('');
  }
  var overlay = document.getElementById('temario-overlay');
  if (overlay) overlay.classList.add('open');
}
function cerrarModalTemario() {
  var overlay = document.getElementById('temario-overlay');
  if (overlay) overlay.classList.remove('open');
}

function abrirFormComentario() {
  _commentStars = 5;
  _commentAnonimo = false;
  setCommentStar(5);
  document.getElementById('comment-text').value = '';
  document.getElementById('comment-chars').textContent = '0/300';
  var subEl = document.querySelector('#comment-overlay .otp-sub');
  if (subEl && _progNombreActual) subEl.textContent = 'Deja tu reseña sobre ' + _progNombreActual;
  var btn = document.getElementById('btn-anonimo');
  if (btn) btn.classList.remove('on');
  document.getElementById('comment-overlay').classList.add('open');
}

function toggleCommentAnonimo() {
  _commentAnonimo = !_commentAnonimo;
  var btn = document.getElementById('btn-anonimo');
  if (btn) btn.classList.toggle('on', _commentAnonimo);
}

function cerrarFormComentario() {
  document.getElementById('comment-overlay').classList.remove('open');
}

function setCommentStar(val) {
  _commentStars = val;
  document.querySelectorAll('.comment-star').forEach(function(s) {
    s.classList.toggle('on', parseInt(s.dataset.val) <= val);
  });
}

function enviarComentario() {
  var texto = document.getElementById('comment-text').value.trim();
  if (!texto) { document.getElementById('comment-text').focus(); return; }

  var params = new URLSearchParams(window.location.search);
  var idx = parseInt(params.get('idx') || '0');
  var nombre = localStorage.getItem('user_name') || localStorage.getItem('username') || 'Usuario';
  var foto   = localStorage.getItem('ep_foto') || '';

  var comments = JSON.parse(localStorage.getItem('prog_comments_' + idx) || '[]');
  comments.unshift({ nombre: nombre, foto: foto, estrellas: _commentStars, texto: texto, fecha: new Date().toISOString(), anonimo: _commentAnonimo });
  localStorage.setItem('prog_comments_' + idx, JSON.stringify(comments));

  cerrarFormComentario();
  renderComentarios(idx);
  mostrarToastProg('¡Reseña publicada!', '#10b981');

  // Marcar que tiene acceso (para futuras visitas)
  localStorage.setItem('prog_pagado_' + idx, '1');
  var btnWrap = document.getElementById('prog-comment-btn-wrap');
  if (btnWrap) btnWrap.style.display = '';
}

function mostrarToastProg(msg, color) {
  var t = document.getElementById('prog-toast');
  if (!t) return;
  t.style.background = color || '#10b981';
  document.getElementById('prog-toast-msg').textContent = msg;
  t.style.opacity = '1'; t.style.transform = 'translateY(0)';
  setTimeout(function() { t.style.opacity = '0'; t.style.transform = 'translateY(80px)'; }, 3000);
}

// ── EMBED VIDEO ──
function progVideoEmbed(url) {
  if (!url) return '';
  var ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  if (ytMatch) return 'https://www.youtube.com/embed/' + ytMatch[1] + '?rel=0&modestbranding=1';
  var vmMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vmMatch) return 'https://player.vimeo.com/video/' + vmMatch[1];
  return url; // fallback: URL directa
}

// ── RESERVAR CUPO ──
function tomarCupo(e) {
  e.preventDefault();
  var params    = new URLSearchParams(window.location.search);
  var idx       = parseInt(params.get('idx') || '0', 10);
  var programas = JSON.parse(localStorage.getItem('ep_programas') || '[]');
  var prog      = programas[idx];

  // Verificar cupos si están activos
  if (prog && prog.mostrarCupos && prog.cupos) {
    var storageKey  = 'cupos_tomados_' + idx;
    var tomados     = parseInt(localStorage.getItem(storageKey) || '0');
    var disponibles = Math.max(0, parseInt(prog.cupos) - tomados);
    if (disponibles <= 0) return false;
    localStorage.setItem(storageKey, tomados + 1);
  }

  // Guardar contexto del programa para pagar.html
  if (prog) {
    localStorage.setItem('hv_prog_reserva', JSON.stringify({ idx: idx, nombre: prog.nombre, precio: prog.precio }));
  }

  // Ir a registro con parámetro next=pagar
  window.location.href = 'perfil_personal.html?next=pagar&prog=' + idx;
  return false;
}

// ── DESCRIPCIÓN ──
function applyDesc(desc) {
  var el    = document.getElementById('prog-desc');
  var empty = document.getElementById('prog-desc-empty');
  if (!el) return;
  if (desc && desc.trim()) {
    el.textContent    = desc;
    el.style.display  = '';
    if (empty) empty.style.display = 'none';
  } else {
    el.textContent    = '';
    el.style.display  = 'none';
    if (empty) empty.style.display = '';
  }
}

// ── TIPO DE PROGRAMA — textos dinámicos ──
function applyProgTipo(tipo) {
  if (!tipo) return;
  var tl = tipo.toLowerCase();
  function setTtl(id, text) {
    var el = document.getElementById(id);
    if (!el) return;
    var icon = el.querySelector('i');
    el.textContent = text;
    if (icon) el.insertBefore(icon, el.firstChild);
  }
  setTtl('pd-ttl-desc',       'Descripción del ' + tl);
  setTtl('pd-ttl-detalles',   'Detalles del ' + tl);
  setTtl('pd-ttl-temario',    'Temario del ' + tl);
  setTtl('pd-ttl-incluye',    'Qué incluye el ' + tl);
  setTtl('pd-ttl-requisitos', 'Requisitos del ' + tl);
  setTtl('pd-ttl-compartir',  'Comparte este ' + tl);
  setTtl('pd-ttl-resenas',    'Reseñas de quienes han hecho el ' + tl);
}

// ── LIVE COLOR PREVIEW (postMessage desde configuración) ──
function applyCardOpacity(op) {
  document.documentElement.style.setProperty('--card-bg',     'rgba(255,255,255,' + op + ')');
  document.documentElement.style.setProperty('--card-border', 'rgba(200,210,240,' + Math.min(1, op + 0.28) + ')');
}
window.addEventListener('message', function(e) {
  if (!e.data) return;
  var d = e.data;
  // Actualización completa del programa (sin reload)
  if (d.type === 'prog_update' && d.prog) {
    renderProg(d.prog, _progIdx);
    return;
  }
  // Descripción en tiempo real (keystroke a keystroke)
  if (d.type === 'prog_desc') {
    applyDesc(d.desc || '');
    return;
  }
  // Actualización solo de colores (instantánea vía pickers)
  if (d.type === 'prog_colors') {
    if (d.bgColor)     { document.documentElement.style.setProperty('--bg', d.bgColor); document.body.style.background = d.bgColor; }
    if (d.colorNavy)   document.documentElement.style.setProperty('--navy',    d.colorNavy);
    if (d.colorText)   document.documentElement.style.setProperty('--text',    d.colorText);
    if (d.colorTextLt) document.documentElement.style.setProperty('--text-lt', d.colorTextLt);
    if (d.btnStart && d.btnEnd) document.documentElement.style.setProperty('--btn', 'linear-gradient(90deg,' + d.btnStart + ' 0%,' + d.btnEnd + ' 100%)');
    if (d.cardOpacity !== undefined) applyCardOpacity(d.cardOpacity);
    var titleEl = document.getElementById('prog-title');
    if (titleEl) {
      if (d.tituloFont) titleEl.style.fontFamily = "'" + d.tituloFont + "', sans-serif";
      if (d.tituloSize) titleEl.style.fontSize   = d.tituloSize + 'px';
    }
  }
});

// ── HERO DRAG (solo en modo preview) ──
(function() {
  if (!document.documentElement.classList.contains('in-preview')) return;
  var hero = document.getElementById('prog-hero');
  if (!hero) return;

  var isDragging = false, startX = 0, startY = 0, posX = 50, posY = 50;

  // Hint parpadeante (solo preview)
  var hint = document.createElement('div');
  hint.className = 'hero-drag-hint';
  hint.innerHTML = '<i class="fas fa-arrows-alt" style="margin-right:5px;font-size:10px"></i>Arrastra para ajustar';
  hint.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,.65);color:#fff;font-size:15px;font-weight:700;padding:12px 22px;border-radius:12px;pointer-events:none;font-family:"DM Sans",sans-serif;backdrop-filter:blur(6px);white-space:nowrap;display:none;letter-spacing:.3px';
  hero.appendChild(hint);

  function hasImage() { return hero.style.backgroundImage && hero.style.backgroundImage.includes('url('); }
  function showHint() { if (hasImage()) hint.style.display = ''; }

  function startDrag(x, y) {
    if (!hasImage()) return;
    isDragging = true; startX = x; startY = y;
    hero.style.cursor = 'grabbing';
    // Eliminar hint del DOM para siempre al primer click/drag
    if (hint.parentNode) hint.parentNode.removeChild(hint);
  }
  function moveDrag(x, y) {
    if (!isDragging) return;
    var dx = (x - startX) / hero.offsetWidth  * 100;
    var dy = (y - startY) / hero.offsetHeight * 100;
    startX = x; startY = y;
    posX = Math.max(0, Math.min(100, posX - dx));
    posY = Math.max(0, Math.min(100, posY - dy));
    hero.style.backgroundPosition = posX + '% ' + posY + '%';
    try { window.parent.postMessage({ type: 'hero_position', x: posX, y: posY }, '*'); } catch(e) {}
  }
  function endDrag() { isDragging = false; hero.style.cursor = 'grab'; hideHint(); }

  hero.addEventListener('mousedown', function(e) { startDrag(e.clientX, e.clientY); e.preventDefault(); });
  document.addEventListener('mousemove', function(e) { moveDrag(e.clientX, e.clientY); });
  document.addEventListener('mouseup', endDrag);
  hero.addEventListener('touchstart', function(e) { startDrag(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
  document.addEventListener('touchmove', function(e) { if (isDragging) moveDrag(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
  document.addEventListener('touchend', endDrag);

  // Mostrar hint cuando hay imagen (observer detecta cuando se asigna backgroundImage)
  function checkAndShowHint() { if (hasImage()) { hero.style.cursor = 'grab'; showHint(); } }
  setTimeout(checkAndShowHint, 700);
  new MutationObserver(function() { setTimeout(checkAndShowHint, 200); })
    .observe(hero, { attributes: true, attributeFilter: ['style'] });

  // Recibir posición inicial al cargar un programa con posición guardada
  window.addEventListener('message', function(e) {
    if (e.data && e.data.type === 'set_hero_position') {
      posX = e.data.x != null ? e.data.x : 50;
      posY = e.data.y != null ? e.data.y : 50;
      hero.style.backgroundPosition = posX + '% ' + posY + '%';
    }
  });
})();

// ── ASIDE STICKY SINCRONIZADO ──
(function() {
  var aside = document.querySelector('.prog-layout > aside');
  if (!aside) return;
  var NAV = 80;
  function syncAside() {
    var vh      = window.innerHeight;
    var asideH  = aside.offsetHeight;
    if (asideH + NAV <= vh) { aside.style.top = NAV + 'px'; return; }
    var pageH     = document.documentElement.scrollHeight;
    var scrollY   = window.scrollY;
    var maxScroll = Math.max(1, pageH - vh);
    var overflow  = asideH - (vh - NAV);
    var top       = NAV - (scrollY / maxScroll) * overflow;
    aside.style.top = Math.min(NAV, Math.max(vh - asideH, top)) + 'px';
  }
  window.addEventListener('scroll', syncAside, { passive: true });
  window.addEventListener('resize', syncAside);
  syncAside();
})();
