/* ═══════════════════════════════════════════════════════
   SEGUIMIENTO — seg-utils.js
   segConfirm, segPrompt, segToast, segFetch, segEscape, segFormatFecha, segFechaLocalHoy, helpers.
═══════════════════════════════════════════════════════ */

function segVerPlantillas()  { segToast('Modulo de plantillas - proximamente', ''); }
function segNuevoMensajeProg(){ segToast('Programar mensaje - proximamente', ''); }

/* ─────────────────────────────────────────
   MODALES CUSTOM — reemplazan confirm/prompt nativos
───────────────────────────────────────── */
function segConfirm(mensaje, onAceptar, onCancelar) {
  var overlay = document.getElementById('seg-modal-overlay');
  var title   = document.getElementById('seg-modal-title');
  var body    = document.getElementById('seg-modal-body');
  var inputW  = document.getElementById('seg-modal-input-wrap');
  var btnOk   = document.getElementById('seg-modal-ok');
  var btnCan  = document.getElementById('seg-modal-cancel');
  if (!overlay) return;

  title.textContent  = mensaje;
  body.style.display = 'none';
  inputW.style.display = 'none';
  btnOk.textContent  = 'Confirmar';
  btnOk.className    = 'seg-modal-btn seg-modal-btn-danger';
  overlay.classList.remove('seg-hidden');

  btnOk.onclick = function() {
    overlay.classList.add('seg-hidden');
    if (onAceptar) onAceptar();
  };
  btnCan.onclick = function() {
    overlay.classList.add('seg-hidden');
    if (onCancelar) onCancelar();
  };
}

function segPrompt(titulo, placeholder, onAceptar) {
  var overlay = document.getElementById('seg-modal-overlay');
  var title   = document.getElementById('seg-modal-title');
  var body    = document.getElementById('seg-modal-body');
  var inputW  = document.getElementById('seg-modal-input-wrap');
  var input   = document.getElementById('seg-modal-input');
  var btnOk   = document.getElementById('seg-modal-ok');
  var btnCan  = document.getElementById('seg-modal-cancel');
  if (!overlay) return;

  title.textContent      = titulo;
  body.style.display     = 'none';
  inputW.style.display   = 'block';
  input.placeholder      = placeholder || '';
  input.value            = '';
  btnOk.textContent      = 'Aceptar';
  btnOk.className        = 'seg-modal-btn seg-modal-btn-primary';
  overlay.classList.remove('seg-hidden');
  setTimeout(function() { input.focus(); }, 80);

  btnOk.onclick = function() {
    var val = input.value.trim();
    if (!val) { input.focus(); return; }
    overlay.classList.add('seg-hidden');
    if (onAceptar) onAceptar(val);
  };
  btnCan.onclick = function() {
    overlay.classList.add('seg-hidden');
  };
  input.onkeydown = function(e) {
    if (e.key === 'Enter') btnOk.onclick();
    if (e.key === 'Escape') btnCan.onclick();
  };
}


function segToast(msg, tipo, duracion) {
  var el     = document.getElementById('seg-toast');
  var msgEl  = document.getElementById('seg-toast-msg');
  var iconEl = document.getElementById('seg-toast-icon');
  if (!el || !msgEl) return;
  msgEl.textContent = msg;
  el.className = 'seg-toast visible';
  if (tipo === 'success') { el.className += ' success'; if (iconEl) iconEl.className = 'fas fa-check-circle'; }
  else if (tipo === 'error') { el.className += ' error'; if (iconEl) iconEl.className = 'fas fa-exclamation-circle'; }
  else if (typeof tipo === 'number') { duracion = tipo; if (iconEl) iconEl.className = 'fas fa-info-circle'; }
  else { if (iconEl) iconEl.className = 'fas fa-info-circle'; }
  clearTimeout(SEG._toastTimer);
  SEG._toastTimer = setTimeout(function(){ el.classList.remove('visible'); }, duracion || 2800);
}

/* ─────────────────────────────────────────
   FETCH — delega en apiCall() de app.js
───────────────────────────────────────── */
function segFetch(url, opts, onSuccess, onError) {
  var endpoint = url.replace(/^https?:\/\/[^/]+/, '');
  var options = {};
  if (opts.method) options.method = opts.method;
  if (opts.body)   options.body   = opts.body;

  apiCall(endpoint, options)
    .then(function(res) {
      if (!res || !res.ok) { if (onError) onError(res); return; }
      if (onSuccess) {
        try { onSuccess(res.data); }
        catch(cbErr) { console.error('[Seguimiento] callback error:', cbErr, endpoint); }
      }
    })
    .catch(function(err) {
      console.error('[Seguimiento]', err, endpoint);
      if (onError) onError(err);
    });
}

/* ─────────────────────────────────────────
   UTILS
───────────────────────────────────────── */
function segEscape(str) {
  if (typeof str !== 'string') return String(str || '');
  return str
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function segEscapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function segFormatFecha(date) {
  var d = date instanceof Date ? date : new Date(date);
  var m = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  return String(d.getDate()).padStart(2,'0') + ' ' + m[d.getMonth()] + ' ' + d.getFullYear();
}

function segFormatFechaCorta(dateStr) {
  if (!dateStr) return '-';
  try {
    var hoy  = new Date();
    var hoyStr = hoy.getFullYear() + '-' +
      String(hoy.getMonth()+1).padStart(2,'0') + '-' +
      String(hoy.getDate()).padStart(2,'0');
    var ayer = new Date(hoy); ayer.setDate(hoy.getDate()-1);
    var ayerStr = ayer.getFullYear() + '-' +
      String(ayer.getMonth()+1).padStart(2,'0') + '-' +
      String(ayer.getDate()).padStart(2,'0');

    var fechaSolo = dateStr.substring(0, 10);

    if (fechaSolo === hoyStr)  return 'Hoy · ' + segFormatFecha(new Date(fechaSolo + 'T12:00:00'));
    if (fechaSolo === ayerStr) return 'Ayer';
    return segFormatFecha(new Date(fechaSolo + 'T12:00:00'));
  } catch(e) { return dateStr; }
}

/* Fecha local del navegador en formato YYYY-MM-DD — evita desfase UTC */
function segFechaLocalHoy() {
  var d = new Date();
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}