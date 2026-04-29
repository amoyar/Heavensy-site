// ============================================
// CONV-AGENDA.JS — Panel de Agenda
// Módulo del panel derecho de conversaciones
//
// Responsabilidades:
//   - Mostrar próximas citas del contacto activo
//   - Mini calendario para seleccionar fecha
//   - Slots disponibles del día seleccionado
//   - Agendar cita para el contacto activo
//   - Colapsable igual que conv-funnels
// ============================================

console.log('✅ conv-agenda.js cargado');

// ── Labels dinámicos según rubro ──────────────────────────────
function _agendaLabel(key, fallback) {
    return (typeof getCompanyLabel === 'function') ? getCompanyLabel(key, fallback) : fallback;
}

// ── Paleta colores por especialista ──────────────────────
const _agendaSpecColors = [
    { border: '#c4b5fd', text: '#9961FF', bg: '#f5f3ff' },
    { border: '#7dd3fc', text: '#0ea5e9', bg: '#f0f9ff' },
    { border: '#6ee7b7', text: '#059669', bg: '#f0fdf4' },
    { border: '#fca5a5', text: '#ef4444', bg: '#fff1f2' },
    { border: '#fcd34d', text: '#d97706', bg: '#fffbeb' },
    { border: '#f9a8d4', text: '#ec4899', bg: '#fdf2f8' },
];
const _agendaSpecColorMap = {};
let _agendaSpecColorIdx  = 0;

function _agendaGetSpecColor(resourceId) {
    if (!resourceId) return _agendaSpecColors[0];
    if (!_agendaSpecColorMap[resourceId]) {
        _agendaSpecColorMap[resourceId] = _agendaSpecColors[_agendaSpecColorIdx % _agendaSpecColors.length];
        _agendaSpecColorIdx++;
    }
    return _agendaSpecColorMap[resourceId];
}

function _agendaAbbrevName(fullName) {
    if (!fullName) return '';
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 1) return parts[0];
    // "Dra. Juana Machuca" → "J. Machuca"
    // Ignorar prefijos como Dra/Dr/Sr/Sra
    const prefixes = ['dra.','dr.','sr.','sra.','lic.','mg.','ing.'];
    let filtered = parts.filter(p => !prefixes.includes(p.toLowerCase()));
    if (filtered.length === 1) return filtered[0];
    return filtered[0][0] + '. ' + filtered.slice(1).join(' ');
}


// ─── Estado del módulo ────────────────────────────────────────────────────────
let _agendaCurrentUserId    = null;
let _agendaCurrentCompanyId = null;
let _agendaMyResource       = null;   // recurso del profesional logueado
let _agendaMyServices       = [];     // servicios del profesional
let _agendaCountdownTimer   = null;   // timer del countdown activo
const _svcColors = ['#7c3aed','#0ea5e9','#10b981','#f59e0b','#ef4444','#ec4899','#8b5cf6','#14b8a6'];
let _agendaSelectedSvcGroup = null;   // grupo de servicio activo (todos sus especialistas)
let _agendaSelectedService  = null;   // servicio seleccionado
let _agendaSelectedDate     = null;   // fecha seleccionada en el calendario
let _agendaCalendarMonth    = null;   // mes visible (Date primer día del mes)
let _agendaSlots            = [];     // slots del día seleccionado
let _agendaBooking          = false;  // proceso de agendamiento en curso
let _agendaCompanyServices  = [];     // servicios agrupados de toda la empresa (multi-especialista)
let _agendaMultiMode        = false;  // true si hay más de 1 especialista


// ─── Auth ─────────────────────────────────────────────────────────────────────
function _agendaAuthHeaders() {
    const token =
        localStorage.getItem('token') ||
        sessionStorage.getItem('token') ||
        window._jwtToken || '';
    return {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
}


// ─── Helpers de fecha ─────────────────────────────────────────────────────────
function _agendaToday() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
}

