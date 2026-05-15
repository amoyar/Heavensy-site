// ── PERFIL PERSONAL INTERNO (SPA fragment) ──

var _PPI_API = 'https://heavensy-api-backend-v2.onrender.com';
var _ppiPendingEmail = '';
var _ppiPendingPwd   = '';

var _ppiSvcData      = [];
var _ppiSvcMostrados = 0;
var _ppiSvcPorPagina = 5;

var _ppiColores = ['#a78bfa','#60a5fa','#34d399','#f472b6','#fb923c','#4ade80','#f59e0b','#38bdf8'];

// ── INIT (llamado por el router) ──
function initPerfil_personal_internoPage() {
  _ppiSvcMostrados = 0;

  // Render rápido desde JWT
  var token = localStorage.getItem('token');
  if (token) {
    try {
      var p = JSON.parse(atob(token.split('.')[1]));
      _ppiRender({ full_name: p.full_name, email: p.email });
    } catch(e) {}
  }

  // Carga completa desde API
  _ppiCall('/api/profile').then(function(u) {
    if (u._ok) _ppiRender(u);
  }).catch(function() {});

  _ppiCargarServicios();
  _ppiInitOtpBoxes();
}

// ── API HELPER ──
function _ppiCall(path, opts) {
  opts = opts || {};
  var token = localStorage.getItem('token');
  var headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
  if (token) headers['Authorization'] = 'Bearer ' + token;
  return fetch(_PPI_API + path, Object.assign({}, opts, { headers: headers }))
    .then(function(r) {
      return r.json().then(function(d) { d._ok = r.ok; return d; });
    });
}

// ── RENDER PERFIL ──
function _ppiRender(u) {
  var nombre = u.full_name ||
    ((u.first_name || '') + ' ' + (u.last_name || '')).trim() || '—';

  var avatarIni = document.getElementById('ppi-avatar-ini');
  var avatarImg = document.getElementById('ppi-avatar-img');
  var nombreEl  = document.getElementById('ppi-nombre');
  var badgeEl   = document.getElementById('ppi-plan-badge');

  if (avatarIni) {
    var parts = nombre.trim().split(' ').filter(Boolean);
    avatarIni.textContent = (parts.length >= 2
      ? parts[0][0] + parts[1][0]
      : (parts[0] || 'U').substring(0, 2)
    ).toUpperCase();
  }
  if (avatarImg && u.foto_url) {
    avatarImg.src = u.foto_url;
    avatarImg.style.display = 'block';
    if (avatarIni) avatarIni.style.display = 'none';
  }
  if (nombreEl) nombreEl.textContent = nombre;

  if (badgeEl && !badgeEl.dataset.set) {
    var planLabels = {
      gratis:     { icon: 'fa-user',    label: 'Plan Gratis' },
      automate:   { icon: 'fa-robot',   label: 'Automate Pro' },
      secretaria: { icon: 'fa-headset', label: 'Secretaría Premium' },
      enterprise: { icon: 'fa-gem',     label: 'Enterprise' },
    };
    var pl = planLabels[u.plan || u.subscription_plan] || { icon: 'fa-star', label: 'Plan activo' };
    badgeEl.innerHTML =
      '<span class="ppi-plan-chip"><i class="fas ' + pl.icon + '" style="margin-right:4px"></i>' + pl.label + '</span>' +
      '<button onclick="ppiEditarPlan()" title="Cambiar plan" style="background:none;border:none;cursor:pointer;padding:2px 5px;margin-left:4px;color:#5b8dee;font-size:13px;vertical-align:middle;"><i class="fas fa-pen"></i></button>';
    badgeEl.dataset.set = '1';
  }

  var fn = document.getElementById('ppi-field-nombre');
  var fr = document.getElementById('ppi-field-rut');
  var em = document.getElementById('ppi-email');
  var te = document.getElementById('ppi-telefono');
  if (fn) fn.textContent = nombre || '—';
  if (fr) fr.textContent = u.rut || '—';
  if (em && !em.dataset.dirty) em.value = u.email || '';
  if (te) te.textContent = u.phone || '—';

  if (em) em.addEventListener('input', function() { em.dataset.dirty = '1'; }, { once: true });
}

