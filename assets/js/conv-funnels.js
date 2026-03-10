// ============================================
// CONV-FUNNELS.JS — Panel de Embudos
// Módulo del panel de conversaciones
//
// Responsabilidades:
//   - Cargar embudos activos + estado del contacto
//   - Renderizar botones de etapas en el panel derecho
//   - Manejar click → cambio de etapa → auto-save
//   - Limpiar panel al cambiar de conversación
// ============================================

console.log('✅ conv-funnels.js cargado');

// ─── Estado del módulo ────────────────────────────────────────────────────────
let _funnelCurrentUserId    = null;
let _funnelCurrentCompanyId = null;
let _funnelData             = [];   // último resultado de la API


// ─── Auth ─────────────────────────────────────────────────────────────────────
function _funnelAuthHeaders() {
    // Usa el mismo key que app.js
    const token =
        localStorage.getItem('token') ||
        sessionStorage.getItem('token') ||
        window._jwtToken || '';
    return {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };
}


// ============================================
// CARGA DE DATOS
// ============================================

/**
 * Carga y renderiza los embudos del contacto.
 * Se llama desde conv-messages.js al seleccionar una conversación.
 *
 * @param {string} companyId
 * @param {string} userId - wa_id / teléfono del contacto
 */
async function loadFunnels(companyId, userId) {
    if (!companyId || !userId) {
        renderFunnelEmpty('Sin empresa o contacto seleccionado');
        return;
    }

    _funnelCurrentUserId    = userId;
    _funnelCurrentCompanyId = companyId;

    renderFunnelLoading();

    try {
        const res = await fetch(
            `${API_BASE_URL || ''}/api/funnels/${companyId}/contact/${userId}`,
            { headers: _funnelAuthHeaders() }
        );

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();

        if (!data.success) throw new Error(data.error || 'Error desconocido');

        _funnelData = data.funnels || [];

        // Actualizar contador en el header
        const funnelsCounter = document.getElementById('funnelsCounter');
        if (funnelsCounter) {
            const count = (_funnelData || []).length;
            funnelsCounter.textContent = count;
            funnelsCounter.style.display = count > 0 ? 'inline-block' : 'none';
        }

        if (_funnelData.length === 0) {
            renderFunnelEmpty('Sin embudos asignados');
        } else {
            renderFunnels(_funnelData);
        }

    } catch (err) {
        console.error('❌ Error cargando funnels:', err);
        renderFunnelError();
    }
}


// ============================================
// CAMBIO DE ETAPA
// ============================================

/**
 * Cambia la etapa del contacto actual en un embudo.
 * Se llama al hacer click en un botón de etapa.
 *
 * @param {string} funnelId
 * @param {string} stageId
 * @param {HTMLElement} clickedBtn - botón presionado
 * @param {HTMLElement} container  - contenedor de botones del embudo
 * @param {string} color           - color de la etapa
 */
async function onStageClick(funnelId, stageId, clickedBtn, container, color) {
    if (!_funnelCurrentUserId || !_funnelCurrentCompanyId) return;

    // Feedback visual inmediato (optimistic update)
    _setActiveStageUI(container, clickedBtn, color);

    try {
        const res = await fetch(
            `${API_BASE_URL || ''}/api/funnels/${_funnelCurrentCompanyId}/contact/${_funnelCurrentUserId}/stage`,
            {
                method:  'PUT',
                headers: _funnelAuthHeaders(),
                body:    JSON.stringify({ funnel_id: funnelId, stage_id: stageId })
            }
        );

        const data = await res.json();

        if (!data.success) {
            console.error('❌ Error guardando etapa:', data.error);
            // Revertir UI si falla
            await loadFunnels(_funnelCurrentCompanyId, _funnelCurrentUserId);
            return;
        }

        // Actualizar estado local
        const funnel = _funnelData.find(f => f.funnel_id === funnelId);
        if (funnel) {
            funnel.current_stage_id = stageId;
            // Actualizar el punto de color del título
            const dot = container.closest('.funnel-block')?.querySelector('.funnel-dot');
            if (dot) dot.style.background = color;
        }

        console.log(`✅ Etapa actualizada: ${funnelId} → ${stageId}`);

    } catch (err) {
        console.error('❌ Error en onStageClick:', err);
        await loadFunnels(_funnelCurrentCompanyId, _funnelCurrentUserId);
    }
}


// ============================================
// RENDER
// ============================================

