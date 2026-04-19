/* ═══════════════════════════════════════════════════════
   SEGUIMIENTO — seg-datepicker.js
   Date picker, time picker, segSetFecha, segSetHora, segToggleDatePicker, segToggleTimePicker. Var _MESES.
═══════════════════════════════════════════════════════ */

/* ─────────────────────────────────────────
   DATE PICKER
───────────────────────────────────────── */
var _MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
              'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function segToggleDatePicker() {
  var dp = document.getElementById('seg-datepicker');
  if (!dp) return;
  if (dp.classList.contains('seg-hidden')) {
    // Inicializar con fecha actual o seleccionada
    var hoy = new Date();
    var fSel = SEG._cal.fechaSel ? new Date(SEG._cal.fechaSel + 'T12:00:00') : hoy;
    SEG._cal.anio = fSel.getFullYear();
    SEG._cal.mes  = fSel.getMonth();
    segRenderizarCalendario();
    dp.classList.remove('seg-hidden');
    // Cerrar time picker si está abierto
    var tp = document.getElementById('seg-timepicker');
    if (tp) tp.classList.add('seg-hidden');
  } else {
    dp.classList.add('seg-hidden');
  }
}

function segCalNavMes(delta) {
  SEG._cal.mes += delta;
  if (SEG._cal.mes < 0)  { SEG._cal.mes = 11; SEG._cal.anio--; }
  if (SEG._cal.mes > 11) { SEG._cal.mes = 0;  SEG._cal.anio++; }
  segRenderizarCalendario();
}

function segRenderizarCalendario() {
  var tituloEl = document.getElementById('seg-cal-titulo');
  var diasEl   = document.getElementById('seg-cal-dias');
  if (!tituloEl || !diasEl) return;

  var anio = SEG._cal.anio;
  var mes  = SEG._cal.mes;
  tituloEl.textContent = _MESES[mes] + ' ' + anio;

  var primerDia = new Date(anio, mes, 1).getDay(); // 0=dom
  // Convertir a lunes=0
  var offset = (primerDia === 0) ? 6 : primerDia - 1;
  var diasEnMes = new Date(anio, mes + 1, 0).getDate();
  var hoy = new Date();
  var hoyStr = hoy.getFullYear() + '-' +
    String(hoy.getMonth()+1).padStart(2,'0') + '-' +
    String(hoy.getDate()).padStart(2,'0');

  var html = '';
  // Espacios vacíos
  for (var i = 0; i < offset; i++) html += '<div></div>';
  // Días
  for (var d = 1; d <= diasEnMes; d++) {
    var fechaStr = anio + '-' + String(mes+1).padStart(2,'0') + '-' + String(d).padStart(2,'0');
    var cls = 'cal-day';
    if (fechaStr === hoyStr)          cls += ' cal-day--today';
    if (fechaStr === SEG._cal.fechaSel) cls += ' cal-day--selected';
    html += '<div class="' + cls + '" onclick="segSeleccionarFecha(\'' + fechaStr + '\')">' +
      '<span class="cal-day-num">' + d + '</span>' +
    '</div>';
  }
  diasEl.innerHTML = html;
}

function segSeleccionarFecha(fechaStr) {
  SEG._cal.fechaSel = fechaStr;
  segSetFecha(fechaStr);
  document.getElementById('seg-datepicker').classList.add('seg-hidden');
  segMarcarCambios();
}

function segSetFecha(fechaStr) {
  SEG._cal.fechaSel = fechaStr;
  var hidden = document.getElementById('seg-campo-fecha');
  var display = document.getElementById('seg-fecha-display');
  if (hidden) hidden.value = fechaStr;
  if (display && fechaStr) {
    var d = new Date(fechaStr + 'T12:00:00');
    var meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
    display.textContent = d.getDate() + ' ' + meses[d.getMonth()] + ' ' + d.getFullYear();
  }
}

