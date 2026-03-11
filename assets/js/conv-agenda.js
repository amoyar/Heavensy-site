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

// ─── Estado del módulo ────────────────────────────────────────────────────────
let _agendaCurrentUserId    = null;
let _agendaCurrentCompanyId = null;
let _agendaMyResource       = null;   // recurso del profesional logueado
let _agendaMyServices       = [];     // servicios del profesional
const _svcColors = ['#7c3aed','#0ea5e9','#10b981','#f59e0b','#ef4444','#ec4899','#8b5cf6','#14b8a6'];
let _agendaSelectedService  = null;   // servicio seleccionado
let _agendaSelectedDate     = null;   // fecha seleccionada en el calendario
let _agendaCalendarMonth    = null;   // mes visible (Date primer día del mes)
let _agendaSlots            = [];     // slots del día seleccionado
let _agendaBooking          = false;  // proceso de agendamiento en curso


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
        const res = await fetch(
            `${API_BASE_URL || ''}/api/agenda/my`,
            { headers: _agendaAuthHeaders() }
        );

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        if (!data.has_agenda) {
            _agendaRenderNoAgenda();
            return;
        }

        _agendaMyResource      = data.resource;
        _agendaMyServices      = data.services || [];
        _agendaSchedulingMode  = data.scheduling_mode || 'sequential';
        _agendaReservationTtl  = data.reservation_ttl || 30;
        _agendaPaymentMode     = data.payment_mode || 'manual';
        _agendaSelectedService = _agendaMyServices[0] || null;

        // Mes inicial = hoy
        const today = _agendaToday();
        _agendaCalendarMonth = new Date(today.getFullYear(), today.getMonth(), 1);

        await _agendaRenderPanel();

    } catch (err) {
        console.error('❌ Error cargando agenda:', err);
        _agendaRenderError();
    } finally {
        _agendaLoading = false;
    }
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

    // ── SEQUENTIAL: Próximos cupos por servicio ────────
    await _agendaRenderNextSlotsByService(container);

    // ── 2. Separador + botón buscar por día ───
    const calToggle = document.createElement('div');
    calToggle.className = 'agenda-cal-toggle';
    calToggle.id = 'agendaCalToggle';
    calToggle.innerHTML = `
        <button class="agenda-btn-search-day" onclick="_agendaToggleCalendar()">
            <i class="fas fa-calendar-search"></i> Buscar otro día
        </button>
    `;
    container.appendChild(calToggle);

    // ── 3. Calendario (oculto por defecto) ────
    const calWrapper = document.createElement('div');
    calWrapper.id = 'agendaCalWrapper';
    calWrapper.style.display = 'none';
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

        const svcName = document.createElement('div');
        svcName.className = 'agenda-next-svc-name';
        const svcColor = _svcColors[idx % _svcColors.length];
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
            const open = row.style.display !== 'none';

            // Colapsar todos y quitar highlight
            document.querySelectorAll('.agenda-next-svc-block').forEach(block => {
                const otherRow = block.querySelector('.agenda-next-slots-row');
                const otherHdr = block.querySelector('.agenda-next-svc-name--toggle');
                const otherChev = block.querySelector('.agenda-next-svc-chevron');
                if (otherRow)  otherRow.style.display = 'none';
                if (otherHdr)  { otherHdr.style.background = ''; otherHdr.style.borderRadius = ''; }
                if (otherChev) otherChev.className = 'fas fa-chevron-right agenda-next-svc-chevron';
            });

            // Si estaba cerrado, abrir éste y resaltar
            if (open) {
                // Ya lo colapsamos arriba — no hacer nada más
            } else {
                row.style.display = 'flex';
                chev.className = 'fas fa-chevron-down agenda-next-svc-chevron';
                svcName.style.background    = `${svcColor}22`;
                svcName.style.borderRadius  = '8px';
                _agendaSelectedService = svc;
            }
        });
        // Highlight inicial si es el primero (abierto por defecto)
        if (isOpen) {
            svcName.style.background   = `${svcColor}22`;
            svcName.style.borderRadius = '8px';
        }
        svcBlock.appendChild(svcName);

        const slotsRow = document.createElement('div');
        slotsRow.className = 'agenda-next-slots-row';
        slotsRow.id = svcId;
        slotsRow.style.display = isOpen ? 'flex' : 'none';
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