function _agendaDateStr(date) {
    // YYYY-MM-DD en hora local (no UTC)
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function _agendaFormatDate(dateStr) {
    // "2026-04-10" → "Viernes 10 de abril"
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString('es-CL', {
        weekday: 'long', day: 'numeric', month: 'long'
    });
}

function _agendaFormatDateShort(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
}

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
               'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const DIAS  = ['Lu','Ma','Mi','Ju','Vi','Sá','Do'];


// ============================================
// ENTRADA PRINCIPAL
// Llamada desde el módulo que carga el panel
// al seleccionar una conversación
// ============================================

let _agendaLoading = false;

async function loadAgenda(companyId, userId) {
    if (_agendaLoading) return;
    _agendaLoading = true;

    // Limpiar inmediatamente para evitar doble render visible
    const container = document.getElementById('contactAgendaContainer');
    if (container) container.innerHTML = '<div style="padding:12px;text-align:center;"><i class="fas fa-spinner fa-spin" style="color:#7c3aed"></i></div>';
    if (!companyId || !userId) {
        _agendaRenderEmpty('Sin contacto seleccionado');
        return;
    }

    _agendaCurrentUserId    = userId;
    _agendaCurrentCompanyId = companyId;
    _agendaSelectedDate     = null;
    _agendaSlots            = [];

    _agendaRenderLoading();

    try {
        // Cargar el recurso del profesional logueado
        // Llamar /api/agenda/company para datos multi-especialista
        const res = await fetch(
            `${API_BASE_URL || ''}/api/agenda/company?limit=3`,
            { headers: _agendaAuthHeaders() }
        );

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        if (!data.has_agenda) {
            _agendaRenderNoAgenda();
            return;
        }

        _agendaCompanyServices = data.services || [];
        // ✅ Precargar colores de prestadores desde BD en el mapa
        (_agendaCompanyServices || []).forEach(svcGroup => {
            (svcGroup.specialists || []).forEach(spec => {
                if (spec.resource_id && spec.resource_color && !_agendaSpecColorMap[spec.resource_id]) {
                    _agendaSpecColorMap[spec.resource_id] = {
                        text:   spec.resource_color,
                        border: spec.resource_color + '4D',
                        bg:     spec.resource_color + '14'
                    };
                }
            });
        });
        _agendaSchedulingMode  = data.scheduling_mode || 'sequential';
        _agendaReservationTtl  = data.reservation_ttl || 30;
        _agendaPaymentMode     = data.payment_mode || 'manual';


        // Usar primer especialista del primer servicio como recurso de referencia
        const firstSpec = _agendaCompanyServices[0]?.specialists?.[0];
        _agendaMyResource = firstSpec ? { _id: firstSpec.resource_id } : null;
        _agendaMyServices = _agendaCompanyServices.map(s => ({
            service_id: s.specialists[0]?.service_id,
            name: s.name,
            duration: s.duration,
            price: s.price
        }));
        _agendaSelectedService = _agendaMyServices[0] || null;

        // Mes inicial = hoy
        const today = _agendaToday();
        _agendaCalendarMonth = new Date(today.getFullYear(), today.getMonth(), 1);

        // Verificar si hay reservas activas pendientes de confirmación
        const activeResList = await _agendaCheckActiveReservation();
        if (activeResList) {
            await _agendaResumeReservation(activeResList);
            return;
        }

        await _agendaRenderPanel();

    } catch (err) {
        console.error('❌ Error cargando agenda:', err);
        _agendaRenderError();
    } finally {
        _agendaLoading = false;
    }
}


// ============================================
// RESERVA ACTIVA — RETOMAR AL REABRIR
// ============================================

async function _agendaCheckActiveReservation() {
    if (!_agendaCurrentUserId || !_agendaCurrentCompanyId) return null;
    try {
        const res = await fetch(
            `${API_BASE_URL || ''}/api/agenda/active-reservation?contact_id=${_agendaCurrentUserId}`,
            { headers: _agendaAuthHeaders() }
        );
        if (!res.ok) return null;
        const data = await res.json();
        return data.reservations?.length ? data.reservations : null;
    } catch { return null; }
}

async function _agendaResumeReservation(appts) {
    const list = Array.isArray(appts) ? appts : [appts];
    const valid = list.filter(a => new Date(a.reserved_until) > new Date());
    if (!valid.length) return;

    const container = document.getElementById('contactAgendaContainer');
    if (!container) return;

    // Renderizar agenda normal primero
    await _agendaRenderPanel();

    const cont = document.getElementById('contactAgendaContainer');
    if (!cont) return;

    // Insertar un banner por cada reserva (en orden inverso para que queden en orden)
    valid.slice().reverse().forEach(function(appt, idx) {
        const reservedUntil = new Date(appt.reserved_until);
        const dateStr  = _agendaFormatDate(appt.date);

        // Buscar nombre del especialista: primero en el appt, luego en servicios locales
        let specName = appt.resource_name || '';
        if (!specName && appt.resource_id) {
            for (const svcGroup of (_agendaCompanyServices || [])) {
                const spec = (svcGroup.specialists || []).find(s => s.resource_id === appt.resource_id);
                if (spec) { specName = spec.resource_name; break; }
            }
        }

        const svcName  = appt.service_name || (_agendaMyServices.find(s => s.service_id === appt.service_id) || {}).name || (typeof getCompanyLabel === 'function' ? getCompanyLabel('servicio', 'Servicio') : 'Servicio');
        const countdownId = 'agendaCountdown_' + appt._id;

        const banner = document.createElement('div');
        banner.className = 'agenda-pending-banner';
        banner.style.cssText = 'background:#fef9c3;border:1px solid #fde047;border-radius:10px;padding:10px 12px;margin-bottom:8px;font-size:12px;color:#713f12;max-height:300px;';
        banner.innerHTML = `
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;">
                <i class="fas fa-clock" style="color:#ca8a04;font-size:13px;"></i>
                <span style="font-weight:700;font-size:13px;">Reserva pendiente de confirmación</span>
            </div>
            <div style="background:#fff8;border-radius:7px;padding:6px 8px;margin-bottom:8px;font-size:11px;">
                <div style="color:#6b7280;">${svcName}${specName ? ' · ' + specName : ''}</div>
                <div style="font-weight:700;color:#111827;">${dateStr} · ${appt.start} – ${appt.end}</div>
                <div style="margin-top:4px;">Expira en: <span id="${countdownId}" style="font-weight:700;color:#dc2626;">--:--</span></div>
            </div>
            <div style="display:flex;gap:5px;" id="bannerActions_${appt._id}">
                <button class="agenda-btn-confirm-payment"
                    onclick="_agendaBannerAskConfirm('${appt._id}', 'pay')"
                    style="flex:2;padding:5px 6px;font-size:10px;">
                    <i class="fas fa-check-circle"></i> Confirmar hora
                </button>
                <button onclick="_agendaBannerAskConfirm('${appt._id}', 'cancel')"
                    class="agenda-btn-banner-sm-cancel">
                    <i class="fas fa-times"></i> Cancelar
                </button>
            </div>
            <div id="bannerConfirm_${appt._id}" style="display:none;margin-top:6px;"></div>
        `;
        cont.prepend(banner);

        // Countdown individual
        (function(cId, until) {
            var timer = null;
            function tick() {
                var el = document.getElementById(cId);
                if (!el) { if(timer) clearTimeout(timer); return; }
                var diff = Math.max(0, until - new Date());
                var mins = Math.floor(diff / 60000);
                var secs = Math.floor((diff % 60000) / 1000);
                el.textContent = String(mins).padStart(2,'0') + ':' + String(secs).padStart(2,'0');
                el.style.color = diff < 300000 ? '#ef4444' : diff < 600000 ? '#f59e0b' : '#10b981';
                if (diff <= 0) { el.textContent = '00:00'; _agendaRenderPanel(); return; }
                timer = setTimeout(tick, 1000);
            }
            tick();
        })(countdownId, reservedUntil);
    });
}

function _agendaBannerAskConfirm(appointmentId, action) {
    const confirmDiv = document.getElementById('bannerConfirm_' + appointmentId);
    const actionsDiv = document.getElementById('bannerActions_' + appointmentId);
    if (!confirmDiv) return;

    // Si ya hay un panel de confirmación abierto, cerrarlo (toggle)
    if (confirmDiv.style.display !== 'none' && confirmDiv.dataset.action === action) {
        confirmDiv.style.display = 'none';
        confirmDiv.innerHTML = '';
        return;
    }

    const isPay    = action === 'pay';
    const bg       = isPay ? '#f0fdf4' : '#fef2f2';
    const border   = isPay ? '#bbf7d0' : '#fecaca';
    const msgColor = isPay ? '#166534' : '#991b1b';
    const msg      = isPay ? '¿Confirmar reserva efectuada?' : '¿Cancelar esta reserva?';
    const icon     = isPay ? 'fa-check-circle' : 'fa-times-circle';
    const okBg     = isPay ? '#10b981' : '#ef4444';
    const okLabel  = isPay ? 'Sí, confirmar' : 'Sí, cancelar';

    confirmDiv.dataset.action = action;
    confirmDiv.style.cssText = `display:block;background:${bg};border:0.5px solid ${border};border-radius:8px;padding:8px 10px;font-size:11px;`;
    confirmDiv.innerHTML = ''
        + `<div style="color:${msgColor};font-weight:600;margin-bottom:7px;"><i class="fas ${icon}" style="margin-right:4px;"></i>${msg}</div>`
        + '<div style="display:flex;gap:6px;">'
        + `<button onclick="_agendaBannerDismissConfirm('${appointmentId}')"
            style="flex:1;padding:4px 0;font-size:11px;color:#6b7280;background:#fff;border:0.5px solid #e5e7eb;border-radius:6px;cursor:pointer;">No</button>`
        + `<button onclick="_agendaBannerDoAction('${appointmentId}','${action}')"
            style="flex:1;padding:4px 0;font-size:11px;font-weight:600;background:${okBg};color:#fff;border:none;border-radius:6px;cursor:pointer;">${okLabel}</button>`
        + '</div>';
}

function _agendaBannerDismissConfirm(appointmentId) {
    const confirmDiv = document.getElementById('bannerConfirm_' + appointmentId);
    if (confirmDiv) { confirmDiv.style.display = 'none'; confirmDiv.innerHTML = ''; }
}

function _agendaBannerDoAction(appointmentId, action) {
    _agendaBannerDismissConfirm(appointmentId);
    const id = appointmentId === 'direct' ? window._agendaPendingAppointmentId : appointmentId;
    if (action === 'pay') {
        _agendaConfirmPayment(id);
    } else {
        _agendaCancelReservationById(id);
    }
}

async function _agendaCancelReservationById(appointmentId) {
    window._agendaPendingAppointmentId = appointmentId;
    await _agendaCancelActiveReservation();
}

function _agendaHideBannerById(appointmentId) {
    // Ocultar banner con animación suave
    var banners = document.querySelectorAll('.agenda-pending-banner');
    banners.forEach(function(b) {
        if (b.innerHTML.indexOf(appointmentId) !== -1) {
            b.classList.add('hiding');
            setTimeout(function() { if (b.parentNode) b.remove(); }, 400);
        }
    });
}


// ============================================
// RENDER PRINCIPAL
// ============================================

async function _agendaRenderPanel() {
    const container = document.getElementById('contactAgendaContainer');
    if (!container) return;

    container.innerHTML = '';

    if (_agendaSchedulingMode === 'concurrent') {
        await _agendaRenderConcurrent(container);
        return;
    }

    // ── SEQUENTIAL: siempre layout multi-especialista ────────
    await _agendaRenderMultiSpecialist(container);

    // ── 2. Separador + botón buscar por día ───
    const calToggle = document.createElement('div');
    calToggle.className = 'agenda-cal-toggle';
    calToggle.id = 'agendaCalToggle';
    calToggle.innerHTML = `
        <button class="agenda-btn-search-day" onclick="_agendaToggleCalendar()">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style="flex-shrink:0"><rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" stroke-width="2"/><path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="16" r="1.5" fill="currentColor"/><path d="M12 13v2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg> Ver más fechas
        </button>
    `;
    container.appendChild(calToggle);

    // ── 3. Calendario (oculto por defecto) ────
    const calWrapper = document.createElement('div');
    calWrapper.id = 'agendaCalWrapper';
    calWrapper.style.display    = 'none';
    calWrapper.style.maxHeight  = '0px';
    calWrapper.style.opacity    = '0';
    calWrapper.style.overflow   = 'hidden';
    calWrapper.style.transition = 'max-height 0.28s ease, opacity 0.24s ease';
    calWrapper._rpSlideInit     = true;
    calWrapper.appendChild(_agendaBuildCalendar());

    // Slots del día seleccionado
    const slotsDiv = document.createElement('div');
    slotsDiv.id = 'agendaSlotsContainer';
    if (_agendaSelectedDate) {
        await _agendaRenderSlots(slotsDiv);
    }
    calWrapper.appendChild(slotsDiv);
    container.appendChild(calWrapper);

    // ── 4. Próximas citas del contacto ────────
    await _agendaRenderContactAppointments(container);
}



// ============================================
// MULTI-ESPECIALISTA — nuevo layout
// ============================================

async function _agendaRenderMultiSpecialist(container) {
    const section = document.createElement('div');
    section.className = 'agenda-next-slots-section';

    const title = document.createElement('div');
    title.className = 'agenda-next-slots-title';
    title.innerHTML = `<i class="fas fa-bolt"></i> Próximos cupos disponibles`;
    section.appendChild(title);

    _agendaCompanyServices.forEach((svcGroup, idx) => {
        const svcColor = svcGroup.color || _svcColors[idx % _svcColors.length];
        const svcId    = `agendaSvc_${idx}`;
        const isOpen   = idx === 0;

        const svcBlock = document.createElement('div');
        svcBlock.className = 'agenda-next-svc-block';
        svcBlock.dataset.idx = idx;

        // ── Header especialidad ────────────────
        const svcName = document.createElement('div');
        svcName.className = 'agenda-next-svc-name agenda-next-svc-name--toggle';
        svcName.dataset.target = svcId;
        svcName.innerHTML = `
            <span class="agenda-next-svc-dot" style="background:${svcColor}"></span>
            <span>${svcGroup.name}</span>
            <span class="agenda-next-svc-duration">${svcGroup.duration} min</span>
            <i class="fas fa-chevron-${isOpen ? 'down' : 'right'} agenda-next-svc-chevron"></i>
        `;
        if (isOpen) {
            svcName.style.background   = svcColor + '14';
            svcName.style.border       = `1px solid ${svcColor}4D`;
        } else {
            svcName.style.background   = '#EFF6FF';
            svcName.style.border       = '0.5px solid #C9D9FF';
        }
        svcName.style.borderRadius = '5px';
        if (isOpen) svcName.classList.add('open');

        svcName.addEventListener('mouseenter', () => {
            if (!svcName.classList.contains('open')) {
                svcName.style.background = svcColor + '0D';
                svcName.style.borderColor = svcColor + '33';
            }
        });
        svcName.addEventListener('mouseleave', () => {
            if (!svcName.classList.contains('open')) {
                svcName.style.background = '#EFF6FF';
                svcName.style.borderColor = '#C9D9FF';
            }
        });

        // ── Contenido colapsable ───────────────
        const svcContent = document.createElement('div');
        svcContent.id = svcId;
        svcContent.style.display = isOpen ? 'block' : 'none';

        // Slots globales de la especialidad
        const globalRow = document.createElement('div');
        globalRow.className = 'agenda-next-slots-row';
        globalRow.style.display = 'flex';

        if (svcGroup.next_slots && svcGroup.next_slots.length > 0) {
            svcGroup.next_slots.forEach(slot => {
                const btn = document.createElement('button');
                btn.className = 'agenda-next-slot-pill';
                btn.dataset.start = slot.start;
                btn.dataset.date  = slot.date;
                // ✅ Borde del color del SERVICIO, no del especialista
                btn.style.border        = `1.5px solid ${svcColor}40`;
                btn.style.borderTop     = `2px solid ${svcColor}`;
                const _gsc = _agendaGetSpecColor(slot.resource_id);
                const _gAbbrev = _agendaAbbrevName(slot.resource_name || '');
                const _gFullName = slot.resource_name || '';
                btn.innerHTML = `
                    <span class="agenda-next-slot-date">${_agendaFormatDateShort(slot.date)}</span>
                    <span class="agenda-next-slot-time">${slot.start}</span>
                    ${_gAbbrev ? `<span class="agenda-next-slot-spec" style="color:${svcColor};" title="${_gFullName}">${_gAbbrev}</span>` : ''}
                    ${_gFullName ? `<span class="agenda-slot-tt">${_gFullName}</span>` : ''}
                `;
                const svc = {
                    service_id:   slot.service_id,
                    name:         svcGroup.name,
                    duration:     svcGroup.duration,
                    price:        svcGroup.price,
                    resource_id:  slot.resource_id,
                    resource_name: slot.resource_name
                };
                btn.addEventListener('click', () => _agendaOnNextSlotClick(svc, slot, btn, svcColor));
                globalRow.appendChild(btn);
            });
        } else {
            globalRow.innerHTML = `<span class="agenda-next-empty">Sin disponibilidad próxima</span>`;
        }
        svcContent.appendChild(globalRow);

        // ── Especialistas ──────────────────────
        if (svcGroup.specialists && svcGroup.specialists.length > 0) {
            const specsWrapper = document.createElement('div');
            specsWrapper.className = 'agenda-specialists-wrapper';

            svcGroup.specialists.forEach((spec, specIdx) => {
                const specBlock = document.createElement('div');
                specBlock.className = 'agenda-specialist-block';

                const specIsOpen = specIdx === 0;

                // Iniciales del especialista
                const initials = spec.resource_name.split(' ')
                    .filter(w => w.match(/^[A-ZÁÉÍÓÚÑ]/))
                    .slice(0, 2).map(w => w[0]).join('');

                const specHeader = document.createElement('div');
                specHeader.className = 'agenda-specialist-header';
                specHeader.style.cursor = 'pointer';
                specHeader.innerHTML = `
                    <div class="agenda-specialist-avatar" style="background:${svcColor}">${initials}</div>
                    <span class="agenda-specialist-name">${spec.resource_name}</span>
                    <i class="fas fa-chevron-down agenda-specialist-chev" style="font-size:9px;color:#9ca3af;transition:transform 0.25s ease;margin-left:auto;${specIsOpen ? '' : 'transform:rotate(-90deg);'}"></i>
                `;

                // Slots del especialista
                const specSlots = document.createElement('div');
                specSlots.className = 'agenda-next-slots-row agenda-specialist-slots';
                specSlots.style.cssText = `display:flex;overflow:hidden;transition:max-height 0.28s ease, opacity 0.24s ease;max-height:${specIsOpen ? '400px' : '0px'};opacity:${specIsOpen ? '1' : '0'};`;

                if (spec.next_slots && spec.next_slots.length > 0) {
                    spec.next_slots.forEach(slot => {
                        const btn = document.createElement('button');
                        btn.className = 'agenda-next-slot-pill agenda-next-slot-pill--sm';
                        btn.dataset.start = slot.start;
                        btn.dataset.date  = slot.date;
                        btn.style.border    = `1.5px solid ${svcColor}40`;
                        btn.style.borderTop = `2px solid ${svcColor}`;
                        btn.innerHTML = `
                            <span class="agenda-next-slot-date">${_agendaFormatDateShort(slot.date)}</span>
                            <span class="agenda-next-slot-time">${slot.start}</span>
                        `;
                        const svc = {
                            service_id:    spec.service_id,
                            name:          svcGroup.name,
                            duration:      svcGroup.duration,
                            price:         svcGroup.price,
                            resource_id:   spec.resource_id,
                            resource_name: spec.resource_name
                        };
                        btn.addEventListener('click', () => _agendaOnNextSlotClick(svc, slot, btn, svcColor));
                        specSlots.appendChild(btn);
                    });
                } else {
                    specSlots.innerHTML = `<span class="agenda-next-empty">Sin disponibilidad</span>`;
                }

                // Toggle colapso especialista
                specHeader.addEventListener('click', () => {
                    const chev = specHeader.querySelector('.agenda-specialist-chev');
                    const isNowOpen = specSlots.style.opacity === '1';
                    if (isNowOpen) {
                        specSlots.style.maxHeight = '0px';
                        specSlots.style.opacity   = '0';
                        if (chev) chev.style.transform = 'rotate(-90deg)';
                    } else {
                        specSlots.style.maxHeight = specSlots.scrollHeight + 'px';
                        specSlots.style.opacity   = '1';
                        if (chev) chev.style.transform = 'rotate(0deg)';
                    }
                });

                specBlock.appendChild(specHeader);
                specBlock.appendChild(specSlots);
                specsWrapper.appendChild(specBlock);
            });

            svcContent.appendChild(specsWrapper);
        }

        // Estado inicial del contenido
        svcContent.style.display = isOpen ? 'block' : 'none';
        if (!isOpen) {
            svcContent.style.maxHeight  = '0px';
            svcContent.style.opacity    = '0';
            svcContent.style.overflow   = 'hidden';
            svcContent.style.transition = 'max-height 0.28s ease, opacity 0.24s ease';
            svcContent._rpSlideInit = true;
        }

        // ── Toggle independiente ───────────────
        svcName.addEventListener('click', () => {
            // Si ya está abierto, no hacer nada
            const isNowOpen = svcContent.style.display !== 'none' && svcContent.style.opacity !== '0';
            if (isNowOpen) return;

            const chev = svcName.querySelector('.agenda-next-svc-chevron');
            rpSlide(svcContent, true);
            chev.className = 'fas fa-chevron-down agenda-next-svc-chevron';
            svcName.style.background   = svcColor + '14';
            svcName.style.border       = `1px solid ${svcColor}4D`;
            svcName.style.borderRadius = '5px';
            svcName.classList.add('open');

            // Cerrar y desactivar los demás
            section.querySelectorAll('.agenda-next-svc-name--toggle').forEach(other => {
                if (other !== svcName && other.classList.contains('open')) {
                    const otherTarget = document.getElementById(other.dataset.target);
                    const otherChev   = other.querySelector('.agenda-next-svc-chevron');
                    other.classList.remove('open');
                    other.style.background   = '#EFF6FF';
                    other.style.border       = '0.5px solid #C9D9FF';
                    if (otherTarget) rpSlide(otherTarget, false);
                    if (otherChev) otherChev.className = 'fas fa-chevron-right agenda-next-svc-chevron';
                }
            });

            _agendaSelectedService = {
                service_id: svcGroup.specialists[0]?.service_id,
                name: svcGroup.name, duration: svcGroup.duration, price: svcGroup.price
            };
            _agendaSelectedSvcGroup = svcGroup;

            // Si hay fecha seleccionada y calendario abierto → recargar slots
            const _calWrapper = document.getElementById('agendaCalWrapper');
            const _calOpen = _calWrapper && _calWrapper.style.display !== 'none' && _calWrapper.style.opacity !== '0';
            if (_calOpen && _agendaSelectedDate) {
                const _slotsDiv = document.getElementById('agendaSlotsContainer');
                if (_slotsDiv) _agendaRenderSlots(_slotsDiv);
            }
        });

        // ✅ Chevron colapsa el servicio abierto
        svcName.querySelector('.agenda-next-svc-chevron').addEventListener('click', (e) => {
            const isNowOpen = svcContent.style.display !== 'none' && svcContent.style.opacity !== '0';
            if (!isNowOpen) return;
            e.stopPropagation();
            rpSlide(svcContent, false);
            svcName.querySelector('.agenda-next-svc-chevron').className = 'fas fa-chevron-right agenda-next-svc-chevron';
            svcName.style.background   = '#EFF6FF';
            svcName.style.border       = '0.5px solid #C9D9FF';
            svcName.classList.remove('open');
        });

        svcBlock.appendChild(svcName);
        svcBlock.appendChild(svcContent);
        section.appendChild(svcBlock);
    });

    container.appendChild(section);
}


// ============================================
// PRÓXIMOS CUPOS POR SERVICIO
// ============================================

async function _agendaRenderNextSlotsByService(container) {
    const section = document.createElement('div');
    section.className = 'agenda-next-slots-section';

    // Título
    const title = document.createElement('div');
    title.className = 'agenda-next-slots-title';
    title.innerHTML = `<i class="fas fa-bolt"></i> Próximos cupos disponibles`;
    section.appendChild(title);

    // Renderizar estructura de todos los servicios primero (con loading)
    // luego lanzar todos los fetches en paralelo con Promise.all
    // _svcColors es global

    const fetchPromises = _agendaMyServices.map((svc, idx) => {
        const svcBlock = document.createElement('div');
        svcBlock.className = 'agenda-next-svc-block';
        svcBlock.dataset.svcId = svc.service_id;
        svcBlock.dataset.idx = idx;

        const svcName = document.createElement('div');
        svcName.className = 'agenda-next-svc-name';
        const svcColor = svc.color || _svcColors[idx % _svcColors.length];
        const svcId = `agendaSvc_${idx}`;
        // Primer servicio abierto, resto colapsados
        const isOpen = idx === 0;

        svcName.className = 'agenda-next-svc-name agenda-next-svc-name--toggle';
        svcName.dataset.target = svcId;
        svcName.innerHTML = `
            <span class="agenda-next-svc-dot" style="background:${svcColor}"></span>
            <span>${svc.name}</span>
            <span class="agenda-next-svc-duration">${svc.duration} min</span>
            <i class="fas fa-chevron-${isOpen ? 'down' : 'right'} agenda-next-svc-chevron"></i>
        `;
        svcName.addEventListener('click', () => {
            const row  = document.getElementById(svcId);
            const chev = svcName.querySelector('.agenda-next-svc-chevron');
            if (!row) return;
            const open = row.style.display !== 'none' && row.style.opacity !== '0';
            rpSlide(row, !open, { displayType: 'flex' });
            chev.className = `fas fa-chevron-${open ? 'right' : 'down'} agenda-next-svc-chevron`;
            if (!open) {
                // Activando — color del servicio (viene del closure svcColor)
                svcName.style.background   = svcColor + '14';
                svcName.style.border       = `1px solid ${svcColor}4D`;
            } else {
                // Desactivando — volver a inactivo
                svcName.style.background   = '#EFF6FF';
                svcName.style.border       = '0.5px solid #C9D9FF';
            }
            svcName.style.borderRadius = '5px';
            if (!open) { 
                svcName.classList.add('open'); 
                _agendaSelectedService = svc;
                // ✅ Trackear el svcGroup completo
                _agendaSelectedSvcGroup = _agendaCompanyServices.find(g =>
                    g.specialists?.some(s => s.service_id === svc.service_id) ||
                    g.name === svc.name
                ) || null;

                // ✅ Si hay fecha seleccionada y calendario abierto → recargar slots inmediatamente
                const _calWrapper = document.getElementById('agendaCalWrapper');
                const _calOpen = _calWrapper && _calWrapper.style.display !== 'none' && _calWrapper.style.opacity !== '0';
                if (_calOpen && _agendaSelectedDate) {
                    const _slotsDiv = document.getElementById('agendaSlotsContainer');
                    if (_slotsDiv) _agendaRenderSlots(_slotsDiv);
                }
            }
            else { svcName.classList.remove('open'); }
        });
        // Color base siempre visible; activo más fuerte
        if (isOpen) {
            svcName.style.background   = svcColor + '14';
            svcName.style.border       = `1px solid ${svcColor}4D`;
        } else {
            svcName.style.background   = '#EFF6FF';
            svcName.style.border       = '0.5px solid #C9D9FF';
        }
        svcName.style.borderRadius = '5px';
        if (isOpen) svcName.classList.add('open');

        svcName.addEventListener('mouseenter', () => {
            if (!svcName.classList.contains('open')) {
                svcName.style.background = svcColor + '0D';
                svcName.style.borderColor = svcColor + '33';
            }
        });
        svcName.addEventListener('mouseleave', () => {
            if (!svcName.classList.contains('open')) {
                svcName.style.background = '#EFF6FF';
                svcName.style.borderColor = '#C9D9FF';
            }
        });

        svcBlock.appendChild(svcName);

        const slotsRow = document.createElement('div');
        slotsRow.className = 'agenda-next-slots-row';
        slotsRow.id = svcId;
        if (!isOpen) {
            slotsRow.style.display     = 'none';
            slotsRow.style.maxHeight   = '0px';
            slotsRow.style.opacity     = '0';
            slotsRow.style.overflow    = 'hidden';
            slotsRow.style.transition  = 'max-height 0.28s ease, opacity 0.24s ease';
            slotsRow._rpSlideInit = true;
        } else {
            slotsRow.style.display = 'flex';
        }
        slotsRow.innerHTML = `<span class="agenda-next-loading"><i class="fas fa-spinner fa-spin"></i></span>`;
        svcBlock.appendChild(slotsRow);
        section.appendChild(svcBlock);

        // Retornar la promesa — se lanzan todas en paralelo
        return _agendaLoadNextSlots(svc, slotsRow, svcColor);
    });

    // Esperar todas en paralelo (no secuencial)
    await Promise.all(fetchPromises);

    container.appendChild(section);
}


async function _agendaLoadNextSlots(svc, container, color = '#7c3aed') {
    try {
        const res = await fetch(
            `${API_BASE_URL || ''}/api/agenda/availability/${_agendaMyResource._id}/${svc.service_id}?limit=3`,
            { headers: _agendaAuthHeaders() }
        );
        const data = await res.json();
        const slots = data.slots || [];

        if (slots.length === 0) {
            container.innerHTML = `<span class="agenda-next-empty">Sin disponibilidad próxima</span>`;
            return;
        }

        container.innerHTML = '';
        slots.forEach(slot => {
            const btn = document.createElement('button');
            btn.className = 'agenda-next-slot-pill';
            btn.dataset.start = slot.start;
            btn.dataset.date  = slot.date;
            btn.style.borderTopColor = color;
            btn.style.borderTopWidth = '2px';
            btn.innerHTML = `
                <span class="agenda-next-slot-date">${_agendaFormatDateShort(slot.date)}</span>
                <span class="agenda-next-slot-time">${slot.start}</span>
            `;
            btn.addEventListener('click', () => _agendaOnNextSlotClick(svc, slot, btn, color));
            container.appendChild(btn);
        });

    } catch(err) {
        container.innerHTML = `<span class="agenda-next-empty">Error</span>`;
    }
}



function _agendaGetResourceId(svc) {
    // En multi-modo el resource_id viene en el objeto servicio
    // En mono-modo usamos _agendaMyResource
    return svc?.resource_id || _agendaMyResource?._id || null;
}

function _agendaOnNextSlotClick(svc, slot, btn, color = '#7c3aed') {
    _agendaSelectedService = svc;
    _agendaSelectedDate    = slot.date;

    // ✅ Actualizar _agendaMyResource al especialista del slot seleccionado
    if (svc.resource_id) {
        _agendaMyResource = { _id: svc.resource_id, resource_name: svc.resource_name || '' };
    }

    // ✅ Trackear el svcGroup completo para "Ver más fechas"
    _agendaSelectedSvcGroup = _agendaCompanyServices.find(g => g.specialists?.some(s => s.service_id === svc.service_id || s.resource_id === svc.resource_id)) || null;


    // Desmarcar todos los slots
    document.querySelectorAll('.agenda-next-slot-pill').forEach(b => {
        b.classList.remove('agenda-next-slot-pill--selected');
        b.style.background = '';
        b.style.borderColor = b.style.borderTopColor || '#e5e7eb';
    });

    // Marcar el slot seleccionado
    btn.classList.add('agenda-next-slot-pill--selected');
    btn.style.background  = color;
    btn.style.borderColor = color;

    const container = document.getElementById('contactAgendaContainer');
    _agendaShowReservationPanel(slot, svc, container, color);
}

function _agendaCancelQuickConfirm() {
    _agendaCancelReservationPanel();
}

function _agendaToggleCalendar() {
    const wrapper = document.getElementById('agendaCalWrapper');
    if (!wrapper) return;
    const isOpen = wrapper.style.display !== 'none' && wrapper.style.opacity !== '0';
    rpSlide(wrapper, !isOpen);
}


// ============================================
// MINI CALENDARIO
// ============================================


// ── Color del servicio activo (para calendario) ───────────────────────────────


function _agendaBuildCalendar() {
    const wrapper = document.createElement('div');
    wrapper.className = 'agenda-calendar';

    const year  = _agendaCalendarMonth.getFullYear();
    const month = _agendaCalendarMonth.getMonth();
    const today = _agendaToday();

    // ── Header del mes ────────────────────────
    const header = document.createElement('div');
    header.className = 'agenda-cal-header';
    header.innerHTML = `
        <button class="agenda-cal-nav" id="agendaCalPrev"><i class="fas fa-chevron-left"></i></button>
        <span class="agenda-cal-title">${MESES[month]} ${year}</span>
        <button class="agenda-cal-nav" id="agendaCalNext"><i class="fas fa-chevron-right"></i></button>
        <button class="agenda-cal-nav agenda-cal-toggle-btn" id="agendaCalGridToggle" data-tooltip="Colapsar"><i class="fas fa-chevron-${window._agendaCalCollapsed ? 'down' : 'up'}"></i></button>
    `;
    wrapper.appendChild(header);

    // ── Contenedor colapsable ─────────────────
    const gridWrapper = document.createElement('div');
    gridWrapper.id = 'agendaCalGridWrapper';
    if (window._agendaCalCollapsed) {
        gridWrapper.style.display    = 'none';
        gridWrapper.style.maxHeight  = '0px';
        gridWrapper.style.opacity    = '0';
        gridWrapper.style.overflow   = 'hidden';
        gridWrapper.style.transition = 'max-height 0.28s ease, opacity 0.24s ease';
        gridWrapper._rpSlideInit = true;
    } else {
        gridWrapper.style.display = 'block';
    }
    wrapper.appendChild(gridWrapper);

    // ── Días de semana ────────────────────────
    const daysRow = document.createElement('div');
    daysRow.className = 'agenda-cal-days-row';
    DIAS.forEach(d => {
        const cell = document.createElement('span');
        cell.className = 'agenda-cal-dayname';
        cell.textContent = d;
        daysRow.appendChild(cell);
    });
    gridWrapper.appendChild(daysRow);

    // ── Grilla de días ────────────────────────
    const grid = document.createElement('div');
    grid.className = 'agenda-cal-grid';

    // Primer día del mes (isoWeekday: lunes=1)
    const firstDay = new Date(year, month, 1);
    let startDow = firstDay.getDay(); // 0=domingo
    startDow = startDow === 0 ? 6 : startDow - 1; // convertir a lunes=0

    // Celdas vacías antes del día 1
    for (let i = 0; i < startDow; i++) {
        const empty = document.createElement('div');
        empty.className = 'agenda-cal-cell agenda-cal-cell--empty';
        grid.appendChild(empty);
    }

    // Días del mes
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    for (let day = 1; day <= daysInMonth; day++) {
        const cellDate = new Date(year, month, day);
        const dateStr  = _agendaDateStr(cellDate);
        const isToday  = cellDate.getTime() === today.getTime();
        const isPast   = cellDate < today;
        const isSel    = _agendaSelectedDate === dateStr;

        const cell = document.createElement('div');
        cell.className = 'agenda-cal-cell' +
            (isToday ? ' agenda-cal-cell--today' : '') +
            (isPast   ? ' agenda-cal-cell--past'  : '') +
            (isSel    ? ' agenda-cal-cell--selected' : '');
        cell.textContent = day;


        if (!isPast) {
            cell.addEventListener('click', () => _agendaOnDateClick(dateStr));
        }

        grid.appendChild(cell);
    }

    gridWrapper.appendChild(grid);

    // ── Navegación mes ────────────────────────
    header.querySelector('#agendaCalPrev').addEventListener('click', () => {
        const prev = new Date(_agendaCalendarMonth);
        prev.setMonth(prev.getMonth() - 1);
        // No ir atrás del mes actual
        const todayFirst = new Date(_agendaToday().getFullYear(), _agendaToday().getMonth(), 1);
        if (prev >= todayFirst) {
            _agendaCalendarMonth = prev;
            const calWrapper = document.querySelector('.agenda-calendar');
            if (calWrapper) calWrapper.replaceWith(_agendaBuildCalendar());
        }
    });

    header.querySelector('#agendaCalNext').addEventListener('click', () => {
        const next = new Date(_agendaCalendarMonth);
        next.setMonth(next.getMonth() + 1);
        _agendaCalendarMonth = next;
        const calWrapper = document.querySelector('.agenda-calendar');
        if (calWrapper) calWrapper.replaceWith(_agendaBuildCalendar());
    });

    // Toggle colapsar grid
    const toggleBtn = wrapper.querySelector('#agendaCalGridToggle');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            window._agendaCalCollapsed = !window._agendaCalCollapsed;
            const gw = wrapper.querySelector('#agendaCalGridWrapper');
            if (gw) rpSlide(gw, !window._agendaCalCollapsed);
            toggleBtn.innerHTML = `<i class="fas fa-chevron-${window._agendaCalCollapsed ? 'down' : 'up'}"></i>`;
        });
    }

    return wrapper;
}


