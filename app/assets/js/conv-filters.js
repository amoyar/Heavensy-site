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
            chips.forEach(c => c.classList.remove("active"));
            chip.classList.add("active");

            const filter = chip.dataset.filter;
            console.log("🔎 Filtro seleccionado:", filter);

            currentQuickFilter = filter;
            applyAllFilters();
        });
    });
}

// ============================================
// SETUP: Filtros de plan
// ============================================
function setupPlanFilters() {
    document.querySelectorAll('.plan-filter-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            currentPlanFilter = chip.dataset.plan;

            document.querySelectorAll('.plan-filter-chip').forEach(c => {
                c.className = 'plan-filter-chip px-2 py-0.5 rounded-full text-[10px] bg-white text-gray-500 border border-gray-200 hover:bg-gray-100 transition-all';
            });
            chip.className = 'plan-filter-chip px-2 py-0.5 rounded-full text-[10px] bg-purple-100 text-purple-700 font-semibold transition-all';

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
        const btn = document.createElement('button');
        btn.className = 'tag-filter-chip px-2 py-0.5 rounded-full text-[10px] transition-all border bg-white text-gray-600 hover:opacity-80';
        btn.style.borderColor = color;
        btn.textContent = label;
        btn.dataset.tag = label;
        btn.dataset.color = color;

        // ✅ Restaurar estado visual si este tag ya estaba activo
        if (currentTagFilters.includes(label)) {
            btn.style.background = color;
            btn.style.color = 'white';
            btn.classList.add('font-semibold');
        }

        btn.addEventListener('click', () => {
            const idx = currentTagFilters.indexOf(label);
            if (idx === -1) {
                currentTagFilters.push(label);
                btn.style.background = color;
                btn.style.color = 'white';
                btn.classList.add('font-semibold');
            } else {
                currentTagFilters.splice(idx, 1);
                btn.style.background = 'white';
                btn.style.color = '#4b5563';
                btn.classList.remove('font-semibold');
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
    // Siempre contar desde la fuente de verdad
    const base = (window.conversacionesAPI && window.conversacionesAPI.getState)
        ? (window.conversacionesAPI.getState().conversations || [])
        : (typeof conversations !== "undefined" ? conversations : []);

    const counts = {
        all: base.length,
        unread: base.filter(c => (c.unread || 0) > 0).length,
        no_reply: base.filter(c => c.has_unanswered === true).length,
        ia_off: base.filter(c => c.ia_enabled === false).length
    };

    console.log('📊 Contadores filtros:', counts);

    document.querySelectorAll('.filter-chip').forEach(chip => {
        const filter = chip.dataset.filter;
        const countEl = chip.querySelector('.filter-count');
        if (countEl && counts[filter] !== undefined) {
            countEl.textContent = counts[filter];
        }
    });
}


// ============================================
// TOGGLE PANEL AVANZADO
// ============================================
function toggleAdvancedFilters() {
    const panel = document.getElementById('advancedFiltersPanel');
    const icon = document.getElementById('advancedFiltersIcon');
    if (!panel) return;

    panel.classList.toggle('hidden');
    if (icon) icon.style.transform = panel.classList.contains('hidden') ? '' : 'rotate(180deg)';
}

// ============================================
// LIMPIAR FILTROS AVANZADOS
// ============================================
function clearAdvancedFilters() {
    currentPlanFilter = '';
    currentTagFilters = [];

    // Reset plan chips
    document.querySelectorAll('.plan-filter-chip').forEach((c, i) => {
        if (i === 0) {
            c.className = 'plan-filter-chip px-2 py-0.5 rounded-full text-[10px] bg-purple-100 text-purple-700 font-semibold transition-all';
        } else {
            c.className = 'plan-filter-chip px-2 py-0.5 rounded-full text-[10px] bg-white text-gray-500 border border-gray-200 hover:bg-gray-100 transition-all';
        }
    });

    // Reset tag chips
    document.querySelectorAll('.tag-filter-chip').forEach(c => {
        c.style.background = 'white';
        c.style.color = '#4b5563';
        c.classList.remove('font-semibold');
    });

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