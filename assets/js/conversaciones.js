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
// TOGGLE CONVERSACIONES / SEGUIMIENTO
// ============================================

var _convMode = 'conv';

function setConvMode(mode) {
  _convMode = mode;

  // Chips
  var chipConv = document.getElementById('mode-chip-conv');
  var chipSeg  = document.getElementById('mode-chip-seg');
  if (chipConv) {
    chipConv.style.background   = mode === 'conv' ? '#fff'         : 'transparent';
    chipConv.style.color        = mode === 'conv' ? '#9961FF'      : '#6b7280';
    chipConv.style.boxShadow    = mode === 'conv' ? '0 1px 4px rgba(0,0,0,.1)' : 'none';
  }
  if (chipSeg) {
    chipSeg.style.background    = mode === 'seg'  ? '#fff'         : 'transparent';
    chipSeg.style.color         = mode === 'seg'  ? '#9961FF'      : '#6b7280';
    chipSeg.style.boxShadow     = mode === 'seg'  ? '0 1px 4px rgba(0,0,0,.1)' : 'none';
  }

  // Filtros avanzados — solo en conversaciones
  var filtersBtn = document.getElementById('advancedFiltersToggle');
  if (filtersBtn) filtersBtn.style.display = mode === 'conv' ? '' : 'none';
  var filtersPanel = document.getElementById('advancedFiltersPanel');
  if (filtersPanel && mode === 'seg') filtersPanel.classList.add('hidden');

  // Lista de conversaciones vs lista de clientes seguimiento
  var convList   = document.getElementById('conversationsList');
  var convSearch = document.getElementById('searchConversations');
  var segPanel   = document.getElementById('seg-clientes-panel');

  if (convList)   convList.style.display   = mode === 'conv' ? '' : 'none';
  if (convSearch) {
    convSearch.closest('.relative') && (convSearch.closest('.relative').style.display = mode === 'conv' ? '' : 'none');
  }

  // Panel de seguimiento en el área principal
  var convWrapper = document.getElementById('convWrapper');
  var segWrapper  = document.getElementById('seguimientoWrapper');

  if (mode === 'seg') {
    if (convWrapper) convWrapper.style.display = 'none';
    if (!segWrapper) {
      _initSeguimientoPanel();
    } else {
      segWrapper.style.display = '';
    }
  } else {
    if (convWrapper) convWrapper.style.display = '';
    if (segWrapper)  segWrapper.style.display  = 'none';
  }
}

function _initSeguimientoPanel() {
  // Crear el wrapper del módulo de seguimiento si no existe
  var main = document.getElementById('app') || document.body;
  var wrapper = document.createElement('div');
  wrapper.id = 'seguimientoWrapper';
  wrapper.style.cssText = 'height:100%;display:flex;overflow:hidden;';

  // Cargar el HTML del módulo de seguimiento via fetch
  fetch('./assets/seguimiento-conv.html')
    .then(function(r){ return r.text(); })
    .then(function(html){
      wrapper.innerHTML = html;
      main.appendChild(wrapper);
      // Inicializar el módulo
      if (typeof initSeguimientoModule === 'function') {
        initSeguimientoModule();
      }
    })
    .catch(function(e){
      console.error('❌ Error cargando módulo seguimiento:', e);
      wrapper.innerHTML = '<div style="padding:20px;color:#ef4444">Error cargando módulo de seguimiento</div>';
      main.appendChild(wrapper);
    });
}

window.setConvMode = setConvMode;



