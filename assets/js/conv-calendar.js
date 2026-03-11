/**
 * conv-calendar.js
 * Módulo de Calendario de Citas — Heavensy
 *
 * Muestra un calendario mensual con todas las citas/reservas del recurso.
 * Click en un día → lista de citas del día con estado.
 * Se carga cuando se abre la sección CALENDARIO del panel derecho.
 */

console.log('📅 conv-calendar.js cargado');

// ============================================
// ESTADO
// ============================================

let _calCompanyId   = null;
let _calResourceId  = null;
let _calYear        = null;
let _calMonth       = null;  // 0-11
let _calSelected    = null;  // 'YYYY-MM-DD'
let _calAppointments = [];   // todas las citas del mes cargado
let _calSummary      = {};   // resumen por status del mes

const _CAL_MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const _CAL_DAYS   = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];

const _CAL_STATUS = {
    reserved:  { label: 'Reservada',  color: '#f59e0b', bg: '#fffbeb', dot: '#f59e0b' },
    confirmed: { label: 'Confirmada', color: '#10b981', bg: '#f0fdf4', dot: '#10b981' },
    scheduled: { label: 'Agendada',   color: '#3b82f6', bg: '#eff6ff', dot: '#3b82f6' },
    cancelled: { label: 'Cancelada',  color: '#ef4444', bg: '#fef2f2', dot: '#ef4444' },
    completed: { label: 'Completada', color: '#6b7280', bg: '#f9fafb', dot: '#9ca3af' },
    no_show:   { label: 'No asistió', color: '#8b5cf6', bg: '#faf5ff', dot: '#8b5cf6' },
    expired:   { label: 'Expirada',   color: '#d1d5db', bg: '#f9fafb', dot: '#d1d5db' },
};


// ============================================
// ENTRADA PÚBLICA
// ============================================

async function loadCalendar(companyId, resourceId) {
    _calCompanyId  = companyId;
    _calResourceId = resourceId;
    await _calLoadAndRender(companyId);
}

async function _calLoadAndRender(companyId) {
    const container = document.getElementById('contactCalendarContainer');
    if (!container) return;

    if (!companyId) {
        container.innerHTML = '<p class="cal-empty">Selecciona un contacto.</p>';
        return;
    }

    _calInjectStyles();
    container.innerHTML = '<div class="cal-loading"><i class="fas fa-spinner fa-spin"></i> Cargando...</div>';

    // Resolver resource_id: usar el de agenda si ya está, sino llamar /api/agenda/my
    if (!_calResourceId) {
        _calResourceId = window._agendaMyResource?._id || null;
    }

    if (!_calResourceId) {
        try {
            const token = localStorage.getItem('token') || sessionStorage.getItem('token') || '';
            const res = await fetch(
                `${API_BASE_URL || ''}/api/agenda/my`,
                { headers: { 'Authorization': `Bearer ${token}` } }
            );
            const data = await res.json();
            if (data.has_agenda && data.resource?._id) {
                _calResourceId = data.resource._id;
            }
        } catch(e) {
            console.error('❌ [Calendar] Error obteniendo recurso:', e);
        }
    }

    if (!_calResourceId) {
        container.innerHTML = '<p class="cal-empty">Sin agenda configurada.</p>';
        return;
    }

    const today  = new Date();
    if (!_calYear) {
        _calYear   = today.getFullYear();
        _calMonth  = today.getMonth();
        _calSelected = null;
    }

    await _calRender();
}


// ============================================
// RENDER PRINCIPAL
// ============================================

async function _calRender() {
    const container = document.getElementById('contactCalendarContainer');
    if (!container) return;

    container.innerHTML = '<div class="cal-loading"><i class="fas fa-spinner fa-spin"></i> Cargando citas...</div>';

    await _calLoadMonth();
    _calBuild(container);
}


// ============================================
// CARGA DE DATOS
// ============================================

