// ============================================
// CONVERSACIONES.JS — Orquestador principal
// Inicialización, event listeners, exports globales
//
// MÓDULOS (cargar en este orden):
// 1. conv-state.js    — Estado global, utilidades, helpers
// 2. conv-filters.js  — Sistema de filtros (chips, avanzados)
// 3. conv-render.js   — Renderizado de conversaciones y mensajes
// 4. conv-messages.js — Carga, envío, selección, audio, IA toggle
// 5. conversaciones.js — ESTE ARCHIVO (orquestador)
// ============================================

console.log('✅ conversaciones.js (orquestador) cargado');
// ============================================
// CONTROL BARRA DE INPUT
// ============================================
function setInputBarEnabled(enabled) {
    const ids = ['messageInput', 'sendButton', 'micButton', 'emojiBtn', 'quickRepliesBtn'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.disabled = !enabled;
        el.style.opacity = enabled ? '' : '0.4';
        el.style.pointerEvents = enabled ? '' : 'none';
        el.style.cursor = enabled ? '' : 'not-allowed';
    });
    const fileBtn = document.querySelector('button[onclick*="fileInput"]');
    if (fileBtn) {
        fileBtn.disabled = !enabled;
        fileBtn.style.opacity = enabled ? '' : '0.4';
        fileBtn.style.pointerEvents = enabled ? '' : 'none';
    }
    const input = document.getElementById('messageInput');
    if (input) {
        input.placeholder = enabled
            ? 'Escribe un mensaje...'
            : 'Selecciona una empresa y conversación...';
    }
}

// ============================================
// CONTROL BARRA DE INPUT
// ============================================
function setInputBarEnabled(enabled) {
    const ids = ['messageInput', 'sendButton', 'micButton', 'emojiBtn', 'quickRepliesBtn'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.disabled = !enabled;
        el.style.opacity = enabled ? '' : '0.4';
        el.style.pointerEvents = enabled ? '' : 'none';
        el.style.cursor = enabled ? '' : 'not-allowed';
    });
    const fileBtn = document.querySelector('button[onclick*="fileInput"]');
    if (fileBtn) {
        fileBtn.disabled = !enabled;
        fileBtn.style.opacity = enabled ? '' : '0.4';
        fileBtn.style.pointerEvents = enabled ? '' : 'none';
    }
    const input = document.getElementById('messageInput');
    if (input) {
        input.placeholder = enabled ? 'Escribe un mensaje...' : 'Selecciona una empresa y conversación...';
    }
}


// ============================================
// INICIALIZACIÓN
// ============================================
async function initConversacionesPage() {
    console.log('🚀 Inicializando página de conversaciones');

    const token = getToken();
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    if (window.ConversacionesModuleInitialized) {
        console.log('🔄 Re-inicializando página (navegación SPA)...');
        resetChatAndContactPanel();
        setupConversacionesEventListeners();
        await cargarEmpresasYConversaciones();
        if (typeof reinitQuickReplies === 'function') reinitQuickReplies();
        setTimeout(() => setInputBarEnabled(false), 150);
        return;
    }

    window.ConversacionesModuleInitialized = true;

    await cargarEmpresasYConversaciones();
    setupConversacionesEventListeners();
    setTimeout(() => setInputBarEnabled(false), 150);

    console.log('✅ Página de conversaciones inicializada');
}

