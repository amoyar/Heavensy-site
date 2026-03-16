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
    const defaultChannel = editing ? editing.channel_id : (_segChannels[0]?._id || '');

    const channelButtons = _segChannels.map(ch => `
        <button type="button"
            class="seg-ch-btn ${ch._id === defaultChannel ? 'active' : ''}"
            data-channel-id="${ch._id}"
            onclick="_segSelectChannel(this)">
            <i class="${ch.icon}" style="font-size:11px;"></i> ${ch.name}
        </button>
    `).join('');

    return `
        <div class="seg-form-card">
            <div class="seg-form-title">
                <i class="fas fa-${isEditing ? 'edit' : 'plus'}" style="font-size:10px;"></i>
                ${isEditing ? 'Editar seguimiento' : 'Nuevo seguimiento'}
                ${isEditing ? `<button onclick="_segCancelEdit()" class="seg-cancel-edit-btn">Cancelar</button>` : ''}
            </div>

            <input type="hidden" id="segChannelId" value="${defaultChannel}">

            <div style="display:flex;gap:6px;margin-bottom:6px;">
                <div style="flex:1;">
                    <label class="seg-label">Fecha</label>
                    <input type="date" id="segDate" value="${defaultDate}"
                        class="seg-input" min="${new Date().toISOString().slice(0,10)}">
                </div>
                <div style="flex:1;">
                    <label class="seg-label">Hora</label>
                    <input type="time" id="segTime" value="${defaultTime}" class="seg-input">
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
        </div>
    `;
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

    const canEdit     = f.status !== 'completed';
    const canComplete = f.status !== 'completed';

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
                <span class="seg-item-agent">${f.assigned_to || '—'}</span>
                <div style="display:flex;gap:6px;">
                    ${canComplete ? `<button onclick="_segComplete('${f._id}')" class="seg-action-btn seg-action-complete" title="Marcar completado"><i class="fas fa-check"></i></button>` : ''}
                    ${canEdit     ? `<button onclick="_segStartEdit('${f._id}')" class="seg-action-btn seg-action-edit" title="Editar"><i class="fas fa-pen"></i></button>` : ''}
                    <button onclick="_segDelete('${f._id}')" class="seg-action-btn seg-action-delete" title="Eliminar"><i class="fas fa-trash"></i></button>
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
        alert('Fecha y canal son requeridos');
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
        alert('No se pudo guardar el seguimiento');
    }
}

function _segStartEdit(id) {
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
        alert('Fecha y canal son requeridos');
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
        alert('No se pudo editar el seguimiento');
    }
}

async function _segComplete(id) {
    if (!confirm('¿Marcar este seguimiento como completado?')) return;
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
        alert('No se pudo completar el seguimiento');
    }
}

async function _segDelete(id) {
    if (!confirm('¿Eliminar este seguimiento?')) return;
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
        alert('No se pudo eliminar el seguimiento');
    }
}

// ─── Contador ─────────────────────────────────────────────────────────────────

function _segUpdateCounter(count) {
    const el = document.getElementById('seguimientoCounter');
    if (!el) return;
    el.textContent      = count;
    el.style.display    = count ? 'inline-block' : 'none';
}

// ─── Escape HTML ──────────────────────────────────────────────────────────────

function _segEscape(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
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
            color: #7c3aed;
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
            background: #ede9fe;
            color: #7c3aed;
            border-color: #c4b5fd;
            font-weight: 700;
        }
        .seg-save-btn {
            width: 100%;
            padding: 6px;
            background: #7c3aed;
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
        .seg-save-btn:hover { background: #6d28d9; }
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
            color: #7c3aed;
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
        .seg-action-edit:hover     { background: #ede9fe; color: #7c3aed; border-color: #c4b5fd; }
        .seg-action-delete:hover   { background: #fee2e2; color: #991b1b; border-color: #fca5a5; }
    `;
    document.head.appendChild(style);
})();

// ─── Exports ──────────────────────────────────────────────────────────────────
window.loadSeguimiento    = loadSeguimiento;
window.clearSeguimiento   = clearSeguimiento;