function _agendaOnNextSlotClick(svc, slot, btn, color = '#7c3aed') {
    _agendaSelectedService = svc;
    _agendaSelectedDate    = slot.date;

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
    const btn     = document.querySelector('.agenda-btn-search-day');
    if (!wrapper) return;
    const isOpen = wrapper.style.display !== 'none';
    wrapper.style.display = isOpen ? 'none' : 'block';
    if (btn) {
        btn.innerHTML = isOpen
            ? '<i class="fas fa-calendar-search"></i> Buscar otro día'
            : '<i class="fas fa-calendar-search"></i> Buscar otro día';
    }
}


// ============================================
// MINI CALENDARIO
// ============================================

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
        <button class="agenda-cal-nav agenda-cal-toggle-btn" id="agendaCalGridToggle" title="Colapsar"><i class="fas fa-chevron-${window._agendaCalCollapsed ? 'down' : 'up'}"></i></button>
    `;
    wrapper.appendChild(header);

    // ── Contenedor colapsable ─────────────────
    const gridWrapper = document.createElement('div');
    gridWrapper.id = 'agendaCalGridWrapper';
    gridWrapper.style.display = window._agendaCalCollapsed ? 'none' : 'block';
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
            if (gw) gw.style.display = window._agendaCalCollapsed ? 'none' : 'block';
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
            if (str === dateStr) el.classList.add('agenda-cal-cell--selected');
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

    container.innerHTML = `
        <div class="agenda-slots-header">
            <span><i class="fas fa-calendar-day"></i> ${_agendaFormatDate(_agendaSelectedDate)}</span>
        </div>
        <div class="agenda-slots-loading">
            <i class="fas fa-spinner fa-spin"></i> Cargando horarios...
        </div>
    `;

    try {
        const res = await fetch(
            `${API_BASE_URL || ''}/api/agenda/availability/${_agendaMyResource._id}/${_agendaSelectedService.service_id}?date=${_agendaSelectedDate}`,
            { headers: _agendaAuthHeaders() }
        );

        const data = await res.json();
        _agendaSlots = data.slots || [];

        container.innerHTML = `
            <div class="agenda-slots-header">
                <span><i class="fas fa-calendar-day"></i> ${_agendaFormatDate(_agendaSelectedDate)}</span>
                <span class="agenda-slots-count">${_agendaSlots.length} disponible${_agendaSlots.length !== 1 ? 's' : ''}</span>
            </div>
        `;

        if (_agendaSlots.length === 0) {
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

        const grid = document.createElement('div');
        grid.className = 'agenda-slots-grid';

        _agendaSlots.forEach(slot => {
            const btn = document.createElement('button');
            btn.className = 'agenda-slot-btn';
            btn.textContent = slot.start;
            btn.dataset.start = slot.start;
            btn.dataset.end   = slot.end;
            btn.addEventListener('click', () => _agendaOnSlotClick(slot, btn));
            grid.appendChild(btn);
        });

        container.appendChild(grid);

        // Panel de confirmación (oculto inicialmente)
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
                    resource_id: _agendaMyResource._id,
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
                <button class="agenda-appt-cancel-btn" title="Cancelar cita"
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
    if (section && !section.classList.contains('hidden')) {
        if (typeof _calRender === 'function') _calRender();
    }
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

(function _agendaInjectStyles() {
    if (document.getElementById('agendaStyles')) return;
    const style = document.createElement('style');
    style.id = 'agendaStyles';
    style.textContent = `

    /* ── Contenedor general ─────────────────── */
    #contactAgendaContainer {
        padding: 4px 0 8px 0;
        font-size: 12px;
        color: #374151;
    }

    /* ── Estado genérico ────────────────────── */
    .agenda-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        padding: 16px 0;
        color: #7c3aed;
        font-size: 12px;
    }
    .agenda-state i { font-size: 18px; }
    .agenda-state--muted { color: #9ca3af; }
    .agenda-state--error { color: #ef4444; }

    /* ── Selector de servicio ───────────────── */
    .agenda-service-row { margin-bottom: 8px; }
    .agenda-service-select {
        width: 100%;
        padding: 5px 8px;
        border: 1px solid #e5e7eb;
        border-radius: 6px;
        font-size: 11.5px;
        color: #374151;
        background: #fafafa;
        cursor: pointer;
        outline: none;
    }
    .agenda-service-select:focus { border-color: #7c3aed; }
    .agenda-service-tag {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        font-size: 11px;
        color: #6d28d9;
        background: #ede9fe;
        padding: 3px 8px;
        border-radius: 20px;
        margin-bottom: 8px;
    }

    /* ── Calendario ─────────────────────────── */
    .agenda-calendar {
        background: #fff;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        overflow: hidden;
        margin-bottom: 8px;
    }
    .agenda-cal-header {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 10px 12px 10px;
        background: linear-gradient(135deg, #eff6ff, #dbeafe);
        border-radius: 8px 8px 0 0;
        border-bottom: 1px solid #e5e7eb;
        margin-bottom: 0;
    }
    .agenda-cal-title {
        font-size: 13px;
        font-weight: 700;
        color: #1e40af;
        flex: 1;
        text-align: center;
    }
    .agenda-cal-nav {
        background: none;
        border: none;
        cursor: pointer;
        color: #3b82f6;
        padding: 2px 5px;
        border-radius: 4px;
        font-size: 11px;
        transition: background .15s;
    }
    .agenda-cal-nav:hover { background: #dbeafe; }
    .agenda-cal-toggle-btn { margin-left: 2px; color: #93c5fd; }
    .agenda-cal-toggle-btn:hover { color: #1e40af; background: #dbeafe; }

    .agenda-cal-days-row {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        gap: 2px;
        margin-bottom: 3px;
    }
    .agenda-cal-dayname {
        text-align: center;
        font-size: 10px;
        font-weight: 600;
        color: #9ca3af;
        padding: 2px 0;
    }
    .agenda-cal-grid {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        gap: 2px;
    }
    .agenda-cal-cell {
        aspect-ratio: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 11px;
        border-radius: 5px;
        cursor: pointer;
        color: #374151;
        transition: background .12s, color .12s;
        user-select: none;
    }
    .agenda-cal-cell:not(.agenda-cal-cell--past):not(.agenda-cal-cell--empty):hover {
        background: #ede9fe;
        color: #7c3aed;
    }
    .agenda-cal-cell--today {
        font-weight: 700;
        color: #7c3aed;
        border: 1px solid #7c3aed;
    }
    .agenda-cal-cell--past {
        color: #d1d5db;
        cursor: default;
    }
    .agenda-cal-cell--selected {
        background: #7c3aed !important;
        color: #fff !important;
        font-weight: 600;
    }
    .agenda-cal-cell--empty { cursor: default; }

    /* ── Slots ──────────────────────────────── */
    .agenda-slots-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 11px;
        font-weight: 600;
        color: #374151;
        margin-bottom: 6px;
    }
    .agenda-slots-count {
        background: #ede9fe;
        color: #7c3aed;
        padding: 1px 7px;
        border-radius: 10px;
        font-size: 10px;
    }
    .agenda-slots-loading {
        text-align: center;
        color: #9ca3af;
        font-size: 11px;
        padding: 10px 0;
    }
    .agenda-slots-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 4px;
        margin-bottom: 8px;
    }
    .agenda-slot-btn {
        padding: 5px 0;
        border: 1px solid #e5e7eb;
        border-radius: 5px;
        background: #fff;
        font-size: 11px;
        color: #374151;
        cursor: pointer;
        text-align: center;
        transition: all .12s;
    }
    .agenda-slot-btn:hover {
        border-color: #7c3aed;
        color: #7c3aed;
        background: #faf5ff;
    }
    .agenda-slot-btn--selected {
        background: #7c3aed !important;
        color: #fff !important;
        border-color: #7c3aed !important;
        font-weight: 600;
    }

    /* ── Panel de confirmación ──────────────── */
    .agenda-confirm-panel {
        background: #faf5ff;
        border: 1px solid #c4b5fd;
        border-radius: 8px;
        padding: 10px;
        margin-top: 4px;
        animation: agendaFadeIn .15s ease;
    }
    .agenda-confirm-panel--hidden { display: none; }
    .agenda-confirm-info { margin-bottom: 8px; }
    .agenda-confirm-row {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 11.5px;
        color: #4b5563;
        margin-bottom: 3px;
    }
    .agenda-confirm-row i { color: #7c3aed; width: 12px; }
    .agenda-notes-input {
        width: 100%;
        box-sizing: border-box;
        padding: 5px 8px;
        border: 1px solid #e5e7eb;
        border-radius: 5px;
        font-size: 11px;
        color: #374151;
        margin-bottom: 8px;
        outline: none;
    }
    .agenda-notes-input:focus { border-color: #7c3aed; }
    .agenda-confirm-actions {
        display: flex;
        gap: 6px;
    }
    .agenda-btn-cancel-confirm {
        flex: 1;
        padding: 6px;
        border: 1px solid #e5e7eb;
        border-radius: 5px;
        background: #fff;
        font-size: 11px;
        color: #6b7280;
        cursor: pointer;
    }
    .agenda-btn-cancel-confirm:hover { background: #f9fafb; }
    .agenda-btn-confirm {
        flex: 2;
        padding: 6px;
        border: none;
        border-radius: 5px;
        background: #7c3aed;
        color: #fff;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
        transition: background .12s;
    }
    .agenda-btn-confirm:hover:not(:disabled) { background: #6d28d9; }
    .agenda-btn-confirm:disabled { opacity: .6; cursor: default; }

    /* ── Éxito ──────────────────────────────── */
    .agenda-success {
        text-align: center;
        padding: 12px 8px;
        animation: agendaFadeIn .2s ease;
    }
    .agenda-success-icon { font-size: 28px; color: #22c55e; margin-bottom: 6px; }
    .agenda-success-title { font-size: 13px; font-weight: 700; color: #1f2937; margin-bottom: 4px; }
    .agenda-success-detail { font-size: 11px; color: #6b7280; margin-bottom: 10px; line-height: 1.6; }
    .agenda-btn-new {
        padding: 6px 14px;
        border: 1px dashed #7c3aed;
        border-radius: 6px;
        background: #fff;
        color: #7c3aed;
        font-size: 11px;
        cursor: pointer;
        transition: background .12s;
    }
    .agenda-btn-new:hover { background: #faf5ff; }

    /* ── Sin horarios + waitlist ────────────── */
    .agenda-no-slots {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        padding: 12px 0;
        color: #9ca3af;
        font-size: 11px;
    }
    .agenda-no-slots i { font-size: 20px; }
    .agenda-btn-waitlist {
        padding: 5px 12px;
        border: 1px solid #e5e7eb;
        border-radius: 5px;
        background: #fff;
        font-size: 11px;
        color: #6b7280;
        cursor: pointer;
        transition: all .12s;
    }
    .agenda-btn-waitlist:hover { border-color: #7c3aed; color: #7c3aed; }

    /* ── Hint ───────────────────────────────── */
    .agenda-hint {
        text-align: center;
        color: #9ca3af;
        font-size: 11px;
        padding: 10px 0;
        margin: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 5px;
    }

    /* ── Error inline ───────────────────────── */
    .agenda-error-inline {
        margin-top: 6px;
        padding: 5px 8px;
        background: #fef2f2;
        border: 1px solid #fecaca;
        border-radius: 5px;
        font-size: 11px;
        color: #dc2626;
        display: flex;
        gap: 5px;
        align-items: center;
    }
    .agenda-error-msg {
        text-align: center;
        color: #ef4444;
        font-size: 11px;
        padding: 8px 0;
        margin: 0;
    }

    /* ── Citas del contacto ─────────────────── */
    .agenda-contact-appts {
        margin-top: 8px;
        border-top: 1px solid #f3f4f6;
        padding-top: 8px;
    }
    .agenda-appts-title {
        font-size: 11px;
        font-weight: 600;
        color: #374151;
        display: flex;
        align-items: center;
        gap: 5px;
        margin-bottom: 6px;
    }
    .agenda-appts-title i { color: #7c3aed; }
    .agenda-appts-loading {
        text-align: center;
        color: #9ca3af;
        font-size: 11px;
        padding: 6px 0;
    }
    .agenda-appt-item {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 5px 6px;
        border-radius: 6px;
        margin-bottom: 3px;
        transition: background .1s;
    }
    .agenda-appt-item:hover { background: #f9fafb; }
    .agenda-appt-date {
        display: flex;
        flex-direction: column;
        align-items: center;
        min-width: 36px;
    }
    .agenda-appt-day {
        font-size: 11px;
        font-weight: 700;
        color: #7c3aed;
        line-height: 1.2;
    }
    .agenda-appt-time {
        font-size: 10px;
        color: #9ca3af;
    }
    .agenda-appt-info {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
    }
    .agenda-appt-service {
        font-size: 11px;
        color: #374151;
        font-weight: 500;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
    .agenda-appt-status {
        font-size: 10px;
        padding: 1px 6px;
        border-radius: 10px;
        display: inline-block;
        width: fit-content;
    }
    .agenda-status--scheduled   { background: #ede9fe; color: #7c3aed; }
    .agenda-status--confirmed   { background: #d1fae5; color: #059669; }
    .agenda-status--arrived     { background: #dbeafe; color: #2563eb; }
    .agenda-status--inprogress  { background: #fef3c7; color: #d97706; }
    .agenda-status--completed   { background: #f3f4f6; color: #6b7280; }
    .agenda-status--noshow      { background: #fee2e2; color: #dc2626; }
    .agenda-status--cancelled   { background: #f3f4f6; color: #9ca3af; }
    .agenda-appt-cancel-btn {
        background: none;
        border: none;
        color: #d1d5db;
        cursor: pointer;
        padding: 2px 4px;
        border-radius: 4px;
        font-size: 10px;
        transition: color .1s;
        flex-shrink: 0;
    }
    .agenda-appt-cancel-btn:hover { color: #ef4444; }


    /* ── Próximos cupos por servicio ────────── */
    .agenda-next-slots-section {
        margin-bottom: 8px;
    }
    .agenda-next-slots-title {
        font-size: 10.5px;
        font-weight: 700;
        color: #7c3aed;
        text-transform: uppercase;
        letter-spacing: .04em;
        display: flex;
        align-items: center;
        gap: 5px;
        margin-bottom: 8px;
    }
    .agenda-next-svc-block {
        margin-bottom: 8px;
    }
    .agenda-next-svc-name {
        display: flex;
        align-items: center;
        gap: 5px;
        font-size: 11px;
        font-weight: 600;
        color: #374151;
        margin-bottom: 5px;
    }
    .agenda-next-svc-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #7c3aed;
        flex-shrink: 0;
    }
    .agenda-next-svc-name--toggle {
        cursor: pointer;
        user-select: none;
        border-radius: 5px;
        padding: 2px 4px;
        margin: 0 -4px;
        transition: background .1s;
    }
    .agenda-next-svc-name--toggle:hover { background: #f3f4f6; }
    .agenda-next-svc-chevron {
        font-size: 9px;
        color: #9ca3af;
        margin-left: auto;
        flex-shrink: 0;
    }
    .agenda-next-svc-duration {
        font-size: 10px;
        color: #9ca3af;
        font-weight: 400;
        margin-left: auto;
    }
    .agenda-next-slots-row {
        display: flex;
        gap: 4px;
        flex-wrap: wrap;
    }
    .agenda-next-loading {
        font-size: 11px;
        color: #9ca3af;
        padding: 4px 0;
    }
    .agenda-next-empty {
        font-size: 11px;
        color: #d1d5db;
        font-style: italic;
    }
    .agenda-next-slot-pill {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 5px 8px;
        border: 1px solid #e5e7eb;
        border-radius: 7px;
        background: #fff;
        cursor: pointer;
        transition: all .12s;
        min-width: 52px;
    }
    .agenda-next-slot-pill:hover {
        border-color: #7c3aed;
        background: #faf5ff;
    }
    .agenda-next-slot-pill--selected {
        border-color: #7c3aed !important;
        background: #7c3aed !important;
    }
    .agenda-next-slot-pill--selected .agenda-next-slot-date,
    .agenda-next-slot-pill--selected .agenda-next-slot-time {
        color: #fff !important;
    }
    .agenda-next-slot-date {
        font-size: 9.5px;
        color: #9ca3af;
        line-height: 1.2;
    }
    .agenda-next-slot-time {
        font-size: 12px;
        font-weight: 700;
        color: #374151;
        line-height: 1.3;
    }

    /* ── Botón buscar otro día ──────────────── */
    .agenda-cal-toggle {
        margin: 4px 0 8px 0;
        text-align: center;
    }
    .agenda-btn-search-day {
        padding: 5px 12px;
        border: 1px dashed #c4b5fd;
        border-radius: 6px;
        background: #faf5ff;
        color: #7c3aed;
        font-size: 11px;
        cursor: pointer;
        transition: all .12s;
        display: inline-flex;
        align-items: center;
        gap: 5px;
    }
    .agenda-btn-search-day:hover {
        background: #ede9fe;
        border-color: #7c3aed;
    }

    /* ── Confirm inline citas ──────────────── */
    .agenda-appt-confirm-inline {
        display: flex;
        align-items: center;
        gap: 5px;
        padding: 4px 6px;
        background: #fef2f2;
        border: 1px solid #fecaca;
        border-radius: 6px;
        font-size: 11px;
        color: #dc2626;
        margin-top: 4px;
        animation: agendaFadeIn .15s ease;
    }
    .agenda-appt-confirm-inline span { flex: 1; }
    .agenda-appt-confirm-yes {
        padding: 2px 8px;
        background: #dc2626;
        color: #fff;
        border: none;
        border-radius: 4px;
        font-size: 11px;
        cursor: pointer;
        font-weight: 600;
    }
    .agenda-appt-confirm-yes:hover { background: #b91c1c; }
    .agenda-appt-confirm-no {
        padding: 2px 8px;
        background: #fff;
        color: #6b7280;
        border: 1px solid #e5e7eb;
        border-radius: 4px;
        font-size: 11px;
        cursor: pointer;
    }
    .agenda-appt-confirm-no:hover { background: #f9fafb; }


    /* ── Reserva success ────────────────────── */
    .agenda-reservation-success {
        text-align: center;
        padding: 12px 8px;
        background: #f0fdf4;
        border: 1px solid #bbf7d0;
        border-radius: 10px;
        margin-bottom: 8px;
    }
    .agenda-reservation-success-icon {
        font-size: 28px;
        color: #10b981;
        margin-bottom: 6px;
    }
    .agenda-reservation-success-title {
        font-size: 13px;
        font-weight: 700;
        color: #065f46;
        margin-bottom: 8px;
    }
    .agenda-reservation-success-ttl {
        font-size: 11px;
        color: #6b7280;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 5px;
        margin-bottom: 10px;
    }
    .agenda-countdown {
        font-size: 16px;
        font-weight: 800;
        color: #10b981;
        font-variant-numeric: tabular-nums;
        min-width: 48px;
        display: inline-block;
    }
    .agenda-reservation-actions {
        display: flex;
        flex-direction: column;
        gap: 5px;
    }
    .agenda-btn-confirm-payment {
        padding: 7px 12px;
        background: #10b981;
        color: #fff;
        border: none;
        border-radius: 7px;
        font-size: 11.5px;
        font-weight: 600;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 5px;
        width: 100%;
        transition: background .12s;
    }
    .agenda-btn-confirm-payment:hover { background: #059669; }
    .agenda-btn-confirm-payment:disabled { opacity: .6; cursor: default; }
    .agenda-btn-send-msg {
        padding: 6px 12px;
        background: #ede9fe;
        color: #7c3aed;
        border: 1px solid #c4b5fd;
        border-radius: 7px;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 5px;
        width: 100%;
        transition: all .12s;
    }
    .agenda-btn-send-msg:hover { background: #ddd6fe; }
    .agenda-waiting-payment {
        font-size: 11px;
        color: #6b7280;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 5px;
        padding: 6px;
    }
    .agenda-ttl-row {
        background: #fffbeb;
        border-radius: 5px;
        padding: 4px 6px;
        font-size: 10.5px;
        color: #92400e;
    }

    /* ── Animación ──────────────────────────── */
    @keyframes agendaFadeIn {
        from { opacity: 0; transform: translateY(4px); }
        to   { opacity: 1; transform: translateY(0); }
    }

    `;
    document.head.appendChild(style);
})();


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
            const color = _svcColors[idx % _svcColors.length];

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
                <span>Se reserva por <strong>${_agendaReservationTtl} min</strong> hasta confirmar pago</span>
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
                resource_id: _agendaMyResource._id,
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
        _agendaShowReservationSuccess(data);

    } catch(err) {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-calendar-check"></i> Reservar hora'; }
        _agendaShowBookingError('Error de conexión');
    }
}

function _agendaShowReservationSuccess(data) {
    const container = document.getElementById('contactAgendaContainer');
    if (!container) return;

    const reservedUntil = new Date(data.reserved_until);

    container.innerHTML = `
        <div class="agenda-reservation-success">
            <div class="agenda-reservation-success-icon">
                <i class="fas fa-calendar-check"></i>
            </div>
            <div class="agenda-reservation-success-title">¡Hora reservada!</div>
            <div class="agenda-reservation-success-ttl">
                <i class="fas fa-hourglass-half"></i>
                Tiempo para confirmar pago:
                <span id="agendaCountdown" class="agenda-countdown">--:--</span>
            </div>
            <div class="agenda-reservation-actions">
                ${data.payment_mode === 'manual' ? `
                <button class="agenda-btn-confirm-payment" onclick="_agendaConfirmPayment('${data.appointment_id}')">
                    <i class="fas fa-check-circle"></i> Confirmar pago recibido
                </button>` : `
                <div class="agenda-waiting-payment">
                    <i class="fas fa-spinner fa-spin"></i> Esperando confirmación de pago...
                </div>`}
                <button class="agenda-btn-send-msg" onclick="_agendaSendReservationMsg()">
                    <i class="fas fa-paper-plane"></i> Enviar instrucciones al paciente
                </button>
            </div>
        </div>
    `;

    // Guardar mensaje en variable global para envío
    window._agendaPendingMessage = data.whatsapp_message;
    window._agendaPendingAppointmentId = data.appointment_id;

    // Iniciar countdown
    _agendaStartCountdown('agendaCountdown', reservedUntil, () => {
        _agendaRenderPanel(); // TTL venció → refrescar
    });
}

function _agendaStartCountdown(elementId, until, onExpire) {
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
            _agendaShowConfirmedSuccess();
            _agendaRefreshCalendarIfOpen();
        } else {
            console.error('❌ [Agenda] Error confirmando:', data);
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-check-circle"></i> Confirmar pago recibido'; }
            _agendaShowBookingError(data.error || 'Error al confirmar');
        }
    } catch(err) {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-check-circle"></i> Confirmar pago recibido'; }
    }
}

function _agendaShowConfirmedSuccess() {
    const container = document.getElementById('contactAgendaContainer');
    if (!container) return;

    container.innerHTML = `
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:20px;text-align:center;">
            <div style="font-size:28px;margin-bottom:8px;">✅</div>
            <div style="font-size:13px;font-weight:700;color:#166534;margin-bottom:4px;">¡Hora confirmada!</div>
            <div style="font-size:11px;color:#4ade80;margin-bottom:16px;">Pago registrado correctamente.</div>
            <button onclick="_agendaRenderPanel()" 
                style="font-size:11px;padding:6px 16px;background:#10b981;color:#fff;border:none;border-radius:8px;cursor:pointer;">
                Ver agenda
            </button>
        </div>`;
}

function _agendaSendReservationMsg() {
    const msg = window._agendaPendingMessage;
    if (!msg) return;

    // Intentar inyectar en el input del chat del panel principal
    const chatInput = document.getElementById('messageInput') ||
                      document.querySelector('.message-input') ||
                      document.querySelector('textarea[name="message"]');

    if (chatInput) {
        chatInput.value = msg;
        chatInput.dispatchEvent(new Event('input', { bubbles: true }));
        chatInput.focus();

        // Mostrar feedback
        const btn = document.querySelector('.agenda-btn-send-msg');
        if (btn) {
            btn.innerHTML = '<i class="fas fa-check"></i> Mensaje cargado en el chat';
            btn.style.background = '#10b981';
            setTimeout(() => {
                btn.innerHTML = '<i class="fas fa-paper-plane"></i> Enviar instrucciones al paciente';
                btn.style.background = '';
            }, 3000);
        }
    } else {
        // Fallback: copiar al clipboard
        navigator.clipboard.writeText(msg).then(() => {
            const btn = document.querySelector('.agenda-btn-send-msg');
            if (btn) {
                btn.innerHTML = '<i class="fas fa-check"></i> Copiado al portapapeles';
                btn.style.background = '#10b981';
                setTimeout(() => {
                    btn.innerHTML = '<i class="fas fa-paper-plane"></i> Enviar instrucciones al paciente';
                    btn.style.background = '';
                }, 3000);
            }
        });
    }
}