// busqueda_heavensy.js — generado desde cero

function busqToggleAcc(h) {
  h.closest('.busq-acc-item').classList.toggle('open');
}

function busqAplicarFiltros() {
  const cat    = document.querySelector('.busq-chip.on')?.dataset.cat || 'todos';
  const mods   = [...document.querySelectorAll('input[name="busqMod"]:checked')].map(i => i.value);
  const rating = parseFloat(document.querySelector('input[name="busqRating"]:checked')?.value || 0);
  const q      = document.getElementById('busqInput')?.value.toLowerCase().trim() || '';

  let v = 0;
  document.querySelectorAll('.busq-card').forEach(c => {
    const ok = (cat === 'todos' || c.dataset.cat === cat) &&
               (mods.length === 0 || (c.dataset.mod || '').split(',').some(m => mods.includes(m))) &&
               parseFloat(c.dataset.rating || 0) >= rating &&
               (!q || c.innerText.toLowerCase().includes(q));
    c.style.display = ok ? '' : 'none';
    if (ok) v++;
  });

  const el = document.getElementById('busqCount');
  if (el) el.textContent = v;
}

function busqUpdatePrecio(v) {
  const label = document.getElementById('busqPrecioLabel');
  if (label) label.textContent = parseInt(v) >= 200000 ? 'Sin límite' : '$' + parseInt(v).toLocaleString('es-CL');
  busqAplicarFiltros();
}

function busqLimpiar() {
  document.querySelectorAll('.busq-chip').forEach((c, i) => c.classList.toggle('on', i === 0));
  document.querySelectorAll('input[name="busqMod"]').forEach(i => i.checked = true);
  const r0 = document.querySelector('input[name="busqRating"][value="0"]');
  const d0 = document.querySelector('input[name="busqDisp"][value="cualquiera"]');
  if (r0) r0.checked = true;
  if (d0) d0.checked = true;
  const pr = document.getElementById('busqPrecioRange');
  if (pr) pr.value = 200000;
  const pl = document.getElementById('busqPrecioLabel');
  if (pl) pl.textContent = 'Sin límite';
  const sp = document.getElementById('busqPais');
  const sc = document.getElementById('busqCiudad');
  if (sp) sp.value = 'cl';
  if (sc) sc.value = '';
  const si = document.getElementById('busqInput');
  if (si) si.value = '';
  busqAplicarFiltros();
}

function busqBuscar() { busqAplicarFiltros(); }

function busqBuildCard(r) {
  const nombre   = r.name || r.full_name || 'Profesional';
  const initials = nombre.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  const photo    = r.photo_url || r.avatar_url || '';
  const specs    = (r.specialties || r.especialidades || []).slice(0, 3);
  const slogan   = r.slogan || r.description || '';
  const mods     = (r.modalities || r.modalidades || []).map(m => m.charAt(0).toUpperCase() + m.slice(1)).join(', ');
  const modData  = (r.modalities || r.modalidades || []).join(',');
  const cat      = r.category || r.categoria || 'otros';
  const rating   = r.rating ? r.rating.toFixed(1) : '';
  const loc      = r.location || r.address || r.direccion || '';
  const dur      = r.video_duration || r.duracion_video || '';
  const id       = r._id || r.id || '';
  const href     = id ? `pages/perfil_profesional.html?resource_id=${id}` : '#';

  return `<div class="busq-card" data-cat="${cat}" data-mod="${modData}" data-rating="${r.rating || 0}" onclick="window.location.href='${href}'">
    <div class="busq-avatar">
      ${photo ? `<img src="${photo}" alt="${nombre}" onerror="this.style.display='none'">` : initials}
    </div>
    <div class="busq-info">
      <div class="busq-top-row">
        <span class="busq-pname">${nombre}</span>
        ${rating ? `<span class="busq-rating"><span class="busq-stars">★</span> ${rating}</span>` : ''}
      </div>
      ${slogan ? `<div class="busq-eslogan">${slogan}</div>` : ''}
      ${specs.length ? `<div class="busq-tags">${specs.map(s => `<span class="busq-tag">${s}</span>`).join('')}</div>` : ''}
      ${mods ? `<div class="busq-mod">${mods}</div>` : ''}
      ${loc ? `<div class="busq-loc"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg> ${loc}</div>` : ''}
    </div>
    <div class="busq-vid">
      <div class="busq-play"><svg width="14" height="14" viewBox="0 0 24 24" fill="#355BB6"><polygon points="5,3 19,12 5,21"/></svg></div>
      ${dur ? `<span class="busq-vid-dur">${dur}</span>` : ''}
    </div>
  </div>`;
}

async function initBusqueda_heavensyPage() {
  // Chips
  document.querySelectorAll('.busq-chip').forEach(c => {
    c.addEventListener('click', () => {
      document.querySelectorAll('.busq-chip').forEach(x => x.classList.remove('on'));
      c.classList.add('on');
      busqAplicarFiltros();
    });
  });

  // Inputs
  document.querySelectorAll('input[name="busqMod"], input[name="busqDisp"], input[name="busqRating"]')
    .forEach(i => i.addEventListener('change', busqAplicarFiltros));

  ['busqPais','busqCiudad'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', busqAplicarFiltros);
  });

  const busqInput = document.getElementById('busqInput');
  if (busqInput) busqInput.addEventListener('input', busqAplicarFiltros);

  // Paginación
  document.querySelectorAll('.busq-pag-btn').forEach(b => {
    b.addEventListener('click', () => {
      document.querySelectorAll('.busq-pag-btn').forEach(x => x.classList.remove('on'));
      b.classList.add('on');
    });
  });

  // Aplicar filtros sobre cards demo
  busqAplicarFiltros();

  // Intentar cargar desde API
  try {
    const res = await apiCall('/api/agenda/resources');
    if (!res.ok || !res.data?.resources?.length) return;

    const container = document.getElementById('busqCards');
    if (!container) return;
    container.innerHTML = res.data.resources.map(busqBuildCard).join('');
    const el = document.getElementById('busqCount');
    if (el) el.textContent = res.data.resources.length;
    busqAplicarFiltros();
  } catch(e) {
    console.warn('[Busqueda] API no disponible, mostrando demo');
  }
}