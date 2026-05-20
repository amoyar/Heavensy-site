// ── CHIPS DE SERVICIO — MODAL NUEVA HORA ──
// Archivo separado para no modificar calendario.js

const _SVC_PALETTE = [
  { bg:'#f0eeff', border:'#ddd8fc', selBg:'#C9C2F9', selBorder:'#b0a8f5' },
  { bg:'#edf3fc', border:'#ccdaf5', selBg:'#B8CEF0', selBorder:'#9ab8e8' },
  { bg:'#eef8f3', border:'#c5e8d5', selBg:'#CEEBDA', selBorder:'#a8d9be' },
  { bg:'#fdf8ec', border:'#f5e8bc', selBg:'#F7DDA0', selBorder:'#f0cc7a' },
  { bg:'#fdf0f0', border:'#f5cccc', selBg:'#F5BCBC', selBorder:'#e89898' },
  { bg:'#edf7f9', border:'#bfe0e6', selBg:'#A1CED6', selBorder:'#7fb8c2' },
];

function _calRenderSvcChips() {
  const container = document.getElementById('appt-service-chips');
  if (!container) return;

  // Limpiar selección previa
  const hidden = document.getElementById('appt-service');
  if (hidden) hidden.value = '';

  // Leer servicios de localStorage
  let servicios = [];
  try {
    const raw = localStorage.getItem('ep_servicios');
    if (raw) servicios = JSON.parse(raw);
  } catch(e) {}

  if (!servicios.length) {
    container.innerHTML = '<span style="font-size:12px;color:#9ca3af;padding:4px 0;display:block">No hay servicios. Créalos en Configuración → paso 4</span>';
    return;
  }

  container.innerHTML = servicios.map((svc, i) => {
    const c   = _SVC_PALETTE[i % _SVC_PALETTE.length];
    const dur = (svc.meta || '').match(/(\d+)\s*min/)?.[1];
    return `<div class="svc-chip"
      data-idx="${i}"
      data-name="${svc.nombre}"
      data-bg="${c.bg}" data-border="${c.border}"
      data-sel-bg="${c.selBg}" data-sel-border="${c.selBorder}"
      style="background:${c.bg};border-color:${c.border}"
      onclick="_calSelSvcChip(this)">
      <span class="svc-chip-name">${svc.nombre}</span>
      ${dur ? `<span class="svc-chip-dur">${dur} min</span>` : ''}
    </div>`;
  }).join('');
}

function _calSelSvcChip(el) {
  // Deseleccionar todos
  document.querySelectorAll('#appt-service-chips .svc-chip').forEach(c => {
    c.style.background   = c.dataset.bg;
    c.style.borderColor  = c.dataset.border;
    c.style.boxShadow    = '';
    c.classList.remove('svc-chip-sel');
  });

  // Seleccionar el clickeado
  el.style.background  = el.dataset.selBg;
  el.style.borderColor = el.dataset.selBorder;
  el.style.boxShadow   = '0 2px 8px rgba(0,0,0,.12)';
  el.classList.add('svc-chip-sel');

  // Escribir valor en el hidden input
  const hidden = document.getElementById('appt-service');
  if (hidden) hidden.value = el.dataset.name;

  // Disparar lógica existente de cambio de servicio
  if (typeof calModalOnServiceChange === 'function') calModalOnServiceChange();
}