// ============================================
// SELECCIÓN DE FECHA → CARGAR SLOTS
// ============================================

async function _agendaOnDateClick(dateStr) {
    if (_agendaSelectedDate === dateStr) return;

    _agendaSelectedDate = dateStr;

    // Actualizar visual del calendario
    document.querySelectorAll('.agenda-cal-cell--selected').forEach(el => {
        el.classList.remove('agenda-cal-cell--selected');
    });
    document.querySelectorAll('.agenda-cal-cell:not(.agenda-cal-cell--empty)').forEach(el => {
        const day  = parseInt(el.textContent);
        const year = _agendaCalendarMonth.getFullYear();
        const mon  = _agendaCalendarMonth.getMonth();
        if (!isNaN(day)) {
            const str = _agendaDateStr(new Date(year, mon, day));
            if (str === dateStr) {
            el.classList.add('agenda-cal-cell--selected');
        }
        }
    });

    const slotsDiv = document.getElementById('agendaSlotsContainer');
    if (slotsDiv) await _agendaRenderSlots(slotsDiv);
}


// ============================================
// SLOTS DEL DÍA
// ============================================

async function _agendaRenderSlots(container) {
    if (!_agendaSelectedService || !_agendaSelectedDate) return;

    // Determinar qué especialistas buscar
    const svcGroup = _agendaSelectedSvcGroup ||
        _agendaCompanyServices.find(g =>
            g.specialists?.some(s =>
                s.service_id === _agendaSelectedService.service_id ||
                s.resource_id === _agendaSelectedService.resource_id
            ) ||
            g.name === _agendaSelectedService.name  // fallback por nombre
        ) || null;

    const specialists = svcGroup?.specialists?.length > 0
        ? svcGroup.specialists
        : [{ resource_id: _agendaSelectedService.resource_id || _agendaMyResource?._id,
             resource_name: _agendaSelectedService.resource_name || '',
             service_id: _agendaSelectedService.service_id }];

    const svcName = svcGroup?.name || _agendaSelectedService?.name || '';

    container.innerHTML = `
        <div class="agenda-slots-header">
            <span><i class="fas fa-calendar-day"></i> ${_agendaFormatDate(_agendaSelectedDate)}</span>
        </div>
        ${svcName ? `<div class="agenda-slots-context"><span class="agenda-slots-svc-name">● ${svcName}</span></div>` : ''}
        <div class="agenda-slots-loading">
            <i class="fas fa-spinner fa-spin"></i> Cargando horarios...
        </div>
    `;

    try {
        // ✅ Fetch en paralelo para todos los especialistas del servicio
        const results = await Promise.all(specialists.map(async spec => {
            try {
                const res = await fetch(
                    `${API_BASE_URL || ''}/api/agenda/availability/${spec.resource_id}/${spec.service_id}?date=${_agendaSelectedDate}`,
                    { headers: _agendaAuthHeaders() }
                );
                if (!res.ok) return { spec, slots: [] };
                const data = await res.json();
                return { spec, slots: data.slots || [] };
            } catch { return { spec, slots: [] }; }
        }));

        // Aplanar para _agendaSlots (usado en confirmación)
        _agendaSlots = results.flatMap(r => r.slots.map(s => ({
            ...s,
            resource_id:   s.resource_id   || r.spec.resource_id,
            resource_name: s.resource_name || r.spec.resource_name
        })));

        const totalSlots = _agendaSlots.length;

        container.innerHTML = `
            <div class="agenda-slots-header">
                <span><i class="fas fa-calendar-day"></i> ${_agendaFormatDate(_agendaSelectedDate)}</span>
                <span class="agenda-slots-count">${totalSlots} disponible${totalSlots !== 1 ? 's' : ''}</span>
            </div>
            ${svcName ? `<div class="agenda-slots-context"><span class="agenda-slots-svc-name">● ${svcName}</span></div>` : ''}
        `;

        if (totalSlots === 0) {
            container.innerHTML += `
                <div class="agenda-no-slots">
                    <i class="fas fa-calendar-times"></i>
                    <span>Sin horarios disponibles</span>
                    <button class="agenda-btn-waitlist" onclick="_agendaAddToWaitlist()">
                        <i class="fas fa-clock"></i> Lista de espera
                    </button>
                </div>
            `;
            return;
        }

        // ✅ Renderizar agrupado por especialista
        results.forEach(({ spec, slots }, specIdx) => {
            if (!slots.length) return;

            const specColor  = _agendaGetSpecColor(spec.resource_id);
            const abbrev     = _agendaAbbrevName(spec.resource_name);
            const specIsOpen = specIdx === 0;

            // Header del especialista (colapsable)
            const specHeader = document.createElement('div');
            specHeader.className = 'agenda-slots-spec-header';
            specHeader.style.cursor = 'pointer';
            specHeader.innerHTML = `
                <span class="agenda-slots-spec-dot" style="background:${specColor.border};"></span>
                <span class="agenda-slots-spec-label" style="color:${specColor.text};">${spec.resource_name || (typeof getCompanyLabel === 'function' ? getCompanyLabel('recurso', 'Especialista') : 'Especialista')}</span>
                <i class="fas fa-chevron-down" style="font-size:9px;color:#9ca3af;margin-left:auto;transition:transform 0.25s ease;${specIsOpen ? '' : 'transform:rotate(-90deg);'}"></i>
            `;
            container.appendChild(specHeader);

            // Grid de slots del especialista
            const grid = document.createElement('div');
            grid.className = 'agenda-slots-grid';
            grid.style.cssText = `overflow:hidden;transition:max-height 0.28s ease, opacity 0.24s ease;max-height:${specIsOpen ? '600px' : '0px'};opacity:${specIsOpen ? '1' : '0'};`;

            slots.forEach(slot => {
                const enrichedSlot = {
                    ...slot,
                    resource_id:   slot.resource_id   || spec.resource_id,
                    resource_name: slot.resource_name || spec.resource_name,
                    service_id:    slot.service_id    || spec.service_id
                };
                const btn = document.createElement('button');
                btn.className = 'agenda-slot-btn';
                btn.dataset.start = slot.start;
                btn.dataset.end   = slot.end;
                btn.style.borderColor = specColor.border;
                btn.innerHTML = `
                    <span class="agenda-slot-time-txt">${slot.start}</span>
                    ${spec.resource_name ? `<span class="agenda-slot-tt">${spec.resource_name}</span>` : ''}
                `;
                btn.addEventListener('click', () => {
                    // Al seleccionar, setear servicio correcto de este especialista
                    _agendaSelectedService = {
                        service_id:    spec.service_id,
                        name:          svcName,
                        duration:      svcGroup?.duration || _agendaSelectedService?.duration,
                        price:         svcGroup?.price    || _agendaSelectedService?.price,
                        resource_id:   spec.resource_id,
                        resource_name: spec.resource_name
                    };
                    _agendaMyResource = { _id: spec.resource_id, resource_name: spec.resource_name };
                    _agendaOnSlotClick(enrichedSlot, btn);
                });
                grid.appendChild(btn);
            });

            // Toggle colapso
            specHeader.addEventListener('click', () => {
                const chev = specHeader.querySelector('i');
                const isNowOpen = grid.style.opacity === '1';
                if (isNowOpen) {
                    grid.style.maxHeight = '0px';
                    grid.style.opacity   = '0';
                    if (chev) chev.style.transform = 'rotate(-90deg)';
                } else {
                    grid.style.maxHeight = grid.scrollHeight + 'px';
                    grid.style.opacity   = '1';
                    if (chev) chev.style.transform = 'rotate(0deg)';
                }
            });

            container.appendChild(grid);
        });

        // Panel de confirmación
        const confirmDiv = document.createElement('div');
        confirmDiv.id        = 'agendaConfirmPanel';
        confirmDiv.className = 'agenda-confirm-panel agenda-confirm-panel--hidden';
        container.appendChild(confirmDiv);

    } catch (err) {
        console.error('❌ Error cargando slots:', err);
        container.innerHTML = `<p class="agenda-error-msg">Error cargando horarios</p>`;
    }
}


