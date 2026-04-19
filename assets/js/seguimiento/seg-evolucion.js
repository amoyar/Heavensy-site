/* ═══════════════════════════════════════════════════════
   SEGUIMIENTO — seg-evolucion.js
   Panel evolución de intensidades. segToggleEvo, segCargarEvolucion, segRenderizarEvolucion, Chart.js.
═══════════════════════════════════════════════════════ */

var _segEvoChart   = null;
var _segEvoVisible = false;
var _segEvoPaleta  = [
  '#7c3aed','#0891b2','#059669','#d97706',
  '#dc2626','#db2777','#4f46e5','#0369a1'
];
var _segEvoDash = [
  [], [4,2], [2,2], [6,2],
  [3,3], [5,2,2,2], [4,4], [2,4]
];
var _segEvoUltimosValores = {}; // { chip: ultimo_valor_guardado }
var _segEvoPrimerosValores = {}; // { chip: primer_valor_registrado }
var _segEvoChips = [];          // chips activos en el gráfico
var _segEvoColores = {};        // { chip: color }

function segToggleEvo() {
  var content = document.getElementById('seg-evo-content');
  var chev    = document.getElementById('seg-evo-chev');
  if (!content) return;
  _segEvoVisible = !_segEvoVisible;
  content.classList.toggle('seg-hidden', !_segEvoVisible);
  if (chev) chev.style.transform = _segEvoVisible ? '' : 'rotate(-90deg)';
  if (_segEvoVisible && SEG.clienteId) {
    segCargarEvolucion();
  }
}

function segCargarEvolucion(limite) {
  if (!SEG.clienteId || !SEG.companyId) return;
  limite = limite || 10;
  var url = '/api/seguimiento/clientes/' + SEG.clienteId +
            '/evolucion-intensidades?company_id=' + SEG.companyId +
            '&limite=' + limite;
  segFetch(url, {}, function(data) {
    if (data && data.evolucion) {
      // Asegurar que Chart.js esté cargado antes de renderizar
      if (typeof Chart === 'undefined') {
        var script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js';
        script.onload = function() { segRenderizarEvolucion(data.evolucion); };
        document.head.appendChild(script);
      } else {
        segRenderizarEvolucion(data.evolucion);
      }
    }
  }, function() {
    var content = document.getElementById('seg-evo-content');
    if (content) content.innerHTML = '<div class="seg-evo-empty">No se pudo cargar la evolución.</div>';
  });
}