/**
 * Renderiza todos los embudos con sus etapas en el panel.
 * @param {Array} funnels
 */
function renderFunnels(funnels) {
    const panel = document.getElementById('contactFunnelsContainer');
    if (!panel) return;

    panel.innerHTML = '';

    funnels.forEach((funnel, index) => {
        const block = document.createElement('div');
        block.className = 'funnel-block';

        // Nombre del embudo con punto de color + chevron colapsable
        const activeStage = funnel.stages?.find(s => s.id === funnel.current_stage_id);
        const funnelColor = activeStage?.color || '#7c3aed';

        const title = document.createElement('div');
        title.className = 'funnel-block-title funnel-block-title--toggle';
        const funnelId = funnel.funnel_id;
        const funnelName = funnel.funnel_name;
        title.innerHTML = `
            <div class="funnel-title-left">
                <span class="funnel-dot" style="background:${funnelColor}"></span>
                <span>${funnelName}</span>
            </div>
            <div class="funnel-title-actions">
                <button class="funnel-btn-delete" title="Eliminar embudo">
                    <i class="fas fa-trash"></i>
                </button>
                <i class="fas fa-chevron-down funnel-chevron"></i>
            </div>
        `;
        // Listener del basurero
        title.querySelector('.funnel-btn-delete').addEventListener('click', (e) => {
            e.stopPropagation();
            _showDeleteFunnelModal(funnelId, funnelName, e.currentTarget);
        });
        block.appendChild(title);

        // Contenedor de etapas
        const stagesContainer = document.createElement('div');
        stagesContainer.className = 'funnel-stages';
        stagesContainer.dataset.funnelId = funnel.funnel_id;

        // Botones de etapas ordenados
        const sortedStages = [...funnel.stages].sort((a, b) => a.order - b.order);

        sortedStages.forEach(stage => {
            const btn = document.createElement('button');
            btn.className    = 'funnel-stage-btn';
            btn.textContent  = stage.label;
            btn.dataset.stageId  = stage.id;
            btn.dataset.funnelId = funnel.funnel_id;
            btn.dataset.color    = stage.color || '#94a3b8';
            btn.title            = stage.label;

            const isActive = stage.id === funnel.current_stage_id;
            _applyStageStyle(btn, isActive, stage.color);

            btn.addEventListener('click', () => {
                onStageClick(
                    funnel.funnel_id,
                    stage.id,
                    btn,
                    stagesContainer,
                    stage.color
                );
            });

            stagesContainer.appendChild(btn);
        });

        // Caja blanca que envuelve botones + timestamp
        const stagesBox = document.createElement('div');
        stagesBox.className = 'funnel-stages-box';
        stagesBox.appendChild(stagesContainer);

        // Timestamp última actualización
        if (funnel.updated_at) {
            const ts = document.createElement('div');
            ts.className   = 'funnel-updated-at';
            ts.textContent = `Actualizado: ${_formatRelativeTime(funnel.updated_at)}`;
            stagesBox.appendChild(ts);
        }

        // Arranca colapsado
        stagesBox.style.display = 'none';
        block.appendChild(stagesBox);

        // Toggle colapsar/expandir al hacer click en el título
        title.addEventListener('click', (e) => {
            if (e.target.closest('.funnel-btn-delete')) return;
            const isOpen = stagesBox.style.display !== 'none';
            stagesBox.style.display = isOpen ? 'none' : 'block';
            const chevron = title.querySelector('.funnel-chevron');
            if (chevron) {
                chevron.classList.toggle('fa-chevron-up', !isOpen);
                chevron.classList.toggle('fa-chevron-down', isOpen);
            }
        });

        // Separador entre embudos (no en el último)
        if (index < funnels.length - 1) {
            const sep = document.createElement('div');
            sep.className = 'funnel-separator';
            block.appendChild(sep);
        }

        panel.appendChild(block);
    });

    // ── Botón agregar embudo ──
    _renderAddFunnelButton(panel);
}


function renderFunnelLoading() {
    const panel = document.getElementById('contactFunnelsContainer');
    if (!panel) return;
    panel.innerHTML = `<div class="funnel-state-msg">Cargando...</div>`;
}


function renderFunnelEmpty(msg = 'Sin embudos asignados') {
    const panel = document.getElementById('contactFunnelsContainer');
    if (!panel) return;
    panel.innerHTML = `<div class="funnel-state-msg">${msg}</div>`;
}


