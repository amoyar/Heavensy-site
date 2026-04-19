/* ═══════════════════════════════════════════════════════
   SEGUIMIENTO — seg-panels.js
   Toggle paneles izquierdo/derecho, filtro por etiquetas, segToggleLeftPanel/RightPanel/SidePanel.
═══════════════════════════════════════════════════════ */

var SEG_LEFT_OPEN  = true;
var SEG_RIGHT_OPEN = true;
var SEG_ETIQUETAS_PANEL_OPEN = true;

/* ── Panel etiquetas activas — colapsar/expandir ── */
function segToggleEtiquetasPanel() {
  SEG_ETIQUETAS_PANEL_OPEN = !SEG_ETIQUETAS_PANEL_OPEN;
  var body = document.getElementById('seg-lp-etiquetas-body');
  var chev = document.getElementById('seg-lp-etiquetas-chev');
  if (body) body.classList.toggle('collapsed', !SEG_ETIQUETAS_PANEL_OPEN);
  if (chev) chev.classList.toggle('collapsed', !SEG_ETIQUETAS_PANEL_OPEN);
}

/* ── Filtrar lista de pacientes por etiqueta (acumulativo) ── */
function segFiltrarPorEtiqueta(nombre) {
  var idx = SEG._etiquetaFiltro.indexOf(nombre);
  if (idx !== -1) {
    SEG._etiquetaFiltro.splice(idx, 1); // quitar si ya estaba
  } else {
    SEG._etiquetaFiltro.push(nombre);   // agregar si no estaba
  }
  segAplicarFiltroEtiquetas();
}

function segLimpiarFiltroEtiquetas() {
  SEG._etiquetaFiltro = [];
  segAplicarFiltroEtiquetas();
}

function segAplicarFiltroEtiquetas() {
  // Re-renderizar chips del panel de filtro
  segRenderizarEtiquetasActivas([], SEG.labels);

  // Filtrar entidades
  var lista = SEG._etiquetaFiltro.length === 0
    ? (SEG.hayTodas || [])
    : (SEG.hayTodas || []).filter(function(e) {
        var ets = (e.etiquetas || []).map(function(x) {
          return typeof x === 'string' ? x : (x.nombre || '');
        });
        return SEG._etiquetaFiltro.every(function(f) {
          return ets.indexOf(f) !== -1;
        });
      });

  SEG.hayEntidades = lista;
  segRenderizarLista(lista);
}

function segMostrarBtnColapsarIzquierdo(visible) {
  // Botón siempre visible — no ocultar
}

function segToggleLeftPanel() {
  SEG_LEFT_OPEN = !SEG_LEFT_OPEN;
  var lp      = document.querySelector('.seg-left-panel');
  var tabExp  = document.getElementById('seg-btn-expand-left');

  if (lp)     lp.classList.toggle('panel-hidden', !SEG_LEFT_OPEN);
  if (tabExp) tabExp.classList.toggle('seg-hidden', SEG_LEFT_OPEN);
}

function segToggleRightPanel() {
  // Eliminado — los paneles del lado derecho se colapsan individualmente
}


var SEG_PANELS = { historial: true, etiquetas: true, plantillas: true };

function segToggleSidePanel(nombre) {
  SEG_PANELS[nombre] = !SEG_PANELS[nombre];
  var body = document.getElementById('seg-body-' + nombre);
  var chev = document.getElementById('seg-chev-' + nombre);
  if (body) {
    body.classList.toggle('collapsed', !SEG_PANELS[nombre]);
  }
  if (chev) chev.style.transform = SEG_PANELS[nombre] ? '' : 'rotate(-90deg)';
}


function segEliminarPlantilla(plantillaId, tipo) {
  segConfirm('¿Eliminar esta plantilla?', function() {
    segFetch('/api/seguimiento/plantillas/' + plantillaId,
      { method: 'DELETE', body: JSON.stringify({ company_id: SEG.companyId }) },
      function() {
        SEG._plantillas[tipo] = (SEG._plantillas[tipo]||[]).filter(function(x) {
          return (x._id||x.id) !== plantillaId;
        });
        segRenderizarChipsPlantillas(tipo);
        segToast('Plantilla eliminada', 'success');
      },
      function() { segToast('Error al eliminar', 'error'); }
    );
  });
}