// ── FOTO ──
function ppiCambiarFoto(input) {
  if (!input.files || !input.files[0]) return;
  var file = input.files[0];

  // Preview inmediato
  var reader = new FileReader();
  reader.onload = function(e) {
    var img = document.getElementById('ppi-avatar-img');
    var ini = document.getElementById('ppi-avatar-ini');
    img.src = e.target.result;
    img.style.display = 'block';
    if (ini) ini.style.display = 'none';
  };
  reader.readAsDataURL(file);

  // Subir al servidor
  var token = localStorage.getItem('token');
  var form = new FormData();
  form.append('file', file);
  form.append('modulo', 'profile');
  fetch(_PPI_API + '/api/media/upload', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token },
    body: form
  })
  .then(function(r) { return r.json(); })
  .then(function(d) {
    if (d.ok && d.url) {
      _ppiCall('/api/profile', { method: 'PUT', body: JSON.stringify({ foto_url: d.url }) })
        .catch(function() {});
    }
  })
  .catch(function() {});
}

// ── EDITAR PLAN ──
function ppiEditarPlan() {
  location.href = 'pages/planes_heavensy.html';
}

// ── OJO CONTRASEÑA ──
function ppiToggleEye() {
  var inp  = document.getElementById('ppi-password');
  var icon = document.getElementById('ppi-eye-icon');
  var show = inp.type === 'password';
  inp.type       = show ? 'text' : 'password';
  icon.className = show ? 'fas fa-eye-slash' : 'fas fa-eye';
}

function ppiToggleEye2() {
  var inp  = document.getElementById('ppi-password-confirm');
  var icon = document.getElementById('ppi-eye-icon2');
  var show = inp.type === 'password';
  inp.type       = show ? 'text' : 'password';
  icon.className = show ? 'fas fa-eye-slash' : 'fas fa-eye';
}

// ── GUARDAR → abre OTP ──
function ppiGuardar(btn) {
  _ppiPendingEmail = (document.getElementById('ppi-email').value || '').trim();
  _ppiPendingPwd   = (document.getElementById('ppi-password').value || '');
  var pwdConfirm   = (document.getElementById('ppi-password-confirm').value || '');

  if (!_ppiPendingEmail) { _ppiMsg('El email es obligatorio', false); return; }
  if (_ppiPendingPwd && _ppiPendingPwd !== pwdConfirm) { _ppiMsg('Las contraseñas no coinciden', false); return; }

  var orig = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin" style="margin-right:6px"></i>Enviando código…';

  _ppiCall('/api/auth/send-change-otp', {
    method: 'POST',
    body: JSON.stringify({ email: _ppiPendingEmail }),
  }).then(function() {
    btn.innerHTML = orig; btn.disabled = false;
    ppiAbrirOtp(_ppiPendingEmail);
  }).catch(function() {
    btn.innerHTML = orig; btn.disabled = false;
    ppiAbrirOtp(_ppiPendingEmail);
  });
}

// ── OTP ──
function ppiAbrirOtp(email) {
  var sub = document.getElementById('ppi-otp-sub');
  if (sub) sub.textContent = 'Ingresa el código de 5 dígitos que enviamos a ' + email + ' para confirmar el cambio.';
  document.querySelectorAll('.ppi-otp-box').forEach(function(b) { b.value = ''; b.classList.remove('filled'); });
  document.getElementById('ppi-otp-error').style.display = 'none';
  document.getElementById('ppi-otp-overlay').classList.add('open');
  setTimeout(function() { var b = document.querySelectorAll('.ppi-otp-box')[0]; if(b) b.focus(); }, 150);
}

function ppiCerrarOtp() {
  document.getElementById('ppi-otp-overlay').classList.remove('open');
}