function renderFunnelError() {
    const panel = document.getElementById('contactFunnelsContainer');
    if (!panel) return;
    panel.innerHTML = `
        <div class="funnel-state-msg funnel-state-error">
            Error al cargar embudos
            <button class="funnel-retry-btn" onclick="loadFunnels('${_funnelCurrentCompanyId}', '${_funnelCurrentUserId}')">
                Reintentar
            </button>
        </div>`;
}


/**
 * Limpia el panel. Llamar al deseleccionar conversación.
 */
function resetFunnelPanel() {
    _funnelCurrentUserId    = null;
    _funnelCurrentCompanyId = null;
    _funnelData             = [];
    const funnelsCounter = document.getElementById('funnelsCounter');
    if (funnelsCounter) { funnelsCounter.textContent = '0'; funnelsCounter.style.display = 'none'; }
    renderFunnelEmpty('Sin embudos asignados');
}


// ============================================
// HELPERS DE UI
// ============================================

/**
 * Aplica estilos activo/inactivo a un botón de etapa.
 */
function _applyStageStyle(btn, isActive, color) {
    if (isActive) {
        btn.style.backgroundColor = color || '#7c3aed';
        btn.style.color           = '#ffffff';
        btn.style.borderColor     = color || '#7c3aed';
        btn.style.fontWeight      = '600';
        btn.classList.add('active');
    } else {
        btn.style.backgroundColor = '#ffffff';
        btn.style.color           = '#9ca3af';
        btn.style.borderColor     = '#e5e7eb';
        btn.style.fontWeight      = '400';
        btn.classList.remove('active');
    }
}


/**
 * Actualiza visualmente los botones del contenedor:
 * activa el clickedBtn y apaga todos los demás.
 */
function _setActiveStageUI(container, clickedBtn, color) {
    container.querySelectorAll('.funnel-stage-btn').forEach(btn => {
        const isClicked = btn === clickedBtn;
        _applyStageStyle(btn, isClicked, isClicked ? color : btn.dataset.color);
    });
}


/**
 * Formatea un timestamp a tiempo relativo en español.
 */
function _formatRelativeTime(isoString) {
    try {
        const diff  = Date.now() - new Date(isoString).getTime();
        const mins  = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days  = Math.floor(diff / 86400000);

        if (mins  < 1)  return 'hace un momento';
        if (mins  < 60) return `hace ${mins} min`;
        if (hours < 24) return `hace ${hours}h`;
        if (days  < 7)  return `hace ${days} día${days > 1 ? 's' : ''}`;
        return new Date(isoString).toLocaleDateString('es-CL');
    } catch {
        return '';
    }
}


// ============================================
// ESTILOS (inyectados en <head>)
// ============================================

