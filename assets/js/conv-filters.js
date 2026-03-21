// ============================================
// CONV-FILTERS.JS — Sistema de filtros
// Filtros rápidos, avanzados (plan, tags), contadores
// ============================================

console.log('✅ conv-filters.js cargado');

// Estado de filtros
let currentQuickFilter = 'all';
let currentPlanFilter = '';
let currentTagFilters = [];

// ============================================
// SETUP: Chips de filtro rápido
// ============================================
function setupFilterChips() {
    const chips = document.querySelectorAll('.filter-chip');
    chips.forEach(chip => {
        chip.addEventListener('click', () => {
            chips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            currentQuickFilter = chip.dataset.filter;
            applyAllFilters();
        });
    });
}

// ============================================
// SETUP: Filtros de plan
// ============================================
function setupPlanFilters() {
    // Paleta de colores por plan — estilo Heavensy
    const planStyles = {
        '':        { color: '#7D84C1', border: '#7D84C1', bg: '#EFF6FF' }, // Todos
        'Premium': { color: '#9961FF', border: '#9961FF', bg: '#F5F0FF' },
        'Basic':   { color: '#0ea5e9', border: '#0ea5e9', bg: '#EFF9FF' },
        'Free':    { color: '#10b981', border: '#10b981', bg: '#F0FDF4' },
    };

    const applyStyle = (chip, active) => {
        const plan = chip.dataset.plan;
        const s = planStyles[plan] || { color: '#6b7280', border: '#e5e7eb', bg: '#f9fafb' };
        chip.style.cssText = `
            display:inline-flex;align-items:center;padding:2px 10px;
            border-radius:999px;font-size:10px;font-weight:700;
            border:1.5px solid ${active ? s.border : '#e5e7eb'};
            color:${active ? s.color : '#9ca3af'};
            background:${active ? s.bg : '#fff'};
            cursor:pointer;transition:all .15s;letter-spacing:0.04em;
            text-transform:uppercase;
        `;
    };

    document.querySelectorAll('.plan-filter-chip').forEach(chip => {
        applyStyle(chip, chip.dataset.plan === currentPlanFilter);

        chip.addEventListener('mouseenter', () => {
            if (chip.dataset.plan !== currentPlanFilter) chip.style.opacity = '0.75';
        });
        chip.addEventListener('mouseleave', () => { chip.style.opacity = '1'; });

        chip.addEventListener('click', () => {
            currentPlanFilter = chip.dataset.plan;
            document.querySelectorAll('.plan-filter-chip').forEach(c =>
                applyStyle(c, c.dataset.plan === currentPlanFilter)
            );
            applyAllFilters();
        });
    });
}

// ============================================
// CONSTRUIR: Chips de tags (dinámico)
// ============================================
function buildTagFilters() {
    const container = document.getElementById('tagFilters');
    if (!container) return;

    // Recolectar todos los tags únicos
    const allTags = new Map();
    conversations.forEach(c => {
        (c.tags || []).forEach(t => {
            if (t.label && !allTags.has(t.label)) {
                allTags.set(t.label, t.color || '#999');
            }
        });
    });

    if (allTags.size === 0) {
        container.innerHTML = '<span class="text-[10px] text-gray-300">Sin tags</span>';
        return;
    }

    container.innerHTML = '';

    allTags.forEach((color, label) => {
        const hex = mapTagColor(color);
        const btn = document.createElement('button');
        btn.className = 'tag-filter-chip';
        btn.style.cssText = `
            display:inline-flex;align-items:center;gap:4px;
            padding:2px 8px;border-radius:999px;font-size:10px;font-weight:600;
            border:1.5px solid ${hex};color:${hex};background:#fff;
            cursor:pointer;transition:background .15s,color .15s,transform .1s;
            white-space:nowrap;letter-spacing:0.01em;
        `;
        btn.textContent = label;
        btn.dataset.tag   = label;
        btn.dataset.color = hex;

        // Estado activo si ya estaba seleccionado
        if (currentTagFilters.includes(label)) {
            btn.style.background = hex;
            btn.style.color = '#fff';
        }

        btn.addEventListener('mouseenter', () => {
            if (!currentTagFilters.includes(label)) btn.style.opacity = '0.75';
        });
        btn.addEventListener('mouseleave', () => { btn.style.opacity = '1'; });

        btn.addEventListener('click', () => {
            const idx = currentTagFilters.indexOf(label);
            if (idx === -1) {
                currentTagFilters.push(label);
                btn.style.background = hex;
                btn.style.color = '#fff';
            } else {
                currentTagFilters.splice(idx, 1);
                btn.style.background = '#fff';
                btn.style.color = hex;
            }
            applyAllFilters();
        });

        container.appendChild(btn);
    });
}