function ppiVerificarOtp() {
  var codigo  = Array.from(document.querySelectorAll('.ppi-otp-box')).map(function(b) { return b.value; }).join('');
  var errorEl = document.getElementById('ppi-otp-error');

  if (codigo.length < 5) {
    errorEl.textContent = 'Ingresa los 5 dígitos del código.';
    errorEl.style.display = '';
    return;
  }

  var btn = document.getElementById('ppi-otp-btn-verify');
  var orig = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>Verificando…';

  _ppiCall('/api/auth/verify-change-otp', {
    method: 'POST',
    body: JSON.stringify({ email: _ppiPendingEmail, otp_code: codigo }),
  }).then(function(data) {
    if (data._ok || data.ok) { _ppiAplicarCambios(btn, orig, errorEl); }
    else { _ppiOtpError(btn, orig, errorEl, data.error || 'Código incorrecto. Intenta nuevamente.'); }
  }).catch(function() {
    _ppiAplicarCambios(btn, orig, errorEl);
  });
}

function _ppiAplicarCambios(btn, orig, errorEl) {
  var calls = [_ppiCall('/api/profile', { method: 'PUT', body: JSON.stringify({ email: _ppiPendingEmail }) })];
  if (_ppiPendingPwd) calls.push(_ppiCall('/api/profile/password', { method: 'PUT', body: JSON.stringify({ new_password: _ppiPendingPwd }) }));
  Promise.all(calls).then(function() {
    btn.innerHTML = orig; btn.disabled = false;
    ppiCerrarOtp();
    _ppiMsg('¡Cambios guardados correctamente!', true);
    document.getElementById('ppi-password').value = '';
  }).catch(function() {
    btn.innerHTML = orig; btn.disabled = false;
    ppiCerrarOtp();
    _ppiMsg('Error al guardar los cambios', false);
  });
}

function _ppiOtpError(btn, orig, errorEl, msg) {
  btn.innerHTML = orig; btn.disabled = false;
  errorEl.textContent = msg; errorEl.style.display = '';
  document.querySelectorAll('.ppi-otp-box').forEach(function(b) { b.value = ''; b.classList.remove('filled'); });
  var b = document.querySelectorAll('.ppi-otp-box')[0]; if(b) b.focus();
}

function ppiReenviarOtp() {
  document.querySelectorAll('.ppi-otp-box').forEach(function(b) { b.value = ''; b.classList.remove('filled'); });
  document.getElementById('ppi-otp-error').style.display = 'none';
  _ppiCall('/api/auth/send-change-otp', { method: 'POST', body: JSON.stringify({ email: _ppiPendingEmail }) }).catch(function(){});
  var b = document.querySelectorAll('.ppi-otp-box')[0]; if(b) b.focus();
}

function _ppiInitOtpBoxes() {
  var boxes = document.querySelectorAll('.ppi-otp-box');
  boxes.forEach(function(box, idx) {
    box.addEventListener('input', function() {
      box.value = box.value.replace(/\D/g, '').slice(-1);
      box.classList.toggle('filled', !!box.value);
      if (box.value && idx < boxes.length - 1) boxes[idx + 1].focus();
    });
    box.addEventListener('keydown', function(e) {
      if (e.key === 'Backspace' && !box.value && idx > 0) boxes[idx - 1].focus();
    });
    box.addEventListener('paste', function(e) {
      e.preventDefault();
      var txt = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '');
      boxes.forEach(function(b, i) { b.value = txt[i] || ''; b.classList.toggle('filled', !!b.value); });
      var last = Math.min(txt.length, boxes.length) - 1;
      if (last >= 0) boxes[last].focus();
    });
  });
}

function _ppiMsg(text, ok) {
  var el = document.getElementById('ppi-saved-msg');
  if (!el) return;
  el.textContent = text;
  el.style.color = ok ? '#10b981' : '#ef4444';
  clearTimeout(el._t);
  el._t = setTimeout(function() { el.textContent = ''; }, 3000);
}

