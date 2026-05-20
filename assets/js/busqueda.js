// ══════════════════════════════════════
//  BÚSQUEDA DE SERVICIOS — HEAVENSY
// ══════════════════════════════════════

function toggleAcc(h) {
  h.closest('.acc-item').classList.toggle('open');
}

function aplicarFiltros() {
  const cat    = document.querySelector('.busq-page .chip.on')?.dataset.cat || 'todos';
  const mods   = [...document.querySelectorAll('.busq-page input[name="mod"]:checked')].map(i => i.value);
  const rating = parseFloat(document.querySelector('.busq-page input[name="rating"]:checked')?.value || 0);
  const q      = document.getElementById('busqInput')?.value.toLowerCase().trim() || '';

  let visible = 0;
  document.querySelectorAll('.busq-page .card').forEach(c => {
    const catOk    = cat === 'todos' || c.dataset.cat === cat;
    const modOk    = mods.length === 0 || (c.dataset.mod || '').split(',').some(m => mods.includes(m));
    const ratingOk = parseFloat(c.dataset.rating || 0) >= rating;
    const qOk      = !q || c.innerText.toLowerCase().includes(q);
    const show     = catOk && modOk && ratingOk && qOk;
    c.style.display = show ? '' : 'none';
    if (show) visible++;
  });

  const countEl = document.getElementById('busqCount');
  if (countEl) countEl.textContent = visible;
}

function updatePrecio(v) {
  const label = document.getElementById('busqPrecioLabel');
  if (label) label.textContent = parseInt(v) >= 200000 ? 'Sin límite' : '$' + parseInt(v).toLocaleString('es-CL');
  aplicarFiltros();
}

function limpiarFiltros() {
  document.querySelectorAll('.busq-page .chip').forEach((c, i) => c.classList.toggle('on', i === 0));
  document.querySelectorAll('.busq-page input[name="mod"]').forEach(i => i.checked = true);
  const r0 = document.querySelector('.busq-page input[name="rating"][value="0"]');
  const d0 = document.querySelector('.busq-page input[name="disp"][value="cualquiera"]');
  if (r0) r0.checked = true;
  if (d0) d0.checked = true;
  const precioRange = document.getElementById('busqPrecioRange');
  if (precioRange) precioRange.value = 200000;
  const label = document.getElementById('busqPrecioLabel');
  if (label) label.textContent = 'Sin límite';
  const selPais = document.getElementById('busqPais');
  const selCiudad = document.getElementById('busqCiudad');
  if (selPais)   selPais.value = 'cl';
  if (selCiudad) selCiudad.value = '';
  const busqInput = document.getElementById('busqInput');
  if (busqInput) busqInput.value = '';
  aplicarFiltros();
}

function buscar() {
  aplicarFiltros();
}

// ── RENDER ──
function busqBuildCard(r) {
  const nombre    = r.name || r.full_name || 'Profesional';
  const initials  = nombre.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  const specs     = r.specialties || r.especialidades || [];
  const tagsHtml  = specs.slice(0, 3).map(s => `<span class="tag tag-esp">${s}</span>`).join('');
  const mods      = r.modalities || r.modalidades || ['presencial'];
  const modLabel  = mods.map(m => m.charAt(0).toUpperCase() + m.slice(1)).join(', ');
  const modData   = mods.join(',');
  const cat       = r.category || r.categoria || 'otros';
  const rating    = r.rating ? r.rating.toFixed(1) : null;
  const slogan    = r.slogan || r.description || '';
  const location  = r.location || r.address || r.direccion || '';
  const photo     = r.photo_url || r.avatar_url || r.foto || '';

  const avatarHtml = photo
    ? `<img src="${photo}" alt="${nombre}" onerror="this.style.display='none';this.nextSibling.style.display='flex'">`
    : '';

  const videoDur = r.video_duration || r.duracion_video || '';

  const resourceId = r._id || r.id || '';
  const profileUrl = resourceId ? `pages/perfil_profesional.html?resource_id=${resourceId}` : '';
  return `<div class="card" data-cat="${cat}" data-mod="${modData}" data-rating="${r.rating || 0}"${resourceId ? ` onclick="window.location.href='${profileUrl}'" style="cursor:pointer"` : ''}>
    <div class="avatar">${avatarHtml}${!photo ? initials : `<span style="display:none;align-items:center;justify-content:center;width:100%;height:100%">${initials}</span>`}</div>
    <div class="info">
      <div class="top-row">
        <span class="pname">${nombre}</span>
        ${rating ? `<span class="rating"><span class="stars">★</span> ${rating}</span>` : ''}
      </div>
      ${slogan ? `<div class="eslogan">${slogan}</div>` : ''}
      ${tagsHtml ? `<div class="tags">${tagsHtml}</div>` : ''}
      <div class="modalidad-txt">${modLabel}</div>
      ${location ? `<div class="loc"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg> ${location}</div>` : ''}
    </div>
    <div class="vid">
      <div class="play">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="#355BB6"><polygon points="5,3 19,12 5,21"/></svg>
      </div>
      ${videoDur ? `<span class="vid-dur">${videoDur}</span>` : ''}
    </div>
  </div>`;
}

function busqRenderCards(resources) {
  const container = document.getElementById('busqCards');
  const countEl   = document.getElementById('busqCount');
  if (!container) return;

  if (!resources || !resources.length) {
    container.innerHTML = `<div style="padding:40px;text-align:center;color:#7D84C1;font-size:14px">
      <i class="fas fa-users" style="font-size:32px;margin-bottom:12px;display:block;opacity:.3"></i>
      No se encontraron profesionales
    </div>`;
    if (countEl) countEl.textContent = 0;
    return;
  }

  container.innerHTML = resources.map(busqBuildCard).join('');
  if (countEl) countEl.textContent = resources.length;
  aplicarFiltros();
}

async function busqLoadResources() {
  const container = document.getElementById('busqCards');
  if (!container) return;

  container.innerHTML = `<div style="padding:40px;text-align:center;color:#7D84C1;font-size:14px">
    <i class="fas fa-spinner fa-spin" style="font-size:24px;margin-bottom:10px;display:block"></i>
    Cargando profesionales…
  </div>`;

  try {
    const res = await apiCall('/api/agenda/resources');
    if (res.ok && res.data?.resources?.length) {
      busqRenderCards(res.data.resources);
    } else {
      busqRenderCards([]);
    }
  } catch(e) {
    console.warn('[Busqueda] Error cargando recursos', e);
    busqRenderCards([]);
  }
}

function initBusquedaPage() {
  // Chips de categoría
  document.querySelectorAll('.busq-page .chip').forEach(c => {
    c.addEventListener('click', () => {
      document.querySelectorAll('.busq-page .chip').forEach(x => x.classList.remove('on'));
      c.classList.add('on');
      aplicarFiltros();
    });
  });

  // Filtros checkbox / radio
  document.querySelectorAll('.busq-page input[name="mod"], .busq-page input[name="disp"], .busq-page input[name="rating"]')
    .forEach(i => i.addEventListener('change', aplicarFiltros));

  // Selectores
  ['busqPais', 'busqCiudad'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', aplicarFiltros);
  });

  // Search input
  const busqInput = document.getElementById('busqInput');
  if (busqInput) busqInput.addEventListener('input', aplicarFiltros);

  // Paginación
  document.querySelectorAll('.busq-page .pag-btn').forEach(b => {
    b.addEventListener('click', () => {
      document.querySelectorAll('.busq-page .pag-btn').forEach(x => x.classList.remove('on'));
      b.classList.add('on');
    });
  });

  // Cargar profesionales desde el backend
  busqLoadResources();
}