// ============================================
// CLICK EN SLOT → CONFIRMACIÓN
// ============================================

function _agendaOnSlotClick(slot, btn) {
    // Marcar slot seleccionado
    document.querySelectorAll('.agenda-slot-btn').forEach(b => b.classList.remove('agenda-slot-btn--selected'));
    btn.classList.add('agenda-slot-btn--selected');

    const svc = _agendaSelectedService;
    const confirm = document.getElementById('agendaConfirmPanel');
    if (!confirm) return;

    confirm.className = 'agenda-confirm-panel';
    confirm.innerHTML = `
        <div class="agenda-confirm-info">
            <div class="agenda-confirm-row">
                <i class="fas fa-clock"></i>
                <span>${slot.start} – ${slot.end}</span>
            </div>
            <div class="agenda-confirm-row">
                <i class="fas fa-stethoscope"></i>
                <span>${svc.name} · ${svc.duration} min</span>
            </div>
            ${svc.price ? `
            <div class="agenda-confirm-row">
                <i class="fas fa-tag"></i>
                <span>$${svc.price.toLocaleString('es-CL')}</span>
            </div>` : ''}
        </div>
        <div class="agenda-confirm-notes">
            <input type="text" id="agendaNotes" class="agenda-notes-input" placeholder="Notas (opcional)">
        </div>
        <div class="agenda-confirm-actions">
            <button class="agenda-btn-cancel-confirm" onclick="_agendaCancelConfirm()">
                Cancelar
            </button>
            <button class="agenda-btn-confirm" id="agendaBtnConfirm"
                onclick="_agendaConfirmReservation('${slot.start}', '${slot.end}')">
                <i class="fas fa-check"></i> Confirmar cita
            </button>
        </div>
    `;
}

