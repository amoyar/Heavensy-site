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

// ── PLANES ──
var PLANES = {
  gratis:     { nombre: 'Gratis',             precio: '$0',       monto: 0 },
  automate:   { nombre: 'Automate Pro',        precio: '$29.990',  monto: 29990 },
  secretaria: { nombre: 'Secretaría Premium',  precio: '$59.990',  monto: 59990 },
  enterprise: { nombre: 'Enterprise',          precio: '$99.990',  monto: 99990 }
};

// ── CARGAR DATOS ──
window.addEventListener('load', function() {
  var progParam = new URLSearchParams(window.location.search).get('prog');
  var progReserva = JSON.parse(localStorage.getItem('hv_prog_reserva') || 'null');

  // Flujo desde programa_detalle
  if (progParam !== null && progReserva) {
    var resumenBlock = document.getElementById('resumen-sesion');
    var planBlock    = document.getElementById('resumen-plan');
    var avisoPago    = document.getElementById('aviso-pago');
    if (resumenBlock) resumenBlock.style.display = 'none';
    if (avisoPago)    avisoPago.style.display    = 'none';

    var elPlan   = document.getElementById('res-plan');
    var elPrecio = document.getElementById('res-plan-precio');
    var elTotal  = document.querySelector('.resumen-total .resumen-value');
    if (elPlan)   elPlan.textContent   = progReserva.nombre || '—';
    if (elPrecio) elPrecio.textContent = progReserva.precio || '—';
    if (elTotal)  elTotal.textContent  = progReserva.precio || '—';
    return;
  }

  // Flujo normal (planes + integración)
  var sesion = JSON.parse(localStorage.getItem('hv_sesion') || '{}');
  var perfil = JSON.parse(localStorage.getItem('hv_perfil') || '{}');
  var plan   = perfil.plan || sessionStorage.getItem('selectedPlan') || 'enterprise';
  var info   = PLANES[plan] || PLANES.enterprise;

  var elFecha  = document.getElementById('res-fecha');
  var elHora   = document.getElementById('res-hora');
  var elPlan   = document.getElementById('res-plan');
  var elPrecio = document.getElementById('res-plan-precio');
  var elAviso  = document.getElementById('res-aviso-precio');

  if (elFecha)  elFecha.textContent  = sesion.fecha || '—';
  if (elHora)   elHora.textContent   = sesion.hora  ? sesion.hora + ' hrs' : '—';
  if (elPlan)   elPlan.textContent   = info.nombre;
  if (elPrecio) elPrecio.textContent = info.precio + '/mes';
  if (elAviso)  elAviso.textContent  = info.precio;
});

// ── MÉTODO DE PAGO ──
function selMetodo(el) {
  document.querySelectorAll('.pay-method').forEach(function(m) { m.classList.remove('sel'); });
  el.classList.add('sel');
  var esTarjeta      = el.querySelector('i').classList.contains('fa-credit-card');
  var esTransferencia = el.querySelector('i').classList.contains('fa-university');
  document.getElementById('form-tarjeta').style.display      = esTarjeta      ? '' : 'none';
  document.getElementById('form-transferencia').style.display = esTransferencia ? '' : 'none';
}

// ── FORMATO TARJETA ──
function formatCard(input) {
  var v = input.value.replace(/\D/g, '').substring(0, 16);
  input.value = v.match(/.{1,4}/g)?.join(' ') || v;
}
function formatExpiry(input) {
  var v = input.value.replace(/\D/g, '').substring(0, 4);
  if (v.length >= 3) v = v.substring(0, 2) + '/' + v.substring(2);
  input.value = v;
}

// ── PROCESAR PAGO ──
function procesarPago(btn) {
  var orig       = btn.innerHTML;
  var plan       = (localStorage.getItem('hv_perfil') ? JSON.parse(localStorage.getItem('hv_perfil')).plan : null)
                   || sessionStorage.getItem('selectedPlan') || 'enterprise';
  var metodoEl   = document.querySelector('.pay-method.sel i');
  var metodo     = metodoEl
    ? (metodoEl.classList.contains('fa-credit-card') ? 'tarjeta'
       : metodoEl.classList.contains('fa-university') ? 'transferencia' : 'paypal')
    : 'tarjeta';
  var sessionId  = localStorage.getItem('hv_session_id') || '';
  var token      = localStorage.getItem('token') || '';

  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>Procesando…';
  btn.disabled  = true;

  var apiBase = (typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : '');
  fetch(apiBase + '/api/onboarding/plan', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body:    JSON.stringify({ plan: plan, metodo_pago: metodo, session_id: sessionId }),
  })
  .then(function(r) { return r.json(); })
  .then(function() {
    mostrarToast('¡Solicitud registrada! Redirigiendo…', '#10b981');
    btn.innerHTML        = '<i class="fas fa-check"></i>¡Confirmado!';
    btn.style.background = '#10b981';
    setTimeout(function() { window.location.href = '../index.html'; }, 1800);
  })
  .catch(function() {
    // Si falla la API igual redirigimos (no bloquear al usuario)
    mostrarToast('Redirigiendo…', '#10b981');
    setTimeout(function() { window.location.href = '../index.html'; }, 1800);
  });
}

// ── TOAST ──
function mostrarToast(msg, color) {
  color = color || '#10b981';
  var t = document.getElementById('toast');
  t.style.background = color;
  document.getElementById('toast-msg').textContent = msg;
  t.classList.add('show');
  setTimeout(function() { t.classList.remove('show'); }, 4000);
}
