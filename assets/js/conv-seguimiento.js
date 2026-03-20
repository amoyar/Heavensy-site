// ============================================
// CONV-SEGUIMIENTO.JS — Panel de Seguimiento
// Módulo del panel derecho de conversaciones
//
// Responsabilidades:
//   - Cargar seguimientos del contacto
//   - Crear, editar, completar y eliminar seguimientos
//   - Expirar automáticamente los vencidos al cargar
//   - Renderizar historial con estados visuales
// ============================================

console.log('✅ conv-seguimiento.js cargado');

// ─── Estado ───────────────────────────────────────────────────────────────────
let _segContactId   = null;
let _segCompanyId   = null;
let _segFollowups   = [];
let _segChannels    = [];
let _segEditingId   = null;   // id del seguimiento en edición

// ─── Auth ─────────────────────────────────────────────────────────────────────
function _segHeaders() {
    const token =
        localStorage.getItem('token') ||
        sessionStorage.getItem('token') ||
        window._jwtToken || '';
    return {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    };
}

// ─── Config de estados ────────────────────────────────────────────────────────
const SEG_STATUS = {
    pending:   { label: 'Pendiente', bg: '#fef9c3', color: '#a16207' },
    completed: { label: 'Completado', bg: '#dcfce7', color: '#166534' },
    overdue:   { label: 'Vencido',    bg: '#fee2e2', color: '#991b1b' },
};

// ─── Entrada pública ──────────────────────────────────────────────────────────

/**
 * Llamar desde conv-messages.js al seleccionar conversación.
 */
async function loadSeguimiento(contactId, companyId) {
    if (!contactId || !companyId) return;
    _segContactId = contactId;
    _segCompanyId = companyId;
    _segEditingId = null;

    await Promise.all([
        _segFetchChannels(),
        _segFetchFollowups(),
    ]);
    _segRender();
}

function clearSeguimiento() {
    _segContactId = null;
    _segCompanyId = null;
    _segFollowups = [];
    _segChannels  = [];
    _segEditingId = null;
    const c = document.getElementById('contactSeguimientoContainer');
    if (c) c.innerHTML = '<p class="text-xs text-gray-400 px-1">Selecciona un contacto.</p>';
    _segUpdateCounter(0);
}

// ─── Fetch ────────────────────────────────────────────────────────────────────

async function _segFetchChannels() {
    try {
        const res = await fetch(
            `${API_BASE_URL || ''}/api/followups/channels/${_segCompanyId}`,
            { headers: _segHeaders() }
        );
        const data = await res.json();
        _segChannels = data.success ? data.channels : [];
    } catch (e) {
        console.error('❌ Error cargando canales:', e);
        _segChannels = [];
    }
}

async function _segFetchFollowups() {
    try {
        const res = await fetch(
            `${API_BASE_URL || ''}/api/followups/contact/${_segContactId}?company_id=${_segCompanyId}`,
            { headers: _segHeaders() }
        );
        const data = await res.json();
        _segFollowups = data.success ? data.followups : [];
    } catch (e) {
        console.error('❌ Error cargando seguimientos:', e);
        _segFollowups = [];
    }
}

// ─── Render principal ─────────────────────────────────────────────────────────

function _segRender() {
    const container = document.getElementById('contactSeguimientoContainer');
    if (!container) return;

    _segUpdateCounter(_segFollowups.length);

    const pendingCount  = _segFollowups.filter(f => f.status === 'pending').length;
    const overdueCount  = _segFollowups.filter(f => f.status === 'overdue').length;

    container.innerHTML = `
        ${_segRenderForm()}
        ${_segRenderSummaryBar(pendingCount, overdueCount)}
        ${_segRenderHistory()}
    `;

    _segBindFormEvents();

    // Si está en modo edición, abrir el form automáticamente
    if (_segEditingId) {
        setTimeout(() => {
            const body    = document.getElementById('segFormBody');
            const chevron = document.getElementById('segFormChevron');
            if (body) rpSlide(body, true);
            if (chevron) chevron.style.transform = 'rotate(90deg)';
            setTimeout(() => {
                const dateVal = document.getElementById('segDate')?.value || new Date().toISOString().slice(0,10);
                _segMountCalendar(dateVal);
                _segMountTimePicker();
            }, 60);
        }, 0);
    }
}

// ─── Formulario nuevo / edición ───────────────────────────────────────────────