async function _calLoadMonth() {
    const month = `${_calYear}-${String(_calMonth + 1).padStart(2,'0')}`;

    try {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token') || '';
        const res = await fetch(
            `${API_BASE_URL || ''}/api/calendar/resource/${_calResourceId}?month=${month}`,
            { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        _calAppointments = data.appointments || [];
        _calSummary      = data.summary      || {};
    } catch(err) {
        console.error('❌ Error cargando citas del calendario:', err);
        _calAppointments = [];
        _calSummary      = {};
    }
}


// ============================================
// CONSTRUCCIÓN DEL DOM
// ============================================

function _calBuild(container) {
    container.innerHTML = '';

    // Agrupar citas por fecha
    const byDate = {};
    _calAppointments.forEach(a => {
        if (!byDate[a.date]) byDate[a.date] = [];
        byDate[a.date].push(a);
    });

    // Resumen mensual
    const summary = {};
    _calAppointments.forEach(a => {
        const s = a.status;
        if (!summary[s]) summary[s] = 0;
        summary[s]++;
    });

    // ── Resumen chips ──────────────────────────
    if (Object.keys(summary).length > 0) {
        const summaryDiv = document.createElement('div');
        summaryDiv.className = 'cal-summary';
        summaryDiv.innerHTML = Object.entries(summary)
            .filter(([,v]) => v > 0)
            .map(([k, v]) => {
                const cfg = _CAL_STATUS[k] || { label: k, color: '#6b7280', bg: '#f3f4f6', dot: '#9ca3af' };
                return `<span class="cal-chip" style="color:${cfg.color};background:${cfg.bg};">
                    <span class="cal-chip-dot" style="background:${cfg.dot}"></span>
                    ${v} ${cfg.label}${v > 1 ? 's' : ''}
                </span>`;
            }).join('');
        container.appendChild(summaryDiv);
    }

    // ── Calendario ────────────────────────────
    const cal = document.createElement('div');
    cal.className = 'cal-box';

    // Nav mes con toggle
    const nav = document.createElement('div');
    nav.className = 'cal-nav';
    nav.innerHTML = `
        <button class="cal-nav-btn" id="calPrevBtn">‹</button>
        <span class="cal-nav-title" id="calNavTitle" style="cursor:pointer;user-select:none;">${_CAL_MONTHS[_calMonth]} ${_calYear}</span>
        <button class="cal-nav-btn" id="calNextBtn">›</button>
        <button class="cal-nav-btn cal-toggle-btn" id="calGridToggleBtn" title="Colapsar calendario"><i class="fas fa-chevron-up"></i></button>
    `;
    cal.appendChild(nav);

    // Grid colapsable — leer estado previo
    const _calGridCollapsed = window._calGridCollapsed || false;

    // Contenedor colapsable del grid
    const gridWrapper = document.createElement('div');
    gridWrapper.id = 'calGridWrapper';
    gridWrapper.style.display = _calGridCollapsed ? 'none' : 'block';
    cal.appendChild(gridWrapper);

    // Cabecera días semana
    const header = document.createElement('div');
    header.className = 'cal-grid';
    _CAL_DAYS.forEach(d => {
        const cell = document.createElement('div');
        cell.className = 'cal-day-header';
        cell.textContent = d;
        header.appendChild(cell);
    });
    gridWrapper.appendChild(header);

    // Días del mes
    const grid = document.createElement('div');
    grid.className = 'cal-grid cal-days-grid';

    const firstDow = _calFirstDow(_calYear, _calMonth); // 0=lun
    const daysInMonth = new Date(_calYear, _calMonth + 1, 0).getDate();
    const todayStr = _calTodayStr();

    // Espacios vacíos al inicio
    for (let i = 0; i < firstDow; i++) {
        const empty = document.createElement('div');
        grid.appendChild(empty);
    }

    for (let d = 1; d <= daysInMonth; d++) {
        const dStr   = `${_calYear}-${String(_calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        const appts  = byDate[dStr] || [];
        const isToday    = dStr === todayStr;
        const isSelected = dStr === _calSelected;
        const hasCitas   = appts.length > 0;

        const cell = document.createElement('div');
        cell.className = 'cal-day' +
            (isToday    ? ' cal-day--today'    : '') +
            (isSelected ? ' cal-day--selected' : '') +
            (hasCitas   ? ' cal-day--has-citas': '');

        cell.innerHTML = `<span class="cal-day-num">${d}</span>`;

        // Dots de colores (máx 3)
        if (hasCitas) {
            const dots = document.createElement('div');
            dots.className = 'cal-dots';
            appts.slice(0, 3).forEach(a => {
                const cfg = _CAL_STATUS[a.status] || { dot: '#9ca3af' };
                const dot = document.createElement('span');
                dot.className = 'cal-dot';
                dot.style.background = isSelected ? 'rgba(255,255,255,.85)' : cfg.dot;
                dots.appendChild(dot);
            });
            cell.appendChild(dots);
        }

        if (hasCitas) {
            cell.style.cursor = 'pointer';
            cell.addEventListener('click', () => {
                _calSelected = isSelected ? null : dStr;
                _calBuild(container);
            });
        }

        grid.appendChild(cell);
    }

    gridWrapper.appendChild(grid);
    container.appendChild(cal);

    // Botón toggle
    const toggleBtn = document.getElementById('calGridToggleBtn');
    if (toggleBtn) {
        toggleBtn.innerHTML = _calGridCollapsed ? '<i class="fas fa-chevron-down"></i>' : '<i class="fas fa-chevron-up"></i>';
        toggleBtn.addEventListener('click', () => {
            window._calGridCollapsed = !window._calGridCollapsed;
            const gw = document.getElementById('calGridWrapper');
            const tb = document.getElementById('calGridToggleBtn');
            if (gw) gw.style.display = window._calGridCollapsed ? 'none' : 'block';
            if (tb) tb.innerHTML = window._calGridCollapsed ? '<i class="fas fa-chevron-down"></i>' : '<i class="fas fa-chevron-up"></i>';
        });
    }

    // Event listeners nav
    document.getElementById('calPrevBtn').addEventListener('click', async () => {
        if (_calMonth === 0) { _calYear--; _calMonth = 11; }
        else _calMonth--;
        _calSelected = null;
        container.innerHTML = '<div class="cal-loading"><i class="fas fa-spinner fa-spin"></i></div>';
        await _calLoadMonth();
        _calBuild(container);
    });

    document.getElementById('calNextBtn').addEventListener('click', async () => {
        if (_calMonth === 11) { _calYear++; _calMonth = 0; }
        else _calMonth++;
        _calSelected = null;
        container.innerHTML = '<div class="cal-loading"><i class="fas fa-spinner fa-spin"></i></div>';
        await _calLoadMonth();
        _calBuild(container);
    });

    // ── Panel día seleccionado ─────────────────
    if (_calSelected) {
        const selectedAppts = (byDate[_calSelected] || []).sort((a,b) => a.start.localeCompare(b.start));
        const panel = _calBuildDayPanel(_calSelected, selectedAppts);
        container.appendChild(panel);
    }

    // ── Leyenda ────────────────────────────────
    const legend = document.createElement('div');
    legend.className = 'cal-legend';
    Object.entries(_CAL_STATUS).forEach(([, cfg]) => {
        legend.innerHTML += `
            <span class="cal-legend-item">
                <span class="cal-dot" style="background:${cfg.dot}"></span>
                ${cfg.label}
            </span>`;
    });
    container.appendChild(legend);
}


function _calBuildDayPanel(dateStr, appts) {
    const panel = document.createElement('div');
    panel.className = 'cal-day-panel';

    const dateHuman = new Date(dateStr + 'T12:00:00').toLocaleDateString('es-CL', {
        weekday: 'long', day: 'numeric', month: 'long'
    });

    panel.innerHTML = `
        <div class="cal-day-panel-header">
            <span class="cal-day-panel-title">${dateHuman}</span>
            <span class="cal-day-panel-count">${appts.length} cita${appts.length !== 1 ? 's' : ''}</span>
        </div>
    `;

    if (appts.length === 0) {
        panel.innerHTML += '<p class="cal-empty">Sin citas este día.</p>';
        return panel;
    }

    const list = document.createElement('div');
    list.className = 'cal-appt-list';

    appts.forEach(appt => {
        const cfg = _CAL_STATUS[appt.status] || { label: appt.status, color: '#6b7280', bg: '#f9fafb', dot: '#9ca3af' };
        const item = document.createElement('div');
        item.className = 'cal-appt-item';
        item.style.borderLeft = `3px solid ${cfg.color}`;
        item.style.background = cfg.bg;
        item.innerHTML = `
            <div class="cal-appt-time">
                <span class="cal-appt-start">${appt.start}</span>
                <span class="cal-appt-end">${appt.end}</span>
            </div>
            <div class="cal-appt-info">
                <div class="cal-appt-service">${appt.service_name || appt.service_id || '—'}</div>
                <div class="cal-appt-contact">${appt.contact_name || appt.contact_id || '—'}</div>
            </div>
            <div class="cal-appt-badge" style="color:${cfg.color};border-color:${cfg.color}">
                ${cfg.label}
            </div>
        `;
        list.appendChild(item);
    });

    panel.appendChild(list);
    return panel;
}


// ============================================
// HELPERS
// ============================================

function _calFirstDow(year, month) {
    const d = new Date(year, month, 1).getDay();
    return d === 0 ? 6 : d - 1; // lunes=0
}

function _calTodayStr() {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`;
}


// ============================================
// HOOK — llamar desde servicios.js al seleccionar conversación
// ============================================

// Guardar contexto actual al cambiar conversación
const _calPrevHook = window.onConversationSelectedForContacts;
window.onConversationSelectedForContacts = function(waId, phone, name, companyId) {
    if (typeof _calPrevHook === 'function') _calPrevHook(waId, phone, name, companyId);

    // Guardar contexto para uso posterior
    _calCompanyId = companyId;

    // Si la sección ya está abierta, recargar
    const section = document.getElementById('contactCalendarSection');
    if (section && !section.classList.contains('hidden')) {
        _calLoadAndRender(companyId);
    }
};

// Llamada directa desde el botón en el HTML
function calToggleLoad() {
    const section = document.getElementById('contactCalendarSection');
    setTimeout(() => {
        if (section && !section.classList.contains('hidden')) {
            // Fallbacks para obtener companyId si el hook aún no corrió
            const cid = _calCompanyId
                || window._agendaCurrentCompanyId
                || window._currentCompanyId
                || window.currentCompanyId
                || null;
            _calLoadAndRender(cid);
        }
    }, 0);
}


// ============================================
// ESTILOS
// ============================================

function _calInjectStyles() {
    if (document.getElementById('calStyles')) return;
    const style = document.createElement('style');
    style.id = 'calStyles';
    style.textContent = `
    .cal-loading { text-align:center; padding:16px; font-size:11px; color:#9ca3af; }
    .cal-empty   { text-align:center; padding:12px; font-size:11px; color:#d1d5db; font-style:italic; }

    /* Chips resumen */
    .cal-summary { display:flex; flex-wrap:wrap; gap:4px; margin-bottom:8px; }
    .cal-chip { display:inline-flex; align-items:center; gap:4px; padding:3px 8px; border-radius:20px; font-size:10px; font-weight:600; }
    .cal-chip-dot { width:5px; height:5px; border-radius:50%; flex-shrink:0; }

    /* Caja calendario */
    .cal-box { background:#fff; border-radius:12px; box-shadow:0 1px 6px rgba(0,0,0,.07); overflow:hidden; margin-bottom:8px; }

    /* Nav */
    .cal-nav { display:flex; align-items:center; gap:4px; padding:10px 12px 10px; background:linear-gradient(135deg,#f5f3ff,#ede9fe); border-radius:10px 10px 0 0; border-bottom:1px solid #e5e7eb; }
    .cal-nav-title { font-size:13px; font-weight:700; color:#4c1d95; flex:1; text-align:center; }
    .cal-toggle-btn {
        margin-left: auto;
        font-size: 11px;
        color: #9ca3af;
        transition: color 0.15s, transform 0.2s;
        padding: 2px 6px;
        border-radius: 6px;
    }
    .cal-toggle-btn:hover { color: #374151; background: #f3f4f6; }
    .cal-nav-btn { width:26px; height:26px; border-radius:6px; border:1px solid #e5e7eb; background:#fff; cursor:pointer; font-size:13px; color:#6b7280; display:flex; align-items:center; justify-content:center; line-height:1; transition:all .1s; }
    .cal-nav-btn:hover { background:#f3f4f6; }

    /* Grid */
    .cal-grid { display:grid; grid-template-columns:repeat(7,1fr); padding:6px 8px 2px; }
    .cal-days-grid { padding:2px 8px 8px; gap:2px; }
    .cal-day-header { text-align:center; font-size:9px; font-weight:700; color:#9ca3af; text-transform:uppercase; letter-spacing:.04em; padding:2px 0; }

    /* Días */
    .cal-day { position:relative; text-align:center; padding:5px 2px 3px; border-radius:7px; border:1.5px solid transparent; transition:all .12s; min-height:32px; display:flex; flex-direction:column; align-items:center; }
    .cal-day--has-citas { cursor:pointer; }
    .cal-day--has-citas:hover { background:#f5f3ff; }
    .cal-day--today { border-color:#c4b5fd; background:#ede9fe; }
    .cal-day--selected { background:#7c3aed !important; border-color:#7c3aed !important; }
    .cal-day-num { font-size:11.5px; line-height:1.2; }
    .cal-day--has-citas .cal-day-num { font-weight:700; color:#1f2937; }
    .cal-day--today .cal-day-num    { color:#7c3aed; font-weight:700; }
    .cal-day--selected .cal-day-num { color:#fff !important; }
    .cal-day:not(.cal-day--has-citas) .cal-day-num { color:#c4c4c4; }

    /* Dots */
    .cal-dots { display:flex; gap:2px; margin-top:2px; justify-content:center; }
    .cal-dot   { width:4px; height:4px; border-radius:50%; display:inline-block; }

    /* Panel día */
    .cal-day-panel { background:#fff; border-radius:12px; box-shadow:0 1px 6px rgba(0,0,0,.07); overflow:hidden; margin-bottom:8px; }
    .cal-day-panel-header { display:flex; align-items:center; justify-content:space-between; padding:9px 12px 7px; border-bottom:1px solid #f3f4f6; }
    .cal-day-panel-title  { font-size:11.5px; font-weight:700; color:#1f2937; text-transform:capitalize; }
    .cal-day-panel-count  { font-size:10px; background:#ede9fe; color:#7c3aed; padding:2px 8px; border-radius:20px; font-weight:600; }

    /* Lista citas */
    .cal-appt-list { padding:6px 8px; display:flex; flex-direction:column; gap:5px; max-height:280px; overflow-y:auto; scrollbar-width:thin; scrollbar-color:#e5e7eb transparent; }
    .cal-appt-item { display:flex; align-items:center; gap:8px; padding:7px 9px; border-radius:8px; }
    .cal-appt-time { text-align:center; min-width:34px; }
    .cal-appt-start { display:block; font-size:11px; font-weight:800; color:#1f2937; }
    .cal-appt-end   { display:block; font-size:9px; color:#9ca3af; }
    .cal-appt-info  { flex:1; min-width:0; }
    .cal-appt-service { font-size:11px; font-weight:600; color:#1f2937; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .cal-appt-contact { font-size:10px; color:#6b7280; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .cal-appt-badge   { font-size:9.5px; font-weight:600; padding:2px 7px; border-radius:20px; border:1px solid; background:#fff; white-space:nowrap; }

    /* Leyenda */
    .cal-legend { display:flex; flex-wrap:wrap; gap:6px; justify-content:center; padding:4px 0 2px; }
    .cal-legend-item { display:flex; align-items:center; gap:3px; font-size:9px; color:#9ca3af; }
    `;
    document.head.appendChild(style);
}