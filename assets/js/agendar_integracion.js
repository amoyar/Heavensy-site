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
function applyPlanChip() {
  var chip = document.getElementById('plan-chip');
  if (chip && _selectedPlan) {
    chip.textContent = '✶ ' + _selectedPlan;
    chip.style.display = 'inline-flex';
  }
}
document.addEventListener('DOMContentLoaded', applyPlanChip);

// ── PROFESIONES POR RUBRO ──
const PROFESIONES = {
  'Salud y bienestar': ['Médico general','Médico especialista','Psicólogo/a','Psiquiatra','Nutricionista','Kinesiólogo/a','Fonoaudiólogo/a','Terapeuta ocupacional','Enfermero/a','Dentista','Oftalmólogo/a','Dermatólogo/a','Ginecólogo/a','Pediatra','Traumatólogo/a','Veterinario/a'],
  'Educación': ['Profesor/a particular','Tutor/a académico','Instructor/a de idiomas','Psicopedagogo/a','Orientador/a vocacional','Profesor/a de música','Profesor/a de arte','Instructor/a de danza'],
  'Asesoría': ['Consultor/a de negocios','Abogado/a','Asesor/a legal','Arquitecto/a','Ingeniero/a','Psicopedagogo/a','Asesor/a de imagen','Asesor/a de carrera'],
  'Finanzas': ['Contador/a','Asesor/a financiero','Planificador/a financiero','Corredor/a de bolsa','Asesor/a de inversiones','Auditor/a'],
  'Belleza': ['Peluquero/a','Estilista','Manicurista','Pedicurista','Esteticista','Masajista','Maquillador/a','Barbero/a','Cosmetólogo/a','Especialista en cejas y pestañas','Tatuador/a'],
  'Deporte': ['Entrenador/a personal','Instructor/a de yoga','Instructor/a de pilates','Preparador/a físico','Instructor/a de baile','Entrenador/a de artes marciales','Instructor/a de natación','Coach deportivo'],
  'Espacios': ['Arrendador/a de salas','Gestor/a de cowork','Administrador/a de espacios','Coordinador/a de estudios'],
  'Eventos': ['Organizador/a de eventos','Fotógrafo/a','Videógrafo/a','DJ','Animador/a','Maestro/a de ceremonias','Wedding planner'],
  'Servicios técnicos': ['Técnico/a electrónico','Gasfiter','Electricista','Mecánico/a','Técnico/a en computación','Instalador/a'],
  'Servicios digitales': ['Diseñador/a gráfico','Desarrollador/a web','Community manager','Fotógrafo/a','Redactor/a','Consultor/a SEO','Especialista en ads'],
  'Acompañamiento personal': ['Coach de vida','Mentor/a','Terapeuta','Consejero/a','Facilitador/a'],
  'Gastronomía': ['Chef','Repostero/a','Barista','Sommelier','Nutricionista culinario','Caterer'],
  'Turismo': ['Guía turístico','Agente de viajes','Operador/a de tours','Anfitrión/a'],
  'Retail': ['Vendedor/a','Asesor/a de ventas','Personal shopper','Gerente de tienda'],
  'Bienestar integral': ['Terapeuta holístico','Instructor/a de meditación','Coach de bienestar','Aromaterapeuta','Reflexólogo/a'],
  'Inmobiliario': ['Corredor/a de propiedades','Asesor/a inmobiliario','Tasador/a','Administrador/a de propiedades'],
  'Otro': []
};

document.addEventListener('DOMContentLoaded', function() {
  var rubroEl = document.getElementById('demo-rubro');
  if (rubroEl) rubroEl.addEventListener('change', function() {
    document.getElementById('demo-profesion').value = '';
    cerrarSugerencias();
  });
});

function filtrarProfesiones(q) {
  const rubro = document.getElementById('demo-rubro').value;
  const profs = PROFESIONES[rubro] || [];
  const box = document.getElementById('prof-sugerencias');
  const filtradas = q.length < 1 ? profs : profs.filter(p => p.toLowerCase().includes(q.toLowerCase()));
  if (!filtradas.length) { box.style.display = 'none'; return; }
  box.innerHTML = filtradas.map(p =>
    `<div onclick="elegirProfesion('${p}')" style="padding:8px 12px;font-size:12px;color:#374151;cursor:pointer;border-bottom:0.5px solid #f3f4f6" onmouseover="this.style.background='#f5f3ff'" onmouseout="this.style.background=''">${p}</div>`
  ).join('');
  box.style.display = 'block';
}
function elegirProfesion(p) {
  document.getElementById('demo-profesion').value = p;
  cerrarSugerencias();
}
function cerrarSugerencias() {
  document.getElementById('prof-sugerencias').style.display = 'none';
}