function segRenderizarEvolucion(evolucion) {
  var legendEl = document.getElementById('seg-evo-legend');
  var statsEl  = document.getElementById('seg-evo-stats');
  var sesEl    = document.getElementById('seg-evo-sesiones');

  if (!evolucion || evolucion.length === 0) {
    var content = document.getElementById('seg-evo-content');
    if (content) content.innerHTML = '<div class="seg-evo-empty">Sin datos de intensidad aún.</div>';
    return;
  }

  // Recopilar todos los chips con intensidad (filtrar texto libre)
  // Solo chips que estuvieron en "Lo que abordaremos" con intensidad, excluyendo hipótesis
  var chipsSet = {};
  evolucion.forEach(function(s) {
    var trabajar   = s.chips_trabajar  || [];
    var hipotesis  = s.chips_hipotesis || [];
    trabajar.forEach(function(nombre) {
      if (hipotesis.indexOf(nombre) === -1) {
        var nivel = (s.intensidades || {})[nombre];
        if (nivel !== undefined && nivel > 0) {
          chipsSet[nombre] = (chipsSet[nombre] || 0) + 1;
        }
      }
    });
  });
  var chips = Object.keys(chipsSet);
  if (!chips.length) {
    var content2 = document.getElementById('seg-evo-content');
    if (content2) content2.innerHTML = '<div class="seg-evo-empty">Sin intensidades registradas.</div>';
    return;
  }

  // Labels de fechas — agregar hora si hay más de una sesión el mismo día
  var fechaCount = {};
  evolucion.forEach(function(s) { fechaCount[s.fecha] = (fechaCount[s.fecha] || 0) + 1; });
  var labels = evolucion.map(function(s) {
    if (!s.fecha) return '';
    var p = s.fecha.split('-');
    var base = p[2] + '/' + p[1];
    return (fechaCount[s.fecha] > 1 && s.hora) ? base + ' ' + s.hora.slice(0,5) : base;
  });

  if (sesEl) sesEl.textContent = evolucion.length + ' sesiones';

  // Datasets — solo chips con datos reales
  var datasets = chips.map(function(nombre, i) {
    var color = _segEvoPaleta[i % _segEvoPaleta.length];
    var dash  = _segEvoDash[i % _segEvoDash.length];
    return {
      label: nombre,
      data: evolucion.map(function(s) {
        var v = s.intensidades[nombre];
        return (v !== undefined && v > 0) ? v : null;
      }),
      borderColor: color,
      backgroundColor: color + '14',
      borderWidth: 1,
      pointRadius: 0,
      pointHitRadius: 10,
      tension: 0.3,
      fill: false,
      borderDash: [],
      spanGaps: true
    };
  });

  // Leyenda — solo chips con datos
  if (legendEl) {
    legendEl.innerHTML = chips.map(function(nombre, i) {
      var color = _segEvoPaleta[i % _segEvoPaleta.length];
      var label = nombre.length > 22 ? nombre.slice(0, 22) + '...' : nombre;
      return '<div class="seg-evo-legend-item" data-seg-tooltip="' + segEscape(nombre) + '">' +
        '<div class="seg-evo-legend-dot" style="background:' + color + '"></div>' +
        segEscape(label) +
      '</div>';
    }).join('');
  }

  // Plugin para puntos con color de intensidad y número dentro
  var puntosPlugin = {
    id: 'puntosIntensidad',
    afterDatasetsDraw: function(chart) {
      var ctx2 = chart.ctx;
      chart.data.datasets.forEach(function(ds, di) {
        var meta = chart.getDatasetMeta(di);
        meta.data.forEach(function(pt, pi) {
          var val = ds.data[pi];
          if (val === null || val === undefined) return;
          var nivel = Math.round(val);
          var bg  = SEG_INTENS_COLORS && SEG_INTENS_COLORS[nivel] ? SEG_INTENS_COLORS[nivel] : ds.borderColor;
          var txt = SEG_INTENS_TEXT  && SEG_INTENS_TEXT[nivel]  ? SEG_INTENS_TEXT[nivel]  : '#fff';
          var x = pt.x, y = pt.y, r = 7;
          ctx2.save();
          ctx2.beginPath();
          ctx2.arc(x, y, r, 0, Math.PI * 2);
          ctx2.fillStyle = bg;
          ctx2.fill();
          ctx2.strokeStyle = '#ffffff';
          ctx2.lineWidth = 1.5;
          ctx2.stroke();
          ctx2.fillStyle = txt;
          ctx2.font = '700 8px sans-serif';
          ctx2.textAlign = 'center';
          ctx2.textBaseline = 'middle';
          ctx2.fillText(String(nivel), x, y);
          ctx2.restore();
        });
      });
    }
  };

  // Destruir chart anterior si existe
  if (_segEvoChart) { _segEvoChart.destroy(); _segEvoChart = null; }

  var canvas = document.getElementById('seg-evo-chart');
  if (!canvas) return;

  _segEvoChart = new Chart(canvas, {
    type: 'line',
    plugins: [puntosPlugin],
    data: { labels: labels, datasets: datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          mode: 'nearest',
          intersect: true,
          backgroundColor: 'rgba(237, 233, 254, 0.97)',
          titleColor: '#4c1d95',
          bodyColor: '#5b21b6',
          borderColor: '#c4b5fd',
          borderWidth: 1,
          padding: 8,
          titleFont: { size: 10, weight: '600' },
          bodyFont: { size: 10 },
          callbacks: {
            title: function(items) {
              return items.length ? items[0].label : '';
            },
            label: function(item) {
              var nivel = item.parsed.y;
              var lbl = SEG_INTENS_LABELS && SEG_INTENS_LABELS[nivel]
                ? (SEG_INTENS_LABELS[nivel].label || SEG_INTENS_LABELS[nivel]) : '';
              var nombre = item.dataset.label || '';
              var corto = nombre.length > 28 ? nombre.slice(0, 28) + '...' : nombre;
              return corto + ': ' + nivel + (lbl ? ' (' + lbl + ')' : '');
            },
            labelColor: function(ctx) {
              var nivel = ctx.parsed.y;
              var bg = SEG_INTENS_COLORS && SEG_INTENS_COLORS[nivel] ? SEG_INTENS_COLORS[nivel] : ctx.dataset.borderColor;
              return { borderColor: bg, backgroundColor: bg };
            }
          }
        }
      },
      scales: {
        y: {
          min: 0, max: 8,
          ticks: { stepSize: 1, font: { size: 9 } },
          grid: { color: 'rgba(0,0,0,0.05)' }
        },
        x: {
          ticks: { font: { size: 9 }, maxRotation: 0, autoSkip: true },
          grid: { display: false }
        }
      }
    }
  });

  // Guardar chips activos, colores y últimos valores para tiempo real
  _segEvoChips = chips.slice();
  chips.forEach(function(nombre, i) {
    _segEvoColores[nombre] = _segEvoPaleta[i % _segEvoPaleta.length];
    var vals = evolucion.map(function(s) { return s.intensidades[nombre]; }).filter(function(v) { return v !== undefined && v > 0; });
    _segEvoUltimosValores[nombre]  = vals.length ? vals[vals.length - 1] : null;
    _segEvoPrimerosValores[nombre] = vals.length ? vals[0] : null;
  });

  // Renderizar stats
  segActualizarEvoStats();
}