function injectFunnelStyles() {
    if (document.getElementById('_funnelStyles')) return;

    const s = document.createElement('style');
    s.id = '_funnelStyles';
    s.textContent = `
        /* ── Bloque por embudo ── */
        .funnel-block {
            padding: 6px 2px 6px;
            border-bottom: 1px solid #f3f4f6;
        }

        .funnel-block:last-child {
            border-bottom: none;
        }

        .funnel-block-title {
            font-size: 11.5px;
            font-weight: 600;
            color: #374151;
            margin-bottom: 3px;
            display: flex;
            align-items: center;
            gap: 5px;
        }

        .funnel-block-title--toggle {
            cursor: pointer;
            justify-content: space-between;
            padding: 2px 2px;
            border-radius: 4px;
            transition: background 0.1s;
        }

        .funnel-block-title--toggle:hover {
            background: #f3f4f6;
        }

        .funnel-title-left {
            display: flex;
            align-items: center;
            gap: 5px;
        }

        .funnel-chevron {
            font-size: 9px;
            color: #9ca3af;
            transition: transform 0.15s;
        }

        .funnel-dot {
            display: inline-block;
            width: 8px;
            height: 8px;
            border-radius: 50%;
            flex-shrink: 0;
        }

        /* ── Caja blanca de botones ── */
        .funnel-stages-box {
            background: white;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 6px 8px;
            margin-top: 3px;
        }

        /* ── Contenedor de etapas ── */
        .funnel-stages {
            display: flex;
            flex-wrap: wrap;
            gap: 3px;
        }

        /* ── Botón de etapa ── */
        .funnel-stage-btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 1px 8px;
            height: 20px;
            border-radius: 10px;
            border: 1px solid #e5e7eb;
            font-size: 10.5px;
            cursor: pointer;
            transition: background 0.15s, color 0.15s, border-color 0.15s, transform 0.1s;
            white-space: nowrap;
            line-height: 1;
        }

        .funnel-stage-btn:hover:not(.active) {
            background-color: #ede9fe !important;
            color: #7c3aed !important;
            border-color: #a78bfa !important;
        }

        .funnel-stage-btn:active {
            transform: scale(0.95);
        }

        /* ── Timestamp ── */
        .funnel-updated-at {
            font-size: 10px;
            color: #d1d5db;
            margin-top: 4px;
        }

        /* ── Separador entre embudos ── */
        .funnel-separator {
            height: 1px;
            background: #ffffff;
            margin: 4px 0 2px;
        }

        /* ── Estados vacío / loading / error ── */
        .funnel-state-msg {
            font-size: 11px;
            color: #9ca3af;
            padding: 8px 12px;
            display: flex;
            flex-direction: column;
            gap: 6px;
        }

        .funnel-state-error {
            color: #f87171;
        }

        .funnel-retry-btn {
            align-self: flex-start;
            padding: 3px 10px;
            font-size: 10px;
            border: 1px solid #e5e7eb;
            border-radius: 6px;
            background: white;
            color: #7c3aed;
            cursor: pointer;
        }

        .funnel-retry-btn:hover {
            background: #f5f3ff;
        }

        /* ── Botón basurero en título ── */
        .funnel-title-actions {
            display: flex;
            align-items: center;
            gap: 4px;
        }

        .funnel-btn-delete {
            width: 18px; height: 18px;
            border-radius: 4px; border: none;
            background: transparent; cursor: pointer;
            display: flex; align-items: center; justify-content: center;
            color: #d1d5db; font-size: 9px;
            transition: background .15s, color .15s;
            padding: 0;
        }
        .funnel-btn-delete:hover {
            background: #fee2e2;
            color: #ef4444;
        }

        /* ── Popover confirmación eliminar ── */
        @keyframes funnelFadeIn {
            from { opacity: 0; transform: translateY(-4px) scale(.97); }
            to   { opacity: 1; transform: translateY(0) scale(1); }
        }

        .funnel-delete-popover {
            position: fixed;
            z-index: 9999;
            background: white;
            border: 1px solid #fee2e2;
            border-radius: 10px;
            padding: 10px 12px 9px;
            min-width: 160px;
            max-width: 200px;
            box-shadow: 0 6px 20px rgba(0,0,0,.13);
            opacity: 0;
            transform: translateY(-4px) scale(.97);
            transition: opacity .15s ease, transform .15s ease;
            pointer-events: none;
        }
        .funnel-delete-popover.show {
            opacity: 1;
            transform: translateY(0) scale(1);
            pointer-events: all;
        }

        .funnel-delete-popover-arrow {
            position: absolute;
            top: -5px;
            left: 50%;
            transform: translateX(-50%) rotate(45deg);
            width: 9px; height: 9px;
            background: white;
            border-left: 1px solid #fee2e2;
            border-top: 1px solid #fee2e2;
        }

        .funnel-delete-popover-msg {
            font-size: 11.5px;
            color: #374151;
            margin: 0 0 8px;
            display: flex;
            align-items: center;
            gap: 5px;
            line-height: 1.4;
        }

        .funnel-delete-popover-actions {
            display: flex;
            gap: 6px;
            justify-content: flex-end;
        }

        .funnel-dpop-cancel {
            padding: 4px 10px;
            border-radius: 6px;
            border: 1px solid #e5e7eb;
            background: white;
            font-size: 11px;
            color: #6b7280;
            cursor: pointer;
        }
        .funnel-dpop-cancel:hover { background: #f9fafb; }

        .funnel-dpop-ok {
            padding: 4px 10px;
            border-radius: 6px;
            border: none;
            background: #ef4444;
            font-size: 11px;
            font-weight: 600;
            color: white;
            cursor: pointer;
        }
        .funnel-dpop-ok:hover { background: #dc2626; }

        /* ── Botón + Agregar embudo ── */
        .funnel-add-wrapper {
            position: relative;
            margin-top: 8px;
        }

        .funnel-btn-add {
            display: flex;
            align-items: center;
            gap: 6px;
            width: 100%;
            padding: 6px 10px;
            background: #faf5ff;
            border: 1px dashed #c4b5fd;
            border-radius: 8px;
            cursor: pointer;
            font-size: 11px;
            color: #7c3aed;
            font-weight: 500;
            transition: all .15s;
        }
        .funnel-btn-add:hover:not(:disabled) {
            background: #ede9fe;
            border-color: #7c3aed;
        }
        .funnel-btn-add:disabled {
            background: #f9fafb;
            border: 1px solid #f3f4f6;
            color: #9ca3af;
            cursor: default;
            font-weight: 400;
        }
        .funnel-btn-add i { font-size: 9px; }

        /* ── Dropdown embudos disponibles ── */
        .funnel-add-dropdown {
            display: none;
            position: absolute;
            bottom: calc(100% + 5px);
            left: 0; right: 0;
            background: white;
            border: 1px solid #e5e7eb;
            border-radius: 10px;
            box-shadow: 0 6px 20px rgba(0,0,0,.10);
            overflow: hidden;
            z-index: 100;
            animation: funnelFadeIn .15s ease;
        }
        .funnel-add-dropdown.show { display: block; }

        .funnel-add-dropdown-header {
            padding: 7px 10px 6px;
            font-size: 10px;
            font-weight: 700;
            color: #7c3aed;
            background: #faf5ff;
            border-bottom: 1px solid #ede9fe;
            text-transform: uppercase;
            letter-spacing: .05em;
        }

        .funnel-add-item {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 12px;
            cursor: pointer;
            font-size: 11.5px;
            color: #374151;
            font-weight: 500;
            border-bottom: 1px solid #f9fafb;
            transition: background .1s;
        }
        .funnel-add-item:last-child { border-bottom: none; }
        .funnel-add-item:hover {
            background: #faf5ff;
            color: #7c3aed;
        }
        .funnel-add-item .fa-plus {
            margin-left: auto;
            font-size: 9px;
            color: #c4b5fd;
            opacity: 0;
            transition: opacity .1s;
        }
        .funnel-add-item:hover .fa-plus { opacity: 1; }

        /* Scrollbar discreto */
        #contactFunnelsContainer::-webkit-scrollbar {
            width: 3px;
        }
        #contactFunnelsContainer::-webkit-scrollbar-track {
            background: transparent;
        }
        #contactFunnelsContainer::-webkit-scrollbar-thumb {
            background: #e5e7eb;
            border-radius: 3px;
        }
        #contactFunnelsContainer::-webkit-scrollbar-thumb:hover {
            background: #a78bfa;
        }
    `;
    document.head.appendChild(s);
}