// ── DEMO FORM ──
function selOpt(groupId, el, hiddenId) {
  const multiSelect = hiddenId === 'demo-canales';
  if (multiSelect) {
    el.classList.toggle('sel');
  } else {
    document.querySelectorAll('#' + groupId + ' .demo-opt').forEach(o => o.classList.remove('sel'));
    el.classList.add('sel');
  }
  const vals = [...document.querySelectorAll('#' + groupId + ' .demo-opt.sel')].map(o => o.dataset.val);
  document.getElementById(hiddenId).value = vals.join(',');
}

function _hvAuthPost(path, body) {
  const token = localStorage.getItem('token') || '';
  return fetch((typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : '') + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify(body),
  }).then(r => r.json().then(d => { d._status = r.status; return d; }));
}

function enviarDemo(btn) {
  const rubro     = document.getElementById('demo-rubro').value;
  const servicio  = document.getElementById('demo-servicio').value.trim();
  const canales   = document.getElementById('demo-canales').value;
  const lenguaje  = document.getElementById('demo-lenguaje').value;
  const nombre    = document.getElementById('demo-nombre').value.trim();
  const profesion = document.getElementById('demo-profesion').value.trim();
  if (!rubro || !servicio || !canales || !lenguaje || !nombre) {
    mostrarToast('Completa los campos obligatorios (*)', '#ef4444'); return;
  }
  localStorage.setItem('hv_demo', JSON.stringify({ rubro, servicio, canales, lenguaje, nombre, profesion }));
  const orig = btn.innerHTML;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin" style="margin-right:6px"></i>Preparando tu Demo…';
  btn.disabled = true;

  _hvAuthPost('/api/onboarding/session', { tipo: 'demo', rubro, servicio, canales, lenguaje, nombre, profesion })
    .then(data => {
      if (data.session_id) localStorage.setItem('hv_session_id', data.session_id);
      mostrarToast('¡Demo lista! Redirigiendo…', '#9961FF');
      setTimeout(() => { window.location.href = 'demo.html'; }, 800);
    })
    .catch(() => {
      // Si falla la API igual seguimos (datos en localStorage)
      mostrarToast('¡Demo lista! Redirigiendo…', '#9961FF');
      setTimeout(() => { window.location.href = 'demo.html'; }, 800);
    })
    .finally(() => { btn.innerHTML = orig; btn.disabled = false; });
}

// ── MODO SELECTOR ──
function elegirModo(modo) {
  const esIntegracion = modo === 'integracion';
  document.getElementById('modo-integracion').classList.toggle('active', esIntegracion);
  document.getElementById('modo-demo').classList.toggle('active', !esIntegracion);
  document.getElementById('modo-integracion').classList.toggle('modo-colapsado', !esIntegracion);
  document.getElementById('modo-demo').classList.toggle('modo-colapsado', esIntegracion);
  document.getElementById('check-integracion').style.display = esIntegracion ? '' : 'none';
  document.getElementById('check-demo').style.display = !esIntegracion ? '' : 'none';
  document.getElementById('main-card').style.display = '';
  document.getElementById('cal-layout-wrap').style.display = esIntegracion ? '' : 'none';
  document.getElementById('confirm-panel').style.display = 'none';
  document.getElementById('demo-panel').style.display = esIntegracion ? 'none' : '';
  const icon  = document.querySelector('#card-head-content .card-head-icon i');
  const title = document.querySelector('#card-head-content .card-head-title');
  const sub   = document.querySelector('#card-head-content .card-head-sub');
  const badge = document.querySelector('#card-head-content .duration-badge');
  if (esIntegracion) {
    icon.className = 'fas fa-calendar-check';
    title.textContent = 'Agenda tu sesión de integración';
    sub.textContent = 'Elige el día y hora que mejor te acomoden — un especialista te guiará en el proceso';
    badge.innerHTML = '<i class="fas fa-clock"></i>20 minutos';
  } else {
    icon.className = 'fas fa-play-circle';
    title.textContent = 'Creando tu Demo';
    sub.textContent = 'Rellena estos campos para hacer tu demostración';
    badge.innerHTML = '<i class="fas fa-clock"></i>3 minutos';
  }
  applyPlanChip();
}

