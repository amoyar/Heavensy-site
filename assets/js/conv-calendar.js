// ── Labels dinámicos según rubro ──────────────────────────────
function _calLabel(key, fallback) {
    return (typeof getCompanyLabel === 'function') ? getCompanyLabel(key, fallback) : fallback;
}

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
let _calServiceFilter    = null;  // service name (lowercase) filtrado, null = todos
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

    // Agrupar citas por fecha — aplicar los 3 filtros
    const byDate = {};
    const filteredAppts = _calAppointments.filter(a => {
        if (_calSpecialistFilter && a.resource_id !== _calSpecialistFilter) return false;
        if (_calServiceFilter && (a.service_name || a.service_id || '').toLowerCase().trim() !== _calServiceFilter) return false;
        if (_calActiveFilter  && a.status !== _calActiveFilter) return false;
        return true;
    });
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

    // ── Filtros: Prestador / Servicio / Estado ──────────────────────────
    const _calColorPalette = ['#7c3aed','#0ea5e9','#10b981','#f59e0b','#ef4444','#ec4899','#8b5cf6','#14b8a6'];
    const _calSectionState = window._calSectionState || { prestador: true, servicio: true, estado: true };
    window._calSectionState = _calSectionState;

    function _calMakeSection(key, label, buildContent) {
        const wrapper = document.createElement('div');
        wrapper.className = 'cal-filter-section';
        const isOpen = _calSectionState[key] !== false;
        const header = document.createElement('div');
        header.className = 'cal-filter-section-header';
        header.style.cssText = 'display:flex;align-items:center;gap:5px;cursor:pointer;user-select:none;padding:3px 2px;border-radius:6px;';
        header.innerHTML = `
            <span style="width:4px;height:4px;border-radius:50%;background:#9ca3af;display:inline-block;flex-shrink:0;margin-right:2px;"></span>
            <span style="flex:1;font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:.07em;">${label}</span>
            <i class="fas fa-chevron-${isOpen ? 'up' : 'down'}" style="font-size:8px;color:#9ca3af;"></i>
        `;
        header.addEventListener('click', () => {
            _calSectionState[key] = !_calSectionState[key];
            _calBuild(container);
        });
        wrapper.appendChild(header);
        if (isOpen) {
            const content = document.createElement('div');
            content.style.paddingLeft = '11px';
            content.style.padding = '2px 0 4px 11px';
            buildContent(content);
            wrapper.appendChild(content);
        }
        return wrapper;
    }

    // Calcular opciones visibles (filtros cruzados)
    const _visibleSpecIds = _calServiceFilter
        ? new Set(_calAppointments.filter(a => (a.service_name || a.service_id || '').toLowerCase().trim() === _calServiceFilter).map(a => a.resource_id))
        : null;
    const _visibleSvcNames = _calSpecialistFilter
        ? new Set(_calAppointments.filter(a => a.resource_id === _calSpecialistFilter).map(a => (a.service_name || a.service_id || '').toLowerCase().trim()))
        : null;

    const filtersWrapper = document.createElement('div');
    filtersWrapper.className = 'cal-filters-wrapper';

    // ── 1. PRESTADOR ──
    const visibleResources = _calResources.filter(r => !_visibleSpecIds || _visibleSpecIds.has(r.resource_id));
    if (visibleResources.length > 0) {
        filtersWrapper.appendChild(_calMakeSection('prestador', _calLabel('recurso', 'Prestador'), (content) => {
            const scroll = document.createElement('div');
            scroll.className = 'cal-filter-scroll';
            const allBtn = document.createElement('button');
            allBtn.className = 'cal-filter-row-btn' + (_calSpecialistFilter === null ? ' active' : '');
            allBtn.textContent = 'Todos';
            allBtn.addEventListener('click', () => { _calSpecialistFilter = null; _calBuild(container); });
            scroll.appendChild(allBtn);
            visibleResources.forEach((spec) => {
                const gi = _calResources.indexOf(spec);
                const agendaC = !spec.color && window._agendaGetSpecColor ? window._agendaGetSpecColor(spec.resource_id)?.text : null;
                const specColor = spec.color || agendaC || _calColorPalette[gi % _calColorPalette.length];
                const isActive = _calSpecialistFilter === spec.resource_id;
                const btn = document.createElement('button');
                btn.className = 'cal-filter-row-btn' + (isActive ? ' active' : '');
                if (isActive) { btn.style.background = specColor + '14'; btn.style.border = `1px solid ${specColor}4D`; btn.style.color = specColor; }
                btn.innerHTML = `<span class="cal-filter-row-dot" style="background:${specColor}"></span>${spec.name}`;
                btn.addEventListener('click', () => { _calSpecialistFilter = _calSpecialistFilter === spec.resource_id ? null : spec.resource_id; _calBuild(container); });
                scroll.appendChild(btn);
            });
            content.appendChild(scroll);
            setTimeout(() => { const a = scroll.querySelector('.cal-filter-row-btn.active:not(:first-child)'); if (a) a.scrollIntoView({ block: 'nearest' }); }, 0);
        }));
    }

    // ── 2. SERVICIO ──
    const allServices = [...new Map(
        _calAppointments.filter(a => a.service_name || a.service_id)
            .map(a => { const n = a.service_name || a.service_id; return [n.toLowerCase().trim(), { id: n.toLowerCase().trim(), name: n }]; })
    ).values()];
    const visibleServices = allServices.filter(s => !_visibleSvcNames || _visibleSvcNames.has(s.id));

    filtersWrapper.appendChild(_calMakeSection('servicio', _calLabel('servicio', 'Servicio'), (content) => {
        if (visibleServices.length === 0) {
            const msg = document.createElement('p');
            msg.style.cssText = 'font-size:10.5px;color:#9ca3af;padding:4px 2px;font-style:italic;';
            msg.textContent = 'Sin ' + _calLabel('servicios', 'servicios') + ' para el ' + _calLabel('recurso', 'prestador').toLowerCase() + ' seleccionado';
            content.appendChild(msg);
            return;
        }
        const scroll = document.createElement('div');
        scroll.className = 'cal-filter-scroll';
        const allBtn = document.createElement('button');
        allBtn.className = 'cal-filter-row-btn cal-filter-row-btn--svc' + (_calServiceFilter === null ? ' active' : '');
        allBtn.textContent = 'Todos';
        allBtn.addEventListener('click', () => { _calServiceFilter = null; _calBuild(container); });
        scroll.appendChild(allBtn);
        visibleServices.forEach((svc, idx) => {
            const svcColor = _calColorPalette[idx % _calColorPalette.length];
            const isActive = _calServiceFilter === svc.id;
            const btn = document.createElement('button');
            btn.className = 'cal-filter-row-btn cal-filter-row-btn--svc' + (isActive ? ' active' : '');
            if (isActive) { btn.style.background = svcColor + '14'; btn.style.border = `1px solid ${svcColor}4D`; btn.style.color = svcColor; }
            btn.innerHTML = `<span class="cal-filter-row-dot" style="background:${svcColor}"></span>${svc.name}`;
            btn.addEventListener('click', () => { _calServiceFilter = _calServiceFilter === svc.id ? null : svc.id; _calBuild(container); });
            scroll.appendChild(btn);
        });
        content.appendChild(scroll);
        setTimeout(() => { const a = scroll.querySelector('.cal-filter-row-btn.active:not(:first-child)'); if (a) a.scrollIntoView({ block: 'nearest' }); }, 0);
    }));

    // ── 3. ESTADO ──
    filtersWrapper.appendChild(_calMakeSection('estado', 'Estado', (content) => {
        const statusBar = document.createElement('div');
        statusBar.className = 'cal-summary';
        statusBar.style.marginBottom = '0';
        const allBtn = document.createElement('button');
        allBtn.className = 'cal-filter-btn' + (_calActiveFilter === null ? ' cal-filter-btn--active' : '');
        allBtn.style.cssText = '--filter-color:#374151;--filter-bg:#f3f4f6;';
        allBtn.textContent = 'Todos';
        allBtn.addEventListener('click', () => { _calActiveFilter = null; _calBuild(container); });
        statusBar.appendChild(allBtn);
        Object.entries(_CAL_STATUS).forEach(([key, cfg]) => {
            const btn = document.createElement('button');
            btn.className = 'cal-filter-btn' + (_calActiveFilter === key ? ' cal-filter-btn--active' : '');
            btn.style.cssText = `--filter-color:${cfg.color};--filter-bg:${cfg.bg};`;
            btn.innerHTML = `<span class="cal-chip-dot" style="background:${cfg.dot}"></span>${cfg.label}`;
            btn.addEventListener('click', () => { _calActiveFilter = _calActiveFilter === key ? null : key; _calBuild(container); });
            statusBar.appendChild(btn);
        });
        content.appendChild(statusBar);
    }));

    container.appendChild(filtersWrapper);

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
        <button class="cal-nav-btn cal-toggle-btn" id="calGridToggleBtn" data-tooltip="Colapsar calendario"><i class="fas fa-chevron-up"></i></button>
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


    // ── Panel día seleccionado ─────────────────
    if (_calSelected) {
        let selectedAppts = (byDate[_calSelected] || []).sort((a,b) => a.start.localeCompare(b.start));
        if (_calSpecialistFilter) selectedAppts = selectedAppts.filter(a => a.resource_id === _calSpecialistFilter);
        if (_calServiceFilter)    selectedAppts = selectedAppts.filter(a => (a.service_name || a.service_id || '').toLowerCase().trim() === _calServiceFilter);
        if (_calActiveFilter)     selectedAppts = selectedAppts.filter(a => a.status === _calActiveFilter);
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
    const _calCP = ['#7c3aed','#0ea5e9','#10b981','#f59e0b','#ef4444','#ec4899','#8b5cf6','#14b8a6'];
    const specColorMap = {};
    _calResources.forEach((r, i) => {
        const agendaC = !r.color && window._agendaGetSpecColor ? window._agendaGetSpecColor(r.resource_id)?.text : null;
        specColorMap[r.resource_id] = r.color || agendaC || _calCP[i % _calCP.length];
    });

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

// Refresh manual del calendario
window._calRefresh = function(el) {
    if (el) {
        el.classList.add('spinning');
        setTimeout(() => el.classList.remove('spinning'), 450);
    }
    const cid = _calCompanyId
        || window._agendaCurrentCompanyId
        || window._currentCompanyId
        || window.currentCompanyId
        || null;
    if (cid) _calLoadAndRender(cid);
};


// ============================================
// ESTILOS
// ============================================

// Estilos en assets/css/conv-calendar.css;