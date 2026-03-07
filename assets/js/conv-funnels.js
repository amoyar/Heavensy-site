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

        // Nombre del embudo con punto de color
        const title = document.createElement('div');
        title.className = 'funnel-block-title';

        // Tomar el color de la primera etapa como color del embudo
        const activeStage = funnel.stages?.find(s => s.id === funnel.current_stage_id);
        const funnelColor = activeStage?.color || '#7c3aed';

        title.innerHTML = `
            <span class="funnel-dot" style="background:${funnelColor}"></span>
            ${funnel.funnel_name}
        `;
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

        block.appendChild(stagesContainer);

        // Timestamp última actualización
        if (funnel.updated_at) {
            const ts = document.createElement('div');
            ts.className   = 'funnel-updated-at';
            ts.textContent = `Actualizado: ${_formatRelativeTime(funnel.updated_at)}`;
            block.appendChild(ts);
        }

        // Separador entre embudos (no en el último)
        if (index < funnels.length - 1) {
            const sep = document.createElement('div');
            sep.className = 'funnel-separator';
            block.appendChild(sep);
        }

        panel.appendChild(block);
    });
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
        btn.style.backgroundColor = '#f3f4f6';
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
            padding: 8px 12px 4px;
        }

        .funnel-block-title {
            font-size: 12px;
            font-weight: 600;
            color: #374151;
            margin-bottom: 6px;
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .funnel-dot {
            display: inline-block;
            width: 8px;
            height: 8px;
            border-radius: 50%;
            flex-shrink: 0;
        }

        /* ── Contenedor de etapas ── */
        .funnel-stages {
            display: flex;
            flex-wrap: wrap;
            gap: 4px;
        }

        /* ── Botón de etapa ── */
        .funnel-stage-btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 2px 9px;
            height: 20px;
            border-radius: 10px;
            border: 1px solid #e5e7eb;
            font-size: 9px;
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
            font-size: 11px;
            color: #d1d5db;
            margin-top: 5px;
        }

        /* ── Separador entre embudos ── */
        .funnel-separator {
            height: 1px;
            background: #f3f4f6;
            margin: 8px 0 4px;
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