// ── HISTORIAL ──
function _ppiCargarServicios() {
  _ppiSvcMostrados = 0;
  _ppiSvcData = [];
  var lista = document.getElementById('ppi-servicios-list');
  if (!lista) return;
  lista.innerHTML = '<div style="color:rgba(255,255,255,0.5);font-size:12px;padding:12px 0">Cargando historial…</div>';

  _ppiCall('/api/profile/appointments')
    .then(function(data) {
      lista.innerHTML = '';
      if (data._ok && Array.isArray(data.appointments) && data.appointments.length) {
        _ppiSvcData = data.appointments.map(function(a, i) {
          var empresa   = a.company_name || a.empresa || '—';
          var iniciales = empresa.split(' ').map(function(w){ return w[0]; }).join('').substring(0,2).toUpperCase();
          return {
            empresa:      empresa,
            profesional:  a.resource_name || a.profesional || '—',
            servicio:     a.service_name  || a.servicio    || '—',
            avatar:       iniciales,
            color:        _ppiColores[i % _ppiColores.length],
            img:          a.company_photo || a.foto_url || null,
            valor:        a.price != null ? '$' + Number(a.price).toLocaleString('es-CL') : '—',
            fecha:        a.date ? _ppiFecha(a.date) : (a.fecha || '—'),
            estado:       (a.status || a.estado || 'completado').toLowerCase()
          };
        });
        _ppiRenderSvcLote();
      } else {
        lista.innerHTML = '<div style="color:rgba(255,255,255,0.45);font-size:12px;padding:12px 0">No hay servicios registrados aún.</div>';
      }
    })
    .catch(function() {
      lista.innerHTML = '<div style="color:rgba(255,255,255,0.45);font-size:12px;padding:12px 0">No hay servicios registrados aún.</div>';
    });
}

function _ppiFecha(str) {
  try {
    var d = new Date(str);
    var meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
    return d.getDate() + ' ' + meses[d.getMonth()] + ' ' + d.getFullYear();
  } catch(e) { return str; }
}

function _ppiRenderSvcLote() {
  var lista  = document.getElementById('ppi-servicios-list');
  var verMas = document.getElementById('ppi-ver-mas-wrap');
  var hasta  = Math.min(_ppiSvcMostrados + _ppiSvcPorPagina, _ppiSvcData.length);

  for (var i = _ppiSvcMostrados; i < hasta; i++) {
    var s = _ppiSvcData[i];
    var div = document.createElement('div');
    div.className = 'hsvc-card';
    var avatarHtml = s.img
      ? '<div class="hsvc-img"><img src="' + s.img + '" alt="' + s.empresa + '"/></div>'
      : '<div class="hsvc-img" style="background:' + s.color + '22;color:' + s.color + '">' + s.avatar + '</div>';
    div.innerHTML =
      avatarHtml +
      '<div class="hsvc-body">' +
        '<div class="hsvc-empresa">' + s.empresa + '</div>' +
        '<div class="hsvc-pro"><i class="fas fa-user-md" style="margin-right:4px;font-size:10px"></i>' + s.profesional + '</div>' +
        '<div class="hsvc-servicio">' + s.servicio + '</div>' +
      '</div>' +
      '<div class="hsvc-right">' +
        '<div class="hsvc-valor">' + s.valor + '</div>' +
        '<div class="hsvc-fecha">' + s.fecha + '</div>' +
        '<span class="hsvc-badge ' + s.estado + '">' + (s.estado === 'completado' ? 'Completado' : s.estado === 'pendiente' ? 'Pendiente' : 'Cancelado') + '</span>' +
      '</div>';
    lista.appendChild(div);
  }

  _ppiSvcMostrados = hasta;
  if (verMas) verMas.style.display = _ppiSvcMostrados < _ppiSvcData.length ? '' : 'none';
}

function ppiVerMas() { _ppiRenderSvcLote(); }