function _agendaCancelConfirm() {
    document.querySelectorAll('.agenda-slot-btn').forEach(b => b.classList.remove('agenda-slot-btn--selected'));
    const confirm = document.getElementById('agendaConfirmPanel');
    if (confirm) {
        confirm.className = 'agenda-confirm-panel agenda-confirm-panel--hidden';
        confirm.innerHTML = '';
    }
}


// ============================================
// CONFIRMAR AGENDAMIENTO
// ============================================

async function _agendaConfirmBooking(start, end) {
    if (_agendaBooking) return;
    if (!_agendaCurrentUserId || !_agendaCurrentCompanyId) return;

    const btn = document.getElementById('agendaBtnConfirm');
    if (btn) {
        btn.disabled   = true;
        btn.innerHTML  = '<i class="fas fa-spinner fa-spin"></i> Agendando...';
    }

    _agendaBooking = true;

    const notes = document.getElementById('agendaNotes')?.value?.trim() || '';

    try {
        const res = await fetch(
            `${API_BASE_URL || ''}/api/agenda/appointments`,
            {
                method:  'POST',
                headers: _agendaAuthHeaders(),
                body: JSON.stringify({
                    resource_id: _agendaGetResourceId(_agendaSelectedService),
                    service_id:  _agendaSelectedService.service_id,
                    contact_id:  _agendaCurrentUserId,
                    date:        _agendaSelectedDate,
                    start:       start,
                    source:      'manual',
                    notes:       notes
                })
            }
        );

        const data = await res.json();

        if (data.success) {
            _agendaShowSuccess(start, end);
        } else if (data.code === 'duplicate') {
            _agendaShowDuplicate();
        } else {
            _agendaShowBookingError(data.error || 'Error al agendar');
        }

    } catch (err) {
        console.error('❌ Error al agendar:', err);
        _agendaShowBookingError('Error de conexión');
    } finally {
        _agendaBooking = false;
    }
}

function _agendaShowSuccess(start, end) {
    const slotsContainer = document.getElementById('agendaSlotsContainer');
    if (!slotsContainer) return;

    slotsContainer.innerHTML = `
        <div class="agenda-success">
            <div class="agenda-success-icon"><i class="fas fa-check-circle"></i></div>
            <div class="agenda-success-title">¡Cita agendada!</div>
            <div class="agenda-success-detail">
                ${_agendaFormatDate(_agendaSelectedDate)}<br>
                ${start} – ${end} · ${_agendaSelectedService.name}
            </div>
            <button class="agenda-btn-new" onclick="_agendaResetSlots()">
                <i class="fas fa-plus"></i> Agendar otra
            </button>
        </div>
    `;

    // Refrescar citas del contacto
    const apptContainer = document.getElementById('agendaContactAppointments');
    if (apptContainer) _agendaLoadContactAppointments(apptContainer);
}

function _agendaShowDuplicate() {
    const confirm = document.getElementById('agendaConfirmPanel');
    if (confirm) {
        confirm.innerHTML += `
            <div class="agenda-error-inline">
                <i class="fas fa-exclamation-triangle"></i>
                Ese horario ya fue tomado. Elige otro.
            </div>
        `;
    }
    // Recargar slots del día
    const slotsDiv = document.getElementById('agendaSlotsContainer');
    if (slotsDiv) _agendaRenderSlots(slotsDiv);
}

