// ── NAV STATE ──
(function() {
  var token      = localStorage.getItem('token');
  var linkPlanes = document.getElementById('nav-link-planes');
  var btnLogin   = document.getElementById('nav-btn-login');
  if (token) {
    if (linkPlanes) linkPlanes.style.display = 'none';
    if (btnLogin)   btnLogin.style.display   = 'none';
  } else {
    if (linkPlanes) linkPlanes.style.display = '';
    if (btnLogin)   btnLogin.style.display   = '';
  }
})();

// ── NAV ──
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

// ── PLAN DESDE URL ──
var _selectedPlan = new URLSearchParams(window.location.search).get('plan') || sessionStorage.getItem('selectedPlan') || '';
if (_selectedPlan) sessionStorage.setItem('selectedPlan', _selectedPlan);

// ── FOTO ──
function cambiarFoto(input) {
  if (!input.files[0]) return;
  var r = new FileReader();
  r.onload = function(e) {
    var img = document.getElementById('avatar-img');
    img.src = e.target.result;
    img.style.display = 'block';
    document.getElementById('avatar-initials').style.display = 'none';
    document.getElementById('btn-quitar-foto').style.display = '';
  };
  r.readAsDataURL(input.files[0]);
}
function quitarFoto() {
  document.getElementById('avatar-img').style.display = 'none';
  document.getElementById('avatar-initials').style.display = '';
  document.getElementById('btn-quitar-foto').style.display = 'none';
}

// ── DISPLAY ──
function actualizarDisplay() {
  var nombre = document.getElementById('inp-nombre').value || 'Usuario';
  document.getElementById('display-nombre').textContent = nombre;
  var partes = nombre.trim().split(' ');
  var ini = partes.length >= 2 ? partes[0][0] + partes[1][0] : partes[0].substring(0, 2);
  document.getElementById('avatar-initials').textContent = ini.toUpperCase();
}

// ── PLAN INFO ──
var planInfo = {
  gratis:     { cls: 'plan-gratis',     icon: 'fa-user',    txt: 'Gratis — funciones básicas' },
  automate:   { cls: 'plan-automate',   icon: 'fa-robot',   txt: 'Automate Pro — automatización inteligente' },
  secretaria: { cls: 'plan-secretaria', icon: 'fa-headset', txt: 'Secretaría Premium — atención personalizada' },
  enterprise: { cls: 'plan-enterprise', icon: 'fa-gem',     txt: 'Enterprise — acceso completo' }
};
function actualizarPlan() {
  var val = document.getElementById('inp-plan').value;
  var p = planInfo[val];
  document.getElementById('plan-info').innerHTML =
    '<span class="plan-badge ' + p.cls + '"><i class="fas ' + p.icon + '" style="margin-right:4px"></i>' + p.txt + '</span>';
  var opt = document.getElementById('inp-plan');
  document.getElementById('display-plan').innerHTML =
    '<i class="fas ' + p.icon + '" style="margin-right:4px"></i>Plan ' + opt.options[opt.selectedIndex].text;
}

// ── RUT ──
function formatRut(input) {
  var v = input.value.replace(/[^0-9kK]/g, '');
  if (v.length > 1) {
    var cuerpo = v.slice(0, -1);
    var dv = v.slice(-1).toUpperCase();
    var fmt = '';
    cuerpo.split('').reverse().forEach(function(d, i) { if (i > 0 && i % 3 === 0) fmt = '.' + fmt; fmt = d + fmt; });
    input.value = fmt + '-' + dv;
  }
}

