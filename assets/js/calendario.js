// ═══════════════════════════════════════════
//  CALENDARIO — HEAVENSY (conectado al backend)
// ═══════════════════════════════════════════
// ── BITÁCORA ──
// [v2026.06.24-1] calendario.js
// 2026-06-24 | + _calIsOwnResourceView (usuario dueño del único recurso visible);
//              _calRenderSvcFilterChips oculta la barra de filtros (cal-prof-bar)
//              en esa vista. Coordina con prof-chips.js (que hace lo mismo en
//              _calRenderProfChips) para que ninguna reaparezca la barra.
// [v2026.06.16-2] calLoadResources: si el usuario ES un recurso, el calendario
//              muestra SOLO su agenda (calResources=[su recurso]); admin sin
//              recurso ve todos. Filtro de visualización (no seguridad).

// ── CONFIG ──
const CAL_HOUR_START = 8;
const CAL_HOUR_END   = 19;
const CAL_HOUR_H     = 72;
let calZoom      = false; // zoom semana/día — controla altura de slots
let calWheelZoom = 72;    // zoom Ctrl+scroll (px/hora, 36-288)
let calShowSubLabels = false; // mostrar labels :15 :30 :45
let calMonthZoom = false; // zoom mes — controla cuántas citas mostrar por celda

function getHourH() { return calZoom ? CAL_HOUR_H * 4 : calWheelZoom; }

function toggleSubLabels() {
  calShowSubLabels = !calShowSubLabels;
  document.querySelectorAll('.time-label-sub').forEach(el => {
    el.style.display = calShowSubLabels ? '' : 'none';
  });
  const btn = document.getElementById('cal-sublabel-btn');
  if (btn) btn.classList.toggle('active', calShowSubLabels);
}
function toggleZoom() {
  calZoom = !calZoom;
  document.documentElement.style.setProperty('--hour-h', getHourH() + 'px');
  calRender();
}

function toggleMonthZoom() {
  calMonthZoom = !calMonthZoom;
  var btn = document.getElementById('month-zoom-btn');
  if (btn) {
    btn.title     = calMonthZoom ? 'Vista normal' : 'Ampliar';
    btn.className = 'cal-zoom-btn' + (calMonthZoom ? ' zoomed' : '');
    btn.innerHTML = '<i class="fas ' + (calMonthZoom ? 'fa-search-minus' : 'fa-search-plus') + '"></i>';
  }
  calRenderMonth();
}
window.toggleMonthZoom = toggleMonthZoom;

const CAL_DAYS_ES   = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
const CAL_DAYS_FULL = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
const CAL_MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

// ── STATE ──
let calCurrentView = 'week';
let calCurrentDate = new Date();
let calProfFilter  = null;   // null = Todos, string = resource_id activo
let calSvcFilter   = null;   // null = Todos, string = service_id activo

// ── API STATE ──
let calApiAppointments = [];    // citas cargadas desde el backend
let calResources       = [];    // recursos de la empresa
let calServiceMap      = {};    // service_id → { name, duration }
let calContactMap      = {};    // contact_id → profile_name
let calVipMap         = {};    // contact_id → true si es VIP
let calLoadedMonths    = new Set(); // "YYYY-MM" ya cargados
let calIsLoading       = false;

// ── SELECCIÓN DE CITAS ──
const calSelectedAppts = new Map();

function calApptKey(a) {
  return a._id || `${a.date}_${a.start}_${a.contact_id}_${a.service_id}`;
}

function toggleApptSelect(a, card) {
  const key = calApptKey(a);
  if (calSelectedAppts.has(key)) {
    calSelectedAppts.delete(key);
    card.classList.remove('selected');
    card.querySelector('.appt-check')?.remove();
  } else {
    calSelectedAppts.set(key, {
      client:  calFmtContact(a.contact_id),
      service: calServiceMap[a.service_id]?.name || a.service_id || '',
      date:    a.date
    });
    card.classList.add('selected');
    const chk = document.createElement('div');
    chk.className = 'appt-check';
    chk.innerHTML = '<i class="fas fa-check"></i>';
    card.insertBefore(chk, card.firstChild);
  }
  calUpdateSelectBar();
}

function calUpdateSelectBar() {
  const bar = document.getElementById('cal-select-bar');
  if (!bar) return;
  const count = calSelectedAppts.size;
  if (count === 0) { bar.classList.remove('visible'); return; }
  bar.classList.add('visible');
  document.getElementById('cal-select-count').textContent =
    count + ' cliente' + (count !== 1 ? 's' : '') + ' seleccionado' + (count !== 1 ? 's' : '');
  document.getElementById('cal-select-names').textContent =
    [...calSelectedAppts.values()].map(v => v.client).join(' · ');
}

function clearSelection() {
  calSelectedAppts.clear();
  calUpdateSelectBar();
  calRender();
}

const calActiveChannels = new Set(['whatsapp']);