function _agendaShowBookingError(msg) {
    // Buscar el panel activo — puede ser confirmPanel o reservationPanel
    const panel = document.getElementById('agendaReservationPanel')
                || document.getElementById('agendaConfirmPanel')
                || document.getElementById('contactAgendaContainer');
    if (!panel) return;

    // Eliminar error anterior si existe
    panel.querySelectorAll('.agenda-error-inline').forEach(el => el.remove());

    const errDiv = document.createElement('div');
    errDiv.className = 'agenda-error-inline';
    errDiv.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${msg}`;
    panel.appendChild(errDiv);

    // Auto-ocultar a los 4 segundos
    setTimeout(() => errDiv.remove(), 4000);
}

function _agendaResetSlots() {
    _agendaSelectedDate = null;
    _agendaSlots        = [];
    _agendaRenderPanel();
}


// ============================================
// LISTA DE ESPERA
// ============================================

async function _agendaAddToWaitlist() {
    if (!_agendaCurrentUserId || !_agendaSelectedService) return;

    try {
        const res = await fetch(
            `${API_BASE_URL || ''}/api/agenda/waitlist`,
            {
                method:  'POST',
                headers: _agendaAuthHeaders(),
                body: JSON.stringify({
                    resource_id:     _agendaMyResource._id,
                    service_id:      _agendaSelectedService.service_id,
                    contact_id:      _agendaCurrentUserId,
                    date_preference: _agendaSelectedDate
                })
            }
        );

        const data = await res.json();
        const noSlotsDiv = document.querySelector('.agenda-no-slots');
        if (!noSlotsDiv) return;

        if (data.success) {
            noSlotsDiv.innerHTML = `
                <i class="fas fa-check-circle" style="color:#22c55e"></i>
                <span>Contacto agregado a lista de espera</span>
            `;
        } else if (data.code === 'already_in_waitlist') {
            noSlotsDiv.innerHTML += `
                <p class="agenda-hint" style="color:#f59e0b">
                    <i class="fas fa-info-circle"></i> Ya está en lista de espera
                </p>
            `;
        }

    } catch (err) {
        console.error('❌ Error agregando a waitlist:', err);
    }
}


// ============================================
// PRÓXIMAS CITAS DEL CONTACTO
// ============================================

async function _agendaRenderContactAppointments(container) {
    const section = document.createElement('div');
    section.className = 'agenda-contact-appts';
    section.id        = 'agendaContactAppointments';
    container.appendChild(section);

    await _agendaLoadContactAppointments(section);
}

async function _agendaLoadContactAppointments(container) {
    if (!_agendaCurrentUserId || !_agendaCurrentCompanyId) return;

    container.innerHTML = `<div class="agenda-appts-loading"><i class="fas fa-spinner fa-spin"></i></div>`;

    try {
        const res = await fetch(
            `${API_BASE_URL || ''}/api/agenda/appointments/contact/${_agendaCurrentUserId}?upcoming=true`,
            { headers: _agendaAuthHeaders() }
        );

        const data = await res.json();
        const appts = data.appointments || [];

        if (appts.length === 0) {
            container.innerHTML = '';
            return;
        }

        container.innerHTML = `
            <div class="agenda-appts-title">
                <i class="fas fa-calendar-check"></i> Próximas citas
            </div>
        `;

        appts.slice(0, 5).forEach(appt => {
            const item = document.createElement('div');
            item.className = 'agenda-appt-item';

            const statusClass = {
                scheduled:   'agenda-status--scheduled',
                confirmed:   'agenda-status--confirmed',
                arrived:     'agenda-status--arrived',
                in_progress: 'agenda-status--inprogress',
                completed:   'agenda-status--completed',
                no_show:     'agenda-status--noshow',
                cancelled:   'agenda-status--cancelled',
            }[appt.status] || '';

            const statusLabel = {
                scheduled:   'Agendada',
                confirmed:   'Confirmada',
                arrived:     'Llegó',
                in_progress: 'En curso',
                completed:   'Completada',
                no_show:     'No asistió',
                cancelled:   'Cancelada',
            }[appt.status] || appt.status;

            item.innerHTML = `
                <div class="agenda-appt-date">
                    <span class="agenda-appt-day">${_agendaFormatDateShort(appt.date)}</span>
                    <span class="agenda-appt-time">${appt.start}</span>
                </div>
                <div class="agenda-appt-info">
                    <span class="agenda-appt-service">${appt.service_id}</span>
                    <span class="agenda-appt-status ${statusClass}">${statusLabel}</span>
                </div>
                <button class="agenda-appt-cancel-btn" data-tooltip="Cancelar cita"
                    onclick="_agendaCancelAppointment('${appt._id}', this)">
                    <i class="fas fa-times"></i>
                </button>
            `;

            container.appendChild(item);
        });

    } catch (err) {
        console.error('❌ Error cargando citas del contacto:', err);
        container.innerHTML = '';
    }
}

async function _agendaCancelAppointment(appointmentId, btn) {
    // Confirmación inline — sin confirm() nativo
    const item = btn.closest('.agenda-appt-item');
    if (!item) return;

    // Si ya hay un panel de confirmación abierto, removerlo
    const existing = item.querySelector('.agenda-appt-confirm-inline');
    if (existing) { existing.remove(); return; }

    const inline = document.createElement('div');
    inline.className = 'agenda-appt-confirm-inline';
    inline.innerHTML = `
        <span>¿Cancelar cita?</span>
        <button class="agenda-appt-confirm-yes">Sí</button>
        <button class="agenda-appt-confirm-no">No</button>
    `;
    item.appendChild(inline);

    inline.querySelector('.agenda-appt-confirm-no').addEventListener('click', () => inline.remove());
    inline.querySelector('.agenda-appt-confirm-yes').addEventListener('click', async () => {
        inline.remove();
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

    try {
        const res = await fetch(
            `${API_BASE_URL || ''}/api/agenda/appointments/${appointmentId}/cancel`,
            {
                method:  'PATCH',
                headers: _agendaAuthHeaders(),
                body:    JSON.stringify({ reason: 'Cancelada desde el panel' })
            }
        );

        const data = await res.json();
        if (data.success) {
            // Refrescar panel completo — el slot queda disponible de nuevo
            await _agendaRenderPanel();
        } else {
            btn.disabled  = false;
            btn.innerHTML = '<i class="fas fa-times"></i>';
        }
        } catch (err) {
            console.error('❌ Error cancelando cita:', err);
            btn.disabled  = false;
            btn.innerHTML = '<i class="fas fa-times"></i>';
        }
    });
}


// ============================================
// ESTADOS DE CARGA / ERROR / VACÍO
// ============================================

function _agendaRenderLoading() {
    const container = document.getElementById('contactAgendaContainer');
    if (!container) return;
    container.innerHTML = `
        <div class="agenda-state">
            <i class="fas fa-spinner fa-spin"></i>
            <span>Cargando agenda...</span>
        </div>`;
}

function _agendaRenderNoAgenda() {
    const container = document.getElementById('contactAgendaContainer');
    if (!container) return;
    container.innerHTML = `
        <div class="agenda-state agenda-state--muted">
            <i class="fas fa-calendar-xmark"></i>
            <span>No tienes agenda configurada</span>
        </div>`;
}

function _agendaRenderEmpty(msg = '') {
    const container = document.getElementById('contactAgendaContainer');
    if (!container) return;
    container.innerHTML = `
        <div class="agenda-state agenda-state--muted">
            <i class="fas fa-calendar"></i>
            <span>${msg}</span>
        </div>`;
}


// Refrescar calendario si está visible
function _agendaRefreshCalendarIfOpen() {
    const section = document.getElementById('contactCalendarSection');
    // Compatible con el nuevo sistema rp-section (rp-open) y el antiguo (hidden)
    const isOpen = section && (
        section.classList.contains('rp-open') ||
        (!section.classList.contains('hidden') && section.style.display !== 'none')
    );
    if (isOpen && typeof _calRender === 'function') _calRender();
}

function _agendaRenderError() {
    const container = document.getElementById('contactAgendaContainer');
    if (!container) return;
    container.innerHTML = `
        <div class="agenda-state agenda-state--error">
            <i class="fas fa-exclamation-circle"></i>
            <span>Error cargando agenda</span>
        </div>`;
}


// ============================================
// CSS INYECTADO
// ============================================

// Estilos en assets/css/conv-agenda.css


// ============================================
// MODO CONCURRENT
// ============================================

async function _agendaRenderConcurrent(container) {
    const title = document.createElement('div');
    title.className = 'agenda-next-slots-title';
    title.innerHTML = '<i class="fas fa-bolt"></i> Próxima disponibilidad';
    container.appendChild(title);

    // Selector de servicio
    if (_agendaMyServices.length > 1) {
        const sel = document.createElement('select');
        sel.className = 'agenda-service-select';
        _agendaMyServices.forEach((s, i) => {
            const opt = document.createElement('option');
            opt.value = s.service_id;
            opt.textContent = `${s.name} (${s.duration} min)`;
            if (i === 0) opt.selected = true;
            sel.appendChild(opt);
        });
        sel.addEventListener('change', async () => {
            _agendaSelectedService = _agendaMyServices.find(s => s.service_id === sel.value);
            await _agendaRenderPanel();
        });
        container.appendChild(sel);
    }

    const svc = _agendaSelectedService || _agendaMyServices[0];
    if (!svc) return;

    const loading = document.createElement('div');
    loading.innerHTML = '<span class="agenda-next-loading"><i class="fas fa-spinner fa-spin"></i> Cargando disponibilidad...</span>';
    container.appendChild(loading);

    try {
        const res = await fetch(
            `${API_BASE_URL || ''}/api/agenda/availability/concurrent?service_id=${svc.service_id}&limit=3`,
            { headers: _agendaAuthHeaders() }
        );
        const data = await res.json();
        loading.remove();

        const resources = data.resources || [];
        if (resources.length === 0) {
            container.innerHTML += '<p class="agenda-hint">Sin disponibilidad próxima</p>';
            return;
        }

        // _svcColors es global

        resources.forEach((resource, idx) => {
            const block = document.createElement('div');
            block.className = 'agenda-next-svc-block';
            const color = resource.resource_color || _svcColors[idx % _svcColors.length];

            const nameRow = document.createElement('div');
            nameRow.className = 'agenda-next-svc-name';
            nameRow.innerHTML = `
                <span class="agenda-next-svc-dot" style="background:${color}"></span>
                <span>${resource.name}</span>
            `;
            block.appendChild(nameRow);

            const slotsRow = document.createElement('div');
            slotsRow.className = 'agenda-next-slots-row';

            if (!resource.slots || resource.slots.length === 0) {
                slotsRow.innerHTML = '<span class="agenda-next-empty">Sin disponibilidad</span>';
            } else {
                resource.slots.forEach(slot => {
                    const btn = document.createElement('button');
                    btn.className = 'agenda-next-slot-pill';
                    btn.style.borderTopColor = color;
                    btn.style.borderTopWidth = '2px';
                    btn.innerHTML = `
                        <span class="agenda-next-slot-date">${_agendaFormatDateShort(slot.date)}</span>
                        <span class="agenda-next-slot-time">${slot.start}</span>
                    `;
                    btn.addEventListener('click', () => {
                        _agendaSelectedService = svc;
                        _agendaSelectedDate = slot.date;
                        // Para concurrent guardamos el resource_id específico
                        _agendaMyResource = { ..._agendaMyResource, _id: resource.resource_id };
                        document.querySelectorAll('.agenda-next-slot-pill').forEach(b => {
                            b.classList.remove('agenda-next-slot-pill--selected');
                            b.style.background = '';
                            b.style.borderColor = b.style.borderTopColor;
                        });
                        btn.classList.add('agenda-next-slot-pill--selected');
                        btn.style.background = color;
                        btn.style.borderColor = color;
                        _agendaShowReservationPanel(slot, svc, container, color);
                    });
                    slotsRow.appendChild(btn);
                });
            }
            block.appendChild(slotsRow);
            container.appendChild(block);
        });

    } catch(err) {
        loading.innerHTML = '<span class="agenda-next-empty">Error cargando disponibilidad</span>';
    }

    // Botón buscar por día
    const calToggle = document.createElement('div');
    calToggle.className = 'agenda-cal-toggle';
    calToggle.innerHTML = '<button class="agenda-btn-search-day" onclick="_agendaToggleCalendar()"><i class="fas fa-calendar-search"></i> Buscar otro día</button>';
    container.appendChild(calToggle);

    const calWrapper = document.createElement('div');
    calWrapper.id = 'agendaCalWrapper';
    calWrapper.style.display = 'none';
    calWrapper.appendChild(_agendaBuildCalendar());
    const slotsDiv = document.createElement('div');
    slotsDiv.id = 'agendaSlotsContainer';
    calWrapper.appendChild(slotsDiv);
    container.appendChild(calWrapper);

    await _agendaRenderContactAppointments(container);
}


// ============================================
// PANEL DE CONFIRMACIÓN DE RESERVA
// ============================================

function _agendaShowReservationPanel(slot, svc, container, color) {
    // Remover panel anterior si existe
    const prev = document.getElementById('agendaReservationPanel');
    if (prev) prev.remove();

    const panel = document.createElement('div');
    panel.id = 'agendaReservationPanel';
    panel.className = 'agenda-confirm-panel';
    panel.style.borderLeft = `3px solid ${color}`;

    const price = svc.price
        ? `<div class="agenda-confirm-row"><i class="fas fa-tag"></i><span>$${svc.price.toLocaleString('es-CL')} ${svc.currency || 'CLP'}</span></div>`
        : '';

    panel.innerHTML = `
        <div class="agenda-confirm-info">
            <div class="agenda-confirm-row">
                <i class="fas fa-concierge-bell" style="color:${color}"></i>
                <span><strong>${svc.name}</strong> · ${svc.duration} min</span>
            </div>
            <div class="agenda-confirm-row">
                <i class="fas fa-calendar-day"></i>
                <span>${_agendaFormatDate(slot.date)}</span>
            </div>
            <div class="agenda-confirm-row">
                <i class="fas fa-clock"></i>
                <span>${slot.start} – ${slot.end}</span>
            </div>
            ${price}
            <div class="agenda-confirm-row agenda-ttl-row">
                <i class="fas fa-hourglass-half" style="color:#f59e0b"></i>
                <span>Se reserva por <strong>${_agendaReservationTtl} min</strong> hasta confirmar reserva</span>
            </div>
        </div>
        <div class="agenda-confirm-notes">
            <input type="text" id="agendaReservationNotes" class="agenda-notes-input" placeholder="Notas (opcional)">
        </div>
        <div class="agenda-confirm-actions">
            <button class="agenda-btn-cancel-confirm" onclick="_agendaCancelReservationPanel()">Cancelar</button>
            <button class="agenda-btn-confirm" onclick="_agendaConfirmReservation('${slot.start}', '${slot.end}')">
                <i class="fas fa-calendar-check"></i> Reservar hora
            </button>
        </div>
    `;

    const nextSection = container.querySelector('.agenda-next-slots-section') || container;
    nextSection.appendChild(panel);
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

async function _agendaCancelActiveReservation() {
    const apptId = window._agendaPendingAppointmentId;
    if (!apptId) { _agendaStopCountdown(); await _agendaRenderPanel(); return; }

    try {
        await fetch(
            `${API_BASE_URL || ''}/api/agenda/appointments/${apptId}/cancel`,
            { method: 'PATCH', headers: { ..._agendaAuthHeaders(), 'Content-Type': 'application/json' },
              body: JSON.stringify({ reason: 'Cancelada desde el panel' }) }
        );
    } catch(e) { /* si falla igual limpiamos el UI */ }

    window._agendaPendingAppointmentId = null;
    _agendaStopCountdown();
    await _agendaRenderPanel();
}

function _agendaCancelReservationPanel() {
    document.querySelectorAll('.agenda-next-slot-pill').forEach(b => {
        b.classList.remove('agenda-next-slot-pill--selected');
        b.style.background = '';
    });
    const p = document.getElementById('agendaReservationPanel');
    if (p) p.remove();
}

async function _agendaConfirmReservation(start, end) {
    if (!_agendaCurrentUserId || !_agendaCurrentCompanyId) return;

    const notes = document.getElementById('agendaReservationNotes')?.value || '';
    const btn = document.querySelector('#agendaReservationPanel .agenda-btn-confirm');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Reservando...'; }

    try {
        const res = await fetch(`${API_BASE_URL || ''}/api/agenda/reservations`, {
            method: 'POST',
            headers: { ..._agendaAuthHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({
                resource_id: _agendaGetResourceId(_agendaSelectedService),
                service_id:  _agendaSelectedService.service_id,
                contact_id:  _agendaCurrentUserId,
                date:        _agendaSelectedDate,
                start,
                notes
            })
        });

        const data = await res.json();

        if (!data.success) {
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-calendar-check"></i> Reservar hora'; }
            _agendaShowBookingError(data.error || 'Error al reservar');
            if (data.code === 'duplicate') {
                // Marcar el slot como no disponible en el UI inmediatamente
                const slotKey = `${_agendaSelectedDate}-${start}`;
                document.querySelectorAll('.agenda-next-slot-pill').forEach(pill => {
                    if (pill.dataset.start === start) {
                        pill.classList.add('agenda-slot-taken');
                        pill.style.opacity = '0.4';
                        pill.style.pointerEvents = 'none';
                        pill.style.textDecoration = 'line-through';
                    }
                });
                // Refrescar panel en background
                await _agendaRenderPanel();
            }
            return;
        }

        // Éxito → mostrar panel post-reserva con countdown y mensaje
        if (_agendaSelectedService) {
            _agendaSelectedService._lastSlotStart = start;
            _agendaSelectedService._lastSlotEnd   = end;
        }
        _agendaShowReservationSuccess(data);
        _agendaRefreshCalendarIfOpen();

    } catch(err) {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-calendar-check"></i> Reservar hora'; }
        _agendaShowBookingError('Error de conexión');
    }
}

function _agendaShowReservationSuccess(data) {
    const container = document.getElementById('contactAgendaContainer');
    if (!container) return;

    const reservedUntil = new Date(data.reserved_until);
    const specName = _agendaSelectedService?.resource_name || data.resource_name || '';
    const svcName  = _agendaSelectedService?.name || data.service_name || '';

    container.innerHTML = `
        <div class="agenda-reservation-success">
            <div class="agenda-reservation-success-icon">
                <i class="fas fa-calendar-check"></i>
            </div>
            <div class="agenda-reservation-success-title">¡Hora reservada!</div>

            <div style="background:white;border:1px solid #bbf7d0;border-radius:8px;padding:7px 10px;text-align:left;font-size:11px;color:#374151;margin:4px 0 6px;">
                ${svcName ? `<div style="display:flex;align-items:center;gap:7px;margin-bottom:4px;">
                    <i class="fas fa-stethoscope" style="color:#10b981;width:12px;flex-shrink:0;"></i>
                    <span style="font-weight:600;">${svcName}</span>
                </div>` : ''}
                ${specName ? `<div style="display:flex;align-items:center;gap:7px;margin-bottom:4px;">
                    <i class="fas fa-user-md" style="color:#10b981;width:12px;flex-shrink:0;"></i>
                    <span>${specName}</span>
                </div>` : ''}
                ${_agendaSelectedDate ? `<div style="display:flex;align-items:center;gap:7px;margin-bottom:4px;">
                    <i class="fas fa-calendar-day" style="color:#10b981;width:12px;flex-shrink:0;"></i>
                    <span style="text-transform:capitalize;">${new Date(_agendaSelectedDate + 'T12:00:00').toLocaleDateString('es-CL', { weekday:'long', day:'numeric', month:'long' })}</span>
                </div>` : ''}
                ${_agendaSelectedService?._lastSlotStart ? `<div style="display:flex;align-items:center;gap:7px;">
                    <i class="fas fa-clock" style="color:#10b981;width:12px;flex-shrink:0;"></i>
                    <span style="font-weight:700;">${_agendaSelectedService._lastSlotStart}${_agendaSelectedService._lastSlotEnd ? ` – ${_agendaSelectedService._lastSlotEnd}` : ''}</span>
                </div>` : ''}
                ${_agendaSelectedService?.price ? `<div style="display:flex;align-items:center;gap:7px;margin-top:4px;">
                    <i class="fas fa-tag" style="color:#10b981;width:12px;flex-shrink:0;"></i>
                    <span style="font-weight:700;">$${Number(_agendaSelectedService.price).toLocaleString('es-CL')}</span>
                </div>` : ''}
            </div>

            <div class="agenda-reservation-success-ttl">
                <i class="fas fa-hourglass-half"></i>
                Tiempo para confirmar reserva:
                <span id="agendaCountdown" class="agenda-countdown">--:--</span>
            </div>
            <div class="agenda-reservation-actions">
                ${data.payment_mode === 'manual' ? `
                <div style="display:flex;gap:6px;">
                    <button class="agenda-btn-confirm-payment" style="flex:1;" onclick="_agendaBannerAskConfirm('direct','pay')">
                        <i class="fas fa-check-circle"></i> Confirmar
                    </button>
                    <button onclick="_agendaBannerAskConfirm('direct','cancel')"
                        style="flex:1;padding:8px;border:1px solid rgba(239,68,68,0.3);background:white;color:#ef4444;border-radius:8px;font-size:11px;font-weight:600;cursor:pointer;">
                        <i class="fas fa-times"></i> Cancelar
                    </button>
                </div>
                <div id="bannerConfirm_direct" style="display:none;margin-top:6px;"></div>` : `
                <div class="agenda-waiting-payment">
                    <i class="fas fa-spinner fa-spin"></i> Esperando confirmación de reserva...
                </div>`}
                <button class="agenda-btn-send-msg" id="agendaBtnSendMsg" onclick="_agendaSendReservationMsg()">
                    <i class="fas fa-paper-plane"></i> Enviar instrucciones al paciente
                </button>
            </div>
        </div>
    `;

    // Guardar mensaje — ajustar textos del backend para quitar referencias a pago
    let msg = data.whatsapp_message || '';
    if (specName && msg && !msg.includes(specName)) {
        msg = msg.replace(/(\*Servicio:\*[^\n]*)/, `$1\n*Terapeuta:* ${specName}`);
    }
    // Corregir hora UTC a hora Chile en "reservada hasta las HH:MM"
    msg = msg.replace(/reservada hasta las (\d{2}):(\d{2})/g, (match, hh, mm) => {
        // Usar reserved_until del backend para obtener la hora correcta en Chile
        const clHour = new Date(data.reserved_until)
            .toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Santiago' });
        return `reservada hasta las ${clHour}`;
    });
    // Reemplazar texto de pago por lenguaje genérico de confirmación
    msg = msg.replace(/Para confirmar tu hora,?\s*realiza el pago y env[íi]a el comprobante por este chat\.?/gi,
        'Para confirmar tu hora, responde este mensaje o contáctanos.');
    msg = msg.replace(/realiza el pago y env[íi]a el comprobante/gi,
        'responde este mensaje para confirmar');
    window._agendaPendingMessage = msg;
    window._agendaPendingAppointmentId = data.appointment_id;
    // ✅ Guardar datos para mostrar en panel de confirmación
    window._agendaPendingBookingInfo = {
        svcName:  svcName,
        specName: specName,
        date:     _agendaSelectedDate,
        start:    _agendaSelectedService?._lastSlotStart || data.start_time || '',
        end:      _agendaSelectedService?._lastSlotEnd   || data.end_time   || ''
    };

    // Iniciar countdown
    _agendaStartCountdown('agendaCountdown', reservedUntil, () => {
        _agendaRenderPanel();
    });
}

function _agendaStartCountdown(elementId, until, onExpire) {
    _agendaStopCountdown(); // Detener cualquier countdown previo
    const tick = () => {
        const el = document.getElementById(elementId);
        if (!el) return;
        const diff = Math.max(0, until - new Date());
        const mins = Math.floor(diff / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        el.textContent = `${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
        if (diff <= 0) {
            el.textContent = '00:00';
            if (typeof onExpire === 'function') onExpire();
            return;
        }
        el.style.color = diff < 300000 ? '#ef4444' : diff < 600000 ? '#f59e0b' : '#10b981';
        _agendaCountdownTimer = setTimeout(tick, 1000);
    };
    tick();
}