// ── CALENDARIO ──
const DIAS_SEMANA = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const HORARIOS_DIA = ['09:00','09:30','10:00','10:30','11:00','11:30','14:00','14:30','15:00','15:30','16:00','16:30'];
const OCUPADOS = new Set();

let hoy = new Date();
let curYear = hoy.getFullYear();
let curMonth = hoy.getMonth();
let selectedDay = null;
let selectedTime = null;

function esDisponible(date) {
  const d = date.getDay();
  const diff = Math.floor((date - hoy) / 86400000);
  return d >= 1 && d <= 5 && diff >= 1;
}

function getProximos3() {
  const result = [];
  const d = new Date(hoy);
  d.setDate(d.getDate() + 1);
  while (result.length < 3) {
    if (esDisponible(d)) {
      for (let h of HORARIOS_DIA) {
        if (result.length < 3) result.push({ date: new Date(d), hora: h });
      }
    }
    d.setDate(d.getDate() + 1);
  }
  return result;
}

const proximos3 = getProximos3();

function renderCal() {
  const title = document.getElementById('cal-month-title');
  title.textContent = MESES[curMonth] + ' ' + curYear;
  const grid = document.getElementById('cal-grid');
  grid.innerHTML = '';
  DIAS_SEMANA.forEach(d => {
    const el = document.createElement('div');
    el.className = 'cal-dow';
    el.textContent = d;
    grid.appendChild(el);
  });
  const firstDay = new Date(curYear, curMonth, 1).getDay();
  const daysInMonth = new Date(curYear, curMonth + 1, 0).getDate();
  for (let i = 0; i < firstDay; i++) {
    const el = document.createElement('div'); el.className = 'cal-day'; grid.appendChild(el);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(curYear, curMonth, day);
    const el = document.createElement('div');
    el.textContent = day;
    const esHoy = date.toDateString() === hoy.toDateString();
    const disponible = esDisponible(date);
    const esNextSlot = proximos3.some(p => p.date.toDateString() === date.toDateString());
    const esSel = selectedDay && date.toDateString() === selectedDay.toDateString();
    if (esSel) el.className = 'cal-day available selected';
    else if (esNextSlot) el.className = 'cal-day available next-slot';
    else if (disponible) el.className = 'cal-day available';
    else if (esHoy) el.className = 'cal-day today';
    else el.className = 'cal-day past';
    if (disponible) el.onclick = () => seleccionarDia(date);
    grid.appendChild(el);
  }
}

function renderSlots() {
  const list = document.getElementById('slots-list');
  list.innerHTML = '';
  const diasNombre = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
  proximos3.forEach(({ date, hora }, i) => {
    const esSel = selectedDay && date.toDateString() === selectedDay.toDateString() && selectedTime === hora;
    const div = document.createElement('div');
    div.className = 'slot-card' + (esSel ? ' selected' : ' highlighted');
    const label = i === 0 ? 'Próximo cupo' : i === 1 ? '2° cupo libre' : '3° cupo libre';
    const tagClass = i === 0 ? 'green' : '';
    const nombreDia = diasNombre[date.getDay()].charAt(0).toUpperCase() + diasNombre[date.getDay()].slice(1);
    div.innerHTML = `<div class="slot-dot"></div><div class="slot-info"><div class="slot-date">${nombreDia} ${date.getDate()} de ${MESES[date.getMonth()]}</div><div class="slot-time"><i class="fas fa-clock" style="margin-right:3px;opacity:.6"></i>${hora}</div></div><span class="slot-tag ${tagClass}">${label}</span>`;
    div.onclick = () => { seleccionarDia(date, false); selectedTime = hora; renderSlots(); seleccionarHora(hora); };
    list.appendChild(div);
  });
}

function seleccionarDia(date, mostrarHoras = true) {
  selectedDay = date;
  selectedTime = null;
  document.getElementById('confirm-panel').classList.remove('show');
  renderCal();
  renderSlots();
  if (mostrarHoras) renderTimes(date);
  else document.getElementById('times-section').style.display = 'none';
  if (date.getMonth() !== curMonth || date.getFullYear() !== curYear) {
    curMonth = date.getMonth(); curYear = date.getFullYear(); renderCal();
  }
}