function segActualizarEvoStats() {
  var statsEl = document.getElementById('seg-evo-stats');
  if (!statsEl || !_segEvoChips.length) return;

  statsEl.innerHTML = _segEvoChips.map(function(nombre) {
    var color   = _segEvoColores[nombre] || '#7c3aed';
    var ultimo  = _segEvoUltimosValores[nombre];
    var actual  = _segIntensidades[nombre] !== undefined && _segIntensidades[nombre] > 0
                  ? _segIntensidades[nombre] : null;

    // No mostrar si no hay datos suficientes
    if (ultimo === null && actual === null) return '';

    function diffBadge(val, ref, label) {
      if (val === null || ref === null) return '';
      var d   = val - ref;
      var cls = d < 0 ? 'baja' : d > 0 ? 'sube' : 'igual';
      var arr = d < 0 ? '↓' : d > 0 ? '↑' : '→';
      var num = d !== 0 ? Math.abs(d) : '';
      return '<span class="seg-evo-diff ' + cls + '">' +
               '<span class="seg-evo-diff-arr">' + arr + (num ? ' ' + num : '') + '</span>' +
               '<span class="seg-evo-diff-lbl">' + label + '</span>' +
             '</span>';
    }

    // Histórico: primera sesión → último registrado
    var valsHist = [];
    // Reconstruir desde DOM no es posible, usar _segEvoUltimosValores como referencia
    // Para histórico necesitamos el primer valor — lo guardamos al renderizar
    var histBadge = '';  // se llena abajo
    var vsBadge   = actual !== null && ultimo !== null ? diffBadge(actual, ultimo, 'vs anterior') : '';
    var labelCorto = nombre.length > 16 ? nombre.slice(0, 16) + '...' : nombre;

    var primero = _segEvoPrimerosValores[nombre];
    // Badge histórico: primer → último registrado
    var histDiff = (primero !== null && ultimo !== null && primero !== ultimo)
      ? (ultimo - primero)
      : null;
    var histCls  = histDiff === null ? 'igual' : histDiff < 0 ? 'baja' : 'sube';
    var histTxt  = primero !== null && ultimo !== null
      ? primero + ' → ' + ultimo + (histDiff !== null ? (histDiff < 0 ? ' ↓' + Math.abs(histDiff) : ' ↑' + histDiff) : '')
      : (ultimo !== null ? String(ultimo) : '');

    // Badge actual vs anterior: muestra "anterior → actual ↓diff"
    var actDiff  = (actual !== null && ultimo !== null) ? actual - ultimo : null;
    var actCls   = actDiff === null ? 'igual' : actDiff < 0 ? 'baja' : actDiff > 0 ? 'sube' : 'igual';
    var actTxt   = (actual !== null && ultimo !== null)
      ? ultimo + ' → ' + actual + (actDiff !== 0 ? (actDiff < 0 ? ' ↓' + Math.abs(actDiff) : ' ↑' + actDiff) : '')
      : (actual !== null ? String(actual) : '');

    return '<div class="seg-evo-stat" data-seg-tooltip="' + segEscape(nombre) + '">' +
      '<span class="seg-evo-stat-label" style="color:' + color + '">' + segEscape(labelCorto) + '</span>' +
      '<div class="seg-evo-stat-badges">' +
        (histTxt ? '<span class="seg-evo-diff ' + histCls + '"><span class="seg-evo-diff-arr">' + histTxt + '</span><span class="seg-evo-diff-lbl">historial</span></span>' : '') +
      '</div>' +
    '</div>';
  }).join('');
}

// Resetear evolución al cambiar de cliente
function segResetEvolucion() {
  _segEvoVisible = false;
  var content = document.getElementById('seg-evo-content');
  var chev    = document.getElementById('seg-evo-chev');
  var sesEl   = document.getElementById('seg-evo-sesiones');
  if (content) { content.classList.add('seg-hidden'); content.innerHTML = '<div class="seg-evo-legend" id="seg-evo-legend"></div><div class="seg-evo-chart-wrap"><canvas id="seg-evo-chart" role="img" aria-label="Evolución de intensidades por sesión"></canvas></div><div class="seg-evo-stats" id="seg-evo-stats"></div>'; }
  if (chev)    chev.style.transform = 'rotate(-90deg)';
  if (sesEl)   sesEl.textContent = '';
  if (_segEvoChart) { _segEvoChart.destroy(); _segEvoChart = null; }
}