function _segRenderForm() {
    const isEditing = !!_segEditingId;
    const editing   = isEditing ? _segFollowups.find(f => f._id === _segEditingId) : null;

    const defaultDate = editing
        ? editing.next_contact_date.slice(0, 10)
        : new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const defaultTime = editing
        ? editing.next_contact_date.slice(11, 16)
        : '10:00';
    const defaultNote = editing ? (editing.note || '') : '';
    const defaultChannel = editing ? editing.channel_id : (_segChannels[0]?.channel_id || '');

    const channelButtons = _segChannels.map(ch => `
        <button type="button"
            class="seg-ch-btn ${ch.channel_id === defaultChannel ? 'active' : ''}"
            data-channel-id="${ch.channel_id}"
            onclick="_segSelectChannel(this)">
            <i class="${ch.icon}" style="font-size:11px;"></i> ${ch.name}
        </button>
    `).join('');

    return `
        <div class="seg-form-card">
            <div class="seg-form-title" onclick="_segToggleFormBody()" style="cursor:pointer;">
                <i class="fas fa-${isEditing ? 'edit' : 'plus'}" style="font-size:10px;"></i>
                ${isEditing ? 'Editar seguimiento' : 'Nuevo seguimiento'}
                ${isEditing ? `<button onclick="event.stopPropagation();_segCancelEdit()" class="seg-cancel-edit-btn">Cancelar</button>` : ''}
                <i id="segFormChevron" class="fas fa-chevron-right" style="font-size:9px;color:#9ca3af;margin-left:auto;transition:transform .15s;"></i>
            </div>

            <div id="segFormBody" style="display:none;margin-top:8px;">

            <input type="hidden" id="segChannelId" value="${defaultChannel}">
            <input type="hidden" id="segDate" value="${defaultDate}">
            <input type="hidden" id="segTime" value="${defaultTime}">

            <div style="display:flex;gap:8px;margin-bottom:8px;">

                <div class="seg-dt-wrap" id="segDateWrap">
                    <label class="seg-label">Fecha</label>
                    <div class="seg-dt-input" onclick="_segToggleDtPicker('segCalDrop','segTimeDrop')">
                        <i class="fas fa-calendar-alt"></i>
                        <span id="segDateText">${_segFormatDate(defaultDate)}</span>
                    </div>
                    <div class="seg-dt-dropdown" id="segCalDrop">
                        <div id="segCalendarWrap"></div>
                    </div>
                </div>

                <div class="seg-dt-wrap" id="segTimeWrap">
                    <label class="seg-label">Hora</label>
                    <div class="seg-dt-input" onclick="_segToggleDtPicker('segTimeDrop','segCalDrop')">
                        <i class="fas fa-clock"></i>
                        <span id="segTimeText">${defaultTime}</span>
                    </div>
                    <div class="seg-dt-dropdown" id="segTimeDrop">
                        <div class="seg-time-inner">
                            <div class="seg-time-cols">
                                <div class="seg-time-col-wrap">
                                  <div class="seg-time-col-label">Hora</div>
                                  <div class="seg-time-col" id="segHourCol"></div>
                                </div>
                                <div style="color:#9ca3af;font-size:13px;font-weight:700;padding-top:4px;">:</div>
                                <div class="seg-time-col-wrap">
                                  <div class="seg-time-col-label">Min</div>
                                  <div class="seg-time-col" id="segMinCol"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

            </div>

            <div style="margin-bottom:6px;">
                <label class="seg-label">Canal</label>
                <div style="display:flex;flex-wrap:wrap;gap:4px;">${channelButtons}</div>
            </div>

            <div style="margin-bottom:8px;">
                <label class="seg-label">Nota</label>
                <textarea id="segNote" class="seg-input seg-textarea"
                    placeholder="¿Qué debes hacer o decirle?">${defaultNote}</textarea>
            </div>

            <button onclick="${isEditing ? '_segSubmitEdit()' : '_segSubmitNew()'}" class="seg-save-btn">
                <i class="fas fa-check" style="font-size:10px;"></i>
                ${isEditing ? 'Guardar cambios' : 'Guardar seguimiento'}
            </button>

            </div><!-- /segFormBody -->
        </div>
    `;
}

function _segFormatDate(dateStr) {
    if (!dateStr) return '—';
    const [y, m, d] = dateStr.split('-');
    return `${d}-${m}-${y}`;
}

function _segToggleDtPicker(openId, closeId) {
    const toOpen  = document.getElementById(openId);
    const toClose = document.getElementById(closeId);
    if (toClose) toClose.classList.remove('open');
    if (toOpen)  toOpen.classList.toggle('open');
    if (openId === 'segTimeDrop' && toOpen?.classList.contains('open')) {
        setTimeout(() => {
            document.querySelector('#segHourCol .seg-time-item.active')?.scrollIntoView({ block: 'center' });
            document.querySelector('#segMinCol .seg-time-item.active')?.scrollIntoView({ block: 'center' });
        }, 30);
    }
}


