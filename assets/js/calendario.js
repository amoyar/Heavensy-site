// ═══════════════════════════════════════════
//  CALENDARIO — HEAVENSY (conectado al backend)
// ═══════════════════════════════════════════

// ── CONFIG ──
const CAL_HOUR_START = 8;
const CAL_HOUR_END   = 19;
const CAL_HOUR_H     = 72;
let calZoom = false;

function getHourH() { return calZoom ? CAL_HOUR_H * 4 : CAL_HOUR_H; }
function toggleZoom() {
  calZoom = !calZoom;
  document.documentElement.style.setProperty('--hour-h', getHourH() + 'px');
  calRender();
}

const CAL_DAYS_ES   = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
const CAL_DAYS_FULL = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
const CAL_MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

// ── STATE ──
let calCurrentView = 'week';
let calCurrentDate = new Date();
let calProfFilter  = null;   // null = Todos, string = resource_id activo

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
      await Promise.all([
        ...calResources.map(r => calLoadServicesForResource(r._id)),
        ...calResources.map(r => calLoadBlocksForResource(r._id)),
      ]);
      calPopulateResourceSelects();
      _calRenderProfChips();
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
  const month = typeof dateOrStr === 'string' ? dateOrStr : calFmtMonth(dateOrStr);
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

  // Persistir en backend
  const res = await apiCall(`/api/agenda/appointments/${a._id}`, { method: 'DELETE' });
  if (res.ok) {
    calShowToast('Cita eliminada');
  } else {
    const res2 = await apiCall(`/api/agenda/appointments/${a._id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'cancelled' })
    });
    calShowToast(res2.ok ? 'Cita cancelada' : 'Eliminada localmente — error de conexión', res2.ok ? 'success' : 'warning');
  }
}

// ── BLOQUEAR HORARIO ──
async function calBlockSchedule(resourceId, date, start, end, reason) {
  const res = await apiCall(`/api/agenda/schedule/${resourceId}/block`, {
    method: 'POST',
    body: JSON.stringify({ date, start, end, reason })
  });
  if (res.ok) {
    // Guardar localmente para visualizar (el backend no tiene GET de excepciones en el calendario)
    CAL_LOCAL_BLOCKS.push({
      id: res.data?.exception_id || Date.now().toString(),
      resource_id: resourceId,
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
  } else {
    calShowToast('Error al eliminar bloqueo', 'error');
  }
}

let CAL_LOCAL_BLOCKS = [];

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
            date:   e.date,
            start:  e.start  || '00:00',
            end:    e.end    || '23:59',
            reason: e.reason || '',
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

  const chips = calResources.map(r => {
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
  _calRenderProfChips();
  calRender();
}

// ── POPULATE SELECTS ──
function calPopulateResourceSelects() {
  ['appt-resource', 'exc-resource', 'bm-resource'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const placeholder = id === 'exc-resource' ? '<option value="">Busca al profesional</option>' : '<option value="">Seleccionar recurso...</option>';
    el.innerHTML = placeholder + calResources.map(r =>
      `<option value="${r._id}">${r.name}</option>`
    ).join('');
  });
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
    const isSel = calSelectedAppts.has(calApptKey(a));
    if (isSel) card.classList.add('selected');
    if (isCancelled) card.style.opacity = '0.6';

    const svcName = calServiceMap[a.service_id]?.name || 'Servicio';
    const contactDisplay = calFmtContact(a.contact_id);
    const statusLabel = CAL_STATUS_LABELS[a.status] || a.status || '';
    const modeIcon = a.source === 'whatsapp'
      ? '<i class="fab fa-whatsapp" style="font-size:8px"></i>'
      : '<i class="fas fa-user" style="font-size:8px"></i>';
    let _localVips = {}; try { _localVips = JSON.parse(localStorage.getItem('vip_contacts') || '{}'); } catch(e) {}
    const isVip = a.is_vip || calVipMap[a.contact_id] || _localVips[a.contact_id] || false;
    const sc = getApptColor(a);
    const vipBadge = isVip ? `<div style="position:absolute;top:4px;right:5px;display:flex;flex-direction:column;align-items:center;gap:2px;z-index:12"><i class="fas fa-gift" style="color:#FFD700;font-size:11px;filter:drop-shadow(0 2px 4px rgba(100,60,0,0.8))"></i><span style="font-size:7px;font-weight:800;color:${sc.text};letter-spacing:.05em;line-height:1">VIP</span></div>` : '';

    card.style.background = sc.bg;
    card.style.border = `1.5px solid ${sc.border}`;
    card.draggable = !isCancelled;
    if (!isCancelled) card.style.cursor = 'grab';

    card.innerHTML = `
      ${isSel ? '<div class="appt-check"><i class="fas fa-check"></i></div>' : ''}
      ${vipBadge}
      <span class="appt-name" style="color:${sc.text}">${contactDisplay}</span>
      <span class="appt-service" style="color:${sc.text};opacity:.75">${svcName}</span>
      <div class="appt-meta" style="color:${sc.text};opacity:.7">
        ${modeIcon}
        <span style="font-size:9px;background:rgba(0,0,0,0.07);border-radius:10px;padding:1px 5px;color:${sc.text}">${statusLabel}</span>
        <span class="appt-dur-label" style="background:rgba(0,0,0,0.07);color:${sc.text}">${a.duration || 60} min</span>
      </div>
      <button class="appt-eye-btn" style="color:${sc.text}" title="Ver detalle"><i class="fas fa-eye"></i></button>
      ${!isCancelled ? `<button class="appt-del-btn" style="color:${sc.text}" title="Eliminar cita"><i class="fas fa-trash-alt"></i></button>` : ''}`;

    if (!isCancelled) {
      card.addEventListener('dragstart', e => {
        calDragAppt = { ...a, _isApiAppt: true };
        const rect = card.getBoundingClientRect(); calDragOffsetY = e.clientY - rect.top;
        card.style.opacity = '0.5'; e.dataTransfer.effectAllowed = 'move';
      });
      card.addEventListener('dragend', () => { card.style.opacity='1'; document.getElementById('drag-tooltip').style.display='none'; });
    }
    card.querySelector('.appt-eye-btn').addEventListener('click', e => { e.stopPropagation(); calShowApptDetail(a); });
    card.querySelector('.appt-del-btn')?.addEventListener('click', e => { e.stopPropagation(); calDeleteAppointment(a); });
    card.addEventListener('click', e => { if (!e.target.closest('.appt-eye-btn') && !e.target.closest('.appt-del-btn') && !isCancelled) toggleApptSelect(a, card); });
    return card;
  }

  return card;
}

// ── BLOQUE (excepción) ──
function calBuildBlockCard(b) {
  const card = document.createElement('div');
  card.className = 'appt bloqueado';
  card.innerHTML = `
    <span class="appt-name" style="color:#383838"><i class="fas fa-ban" style="font-size:9px;margin-right:3px"></i>${b.reason || 'Bloqueado'}</span>
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
  hdr.innerHTML = `<div class="week-gmt"><button class="cal-zoom-btn${calZoom?' zoomed':''}" onclick="toggleZoom()" title="${calZoom?'Vista normal':'Ampliar'}"><i class="fas ${calZoom?'fa-search-minus':'fa-search-plus'}"></i></button></div>`;
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
  timeCol.style.cssText = 'grid-column:1;grid-row:1;display:flex;flex-direction:column;';
  for (let h=0; h<totalHours; h++) {
    const lbl = document.createElement('div');
    lbl.className = 'time-label';
    lbl.textContent = String(CAL_HOUR_START+h).padStart(2,'0')+':00';
    timeCol.appendChild(lbl);
  }
  grid.appendChild(timeCol);

  // Columnas por día
  for (let d=0; d<7; d++) {
    const dd = calAddDays(monday, d);
    const dateStr = calFmtDate(dd);
    const isToday = dateStr === CAL_TODAY_STR;
    const isWeekend = dd.getDay()===0 || dd.getDay()===6;

    const col = document.createElement('div');
    col.style.cssText = `grid-column:${d+2};grid-row:1;position:relative;height:${totalHours*CAL_HOUR_H}px;border-right:1px solid #f0f0f2;background:${isToday?'#eeeef2':isWeekend?'#f3f3f5':'#f8f8fa'};`;
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
        // Actualizar en memoria INMEDIATAMENTE (optimistic update)
        const appt = calApiAppointments.find(a => a._id === dragId);
        if (appt) {
          appt.date  = newDate;
          appt.start = newStart;
          appt.end   = calMinsToTime(clamped + dur);
        }
        calDragAppt = null;
        calRender(); // el usuario ve el cambio de inmediato

        // Persistir en backend en segundo plano (sin bloquear UI)
        if (dragId) calRescheduleAppointment(dragId, newDate, newStart);
      }
    });

    // Líneas de hora
    for (let h=0; h<totalHours; h++) {
      const line = document.createElement('div');
      line.style.cssText = `position:absolute;left:0;right:0;top:${h*CAL_HOUR_H}px;height:1px;background:#f0f0f2;`;
      col.appendChild(line);
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
    CAL_LOCAL_BLOCKS.filter(b => b.date === dateStr).forEach(b => {
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
  hdr.innerHTML = `<div class="week-gmt"><button class="cal-zoom-btn${calZoom?' zoomed':''}" onclick="toggleZoom()" title="${calZoom?'Vista normal':'Ampliar'}"><i class="fas ${calZoom?'fa-search-minus':'fa-search-plus'}"></i></button></div>
    <div class="day-hd-cell${isToday?' today':''}"><div class="wd-name">${CAL_DAYS_FULL[dd.getDay()]}</div><div class="wd-num">${dd.getDate()} de ${CAL_MONTHS_ES[dd.getMonth()]}</div></div>`;

  const grid = document.getElementById('day-grid');
  if (!grid) return;
  grid.innerHTML = '';
  const totalHours = CAL_HOUR_END - CAL_HOUR_START;

  const timeCol = document.createElement('div');
  timeCol.style.cssText = 'grid-column:1;grid-row:1;display:flex;flex-direction:column;';
  for (let h=0; h<totalHours; h++) {
    const lbl = document.createElement('div');
    lbl.className = 'time-label';
    lbl.textContent = String(CAL_HOUR_START+h).padStart(2,'0')+':00';
    timeCol.appendChild(lbl);
  }
  grid.appendChild(timeCol);

  const col = document.createElement('div');
  col.style.cssText = `grid-column:2;position:relative;height:${totalHours*CAL_HOUR_H}px;background:${isToday?'#eeeef2':'#f8f8fa'};`;
  for (let h=0; h<totalHours; h++) {
    const line = document.createElement('div');
    line.style.cssText = `position:absolute;left:0;right:0;top:${h*CAL_HOUR_H}px;height:1px;background:#f0f0f2;`;
    col.appendChild(line);
  }
  if (isToday) {
    const now = new Date();
    const nowMins = now.getHours()*60+now.getMinutes() - CAL_HOUR_START*60;
    if (nowMins >= 0) { const nl = document.createElement('div'); nl.className='now-line'; nl.style.top=calMinutesToPx(nowMins)+'px'; col.appendChild(nl); }
  }
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
    dayAppts.slice(0,3).forEach(a => {
      const sc = getApptColor(a);
      const dot = document.createElement('span');
      dot.className = 'month-dot';
      dot.style.cssText = `background:${sc.bg};color:${sc.text};`;
      dot.textContent = `${calFmtContact(a.contact_id)} · ${CAL_STATUS_LABELS[a.status]||a.status}`;
      cell.appendChild(dot);
    });
    const extra = dayAppts.length - 3;
    if (extra > 0) { const more = document.createElement('span'); more.className='month-dot more'; more.textContent=`+${extra} más`; cell.appendChild(more); }
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
  if (calProfFilter) calApiAppointments = _orig.filter(a => a.resource_id === calProfFilter);

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
}
async function goToday() {
  calCurrentDate = new Date();
  await calEnsureMonthsLoaded();
  calRender();
}

function setView(v) {
  calCurrentView = v;
  document.querySelectorAll('.cal-view-btn').forEach((b,i) => b.classList.toggle('active', ['day','week','month'][i]===v));
  document.getElementById('view-week')?.classList.toggle('active', v==='week');
  document.getElementById('view-day')?.classList.toggle('active', v==='day');
  document.getElementById('view-month')?.classList.toggle('active', v==='month');
  calRender();
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

  const resourceId = document.getElementById('appt-resource')?.value;
  const serviceId  = document.getElementById('appt-service')?.value;
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

  const res = await apiCall(`/api/agenda/availability/${resourceId}/${serviceId}?date=${dateStr}`);

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

function closeModal() { document.getElementById('modal-appt')?.classList.remove('open'); _calEditingApptId = null; }

let _calEditingApptId = null;

async function saveAppt() {
  const resourceId = document.getElementById('appt-resource')?.value;
  const serviceId  = document.getElementById('appt-service')?.value;
  const date       = document.getElementById('appt-date')?.value;
  const start      = document.getElementById('appt-start')?.value;
  const contact    = document.getElementById('appt-client')?.value?.trim();
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
          calApiAppointments[apptIdx] = { ...old, date, start, status: status || old.status };
          calShowToast('Cita actualizada');
        } else {
          calShowToast('Error al reagendar', 'error');
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

function calShowApptDetail(a) {
  _calEditingApptId = a._id || null;
  const svcName = calServiceMap[a.service_id]?.name || '';

  // Cambiar título a "Detalle de cita"
  const titleEl = document.querySelector('#modal-appt .modal-title');
  if (titleEl) titleEl.innerHTML = '<i class="fas fa-calendar-check" style="color:#9961FF;margin-right:8px"></i>Detalle de cita';

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
    // Intentar seleccionar la opción, si no existe agregar una temporal
    const exists = [...statusEl.options].some(o => o.value === a.status || o.text === statusLabel);
    if (!exists) {
      const opt = document.createElement('option');
      opt.value = a.status; opt.textContent = statusLabel; opt.selected = true;
      statusEl.appendChild(opt);
    } else {
      statusEl.value = a.status;
    }
  }

  document.getElementById('modal-appt')?.classList.add('open');
}

function closeApptDetail() {
  document.getElementById('modal-appt')?.classList.remove('open');
}

// ── BLOQUEOS ──
function openExceptions() {
  calRenderExcList();
  const dateEl = document.getElementById('exc-date');
  if (dateEl) dateEl.value = calFmtDate(calCurrentDate);
  document.getElementById('exc-panel')?.classList.add('open');
}
function closeExceptions() { document.getElementById('exc-panel')?.classList.remove('open'); }

function calRenderExcList() {
  const list = document.getElementById('exc-list');
  if (!list) return;
  if (!CAL_LOCAL_BLOCKS.length) {
    list.innerHTML = '<p style="font-size:12px;color:#9BA3C0;margin-bottom:12px">Sin bloqueos registrados en esta sesión.</p>';
    return;
  }
  list.innerHTML = CAL_LOCAL_BLOCKS.map(b => `
    <div class="exc-item">
      <div class="exc-item-date"><i class="fas fa-calendar" style="margin-right:5px"></i>${b.date} · ${b.start}–${b.end}</div>
      <div class="exc-item-reason">${b.resource_name}</div>
      <div style="font-size:11px;color:#6b7194;margin-top:2px">${b.reason}</div>
      <button class="exc-del" onclick="deleteExc('${b.id}')"><i class="fas fa-times"></i></button>
    </div>`).join('');
}

async function addException() {
  const resourceId = document.getElementById('exc-resource')?.value;
  const date   = document.getElementById('exc-date')?.value;
  const start  = document.getElementById('exc-start')?.value || '09:00';
  const end    = document.getElementById('exc-end')?.value   || '18:00';
  const reason = document.getElementById('exc-reason')?.value || 'Sin motivo';
  if (!date) { calShowToast('Selecciona una fecha', 'warning'); return; }
  if (!resourceId && calResources.length) { calShowToast('Selecciona un recurso', 'warning'); return; }

  const user = getUserFromToken();
  const id = await calBlockSchedule(resourceId, date, start, end, reason);
  if (id) {
    const excReason = document.getElementById('exc-reason');
    if (excReason) excReason.value = '';
    calRenderExcList();
    calRender();
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
//  INIT PAGE
// ═══════════════════════════════════════════

async function initCalendarioPage() {
  // Reset estado
  calCurrentDate  = new Date();
  calCurrentView  = 'week';
  calZoom         = false;
  calProfFilter   = null;
  calVipMap       = {};
  calApiAppointments = [];
  calResources       = [];
  calServiceMap      = {};
  calContactMap      = {};
  calLoadedMonths    = new Set();
  CAL_GROUP_EVENTS   = [];
  CAL_LOCAL_BLOCKS   = [];
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
}