// ============================================
// CONFIGURAR EVENT LISTENERS
// ============================================
function setupConversacionesEventListeners() {
    console.log('🔧 Configurando event listeners...');

    // Cambio de empresa
    const companySelect = document.getElementById('conversacionesCompanyFilter');
    if (companySelect) {
        companySelect.addEventListener('change', async (e) => {
            const companyId = e.target.value;

            if (!companyId) {
                currentCompanyId = null;
                conversations = [];
                currentConversation = null;
                renderConversations();
                mostrarEstadoSinEmpresaSeleccionada();
                setInputBarEnabled(false);
                // Deshabilitar filtros avanzados
                const btnAdv = document.getElementById('advancedFiltersToggle');
                if (btnAdv) { btnAdv.disabled = true; btnAdv.classList.add('opacity-40','cursor-not-allowed'); }
                // Cerrar panel si estaba abierto
                document.getElementById('advancedFiltersPanel')?.classList.add('hidden');
                // Ocultar botón colapsar
                const btnColl2 = document.getElementById('btnCollapseLeft');
                if (btnColl2) btnColl2.style.visibility = 'hidden';

                if (typeof hideContactPanel === "function") {
                hideContactPanel();
}
                return;
            }

            currentCompanyId = companyId;
            resetChatAndContactPanel();
            // Ocultar botón colapsar hasta que se seleccione un contacto
            const btnColl3 = document.getElementById('btnCollapseLeft');
            if (btnColl3) btnColl3.style.visibility = 'hidden';
            await cargarConversacionesPorEmpresa(companyId);
            mostrarEstadoSinConversacionSeleccionada();
            setInputBarEnabled(true);
            // Habilitar filtros avanzados
            const btnAdv = document.getElementById('advancedFiltersToggle');
            if (btnAdv) { btnAdv.disabled = false; btnAdv.classList.remove('opacity-40','cursor-not-allowed'); }
        });
    }

    // Búsqueda de conversaciones
    const searchInput = document.getElementById('searchConversations');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            filterConversations(e.target.value);
        });
    }

    // Filtros
    setupFilterChips();
    setupPlanFilters();

    // Panel toggles
    const btnClose = document.getElementById('btnCloseContactPanel');
    if (btnClose) {
        btnClose.addEventListener('click', function(e) {
            e.stopPropagation();
            const p = document.getElementById('contactPanel');
            if (p) p.classList.add('panel-hidden');
        });
    }
    // ── Panel izquierdo: colapsar/expandir ──
    // Función centralizada — la usan btnCollapseLeft (header izq) y btnToggleLeft (chatHeader)
    function _toggleLeftPanel(e) {
        if (e) e.stopPropagation();
        const lp        = document.getElementById('convLeftPanel');
        const btnExpand = document.getElementById('btnExpandLeft');
        const btnL      = document.getElementById('btnToggleLeft');
        const btnColl   = document.getElementById('btnCollapseLeft');
        if (!lp) return;

        const isHidden = lp.classList.toggle('panel-hidden');

        // Sincronizar íconos en ambos botones
        if (btnL)    btnL.querySelector('i').className    = isHidden ? 'fas fa-chevron-right' : 'fas fa-chevron-left';
        if (btnColl) btnColl.querySelector('i').className = isHidden ? 'fas fa-chevron-right' : 'fas fa-chevron-left';

        // Botón flotante: visible solo cuando está colapsado
        if (btnExpand) btnExpand.style.display = isHidden ? 'flex' : 'none';
    }

    const btnL    = document.getElementById('btnToggleLeft');
    const btnColl = document.getElementById('btnCollapseLeft');
    const btnExp  = document.getElementById('btnExpandLeft');
    if (btnL)    btnL.addEventListener('click',    _toggleLeftPanel);
    if (btnColl) btnColl.addEventListener('click', _toggleLeftPanel);
    if (btnExp)  btnExp.addEventListener('click',  _toggleLeftPanel);

    // ── Panel derecho (contacto): colapsar/expandir ──
    const btnR = document.getElementById('btnToggleRight');
    if (btnR) {
        btnR.addEventListener('click', function(e) {
            e.stopPropagation();
            const p = document.getElementById('contactPanel');
            if (p && !p.classList.contains('hidden')) {
                p.classList.toggle('panel-hidden');
                btnR.querySelector('i').className = p.classList.contains('panel-hidden')
                    ? 'fas fa-chevron-left' : 'fas fa-chevron-right';
            }
        });
    }

    console.log('✅ Event listeners configurados');
}

// ============================================
// EXPONER FUNCIONES GLOBALMENTE
// ============================================
window.initConversacionesPage = initConversacionesPage;
window.setInputBarEnabled = setInputBarEnabled;
window.setInputBarEnabled = setInputBarEnabled;

// Estas funciones las expone conv-messages.js directamente

// window.sendMessage = sendMessage;
// window.selectMessageByIndex = selectMessageByIndex;
// window.selectMessageToReply = selectMessageToReply;
// window.deselectMessage = deselectMessage;
// window.toggleMessageOrder = toggleMessageOrder;

// 🔌 Exports para módulo realtime.js
window.conversacionesAPI = {
    getState: () => ({
        currentConversation,
        conversations,
        currentMessages,
        currentCompanyId
    }),
    renderConversations,
    loadMessages,
    cargarMensajesDeConversacion,
    cargarConversacionesPorEmpresa,
    selectConversation
};

console.log('📱 Módulo de conversaciones listo');