// Inyectar estilos al cargar
injectFunnelStyles();


// ============================================
// EXPORTS GLOBALES
// ============================================
window.loadFunnels      = loadFunnels;
window.resetFunnelPanel = resetFunnelPanel;

// ============================================
// ELIMINAR EMBUDO DEL CONTACTO
// ============================================

function _showDeleteFunnelModal(funnelId, funnelName, triggerBtn) {
    // Cerrar cualquier popover abierto
    _hideFunnelDeleteModal();

    const popover = document.createElement('div');
    popover.id = '_funnelDeletePopover';
    popover.className = 'funnel-delete-popover';
    popover.innerHTML = `
        <div class="funnel-delete-popover-arrow"></div>
        <p class="funnel-delete-popover-msg">
            <i class="fas fa-trash" style="color:#ef4444;font-size:9px"></i>
            ¿Quitar <strong>${funnelName}</strong>?
        </p>
        <div class="funnel-delete-popover-actions">
            <button class="funnel-dpop-cancel">Cancelar</button>
            <button class="funnel-dpop-ok">Eliminar</button>
        </div>
    `;
    document.body.appendChild(popover);

    // Posicionar relativo al botón
    const rect = triggerBtn.getBoundingClientRect();
    popover.style.top  = `${rect.bottom + 6 + window.scrollY}px`;
    popover.style.left = `${rect.left + rect.width / 2 - popover.offsetWidth / 2}px`;

    // Ajustar si se sale por la derecha
    const pw = popover.offsetWidth;
    const vw = window.innerWidth;
    const left = parseFloat(popover.style.left);
    if (left + pw > vw - 8) popover.style.left = `${vw - pw - 8}px`;
    if (left < 8) popover.style.left = '8px';

    // Mostrar con animación
    requestAnimationFrame(() => popover.classList.add('show'));

    popover.querySelector('.funnel-dpop-cancel').addEventListener('click', _hideFunnelDeleteModal);
    popover.querySelector('.funnel-dpop-ok').addEventListener('click', () => {
        _hideFunnelDeleteModal();
        _doDeleteFunnel(funnelId);
    });

    // Cerrar al click fuera
    setTimeout(() => {
        document.addEventListener('click', _hideFunnelDeleteModal, { once: true });
    }, 0);
}

