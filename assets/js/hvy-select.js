// ============================================
// HVY-SELECT — dropdowns estilo Heavensy
// Convierte <select> nativos en dropdowns custom manteniendo el select
// oculto como fuente de verdad: .value y los onchange existentes siguen
// funcionando (se despacha el evento 'change' real al elegir).
// ============================================
// ── BITÁCORA ──
// 2026-06-04 | Ajustes: font 13px en el botón (igual que las opciones) y ancho
//              estable calculado según la opción más larga (no salta al elegir).
// 2026-06-04 | Primera versión. Uso: hvySelectifyAll(['id1','id2']) tras
//              montar la página. Idempotente (ignora selects ya convertidos).
//              El panel se construye al abrir, leyendo las <option> vivas:
//              si el select se re-puebla dinámicamente, nunca desincroniza.

(function () {
  'use strict';

  const STYLE_ID = 'hvy-select-styles';

  function _injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const css = `
      .hvy-select-wrap { position: relative; display: inline-block; }
      .hvy-select-btn {
        display: inline-flex; align-items: center; justify-content: space-between;
        gap: 10px; background: #fff; cursor: pointer; text-align: left;
        font-size: 13px; color: #374151; white-space: nowrap;
        background-image: none !important;
        -webkit-appearance: none; appearance: none;
      }
      .hvy-select-btn .hvy-select-chev {
        font-size: 10px; color: #9BA3C0; transition: transform .18s; flex-shrink: 0;
      }
      .hvy-select-wrap.open .hvy-select-chev { transform: rotate(180deg); }
      .hvy-select-panel {
        display: none; position: absolute; top: calc(100% + 6px); left: 0;
        min-width: 100%; z-index: 90; background: #fff;
        border: 1px solid #e5e7eb; border-radius: 12px;
        box-shadow: 0 8px 24px rgba(31, 41, 55, .14);
        overflow: hidden; padding: 6px;
      }
      .hvy-select-wrap.open .hvy-select-panel { display: block; }
      .hvy-select-opt {
        display: flex; align-items: center; justify-content: space-between; gap: 10px;
        width: 100%; border: none; background: #fff; cursor: pointer; text-align: left;
        font-size: 13px; color: #374151; padding: 9px 12px; border-radius: 8px;
        white-space: nowrap;
      }
      .hvy-select-opt:hover { background: #f5f3ff; }
      .hvy-select-opt.active { background: #f5f3ff; color: #7a52d4; font-weight: 600; }
      .hvy-select-opt .hvy-select-check { font-size: 11px; color: #9961FF; }
    `;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = css;
    document.head.appendChild(style);
  }

  // Cierre global: un solo listener para todos los dropdowns
  let _globalCloseBound = false;
  function _bindGlobalClose() {
    if (_globalCloseBound) return;
    _globalCloseBound = true;
    document.addEventListener('click', (e) => {
      document.querySelectorAll('.hvy-select-wrap.open').forEach(w => {
        if (!w.contains(e.target)) w.classList.remove('open');
      });
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.hvy-select-wrap.open').forEach(w => w.classList.remove('open'));
      }
    });
  }

  function _labelOf(select) {
    const opt = select.options[select.selectedIndex];
    return opt ? opt.textContent : '';
  }

  function hvySelectify(select) {
    if (!select || select.dataset.hvySelect === '1') return;
    select.dataset.hvySelect = '1';

    _injectStyles();
    _bindGlobalClose();

    const wrap = document.createElement('div');
    wrap.className = 'hvy-select-wrap';

    // El botón hereda la clase visual del select (filter-select, u-filter-select…)
    // para verse igual que hoy cuando está cerrado.
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = select.className + ' hvy-select-btn';
    btn.innerHTML = '<span class="hvy-select-label"></span><i class="fas fa-chevron-down hvy-select-chev"></i>';

    const panel = document.createElement('div');
    panel.className = 'hvy-select-panel';

    select.parentNode.insertBefore(wrap, select);
    wrap.appendChild(btn);
    wrap.appendChild(panel);
    wrap.appendChild(select);
    select.style.display = 'none';

    const labelEl = btn.querySelector('.hvy-select-label');
    const syncLabel = () => { labelEl.textContent = _labelOf(select); };
    syncLabel();

    // Ancho estable: el de la opción más larga (no cambia al seleccionar)
    function fixWidth() {
      try {
        const cs = getComputedStyle(btn);
        const ghost = document.createElement('span');
        ghost.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;' +
          `font:${cs.font};`;
        document.body.appendChild(ghost);
        let maxW = 0;
        Array.from(select.options).forEach(opt => {
          ghost.textContent = opt.textContent;
          maxW = Math.max(maxW, ghost.offsetWidth);
        });
        ghost.remove();
        const extra = parseFloat(cs.paddingLeft || 0) + parseFloat(cs.paddingRight || 0)
                    + 10 /* gap */ + 12 /* chevron */ + 2 /* bordes */;
        btn.style.minWidth = Math.ceil(maxW + extra) + 'px';
      } catch {}
    }
    fixWidth();

    // Panel construido al abrir, desde las <option> vivas del select
    function buildPanel() {
      panel.innerHTML = '';
      Array.from(select.options).forEach(opt => {
        const item = document.createElement('button');
        item.type = 'button';
        const active = opt.value === select.value;
        item.className = 'hvy-select-opt' + (active ? ' active' : '');
        item.innerHTML = '<span></span>' + (active ? '<i class="fas fa-check hvy-select-check"></i>' : '');
        item.querySelector('span').textContent = opt.textContent;
        item.addEventListener('click', () => {
          select.value = opt.value;
          syncLabel();
          wrap.classList.remove('open');
          // Dispara los onchange existentes (inline o addEventListener)
          select.dispatchEvent(new Event('change', { bubbles: true }));
        });
        panel.appendChild(item);
      });
    }

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const willOpen = !wrap.classList.contains('open');
      // Cerrar otros abiertos
      document.querySelectorAll('.hvy-select-wrap.open').forEach(w => w.classList.remove('open'));
      if (willOpen) {
        buildPanel();
        fixWidth();
        wrap.classList.add('open');
      }
    });

    // Si otro código cambia el select por JS, reflejarlo en el botón
    select.addEventListener('change', syncLabel);
  }

  function hvySelectifyAll(ids) {
    (ids || []).forEach(id => {
      const el = typeof id === 'string' ? document.getElementById(id) : id;
      if (el && el.tagName === 'SELECT') hvySelectify(el);
    });
  }

  window.hvySelectify = hvySelectify;
  window.hvySelectifyAll = hvySelectifyAll;
})();