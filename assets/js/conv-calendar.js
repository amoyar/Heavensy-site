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
let _calActiveFilter     = null;  // status filtrado, null = todos
let _calSpecialistFilter = null;  // resource_id filtrado, null = todos
let _calAppointments = [];   // todas las citas del mes cargado
let _calSummary      = {};   // resumen por status del mes
let _calResources    = [];   // lista de {resource_id, name} de la empresa

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
            `${API_BASE_URL || ''}/api/calendar/company?month=${month}`,
            { headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        _calAppointments = data.appointments || [];
        _calSummary      = data.summary      || {};
        _calResources    = data.resources    || [];
    } catch(err) {
        console.error('❌ Error cargando citas del calendario:', err);
        _calAppointments = [];
        _calSummary      = {};
        _calResources    = [];
    }
}


// ============================================
// CONSTRUCCIÓN DEL DOM
// ============================================

function _calBuild(container) {
    container.innerHTML = '';
    container.style.opacity = '0';
    container.style.transition = 'opacity 0.25s ease';
    requestAnimationFrame(function() {
        requestAnimationFrame(function() {
            container.style.opacity = '1';
        });
    });

    // Agrupar citas por fecha (aplicar filtro de especialista al grid también)
    const byDate = {};
    const filteredAppts = _calSpecialistFilter
        ? _calAppointments.filter(a => a.resource_id === _calSpecialistFilter)
        : _calAppointments;
    filteredAppts.forEach(a => {
        if (!byDate[a.date]) byDate[a.date] = [];
        byDate[a.date].push(a);
    });

    // Resumen mensual (sobre citas filtradas por especialista)
    const summary = {};
    filteredAppts.forEach(a => {
        const s = a.status;
        if (!summary[s]) summary[s] = 0;
        summary[s]++;
    });

    // ── Filtro por especialista (sobre el calendario) ──
    if (_calResources.length > 1) {
        const specBar = document.createElement('div');
        specBar.className = 'cal-summary';
        specBar.style.marginBottom = '4px';

        const allSpecBtn = document.createElement('button');
        allSpecBtn.className = 'cal-filter-btn' + (_calSpecialistFilter === null ? ' cal-filter-btn--active' : '');
        allSpecBtn.style.cssText = '--filter-color:#374151;--filter-bg:#f3f4f6;';
        allSpecBtn.textContent = 'Todos';
        allSpecBtn.addEventListener('click', () => { _calSpecialistFilter = null; _calBuild(container); });
        specBar.appendChild(allSpecBtn);

        _calResources.forEach((spec, idx) => {
            const specColor = ['#7c3aed','#0ea5e9','#10b981','#f59e0b','#ef4444','#ec4899'][idx % 6];
            const btn = document.createElement('button');
            btn.className = 'cal-filter-btn' + (_calSpecialistFilter === spec.resource_id ? ' cal-filter-btn--active' : '');
            btn.style.cssText = `--filter-color:${specColor};--filter-bg:${specColor}14;`;
            const shortName = spec.name.split(' ').slice(-2).join(' ');
            btn.innerHTML = `<span class="cal-chip-dot" style="background:${specColor}"></span>${shortName}`;
            btn.addEventListener('click', () => {
                _calSpecialistFilter = _calSpecialistFilter === spec.resource_id ? null : spec.resource_id;
                _calBuild(container);
            });
            specBar.appendChild(btn);
        });
        container.appendChild(specBar);
    }

    // ── Calendario ────────────────────────────
    const cal = document.createElement('div');
    cal.className = 'cal-box';

    // Nav mes con toggle
    const nav = document.createElement('div');
    nav.className = 'cal-nav';
    nav.innerHTML = `
        <button class="cal-nav-btn" id="calPrevBtn"><i class="fas fa-chevron-left"></i></button>
        <span class="cal-nav-title" id="calNavTitle" style="cursor:pointer;user-select:none;">${_CAL_MONTHS[_calMonth]} ${_calYear}</span>
        <button class="cal-nav-btn" id="calNextBtn"><i class="fas fa-chevron-right"></i></button>
        <button class="cal-nav-btn cal-toggle-btn" id="calGridToggleBtn" title="Colapsar calendario"><i class="fas fa-chevron-up"></i></button>
    `;
    cal.appendChild(nav);

    // Grid colapsable — leer estado previo
    const _calGridCollapsed = window._calGridCollapsed || false;

    // Contenedor colapsable del grid
    const gridWrapper = document.createElement('div');
    gridWrapper.id = 'calGridWrapper';
    if (_calGridCollapsed) {
        gridWrapper.style.display    = 'none';
        gridWrapper.style.maxHeight  = '0px';
        gridWrapper.style.opacity    = '0';
        gridWrapper.style.overflow   = 'hidden';
        gridWrapper.style.transition = 'max-height 0.28s ease, opacity 0.24s ease';
        gridWrapper._rpSlideInit = true;
    } else {
        gridWrapper.style.display = 'block';
    }
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
        const isPast     = !isToday && dStr < todayStr;

        const cell = document.createElement('div');
        cell.className = 'cal-day' +
            (isToday    ? ' cal-day--today'    : '') +
            (isSelected ? ' cal-day--selected' : '') +
            (hasCitas   ? ' cal-day--has-citas': '') +
            (isPast     ? ' cal-day--past'     : '');

        cell.innerHTML = `<span class="cal-day-num">${d}</span>`;

        // Dots de colores — uno por status único presente en el día
        if (hasCitas) {
            const dots = document.createElement('div');
            dots.className = 'cal-dots';
            const uniqueStatuses = [...new Set(appts.map(a => a.status))].slice(0, 4);
            uniqueStatuses.forEach(status => {
                const cfg = _CAL_STATUS[status] || { dot: '#9ca3af' };
                const dot = document.createElement('span');
                dot.className = 'cal-dot';
                dot.style.background = cfg.dot;
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
            if (gw) rpSlide(gw, !window._calGridCollapsed);
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

    // ── Botones de filtro ────────────────────
    if (Object.keys(summary).length > 0) {
        const filterBar = document.createElement('div');
        filterBar.className = 'cal-summary';

        const allBtn = document.createElement('button');
        allBtn.className = 'cal-filter-btn' + (_calActiveFilter === null ? ' cal-filter-btn--active' : '');
        allBtn.style.cssText = '--filter-color:#374151;--filter-bg:#f3f4f6;';
        allBtn.textContent = 'Todas';
        allBtn.addEventListener('click', () => { _calActiveFilter = null; _calBuild(container); });
        filterBar.appendChild(allBtn);

        Object.entries(summary).filter(([,v]) => v > 0).forEach(([status, count]) => {
            const cfg = _CAL_STATUS[status] || { label: status, color: '#6b7280', bg: '#f3f4f6', dot: '#9ca3af' };
            const btn = document.createElement('button');
            btn.className = 'cal-filter-btn' + (_calActiveFilter === status ? ' cal-filter-btn--active' : '');
            btn.style.cssText = `--filter-color:${cfg.color};--filter-bg:${cfg.bg};`;
            btn.innerHTML = `<span class="cal-chip-dot" style="background:${cfg.dot}"></span>${count} ${cfg.label}${count > 1 ? 's' : ''}`;
            btn.addEventListener('click', () => {
                _calActiveFilter = _calActiveFilter === status ? null : status;
                _calBuild(container);
            });
            filterBar.appendChild(btn);
        });
        container.appendChild(filterBar);
    }

    // ── Panel día seleccionado ─────────────────
    if (_calSelected) {
        let selectedAppts = (byDate[_calSelected] || []).sort((a,b) => a.start.localeCompare(b.start));
        if (_calSpecialistFilter) selectedAppts = selectedAppts.filter(a => a.resource_id === _calSpecialistFilter);
        if (_calActiveFilter) selectedAppts = selectedAppts.filter(a => a.status === _calActiveFilter);
        const panel = _calBuildDayPanel(_calSelected, selectedAppts);
        // Fade-in suave
        panel.style.opacity   = '0';
        panel.style.transform = 'translateY(6px)';
        panel.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
        container.appendChild(panel);
        requestAnimationFrame(() => requestAnimationFrame(() => {
            panel.style.opacity   = '1';
            panel.style.transform = 'translateY(0)';
        }));
    }

    // ── Leyenda estática (todos los estados posibles) ──
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

    // Asignar color por especialista
    const specColors = ['#7c3aed','#0ea5e9','#10b981','#f59e0b','#ef4444','#ec4899'];
    const specColorMap = {};
    _calResources.forEach((r, i) => { specColorMap[r.resource_id] = specColors[i % specColors.length]; });

    appts.forEach(appt => {
        const cfg       = _CAL_STATUS[appt.status] || { label: appt.status, color: '#6b7280', bg: '#f9fafb', dot: '#9ca3af' };
        const specColor = specColorMap[appt.resource_id] || '#6b7280';
        const specName  = appt.resource_name || '';
        const initials  = specName.split(' ').filter(w => w.match(/^[A-ZÁÉÍÓÚÑ]/)).slice(0,2).map(w=>w[0]).join('');

        const item = document.createElement('div');
        item.className = 'cal-appt-item';
        item.style.borderLeft = `3px solid ${specColor}`;
        item.style.background = cfg.bg;
        item.innerHTML = `
            <div class="cal-appt-time">
                <span class="cal-appt-start">${appt.start}</span>
                <span class="cal-appt-end">${appt.end}</span>
            </div>
            <div class="cal-appt-info">
                <div class="cal-appt-service">${appt.service_name || appt.service_id || '—'}</div>
                <div class="cal-appt-contact" style="color:${specColor}">${specName}</div>
            </div>
            <div style="display:flex;flex-direction:column;align-items:flex-end;gap:3px;margin-left:auto;">
                <div class="cal-appt-badge" style="color:${cfg.color};border-color:${cfg.color}">
                    ${cfg.label}
                </div>
                ${appt.status === 'reserved' ? '<button class="cal-confirm-btn" data-confirm-id="' + appt._id + '" style="font-size:9.5px;font-weight:600;padding:2px 7px;border-radius:20px;background:#10b981;color:#fff;border:none;cursor:pointer;white-space:nowrap;">Confirmar</button>' : ''}
            </div>
        `;
        list.appendChild(item);
        if (appt.status === 'reserved') {
            const confirmBtn = item.querySelector('.cal-confirm-btn');
            if (confirmBtn) {
                const apptId = appt._id;
                confirmBtn.addEventListener('click', function() { _calShowConfirmModal(apptId); });
            }
        }

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
    .cal-nav { display:flex; align-items:center; gap:4px; padding:5px 12px 5px; background:#EFF6FF; border-radius:10px 10px 0 0; border-bottom:1px solid #C9D9FF; }
    .cal-nav-title { font-size:13px; font-weight:700; color:#7D84C1; flex:1; text-align:center; }
    .cal-toggle-btn {
        margin-left: auto;
        font-size: 11px;
        color: #9ca3af;
        transition: color 0.15s, transform 0.2s;
        padding: 2px 6px;
        border-radius: 6px;
    }
    .cal-toggle-btn:hover { color: #374151; background: #f3f4f6; }
    .cal-nav-btn { background:none; border:none; cursor:pointer; color:#9961FF; padding:2px 5px; border-radius:4px; font-size:11px; transition:background .15s; display:flex; align-items:center; justify-content:center; }
    .cal-nav-btn:hover { background:#E1DEFF; }
    .cal-toggle-btn { margin-left:2px; color:#9961FF; }
    .cal-toggle-btn:hover { color:#7D84C1; background:#E1DEFF; }

    /* Grid */
    .cal-grid { display:grid; grid-template-columns:repeat(7,1fr); padding:4px 4px 2px; }
    .cal-days-grid { padding:0 4px 4px; gap:2px; }
    .cal-day-header { text-align:center; font-size:10px; font-weight:600; color:#9ca3af; padding:2px 0; }

    /* Días */
    .cal-day { position:relative; text-align:center; padding:2px 1px; border-radius:5px; border:1.5px solid transparent; transition:all .12s; aspect-ratio:1; display:flex; flex-direction:column; align-items:center; justify-content:center; }
    .cal-day--has-citas { cursor:pointer; }
    .cal-day--has-citas:hover { background:#f5f3ff; }
    .cal-day--today { border-color:#9961FF; background:#EFF6FF; }
    .cal-day--selected { background:#9961FF !important; border-color:#9961FF !important; }
    .cal-day-num { font-size:11px; line-height:1.2; }
    .cal-day--has-citas .cal-day-num { font-weight:700; color:#1f2937; }
    .cal-day--today .cal-day-num    { color:#9961FF; font-weight:700; }
    .cal-day--selected .cal-day-num { color:#fff !important; }
    .cal-day:not(.cal-day--has-citas):not(.cal-day--past) .cal-day-num { color:#6b7280; }
    .cal-day--past .cal-day-num { color:#d1d5db; cursor:default; }

    /* Dots */
    .cal-dots { display:flex; gap:2px; margin-top:2px; justify-content:center; }
    .cal-dot   { width:4px; height:4px; border-radius:50%; display:inline-block; }
    .cal-day--selected .cal-dot { outline: 1.5px solid rgba(255,255,255,0.6); outline-offset: 0.5px; }

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
        .cal-appt-item    { transition: background 0.3s ease; }
        .cal-appt-badge   { transition: color 0.3s, border-color 0.3s, background 0.3s; }
        .cal-confirm-btn  { transition: opacity 0.25s, transform 0.25s; }
        .cal-confirm-btn.fading { opacity: 0; transform: scale(0.8); }
        .cal-inline-msg   { animation: calFadeIn 0.3s ease; }
        .cal-appt-item    { animation: calFadeIn 0.25s ease; }
        @keyframes calFadeIn { from { opacity:0; transform:translateY(-4px); } to { opacity:1; transform:translateY(0); } }
        .cal-inline-confirm { animation: calFadeIn 0.25s ease; }
        .agenda-pending-banner { transition: opacity 0.3s, max-height 0.4s, margin 0.3s; overflow:hidden; }
        .agenda-pending-banner.hiding { opacity:0; max-height:0; margin-bottom:0; }

    /* Leyenda */
    .cal-summary { display:flex; flex-wrap:wrap; gap:5px; margin-bottom:8px; }
    .cal-legend { display:flex; flex-wrap:wrap; gap:6px; justify-content:center; padding:6px 0 2px; }
    .cal-legend-item { display:inline-flex; align-items:center; gap:3px; font-size:9px; color:#9ca3af; }
    .cal-filter-btn {
        display: inline-flex; align-items: center; gap: 4px;
        font-size: 10px; font-weight: 600; padding: 4px 10px;
        border-radius: 20px; cursor: pointer; transition: all .15s;
        border: 1.5px solid var(--filter-color, #d1d5db);
        background: #fff;
        color: var(--filter-color, #6b7280);
        opacity: 0.5;
    }
    .cal-filter-btn:hover { opacity: 0.8; }
    .cal-filter-btn--active {
        background: var(--filter-bg, #f3f4f6);
        opacity: 1;
        box-shadow: 0 1px 3px 0 rgba(0,0,0,.08);
    }
    `;
    document.head.appendChild(style);
}

function _calShowConfirmModal(appointmentId) {
    // Cerrar cualquier panel inline previo
    const prev = document.querySelector('.cal-inline-confirm');
    if (prev) prev.remove();

    const calBtn = document.querySelector('[data-confirm-id="' + appointmentId + '"]');
    const anchor = calBtn ? calBtn.closest('.cal-appt-item') : null;

    const banner = document.querySelector('.agenda-pending-banner');
    const canConfirm = banner && typeof window._agendaConfirmPayment === 'function';

    const panel = document.createElement('div');
    panel.className = 'cal-inline-confirm';

    if (canConfirm) {
        // ── Flujo normal: pedir confirmación ──
        panel.style.cssText = 'background:#f0fdf4;border:0.5px solid #bbf7d0;border-radius:8px;padding:8px 10px;margin-top:6px;font-size:11px;animation:calFadeIn 0.2s ease;';
        panel.innerHTML = ''
            + '<div style="color:#166534;font-weight:600;margin-bottom:8px;"><i class="fas fa-check-circle" style="margin-right:4px;"></i>¿Confirmar pago recibido?</div>'
            + '<div style="display:flex;gap:6px;">'
            + '<button class="cal-inline-cancel" style="flex:1;padding:4px 0;font-size:11px;color:#6b7280;background:#fff;border:0.5px solid #e5e7eb;border-radius:6px;cursor:pointer;">Cancelar</button>'
            + '<button class="cal-inline-confirm-btn" style="flex:1;padding:4px 0;font-size:11px;font-weight:600;background:#10b981;color:#fff;border:none;border-radius:6px;cursor:pointer;">Sí, confirmar</button>'
            + '</div>';

        if (anchor) anchor.after(panel); else banner.before(panel);

        panel.querySelector('.cal-inline-cancel').addEventListener('click', () => panel.remove());
        panel.querySelector('.cal-inline-confirm-btn').addEventListener('click', () => {
            panel.remove();
            banner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            window._agendaConfirmPayment(appointmentId);
        });
    } else {
        // ── Sin reserva activa: aviso inline ──
        panel.style.cssText = 'background:#fef9c3;border:0.5px solid #fde047;border-radius:8px;padding:8px 10px;margin-top:6px;font-size:11px;animation:calFadeIn 0.2s ease;display:flex;align-items:center;justify-content:space-between;gap:8px;';
        panel.innerHTML = ''
            + '<span style="color:#92400e;"><i class="fas fa-exclamation-circle" style="margin-right:4px;color:#d97706;"></i>No hay reserva activa para confirmar.</span>'
            + '<button class="cal-inline-cancel" style="padding:2px 8px;font-size:10px;color:#6b7280;background:#fff;border:0.5px solid #e5e7eb;border-radius:5px;cursor:pointer;flex-shrink:0;">OK</button>';

        if (anchor) anchor.after(panel); else document.querySelector('#contactCalendarContainer')?.appendChild(panel);

        panel.querySelector('.cal-inline-cancel').addEventListener('click', () => panel.remove());
        // Auto-cerrar a los 4 segundos
        setTimeout(() => { if (panel.parentNode) panel.remove(); }, 4000);
    }
}

async function _calConfirmReservation(appointmentId, overlay) {
    var btn = overlay ? overlay.querySelector('#calModalConfirm') : null;
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; }
    try {
        const res = await fetch(`${API_BASE_URL || ''}/api/agenda/reservations/${appointmentId}/confirm`, {
            method: 'PATCH',
            headers: { ..._agendaAuthHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ payment_reference: 'manual' })
        });
        var data = await res.json();
        if (overlay) overlay.remove();
        if (data.success) {
            var appt = _calAppointments.find(function(a){ return a._id === appointmentId; });
            if (appt) appt.status = 'confirmed';
            // Cerrar todos los banners de reserva pendiente en Agenda
            document.querySelectorAll('.agenda-pending-banner').forEach(function(b) {
                b.classList.add('hiding');
                setTimeout(function() { if (b.parentNode) b.remove(); }, 400);
            });
            // Render completo del calendario para actualizar contadores, filtros y dots
            var container = document.getElementById('contactCalendarContainer');
            if (container) _calBuild(container);
            // Refrescar Agenda si está abierta
            if (typeof loadAgenda === 'function' && window._agendaCurrentUserId && window._agendaCurrentCompanyId) {
                loadAgenda(window._agendaCurrentCompanyId, window._agendaCurrentUserId);
            }
        } else {
            _calShowMsg(data.error || 'Error al confirmar', 'error');
        }
    } catch(e) {
        if (overlay) overlay.remove();
        _calShowMsg('Error de conexión', 'error');
    }
}

// ============================================
// ACTUALIZACIÓN QUIRÚRGICA DE ITEM
// ============================================
function _calUpdateItemStatus(appointmentId, newStatus) {
    var cfg = _CAL_STATUS[newStatus] || { label: newStatus, color: '#6b7280', bg: '#f9fafb' };

    // Actualizar badge
    var badge = document.querySelector('[data-confirm-id="' + appointmentId + '"]');
    if (badge) {
        var item = badge.closest('.cal-appt-item');
        if (item) {
            // Fade out el botón confirmar
            badge.classList.add('fading');
            setTimeout(function() {
                badge.remove();
                // Actualizar badge de status
                var badgeEl = item.querySelector('.cal-appt-badge');
                if (badgeEl) {
                    badgeEl.style.color = cfg.color;
                    badgeEl.style.borderColor = cfg.color;
                    badgeEl.textContent = cfg.label;
                }
                // Actualizar bg del item
                item.style.background = cfg.bg;
            }, 250);
        }
    } else {
        // Si no encuentra el botón, rebuild completo como fallback
        var container = document.getElementById('contactCalendarContainer');
        if (container) _calBuild(container);
    }

    // Actualizar filtros de resumen sin rebuild
    var summaryBtn = document.querySelector('.cal-filter-btn[data-status="reserved"]');
    if (summaryBtn) {
        var count = _calAppointments.filter(function(a){ return a.status === 'reserved'; }).length;
        var dot = summaryBtn.querySelector('.cal-chip-dot');
        if (count === 0 && summaryBtn.parentNode) {
            summaryBtn.style.transition = 'opacity 0.3s';
            summaryBtn.style.opacity = '0';
            setTimeout(function(){ summaryBtn.remove(); }, 300);
        }
    }
}