function renderTimes(date) {
  const sec = document.getElementById('times-section');
  const label = document.getElementById('times-label');
  const grid = document.getElementById('times-grid');
  const diasNombre = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
  label.textContent = `${diasNombre[date.getDay()].charAt(0).toUpperCase()+diasNombre[date.getDay()].slice(1)} ${date.getDate()} de ${MESES[date.getMonth()]}`;
  sec.style.display = 'block';
  grid.innerHTML = '';
  HORARIOS_DIA.forEach(hora => {
    const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}_${hora}`;
    const btn = document.createElement('div');
    btn.className = 'time-btn' + (OCUPADOS.has(key) ? ' busy' : '') + (selectedTime === hora ? ' selected' : '');
    btn.textContent = hora;
    if (!OCUPADOS.has(key)) btn.onclick = () => seleccionarHora(hora);
    grid.appendChild(btn);
  });
}

function seleccionarHora(hora) {
  selectedTime = hora;
  document.getElementById('confirm-panel').classList.remove('show');
  const diasNombre = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
  const dateStr = `${diasNombre[selectedDay.getDay()].charAt(0).toUpperCase()+diasNombre[selectedDay.getDay()].slice(1)}, ${selectedDay.getDate()} de ${MESES[selectedDay.getMonth()]} ${selectedDay.getFullYear()}`;
  document.getElementById('confirm-date-txt').textContent = dateStr;
  document.getElementById('confirm-time-txt').innerHTML = `<i class="fas fa-clock" style="margin-right:4px;color:#9961FF"></i>${hora} hrs — duración 20 minutos`;
  document.getElementById('times-section').style.display = 'none';
  document.getElementById('agendar-btn-wrap').style.display = 'block';
}

function confirmarDesdeBoton() {
  const diasNombre = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
  const dateStr = `${diasNombre[selectedDay.getDay()].charAt(0).toUpperCase()+diasNombre[selectedDay.getDay()].slice(1)}, ${selectedDay.getDate()} de ${MESES[selectedDay.getMonth()]} ${selectedDay.getFullYear()}`;
  const sesionData = {
    fecha: dateStr, hora: selectedTime,
    modo: document.getElementById('cal-layout-wrap').style.display !== 'none' ? 'integracion' : 'demo'
  };
  localStorage.setItem('hv_sesion', JSON.stringify(sesionData));

  _hvAuthPost('/api/onboarding/session', { tipo: 'integracion', fecha: dateStr, hora: selectedTime })
    .then(data => { if (data.session_id) localStorage.setItem('hv_session_id', data.session_id); })
    .catch(() => {})
    .finally(() => { window.location.href = 'pagar.html'; });
}

function cancelarSeleccion() {
  selectedTime = null;
  document.getElementById('confirm-panel').classList.remove('show');
  document.getElementById('agendar-btn-wrap').style.display = 'none';
  renderTimes(selectedDay);
}

function confirmarCita() {
  const diasNombre = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
  const dateStr = `${diasNombre[selectedDay.getDay()].charAt(0).toUpperCase()+diasNombre[selectedDay.getDay()].slice(1)} ${selectedDay.getDate()} de ${MESES[selectedDay.getMonth()]}`;
  mostrarToast(`Cita confirmada — ${dateStr} a las ${selectedTime} hrs`);
  document.getElementById('confirm-panel').classList.remove('show');
  const key = `${selectedDay.getFullYear()}-${selectedDay.getMonth()}-${selectedDay.getDate()}_${selectedTime}`;
  OCUPADOS.add(key);
  selectedDay = null; selectedTime = null;
  renderCal(); renderSlots();
  document.getElementById('times-section').style.display = 'none';
}

function mostrarToast(msg, color = '#10b981') {
  const t = document.getElementById('toast');
  t.style.background = color;
  document.getElementById('toast-msg').textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 4000);
}

function cambiarMes(dir) {
  curMonth += dir;
  if (curMonth > 11) { curMonth = 0; curYear++; }
  if (curMonth < 0) { curMonth = 11; curYear--; }
  renderCal();
}

// ── INIT ──
renderCal();
renderSlots();