function _hideFunnelDeleteModal() {
    const p = document.getElementById('_funnelDeletePopover');
    if (p) p.remove();
}

async function _doDeleteFunnel(funnelId) {
    _hideFunnelDeleteModal();
    try {
        const res = await fetch(
            `${API_BASE_URL || ''}/api/funnels/${_funnelCurrentCompanyId}/contact/${_funnelCurrentUserId}/${funnelId}`,
            { method: 'DELETE', headers: _funnelAuthHeaders() }
        );
        const data = await res.json();
        if (data.success) {
            _funnelData = _funnelData.filter(f => f.funnel_id !== funnelId);
            // Actualizar contador
            const counter = document.getElementById('funnelsCounter');
            if (counter) {
                counter.textContent = _funnelData.length;
                counter.style.display = _funnelData.length > 0 ? 'inline-block' : 'none';
            }
            if (_funnelData.length === 0) renderFunnelEmpty('Sin embudos asignados');
            else renderFunnels(_funnelData);
        }
    } catch (err) {
        console.error('❌ Error eliminando embudo:', err);
    }
}


// ============================================
// AGREGAR EMBUDO AL CONTACTO
// ============================================

async function _renderAddFunnelButton(panel) {
    // Cargar embudos disponibles de la empresa
    let companyFunnels = [];
    try {
        const res = await fetch(
            `${API_BASE_URL || ''}/api/funnels/${_funnelCurrentCompanyId}`,
            { headers: _funnelAuthHeaders() }
        );
        const data = await res.json();
        companyFunnels = data.funnels || [];
    } catch { return; }

    // Filtrar los que el contacto ya tiene
    const assignedIds = new Set(_funnelData.map(f => f.funnel_id));
    const available   = companyFunnels.filter(f => !assignedIds.has(f._id));

    // Botón + Agregar embudo
    const wrapper = document.createElement('div');
    wrapper.className = 'funnel-add-wrapper';

    const btn = document.createElement('button');
    btn.className = 'funnel-btn-add';
    btn.disabled = available.length === 0;
    btn.innerHTML = available.length === 0
        ? `<i class="fas fa-check-circle"></i> Todos los embudos asignados`
        : `<i class="fas fa-plus"></i> Agregar embudo`;
    wrapper.appendChild(btn);
    panel.appendChild(wrapper);

    if (available.length === 0) return;

    // Dropdown de embudos disponibles
    const dropdown = document.createElement('div');
    dropdown.className = 'funnel-add-dropdown';
    dropdown.innerHTML = `<div class="funnel-add-dropdown-header"><i class="fas fa-filter" style="font-size:9px;margin-right:4px"></i>Seleccionar embudo</div>`;

    available.forEach(f => {
        const item = document.createElement('div');
        item.className = 'funnel-add-item';
        const dotColor = f.stages?.[0]?.color || '#7c3aed';
        item.innerHTML = `
            <span class="funnel-dot" style="background:${dotColor};width:7px;height:7px"></span>
            <span>${f.name}</span>
            <i class="fas fa-plus" style="margin-left:auto;font-size:9px;color:#a78bfa"></i>
        `;
        item.addEventListener('click', () => {
            dropdown.classList.remove('show');
            _doAssignFunnel(f._id, f.name);
        });
        dropdown.appendChild(item);
    });

    wrapper.appendChild(dropdown);

    // Toggle dropdown
    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('show');
    });
    document.addEventListener('click', () => dropdown.classList.remove('show'), { once: false });
}

async function _doAssignFunnel(funnelId, funnelName) {
    try {
        const res = await fetch(
            `${API_BASE_URL || ''}/api/funnels/${_funnelCurrentCompanyId}/contact/${_funnelCurrentUserId}/assign`,
            {
                method:  'POST',
                headers: _funnelAuthHeaders(),
                body:    JSON.stringify({ funnel_id: funnelId })
            }
        );
        const data = await res.json();
        if (data.success) {
            console.log(`✅ Embudo ${funnelName} asignado`);
            await loadFunnels(_funnelCurrentCompanyId, _funnelCurrentUserId);
        }
    } catch (err) {
        console.error('❌ Error asignando embudo:', err);
    }
}