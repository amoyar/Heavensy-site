/* ═══════════════════════════════════════════════════════
   SEGUIMIENTO — seg-intensidad.js
   SEG_INTENS_LABELS/COLORS/TEXT, segCargarIntensidadLabels, segCargarIntensidades, segAbrirModalIntensidad, segSeleccionarIntensidad.
═══════════════════════════════════════════════════════ */

var _segIntensidades = {}; // { nombre: nivel }
var _segIntensidadActual = null;

// Defaults en JS (fallback si BD falla o demora)
var SEG_INTENS_LABELS = [
  { n: 0, label: 'Sin síntoma',    desc: 'Funcionalidad normal. Intensidad ausente. Riesgo nulo.' },
  { n: 1, label: 'Mínimo',         desc: 'Funcionalidad completamente conservada. Intensidad apenas perceptible. Riesgo nulo.' },
  { n: 2, label: 'Leve',           desc: 'Funcionalidad conservada. Intensidad leve. Riesgo bajo.' },
  { n: 3, label: 'Moderado',       desc: 'Funcionalidad levemente afectada. Intensidad clara y frecuente. Riesgo bajo.' },
  { n: 4, label: 'Moderado–grave', desc: 'Funcionalidad afectada en áreas importantes. Intensidad significativa. Riesgo moderado.' },
  { n: 5, label: 'Grave',          desc: 'Funcionalidad muy comprometida. Intensidad alta. Riesgo relevante.' },
  { n: 6, label: 'Crítico',        desc: 'Funcionalidad severamente comprometida. Intensidad muy alta. Riesgo alto.' },
  { n: 7, label: 'Riesgo vital',   desc: 'Funcionalidad colapsada. Intensidad extrema. Riesgo inminente.' }
];

var SEG_INTENS_COLORS = [
  '#ffffff','#d4f0d4','#a8e6a8','#f9e79f',
  '#f0c070','#e8855a','#d94f4f','#a01010'
];

var SEG_INTENS_TEXT = [
  '#374151','#374151','#374151','#374151',
  '#374151','#fff','#fff','#fff'
];

function segCargarIntensidadLabels() {
  var url = '/api/seguimiento/intensidad-labels?company_id=' + SEG.companyId;
  if (SEG.template) url += '&template=' + encodeURIComponent(SEG.template);
  segFetch(url, {},
    function(data) {
      if (data.error) {
        segToast('⚠️ ' + data.error, 'error');
        return;
      }
      if (data.niveles && data.niveles.length === 8) {
        SEG_INTENS_LABELS = data.niveles;
      }
      if (data.colores && data.colores.length === 8) {
        SEG_INTENS_COLORS = data.colores;
      }
      if (data.textos && data.textos.length === 8) {
        SEG_INTENS_TEXT = data.textos;
      }
    },
    function() {
      segToast('⚠️ No se pudo cargar la escala de intensidad', 'error');
    }
  );
}

function segCargarIntensidades() {
  if (!SEG.registroId) return;
  segFetch('/api/seguimiento/registros/' + SEG.registroId + '/intensidades', {},
    function(data) {
      _segIntensidades = data.intensidades || {};
      segRenderizarSeccionTrabajar();
      segActualizarHeroChipsTrabajar(); // actualizar header con intensidades cargadas
      if (typeof segDerRenderizarChips === 'function') segDerRenderizarChips(); // actualizar panel derivaciones
    },
    function() {} // silencioso
  );
}

function segAbrirModalIntensidad(nombre) {
  _segIntensidadActual = nombre;
  var tituloEl = document.getElementById('seg-intensidad-titulo');
  var listaEl  = document.getElementById('seg-intensidad-lista');
  if (tituloEl) tituloEl.textContent = 'Intensidad — ' + nombre;
  var actual = _segIntensidades[nombre] !== undefined ? _segIntensidades[nombre] : 0;
  listaEl.innerHTML = SEG_INTENS_LABELS.slice().reverse().map(function(item) {
    var sel   = item.n === actual;
    var color = SEG_INTENS_COLORS[item.n];
    return '<div class="seg-intens-item' + (sel ? ' activo' : '') + '" onclick="segSeleccionarIntensidad(' + item.n + ')">' +
      '<div class="seg-intens-barra" style="background:' + color + '"></div>' +
      '<div class="seg-intens-num">' + item.n + '</div>' +
      '<div class="seg-intens-info">' +
        '<div class="seg-intens-label">' + segEscape(item.label) + '</div>' +
        '<div class="seg-intens-desc">' + segEscape(item.desc) + '</div>' +
      '</div>' +
    '</div>';
  }).join('');
  var modal = document.getElementById('seg-intensidad-modal');
  if (modal) modal.classList.remove('seg-hidden');
}

function segSeleccionarIntensidad(nivel) {
  if (!_segIntensidadActual) return;
  _segIntensidades[_segIntensidadActual] = nivel;
  // Guardar en BD
  if (SEG.registroId) {
    segFetch('/api/seguimiento/registros/' + SEG.registroId + '/intensidades/' + encodeURIComponent(_segIntensidadActual),
      { method: 'PUT', body: JSON.stringify({ nivel: nivel, cliente_id: SEG.clienteId }) },
      function() {
        // Actualizar gráfico de evolución si está visible
        if (_segEvoVisible) segCargarEvolucion();
      },
      function() {}
    );
  }
  segCerrarModalIntensidad();
  segRenderizarSeccionTrabajar();
  segActualizarHeroChipsTrabajar();
  segActualizarTarjetaHistorialChips();
  if (_segEvoVisible && typeof segActualizarEvoStats === 'function') segActualizarEvoStats();
  segMarcarCambios();
}

function segCerrarModalIntensidad() {
  var modal = document.getElementById('seg-intensidad-modal');
  if (modal) modal.classList.add('seg-hidden');
  _segIntensidadActual = null;
}