/* ─────────────────────────────────────────
   RESUMEN HELPERS (usan classList seg-hidden)
───────────────────────────────────────── */
function segMostrarResumen(texto) {
  var vacio     = document.getElementById('seg-resumen-vacio');
  var generando = document.getElementById('seg-resumen-generando');
  var textEl    = document.getElementById('seg-resumen-text');
  var actionsEl = document.getElementById('seg-resumen-actions');
  if (vacio)     vacio.classList.add('seg-hidden');
  if (generando) generando.classList.add('seg-hidden');
  if (textEl) {
    textEl.classList.remove('seg-hidden');
    // Convertir saltos de línea a <br> para que se vean en HTML
    // y resaltar encabezados de sección (líneas que empiezan con emoji + texto)
    var html = texto
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\n{2,}/g, '<br><br>')
      .replace(/\n/g, '<br>')
      .replace(/(📋[^<]+|📅[^<]+|✅[^<]+)/g, '<strong>$1</strong>');
    textEl.innerHTML = html;
  }
  if (actionsEl) actionsEl.classList.remove('seg-hidden');
}

function segMostrarResumenGenerando() {
  var vacio     = document.getElementById('seg-resumen-vacio');
  var generando = document.getElementById('seg-resumen-generando');
  var textEl    = document.getElementById('seg-resumen-text');
  var actionsEl = document.getElementById('seg-resumen-actions');
  if (vacio)     vacio.classList.add('seg-hidden');
  if (generando) generando.classList.remove('seg-hidden');
  if (textEl)    textEl.classList.add('seg-hidden');
  if (actionsEl) actionsEl.classList.add('seg-hidden');
}

function segLimpiarResumen() {
  var vacio     = document.getElementById('seg-resumen-vacio');
  var generando = document.getElementById('seg-resumen-generando');
  var textEl    = document.getElementById('seg-resumen-text');
  var actionsEl = document.getElementById('seg-resumen-actions');
  if (vacio)     vacio.classList.remove('seg-hidden');
  if (generando) generando.classList.add('seg-hidden');
  if (textEl)    textEl.classList.add('seg-hidden');
  if (actionsEl) actionsEl.classList.add('seg-hidden');
}

function segEditarResumen() {
  var textEl = document.getElementById('seg-resumen-text');
  if (!textEl) return;
  textEl.focus();
  var range = document.createRange();
  range.selectNodeContents(textEl);
  range.collapse(false);
  var sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
}

/* ─────────────────────────────────────────
   DISPLAY HELPERS
───────────────────────────────────────── */
function segMostrarEmptyMain() {
  var empty = document.getElementById('seg-empty-main');
  var wrap  = document.getElementById('seg-registro-wrap');
  var load  = document.getElementById('seg-loading-main');
  if (empty) empty.classList.remove('seg-hidden');
  if (wrap)  wrap.classList.add('seg-hidden');
  if (load)  load.classList.add('seg-hidden');
  // Sin paciente → ocultar botón, chips y restaurar panel
  var btnCol = document.getElementById('seg-btn-collapse-left');
  if (btnCol) btnCol.classList.add('seg-hidden');
  var etWrap = document.getElementById('seg-lp-etiquetas-wrap');
  if (etWrap) etWrap.classList.add('seg-hidden');
  if (!SEG_LEFT_OPEN) segToggleLeftPanel();
}

function segMostrarRegistroWrap() {
  var empty = document.getElementById('seg-empty-main');
  var wrap  = document.getElementById('seg-registro-wrap');
  var load  = document.getElementById('seg-loading-main');
  if (empty) empty.classList.add('seg-hidden');
  if (wrap)  wrap.classList.remove('seg-hidden');
  if (load)  load.classList.add('seg-hidden');
}

function segMostrarCargandoContexto() {
  var empty = document.getElementById('seg-empty-main');
  var wrap  = document.getElementById('seg-registro-wrap');
  var load  = document.getElementById('seg-loading-main');
  if (empty) empty.classList.add('seg-hidden');
  if (wrap)  wrap.classList.add('seg-hidden');
  if (load)  load.classList.remove('seg-hidden');
}

function segMarcarCambios() {
  SEG.hayUnsaved = true;
  segAutoguardadoDebounce();
}