/* ─────────────────────────────────────────
   TIME PICKER
───────────────────────────────────────── */
function segToggleTimePicker() {
  var tp = document.getElementById('seg-timepicker');
  if (!tp) return;
  if (tp.classList.contains('seg-hidden')) {
    segRenderizarTimePicker();
    tp.classList.remove('seg-hidden');
    var dp = document.getElementById('seg-datepicker');
    if (dp) dp.classList.add('seg-hidden');
  } else {
    tp.classList.add('seg-hidden');
  }
}

function segRenderizarTimePicker() {
  var horasEl = document.getElementById('seg-tp-horas');
  var minsEl  = document.getElementById('seg-tp-minutos');
  if (!horasEl || !minsEl) return;

  var curHora = SEG._tp.hora !== null ? SEG._tp.hora : new Date().getHours();
  var curMin  = SEG._tp.min  !== null ? SEG._tp.min  : Math.floor(new Date().getMinutes()/5)*5;

  var htmlH = '';
  for (var h = 0; h <= 23; h++) {
    var cls = 'seg-tp-item' + (h === curHora ? ' active' : '');
    htmlH += '<div class="' + cls + '" onclick="segSeleccionarHora(' + h + ')">' +
      String(h).padStart(2,'0') + '</div>';
  }
  horasEl.innerHTML = htmlH;

  var htmlM = '';
  for (var m = 0; m < 60; m += 5) {
    var cls2 = 'seg-tp-item' + (m === curMin ? ' active' : '');
    htmlM += '<div class="' + cls2 + '" onclick="segSeleccionarMinuto(' + m + ')">' +
      String(m).padStart(2,'0') + '</div>';
  }
  minsEl.innerHTML = htmlM;

  // Scroll al ítem activo (sin barra visible)
  setTimeout(function() {
    var hA = horasEl.querySelector('.active');
    var mA = minsEl.querySelector('.active');
    if (hA) hA.scrollIntoView({ block: 'nearest' });
    if (mA) mA.scrollIntoView({ block: 'nearest' });
  }, 30);
}

function segSeleccionarHora(h) {
  SEG._tp.hora = h;
  segActualizarHora();
  document.querySelectorAll('#seg-tp-horas .seg-tp-item').forEach(function(el, i) {
    el.classList.toggle('seg-tp-selected', i === h);
  });
}

function segSeleccionarMinuto(m) {
  SEG._tp.min = m;
  segActualizarHora();
  document.querySelectorAll('#seg-tp-minutos .seg-tp-item').forEach(function(el, i) {
    el.classList.toggle('seg-tp-selected', i*5 === m);
  });
  setTimeout(function() {
    var tp = document.getElementById('seg-timepicker');
    if (tp) tp.classList.add('seg-hidden');
  }, 150);
}

function segActualizarHora() {
  var h = SEG._tp.hora !== null ? SEG._tp.hora : 0;
  var m = SEG._tp.min  !== null ? SEG._tp.min  : 0;
  var horaStr = String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0');
  segSetHora(horaStr);
  segMarcarCambios();
}

function segSetHora(horaStr) {
  if (!horaStr) return;
  var parts = horaStr.split(':');
  SEG._tp.hora = parseInt(parts[0]);
  SEG._tp.min  = parseInt(parts[1]);
  var hidden  = document.getElementById('seg-campo-hora');
  var display = document.getElementById('seg-hora-display');
  if (hidden)  hidden.value = horaStr;
  if (display) display.textContent = horaStr;
}

// Cerrar pickers al hacer click fuera
document.addEventListener('click', function(e) {
  var fechaWrap = document.getElementById('seg-fecha-wrap');
  var horaWrap  = document.getElementById('seg-hora-wrap');
  var dp = document.getElementById('seg-datepicker');
  var tp = document.getElementById('seg-timepicker');
  if (dp && fechaWrap && !fechaWrap.contains(e.target)) dp.classList.add('seg-hidden');
  if (tp && horaWrap  && !horaWrap.contains(e.target))  tp.classList.add('seg-hidden');
});