function _agendaStopCountdown() {
    if (_agendaCountdownTimer) { clearTimeout(_agendaCountdownTimer); _agendaCountdownTimer = null; }
}

async function _agendaConfirmPayment(appointmentId) {
    const btn = document.querySelector('.agenda-btn-confirm-payment');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Confirmando...'; }

    try {
        const res = await fetch(`${API_BASE_URL || ''}/api/agenda/reservations/${appointmentId}/confirm`, {
            method: 'PATCH',
            headers: { ..._agendaAuthHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ payment_reference: 'manual' })
        });
        const data = await res.json();

        if (data.success) {
            _agendaStopCountdown();
            _agendaHideBannerById(appointmentId);
            setTimeout(function() {
                _agendaShowConfirmedSuccess();
                // ✅ Recargar agenda para reflejar la hora confirmada
                setTimeout(function() {
                    if (typeof loadAgenda === 'function' && _agendaCurrentCompanyId && _agendaCurrentUserId) {
                        loadAgenda(_agendaCurrentCompanyId, _agendaCurrentUserId);
                    }
                }, 1800);
            }, 350);
            _agendaRefreshCalendarIfOpen();
        } else {
            console.error('❌ [Agenda] Error confirmando:', data);
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-check-circle"></i> Confirmar reserva'; }
            _agendaShowBookingError(data.error || 'Error al confirmar');
        }
    } catch(err) {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-check-circle"></i> Confirmar reserva'; }
    }
}