// ============================================
// TOGGLE BOTONES CONTACTO (VIP / Aliarme)
// ============================================
function _toggleContactBtn(btn, c) {
    const isActive = btn.dataset.active === '1';
    if (isActive) {
        btn.style.background  = c.bgOff;
        btn.style.borderColor = c.borderOff;
        btn.style.color       = c.colorOff;
        btn.dataset.active    = '0';
    } else {
        btn.style.background  = c.bg;
        btn.style.borderColor = c.border;
        btn.style.color       = c.color;
        btn.dataset.active    = '1';
    }
}
window._toggleContactBtn = _toggleContactBtn;
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
// ============================================
// APLICAR LABELS DINÁMICOS SEGÚN RUBRO
// ============================================
function applyCompanyLabels() {
    if (typeof getCompanyLabel !== 'function') return;

    const labels = {
        'label-seccion-lateral': getCompanyLabel('seccion_lateral', 'Mis Servicios'),
        'label-tab-agenda':      getCompanyLabel('tab_agenda', 'Agenda'),
        'label-tab-calendario':  getCompanyLabel('tab_calendario', 'Calendario'),
    };

    Object.entries(labels).forEach(([id, text]) => {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    });

    // Ocultar módulos deshabilitados
    if (typeof isModuleEnabled === 'function') {
        // Agenda
        const agendaSection = document.querySelector('[onclick*="contactAgendaSection"]')?.closest('.border-b');
        if (agendaSection) agendaSection.style.display = isModuleEnabled('agenda') ? '' : 'none';

        // Calendario
        const calSection = document.querySelector('[onclick*="contactCalendarSection"]')?.closest('.border-b');
        if (calSection) calSection.style.display = isModuleEnabled('calendario') ? '' : 'none';

        // Servicios (sección lateral)
        const svcBtn = document.querySelector('[onclick*="servicesGroup"]');
        if (svcBtn) svcBtn.parentElement.style.display = isModuleEnabled('servicios') ? '' : 'none';
    }

    console.log('✅ Labels de conversaciones aplicados');
}

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
        applyCompanyLabels();
        try {
            await cargarEmpresasYConversaciones();
        } catch(err) {
            mostrarErrorConversaciones(err?.message);
            return;
        }
        if (typeof reinitQuickReplies === 'function') reinitQuickReplies();
        setTimeout(() => setInputBarEnabled(false), 150);
        return;
    }

    window.ConversacionesModuleInitialized = true;

    applyCompanyLabels();
    setupConversacionesEventListeners();  // ANTES de cargar — el change event debe tener listener
    try {
        await cargarEmpresasYConversaciones();
    } catch(err) {
        mostrarErrorConversaciones(err?.message);
        return;
    }
    setTimeout(() => setInputBarEnabled(false), 150);

    console.log('✅ Página de conversaciones inicializada');
}

// ============================================
// CONFIGURAR EVENT LISTENERS
// ============================================
function setupConversacionesEventListeners() {
    console.log('🔧 Configurando event listeners...');

    initCompanyDropdown();

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
                _setCollapseLeftVisible(false);
                return;
            }

            currentCompanyId = companyId;
            resetChatAndContactPanel();
            _setCollapseLeftVisible(false);
            mostrarCargandoConversaciones();
            try {
                await cargarConversacionesPorEmpresa(companyId);
            } catch(err) {
                mostrarErrorConversaciones(err?.message);
                return;
            }
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

    // Panel toggles
    const btnClose = document.getElementById('btnCloseContactPanel');
    if (btnClose) {
        btnClose.addEventListener('click', function(e) {
            e.stopPropagation();
            const p = document.getElementById('contactPanel');
            if (p) p.classList.add('panel-hidden');
        });
    }
    const btnL = document.getElementById('btnToggleLeft');
    const btnR = document.getElementById('btnToggleRight');
    // Sincronizar ícono inicial según estado real del panel derecho
    if (btnR) {
        const _cp = document.getElementById('contactPanel');
        const _isHidden = !_cp || _cp.classList.contains('hidden') || _cp.classList.contains('panel-hidden');
        btnR.querySelector('i').className = _isHidden ? 'fas fa-chevron-left' : 'fas fa-chevron-right';
    }
    const btnCL = document.getElementById('btnCollapseLeft');
    if (btnCL) {
        btnCL.addEventListener('click', function(e) {
            e.stopPropagation();
            const lp = document.getElementById('convLeftPanel');
            lp.classList.add('panel-hidden');
            if (btnL) btnL.querySelector('i').className = 'fas fa-chevron-right';
        });
    }
    if (btnL) {
        btnL.addEventListener('click', function(e) {
            e.stopPropagation();
            const lp = document.getElementById('convLeftPanel');
            lp.classList.toggle('panel-hidden');
            btnL.querySelector('i').className = lp.classList.contains('panel-hidden')
                ? 'fas fa-chevron-right' : 'fas fa-chevron-left';
        });
    }
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

    // Mostrar btnCollapseLeft cuando hay conversación activa (observa chatHeader)
    const chatHeader = document.getElementById('chatHeader');
    if (chatHeader) {
        new MutationObserver(() => {
            const hasConv = !chatHeader.classList.contains('hidden');
            _setCollapseLeftVisible(hasConv);
        }).observe(chatHeader, { attributes: true, attributeFilter: ['class'] });
    }

    // Sincronizar ícono de btnToggleRight cuando contactPanel cambia de clase
    const contactPanelEl = document.getElementById('contactPanel');
    if (contactPanelEl && btnR) {
        new MutationObserver(() => {
            const isHidden = contactPanelEl.classList.contains('hidden') || contactPanelEl.classList.contains('panel-hidden');
            btnR.querySelector('i').className = isHidden ? 'fas fa-chevron-left' : 'fas fa-chevron-right';
        }).observe(contactPanelEl, { attributes: true, attributeFilter: ['class'] });
    }

    console.log('✅ Event listeners configurados');
}

