// ── CHIPS DE PROFESIONALES — FILTRO DE CALENDARIO ──
// Archivo separado para no modificar calendario.js
//
// ── BITÁCORA ──
// [v2026.06.16-1] prof-chips.js
// 2026-06-16 | Fix: la barra de filtros (cal-prof-bar) solo se mostraba con MÁS de
//              1 profesional (calResources.length <= 1 la ocultaba), así que una
//              empresa con un único recurso no veía su chip en el calendario.
//              Ahora se muestra con al menos 1 (< 1 oculta). Esta función sobrescribe
//              la de calendario.js (se carga después en index.html).

const _PROF_COLORS = [
  '#9961FF','#3b82f6','#10b981','#f59e0b','#ef4444',
  '#8b5cf6','#06b6d4','#f97316','#84cc16','#ec4899',
];

function _calRenderProfChips() {
  const bar    = document.getElementById('cal-prof-bar');
  const wrap   = document.getElementById('cal-prof-chips');
  if (!bar || !wrap) return;

  // Mostrar si hay al menos 1 profesional (antes pedía más de 1, lo que ocultaba
  // la barra cuando la empresa tenía un único recurso). [16-06]
  if (!calResources || calResources.length < 1) {
    bar.style.display = 'none';
    return;
  }

  bar.style.display = 'flex';

  // Chip "Todos"
  let html = `<div class="prof-chip prof-chip-sel" data-id="" onclick="_calSelProfChip(this)">
    <span class="prof-chip-dot" style="background:#9BA3C0"></span>
    <span class="prof-chip-name">Todos</span>
  </div>`;

  // Filtrar profesionales por servicio activo
  const _visibleProfIds = calSvcFilter
    ? new Set(Object.values(calServiceMap)
        .filter(s => s._id === calSvcFilter ||
          Object.entries(calServiceMap).some(([id,sv]) => id === calSvcFilter && sv.name === s.name))
        .map(s => s.resource_id))
    : null;

  calResources.filter(r => !_visibleProfIds || _visibleProfIds.has(r._id)).forEach((r, i) => {
    const color = _PROF_COLORS[i % _PROF_COLORS.length];
    html += `<div class="prof-chip" data-id="${r._id}" data-name="${r.name.toLowerCase()}"
               onclick="_calSelProfChip(this)">
      <span class="prof-chip-dot" style="background:${color}"></span>
      <span class="prof-chip-name">${r.name}</span>
    </div>`;
  });

  wrap.innerHTML = html;
  _calUpdateCrearHoraBtn();
}

function _calUpdateCrearHoraBtn() {
  const multiPro = calResources && calResources.length > 1;
  const blocked  = multiPro && !calProfFilter;

  const applyBlock = (btn, title, restoreStyle) => {
    if (!btn) return;
    btn.disabled = blocked;
    btn.title    = blocked ? title : '';
    if (blocked) {
      btn.style.background = '#e5e7eb';
      btn.style.color      = '#9ca3af';
      btn.style.border     = '1px solid #d1d5db';
      btn.style.cursor     = 'not-allowed';
    } else {
      btn.style.background = restoreStyle.background || '';
      btn.style.color      = restoreStyle.color      || '';
      btn.style.border     = restoreStyle.border     || '';
      btn.style.cursor     = '';
    }
  };

applyBlock(document.getElementById('btn-bloques'), 'Selecciona un profesional para crear bloques masivos',
    { background: '#9961FF', color: '#fff', border: 'none' });
}

function _calSelProfChip(el) {
  document.querySelectorAll('#cal-prof-chips .prof-chip').forEach(c => c.classList.remove('prof-chip-sel'));
  el.classList.add('prof-chip-sel');
  calProfFilter = el.dataset.id || null;
  _calUpdateCrearHoraBtn();
  calRender();
  if (document.getElementById('exc-panel')?.classList.contains('open')) calRenderExcList();
}

function _calProfSearch(q) {
  const term = q.toLowerCase().trim();
  document.querySelectorAll('#cal-prof-chips .prof-chip').forEach(chip => {
    if (!chip.dataset.id) { chip.style.display = ''; return; } // "Todos" siempre visible
    chip.style.display = (!term || chip.dataset.name.includes(term)) ? '' : 'none';
  });
}