// Exponer para uso cruzado desde conv-calendar.js
window._agendaConfirmPayment  = _agendaConfirmPayment;
window._agendaHideBannerById  = _agendaHideBannerById;

// Hook para cargar agenda cuando se abre la sección en el panel derecho
window._onToggleRightSection = (function(_prev) {
    return function(sectionId, isOpen) {
        if (_prev) _prev(sectionId, isOpen);
        if (isOpen && sectionId === 'contactAgendaSection') {
            if (_agendaCurrentCompanyId && _agendaCurrentUserId) {
                loadAgenda(_agendaCurrentCompanyId, _agendaCurrentUserId);
            }
        }
    };
})(window._onToggleRightSection);

// Refresh manual de la agenda
window._agendaRefresh = function(el) {
    if (el) {
        el.classList.add('spinning');
        setTimeout(() => el.classList.remove('spinning'), 450);
    }
    if (_agendaCurrentCompanyId && _agendaCurrentUserId) {
        loadAgenda(_agendaCurrentCompanyId, _agendaCurrentUserId);
    }
};

function _agendaShowConfirmedSuccess() {
    const container = document.getElementById('contactAgendaContainer');
    if (!container) return;

    const info = window._agendaPendingBookingInfo || {};
    const dateStr = info.date ? new Date(info.date + 'T12:00:00').toLocaleDateString('es-CL', {
        weekday: 'long', day: 'numeric', month: 'long'
    }) : '';

    container.innerHTML = `
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:16px;text-align:center;">
            <div style="font-size:24px;margin-bottom:6px;">✅</div>
            <div style="font-size:13px;font-weight:700;color:#166534;margin-bottom:10px;">¡Hora confirmada!</div>
            ${info.svcName || info.specName || dateStr || info.start ? `
            <div style="background:white;border:1px solid #bbf7d0;border-radius:8px;padding:10px;text-align:left;font-size:11px;color:#374151;margin-bottom:12px;">
                ${info.svcName ? `<div style="display:flex;align-items:center;gap:7px;margin-bottom:5px;">
                    <i class="fas fa-stethoscope" style="color:#10b981;width:12px;"></i>
                    <span style="font-weight:600;">${info.svcName}</span>
                </div>` : ''}
                ${info.specName ? `<div style="display:flex;align-items:center;gap:7px;margin-bottom:5px;">
                    <i class="fas fa-user-md" style="color:#10b981;width:12px;"></i>
                    <span>${info.specName}</span>
                </div>` : ''}
                ${dateStr ? `<div style="display:flex;align-items:center;gap:7px;margin-bottom:5px;">
                    <i class="fas fa-calendar-day" style="color:#10b981;width:12px;"></i>
                    <span style="text-transform:capitalize;">${dateStr}</span>
                </div>` : ''}
                ${info.start ? `<div style="display:flex;align-items:center;gap:7px;">
                    <i class="fas fa-clock" style="color:#10b981;width:12px;"></i>
                    <span style="font-weight:700;font-size:12px;">${info.start}${info.end ? ` – ${info.end}` : ''}</span>
                </div>` : ''}
            </div>` : ''}
            <button onclick="_agendaRenderPanel()" 
                style="font-size:11px;padding:6px 16px;background:#10b981;color:#fff;border:none;border-radius:8px;cursor:pointer;">
                Ver agenda
            </button>
            <button onclick="_agendaCancelActiveReservation()"
                style="font-size:11px;padding:6px 16px;background:white;color:#ef4444;border:1px solid rgba(239,68,68,0.3);border-radius:8px;cursor:pointer;margin-top:6px;width:100%;">
                <i class="fas fa-times"></i> Cancelar reserva
            </button>
        </div>`;
}

function _agendaSendReservationMsg() {
    const msg = window._agendaPendingMessage;
    if (!msg) return;

    const _reloadAgenda = () => {
        if (typeof loadAgenda === 'function' && _agendaCurrentCompanyId && _agendaCurrentUserId) {
            loadAgenda(_agendaCurrentCompanyId, _agendaCurrentUserId);
        }
    };

    const _hideSendBtn = () => {
        const btn = document.getElementById('agendaBtnSendMsg') || document.querySelector('.agenda-btn-send-msg');
        if (btn) {
            btn.style.transition = 'opacity 0.4s ease, max-height 0.4s ease';
            btn.style.opacity = '0';
            setTimeout(() => { btn.style.display = 'none'; }, 400);
        }
    };

    // Intentar inyectar en el input del chat del panel principal
    const chatInput = document.getElementById('messageInput') ||
                      document.querySelector('.message-input') ||
                      document.querySelector('textarea[name="message"]');

    if (chatInput) {
        chatInput.value = msg;
        chatInput.dispatchEvent(new Event('input', { bubbles: true }));
        chatInput.focus();

        const btn = document.getElementById('agendaBtnSendMsg') || document.querySelector('.agenda-btn-send-msg');
        if (btn) {
            btn.innerHTML = '<i class="fas fa-check"></i> Mensaje cargado en el chat';
            btn.style.background = '#10b981';
            btn.style.color = '#fff';
            btn.style.borderColor = '#10b981';
        }
        setTimeout(() => { _hideSendBtn(); _reloadAgenda(); }, 2500);
    } else {
        navigator.clipboard.writeText(msg).then(() => {
            const btn = document.getElementById('agendaBtnSendMsg') || document.querySelector('.agenda-btn-send-msg');
            if (btn) {
                btn.innerHTML = '<i class="fas fa-check"></i> Copiado al portapapeles';
                btn.style.background = '#10b981';
                btn.style.color = '#fff';
                btn.style.borderColor = '#10b981';
            }
            setTimeout(() => { _hideSendBtn(); _reloadAgenda(); }, 2500);
        });
    }
}

// ── Notificar cambio de contacto desde selectConversation ──
window._agendaOnContactChange = function(companyId, userId) {
    // Actualizar variables y re-renderizar inmediatamente
    _agendaCurrentUserId    = userId;
    _agendaCurrentCompanyId = companyId;
    _agendaSelectedDate     = null;
    _agendaSelectedService  = null;
    _agendaSelectedSvcGroup = null;
    _agendaBooking          = false;
    _agendaSlots            = [];

    // Solo recargar si la sección está visible
    const section = document.getElementById('contactAgendaSection');
    const isOpen  = section && section.classList.contains('rp-open');
    if (isOpen) {
        loadAgenda(companyId, userId);
    }
};

// ── Exponer _reloadAgenda globalmente para realtime.js ──
window._reloadAgenda = function() {
    if (typeof loadAgenda === 'function' && _agendaCurrentCompanyId && _agendaCurrentUserId) {
        loadAgenda(_agendaCurrentCompanyId, _agendaCurrentUserId);
        console.log('📅 Agenda recargada en tiempo real');
    }
};