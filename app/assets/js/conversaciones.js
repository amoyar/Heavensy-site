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

                if (typeof hideContactPanel === "function") {
                hideContactPanel();
}
                return;
            }

            currentCompanyId = companyId;
            resetChatAndContactPanel();
            await cargarConversacionesPorEmpresa(companyId);
            mostrarEstadoSinConversacionSeleccionada();
            setInputBarEnabled(true);
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