function sendMessageToSelected() {
  const recipients = document.getElementById('msg-recipients');
  if (!recipients) return;
  recipients.innerHTML = [...calSelectedAppts.values()].map(v =>
    `<span class="msg-chip"><i class="fas fa-user" style="font-size:9px;opacity:.7"></i> ${v.client}</span>`
  ).join('');
  calActiveChannels.clear(); calActiveChannels.add('whatsapp');
  document.querySelectorAll('.msg-channel-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('ch-whatsapp')?.classList.add('active');
  document.getElementById('msg-overlay')?.classList.add('open');
}
function closeMsgModal() { document.getElementById('msg-overlay')?.classList.remove('open'); }
function selectChannel(ch) {
  if (calActiveChannels.has(ch)) { if (calActiveChannels.size === 1) return; calActiveChannels.delete(ch); document.getElementById('ch-'+ch)?.classList.remove('active'); }
  else { calActiveChannels.add(ch); document.getElementById('ch-'+ch)?.classList.add('active'); }
}
async function doSendMessage() {
  const clients      = [...calSelectedAppts.values()];
  const text         = document.getElementById('msg-text')?.value?.trim() || '';
  const channelNames = [...calActiveChannels].map(ch => ch === 'whatsapp' ? 'WhatsApp' : ch === 'email' ? 'Email' : 'Heavensy');
  const companyId    = localStorage.getItem('company_id') || '';

  if (!text) { calShowToast('Escribe un mensaje', 'warning'); return; }

  const btn = document.querySelector('#msg-overlay .btn-primary');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin" style="margin-right:6px"></i>Enviando...'; }

  let sent = 0, errors = 0;
  await Promise.all(clients.map(async appt => {
    const to = appt.contact_id || '';
    if (!to || to === 'grupo') return;
    try {
      const res = await apiCall('/api/messaging/send', {
        method: 'POST',
        body: JSON.stringify({ company_id: companyId, to, text, channel: 'whatsapp' }),
      });
      res.ok ? sent++ : errors++;
    } catch(e) { errors++; }
  }));

  if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-paper-plane" style="margin-right:6px"></i>Enviar'; }

  const sub     = document.getElementById('msg-success-sub');
  const success = document.getElementById('msg-success');
  const msg     = errors > 0
    ? `Enviado a ${sent} de ${clients.length} por ${channelNames.join(' y ')}`
    : `Enviado a ${clients.length} cliente${clients.length !== 1 ? 's' : ''} por ${channelNames.join(' y ')}`;
  if (sub) sub.textContent = msg;
  if (success) success.classList.add('visible');
  setTimeout(() => { closeMsgModal(); success?.classList.remove('visible'); calSelectedAppts.clear(); calUpdateSelectBar(); calRender(); }, 2200);
}

// ── DRAG & DROP ──
let calDragAppt   = null;
let calDragOffsetY = 0;
const CAL_LOCAL_MOVES = new Map(); // solo para citas sin ID de API

// ── COLORES POR STATUS ──
const CAL_STATUS_COLORS = {
  scheduled:   { bg:'#B8CEF0', border:'#9ab8e8', text:'#1a2f5e' },
  confirmed:   { bg:'#CEEBDA', border:'#a8d9be', text:'#1a5c38' },
  reserved:    { bg:'#F7DDA0', border:'#f0cc7a', text:'#5c3a00' },
  arrived:     { bg:'#C9C2F9', border:'#b0a8f5', text:'#2d1a6e' },
  in_progress: { bg:'#A1CED6', border:'#7fb8c2', text:'#1a5560' },
  completed:   { bg:'#e2e8f0', border:'#cbd5e1', text:'#475569' },
  no_show:     { bg:'#F5BCBC', border:'#e89898', text:'#7f1d1d' },
  cancelled:   { bg:'#F5BCBC', border:'#e89898', text:'#7f1d1d' },
  rescheduled: { bg:'#F7DDA0', border:'#f0cc7a', text:'#5c3a00' },
  expired:     { bg:'#e2e8f0', border:'#cbd5e1', text:'#475569' },
};
const CAL_STATUS_LABELS = {
  scheduled: 'Agendado', confirmed: 'Confirmado', reserved: 'Reservado',
  arrived: 'Llegó', in_progress: 'En curso', completed: 'Completado',
  no_show: 'No asistió', cancelled: 'Cancelado', rescheduled: 'Reagendado', expired: 'Expirado',
};
const CAL_SERVICE_PALETTE = [
  { bg:'#B8CEF0', border:'#9ab8e8', text:'#1a2f5e' },
  { bg:'#CEEBDA', border:'#a8d9be', text:'#1a5c38' },
  { bg:'#C9C2F9', border:'#b0a8f5', text:'#2d1a6e' },
  { bg:'#A1CED6', border:'#7fb8c2', text:'#1a5560' },
  { bg:'#F5BCBC', border:'#e89898', text:'#7f1d1d' },
  { bg:'#D4B8F0', border:'#b89ae8', text:'#2d1a6e' },
  { bg:'#B8E8CE', border:'#90d0aa', text:'#1a4a30' },
];
function getServiceColor(serviceId) {
  if (!serviceId) return CAL_SERVICE_PALETTE[0];
  // Hash simple del service_id para asignar color consistente
  let hash = 0;
  for (let i = 0; i < serviceId.length; i++) hash = (hash + serviceId.charCodeAt(i)) % CAL_SERVICE_PALETTE.length;
  return CAL_SERVICE_PALETTE[hash];
}
function getApptColor(a) {
  // Canceladas/no asistió → siempre rojo
  if (['cancelled','no_show','expired'].includes(a.status)) {
    return { bg:'#F5BCBC', border:'#e89898', text:'#7f1d1d' };
  }
  // Todas las demás → color del servicio
  return getServiceColor(a.service_id);
}

// ── EVENTOS GRUPALES (bloques masivos) ──
let CAL_GROUP_EVENTS = [];
const CAL_BM_COLORS = {
  'Taller Autoconocimiento': { bg:'#C9C2F9', border:'#b0a8f5', text:'#2d1a6e' },
  'Curso de Ángeles':        { bg:'#F7DDA0', border:'#f0cc7a', text:'#5c3a00' },
  'Pack Terapéutico x4':     { bg:'#B8CEF0', border:'#9ab8e8', text:'#1a2f5e' },
  'Retiro de Bienestar':     { bg:'#CEEBDA', border:'#a8d9be', text:'#1a5c38' },
  'Meditación Grupal':       { bg:'#A1CED6', border:'#7fb8c2', text:'#1a5560' },
  'Curso Online 8 semanas':  { bg:'#F5BCBC', border:'#e89898', text:'#6e1a1a' },
};

// ── HELPERS ──
function calFmtDate(d) {
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function calFmtMonth(d) {
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
}
function calAddDays(d, n) { const r = new Date(d); r.setDate(r.getDate()+n); return r; }
function calGetMonday(d) {
  const r = new Date(d); const day = r.getDay();
  r.setDate(r.getDate() + (day === 0 ? -6 : 1 - day)); return r;
}
function calTimeToMinutes(t) { const [h,m] = t.split(':').map(Number); return h*60+m; }
function calMinutesToPx(mins) { return (mins / 60) * getHourH(); }
function calMinsToTime(mins) {
  const h = Math.floor(mins/60), m = mins%60;
  return String(h).padStart(2,'0')+':'+String(m).padStart(2,'0');
}
function calSnapToSlot(mins) { return Math.round(mins/15)*15; }
function calFmtContact(id) {
  if (!id) return 'Cliente';
  // Si ya tenemos el nombre resuelto, usarlo
  if (calContactMap[id]) return calContactMap[id];
  // Fallback: mostrar número limpio
  return id.replace('@s.whatsapp.net','').replace('@c.us','');
}
const CAL_TODAY_STR = calFmtDate(new Date());

// ── LOADING UI ──
function calShowLoading() {
  const body = document.getElementById('week-grid') || document.getElementById('day-grid') || document.getElementById('month-grid');
  if (!body) return;
  body.innerHTML = `<div style="grid-column:1/-1;display:flex;align-items:center;justify-content:center;height:200px;gap:10px;color:#9BA3C0;font-size:13px;">
    <i class="fas fa-spinner fa-spin" style="color:#9961FF"></i> Cargando citas...
  </div>`;
}

function calShowToast(msg, type = 'success') {
  const color = type === 'success' ? '#9961FF' : type === 'error' ? '#ef4444' : '#f59e0b';
  const icon  = type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-times-circle' : 'fa-exclamation-circle';
  const el = document.createElement('div');
  el.style.cssText = `position:fixed;bottom:80px;right:24px;z-index:9999;background:#fff;border-left:4px solid ${color};border-radius:10px;padding:10px 16px;box-shadow:0 4px 20px rgba(0,0,0,.12);font-size:12.5px;font-weight:600;color:#383838;display:flex;align-items:center;gap:8px;max-width:280px;`;
  el.innerHTML = `<i class="fas ${icon}" style="color:${color}"></i> ${msg}`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

// ═══════════════════════════════════════════
//  API — CARGA DE DATOS
// ═══════════════════════════════════════════

async function calLoadResources() {
  try {
    const res = await apiCall('/api/agenda/resources');
    if (res.ok && res.data?.resources) {
      calResources = res.data.resources;

      // Si el usuario actual ES un recurso (tiene su propio recurso en la lista),
      // el calendario muestra SOLO su agenda — no la de sus colegas. Un admin/gestor
      // que no es recurso ve todos. Se decide por el dato (¿tiene recurso?), no por rol. [16-06]
      const _u   = (typeof getUserFromToken === 'function') ? getUserFromToken() : null;
      const _uid = _u && (_u.user_id || _u.sub);
      if (_uid) {
        const propio = calResources.find(r => r.user_id && String(r.user_id) === String(_uid));
        if (propio) calResources = [propio];
      }

      await Promise.all([
        ...calResources.map(r => calLoadServicesForResource(r._id)),
        ...calResources.map(r => calLoadBlocksForResource(r._id)),
      ]);
      calPopulateResourceSelects();
      _calRenderProfChips();
      _calRenderSvcFilterChips();
    }
  } catch (e) { console.warn('[Calendario] No se pudieron cargar recursos', e); }
}

async function calLoadServicesForResource(resourceId) {
  try {
    const res = await apiCall(`/api/agenda/resources/${resourceId}/services`);
    if (res.ok && res.data?.services) {
      res.data.services.forEach(s => { calServiceMap[s._id] = s; });
    }
  } catch {}
}

async function calLoadMonthAppointments(dateOrStr) {
  // Si es string de fecha completa (YYYY-MM-DD), extraer solo el mes (YYYY-MM)
  const month = typeof dateOrStr === 'string' ? dateOrStr.slice(0,7) : calFmtMonth(dateOrStr);
  if (calLoadedMonths.has(month)) return;
  calLoadedMonths.add(month);
  try {
    const res = await apiCall(`/api/calendar/company?month=${month}`);
    if (res.ok && res.data?.appointments) {
      // Agregar sin duplicados
      const existing = new Set(calApiAppointments.map(a => a._id));
      const nuevas = res.data.appointments.filter(a => !existing.has(a._id));
      calApiAppointments.push(...nuevas);

      // Restaurar eventos grupales (bloques masivos guardados como citas)
      const groupIds = new Set(CAL_GROUP_EVENTS.map(e => e._id));
      nuevas.forEach(a => {
        if ((a.mode === 'grupo' || (a.notes || '').startsWith('Bloque masivo:')) && !groupIds.has(a._id)) {
          a._isGroup = true;
          a.dur      = a.duration || 60;
          a.service  = a.service || (a.notes || '').replace('Bloque masivo: ', '').trim();
          CAL_GROUP_EVENTS.push(a);
          groupIds.add(a._id);
        }
      });

      // Resolver nombres en segundo plano y re-renderizar al terminar
      if (nuevas.length) {
        calResolveContactNames(nuevas).then(() => calRender());
      }
    }
  } catch (e) { console.warn('[Calendario] Error cargando mes', month, e); }
}

async function calEnsureMonthsLoaded() {
  const months = new Set();
  months.add(calFmtMonth(calCurrentDate));
  if (calCurrentView === 'week') {
    const monday = calGetMonday(calCurrentDate);
    months.add(calFmtMonth(monday));
    months.add(calFmtMonth(calAddDays(monday, 6)));
  }
  for (const m of months) {
    if (!calLoadedMonths.has(m)) await calLoadMonthAppointments(m);
  }
}

// ── RESOLVER NOMBRES DE CONTACTOS ──
async function calResolveContactNames(appointments) {
  const companyId = localStorage.getItem('company_id')
    || (appointments[0]?.company_id)
    || '';
  if (!companyId) return;

  // Usar contact_name ya incluido en la cita si es un nombre real
  appointments.forEach(a => {
    if (a.contact_id && a.contact_name && !calContactMap[a.contact_id]) {
      calContactMap[a.contact_id] = a.contact_name;
    }
  });

  // Recoger contact_ids que aún no tienen nombre (fallback individual)
  const pending = [...new Set(
    appointments
      .map(a => a.contact_id)
      .filter(id => id && !calContactMap[id])
  )];

  if (!pending.length) return;

  // Consultar en paralelo (máximo 10 a la vez para no saturar)
  const chunks = [];
  for (let i = 0; i < pending.length; i += 10) chunks.push(pending.slice(i, i + 10));

  for (const chunk of chunks) {
    await Promise.all(chunk.map(async contactId => {
      try {
        const res = await apiCall(`/api/contacts/${encodeURIComponent(contactId)}?company_id=${companyId}`);
        console.log('[CAL] contacto:', contactId, res.ok, res.data?.contact);
        if (res.ok && res.data?.contact) {
          const c = res.data.contact;
          const nombre = c.name || c.pushname || c.profile_name || '';
          console.log('[CAL] nombre resuelto:', contactId, '→', nombre, '| campos:', {name:c.name, pushname:c.pushname, profile_name:c.profile_name});
          if (nombre) calContactMap[contactId] = nombre;
          if (c.is_vip) calVipMap[contactId] = true;
        }
      } catch (e) { console.error('[CAL] error contacto:', contactId, e); }
    }));
  }
}

// ── CITAS PARA UN DÍA ──
function calGetDayAppointments(dateStr) {
  return calApiAppointments.filter(a =>
    a.date === dateStr && !['cancelled','expired'].includes(a.status)
  );
}

// ── CREAR CITA ──
async function calCreateAppointment(data) {
  // 1. Optimistic update — aparece en el calendario de inmediato
  const svc = calServiceMap[data.service_id];
  const tempId = '_tmp_' + Date.now();
  const tempAppt = {
    _id:         tempId,
    _isTemp:     true,
    contact_id:  data.contact_id,
    service_id:  data.service_id,
    resource_id: data.resource_id,
    date:        data.date,
    start:       data.start,
    end:         data.end || data.start,
    duration:    svc?.duration || 60,
    status:      'scheduled',
    source:      data.source || 'panel',
    notes:       data.notes || '',
  };
  calApiAppointments.push(tempAppt);
  calRender(); // aparece al instante

  // 2. Persistir en backend
  const res = await apiCall('/api/agenda/appointments', {
    method: 'POST',
    body: JSON.stringify(data)
  });

  // 3. Reemplazar temp con el real
  calApiAppointments = calApiAppointments.filter(a => a._id !== tempId);
  if (res.ok) {
    const real = res.data?.appointment || res.data;
    if (real?._id) {
      calApiAppointments.push(real);
    } else {
      // Recargar mes si el backend no devuelve el objeto
      calLoadedMonths.delete(calFmtMonth(new Date(data.date)));
      await calLoadMonthAppointments(data.date);
    }
    calRender();
    calShowToast('Cita creada correctamente');
    return true;
  }
  calRender(); // quitar el temp
  calShowToast(res.data?.error || 'Error al crear la cita', 'error');
  return false;
}

// ── REAGENDAR — solo persiste en backend, el estado local ya fue actualizado ──
async function calRescheduleAppointment(appointmentId, newDate, newStart) {
  const res = await apiCall(`/api/agenda/appointments/${appointmentId}/reschedule`, {
    method: 'PATCH',
    body: JSON.stringify({ date: newDate, start: newStart })
  });
  if (res.ok) {
    calShowToast('Cita reagendada');
  } else {
    calShowToast('Guardado solo localmente — error de conexión', 'warning');
  }
}

// ── CONFIRMAR ELIMINAR (modal custom) ──
let _calConfirmResolve = null;
function calConfirm(msg) {
  return new Promise(resolve => {
    _calConfirmResolve = resolve;
    const el = document.getElementById('cal-confirm-msg');
    if (el) el.textContent = msg;
    document.getElementById('cal-confirm-overlay')?.classList.add('open');
  });
}
function calConfirmAccept() {
  document.getElementById('cal-confirm-overlay')?.classList.remove('open');
  if (_calConfirmResolve) { _calConfirmResolve(true); _calConfirmResolve = null; }
}
function calConfirmReject() {
  document.getElementById('cal-confirm-overlay')?.classList.remove('open');
  if (_calConfirmResolve) { _calConfirmResolve(false); _calConfirmResolve = null; }
}

// ── ELIMINAR CITA ──
async function calDeleteAppointment(a) {
  const ok = await calConfirm(`¿Eliminar la cita de ${calFmtContact(a.contact_id)}?`);
  if (!ok) return;

  // Optimistic: quitar del array local y re-renderizar
  calApiAppointments = calApiAppointments.filter(x => x._id !== a._id);
  calRender();

  // Cancelar en backend (no existe DELETE físico — se cancela con PATCH /cancel)
  const res = await apiCall(`/api/agenda/appointments/${a._id}/cancel`, {
    method: 'PATCH',
    body: JSON.stringify({ reason: 'Cancelado desde calendario' })
  });
  if (res.ok) {
    calShowToast('Cita cancelada');
  } else {
    // Revertir: restaurar la cita en memoria si el backend falló
    calApiAppointments.push(a);
    calRender();
    const msg = res.data?.error || 'Error al cancelar la cita';
    calShowToast(msg, 'error');
  }
}

// ── BLOQUEAR HORARIO ──
async function calBlockSchedule(resourceId, date, start, end, blockType, reason) {
  const res = await apiCall(`/api/agenda/schedule/${resourceId}/block`, {
    method: 'POST',
    body: JSON.stringify({ date, start, end, block_type: blockType || 'Sin motivo', reason: reason || '' })
  });
  if (res.ok) {
    // Guardar localmente para visualizar (el backend no tiene GET de excepciones en el calendario)
    CAL_LOCAL_BLOCKS.push({
      id: res.data?.exception_id || Date.now().toString(),
      resource_id: resourceId,
      block_type: blockType || 'Sin motivo',
      resource_name: calResources.find(r => r._id === resourceId)?.name || 'Recurso',
      date, start, end, reason
    });
    calShowToast('Bloqueo creado');
    return res.data?.exception_id;
  }
  calShowToast(res.data?.error || 'Error al crear bloqueo', 'error');
  return null;
}

// ── ELIMINAR BLOQUEO ──
async function calDeleteBlock(exceptionId) {
  const res = await apiCall(`/api/agenda/schedule/exceptions/${exceptionId}`, { method: 'DELETE' });
  if (res.ok) {
    CAL_LOCAL_BLOCKS = CAL_LOCAL_BLOCKS.filter(b => b.id !== exceptionId);
    calShowToast('Bloqueo eliminado');
    calRender();
    calRenderExcList();
  } else {
    calShowToast('Error al eliminar bloqueo', 'error');
  }
}

let CAL_LOCAL_BLOCKS = [];
let calExcReasonFilter = new Set(); // filtro motivo panel bloqueos (sumativos)

async function calLoadBlocksForResource(resourceId) {
  try {
    const now   = new Date();
    const from  = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const to    = new Date(now.getFullYear(), now.getMonth() + 3, 0);
    const fmt   = d => d.toISOString().split('T')[0];
    const res   = await apiCall(`/api/agenda/schedule/exceptions?resource_id=${resourceId}&from=${fmt(from)}&to=${fmt(to)}`);
    if (res.ok && res.data?.exceptions?.length) {
      const ids = new Set(CAL_LOCAL_BLOCKS.map(b => b.id));
      res.data.exceptions.forEach(e => {
        if (!ids.has(e._id)) {
          CAL_LOCAL_BLOCKS.push({
            id: e._id,
            resource_id:   e.resource_id,
            resource_name: calResources.find(r => r._id === e.resource_id)?.name || '',
            date:          e.date,
            start:         e.start  || '00:00',
            end:           e.end    || '23:59',
            block_type:    e.block_type || 'Sin motivo',
            reason:        e.reason || '',
          });
        }
      });
    }
  } catch(e) {}
}

// ── PROF CHIPS ──
function _calRenderProfChips() {
  const container = document.getElementById('cal-prof-chips');
  if (!container) return;
  if (!calResources.length) { container.innerHTML = ''; return; }

  const allChip = `<div class="cal-prof-chip${!calProfFilter ? ' active' : ''}" onclick="calSetProfFilter(null)" data-id="">
    <span class="cal-prof-chip-avatar" style="background:linear-gradient(135deg,#9961FF,#5b8dee)">T</span>
    <span>Todos</span>
  </div>`;

  // Filtrar profesionales por servicio activo
  const _visibleProfIds = calSvcFilter
    ? new Set(Object.values(calServiceMap)
        .filter(s => s._id === calSvcFilter || Object.entries(calServiceMap).some(([id,sv]) => id === calSvcFilter && sv.name === s.name))
        .map(s => s.resource_id))
    : null;
  const chips = calResources.filter(r => !_visibleProfIds || _visibleProfIds.has(r._id || r.resource_id)).map(r => {
    const initials = (r.name || '').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';
    const active   = calProfFilter === (r._id || r.resource_id);
    return `<div class="cal-prof-chip${active ? ' active' : ''}" onclick="calSetProfFilter('${r._id || r.resource_id}')" data-id="${r._id || r.resource_id}">
      <span class="cal-prof-chip-avatar">${initials}</span>
      <span>${r.name || 'Recurso'}</span>
    </div>`;
  }).join('');

  container.innerHTML = allChip + chips;
}

function _calProfSearch(q) {
  const container = document.getElementById('cal-prof-chips');
  if (!container) return;
  const query = (q || '').toLowerCase().trim();
  container.querySelectorAll('.cal-prof-chip').forEach(chip => {
    const id = chip.dataset.id;
    if (!id) { chip.style.display = ''; return; } // "Todos" siempre visible
    const name = (chip.textContent || '').toLowerCase();
    chip.style.display = (!query || name.includes(query)) ? '' : 'none';
  });
}

function calSetProfFilter(resourceId) {
  calProfFilter = resourceId || null;
  // Al cambiar profesional, resetear servicio y re-renderizar ambos
  calSvcFilter = null;
  _calRenderSvcFilterChips();
  _calRenderProfChips();
  calRender();
  if (document.getElementById('exc-panel')?.classList.contains('open')) calRenderExcList();
}

// ── ¿Vista de profesional (solo su propio recurso)? ──
// El backend ya filtra por rol: un PROFESIONAL_ROL recibe solo su recurso. Señal
// para el frontend: el usuario logueado es dueño del único recurso visible. En ese
// caso ocultamos la barra de filtros (no hay a quién/qué filtrar). [24-06]
function _calIsOwnResourceView() {
  try {
    const _u   = (typeof getUserFromToken === 'function') ? getUserFromToken() : null;
    const _uid = _u && (_u.user_id || _u.sub);
    if (!_uid || !Array.isArray(calResources)) return false;
    return calResources.length === 1 &&
           calResources[0] && calResources[0].user_id &&
           String(calResources[0].user_id) === String(_uid);
  } catch (e) { return false; }
}

// ── SVC CHIPS ──
function _calRenderSvcFilterChips() {
  const container = document.getElementById('cal-svc-chips');
  if (!container) return;
  // Profesional: ocultar la barra de filtros (ve solo su recurso). [24-06]
  if (_calIsOwnResourceView()) {
    const _b = document.getElementById('cal-prof-bar');
    if (_b) _b.style.display = 'none';
    return;
  }
  const bar = document.getElementById('cal-prof-bar');
  // Filtrar servicios por profesional activo
  // Si el profesional no tiene servicios, mostrar todos
  const _profHasServices = calProfFilter
    ? Object.values(calServiceMap).some(s => s.resource_id === calProfFilter)
    : true;
  const nameMap = new Map();
  Object.entries(calServiceMap).forEach(([id, svc]) => {
    if (calProfFilter && _profHasServices && svc.resource_id !== calProfFilter) return;
    const name = (svc.name || '').trim();
    if (name && !nameMap.has(name)) nameMap.set(name, { id, name });
  });
  const svcs = [...nameMap.values()];
  if (bar) bar.style.display = (calResources.length > 1 || svcs.length > 0) ? '' : 'none';
  if (!svcs.length) { container.innerHTML = ''; return; }
  const allChip = `<div class="prof-chip${!calSvcFilter ? ' prof-chip-sel' : ''}" onclick="calSetSvcFilter(null)" data-id="">Todos</div>`;
  const chips = svcs.map(svc => {
    const active = calSvcFilter === svc.id;
    return `<div class="prof-chip${active ? ' prof-chip-sel' : ''}" onclick="calSetSvcFilter('${svc.id}')" data-id="${svc.id}">${svc.name}</div>`;
  }).join('');
  container.innerHTML = allChip + chips;
}
function _calSvcSearch(q) {
  const container = document.getElementById('cal-svc-chips');
  if (!container) return;
  const query = (q || '').toLowerCase().trim();
  container.querySelectorAll('.prof-chip').forEach(chip => {
    if (!chip.dataset.id) { chip.style.display = ''; return; }
    chip.style.display = (!query || chip.textContent.toLowerCase().includes(query)) ? '' : 'none';
  });
}
function calSetSvcFilter(svcId) {
  calSvcFilter = svcId || null;
  // Al cambiar servicio, filtrar profesionales que tienen ese servicio
  _calRenderProfChips();
  _calRenderSvcFilterChips();
  calRender();
}
window.calSetSvcFilter = calSetSvcFilter;


// ── POPULATE SELECTS ──
function calPopulateResourceSelects() {
  // Solo pobla los selects que siguen siendo nativos
  ['appt-resource', 'bm-resource'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = '<option value="">Seleccionar recurso...</option>' + calResources.map(r =>
      `<option value="${r._id}">${r.name}</option>`
    ).join('');
  });
  // Poblar dropdown custom del panel de bloqueos
  _calBuildExcResourceDrop();
  // Cuando cambia el recurso en el modal de cita, cargar servicios
  document.getElementById('appt-resource')?.addEventListener('change', calPopulateServiceSelect);
  calPopulateServiceSelect();
}

function calPopulateServiceSelect() {
  const resourceId = document.getElementById('appt-resource')?.value;
  const svcEl = document.getElementById('appt-service');
  if (!svcEl) return;
  const services = Object.values(calServiceMap).filter(s => !resourceId || s.resource_id === resourceId);
  svcEl.innerHTML = services.length
    ? services.map(s => `<option value="${s._id}">${s.name} (${s.duration} min)</option>`).join('')
    : '<option value="">Sin servicios disponibles</option>';
}

// ═══════════════════════════════════════════
//  RENDER — TARJETA DE CITA
// ═══════════════════════════════════════════

// Verifica si una cita ya pasó (fecha+hora < ahora)
function _calApptIsInPast(a) {
  if (!a.date || !a.start) return false;
  const apptDt = new Date(a.date + 'T' + a.start + ':00');
  return apptDt < new Date();
}

// Color del dot por status
function _calStatusDotColor(status) {
  const dots = {
    scheduled:   '#378add',
    confirmed:   '#1d9e75',
    reserved:    '#ba7517',
    arrived:     '#8b5cf6',
    in_progress: '#0f6e56',
    completed:   '#888780',
    no_show:     '#e24b4a',
    cancelled:   '#e24b4a',
    rescheduled: '#ba7517',
    expired:     '#888780',
  };
  return dots[status] || '#9BA3C0';
}

function calBuildCard(a, isApiAppt) {
  const card = document.createElement('div');
  card.className = 'appt';

  if (a._isGroup) {
    // Bloque masivo
    const sc = CAL_BM_COLORS[a.service] || { bg:'#e8e8f0', border:'#d0d0e0', text:'#383838' };
    card.style.background = sc.bg;
    card.style.border = `1.5px solid ${sc.border}`;
    card.draggable = true;
    card.style.cursor = 'grab';
    card.innerHTML = `
      <span class="appt-name" style="color:${sc.text}"><i class="fas fa-layer-group" style="font-size:8px;margin-right:4px;opacity:.7"></i>${a.service}</span>
      <div class="appt-meta" style="color:${sc.text};opacity:.75"><i class="fas fa-users" style="font-size:8px"></i> Grupal
        <span class="appt-dur-label" style="background:rgba(0,0,0,0.07);color:${sc.text}">${a.dur} min</span>
      </div>`;
    card.addEventListener('dragstart', e => {
      calDragAppt = { ...a, _isGroupEvt: true };
      const rect = card.getBoundingClientRect(); calDragOffsetY = e.clientY - rect.top;
      card.style.opacity = '0.5'; e.dataTransfer.effectAllowed = 'move';
    });
    card.addEventListener('dragend', () => { card.style.opacity='1'; document.getElementById('drag-tooltip').style.display='none'; });
    return card;
  }

  if (isApiAppt) {
    // Cita del backend
    const isCancelled = ['cancelled','expired','no_show'].includes(a.status);
    const isPast      = _calApptIsInPast(a);
    const isSel = calSelectedAppts.has(calApptKey(a));
    if (isSel) card.classList.add('selected');
    if (isCancelled) card.style.opacity = '0.6';
    if (isPast) card.classList.add('appt-past');

    const svcName = calServiceMap[a.service_id]?.name || 'Servicio';
    const contactDisplay = calFmtContact(a.contact_id);
    const statusLabel = CAL_STATUS_LABELS[a.status] || a.status || '';
    const modeIcon = a.source === 'whatsapp'
      ? '<i class="fab fa-whatsapp" style="font-size:8px"></i>'
      : '<i class="fas fa-user" style="font-size:8px"></i>';
    let _localVips = {}; try { _localVips = JSON.parse(localStorage.getItem('vip_contacts') || '{}'); } catch(e) {}
    const isVip = a.is_vip || calVipMap[a.contact_id] || _localVips[a.contact_id] || false;
    const sc = getApptColor(a);
    const vipBadge = isVip ? `<div style="position:absolute;top:4px;left:5px;display:flex;flex-direction:column;align-items:center;gap:2px;z-index:12"><i class="fas fa-gift" style="color:#FFD700;font-size:11px;filter:drop-shadow(0 2px 4px rgba(100,60,0,0.8))"></i><span style="font-size:7px;font-weight:800;color:${sc.text};letter-spacing:.05em;line-height:1">VIP</span></div>` : '';

    card.style.background = sc.bg;
    card.style.border = `1.5px solid ${sc.border}`;
    card.draggable = !isPast;
    if (!isPast) card.style.cursor = 'grab';

    // Status chip: no clickeable si está cancelada/pasada
    const statusChipId = 'sChip_' + (a._id || Math.random().toString(36).slice(2));
    const statusDropId  = 'sDrop_' + (a._id || Math.random().toString(36).slice(2));
    const statusDotColor = _calStatusDotColor(a.status);
    const canChangeStatus = !isPast;

    const statusChipHtml = canChangeStatus
      ? `<button class="cal-status-chip" id="${statusChipId}" data-drop="${statusDropId}" style="color:${sc.text}">
           <span class="cal-status-dot" style="background:${statusDotColor}"></span>
           <span class="cal-status-chip-label">${statusLabel}</span>
           <svg width="7" height="5" viewBox="0 0 7 5" fill="none"><path d="M0 0l3.5 5L7 0z" fill="${sc.text}" opacity=".6"/></svg>
         </button>`
      : `<span style="font-size:9px;background:rgba(0,0,0,0.07);border-radius:10px;padding:1px 5px;color:${sc.text}">${statusLabel}</span>`;

    card.innerHTML = `
      ${isSel ? '<div class="appt-check"><i class="fas fa-check"></i></div>' : ''}
      ${vipBadge}
      <span class="appt-name" style="color:${sc.text}">${contactDisplay}</span>
      <span class="appt-service" style="color:${sc.text};opacity:.75">${svcName}</span>
      <div class="appt-meta" style="color:${sc.text};opacity:.7;flex-wrap:nowrap;overflow:hidden">
        ${modeIcon}
        ${statusChipHtml}
        <span class="appt-dur-label" style="background:rgba(0,0,0,0.07);color:${sc.text}">${a.duration || 60} min</span>
      </div>
      <div class="appt-actions">
        <button class="appt-action-btn eye-btn" style="color:${sc.text}" title="Ver detalle"><i class="fas fa-eye"></i></button>
        ${!isPast ? `<button class="appt-action-btn del-btn" style="color:${sc.text}" title="Eliminar cita"><i class="fas fa-trash-alt"></i></button>` : ''}
      </div>`;

    // Drag & drop (solo citas no canceladas ni pasadas)
    if (!isPast) {
      card.addEventListener('dragstart', e => {
        calDragAppt = { ...a, _isApiAppt: true };
        const rect = card.getBoundingClientRect(); calDragOffsetY = e.clientY - rect.top;
        card.style.opacity = '0.5'; e.dataTransfer.effectAllowed = 'move';
      });
      card.addEventListener('dragend', () => { card.style.opacity='1'; document.getElementById('drag-tooltip').style.display='none'; });
    }

    // Ojo
    card.querySelector('.eye-btn').addEventListener('click', e => { e.stopPropagation(); calShowApptDetail(a); });
    // Eliminar
    card.querySelector('.del-btn')?.addEventListener('click', e => { e.stopPropagation(); calDeleteAppointment(a); });
    // Click card → seleccionar
    card.addEventListener('click', e => {
      if (e.target.closest('.appt-action-btn') || e.target.closest('.cal-status-chip') || isCancelled || isPast) return;
      toggleApptSelect(a, card);
    });

    // Status chip dropdown (embudos style)
    if (canChangeStatus) {
      const chipEl = card.querySelector('.cal-status-chip');
      if (chipEl) {
        // Crear dropdown y adjuntar al body
        const drop = document.createElement('div');
        drop.id = statusDropId;
        drop.className = 'cal-status-dropdown';
        // Solo los estados que el backend acepta via PATCH /status
        const PATCHABLE = ['confirmed','arrived','in_progress','completed','no_show'];
        const patchableEntries = Object.entries(CAL_STATUS_LABELS).filter(([val]) => PATCHABLE.includes(val));
        patchableEntries.forEach(([val, lbl]) => {
          const opt = document.createElement('div');
          opt.className = 'cal-status-option' + (val === a.status ? ' active' : '');
          opt.dataset.status = val;
          const dotColor = _calStatusDotColor(val);
          opt.innerHTML = `<span class="cal-status-dot" style="background:${dotColor}"></span>${lbl}`;
          opt.addEventListener('click', e => {
            e.stopPropagation();
            const newStatus = opt.dataset.status;
            const newLabel  = CAL_STATUS_LABELS[newStatus] || newStatus;
            // Update chip label + dot
            const labelEl = chipEl.querySelector('.cal-status-chip-label');
            const dotEl   = chipEl.querySelector('.cal-status-dot');
            if (labelEl) labelEl.textContent = newLabel;
            if (dotEl)   dotEl.style.background = _calStatusDotColor(newStatus);
            // Mark active
            drop.querySelectorAll('.cal-status-option').forEach(o => o.classList.remove('active'));
            opt.classList.add('active');
            drop.classList.remove('open');
            chipEl.classList.remove('open');
            // Actualizar estado local
            a.status = newStatus;
            // PATCH al backend
            if (a._id) {
              apiCall(`/api/agenda/appointments/${a._id}/status`, {
                method: 'PATCH',
                body: JSON.stringify({ status: newStatus })
              }).then(res => {
                calShowToast(res.ok ? 'Estado actualizado' : 'Error al actualizar estado', res.ok ? 'success' : 'error');
              });
            }
          });
          drop.appendChild(opt);
        });
        document.body.appendChild(drop);

        chipEl.addEventListener('click', e => {
          e.stopPropagation();
          const isOpen = drop.classList.contains('open');
          // Cerrar todos los dropdowns de status
          document.querySelectorAll('.cal-status-dropdown.open').forEach(d => d.classList.remove('open'));
          document.querySelectorAll('.cal-status-chip.open').forEach(c => c.classList.remove('open'));
          if (!isOpen) {
            const rect = chipEl.getBoundingClientRect();
            drop.style.top  = (rect.bottom + 4) + 'px';
            drop.style.left = rect.left + 'px';
            drop.classList.add('open');
            chipEl.classList.add('open');
          }
        });
      }
    }

    return card;
  }

  return card;
}

// ── BLOQUE (excepción) ──
function calBuildBlockCard(b) {
  const card = document.createElement('div');
  card.className = 'appt bloqueado';
  card.innerHTML = `
    <span class="appt-name" style="color:#383838"><i class="fas fa-ban" style="font-size:9px;margin-right:3px"></i>${b.block_type || 'Bloqueado'}</span>
    ${b.reason ? `<span class="appt-service" style="color:#383838;opacity:.75">${b.reason}</span>` : ''}
    <span class="appt-service" style="color:#8a2a2a;opacity:.8">${b.resource_name || ''}</span>`;
  return card;
}

// ═══════════════════════════════════════════
//  RENDER — SEMANA
// ═══════════════════════════════════════════

function calRenderWeek() {
  const monday = calGetMonday(calCurrentDate);
  const sunday = calAddDays(monday, 6);
  const rangeEl = document.getElementById('cal-range-label');
  if (rangeEl) rangeEl.textContent = `Semana ${monday.getDate()} - ${sunday.getDate()} ${CAL_MONTHS_ES[sunday.getMonth()]} ${sunday.getFullYear()}`;

  const hdr = document.getElementById('week-header');
  if (!hdr) return;
  hdr.innerHTML = `<div class="week-gmt"><button class="cal-zoom-btn${calZoom?' zoomed':''}" onclick="toggleZoom()" title="${calZoom?'Vista normal':'Ampliar'}"><i class="fas ${calZoom?'fa-search-minus':'fa-search-plus'}"></i></button><button id="cal-sublabel-btn" class="cal-zoom-btn${calShowSubLabels?' active':''}" onclick="toggleSubLabels()" title="Mostrar/ocultar minutos" style="font-size:8px;margin-left:2px">:15</button></div>`;
  for (let d=0; d<7; d++) {
    const dd = calAddDays(monday, d);
    const isToday = calFmtDate(dd) === CAL_TODAY_STR;
    hdr.innerHTML += `<div class="week-day-hd${isToday?' today':''}"><div class="wd-name">${CAL_DAYS_ES[dd.getDay()]}</div><div class="wd-num">${dd.getDate()}</div></div>`;
  }

  const grid = document.getElementById('week-grid');
  if (!grid) return;
  grid.innerHTML = '';
  const totalHours = CAL_HOUR_END - CAL_HOUR_START;

  // Columna de horas
  const timeCol = document.createElement('div');
  timeCol.style.cssText = `grid-column:1;grid-row:1;position:relative;height:${totalHours*getHourH()}px;`;
  for (let h=0; h<totalHours; h++) {
    const hh2 = getHourH();
    const lbl = document.createElement('div');
    lbl.className = 'time-label';
    lbl.style.cssText = `position:absolute;top:${h*hh2}px;left:0;right:0;`;
    lbl.textContent = String(CAL_HOUR_START+h).padStart(2,'0')+':00';
    timeCol.appendChild(lbl);
    if (hh2 >= 54) {
      [15,30,45].forEach(m => {
        const sl = document.createElement('div');
        sl.className = 'time-label-sub';
        sl.style.cssText = `position:absolute;top:${h*hh2 + hh2*(m/60)}px;left:0;right:0;`;
        sl.textContent = String(CAL_HOUR_START+h).padStart(2,'0')+':'+ String(m).padStart(2,'0');
        sl.style.display = calShowSubLabels ? '' : 'none';
        timeCol.appendChild(sl);
      });
    }
  }
  grid.appendChild(timeCol);

  // Columnas por día
  for (let d=0; d<7; d++) {
    const dd = calAddDays(monday, d);
    const dateStr = calFmtDate(dd);
    const isToday = dateStr === CAL_TODAY_STR;
    const isWeekend = dd.getDay()===0 || dd.getDay()===6;

    const col = document.createElement('div');
    col.style.cssText = `grid-column:${d+2};grid-row:1;position:relative;height:${totalHours*getHourH()}px;border-right:1px solid #f0f0f2;background:${isToday?'#eeeef2':isWeekend?'#f3f3f5':'#f8f8fa'};`;
    col.dataset.date = dateStr;

    // Drag over
    col.addEventListener('dragover', e => {
      e.preventDefault();
      col.style.background = isToday?'#e8e8f5':isWeekend?'#edeef5':'#f0f0f8';
      const rect = col.getBoundingClientRect();
      const relY = e.clientY - rect.top - calDragOffsetY;
      const mins = calSnapToSlot(Math.round((relY / getHourH()) * 60) + CAL_HOUR_START * 60);
      const clamped = Math.max(CAL_HOUR_START*60, Math.min(mins, (CAL_HOUR_END-1)*60));
      const tip = document.getElementById('drag-tooltip');
      if (tip) { tip.textContent = calMinsToTime(clamped); tip.style.display='block'; tip.style.left=(e.clientX+12)+'px'; tip.style.top=(e.clientY-18)+'px'; }
    });
    col.addEventListener('dragleave', e => {
      col.style.background = isToday?'#eeeef2':isWeekend?'#f3f3f5':'#f8f8fa';
      if (!e.relatedTarget?.closest('[data-date]')) { const tip = document.getElementById('drag-tooltip'); if (tip) tip.style.display='none'; }
    });
    col.addEventListener('drop', async e => {
      e.preventDefault();
      col.style.background = isToday?'#eeeef2':isWeekend?'#f3f3f5':'#f8f8fa';
      if (!calDragAppt) return;
      const rect = col.getBoundingClientRect();
      const relY = e.clientY - rect.top - calDragOffsetY;
      const mins = calSnapToSlot(Math.round((relY / getHourH()) * 60) + CAL_HOUR_START * 60);
      const clamped = Math.max(CAL_HOUR_START*60, Math.min(mins, (CAL_HOUR_END-1)*60));
      const newStart = calMinsToTime(clamped);
      const newDate  = col.dataset.date;
      const tip = document.getElementById('drag-tooltip');
      if (tip) tip.style.display='none';

      const dur    = calDragAppt.duration || calDragAppt.dur || 60;
      const dragId = calDragAppt._id;

      // ── 1. VALIDAR BLOQUEOS ──
      const isBlocked = CAL_LOCAL_BLOCKS.some(b => {
        if (b.date !== newDate) return false;
        const bStart = calTimeToMinutes(b.start);
        const bEnd   = calTimeToMinutes(b.end);
        return clamped < bEnd && (clamped + dur) > bStart;
      });
      if (isBlocked) {
        calShowToast('Ese horario está bloqueado', 'warning');
        calDragAppt = null; return;
      }

      // ── 2. VALIDAR CUPO OCUPADO ──
      const isOccupied = calApiAppointments.some(a => {
        if (a._id === dragId) return false;
        if (a.date !== newDate) return false;
        if (['cancelled','no_show','expired'].includes(a.status)) return false;
        const aStart = calTimeToMinutes(a.start);
        const aEnd   = aStart + (a.duration || 60);
        return clamped < aEnd && (clamped + dur) > aStart;
      });
      if (isOccupied) {
        calShowToast('Ese horario ya está ocupado por otra cita', 'warning');
        calDragAppt = null; return;
      }

      // ── 3. MOVER ──
      if (calDragAppt._isGroupEvt) {
        const ev = CAL_GROUP_EVENTS.find(g =>
          g.date === calDragAppt.date && g.start === calDragAppt.start && g.service === calDragAppt.service
        );
        if (ev) { ev.date = newDate; ev.start = newStart; }
        calDragAppt = null;
        calRender();

      } else if (calDragAppt._isApiAppt) {
        const appt = calApiAppointments.find(a => a._id === dragId);
        if (!appt) { calDragAppt = null; return; }

        // Guardar posición original para rollback
        const origDate  = appt.date;
        const origStart = appt.start;
        const origEnd   = appt.end;

        // Optimistic update — el usuario ve el cambio de inmediato
        appt.date  = newDate;
        appt.start = newStart;
        appt.end   = calMinsToTime(clamped + dur);
        calDragAppt = null;
        calRender();

        // Persistir en backend; revertir si falla
        if (dragId) {
          const res = await apiCall(`/api/agenda/appointments/${dragId}/reschedule`, {
            method: 'PATCH',
            body: JSON.stringify({ date: newDate, start: newStart })
          });
          if (res.ok) {
            // Eliminar la cita original de memoria y recargar mes
            calApiAppointments = calApiAppointments.filter(a => a._id !== dragId);
            calLoadedMonths.delete(calFmtMonth(new Date(origDate)));
            calLoadedMonths.delete(calFmtMonth(new Date(newDate)));
            await Promise.all([
              calLoadMonthAppointments(origDate),
              origDate !== newDate ? calLoadMonthAppointments(newDate) : Promise.resolve()
            ]);
            calShowToast('Cita reagendada');
          } else {
            // Rollback visual
            appt.date  = origDate;
            appt.start = origStart;
            appt.end   = origEnd;
            calRender();
            const msg = res.data?.error || 'No se pudo reagendar';
            calShowToast(msg, 'error');
          }
        }
      }
    });

    // Líneas de hora y subhoras
    for (let h=0; h<totalHours; h++) {
      const hh = getHourH();
      // :00 — línea principal
      const l0 = document.createElement('div');
      l0.style.cssText = `position:absolute;left:0;right:0;top:${h*hh}px;height:1px;background:#e4e4e8;`;
      col.appendChild(l0);
      // :15
      const l15 = document.createElement('div');
      l15.style.cssText = `position:absolute;left:0;right:0;top:${h*hh + hh*0.25}px;height:1px;background:#f0f0f4;`;
      col.appendChild(l15);
      // :30
      const l30 = document.createElement('div');
      l30.style.cssText = `position:absolute;left:0;right:0;top:${h*hh + hh*0.5}px;height:1px;background:#eaeaee;`;
      col.appendChild(l30);
      // :45
      const l45 = document.createElement('div');
      l45.style.cssText = `position:absolute;left:0;right:0;top:${h*hh + hh*0.75}px;height:1px;background:#f0f0f4;`;
      col.appendChild(l45);
    }

    // Línea "ahora"
    if (isToday) {
      const now = new Date();
      const nowMins = now.getHours()*60+now.getMinutes() - CAL_HOUR_START*60;
      if (nowMins >= 0 && nowMins <= totalHours*60) {
        const nl = document.createElement('div');
        nl.className = 'now-line'; nl.style.top = calMinutesToPx(nowMins)+'px';
        col.appendChild(nl);
      }
    }

    // Bloqueos locales
    CAL_LOCAL_BLOCKS.filter(b => b.date === dateStr && (!calProfFilter || !b.resource_id || b.resource_id === calProfFilter)).forEach(b => {
      const startMins = calTimeToMinutes(b.start) - CAL_HOUR_START*60;
      const endMins   = calTimeToMinutes(b.end)   - CAL_HOUR_START*60;
      const card = calBuildBlockCard(b);
      card.style.cssText += `top:${calMinutesToPx(startMins)}px;height:${Math.max(calMinutesToPx(endMins-startMins),28)}px;`;
      col.appendChild(card);
    });

    // Citas del backend
    const dayAppts = calGetDayAppointments(dateStr);
    dayAppts.forEach(a => {
      const startMins = calTimeToMinutes(a.start) - CAL_HOUR_START*60;
      if (startMins < 0 || startMins >= totalHours*60) return;
      const dur = a.duration || 60;
      const card = calBuildCard(a, true);
      card.style.top    = calMinutesToPx(startMins)+'px';
      card.style.height = Math.max(calMinutesToPx(dur)-4, 28)+'px';
      col.appendChild(card);
    });

    // Bloques masivos
    CAL_GROUP_EVENTS.filter(a => a.date === dateStr).forEach(a => {
      const startMins = calTimeToMinutes(a.start) - CAL_HOUR_START*60;
      if (startMins < 0) return;
      const card = calBuildCard(a, false);
      card.style.top    = calMinutesToPx(startMins)+'px';
      card.style.height = Math.max(calMinutesToPx(a.dur)-4, 28)+'px';
      col.appendChild(card);
    });

    grid.appendChild(col);
  }
}

// ═══════════════════════════════════════════
//  RENDER — DÍA
// ═══════════════════════════════════════════

function calRenderDay() {
  const dd = calCurrentDate;
  const isToday = calFmtDate(dd) === CAL_TODAY_STR;
  const dateStr = calFmtDate(dd);

  const rangeEl = document.getElementById('cal-range-label');
  if (rangeEl) rangeEl.textContent = `${CAL_DAYS_FULL[dd.getDay()]} ${dd.getDate()} de ${CAL_MONTHS_ES[dd.getMonth()]} ${dd.getFullYear()}`;

  const hdr = document.getElementById('day-header');
  if (!hdr) return;
  hdr.innerHTML = `<div class="week-gmt"><button class="cal-zoom-btn${calZoom?' zoomed':''}" onclick="toggleZoom()" title="${calZoom?'Vista normal':'Ampliar'}"><i class="fas ${calZoom?'fa-search-minus':'fa-search-plus'}"></i></button><button id="cal-sublabel-btn" class="cal-zoom-btn${calShowSubLabels?' active':''}" onclick="toggleSubLabels()" title="Mostrar/ocultar minutos" style="font-size:8px;margin-left:2px">:15</button></div>
    <div class="day-hd-cell${isToday?' today':''}"><div class="wd-name">${CAL_DAYS_FULL[dd.getDay()]}</div><div class="wd-num">${dd.getDate()} de ${CAL_MONTHS_ES[dd.getMonth()]}</div></div>`;

  const grid = document.getElementById('day-grid');
  if (!grid) return;
  grid.innerHTML = '';
  const totalHours = CAL_HOUR_END - CAL_HOUR_START;

  const timeCol = document.createElement('div');
  timeCol.style.cssText = `grid-column:1;grid-row:1;position:relative;height:${totalHours*getHourH()}px;`;
  for (let h=0; h<totalHours; h++) {
    const hh2 = getHourH();
    const lbl = document.createElement('div');
    lbl.className = 'time-label';
    lbl.style.cssText = `position:absolute;top:${h*hh2}px;left:0;right:0;`;
    lbl.textContent = String(CAL_HOUR_START+h).padStart(2,'0')+':00';
    timeCol.appendChild(lbl);
    if (hh2 >= 54) {
      [15,30,45].forEach(m => {
        const sl = document.createElement('div');
        sl.className = 'time-label-sub';
        sl.style.cssText = `position:absolute;top:${h*hh2 + hh2*(m/60)}px;left:0;right:0;`;
        sl.textContent = String(CAL_HOUR_START+h).padStart(2,'0')+':'+ String(m).padStart(2,'0');
        sl.style.display = calShowSubLabels ? '' : 'none';
        timeCol.appendChild(sl);
      });
    }
  }
  grid.appendChild(timeCol);

  const col = document.createElement('div');
  col.style.cssText = `grid-column:2;position:relative;height:${totalHours*getHourH()}px;background:${isToday?'#eeeef2':'#f8f8fa'};`;
  for (let h=0; h<totalHours; h++) {
    const hh = getHourH();
    const l0 = document.createElement('div');
    l0.style.cssText = `position:absolute;left:0;right:0;top:${h*hh}px;height:1px;background:#e4e4e8;`;
    col.appendChild(l0);
    const l15 = document.createElement('div');
    l15.style.cssText = `position:absolute;left:0;right:0;top:${h*hh + hh*0.25}px;height:1px;background:#f0f0f4;`;
    col.appendChild(l15);
    const l30 = document.createElement('div');
    l30.style.cssText = `position:absolute;left:0;right:0;top:${h*hh + hh*0.5}px;height:1px;background:#eaeaee;`;
    col.appendChild(l30);
    const l45 = document.createElement('div');
    l45.style.cssText = `position:absolute;left:0;right:0;top:${h*hh + hh*0.75}px;height:1px;background:#f0f0f4;`;
    col.appendChild(l45);
  }
  if (isToday) {
    const now = new Date();
    const nowMins = now.getHours()*60+now.getMinutes() - CAL_HOUR_START*60;
    if (nowMins >= 0) { const nl = document.createElement('div'); nl.className='now-line'; nl.style.top=calMinutesToPx(nowMins)+'px'; col.appendChild(nl); }
  }
  // Bloqueos del día
  CAL_LOCAL_BLOCKS.filter(b => b.date === dateStr && (!calProfFilter || !b.resource_id || b.resource_id === calProfFilter)).forEach(b => {
    const startMins = calTimeToMinutes(b.start) - CAL_HOUR_START*60;
    const endMins   = calTimeToMinutes(b.end)   - CAL_HOUR_START*60;
    const card = calBuildBlockCard(b);
    card.style.cssText += `top:${calMinutesToPx(startMins)}px;height:${Math.max(calMinutesToPx(endMins-startMins),28)}px;left:6px;right:6px;`;
    col.appendChild(card);
  });
  calGetDayAppointments(dateStr).forEach(a => {
    const startMins = calTimeToMinutes(a.start) - CAL_HOUR_START*60;
    if (startMins < 0 || startMins >= totalHours*60) return;
    const card = calBuildCard(a, true);
    card.style.top    = calMinutesToPx(startMins)+'px';
    card.style.height = Math.max(calMinutesToPx(a.duration||60)-4, 28)+'px';
    card.style.left   = '6px'; card.style.right = '6px';
    col.appendChild(card);
  });
  grid.appendChild(col);
}

// ═══════════════════════════════════════════
//  RENDER — MES
// ═══════════════════════════════════════════

function calRenderMonth() {
  const y = calCurrentDate.getFullYear();
  const m = calCurrentDate.getMonth();
  const rangeEl = document.getElementById('cal-range-label');
  if (rangeEl) rangeEl.textContent = `${CAL_MONTHS_ES[m]} ${y}`;

  const firstDay = new Date(y, m, 1);
  const lastDay  = new Date(y, m+1, 0);
  let startDay   = firstDay.getDay();
  startDay = startDay===0 ? 6 : startDay-1;

  const grid = document.getElementById('month-grid');
  if (!grid) return;
  grid.innerHTML = '';

  // Fila cabecera — misma fila del grid, alineación garantizada
  const DAYS_HDR = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
  DAYS_HDR.forEach((name, i) => {
    const hd = document.createElement('div');
    hd.className = 'month-day-hd';
    if (i === 0) {
      hd.style.position = 'relative';
      hd.innerHTML = `<button class="cal-zoom-btn" id="month-zoom-btn" onclick="toggleMonthZoom()" title="${calMonthZoom ? 'Vista normal' : 'Ampliar'}" style="position:absolute;left:5px;top:50%;transform:translateY(-50%)">${calMonthZoom ? '<i class="fas fa-search-minus"></i>' : '<i class="fas fa-search-plus"></i>'}</button>${name}`;
    } else {
      hd.textContent = name;
    }
    grid.appendChild(hd);
  });

  for (let i=0; i<startDay; i++) {
    const prev = new Date(y, m, 1-startDay+i);
    const cell = document.createElement('div');
    cell.className = 'month-cell other-month';
    cell.innerHTML = `<div class="month-num other">${prev.getDate()}</div>`;
    grid.appendChild(cell);
  }
  for (let d=1; d<=lastDay.getDate(); d++) {
    const dateStr = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const isToday = dateStr === CAL_TODAY_STR;
    const cell = document.createElement('div');
    cell.className = `month-cell${isToday?' today-month':''}`;
    const numDiv = document.createElement('div');
    numDiv.className = `month-num${isToday?' today':''}`;
    numDiv.textContent = d;
    cell.appendChild(numDiv);
    const dayAppts = calGetDayAppointments(dateStr);
    const visibleAppts = calMonthZoom ? dayAppts : dayAppts.slice(0, 3);
    visibleAppts.forEach(a => {
      const sc  = getApptColor(a);
      const dot = document.createElement('div');
      dot.className = 'month-dot';
      dot.style.cssText = `background:${sc.bg};color:${sc.text};display:flex;align-items:center;justify-content:space-between;gap:4px;cursor:default;`;
      dot.innerHTML =
        `<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;">${calFmtContact(a.contact_id)} · ${CAL_STATUS_LABELS[a.status]||a.status}</span>` +
        `<button class="month-dot-eye" title="Ver detalle" style="background:none;border:none;cursor:pointer;padding:0 2px;color:inherit;opacity:.7;flex-shrink:0;font-size:10px;line-height:1;"><i class="fas fa-eye"></i></button>`;
      dot.querySelector('.month-dot-eye').addEventListener('click', function(e) {
        e.stopPropagation();
        calShowApptDetail(a);
      });
      cell.appendChild(dot);
    });
    const extra = dayAppts.length - 3;
    if (!calMonthZoom && extra > 0) { const more = document.createElement('span'); more.className='month-dot more'; more.textContent=`+${extra} más`; cell.appendChild(more); }
    // Bloqueos del día en vista mes
    const dayBlocks = CAL_LOCAL_BLOCKS.filter(b => b.date === dateStr && (!calProfFilter || !b.resource_id || b.resource_id === calProfFilter));
    dayBlocks.forEach(b => {
      const dot = document.createElement('div');
      dot.className = 'month-dot';
      dot.style.cssText = 'background:#fee2e2;color:#ef4444;display:flex;align-items:center;gap:4px;cursor:default;';
      dot.innerHTML = `<i class="fas fa-ban" style="font-size:8px;flex-shrink:0"></i><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;">${b.resource_name ? b.resource_name+' · ' : ''}${b.reason||'Bloqueado'}</span>`;
      cell.appendChild(dot);
    });
    grid.appendChild(cell);
  }
  const remaining = 7 - ((startDay + lastDay.getDate()) % 7 || 7);
  if (remaining < 7) {
    for (let d=1; d<=remaining; d++) {
      const cell = document.createElement('div');
      cell.className = 'month-cell other-month';
      cell.innerHTML = `<div class="month-num other">${d}</div>`;
      grid.appendChild(cell);
    }
  }
}

// ── RENDER PRINCIPAL ──
function calRender() {
  // Aplicar filtro de profesional temporalmente
  const _orig = calApiAppointments;
  let _filtered = _orig;
  if (calProfFilter) _filtered = _filtered.filter(a => a.resource_id === calProfFilter);
  if (calSvcFilter)  _filtered = _filtered.filter(a => a.service_id  === calSvcFilter);
  calApiAppointments = _filtered;

  if (calCurrentView === 'week')       calRenderWeek();
  else if (calCurrentView === 'day')   calRenderDay();
  else                                  calRenderMonth();

  calApiAppointments = _orig; // Restaurar siempre
}

// ── NAVEGACIÓN ──
async function navigate(dir) {
  if (calCurrentView==='week')       calCurrentDate = calAddDays(calCurrentDate, dir*7);
  else if (calCurrentView==='day')   calCurrentDate = calAddDays(calCurrentDate, dir);
  else { calCurrentDate = new Date(calCurrentDate.getFullYear(), calCurrentDate.getMonth()+dir, 1); }
  calShowLoading();
  await calEnsureMonthsLoaded();
  calRender();
  if (document.getElementById('exc-panel')?.classList.contains('open')) calRenderExcList();
}
async function goToday() {
  calCurrentDate = new Date();
  await calEnsureMonthsLoaded();
  calRender();
  if (document.getElementById('exc-panel')?.classList.contains('open')) calRenderExcList();
}

function setView(v) {
  calCurrentView = v;
  document.querySelectorAll('.cal-view-btn').forEach((b,i) => b.classList.toggle('active', ['day','week','month'][i]===v));
  document.getElementById('view-week')?.classList.toggle('active', v==='week');
  document.getElementById('view-day')?.classList.toggle('active', v==='day');
  document.getElementById('view-month')?.classList.toggle('active', v==='month');
  calRender();
  if (document.getElementById('exc-panel')?.classList.contains('open')) calRenderExcList();
}

// ── MODAL NUEVA CITA ──
// ── MINI CALENDARIO — MODAL NUEVA HORA ──
let calModalDpYear, calModalDpMonth;
let calModalSelectedDate = null;
let calModalSelectedSlot = null;


function calModalDpNav(dir) {
  calModalDpMonth += dir;
  if (calModalDpMonth > 11) { calModalDpMonth = 0; calModalDpYear++; }
  if (calModalDpMonth < 0)  { calModalDpMonth = 11; calModalDpYear--; }
  calModalDpRender();
}

function calModalDpRender() {
  const monthEl = document.getElementById('appt-modal-cal-month');
  if (!monthEl) return;
  monthEl.textContent = CAL_MONTHS_ES[calModalDpMonth] + ' ' + calModalDpYear;

  const firstDay = new Date(calModalDpYear, calModalDpMonth, 1);
  const lastDay  = new Date(calModalDpYear, calModalDpMonth + 1, 0);
  const offset   = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
  const todayDate = new Date();
  todayDate.setHours(0,0,0,0);

  let html = '';
  for (let i = 0; i < offset; i++) html += '<div class="appt-cal-day appt-cal-empty"></div>';
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const ds  = calModalDpYear + '-' + String(calModalDpMonth+1).padStart(2,'0') + '-' + String(d).padStart(2,'0');
    const dt  = new Date(calModalDpYear, calModalDpMonth, d);
    const isPast     = dt < todayDate;
    const isSelected = ds === calModalSelectedDate;
    const isToday    = ds === CAL_TODAY_STR;
    let cls = 'appt-cal-day';
    if (isPast)       cls += ' appt-cal-past';
    else if (isSelected) cls += ' appt-cal-selected';
    else if (isToday) cls += ' appt-cal-today';
    const click = isPast ? '' : `onclick="calModalDpSelect('${ds}')"`;
    html += `<div class="${cls}" ${click}>${d}</div>`;
  }
  document.getElementById('appt-modal-cal-grid').innerHTML = html;
}

async function calModalDpSelect(dateStr) {
  calModalSelectedDate = dateStr;
  calModalSelectedSlot = null;
  document.getElementById('appt-date').value  = dateStr;
  document.getElementById('appt-start').value = '';
  document.getElementById('appt-end').value   = '';
  calModalDpRender();

  // En modo reagendar usar los IDs del appointment guardado como fallback
  const resourceId = document.getElementById('appt-resource')?.value || (_calDetailAppt?.resource_id) || '';
  const serviceId  = document.getElementById('appt-service')?.value  || (_calDetailAppt?.service_id)  || '';
  if (!resourceId || !serviceId) {
    calShowToast('Selecciona profesional y servicio primero', 'warning');
    return;
  }
  await calLoadAvailability(resourceId, serviceId, dateStr);
}

function calModalOnResourceChange() {
  calModalSelectedDate = null;
  calModalSelectedSlot = null;
  document.getElementById('appt-slots-group').style.display = 'none';
  document.getElementById('appt-date').value  = '';
  document.getElementById('appt-start').value = '';
  calPopulateServiceSelect();
  calModalDpRender();
}

function calModalOnServiceChange() {
  calModalSelectedSlot = null;
  document.getElementById('appt-start').value = '';
  document.getElementById('appt-end').value   = '';
  if (calModalSelectedDate) {
    const resourceId = document.getElementById('appt-resource')?.value;
    const serviceId  = document.getElementById('appt-service')?.value;
    if (resourceId && serviceId) calLoadAvailability(resourceId, serviceId, calModalSelectedDate);
  }
}

async function calLoadAvailability(resourceId, serviceId, dateStr) {
  const group     = document.getElementById('appt-slots-group');
  const container = document.getElementById('appt-slots-container');
  if (!group || !container) return;

  group.style.display = 'block';
  container.innerHTML = '<span style="font-size:12px;color:#9BA3C0"><i class="fas fa-spinner fa-spin" style="margin-right:6px"></i>Cargando horas...</span>';

  let availUrl = `/api/agenda/availability/${resourceId}/${serviceId}?date=${dateStr}`;
  if (_calDetailAppt && _calDetailAppt._id) availUrl += `&exclude_appointment_id=${_calDetailAppt._id}`;
  const res = await apiCall(availUrl);

  if (!res.ok || !res.data?.slots?.length) {
    container.innerHTML = '<span style="font-size:12px;color:#ef4444"><i class="fas fa-calendar-times" style="margin-right:6px"></i>Sin horas disponibles para este día</span>';
    return;
  }

  container.innerHTML = res.data.slots.map(slot =>
    `<button class="appt-slot-btn" onclick="calModalSelectSlot('${slot.start}','${slot.end}',this)">${slot.start}</button>`
  ).join('');
}

function calModalSelectSlot(start, end, btn) {
  calModalSelectedSlot = { start, end };
  document.getElementById('appt-start').value = start;
  document.getElementById('appt-end').value   = end;
  document.querySelectorAll('.appt-slot-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

function closeModal() {
  document.getElementById('modal-appt')?.classList.remove('open');
  _calEditingApptId = null;
  // Ocultar resumen de cita
  const infoEl = document.getElementById('appt-detail-info');
  if (infoEl) infoEl.style.display = 'none';
  _calDetailAppt = null;
  // Restaurar campos ocultos
  const clientGroup  = document.getElementById('appt-client')?.closest('.form-group');
  const serviceGroup = document.getElementById('appt-service-chips')?.closest('.form-group');
  const dateGroup    = document.getElementById('appt-date-group');
  const toggleBtn    = document.getElementById('appt-reagendar-toggle');
  if (clientGroup)  clientGroup.style.display  = '';
  if (serviceGroup) serviceGroup.style.display = '';
  if (dateGroup)    dateGroup.style.display    = '';
  if (toggleBtn)    toggleBtn.style.display    = '';
  // Restaurar título y botón para nueva cita
  const titleEl = document.querySelector('#modal-appt .modal-title');
  if (titleEl) titleEl.innerHTML = '<i class="fas fa-calendar-plus" style="color:#9961FF;margin-right:8px"></i>Nueva hora';
  const saveBtn = document.querySelector('#modal-appt .btn-save');
  if (saveBtn) { saveBtn.style.display = ''; saveBtn.innerHTML = '<i class="fas fa-check" style="margin-right:5px"></i>Guardar hora'; }
}

let _calEditingApptId = null;

async function saveAppt() {
  // En modo reagendar, los IDs vienen del appointment guardado si el select está vacío
  const resourceId = document.getElementById('appt-resource')?.value || (_calDetailAppt?.resource_id) || '';
  const serviceId  = document.getElementById('appt-service')?.value  || (_calDetailAppt?.service_id)  || '';
  const date       = document.getElementById('appt-date')?.value;
  const start      = document.getElementById('appt-start')?.value;
  const contact    = document.getElementById('appt-client')?.value?.trim() || (_calDetailAppt ? calFmtContact(_calDetailAppt.contact_id) : '');
  const notes      = document.getElementById('appt-notes')?.value || '';
  const status     = document.getElementById('appt-status')?.value || '';

  if (!resourceId) { calShowToast('Selecciona un profesional', 'warning'); return; }
  if (!serviceId)  { calShowToast('Selecciona un servicio', 'warning'); return; }
  if (!date)       { calShowToast('Selecciona una fecha', 'warning'); return; }
  if (!start)      { calShowToast('Selecciona una hora disponible', 'warning'); return; }
  if (!contact)    { calShowToast('Ingresa el nombre del cliente', 'warning'); return; }

  // Editar cita existente
  if (_calEditingApptId) {
    const apptIdx = calApiAppointments.findIndex(a => a._id === _calEditingApptId);

    // Actualizar estado si cambió
    if (status && apptIdx >= 0 && calApiAppointments[apptIdx].status !== status) {
      await apiCall(`/api/agenda/appointments/${_calEditingApptId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }).catch(() => {});
    }

    // Reagendar si cambió fecha/hora
    if (apptIdx >= 0) {
      const old = calApiAppointments[apptIdx];
      if (old.date !== date || old.start !== start) {
        const res = await apiCall(`/api/agenda/appointments/${_calEditingApptId}/reschedule`, {
          method: 'PATCH',
          body: JSON.stringify({ date, start }),
        });
        if (res.ok) {
          // Eliminar la cita original de memoria antes de recargar
          // Si no se hace, el reload trae la original (rescheduled) + la nueva → duplicado
          const oldId = _calEditingApptId;
          calApiAppointments = calApiAppointments.filter(a => a._id !== oldId);
          // Invalidar meses afectados y recargar
          calLoadedMonths.delete(calFmtMonth(new Date(old.date)));
          calLoadedMonths.delete(calFmtMonth(new Date(date)));
          await Promise.all([
            calLoadMonthAppointments(old.date),
            old.date !== date ? calLoadMonthAppointments(date) : Promise.resolve()
          ]);
          calShowToast('Cita reagendada');
        } else {
          const errMsg = res.data?.error || 'Error al reagendar';
          calShowToast(errMsg, 'error');
        }
      } else if (status) {
        calApiAppointments[apptIdx].status = status;
        calShowToast('Estado actualizado');
      }
    }
    _calEditingApptId = null;
    closeModal(); calRender();
    return;
  }

  // Crear nueva cita
  const user = getUserFromToken();
  const ok = await calCreateAppointment({
    resource_id: resourceId,
    service_id:  serviceId,
    contact_id:  contact,
    date, start,
    notes,
    source:      'panel',
    created_by:  user?.sub || user?.user_id || '',
  });
  if (ok) { closeModal(); calRender(); }
}

function _calFmtDateLong(dateStr) {
  const dias = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  const d = new Date(dateStr + 'T12:00:00');
  return dias[d.getDay()] + ' ' + d.getDate() + ' de ' + CAL_MONTHS_ES[d.getMonth()].toLowerCase() + ' ' + d.getFullYear();
}

function calShowApptDetail(a) {
  _calEditingApptId = a._id || null;

  // Cambiar título a "Detalle de cita"
  const titleEl = document.querySelector('#modal-appt .modal-title');
  if (titleEl) titleEl.innerHTML = '<i class="fas fa-calendar-check" style="color:#9961FF;margin-right:8px"></i>Detalle de cita';

  // Poblar resumen de cita actual
  const infoEl = document.getElementById('appt-detail-info');
  if (infoEl) {
    const resourceName = calResources.find(r => r._id === a.resource_id)?.name || '—';
    const svcName      = calServiceMap[a.service_id]?.name || '—';
    const fechaLarga   = a.date ? _calFmtDateLong(a.date) : '—';
    const horaStr      = a.start ? (a.end ? a.start + ' — ' + a.end : a.start) : '—';
    const clienteStr   = calFmtContact(a.contact_id) || '—';
    document.getElementById('appt-info-resource').textContent = resourceName;
    document.getElementById('appt-info-service').textContent  = svcName;
    document.getElementById('appt-info-date').textContent     = fechaLarga;
    document.getElementById('appt-info-time').textContent     = horaStr;
    document.getElementById('appt-info-client').textContent   = clienteStr;
    infoEl.style.display = '';
  }

  // Ocultar campos ya visibles en el resumen
  const clientGroup  = document.getElementById('appt-client')?.closest('.form-group');
  const serviceGroup = document.getElementById('appt-service-chips')?.closest('.form-group');
  if (clientGroup)  clientGroup.style.display  = 'none';
  if (serviceGroup) serviceGroup.style.display = 'none';

  // Pre-rellenar campos igual que el original
  const dateEl = document.getElementById('appt-date');
  const startEl = document.getElementById('appt-start');
  const durEl = document.getElementById('appt-duration');
  const clientEl = document.getElementById('appt-client');
  const notesEl = document.querySelector('#modal-appt textarea');

  if (dateEl)   dateEl.value   = a.date  || '';
  if (startEl)  startEl.value  = a.start || '';
  if (durEl)    durEl.value    = a.duration || 60;
  if (clientEl) clientEl.value = calFmtContact(a.contact_id);
  if (notesEl)  notesEl.value  = a.notes || '';

  // Selects: recurso y servicio
  const resourceEl = document.getElementById('appt-resource');
  const serviceEl  = document.getElementById('appt-service');
  if (resourceEl && a.resource_id) resourceEl.value = a.resource_id;
  if (serviceEl  && a.service_id)  serviceEl.value  = a.service_id;

  // Estado
  const statusEl = document.getElementById('appt-status');
  if (statusEl) {
    const statusLabel = CAL_STATUS_LABELS[a.status] || a.status || '';
    const exists = [...statusEl.options].some(o => o.value === a.status || o.text === statusLabel);
    if (!exists) {
      const opt = document.createElement('option');
      opt.value = a.status; opt.textContent = statusLabel; opt.selected = true;
      statusEl.appendChild(opt);
    } else {
      statusEl.value = a.status;
    }
  }

  // Guardar datos de la cita para usarlos al expandir
  _calDetailAppt = a;

  // Ocultar calendario, slots y botón confirmar hasta que el usuario presione Reagendar
  const dateGroup  = document.getElementById('appt-date-group');
  const slotsGroup = document.getElementById('appt-slots-group');
  const saveBtn    = document.querySelector('#modal-appt .btn-save');
  const toggleBtn  = document.getElementById('appt-reagendar-toggle');
  if (dateGroup)  dateGroup.style.display  = 'none';
  if (slotsGroup) slotsGroup.style.display = 'none';
  if (saveBtn)    saveBtn.style.display    = 'none';

  // Deshabilitar reagendar si la cita ya pasó
  if (toggleBtn) {
    if (_calApptIsInPast(a)) {
      toggleBtn.style.display = 'none';
    }
  }

  document.getElementById('modal-appt')?.classList.add('open');
}

var _calDetailAppt = null;

function calExpandReagendar() {
  const a = _calDetailAppt;
  if (!a) return;

  // Mostrar calendario y botón confirmar
  const dateGroup = document.getElementById('appt-date-group');
  const saveBtn   = document.querySelector('#modal-appt .btn-save');
  if (dateGroup) dateGroup.style.display = '';
  if (saveBtn)   { saveBtn.style.display = ''; saveBtn.innerHTML = '<i class="fas fa-calendar-check" style="margin-right:5px"></i>Reagendar'; }

  // Ocultar botón "Reagendar" del resumen
  const toggleBtn = document.getElementById('appt-reagendar-toggle');
  if (toggleBtn) toggleBtn.style.display = 'none';

  // Inicializar calendario en el mes/día de la cita
  if (a.date) {
    const parts = a.date.split('-');
    calModalDpYear       = parseInt(parts[0]);
    calModalDpMonth      = parseInt(parts[1]) - 1;
    calModalSelectedDate = a.date;
    calModalSelectedSlot = a.start ? { start: a.start } : null;
    calModalDpRender();

    if (a.resource_id && a.service_id) {
      calLoadAvailability(a.resource_id, a.service_id, a.date).then(() => {
        if (a.start) {
          document.querySelectorAll('.appt-slot-btn').forEach(function(btn) {
            if (btn.textContent.trim() === a.start) btn.classList.add('active');
          });
          document.getElementById('appt-start').value = a.start;
        }
      });
    }
  }

  // Scroll suave al calendario
  dateGroup?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
window.calExpandReagendar = calExpandReagendar;

function closeApptDetail() {
  document.getElementById('modal-appt')?.classList.remove('open');
}

// ── BLOQUEOS ──
function openExceptions() {
  calRenderExcList();
  // Fecha por defecto = hoy
  const todayStr = calFmtDate(calCurrentDate);
  document.getElementById('exc-date').value = todayStr;
  _calExcDp.sel   = todayStr;
  _calExcDp.year  = calCurrentDate.getFullYear();
  _calExcDp.month = calCurrentDate.getMonth();
  const d = calCurrentDate;
  const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  const lbl = document.getElementById('exc-dp-label');
  if (lbl) { lbl.textContent = d.getDate() + ' ' + meses[d.getMonth()] + ' ' + d.getFullYear(); lbl.style.color = ''; }
  // Popular recursos custom dropdown
  _calBuildExcResourceDrop();
  document.getElementById('exc-panel')?.classList.add('open');
}
function closeExceptions() { document.getElementById('exc-panel')?.classList.remove('open'); }

function _calExcGetPeriodDates() {
  const d = calCurrentDate;
  const fmt = dt => `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
  if (calCurrentView === 'day') {
    const ds = fmt(d);
    return { start: ds, end: ds };
  } else if (calCurrentView === 'week') {
    const day = d.getDay() === 0 ? 6 : d.getDay() - 1;
    const mon = new Date(d); mon.setDate(d.getDate() - day);
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    return { start: fmt(mon), end: fmt(sun) };
  } else {
    const y = d.getFullYear(), m = d.getMonth();
    return {
      start: `${y}-${String(m+1).padStart(2,'0')}-01`,
      end:   `${y}-${String(m+1).padStart(2,'0')}-${new Date(y,m+1,0).getDate()}`
    };
  }
}

function calRenderExcList() {
  const list = document.getElementById('exc-list');
  if (!list) return;

  // Renderizar chips de motivo
  const reasonWrap = document.getElementById('exc-filter-reason-chips');
  if (reasonWrap) {
    const reasons = ['Vacaciones','Feriado','Enfermedad','Capacitación','Sin motivo','Otro'];
    reasonWrap.innerHTML = `<div class="exc-filter-chip${calExcReasonFilter.size===0 ? ' on' : ''}" onclick="calExcReasonFilter=new Set();calRenderExcList()">Todos</div>`
      + reasons.map(r => `<div class="exc-filter-chip${calExcReasonFilter.has(r) ? ' on' : ''}" onclick="_calExcToggleReason('${r}')">${r}</div>`).join('');
  }

  const period = _calExcGetPeriodDates();
  const filtered = CAL_LOCAL_BLOCKS.filter(b =>
    b.date >= period.start && b.date <= period.end &&
    (!calProfFilter || b.resource_id === calProfFilter) &&
    (calExcReasonFilter.size === 0 || calExcReasonFilter.has(b.block_type))
  );

  if (!filtered.length) {
    list.innerHTML = '<p style="font-size:12px;color:#9BA3C0;margin-bottom:12px">Sin bloqueos en este período.</p>';
    return;
  }
  list.innerHTML = filtered.map(b => `
    <div class="exc-item">
      <div class="exc-item-date"><i class="fas fa-calendar" style="margin-right:5px"></i>${b.date} · ${b.start}–${b.end}</div>
      <div class="exc-item-reason">${b.resource_name}</div>
      <div style="font-size:11px;color:#6b7194;margin-top:2px">${b.block_type || 'Sin motivo'}</div>
      ${b.reason ? `<div style="font-size:11px;color:#9BA3C0;margin-top:1px">${b.reason}</div>` : ''}
      <button class="exc-del" onclick="deleteExc('${b.id}')"><i class="fas fa-times"></i></button>
    </div>`).join('');
}

async function addException() {
  const resourceId = document.getElementById('exc-resource')?.value;
  const date   = document.getElementById('exc-date')?.value;
  const start  = document.getElementById('exc-start')?.value || '09:00';
  const end    = document.getElementById('exc-end')?.value   || '18:00';
  const blockType = document.getElementById('exc-reason')?.value || 'Sin motivo';
  const reason    = document.getElementById('exc-motivo')?.value?.trim() || '';
  if (!date) { calShowToast('Selecciona una fecha', 'warning'); return; }
  if (!resourceId && calResources.length) { calShowToast('Selecciona un recurso', 'warning'); return; }

  if (resourceId === 'todos') {
    let ok = 0;
    for (const r of calResources) {
      const id = await calBlockSchedule(r._id, date, start, end, blockType, reason);
      if (id) ok++;
    }
    if (ok > 0) {
      document.getElementById('exc-reason').value = 'Sin motivo';
      const excReasonLbl = document.getElementById('exc-reason-label');
      if (excReasonLbl) excReasonLbl.textContent = 'Sin motivo';
      const excMotivo = document.getElementById('exc-motivo');
      if (excMotivo) excMotivo.value = '';
      calShowToast(`Bloqueo creado para ${ok} profesionales`);
      calRenderExcList();
      calRender();
    }
  } else {
    const id = await calBlockSchedule(resourceId, date, start, end, blockType, reason);
    if (id) {
      document.getElementById('exc-reason').value = 'Sin motivo';
      const excReasonLbl = document.getElementById('exc-reason-label');
      if (excReasonLbl) excReasonLbl.textContent = 'Sin motivo';
      const excMotivo = document.getElementById('exc-motivo');
      if (excMotivo) excMotivo.value = '';
      calRenderExcList();
      calRender();
    }
  }
}

async function deleteExc(id) {
  await calDeleteBlock(id);
}

// ═══════════════════════════════════════════
//  BLOQUES MASIVOS (wizard — sin cambios de API)
// ═══════════════════════════════════════════

let bmStep = 0;
const BM_TOTAL = 5;
let _bmPrograms = [];

const _BM_PALETTE = [
  { bg:'#f0eeff', border:'#ddd8fc', selBg:'#C9C2F9', selBorder:'#b0a8f5' },
  { bg:'#fdf8ec', border:'#f5e8bc', selBg:'#F7DDA0', selBorder:'#f0cc7a' },
  { bg:'#edf3fc', border:'#ccdaf5', selBg:'#B8CEF0', selBorder:'#9ab8e8' },
  { bg:'#eef8f3', border:'#c5e8d5', selBg:'#CEEBDA', selBorder:'#a8d9be' },
  { bg:'#edf7f9', border:'#bfe0e6', selBg:'#A1CED6', selBorder:'#7fb8c2' },
  { bg:'#fdf0f0', border:'#f5cccc', selBg:'#F5BCBC', selBorder:'#e89898' },
  { bg:'#fff4ec', border:'#ffdfc5', selBg:'#FFBE96', selBorder:'#ff9f66' },
  { bg:'#f0f5ff', border:'#c9d9ff', selBg:'#A8C0FF', selBorder:'#85a8ff' },
];

function _bmDurMins(prog) {
  const d = parseFloat(prog.duracion) || 60;
  const u = (prog.duracion_unidad || 'min').toLowerCase();
  return u === 'hr' ? Math.round(d * 60) : Math.round(d);
}

function _bmDurLabel(prog) {
  const mins = _bmDurMins(prog);
  if (mins >= 60) {
    const h = Math.floor(mins / 60), m = mins % 60;
    return m > 0 ? `${h} hr ${m} min por sesión` : `${h} hr${h > 1 ? 's' : ''} por sesión`;
  }
  return `${mins} min por sesión`;
}

function _bmWeeksCount(prog) {
  const enc = parseInt(prog.encuentros) || 8;
  const frec = (prog.frecuencia || '').toLowerCase();
  if (frec.includes('quincenal')) return enc * 2;
  if (frec.includes('mensual'))   return enc * 4;
  return enc;
}

function _bmWeeksLabel(prog) {
  const enc  = parseInt(prog.encuentros) || 0;
  const frec = (prog.frecuencia || '').toLowerCase();
  if (!enc) return '';
  if (frec.includes('mensual'))   return `${enc} mes${enc > 1 ? 'es' : ''}`;
  if (frec.includes('quincenal')) return `${enc * 2} semanas`;
  if (frec.includes('semanal'))   return `${enc} semana${enc > 1 ? 's' : ''}`;
  return `${enc} encuentros`;
}

async function _bmLoadPrograms() {
  if (typeof apiCall === 'undefined') return;
  try {
    const [r1, r2] = await Promise.all([
      apiCall('/api/perfil-profesional/programas?tipo=empresa'),
      apiCall('/api/perfil-profesional/programas?tipo=profesional'),
    ]);
    const p1 = (r1.ok && r1.data?.programas) ? r1.data.programas : [];
    const p2 = (r2.ok && r2.data?.programas) ? r2.data.programas : [];
    _bmPrograms = [...p1, ...p2];
  } catch(e) { _bmPrograms = []; }
  _bmRenderChips();
}

function _bmRenderChips() {
  const container = document.getElementById('bm-chips-container');
  if (!container) return;
  if (!_bmPrograms.length) {
    container.innerHTML = '<div style="color:#9ca3af;font-size:12px;padding:12px 0">No hay programas creados en Configuración.</div>';
    return;
  }
  container.innerHTML = _bmPrograms.map((p, i) => {
    const pal = _BM_PALETTE[i % _BM_PALETTE.length];
    const durLabel   = _bmDurLabel(p);
    const weeksLabel = _bmWeeksLabel(p);
    const name = p.nombre || p.name || '';
    return `<div class="bm-chip"
      data-prog-id="${p.id || p._id || ''}"
      data-sel-bg="${pal.selBg}" data-sel-border="${pal.selBorder}"
      data-def-bg="${pal.bg}" data-def-border="${pal.border}"
      style="background:${pal.bg};border-color:${pal.border}"
      onclick="bmSelectService(this,${JSON.stringify(name)})">
      <div>
        <span class="bm-chip-name">${name}</span>
        <span class="bm-chip-dur">${durLabel}</span>
        ${weeksLabel ? `<span class="bm-chip-weeks">${weeksLabel}</span>` : ''}
      </div>
    </div>`;
  }).join('');
}
let bmData = { servicio:'', duracion: 60, scheduledDates: [] };

let bmDpYear, bmDpMonth, bmDpSelected = null;
const MONTHS_DP = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function bmDpInit() { const now = new Date(); bmDpYear = now.getFullYear(); bmDpMonth = now.getMonth(); bmDpRender(); }
function bmDpToggle() {
  const dd = document.getElementById('bm-dp-dropdown'); if (!dd) return;
  const open = dd.style.display === 'none'; dd.style.display = open ? 'block' : 'none';
  document.getElementById('bm-dp-display')?.classList.toggle('bm-dp-active', open);
  if (open) bmDpRender();
}
function bmDpNav(dir) {
  bmDpMonth += dir;
  if (bmDpMonth > 11) { bmDpMonth = 0; bmDpYear++; } if (bmDpMonth < 0) { bmDpMonth = 11; bmDpYear--; }
  bmDpRender();
}
function bmDpRender() {
  const monthEl = document.getElementById('bm-dp-month'); if (!monthEl) return;
  monthEl.textContent = MONTHS_DP[bmDpMonth] + ' ' + bmDpYear;
  const today2 = calFmtDate(new Date());
  const firstDay = new Date(bmDpYear, bmDpMonth, 1);
  const lastDay  = new Date(bmDpYear, bmDpMonth + 1, 0);
  let offset = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
  let html = '';
  for (let i=0; i<offset; i++) html += '<div class="bm-dp-day bm-dp-empty"></div>';
  for (let d=1; d<=lastDay.getDate(); d++) {
    const ds = bmDpYear+'-'+String(bmDpMonth+1).padStart(2,'0')+'-'+String(d).padStart(2,'0');
    let cls = 'bm-dp-day' + (ds===bmDpSelected?' bm-dp-selected':ds===today2?' bm-dp-today':'');
    html += `<div class="${cls}" onclick="bmDpSelect('${ds}')">${d}</div>`;
  }
  const grid = document.getElementById('bm-dp-grid'); if (grid) grid.innerHTML = html;
}
function bmDpSelect(ds) {
  bmDpSelected = ds;
  const el = document.getElementById('bm-date-start'); if (el) el.value = ds;
  const d = new Date(ds + 'T12:00:00');
  const lbl = document.getElementById('bm-dp-label');
  if (lbl) { lbl.textContent = d.getDate() + ' de ' + MONTHS_DP[d.getMonth()] + ' ' + d.getFullYear(); lbl.style.color = '#383838'; }
  document.getElementById('bm-dp-dropdown').style.display = 'none';
  document.getElementById('bm-dp-display')?.classList.remove('bm-dp-active');
  bmCalcEndDate(); bmDpRender();
}
function _bmDpOutsideClick(e) {
  const wrap = document.getElementById('bm-dp-wrap');
  if (wrap && !wrap.contains(e.target)) {
    const dd = document.getElementById('bm-dp-dropdown'); if (dd) dd.style.display = 'none';
    document.getElementById('bm-dp-display')?.classList.remove('bm-dp-active');
  }
}
function bmCalcEndDate() {
  const sv = document.getElementById('bm-date-start')?.value; if (!sv || !bmData.servicio) return;
  const start = new Date(sv);
  const weeks = bmData.weeks || 8;
  start.setDate(start.getDate() + (weeks === 0 ? 1 : weeks * 7));
  const endStr = start.toISOString().split('T')[0];
  const endEl = document.getElementById('bm-date-end'); if (endEl) endEl.value = endStr;
  const endLbl = document.getElementById('bm-dp-end-label');
  if (endLbl) { const ed = new Date(endStr+'T12:00:00'); endLbl.textContent = ed.getDate()+' de '+MONTHS_DP[ed.getMonth()]+' '+ed.getFullYear(); endLbl.style.color='#6b7194'; }
}
function openBloques() {
  if (calResources.length > 1 && !calProfFilter) return;
  const _res = calResources.find(r => (r._id || r.resource_id) === calProfFilter) || calResources[0];
  const _resourceId   = _res?._id || _res?.resource_id || calProfFilter || '';
  const _resourceName = _res?.name || '';
  bmStep = 0;
  bmData = { servicio:'', duracion:60, weeks:8, scheduledDates:[], resource_id: _resourceId, resource_name: _resourceName };
  bmDpSelected = null;
  const lbl = document.getElementById('bm-dp-label'); if (lbl) { lbl.textContent='Seleccionar fecha'; lbl.style.color='#9BA3C0'; }
  const endLbl = document.getElementById('bm-dp-end-label'); if (endLbl) endLbl.textContent = 'Se calcula automáticamente';
  bmDpInit();
  _bmLoadPrograms();
  bmRenderStep();
  document.getElementById('bm-overlay')?.classList.add('open');
}
function closeBloques() { document.getElementById('bm-overlay')?.classList.remove('open'); }
function bmSelectService(el, name) {
  document.querySelectorAll('.bm-chip').forEach(c => { c.classList.remove('selected'); c.style.background=c.dataset.defBg||c.dataset.defbg||''; c.style.borderColor=c.dataset.defBorder||c.dataset.defborder||''; });
  el.classList.add('selected'); el.style.background=el.dataset.selBg||''; el.style.borderColor=el.dataset.selBorder||'';
  const prog = _bmPrograms.find(p => (p.nombre || p.name) === name);
  bmData.servicio = name;
  bmData.duracion = prog ? _bmDurMins(prog) : 60;
  bmData.weeks    = prog ? _bmWeeksCount(prog) : 8;
  bmCalcEndDate(); bmUpdateSlots();
}
let bmFcYear, bmFcMonth;
function bmInitCalendar() {
  const sv = document.getElementById('bm-date-start')?.value;
  const start = sv ? new Date(sv+'T12:00:00') : new Date();
  bmFcYear = start.getFullYear(); bmFcMonth = start.getMonth();
  if (!bmData.scheduledDates) bmData.scheduledDates = [];
  if (sv && bmData.servicio) {
    bmData.scheduledDates = [];
    const weeks = bmData.weeks || 8;
    const total = weeks === 0 ? 2 : weeks;
    for (let w=0; w<total; w++) { const d = new Date(sv+'T12:00:00'); d.setDate(d.getDate()+w*7); bmData.scheduledDates.push(calFmtDate(d)); }
  }
  bmRenderFcGrid();
}
function bmCalNav(dir) {
  bmFcMonth+=dir; if (bmFcMonth>11){bmFcMonth=0;bmFcYear++;} if (bmFcMonth<0){bmFcMonth=11;bmFcYear--;} bmRenderFcGrid();
}
function bmRenderFcGrid() {
  const MONTHS=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const monthEl=document.getElementById('bm-fc-month'); if(!monthEl) return;
  monthEl.textContent=MONTHS[bmFcMonth]+' '+bmFcYear;
  const grid=document.getElementById('bm-fc-grid'); if(!grid) return;
  const firstDay=new Date(bmFcYear,bmFcMonth,1), lastDay=new Date(bmFcYear,bmFcMonth+1,0);
  let so=firstDay.getDay()===0?6:firstDay.getDay()-1; const today2=calFmtDate(new Date());
  let html='';
  for(let i=0;i<so;i++) html+='<div class="bm-fc-day bm-fc-empty"></div>';
  for(let d=1;d<=lastDay.getDate();d++){
    const ds=bmFcYear+'-'+String(bmFcMonth+1).padStart(2,'0')+'-'+String(d).padStart(2,'0');
    const isSched=bmData.scheduledDates&&bmData.scheduledDates.includes(ds);
    let cls='bm-fc-day'+(isSched?' bm-fc-scheduled':ds===today2?' bm-fc-today':'');
    html+=`<div class="${cls}" onclick="bmToggleFcDate('${ds}')">${d}</div>`;
  }
  grid.innerHTML=html;
  const cnt=bmData.scheduledDates?bmData.scheduledDates.length:0;
  const subEl=document.getElementById('bm-cal-sub');
  if(subEl) subEl.textContent=cnt+' sesión'+(cnt!==1?'es':'')+' programada'+(cnt!==1?'s':'')+'. Toca una fecha para activarla o desactivarla.';
}
function bmToggleFcDate(ds) {
  if(!bmData.scheduledDates) bmData.scheduledDates=[];
  const idx=bmData.scheduledDates.indexOf(ds);
  if(idx>=0) bmData.scheduledDates.splice(idx,1); else { bmData.scheduledDates.push(ds); bmData.scheduledDates.sort(); }
  bmRenderFcGrid();
}
function bmUpdateSlots() {
  const sv=document.getElementById('bm-time-start')?.value; if(!sv||!sv.includes(':')) return;
  const [sh,sm]=sv.split(':').map(Number); if(isNaN(sh)||isNaN(sm)) return;
  const dur=bmData.duracion||60; const endMin=sh*60+sm+dur;
  const eH=Math.floor(endMin/60),eMi=endMin%60;
  const endStr=String(eH).padStart(2,'0')+':'+String(eMi).padStart(2,'0');
  const endEl=document.getElementById('bm-time-end'); if(endEl) endEl.value=endStr;
  const slotsEl=document.getElementById('bm-slots');
  if(slotsEl) slotsEl.innerHTML=`<span class="bm-slot">${String(sh).padStart(2,'0')}:${String(sm).padStart(2,'0')} - ${endStr}</span><span style="font-size:10px;color:#9BA3C0;margin-left:6px">${dur} min</span>`;
}
function bmRenderStep() {
  for(let i=0;i<BM_TOTAL;i++){
    const panel=document.getElementById('bm-panel-'+i); if(panel) panel.style.display=i===bmStep?'block':'none';
    const s=document.getElementById('bm-s'+i), c=document.getElementById('bm-sc'+i);
    if(s) s.className='bm-step'+(i<bmStep?' done':i===bmStep?' active':'');
    if(c) c.innerHTML=i<bmStep?'<i class="fas fa-check" style="font-size:10px"></i>':(i+1);
  }
  document.getElementById('bm-btn-back').style.display=bmStep>0?'inline-flex':'none';
  const nextBtn=document.getElementById('bm-btn-next');
  if(nextBtn) nextBtn.innerHTML=bmStep===BM_TOTAL-1?'<i class="fas fa-check" style="margin-right:6px"></i> Confirmar y crear':'Siguiente <i class="fas fa-chevron-right" style="font-size:10px;margin-left:4px"></i>';
  if(bmStep===2) bmInitCalendar();
  if(bmStep===3) bmUpdateSlots();
  if(bmStep===4) bmFillSummary();
}
function bmFillSummary() {
  const start=document.getElementById('bm-date-start')?.value, end=document.getElementById('bm-date-end')?.value;
  const tS=document.getElementById('bm-time-start')?.value, tE=document.getElementById('bm-time-end')?.value;
  const s=id=>document.getElementById(id);
  if(s('bm-r-profesional')) s('bm-r-profesional').textContent=bmData.resource_name||'—';
  if(s('bm-r-servicio')) s('bm-r-servicio').textContent=bmData.servicio||'—';
  if(s('bm-r-periodo'))  s('bm-r-periodo').textContent=start&&end?start+' – '+end:'—';
  const ses=bmData.scheduledDates?bmData.scheduledDates.length:0;
  if(s('bm-r-dias'))    s('bm-r-dias').textContent=ses+' fecha'+(ses!==1?'s':'');
  if(s('bm-r-horario')) s('bm-r-horario').textContent=(tS||'')+' a '+(tE||'');
  if(s('bm-r-slots'))   s('bm-r-slots').textContent=bmData.duracion+' min';
  if(s('bm-r-total'))   s('bm-r-total').textContent=ses+' sesiones';
  const DS=['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'], MS=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const fechasEl=document.getElementById('bm-r-fechas');
  if(fechasEl) fechasEl.innerHTML=bmData.scheduledDates?.length
    ? bmData.scheduledDates.map(ds=>{ const d=new Date(ds+'T12:00:00'); return `<span style="background:#f0ebff;border:1px solid #ddd0ff;border-radius:20px;padding:3px 10px;font-size:10.5px;font-weight:600;color:#7c3aed;white-space:nowrap">${DS[d.getDay()]} ${d.getDate()} ${MS[d.getMonth()]}</span>`; }).join('')
    : '<span style="font-size:11px;color:#9BA3C0">Sin fechas seleccionadas</span>';
}
function bmNext() {
  if(bmStep===BM_TOTAL-1){
    const tS = document.getElementById('bm-time-start')?.value || '10:00';
    if(!bmData.scheduledDates?.length || !bmData.servicio) { closeBloques(); return; }

    // Buscar service_id desde calServiceMap (mapea id→{name})
    const serviceId = Object.keys(calServiceMap).find(id => calServiceMap[id]?.name === bmData.servicio) || '';

    // Añadir a visualización local inmediata
    bmData.scheduledDates.forEach(ds => CAL_GROUP_EVENTS.push({
      date: ds, start: tS, dur: bmData.duracion,
      service: bmData.servicio, mode: 'grupo', client: 'Grupo',
      resource_id: bmData.resource_id
    }));
    calRender();
    closeBloques();

    // Guardar en backend si tenemos los datos mínimos
    if(serviceId && bmData.resource_id) {
      const btn = document.getElementById('bm-btn-next');
      if(btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; }

      Promise.all(bmData.scheduledDates.map(ds =>
        apiCall('/api/agenda/appointments', {
          method: 'POST',
          body: JSON.stringify({
            resource_id: bmData.resource_id,
            service_id:  serviceId,
            contact_id:  'grupo',
            date:        ds,
            start:       tS,
            source:      'manual',
            notes:       'Bloque masivo: ' + bmData.servicio
          })
        })
      )).then(results => {
        const failed = results.filter(r => !r.ok).length;
        if(failed === 0) {
          showToast('Bloques creados correctamente', 'success');
        } else {
          showToast(`${failed} bloque(s) no pudieron guardarse`, 'warning');
        }
        // Recargar el mes del primer bloque para reflejar cambios
        if(bmData.scheduledDates.length) {
          const firstMonth = bmData.scheduledDates[0].slice(0,7);
          calLoadedMonths.delete(firstMonth);
          calLoadMonthAppointments(firstMonth).then(() => calRender());
        }
      });
    } else {
      showToast('Bloques creados (sin servicio vinculado al backend)', 'info');
    }
    return;
  }
  bmStep=Math.min(bmStep+1,BM_TOTAL-1); bmRenderStep();
}
function bmBack() { bmStep=Math.max(bmStep-1,0); bmRenderStep(); }

// ═══════════════════════════════════════════
//  HELPERS — CITAS PASADAS
// ═══════════════════════════════════════════

function _calIsApptPast(a) {
  if (!a.date || !a.start) return false;
  const apptTime = new Date(a.date + 'T' + a.start + ':00');
  return apptTime < new Date();
}

// ═══════════════════════════════════════════
//  STATUS DROPDOWN — EMBUDOS STYLE
// ═══════════════════════════════════════════

const _CAL_STATUS_DOTS = {
  scheduled:'#378add', confirmed:'#1d9e75', reserved:'#ba7517', arrived:'#8b5cf6',
  in_progress:'#0f6e56', completed:'#888780', no_show:'#e24b4a', cancelled:'#e24b4a',
  rescheduled:'#ba7517', expired:'#888780'
};

function _calOpenStatusDrop(chip, a, textColor) {
  // Cerrar cualquier dropdown abierto
  document.querySelectorAll('.cal-status-dropdown.open').forEach(d => d.remove());
  document.querySelectorAll('.cal-status-chip.open').forEach(c => c.classList.remove('open'));

  const drop = document.createElement('div');
  drop.className = 'cal-status-dropdown open';
  document.body.appendChild(drop);

  Object.entries(CAL_STATUS_LABELS).forEach(([val, label]) => {
    const opt = document.createElement('div');
    opt.className = 'cal-status-option' + (a.status === val ? ' active' : '');
    opt.innerHTML = `<span class="cal-status-dot" style="background:${_CAL_STATUS_DOTS[val]||'#888780'}"></span>${label}`;
    opt.addEventListener('click', e => {
      e.stopPropagation();
      if (a.status === val) { drop.remove(); chip.classList.remove('open'); return; }
      // Actualizar chip inmediatamente
      const labelEl = chip.querySelector('.cal-status-label');
      const dotEl   = chip.querySelector('.cal-status-dot');
      if (labelEl) labelEl.textContent = label;
      if (dotEl)   dotEl.style.background = _CAL_STATUS_DOTS[val] || '#888780';
      // Actualizar en memoria local
      const apptRef = calApiAppointments.find(x => x._id === a._id);
      if (apptRef) apptRef.status = val;
      a.status = val;
      drop.remove(); chip.classList.remove('open');
      // PATCH al backend
      apiCall(`/api/agenda/appointments/${a._id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: val })
      }).then(res => {
        if (res.ok) calShowToast('Estado actualizado');
        else calShowToast('Error al actualizar estado', 'error');
      });
    });
    drop.appendChild(opt);
  });

  // Posicionar pegado al chip (igual que embudos)
  const rect = chip.getBoundingClientRect();
  drop.style.top  = (rect.bottom + 4) + 'px';
  drop.style.left = rect.left + 'px';
  chip.classList.add('open');
}

// ═══════════════════════════════════════════
//  EXC PANEL — CUSTOM DROPDOWNS (PROFESIONAL Y TIPO)
// ═══════════════════════════════════════════

// ═══════════════════════════════════════════
//  EXC PANEL — CUSTOM DROPDOWNS (PROFESIONAL Y TIPO)
// ═══════════════════════════════════════════

function _calBuildExcResourceDrop() {
  const drop = document.getElementById('exc-resource-drop');
  if (!drop) return;
  drop.innerHTML = '';
  const allOpt = document.createElement('div');
  allOpt.className = 'exc-custom-option';
  allOpt.textContent = 'Todos los profesionales';
  allOpt.dataset.value = 'todos';
  allOpt.addEventListener('click', function(e) {
    e.stopPropagation();
    document.getElementById('exc-resource').value = 'todos';
    const lbl = document.getElementById('exc-resource-label');
    if (lbl) { lbl.textContent = 'Todos los profesionales'; lbl.style.color = ''; }
    drop.querySelectorAll('.exc-custom-option').forEach(o => o.classList.remove('active'));
    allOpt.classList.add('active');
    _excCloseAll();
  });
  drop.appendChild(allOpt);
  calResources.forEach(r => {
    const opt = document.createElement('div');
    opt.className = 'exc-custom-option';
    opt.textContent = r.name;
    opt.dataset.value = r._id;
    opt.addEventListener('click', function(e) {
      e.stopPropagation();
      document.getElementById('exc-resource').value = r._id;
      const lbl = document.getElementById('exc-resource-label');
      if (lbl) { lbl.textContent = r.name; lbl.style.color = ''; }
      drop.querySelectorAll('.exc-custom-option').forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
      _excCloseAll();
    });
    drop.appendChild(opt);
  });
}

function _excToggleSelect(dropId, triggerId) {
  const drop    = document.getElementById(dropId);
  const trigger = document.getElementById(triggerId);
  if (!drop || !trigger) return;
  const isOpen = drop.classList.contains('open');
  _excCloseAll();
  if (!isOpen) {
    const rect = trigger.getBoundingClientRect();
    drop.style.left  = rect.left + 'px';
    drop.style.top   = (rect.bottom + 4) + 'px';
    drop.style.width = rect.width + 'px';
    drop.classList.add('open');
    trigger.classList.add('open');
    const reposition = () => {
      if (!drop.classList.contains('open')) {
        window.removeEventListener('scroll', reposition, true);
        window.removeEventListener('resize', reposition);
        return;
      }
      const r = trigger.getBoundingClientRect();
      drop.style.left  = r.left + 'px';
      drop.style.top   = (r.bottom + 4) + 'px';
      drop.style.width = r.width + 'px';
    };
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
  }
}
window._excToggleSelect = _excToggleSelect;

function _excSelReason(value) {
  document.getElementById('exc-reason').value = value;
  const lbl = document.getElementById('exc-reason-label');
  if (lbl) { lbl.textContent = value; lbl.style.color = ''; }
  _excCloseAll();
}
window._excSelReason = _excSelReason;

function _calExcToggleReason(r) {
  if (calExcReasonFilter.has(r)) calExcReasonFilter.delete(r);
  else calExcReasonFilter.add(r);
  calRenderExcList();
}
window._calExcToggleReason = _calExcToggleReason;

function _excSelectOption(dropId, hiddenId, labelId, triggerId, el) {
  document.getElementById(hiddenId).value = el.dataset.value;
  const lbl = document.getElementById(labelId);
  if (lbl) lbl.textContent = el.textContent;
  document.querySelectorAll('#' + dropId + ' .exc-custom-option').forEach(o => o.classList.remove('active'));
  el.classList.add('active');
  _excCloseAll();
}
window._excSelectOption = _excSelectOption;

// ═══════════════════════════════════════════
//  EXC PANEL — DATEPICKER ESTILO SEGUIMIENTO
// ═══════════════════════════════════════════

const _calExcDp = { year: null, month: null, sel: null };
const _CAL_MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function _excToggleDp() {
  const drop    = document.getElementById('exc-dp-dropdown');
  const trigger = document.getElementById('exc-dp-trigger');
  if (!drop) return;
  const isOpen = drop.classList.contains('open');
  _excCloseAll();
  if (!isOpen) {
    const now = new Date();
    if (!_calExcDp.year) { _calExcDp.year = now.getFullYear(); _calExcDp.month = now.getMonth(); }
    _calExcDpRender();
    if (trigger) {
      const rect = trigger.getBoundingClientRect();
      drop.style.left = rect.left + 'px';
      drop.style.top  = (rect.bottom + 4) + 'px';
    }
    drop.classList.add('open');
    if (trigger) trigger.classList.add('open');
    // Reposicionar en scroll
    const reposition = () => {
      if (!drop.classList.contains('open')) { window.removeEventListener('scroll', reposition, true); return; }
      if (trigger) { const r = trigger.getBoundingClientRect(); drop.style.left = r.left + 'px'; drop.style.top = (r.bottom + 4) + 'px'; }
    };
    window.addEventListener('scroll', reposition, true);
  }
}
window._excToggleDp = _excToggleDp;

function _excDpNav(dir) {
  _calExcDp.month += dir;
  if (_calExcDp.month > 11) { _calExcDp.month = 0; _calExcDp.year++; }
  if (_calExcDp.month < 0)  { _calExcDp.month = 11; _calExcDp.year--; }
  _calExcDpRender();
}
window._excDpNav = _excDpNav;

function _calExcDpRender() {
  const lbl  = document.getElementById('exc-dp-month');
  const grid = document.getElementById('exc-dp-grid');
  if (!lbl || !grid) return;
  lbl.textContent = _CAL_MESES[_calExcDp.month] + ' ' + _calExcDp.year;

  const first  = new Date(_calExcDp.year, _calExcDp.month, 1);
  const last   = new Date(_calExcDp.year, _calExcDp.month + 1, 0);
  const offset = first.getDay() === 0 ? 6 : first.getDay() - 1;
  const todayStr = calFmtDate(new Date());
  let html = '';
  for (let i = 0; i < offset; i++) html += '<div class="exc-dp-day exc-dp-empty"></div>';
  for (let d = 1; d <= last.getDate(); d++) {
    const ds = _calExcDp.year + '-' + String(_calExcDp.month+1).padStart(2,'0') + '-' + String(d).padStart(2,'0');
    let cls = 'exc-dp-day';
    if (ds === todayStr)       cls += ' exc-dp-today';
    if (ds === _calExcDp.sel) cls += ' exc-dp-selected';
    html += `<div class="${cls}" onclick="_excDpSelect('${ds}')">${d}</div>`;
  }
  grid.innerHTML = html;
}

function _excDpSelect(ds) {
  _calExcDp.sel = ds;
  document.getElementById('exc-date').value = ds;
  const d = new Date(ds + 'T12:00:00');
  const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  const lbl = document.getElementById('exc-dp-label');
  if (lbl) { lbl.textContent = d.getDate() + ' ' + meses[d.getMonth()] + ' ' + d.getFullYear(); lbl.style.color = ''; }
  _calExcDpRender();
  const drop = document.getElementById('exc-dp-dropdown');
  if (drop) drop.classList.remove('open');
  const trigger = document.getElementById('exc-dp-trigger');
  if (trigger) trigger.classList.remove('open');
}
window._excDpSelect = _excDpSelect;

// ═══════════════════════════════════════════
//  EXC PANEL — TIMEPICKER ESTILO SEGUIMIENTO
// ═══════════════════════════════════════════

const _calExcTp = { start: { h:9, m:0 }, end: { h:18, m:0 } };

function _excTpPosition(drop, trigger) {
  if (!drop || !trigger) return;
  const rect = trigger.getBoundingClientRect();
  drop.style.left  = rect.left + 'px';
  drop.style.top   = (rect.bottom + 4) + 'px';
  drop.style.width = rect.width + 'px';
}

function _excToggleTp(which) {
  const dropId    = 'exc-tp-' + which + '-drop';
  const triggerId = 'exc-tp-' + which + '-trigger';
  const drop      = document.getElementById(dropId);
  const trigger   = document.getElementById(triggerId);
  if (!drop) return;
  const isOpen = drop.classList.contains('open');
  _excCloseAll();
  if (!isOpen) {
    _calExcTpRender(which);
    _excTpPosition(drop, trigger);
    drop.classList.add('open');
    if (trigger) trigger.classList.add('open');
    // Reposicionar en scroll/resize mientras está abierto
    const reposition = () => {
      if (!drop.classList.contains('open')) {
        window.removeEventListener('scroll', reposition, true);
        window.removeEventListener('resize', reposition);
        return;
      }
      _excTpPosition(drop, trigger);
    };
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
  }
}
window._excToggleTp = _excToggleTp;

function _calExcTpRender(which) {
  const st   = _calExcTp[which];
  const hEl  = document.getElementById('exc-tp-' + which + '-h');
  const mEl  = document.getElementById('exc-tp-' + which + '-m');
  if (!hEl || !mEl) return;

  let hHtml = '';
  for (let h = 0; h <= 23; h++) {
    hHtml += `<div class="exc-tp-item${h === st.h ? ' active' : ''}" onclick="_excTpSelH('${which}',${h})">${String(h).padStart(2,'0')}</div>`;
  }
  hEl.innerHTML = hHtml;

  let mHtml = '';
  for (let m = 0; m < 60; m += 5) {
    mHtml += `<div class="exc-tp-item${m === st.m ? ' active' : ''}" onclick="_excTpSelM('${which}',${m})">${String(m).padStart(2,'0')}</div>`;
  }
  mEl.innerHTML = mHtml;

  setTimeout(() => {
    hEl.querySelector('.active')?.scrollIntoView({ block:'nearest' });
    mEl.querySelector('.active')?.scrollIntoView({ block:'nearest' });
  }, 20);
}

function _excTpSelH(which, h) {
  _calExcTp[which].h = h;
  _excTpApply(which);
  document.querySelectorAll(`#exc-tp-${which}-h .exc-tp-item`).forEach((el, i) => el.classList.toggle('active', i === h));
}
window._excTpSelH = _excTpSelH;

function _excTpSelM(which, m) {
  _calExcTp[which].m = m;
  _excTpApply(which);
  document.querySelectorAll(`#exc-tp-${which}-m .exc-tp-item`).forEach((el, i) => el.classList.toggle('active', i*5 === m));
  setTimeout(() => {
    const drop = document.getElementById('exc-tp-' + which + '-drop');
    if (drop) drop.classList.remove('open');
    const trigger = document.getElementById('exc-tp-' + which + '-trigger');
    if (trigger) trigger.classList.remove('open');
  }, 150);
}
window._excTpSelM = _excTpSelM;

function _excTpApply(which) {
  const st = _calExcTp[which];
  const timeStr = String(st.h).padStart(2,'0') + ':' + String(st.m).padStart(2,'0');
  document.getElementById('exc-' + which).value = timeStr;
  const disp = document.getElementById('exc-tp-' + which + '-label');
  if (disp) disp.textContent = timeStr;
}

// Cierra todos los dropdowns/pickers del panel exc
function _excCloseAll() {
  // Selects custom
  document.querySelectorAll('.exc-custom-dropdown.open').forEach(d => d.classList.remove('open'));
  document.querySelectorAll('.exc-custom-select-trigger.open').forEach(t => t.classList.remove('open'));
  // Datepicker
  const dp = document.getElementById('exc-dp-dropdown');
  if (dp) dp.classList.remove('open');
  const dpt = document.getElementById('exc-dp-trigger');
  if (dpt) dpt.classList.remove('open');
  // Timepickers
  ['start','end'].forEach(w => {
    const d = document.getElementById('exc-tp-' + w + '-drop');
    if (d) d.classList.remove('open');
    const t = document.getElementById('exc-tp-' + w + '-trigger');
    if (t) t.classList.remove('open');
  });
  // Status drops (tarjetas)
  document.querySelectorAll('.cal-status-dropdown.open').forEach(d => d.remove());
  document.querySelectorAll('.cal-status-chip.open').forEach(c => c.classList.remove('open'));
}

// Click fuera cierra todo
document.addEventListener('click', function(ev) {
  if (ev.target.closest('.exc-custom-select-wrap')) return;
  if (ev.target.closest('.exc-dp-wrap')) return;
  if (ev.target.closest('.exc-tp-wrap')) return;
  if (ev.target.closest('.cal-status-chip') || ev.target.closest('.cal-status-dropdown')) return;
  _excCloseAll();
});

// ═══════════════════════════════════════════
//  INIT PAGE
// ═══════════════════════════════════════════

async function initCalendarioPage() {
  // Reset estado
  calCurrentDate  = new Date();
  calCurrentView  = 'week';
  calZoom         = false;
  calWheelZoom    = 72;
  calShowSubLabels = false;
  calProfFilter   = null;
  calSvcFilter    = null;
  calVipMap       = {};
  calApiAppointments = [];
  calResources       = [];
  calServiceMap      = {};
  calContactMap      = {};
  calLoadedMonths    = new Set();
  CAL_GROUP_EVENTS   = [];
  CAL_LOCAL_BLOCKS   = [];
  calExcReasonFilter = new Set();
  calSelectedAppts.clear();
  CAL_LOCAL_MOVES.clear();
  document.documentElement.style.setProperty('--hour-h', getHourH() + 'px');

  // Vista semana activa por defecto
  document.querySelectorAll('.cal-view-btn').forEach((b,i) => b.classList.toggle('active', i === 1));
  document.getElementById('view-week')?.classList.add('active');
  document.getElementById('view-day')?.classList.remove('active');
  document.getElementById('view-month')?.classList.remove('active');

  calShowLoading();

  // Cargar datos en paralelo
  await Promise.all([
    calLoadResources(),
    calEnsureMonthsLoaded()
  ]);

  calRender();

  // Datepicker cierre al click externo
  document.removeEventListener('click', _bmDpOutsideClick);
  document.addEventListener('click', _bmDpOutsideClick);

  // Ctrl+scroll — zoom vertical del grid
  const _calBody = document.querySelector('.cal-body');
  if (_calBody) {
    _calBody.addEventListener('wheel', function(e) {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const delta = e.deltaY > 0 ? -8 : 8;
      calWheelZoom = Math.max(36, Math.min(288, calWheelZoom + delta));
      document.documentElement.style.setProperty('--hour-h', calWheelZoom + 'px');
      calRender();
    }, { passive: false });
  }
}