// ── CONTRASEÑA ──
function togglePwd(id, btn) {
  var inp = document.getElementById(id);
  var isText = inp.type === 'text';
  inp.type = isText ? 'password' : 'text';
  btn.innerHTML = '<i class="fas fa-eye' + (isText ? '' : '-slash') + '"></i>';
}
function medirFuerza(pwd) {
  var bar  = document.getElementById('pwd-bar');
  var hint = document.getElementById('pwd-hint');
  if (!pwd) { bar.style.width = '0'; hint.textContent = ''; return; }
  var score = 0;
  if (pwd.length >= 8)  score++;
  if (pwd.length >= 12) score++;
  if (/[A-Z]/.test(pwd))         score++;
  if (/[0-9]/.test(pwd))         score++;
  if (/[^A-Za-z0-9]/.test(pwd))  score++;
  var niveles = [
    { w: '20%', bg: '#ef4444', txt: 'Muy débil' },
    { w: '40%', bg: '#f97316', txt: 'Débil' },
    { w: '60%', bg: '#eab308', txt: 'Regular' },
    { w: '80%', bg: '#22c55e', txt: 'Buena' },
    { w: '100%',bg: '#10b981', txt: 'Muy segura' }
  ];
  var n = niveles[Math.min(score, 4)];
  bar.style.width = n.w;
  bar.style.background = n.bg;
  hint.textContent = n.txt;
  hint.style.color = n.bg;
  validarConfirm();
}
function validarConfirm() {
  var p1   = document.getElementById('inp-pwd').value;
  var p2   = document.getElementById('inp-pwd2').value;
  var hint = document.getElementById('pwd2-hint');
  if (!p2) { hint.textContent = ''; return; }
  if (p1 === p2) { hint.textContent = '✓ Las contraseñas coinciden'; hint.style.color = '#10b981'; }
  else           { hint.textContent = '✗ Las contraseñas no coinciden'; hint.style.color = '#ef4444'; }
}
function generarContrasena() {
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  var pwd = '';
  for (var i = 0; i < 14; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
  var inp  = document.getElementById('inp-pwd');
  var inp2 = document.getElementById('inp-pwd2');
  inp.type = 'text'; inp2.type = 'text';
  inp.value = pwd; inp2.value = pwd;
  medirFuerza(pwd); validarConfirm();
  mostrarToast('Contraseña generada — guárdala en un lugar seguro', '#f59e0b');
}

// ── MÉTODO DE CONFIRMACIÓN ──
function selMethod(tipo) {
  document.getElementById('confirm-method').value = tipo;
  document.getElementById('btn-method-wa').classList.toggle('sel', tipo === 'wa');
  document.getElementById('btn-method-email').classList.toggle('sel', tipo === 'email');
}

// ── API HELPER ──
var _API_BASE = (typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : '');
function _hvPost(path, body) {
  return fetch(_API_BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(function(r) { return r.json().then(function(d) { d._status = r.status; return d; }); });
}

// ── GUARDAR + ABRIR OTP ──
var _otpEmail = '';

function guardarCambios(btn) {
  var nombre = document.getElementById('inp-nombre').value.trim();
  var email  = document.getElementById('inp-email').value.trim();
  var rut    = document.getElementById('inp-rut').value.trim();
  var metodo = document.getElementById('confirm-method').value;
  var tel    = document.getElementById('inp-telefono').value.trim();

  if (!nombre || !email || !rut) { mostrarToast('Completa los campos obligatorios', '#ef4444'); return; }
  var p1 = document.getElementById('inp-pwd').value;
  var p2 = document.getElementById('inp-pwd2').value;
  if (!p1) { mostrarToast('Ingresa una contraseña', '#ef4444'); return; }
  if (p1 !== p2) { mostrarToast('Las contraseñas no coinciden', '#ef4444'); return; }
  if (!metodo) { mostrarToast('Elige cómo confirmar tu cuenta', '#f59e0b'); return; }

  localStorage.setItem('hv_perfil', JSON.stringify({ nombre: nombre, email: email, rut: rut }));
  _otpEmail = email;

  var orig = btn.innerHTML;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>Enviando código…';
  btn.disabled = true;

  _hvPost('/api/auth/register', {
    full_name:            nombre,
    email:                email,
    rut:                  rut,
    phone:                tel,
    password:             p1,
    confirmation_method:  metodo,
  }).then(function(data) {
    btn.innerHTML = orig;
    btn.disabled  = false;
    if (data.ok) {
      abrirOtp(metodo, email);
    } else {
      mostrarToast(data.error || 'Error al registrar', '#ef4444');
    }
  }).catch(function() {
    btn.innerHTML = orig;
    btn.disabled  = false;
    mostrarToast('Error de conexión. Intenta nuevamente.', '#ef4444');
  });
}

// ── MODAL OTP ──
function abrirOtp(metodo, email) {
  var overlay = document.getElementById('otp-overlay');
  var icon    = document.getElementById('otp-icon');
  var sub     = document.getElementById('otp-sub');

  if (metodo === 'wa') {
    var tel = document.getElementById('inp-telefono').value.trim() || 'tu WhatsApp';
    icon.innerHTML = '<i class="fab fa-whatsapp"></i>';
    icon.className = 'otp-icon wa';
    sub.textContent = 'Ingresa el código de 5 dígitos enviado a ' + tel;
  } else {
    icon.innerHTML = '<i class="fas fa-envelope"></i>';
    icon.className = 'otp-icon';
    sub.textContent = 'Ingresa el código de 5 dígitos enviado a ' + (email || 'tu correo');
  }

  document.querySelectorAll('.otp-box').forEach(function(b) { b.value = ''; b.classList.remove('filled'); });
  document.getElementById('otp-error').style.display = 'none';
  overlay.classList.add('open');
  setTimeout(function() { document.querySelectorAll('.otp-box')[0].focus(); }, 100);
}

function cerrarOtp() {
  document.getElementById('otp-overlay').classList.remove('open');
}

function verificarCodigo() {
  var codigo  = Array.from(document.querySelectorAll('.otp-box')).map(function(b){ return b.value; }).join('');
  var errorEl = document.getElementById('otp-error');

  if (codigo.length < 5) {
    errorEl.textContent = 'Ingresa los 5 dígitos del código.';
    errorEl.style.display = '';
    return;
  }

  var verBtn = document.getElementById('otp-btn-verify');
  verBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>Verificando…';
  verBtn.disabled  = true;

  _hvPost('/api/auth/verify-otp', { email: _otpEmail, otp_code: codigo })
    .then(function(data) {
      if (data.ok) {
        // Guardar token
        localStorage.setItem('token', data.access_token);
        if (data.refresh_token) localStorage.setItem('refresh_token', data.refresh_token);
        if (data.user) {
          localStorage.setItem('company_id', data.user.company_id || '');
          localStorage.setItem('user_id',    data.user.id || '');
        }
        cerrarOtp();
        mostrarToast('¡Cuenta verificada!', '#10b981');
        var nextParam = new URLSearchParams(window.location.search).get('next');
        var progParam = new URLSearchParams(window.location.search).get('prog');
        var destino = (nextParam === 'pagar')
          ? ('pagar.html' + (progParam !== null ? '?prog=' + progParam : ''))
          : 'agendar_integracion.html';
        setTimeout(function() { window.location.href = destino; }, 1000);
      } else {
        errorEl.textContent = data.error || 'Código incorrecto. Intenta nuevamente.';
        errorEl.style.display = '';
        document.querySelectorAll('.otp-box').forEach(function(b) { b.value = ''; b.classList.remove('filled'); });
        document.querySelectorAll('.otp-box')[0].focus();
        verBtn.innerHTML = '<i class="fas fa-check"></i>Verificar';
        verBtn.disabled  = false;
      }
    })
    .catch(function() {
      errorEl.textContent = 'Error de conexión. Intenta nuevamente.';
      errorEl.style.display = '';
      verBtn.innerHTML = '<i class="fas fa-check"></i>Verificar';
      verBtn.disabled  = false;
    });
}

function reenviarCodigo() {
  var metodo = document.getElementById('confirm-method').value;
  var tel    = document.getElementById('inp-telefono')?.value.trim() || '';
  var nombre = document.getElementById('inp-nombre').value.trim();
  var p1     = document.getElementById('inp-pwd').value;
  document.querySelectorAll('.otp-box').forEach(function(b){ b.value=''; b.classList.remove('filled'); });
  document.getElementById('otp-error').style.display = 'none';
  _hvPost('/api/auth/register', {
    full_name: nombre, email: _otpEmail, phone: tel, password: p1, confirmation_method: metodo,
  }).then(function(data) {
    if (data.ok) {
      mostrarToast('Código reenviado', '#9961FF');
    } else {
      mostrarToast(data.error || 'Error al reenviar', '#ef4444');
    }
  }).catch(function() {
    mostrarToast('Error de conexión', '#ef4444');
  });
  setTimeout(function(){ document.querySelectorAll('.otp-box')[0].focus(); }, 200);
}

// ── OTP: navegación entre cajas ──
(function() {
  function initOtpBoxes() {
    var boxes = document.querySelectorAll('.otp-box');
    if (!boxes.length) return;
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
        var txt = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g,'');
        boxes.forEach(function(b, i) { b.value = txt[i]||''; b.classList.toggle('filled', !!b.value); });
        var last = Math.min(txt.length, boxes.length) - 1;
        if (last >= 0) boxes[last].focus();
      });
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initOtpBoxes);
  } else {
    initOtpBoxes();
  }
})();

function descartar() {
  if (confirm('¿Descartar los cambios no guardados?')) location.reload();
}

// ── TOAST ──
function mostrarToast(msg, color) {
  color = color || '#10b981';
  var t = document.getElementById('toast');
  t.style.background = color;
  document.getElementById('toast-msg').textContent = msg;
  t.classList.add('show');
  setTimeout(function() { t.classList.remove('show'); }, 3000);
}