// ============================================
// EXPONER FUNCIONES GLOBALMENTE
// ============================================
// Mostrar/ocultar btnCollapseLeft según si hay conversación activa
function _setCollapseLeftVisible(visible) {
    const btn = document.getElementById('btnCollapseLeft');
    if (btn) btn.style.display = visible ? 'inline-flex' : 'none';
}
window._setCollapseLeftVisible = _setCollapseLeftVisible;
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
// ============================================
// DROPDOWN CUSTOM — SELECTOR DE EMPRESA
// ============================================
function initCompanyDropdown() {
    var btn   = document.getElementById('companyDropdownBtn');
    var list  = document.getElementById('companyDropdownList');
    var items = document.getElementById('companyDropdownItems');
    var label = document.getElementById('companyDropdownLabel');
    var icon  = document.getElementById('companyDropdownIcon');
    var sel   = document.getElementById('conversacionesCompanyFilter');
    if (!btn || !sel) return;

    function buildItems() {
        items.innerHTML = '';
        Array.from(sel.options).forEach(function(opt) {
            var div = document.createElement('div');
            div.textContent = opt.text;
            div.dataset.value = opt.value;
            div.style.cssText = 'padding:7px 12px;font-size:13px;cursor:pointer;color:' + (opt.value ? '#374151' : '#9ca3af') + ';';
            div.addEventListener('mouseover', function() { this.style.background = '#EFF6FF'; });
            div.addEventListener('mouseout',  function() { this.style.background = sel.value === this.dataset.value ? '#EFF6FF' : ''; });
            div.addEventListener('click', function() {
                sel.value = this.dataset.value;
                label.textContent = this.textContent;
                label.style.color = this.dataset.value ? '#374151' : '#9ca3af';
                list.style.display = 'none';
                icon.style.transform = '';
                highlightSelected();
                sel.dispatchEvent(new Event('change', { bubbles: true }));
            });
            items.appendChild(div);
        });
        highlightSelected();
    }

    function highlightSelected() {
        Array.from(items.children).forEach(function(d) {
            var active = d.dataset.value === sel.value && sel.value !== '';
            d.style.background  = active ? '#EFF6FF' : '';
            d.style.color       = active ? '#7D84C1' : (d.dataset.value ? '#374151' : '#9ca3af');
            d.style.fontWeight  = active ? '600' : '400';
            d.style.borderLeft  = active ? '2px solid #7D84C1' : '';
            d.style.paddingLeft = active ? '10px' : '12px';
        });
    }

    btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var open = list.style.display === 'block' && list.style.opacity !== '0';
        if (open) {
            list.style.opacity = '0';
            list.style.transform = 'translateY(-4px)';
            setTimeout(() => { list.style.display = 'none'; }, 180);
        } else {
            list.style.display = 'block';
            list.style.opacity = '0';
            list.style.transform = 'translateY(-4px)';
            list.style.transition = 'opacity 0.18s ease, transform 0.18s ease';
            requestAnimationFrame(() => requestAnimationFrame(() => {
                list.style.opacity = '1';
                list.style.transform = 'translateY(0)';
            }));
        }
        icon.style.transform = open ? '' : 'rotate(180deg)';
    });

    document.addEventListener('click', function(e) {
        var wrap = document.getElementById('companyDropdownWrap');
        if (wrap && !wrap.contains(e.target)) {
            list.style.opacity = '0';
            list.style.transform = 'translateY(-4px)';
            setTimeout(() => { list.style.display = 'none'; }, 180);
            icon.style.transform = '';
        }
    });

    // Detectar cuando poblarSelectorEmpresas llena el select oculto
    new MutationObserver(function() {
        buildItems();
        label.textContent = 'Seleccione una empresa';
        label.style.color = '#9ca3af';
    }).observe(sel, { childList: true });

    // Si el select ya tiene opciones (recarga de página), construir inmediatamente
    if (sel.options.length > 1) {
        buildItems();
        var cur = sel.options[sel.selectedIndex];
        label.textContent = (cur && cur.value) ? cur.text : 'Seleccione una empresa';
        label.style.color = (cur && cur.value) ? '#374151' : '#9ca3af';
    }
}