function _segToggleFormBody() {
    const body    = document.getElementById('segFormBody');
    const chevron = document.getElementById('segFormChevron');
    if (!body) return;
    const isOpen = body.style.display !== 'none' && body.style.opacity !== '0';
    rpSlide(body, !isOpen);
    if (chevron) chevron.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(90deg)';
    if (!isOpen) {
        // Al abrir, montar calendario (pequeño delay para que el DOM sea visible)
        setTimeout(() => {
            const dateVal = document.getElementById('segDate')?.value || new Date().toISOString().slice(0,10);
            _segMountCalendar(dateVal);
            _segMountTimePicker();
        }, 50);
    }
}


function _segSelectChannel(btn) {
    document.querySelectorAll('.seg-ch-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('segChannelId').value = btn.dataset.channelId;
}

function _segBindFormEvents() {}

function _segCancelEdit() {
    _segEditingId = null;
    _segRender();
}

// ─── Barra resumen ────────────────────────────────────────────────────────────

function _segRenderSummaryBar(pending, overdue) {
    if (_segFollowups.length === 0) return '';
    const parts = [];
    if (overdue  > 0) parts.push(`<span style="color:#991b1b;font-weight:700;">${overdue} vencido${overdue>1?'s':''}</span>`);
    if (pending  > 0) parts.push(`<span style="color:#a16207;">${pending} pendiente${pending>1?'s':''}</span>`);
    return parts.length
        ? `<div class="seg-summary-bar">${parts.join(' · ')}</div>`
        : '';
}

// ─── Historial ────────────────────────────────────────────────────────────────

function _segRenderHistory() {
    if (_segFollowups.length === 0) return `
        <p class="seg-empty">Sin seguimientos registrados</p>`;

    const label = `<div class="seg-history-label"><i class="fas fa-history" style="font-size:9px;"></i> Historial</div>`;
    const items = `<div class="seg-history-scroll">${_segFollowups.map(f => _segRenderItem(f)).join('')}</div>`;
    return label + items;
}

function _segRenderItem(f) {
    const st     = SEG_STATUS[f.status] || SEG_STATUS.pending;
    const dt     = f.next_contact_date ? new Date(f.next_contact_date) : null;
    const dateStr = dt ? dt.toLocaleDateString('es-CL', { day:'numeric', month:'short' }) + ' · ' +
                         dt.toLocaleTimeString('es-CL', { hour:'2-digit', minute:'2-digit' })
                       : '—';

    const canEdit     = f.status?.trim() !== 'completed';
    const canComplete = f.status?.trim() !== 'completed';

    return `
        <div class="seg-item" id="seg-item-${f._id}">
            <div class="seg-item-header">
                <span class="seg-item-date">${dateStr}</span>
                <span class="seg-status-badge" style="background:${st.bg};color:${st.color};">${st.label}</span>
            </div>
            <div class="seg-item-channel">
                <i class="${f.channel_icon || 'fas fa-comment'}" style="font-size:11px;"></i>
                ${f.channel_name || '—'}
            </div>
            ${f.note ? `<div class="seg-item-note">${_segEscape(f.note)}</div>` : ''}
            <div class="seg-item-footer">
                <span class="seg-item-agent">${_segFormatAgent(f)}</span>
                <div style="display:flex;gap:6px;">
                    ${canComplete ? `
                    <div class="tooltip-wrap" id="tw-complete-${f._id}">
                        <button onclick="_segShowTooltip('complete','${f._id}')" class="seg-action-btn seg-action-complete" title="Marcar completado"><i class="fas fa-check"></i></button>
                        <div class="seg-tooltip" id="tt-complete-${f._id}" style="display:none;">
                            <div class="seg-tooltip-text">¿Marcar como completado?</div>
                            <div class="seg-tooltip-sub">Esta acción no se puede deshacer.</div>
                            <div class="seg-tooltip-btns">
                                <button class="seg-tt-cancel" onclick="_segHideTooltip('complete','${f._id}')">Cancelar</button>
                                <button class="seg-tt-confirm seg-tt-green" onclick="_segComplete('${f._id}')"><i class="fas fa-check" style="font-size:9px;"></i> Sí</button>
                            </div>
                        </div>
                    </div>` : ''}
                    ${canEdit ? `<button onclick="_segStartEdit('${f._id}')" class="seg-action-btn seg-action-edit" title="Editar"><i class="fas fa-pen"></i></button>` : ''}
                    <div class="tooltip-wrap" id="tw-delete-${f._id}">
                        <button onclick="_segShowTooltip('delete','${f._id}')" class="seg-action-btn seg-action-delete" title="Eliminar"><i class="fas fa-trash"></i></button>
                        <div class="seg-tooltip" id="tt-delete-${f._id}" style="display:none;">
                            <div class="seg-tooltip-text">¿Eliminar seguimiento?</div>
                            <div class="seg-tooltip-sub">Se borrará permanentemente.</div>
                            <div class="seg-tooltip-btns">
                                <button class="seg-tt-cancel" onclick="_segHideTooltip('delete','${f._id}')">Cancelar</button>
                                <button class="seg-tt-confirm seg-tt-red" onclick="_segDelete('${f._id}')"><i class="fas fa-trash" style="font-size:9px;"></i> Eliminar</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// ─── Acciones ─────────────────────────────────────────────────────────────────

async function _segSubmitNew() {
    const date      = document.getElementById('segDate')?.value;
    const time      = document.getElementById('segTime')?.value || '10:00';
    const channelId = document.getElementById('segChannelId')?.value;
    const note      = document.getElementById('segNote')?.value?.trim() || '';

    if (!date || !channelId) {
        _segToast('Fecha y canal son requeridos', 'error');
        return;
    }

    const payload = {
        contact_id:        _segContactId,
        company_id:        _segCompanyId,
        channel_id:        channelId,
        next_contact_date: `${date}T${time}:00`,
        note,
    };

    try {
        const res  = await fetch(`${API_BASE_URL || ''}/api/followups`, {
            method:  'POST',
            headers: _segHeaders(),
            body:    JSON.stringify(payload),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error);
        await _segFetchFollowups();
        _segRender();
    } catch (e) {
        console.error('❌ Error creando seguimiento:', e);
        _segToast('No se pudo guardar el seguimiento', 'error');
    }
}

function _segStartEdit(id) {
    const f = _segFollowups.find(f => f._id === id);
    if (f?.status?.trim() === 'completed') {
        _segToast('No se puede editar un seguimiento completado', 'error');
        return;
    }
    _segEditingId = id;
    _segRender();
    document.getElementById('contactSeguimientoContainer')?.scrollIntoView({ behavior: 'smooth' });
}

async function _segSubmitEdit() {
    const date      = document.getElementById('segDate')?.value;
    const time      = document.getElementById('segTime')?.value || '10:00';
    const channelId = document.getElementById('segChannelId')?.value;
    const note      = document.getElementById('segNote')?.value?.trim() || '';

    if (!date || !channelId) {
        _segToast('Fecha y canal son requeridos', 'error');
        return;
    }

    const payload = {
        channel_id:        channelId,
        next_contact_date: `${date}T${time}:00`,
        note,
    };

    try {
        const res  = await fetch(`${API_BASE_URL || ''}/api/followups/${_segEditingId}`, {
            method:  'PATCH',
            headers: _segHeaders(),
            body:    JSON.stringify(payload),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error);
        _segEditingId = null;
        await _segFetchFollowups();
        _segRender();
    } catch (e) {
        console.error('❌ Error editando seguimiento:', e);
        _segToast('No se pudo editar el seguimiento', 'error');
    }
}

async function _segComplete(id) {
    _segHideTooltip('complete', id);
    try {
        const res  = await fetch(`${API_BASE_URL || ''}/api/followups/${id}/complete`, {
            method:  'PATCH',
            headers: _segHeaders(),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error);
        await _segFetchFollowups();
        _segRender();
    } catch (e) {
        console.error('❌ Error completando seguimiento:', e);
        _segToast('No se pudo completar el seguimiento', 'error');
    }
}

async function _segDelete(id) {
    _segHideTooltip('delete', id);
    try {
        const res  = await fetch(`${API_BASE_URL || ''}/api/followups/${id}`, {
            method:  'DELETE',
            headers: _segHeaders(),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error);
        await _segFetchFollowups();
        _segRender();
    } catch (e) {
        console.error('❌ Error eliminando seguimiento:', e);
        _segToast('No se pudo eliminar el seguimiento', 'error');
    }
}

// ─── Contador ─────────────────────────────────────────────────────────────────

function _segUpdateCounter(count) {
    const el = document.getElementById('seguimientoCounter');
    if (!el) return;
    el.textContent      = count;
    el.style.display    = count ? 'inline-block' : 'none';
}

function _segToast(msg, type = 'error') {
    const existing = document.getElementById('segToast');
    if (existing) existing.remove();

    const colors = {
        error:   { bg: '#fef2f2', border: '#fecaca', color: '#991b1b', icon: 'fa-circle-exclamation' },
        success: { bg: '#f0fdf4', border: '#bbf7d0', color: '#166534', icon: 'fa-circle-check'       },
    };
    const c = colors[type] || colors.error;

    const toast = document.createElement('div');
    toast.id = 'segToast';
    toast.style.cssText = `
        position: fixed; bottom: 24px; right: 24px; z-index: 9999;
        background: ${c.bg}; border: 1px solid ${c.border}; color: ${c.color};
        border-radius: 8px; padding: 10px 14px;
        display: flex; align-items: center; gap: 8px;
        font-size: 12px; font-weight: 600;
        box-shadow: 0 4px 12px rgba(0,0,0,.1);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        animation: segToastIn .2s ease;
    `;
    toast.innerHTML = `<i class="fas ${c.icon}" style="font-size:13px;"></i> ${msg}`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
}

function _segShowTooltip(type, id) {
    // Cierra cualquier otro tooltip abierto
    document.querySelectorAll('.seg-tooltip').forEach(t => t.style.display = 'none');
    const tt = document.getElementById(`tt-${type}-${id}`);
    if (tt) tt.style.display = 'block';
}

function _segHideTooltip(type, id) {
    const tt = document.getElementById(`tt-${type}-${id}`);
    if (tt) tt.style.display = 'none';
}

// Cerrar dropdowns y tooltips al hacer click fuera
document.addEventListener('click', (e) => {
    if (!e.target.closest('.seg-dt-wrap')) {
        document.querySelectorAll('.seg-dt-dropdown').forEach(d => d.classList.remove('open'));
    }
    if (!e.target.closest('.tooltip-wrap')) {
        document.querySelectorAll('.seg-tooltip').forEach(t => t.style.display = 'none');
    }
});



function _segFormatAgent(f) {
    if (f.assigned_name) return f.assigned_name;
    if (f.created_name)  return f.created_name;
    return '';
}

function _segEscape(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ─── Mini calendario (mismo estilo que Agenda) ────────────────────────────────

const _SEG_MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                    'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const _SEG_DIAS  = ['Lu','Ma','Mi','Ju','Vi','Sá','Do'];

let _segCalMonth = null;

function _segInitCalMonth() {
    const today = new Date();
    _segCalMonth = new Date(today.getFullYear(), today.getMonth(), 1);
}

function _segBuildCalendar(selectedDate) {
    if (!_segCalMonth) _segInitCalMonth();
    const year  = _segCalMonth.getFullYear();
    const month = _segCalMonth.getMonth();
    const today = new Date(); today.setHours(0,0,0,0);

    const wrapper = document.createElement('div');
    wrapper.className = 'seg-cal';

    const header = document.createElement('div');
    header.className = 'seg-cal-header';
    header.innerHTML = `
        <button class="seg-cal-nav" id="segCalPrev"><i class="fas fa-chevron-left"></i></button>
        <span class="seg-cal-title">${_SEG_MESES[month]} ${year}</span>
        <button class="seg-cal-nav" id="segCalNext"><i class="fas fa-chevron-right"></i></button>
    `;
    wrapper.appendChild(header);

    const daysRow = document.createElement('div');
    daysRow.className = 'seg-cal-days-row';
    _SEG_DIAS.forEach(d => {
        const cell = document.createElement('span');
        cell.className = 'seg-cal-dayname';
        cell.textContent = d;
        daysRow.appendChild(cell);
    });
    wrapper.appendChild(daysRow);

    const grid = document.createElement('div');
    grid.className = 'seg-cal-grid';

    const firstDay = new Date(year, month, 1);
    let startDow = firstDay.getDay();
    startDow = startDow === 0 ? 6 : startDow - 1;
    for (let i = 0; i < startDow; i++) {
        const empty = document.createElement('div');
        empty.className = 'seg-cal-cell seg-cal-cell--empty';
        grid.appendChild(empty);
    }

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    for (let day = 1; day <= daysInMonth; day++) {
        const cellDate = new Date(year, month, day); cellDate.setHours(0,0,0,0);
        const dateStr  = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
        const isToday  = cellDate.getTime() === today.getTime();
        const isPast   = cellDate < today;
        const isSel    = selectedDate === dateStr;

        const cell = document.createElement('div');
        cell.className = 'seg-cal-cell' +
            (isToday ? ' seg-cal-cell--today'    : '') +
            (isPast  ? ' seg-cal-cell--past'     : '') +
            (isSel   ? ' seg-cal-cell--selected' : '');
        cell.textContent = day;

        if (!isPast) {
            cell.addEventListener('click', () => {
                const hidden = document.getElementById('segDate');
                if (hidden) hidden.value = dateStr;
                // Actualizar display
                const display = document.getElementById('segDateText');
                if (display) display.textContent = _segFormatDate(dateStr);
                // Cerrar dropdown
                const drop = document.getElementById('segCalDrop');
                if (drop) drop.classList.remove('open');
                // Rebuild calendar con nueva selección
                const wrap = document.getElementById('segCalendarWrap');
                if (wrap) { wrap.innerHTML = ''; wrap.appendChild(_segBuildCalendar(dateStr)); }
            });
        }
        grid.appendChild(cell);
    }
    wrapper.appendChild(grid);

    header.querySelector('#segCalPrev').addEventListener('click', () => {
        const prev = new Date(_segCalMonth);
        prev.setMonth(prev.getMonth() - 1);
        const todayFirst = new Date(today.getFullYear(), today.getMonth(), 1);
        if (prev >= todayFirst) {
            _segCalMonth = prev;
            const wrap = document.getElementById('segCalendarWrap');
            const cur  = document.getElementById('segDate')?.value || '';
            if (wrap) { wrap.innerHTML = ''; wrap.appendChild(_segBuildCalendar(cur)); }
        }
    });

    header.querySelector('#segCalNext').addEventListener('click', () => {
        _segCalMonth = new Date(_segCalMonth);
        _segCalMonth.setMonth(_segCalMonth.getMonth() + 1);
        const wrap = document.getElementById('segCalendarWrap');
        const cur  = document.getElementById('segDate')?.value || '';
        if (wrap) { wrap.innerHTML = ''; wrap.appendChild(_segBuildCalendar(cur)); }
    });

    return wrapper;
}

function _segMountCalendar(selectedDate) {
    if (selectedDate) {
        const d = new Date(selectedDate);
        _segCalMonth = new Date(d.getFullYear(), d.getMonth(), 1);
    } else {
        _segInitCalMonth();
    }
    setTimeout(() => {
        const wrap = document.getElementById('segCalendarWrap');
        if (wrap) { wrap.innerHTML = ''; wrap.appendChild(_segBuildCalendar(selectedDate || '')); }
    }, 0);
}

// ─── Time picker personalizado ────────────────────────────────────────────────

function _segMountTimePicker() {
    setTimeout(() => {
        const hourCol = document.getElementById('segHourCol');
        const minCol  = document.getElementById('segMinCol');
        if (!hourCol || !minCol) return;

        const current = document.getElementById('segTime')?.value || '10:00';
        const [curH, curM] = current.split(':').map(Number);

        // Horas 0-23
        for (let h = 0; h <= 23; h++) {
            const item = document.createElement('div');
            item.className = 'seg-time-item' + (h === curH ? ' active' : '');
            item.textContent = String(h).padStart(2,'0');
            item.addEventListener('click', () => {
                document.querySelectorAll('#segHourCol .seg-time-item').forEach(i => i.classList.remove('active'));
                item.classList.add('active');
                _segUpdateTime();
            });
            hourCol.appendChild(item);
        }

        // Minutos 00, 05, 10... 55
        for (let m = 0; m <= 55; m += 5) {
            const item = document.createElement('div');
            const nearest = Math.round(curM / 5) * 5;
            item.className = 'seg-time-item' + (m === nearest ? ' active' : '');
            item.textContent = String(m).padStart(2,'0');
            item.addEventListener('click', () => {
                document.querySelectorAll('#segMinCol .seg-time-item').forEach(i => i.classList.remove('active'));
                item.classList.add('active');
                _segUpdateTime();
            });
            minCol.appendChild(item);
        }

        // Scroll al item activo
        setTimeout(() => {
            hourCol.querySelector('.active')?.scrollIntoView({ block: 'center' });
            minCol.querySelector('.active')?.scrollIntoView({ block: 'center' });
        }, 50);
    }, 0);
}

function _segUpdateTime() {
    const h = document.querySelector('#segHourCol .seg-time-item.active')?.textContent || '10';
    const m = document.querySelector('#segMinCol .seg-time-item.active')?.textContent  || '00';
    const val = `${h}:${m}`;
    const hidden  = document.getElementById('segTime');
    const display = document.getElementById('segTimeText');
    if (hidden)  hidden.value       = val;
    if (display) display.textContent = val;
}



// ─── CSS ──────────────────────────────────────────────────────────────────────

(function _segInjectStyles() {
    if (document.getElementById('segStyles')) return;
    const style = document.createElement('style');
    style.id    = 'segStyles';
    style.textContent = `
        .seg-form-card {
            background: #fff;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 10px 12px;
            margin-bottom: 8px;
        }
        .seg-form-title {
            font-size: 10px;
            font-weight: 700;
            color: #6b7280;
            text-transform: uppercase;
            letter-spacing: .05em;
            margin-bottom: 8px;
            display: flex;
            align-items: center;
            gap: 5px;
        }
        .seg-cancel-edit-btn {
            margin-left: auto;
            font-size: 10px;
            color: #9961FF;
            background: none;
            border: none;
            cursor: pointer;
            font-weight: 600;
        }
        .seg-label {
            font-size: 10px;
            color: #6b7280;
            display: block;
            margin-bottom: 2px;
        }
        .seg-input {
            width: 100%;
            font-size: 11px;
            border: 0.5px solid #e5e7eb;
            border-radius: 6px;
            padding: 5px 8px;
            color: #374151;
            background: #fff;
            outline: none;
            box-sizing: border-box;
        }
        .seg-input:focus { border-color: #a78bfa; }
        .seg-textarea { resize: none; height: 50px; }
        .seg-ch-btn {
            font-size: 10px;
            padding: 3px 8px;
            border-radius: 20px;
            border: 0.5px solid #e5e7eb;
            background: #fff;
            color: #6b7280;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 3px;
            transition: all .12s;
        }
        .seg-ch-btn.active {
            background: #E1DEFF;
            color: #9961FF;
            border-color: #9961FF;
            font-weight: 700;
        }
        .seg-save-btn {
            width: 100%;
            padding: 6px;
            background: #9961FF;
            color: #fff;
            border: none;
            border-radius: 6px;
            font-size: 11px;
            font-weight: 700;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 5px;
            transition: background .12s;
        }
        .seg-save-btn:hover { background: #7D84C1; }
        .seg-summary-bar {
            font-size: 10px;
            margin-bottom: 6px;
            padding: 4px 8px;
            background: #fafafa;
            border-radius: 6px;
            border: 0.5px solid #e5e7eb;
        }
        .seg-history-label {
            font-size: 10px;
            font-weight: 600;
            color: #9ca3af;
            text-transform: uppercase;
            letter-spacing: .05em;
            margin: 4px 0;
        }
        .seg-history-scroll {
            max-height: 280px;
            overflow-y: auto;
            scrollbar-width: thin;
            scrollbar-color: #e5e7eb transparent;
            padding-right: 2px;
        }
        .seg-history-scroll::-webkit-scrollbar { width: 4px; }
        .seg-history-scroll::-webkit-scrollbar-track { background: transparent; }
        .seg-history-scroll::-webkit-scrollbar-thumb { background: #e5e7eb; border-radius: 4px; }
        .seg-empty {
            font-size: 11px;
            color: #9ca3af;
            text-align: center;
            padding: 8px 0;
        }
        .seg-item {
            background: #fff;
            border: 0.5px solid #e5e7eb;
            border-radius: 8px;
            padding: 8px 10px;
            margin-bottom: 5px;
        }
        .seg-item-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 3px;
        }
        .seg-item-date {
            font-size: 10px;
            font-weight: 700;
            color: #374151;
        }
        .seg-status-badge {
            font-size: 9px;
            font-weight: 700;
            padding: 2px 6px;
            border-radius: 20px;
        }
        .seg-item-channel {
            font-size: 10px;
            color: #9961FF;
            margin-bottom: 2px;
            display: flex;
            align-items: center;
            gap: 4px;
        }
        .seg-item-note {
            font-size: 10px;
            color: #6b7280;
            line-height: 1.4;
            margin-bottom: 4px;
        }
        .seg-item-footer {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-top: 4px;
        }
        .seg-item-agent { font-size: 9px; color: #9ca3af; }
        .seg-action-btn {
            font-size: 10px;
            padding: 3px 6px;
            border-radius: 5px;
            border: 0.5px solid #e5e7eb;
            background: #fff;
            cursor: pointer;
            transition: all .12s;
        }
        .seg-action-complete:hover { background: #dcfce7; color: #166534; border-color: #86efac; }
        .seg-action-edit:hover     { background: #ede9fe; color: #9961FF; border-color: #c4b5fd; }
        .seg-action-delete:hover   { background: #fee2e2; color: #991b1b; border-color: #fca5a5; }

        .tooltip-wrap { position: relative; display: inline-block; }
        .seg-tooltip {
            position: absolute;
            bottom: calc(100% + 6px);
            right: 0;
            background: #fff;
            border: 0.5px solid #e5e7eb;
            border-radius: 8px;
            padding: 8px 10px;
            box-shadow: 0 4px 12px rgba(0,0,0,.1);
            width: 172px;
            z-index: 100;
        }
        .seg-tooltip::after {
            content: '';
            position: absolute;
            top: 100%;
            right: 10px;
            border: 5px solid transparent;
            border-top-color: #e5e7eb;
        }
        .seg-tooltip::before {
            content: '';
            position: absolute;
            top: calc(100% - 1px);
            right: 10px;
            border: 5px solid transparent;
            border-top-color: #fff;
            z-index: 1;
        }
        .seg-tooltip-text { font-size: 11px; font-weight: 600; color: #374151; margin-bottom: 2px; }
        .seg-tooltip-sub  { font-size: 10px; color: #6b7280; margin-bottom: 8px; }
        .seg-tooltip-btns { display: flex; gap: 5px; justify-content: flex-end; }
        .seg-tt-cancel {
            font-size: 10px; padding: 4px 10px; border-radius: 6px;
            border: 0.5px solid #e5e7eb; background: #fff;
            color: #6b7280; cursor: pointer; font-weight: 600;
        }
        .seg-tt-confirm {
            font-size: 10px; padding: 4px 10px; border-radius: 6px;
            border: none; color: #fff; cursor: pointer; font-weight: 700;
            display: flex; align-items: center; gap: 4px;
        }
        .seg-tt-green { background: #16a34a; }
        .seg-tt-red   { background: #dc2626; }
        @keyframes segToastIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }

        /* ── Mini calendario ── */
        .seg-cal { background:#fff; border:1px solid #e5e7eb; border-radius:8px; overflow:hidden; }
        .seg-cal-header { display:flex; align-items:center; gap:2px; padding:4px 6px; background:#EFF6FF; border-bottom:1px solid #C9D9FF; }
        .seg-cal-title { font-size:11px; font-weight:700; color:#7D84C1; flex:1; text-align:center; }
        .seg-cal-nav { background:none; border:none; cursor:pointer; color:#9961FF; padding:1px 3px; border-radius:4px; font-size:10px; transition:background .15s; }
        .seg-cal-nav:hover { background:#E1DEFF; }
        .seg-cal-days-row { display:grid; grid-template-columns:repeat(7,1fr); padding:3px 3px 1px; }
        .seg-cal-dayname { text-align:center; font-size:9px; font-weight:600; color:#9ca3af; padding:1px 0; }
        .seg-cal-grid { display:grid; grid-template-columns:repeat(7,1fr); gap:1px; padding:0 3px 3px; }
        .seg-cal-cell { aspect-ratio:1; display:flex; align-items:center; justify-content:center; font-size:10px; border-radius:4px; cursor:pointer; color:#374151; border:1.5px solid transparent; transition:background .12s,color .12s; user-select:none; }
        .seg-cal-cell:not(.seg-cal-cell--past):not(.seg-cal-cell--empty):hover { background:#E1DEFF; color:#9961FF; }
        .seg-cal-cell--today { font-weight:700; color:#9961FF; border-color:#9961FF; }
        .seg-cal-cell--past { color:#d1d5db; cursor:default; }
        .seg-cal-cell--selected { background:#9961FF !important; color:#fff !important; font-weight:600; }
        .seg-cal-cell--empty { cursor:default; }

        /* ── Date/Time inputs ── */
        .seg-dt-wrap { position:relative; flex:1; }
        .seg-dt-input {
            display:flex; align-items:center; gap:6px;
            border:0.5px solid #e5e7eb; border-radius:6px;
            padding:6px 8px; cursor:pointer; background:#fff;
            font-size:11px; font-weight:600; color:#374151;
            transition:border-color .12s; user-select:none;
        }
        .seg-dt-input:hover { border-color:#9961FF; }
        .seg-dt-input i { color:#9961FF; font-size:11px; flex-shrink:0; }
        .seg-dt-dropdown {
            position:absolute; top:calc(100% + 4px); left:0;
            background:#fff; border:0.5px solid #C9D9FF;
            border-radius:8px; box-shadow:0 4px 16px rgba(0,0,0,.12);
            z-index:9999; display:none;
        }
        .seg-dt-dropdown.open { display:block; }
        .seg-time-inner { padding:4px; width:88px; }
        .seg-time-col-wrap { flex:1; display:flex; flex-direction:column; align-items:center; }
        .seg-time-col-label { font-size:9px; font-weight:700; color:#9ca3af; text-transform:uppercase; margin-bottom:3px; }
        .seg-time-cols { display:flex; align-items:flex-start; gap:4px; }
        .seg-time-col { flex:1; max-height:130px; overflow-y:auto; scrollbar-width:none; -ms-overflow-style:none; }
        .seg-time-col::-webkit-scrollbar { display:none; }
        .seg-time-item { text-align:center; padding:4px 2px; font-size:11px; color:#6b7280; border-radius:4px; cursor:pointer; transition:background .1s; }
        .seg-time-item:hover { background:#EFF6FF; color:#9961FF; }
        .seg-time-item.active { background:#9961FF; color:#fff; font-weight:700; }
    `;
    document.head.appendChild(style);
})();

// ─── Exports ──────────────────────────────────────────────────────────────────
window.loadSeguimiento    = loadSeguimiento;
window.clearSeguimiento   = clearSeguimiento;