// ============================================
// APLICAR TODOS LOS FILTROS (combinados)
// ============================================
function applyAllFilters() {
    const base = (window.conversacionesAPI && window.conversacionesAPI.getState)
        ? (window.conversacionesAPI.getState().conversations || [])
        : (typeof conversations !== "undefined" ? conversations : []);

    let filtered = [...base];

    // 1. Filtro rápido
    if (currentQuickFilter === 'unread') {
        filtered = filtered.filter(c => (c.unread || 0) > 0);
    } else if (currentQuickFilter === 'no_reply') {
        filtered = filtered.filter(c => c.has_unanswered === true);
    } else if (currentQuickFilter === 'ia_off') {
        filtered = filtered.filter(c => c.ia_enabled === false);
    }

    // 2. Filtro por plan
    if (currentPlanFilter) {
        filtered = filtered.filter(c => c.plan === currentPlanFilter);
    }

    // 3. Filtro por tags
    if (currentTagFilters.length > 0) {
        filtered = filtered.filter(c => {
            const convTagLabels = (c.tags || []).map(t => t.label);
            return currentTagFilters.some(tag => convTagLabels.includes(tag));
        });
    }

    // Renderizar SOLO lo filtrado
    renderConversations(filtered);

    // Actualizar contadores SIEMPRE desde base
    if (typeof window.updateFilterCounts === "function") {
        window.updateFilterCounts();
    }

    // Actualizar contador del footer (si existe)
    const counter = document.getElementById('conversationsCounter');
    if (counter) {
        if (filtered.length === base.length) {
            counter.textContent = `${base.length} conversaciones`;
        } else {
            counter.textContent = `${filtered.length} de ${base.length} conversaciones`;
        }
    }

    // Mostrar/ocultar botón limpiar
    const clearBtn = document.getElementById('clearAdvancedFilters');
    if (clearBtn) {
        if (currentPlanFilter || currentTagFilters.length > 0) {
            clearBtn.classList.remove('hidden');
        } else {
            clearBtn.classList.add('hidden');
        }
    }
}

function applyConversationFilter(filter) {
    currentQuickFilter = filter;
    applyAllFilters();
}

// ============================================
// ACTUALIZAR CONTADORES
// ============================================
function updateFilterCounts() {
    const base = (window.conversacionesAPI && window.conversacionesAPI.getState)
        ? (window.conversacionesAPI.getState().conversations || [])
        : (typeof conversations !== "undefined" ? conversations : []);

    const counts = {
        all:      base.length,
        unread:   base.filter(c => (c.unread || 0) > 0).length,
        no_reply: base.filter(c => c.has_unanswered === true).length,
        ia_off:   base.filter(c => c.ia_enabled === false).length
    };

    document.querySelectorAll('.filter-chip').forEach(chip => {
        const countEl = chip.querySelector('.filter-count');
        if (countEl && counts[chip.dataset.filter] !== undefined) {
            countEl.textContent = counts[chip.dataset.filter];
        }
    });
}


// ============================================
// TOGGLE PANEL AVANZADO
// ============================================
function toggleAdvancedFilters() {
    const companyId = document.getElementById('conversacionesCompanyFilter')?.value;
    if (!companyId) return;

    const panel = document.getElementById('advancedFiltersPanel');
    const icon  = document.getElementById('advancedFiltersIcon');
    if (!panel) return;

    const isOpen = panel.classList.contains('rp-open') ||
        (panel.style.display !== 'none' && !panel.classList.contains('hidden'));

    // Quitar hidden de Tailwind si quedó del HTML original
    panel.classList.remove('hidden');

    if (typeof rpSlide === 'function') {
        rpSlide(panel, !isOpen);
    } else {
        panel.style.display = isOpen ? 'none' : 'block';
    }

    if (icon) icon.style.transform = isOpen ? '' : 'rotate(180deg)';

    if (!isOpen) buildTagFilters();
}

// ============================================
// LIMPIAR FILTROS AVANZADOS
// ============================================
function clearAdvancedFilters() {
    currentPlanFilter = '';
    currentTagFilters = [];
    setupPlanFilters();
    buildTagFilters();
    applyAllFilters();
}

// ============================================
// BÚSQUEDA DE CONVERSACIONES
// ============================================
function filterConversations(searchTerm) {
    if (!searchTerm || searchTerm.trim() === '') {
        renderConversations();
        return;
    }

    const term = searchTerm.toLowerCase().trim();
    const filtered = conversations.filter(conv =>
        (conv.name && conv.name.toLowerCase().includes(term)) ||
        (conv.phone && conv.phone.includes(term)) ||
        (conv.lastMessage && conv.lastMessage.toLowerCase().includes(term))
    );

    const original = conversations;
    conversations = filtered;
    renderConversations();
    conversations = original;
}

// Exponer globales
window.toggleAdvancedFilters = toggleAdvancedFilters;
window.clearAdvancedFilters = clearAdvancedFilters;
window.updateFilterCounts = updateFilterCounts;

// ── Inyectar estilos panel izquierdo ─────────────────────────────────────────
(function _injectLeftPanelStyles() {
    if (document.getElementById('_leftPanelStyles')) return;
    const s = document.createElement('style');
    s.id = '_leftPanelStyles';
    s.textContent = `
        /* ── Filtros avanzados panel ── */
        #advancedFiltersPanel {
            overflow: hidden;
        }

        /* ── Botón filtros avanzados ── */
        #advancedFiltersToggle {
            transition: background .15s, border-color .15s;
        }

        /* ── TAG chips ── */
        .tag-filter-chip {
            transition: background .15s, color .15s, opacity .15s, transform .1s !important;
        }
        .tag-filter-chip:active { transform: scale(0.95); }

        /* ── PLAN chips ── */
        .plan-filter-chip:active { transform: scale(0.95); }

        /* ── Dropdown empresa ── */
        #companyDropdownList {
            transition: opacity 0.18s ease, transform 0.18s ease;
        }

        /* ── Buscador focus glow ── */
        #searchConversations:focus {
            border-color: #7D84C1 !important;
            box-shadow: 0 0 0 2px #C9D9FF !important;
        }
    `;
    document.head.appendChild(s);
})();