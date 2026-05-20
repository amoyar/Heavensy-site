// ── DASHBOARD HEAVENSY ──

var _dashAPI = 'https://heavensy-api-backend-v2.onrender.com';
var _dashPeriodo = 'mes';
var _dashCharts = {};

// Datos demo mientras se conecta el backend
var _dashDemo = {
  ing_actual:    1850000,
  ing_inicial:   620000,
  ing_servicios: 1340000,
  ing_deriv:     510000,
  conversaciones:   148,
  vip:              23,
  aliados:          11,
  tiempo_min:       12,
  cupos_total:      200,
  cupos_tomados:    148,
  cupos_cancelados: 18,
  cupos_iniciales:  120,
  canales: [
    { label: 'WhatsApp',  valor: 62, color: '#25D366' },
    { label: 'Instagram', valor: 18, color: '#E1306C' },
    { label: 'Heavensy',  valor: 13, color: '#8E84FA' },
    { label: 'Messenger', valor: 7,  color: '#0084FF' }
  ],
  meses: [
    { mes: 'Nov', conv: 78,  svc: 610000,  deriv: 180000, vip: 14, aliados: 7,  tiempo: 11, cupos_total: 120, cupos_tomados: 78,  cupos_cancelados: 8  },
    { mes: 'Dic', conv: 95,  svc: 780000,  deriv: 220000, vip: 16, aliados: 8,  tiempo: 12, cupos_total: 140, cupos_tomados: 95,  cupos_cancelados: 10 },
    { mes: 'Ene', conv: 88,  svc: 720000,  deriv: 195000, vip: 17, aliados: 8,  tiempo: 10, cupos_total: 140, cupos_tomados: 88,  cupos_cancelados: 12 },
    { mes: 'Feb', conv: 112, svc: 920000,  deriv: 260000, vip: 19, aliados: 9,  tiempo: 11, cupos_total: 160, cupos_tomados: 112, cupos_cancelados: 9  },
    { mes: 'Mar', conv: 131, svc: 1100000, deriv: 380000, vip: 21, aliados: 10, tiempo: 13, cupos_total: 180, cupos_tomados: 131, cupos_cancelados: 14 },
    { mes: 'Abr', conv: 148, svc: 1340000, deriv: 510000, vip: 23, aliados: 11, tiempo: 12, cupos_total: 200, cupos_tomados: 148, cupos_cancelados: 18, actual: true }
  ]
};

function initDashboardPage() {
  // Nombre usuario
  try {
    var u = JSON.parse(localStorage.getItem('user') || '{}');
    var tok = localStorage.getItem('token');
    var nombre = u.username || u.email || '';
    if (!nombre && tok) {
      var p = JSON.parse(atob(tok.split('.')[1]));
      nombre = p.full_name ? p.full_name.split(' ')[0] : (p.username || p.email || '');
    }
    var el = document.getElementById('dash-username');
    if (el) el.textContent = nombre || 'Usuario';
  } catch(e) {}

  _dashPeriodo = 'mes';

  // Cargar Chart.js si no está disponible
  if (typeof Chart === 'undefined') {
    var s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';
    s.onload = function() { _dashLoad(); };
    document.head.appendChild(s);
  } else {
    _dashLoad();
  }
}

function dashCambiarPeriodo(val) {
  _dashPeriodo = val;
  _dashLoad();
}

function _dashLoad() {
  // Mostrar skeleton mientras carga
  _dashShowLoading(true);

  // 1) Intentar endpoint dedicado /api/dashboard
  _dashFetch('/api/dashboard?periodo=' + _dashPeriodo)
    .then(function(d) {
      if (d && (d.meses || d.data)) {
        _dashShowLoading(false);
        _dashRender(d.data || d);
      } else {
        // 2) Componer desde endpoints reales
        return _dashCompose();
      }
    })
    .then(function(composed) {
      if (!composed) return;
      _dashShowLoading(false);
      _dashRender(composed);
    })
    .catch(function() {
      _dashCompose()
        .then(function(d) { _dashShowLoading(false); _dashRender(d || _dashDemo); })
        .catch(function() { _dashShowLoading(false); _dashRender(_dashDemo); });
    });
}

function _dashShowLoading(show) {
  // Muestra/oculta un estado de carga sutil en los valores KPI
  var ids = ['dsc-comisiones','dsc-ganancias','dsc-cancelaciones','dsc-ocupacion','dsc-hrs','dsc-crec',
             'dash-ing-actual','dash-ing-servicios','dash-ing-deriv','dash-crec-total'];
  ids.forEach(function(id) {
    var el = document.getElementById(id);
    if (el && show) el.textContent = '—';
  });
}

function _dashFetch(path) {
  var token = localStorage.getItem('token');
  var headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  return fetch(_dashAPI + path, { headers: headers })
    .then(function(r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
}

async function _dashCompose() {
  try {
    var CANAL_COLORS = { whatsapp:'#25D366', instagram:'#E1306C', heavensy:'#8E84FA', messenger:'#0084FF', web:'#4A9FD4', manual:'#9497F4', directo:'#9497F4' };
    var MES_NAMES = {'01':'Ene','02':'Feb','03':'Mar','04':'Abr','05':'May','06':'Jun','07':'Jul','08':'Ago','09':'Sep','10':'Oct','11':'Nov','12':'Dic'};

    // Meses a cargar según período
    var now = new Date();
    var numMeses = _dashPeriodo === 'anio' ? 12 : _dashPeriodo === 'trimestre' ? 3 : 6;
    var months = [];
    for (var i = numMeses - 1; i >= 0; i--) {
      var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'));
    }

    // Precios de servicios
    var servicePriceMap = {};
    try {
      var resData = await _dashFetch('/api/agenda/resources');
      var resources = resData.resources || [];
      await Promise.all(resources.map(async function(r) {
        try {
          var svcData = await _dashFetch('/api/agenda/resources/' + r._id + '/services');
          (svcData.services || []).forEach(function(s) {
            servicePriceMap[s._id] = parseFloat(s.price || s.precio || 0);
          });
        } catch(e) {}
      }));
    } catch(e) {}

    // Citas por mes
    var monthlyData = await Promise.all(months.map(async function(month, idx) {
      var appts = [];
      try {
        var calData = await _dashFetch('/api/calendar/company?month=' + month);
        appts = calData.appointments || [];
      } catch(e) {}

      var mesKey = month.split('-')[1];
      var mesLabel = MES_NAMES[mesKey] || mesKey;
      var convSet = {}, vipSet = {}, canalCount = {};
      var svc = 0, cancelled = 0, durTotal = 0, durCount = 0;

      appts.forEach(function(a) {
        if (a.contact_id) convSet[a.contact_id] = true;
        if (a.is_vip)     vipSet[a.contact_id] = true;
        var isCancelled = ['cancelled','expired','no_show'].includes(a.status);
        if (isCancelled) {
          cancelled++;
        } else {
          svc += servicePriceMap[a.service_id] || 0;
        }
        var canal = (a.source || 'directo').toLowerCase();
        canalCount[canal] = (canalCount[canal] || 0) + 1;
        if (a.duration) { durTotal += Number(a.duration); durCount++; }
      });

      var convCount = Object.keys(convSet).length;
      var vipCount  = Object.keys(vipSet).length;
      var cuposTot  = appts.length;
      var cuposTom  = cuposTot - cancelled;
      var deriv     = Math.round(svc * 0.5);
      var tiempoAvg = durCount > 0 ? Math.round(durTotal / durCount) : 0;

      return { mes: mesLabel, month: month, conv: convCount, svc: svc, deriv: deriv,
               vip: vipCount, aliados: 0, tiempo: tiempoAvg,
               cupos_total: cuposTot, cupos_tomados: cuposTom, cupos_cancelados: cancelled,
               actual: idx === months.length - 1, _canalCount: canalCount };
    }));

    // Canales agregados
    var totalCanalCount = {};
    monthlyData.forEach(function(m) {
      Object.entries(m._canalCount).forEach(function(e) {
        totalCanalCount[e[0]] = (totalCanalCount[e[0]] || 0) + e[1];
      });
    });
    var totalAppts = Object.values(totalCanalCount).reduce(function(a,b){return a+b;}, 0) || 1;
    var canales = Object.entries(totalCanalCount).map(function(e) {
      return { label: e[0].charAt(0).toUpperCase() + e[0].slice(1),
               valor: Math.round((e[1] / totalAppts) * 100),
               color: CANAL_COLORS[e[0]] || '#8E84FA' };
    });
    if (!canales.length) canales = _dashDemo.canales;

    var current = monthlyData[monthlyData.length - 1];
    var first   = monthlyData[0];
    var ing_actual  = current.svc + current.deriv;
    var ing_inicial = (first.svc + first.deriv) || ing_actual || _dashDemo.ing_inicial;

    return {
      ing_actual:       ing_actual,
      ing_inicial:      ing_inicial,
      ing_servicios:    current.svc,
      ing_deriv:        current.deriv,
      conversaciones:   current.conv,
      vip:              current.vip,
      aliados:          current.aliados,
      tiempo_min:       current.tiempo,
      cupos_total:      current.cupos_total,
      cupos_tomados:    current.cupos_tomados,
      cupos_cancelados: current.cupos_cancelados,
      cupos_iniciales:  first.cupos_total,
      canales:          canales,
      meses:            monthlyData
    };
  } catch(e) {
    console.warn('[Dashboard] Error componiendo datos:', e);
    return null;
  }
}

function _dashRender(d) {
  _dashSetSummaryCard(d);
  _dashSetCrecChart(d);
  _dashSetKPIs(d);
  _dashSetCanales(d.canales);
  _dashSetBars(d.meses);
  _dashSetTable(d.meses);
  setTimeout(_dashInitTableHover, 50);
}

function _dashInitTableHover() {
  ['dash-table-body-ingresos','dash-table-body-actividad'].forEach(function(id) {
    var tbody = document.getElementById(id);
    if (!tbody) return;
    var table = tbody.closest('table');
    if (!table) return;

    tbody.querySelectorAll('tr').forEach(function(row) {
      row.querySelectorAll('td').forEach(function(cell) {
        cell.addEventListener('mouseenter', function() {
          var colIdx = Array.from(row.children).indexOf(cell);

          // Highlight fila
          row.classList.add('row-hover');

          // Highlight columna + celda intersectada
          tbody.querySelectorAll('tr').forEach(function(r) {
            var c = r.children[colIdx];
            if (c) {
              if (r === row) {
                c.classList.add('cell-intersect');
              } else {
                c.classList.add('col-hover');
              }
            }
          });
        });

        cell.addEventListener('mouseleave', function() {
          var colIdx = Array.from(row.children).indexOf(cell);
          row.classList.remove('row-hover');
          tbody.querySelectorAll('tr').forEach(function(r) {
            var c = r.children[colIdx];
            if (c) {
              c.classList.remove('col-hover');
              c.classList.remove('cell-intersect');
            }
          });
        });
      });
    });
  });
}

function _dashSetCrecChart(d) {
  var canvas = document.getElementById('dash-crec-chart');
  if (!canvas || typeof Chart === 'undefined') return;

  var anio = new Date().getFullYear();
  var el = document.getElementById('dash-crec-anio');
  if (el) el.textContent = anio;

  // Calcular crecimiento % acumulado mes a mes
  var meses = d.meses || [];
  var labels = meses.map(function(m) { return m.mes; });
  var ingInicial = d.ing_inicial || 1;
  var valores = meses.map(function(m) {
    var total = m.svc + m.deriv;
    return Math.round(((total - ingInicial) / ingInicial) * 100);
  });

  // Mostrar crecimiento del último mes en el label
  var ultimo = valores[valores.length - 1];
  var labelEl = document.getElementById('dash-crec-actual-label');
  if (labelEl) {
    labelEl.textContent = (ultimo >= 0 ? '+' : '') + ultimo + '%';
    labelEl.style.color = ultimo >= 0 ? '#4ade80' : '#f87171';
  }

  if (_dashCharts.crec) { _dashCharts.crec.destroy(); }

  _dashCharts.crec = new Chart(canvas, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        data: valores,
        borderColor: '#8E84FA',
        borderWidth: 2.5,
        pointBackgroundColor: '#8E84FA',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: 5,
        pointHoverRadius: 7,
        fill: true,
        backgroundColor: function(ctx) {
          var gradient = ctx.chart.ctx.createLinearGradient(0, 0, 0, 160);
          gradient.addColorStop(0, 'rgba(142,132,250,0.25)');
          gradient.addColorStop(1, 'rgba(142,132,250,0.01)');
          return gradient;
        },
        tension: 0.4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(30,40,100,0.95)',
          titleColor: 'rgba(255,255,255,0.7)',
          bodyColor: '#fff',
          borderColor: 'rgba(142,132,250,0.4)',
          borderWidth: 1,
          padding: 10,
          callbacks: {
            label: function(ctx) {
              return ' ' + (ctx.parsed.y >= 0 ? '+' : '') + ctx.parsed.y + '%';
            }
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(0,0,0,0.06)' },
          ticks: { color: 'rgba(56,56,56,0.45)', font: { size: 11 } },
          border: { display: false }
        },
        y: {
          grid: { color: 'rgba(0,0,0,0.06)' },
          ticks: {
            color: 'rgba(56,56,56,0.45)',
            font: { size: 11 },
            callback: function(v) { return (v >= 0 ? '+' : '') + v + '%'; }
          },
          border: { display: false }
        }
      }
    }
  });
}

function _dashSetSummaryCard(d) {
  // Datos usuario
  var nombre = '—', spec = '', location = '', foto = null;
  try {
    var tok = localStorage.getItem('token');
    if (tok) {
      var p = JSON.parse(atob(tok.split('.')[1]));
      nombre   = p.full_name || p.username || '—';
      spec     = p.rubro || p.profession || '';
      location = p.country || p.pais || '';
      foto     = p.foto_url || null;
    }
    var u = JSON.parse(localStorage.getItem('user') || '{}');
    if (u.full_name) nombre = u.full_name;
    if (u.foto_url) foto = u.foto_url;
  } catch(e) {}

  // Avatar
  var av = document.getElementById('dsc-avatar');
  if (av) {
    if (foto) {
      av.innerHTML = '<img src="' + foto + '" alt="avatar">';
    } else {
      var parts = nombre.trim().split(' ').filter(Boolean);
      var ini = (parts.length >= 2 ? parts[0][0] + parts[1][0] : (parts[0] || 'U').substring(0,2)).toUpperCase();
      av.innerHTML = ini;
    }
  }

  _dashSet('dsc-name',     nombre);
  _dashSet('dsc-spec',     spec);
  _dashSet('dsc-vip',      d.vip    || 0);
  _dashSet('dsc-aliados',  d.aliados || 0);

  var locEl = document.getElementById('dsc-location');
  if (locEl) locEl.style.display = location ? '' : 'none';
  if (location) _dashSet('dsc-location', '🌎 ' + location);

  // Métricas summary
  var crec = d.ing_inicial > 0 ? Math.round(((d.ing_actual - d.ing_inicial) / d.ing_inicial) * 100) : 0;
  _dashSet('dsc-comisiones',   _fmt(d.ing_deriv));
  _dashSet('dsc-ganancias',    (crec >= 0 ? '+' : '') + crec + '%');
  _dashSet('dsc-cancelaciones', (d.cancelaciones || 5) + '%');
  _dashSet('dsc-ocupacion',    (d.ocupacion_agenda || 97) + '%');
  _dashSet('dsc-hrs',          (d.hrs_gestion || d.tiempo_min || 20) + ' hrs');
  _dashSet('dsc-crec',         (crec >= 0 ? '+' : '') + crec + '%');
}

function _dashSetKPIs(d) {
  var crec = d.ing_inicial > 0
    ? Math.round(((d.ing_actual - d.ing_inicial) / d.ing_inicial) * 100)
    : 0;
  var crecMes = d.meses && d.meses.length >= 2
    ? Math.round(((d.meses[d.meses.length-1].svc - d.meses[d.meses.length-2].svc) / (d.meses[d.meses.length-2].svc || 1)) * 100)
    : 0;

  _dashSet('dash-ing-actual',    _fmt(d.ing_actual));
  _dashSet('dash-ing-servicios', _fmt(d.ing_servicios));
  _dashSet('dash-ing-deriv',     _fmt(d.ing_deriv));
  _dashSet('dash-crec-total',    (crec >= 0 ? '+' : '') + crec + '%');
  _dashSet('dash-ing-inicial',   _fmt(d.ing_inicial));
  _dashSet('dash-conv',    d.conversaciones);
  _dashSet('dash-vip',     d.vip);
  _dashSet('dash-aliados', d.aliados);
  _dashSet('dash-tiempo',  d.tiempo_min + ' min');

  // Ocupación agenda
  var cuposTotal    = d.cupos_total    || 0;
  var cuposTomados  = d.cupos_tomados  || 0;
  var cuposCancelados = d.cupos_cancelados || 0;
  var cuposIniciales  = d.cupos_iniciales  || 0;
  var cuposLibres   = cuposTotal - cuposTomados;
  var ocupPct       = cuposTotal > 0 ? Math.round((cuposTomados / cuposTotal) * 100) : 0;
  var cancelPct     = cuposTotal > 0 ? Math.round((cuposCancelados / cuposTotal) * 100) : 0;

  _dashSet('dash-ocupacion-pct',    ocupPct + '%');
  _dashSet('dash-cupos-tomados',    cuposTomados);
  _dashSet('dash-cupos-total',      cuposTotal);
  _dashSet('dash-cupos-libres',     cuposLibres);
  _dashSet('dash-cancelaciones-val', cuposCancelados);
  _dashSet('dash-cancelaciones-pct', cancelPct + '%');
  _dashSet('dash-cupos-iniciales',   cuposIniciales);

  var crecEl = document.getElementById('dash-ing-crec');
  if (crecEl) {
    var pos = crecMes >= 0;
    crecEl.className = pos ? 'dash-up' : 'dash-down';
    crecEl.innerHTML = '<i class="fas fa-arrow-' + (pos ? 'up' : 'down') + '" style="font-size:9px"></i>' + (pos ? '+' : '') + crecMes + '%';
  }

  var crecTot = document.getElementById('dash-crec-total');
  if (crecTot) crecTot.style.color = crec >= 0 ? '#4ade80' : '#f87171';

  _dashSet('dash-ing-svc-sub',   _pct(d.ing_servicios, d.ing_actual) + '% del total');
  _dashSet('dash-deriv-sub',     _pct(d.ing_deriv, d.ing_actual) + '% del total');
  _dashSet('dash-vip-sub',       'De ' + d.conversaciones + ' conv. totales');
  _dashSet('dash-aliados-sub',   d.aliados + ' aliados activos');
}

function _dashSetCanales(canales) {
  if (!canales || !canales.length) return;
  var canvas = document.getElementById('dash-donut');
  var legend = document.getElementById('dash-donut-legend');
  if (!canvas || !legend) return;

  // Destruir chart previo
  if (_dashCharts.donut) { _dashCharts.donut.destroy(); }

  if (typeof Chart !== 'undefined') {
    _dashCharts.donut = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: canales.map(function(c){ return c.label; }),
        datasets: [{
          data: canales.map(function(c){ return c.valor; }),
          backgroundColor: canales.map(function(c){ return c.color; }),
          borderColor: 'transparent',
          borderWidth: 0,
          hoverOffset: 6
        }]
      },
      options: {
        responsive: false,
        cutout: '68%',
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(30,40,100,0.92)',
            titleColor: 'rgba(255,255,255,0.7)',
            bodyColor: '#fff',
            callbacks: {
              label: function(ctx) { return ctx.label + ': ' + ctx.parsed + '%'; }
            }
          }
        }
      }
    });
  }

  legend.innerHTML = canales.map(function(c) {
    return '<div class="dash-legend-item">' +
      '<div class="dash-legend-dot" style="background:' + c.color + '"></div>' +
      '<span class="dash-legend-label">' + c.label + '</span>' +
      '<span class="dash-legend-val">' + c.valor + '<span class="dash-legend-pct">%</span></span>' +
    '</div>';
  }).join('');
}

function _dashSetBars(meses) {
  if (!meses || !meses.length) return;
  var wrap = document.getElementById('dash-bars');
  if (!wrap) return;

  var maxVal = Math.max.apply(null, meses.map(function(m){ return m.svc + m.deriv; }));

  wrap.innerHTML = meses.map(function(m) {
    var total  = m.svc + m.deriv;
    var pct    = maxVal > 0 ? Math.round((total / maxVal) * 100) : 0;
    var isCurr = m.actual ? 'current' : '';
    return '<div class="dash-bar-col">' +
      '<div class="dash-bar-val">' + _fmtK(total) + '</div>' +
      '<div class="dash-bar-track" style="height:110px">' +
        '<div class="dash-bar-fill ' + isCurr + '" style="height:' + pct + '%"></div>' +
      '</div>' +
      '<div class="dash-bar-label">' + m.mes + '</div>' +
    '</div>';
  }).join('');
}

function _dashSetTable(meses) {
  var tbodyIng = document.getElementById('dash-table-body-ingresos');
  var tbodyAct = document.getElementById('dash-table-body-actividad');
  if (!meses) return;

  var rowsIng = '', rowsAct = '';

  meses.forEach(function(m, i) {
    var total     = m.svc + m.deriv;
    var prevTotal = i > 0 ? meses[i-1].svc + meses[i-1].deriv : null;
    var varPct    = prevTotal ? Math.round(((total - prevTotal) / prevTotal) * 100) : null;
    var varHtml   = varPct !== null
      ? '<span class="' + (varPct >= 0 ? 'dash-tag-up' : 'dash-tag-down') + '">' + (varPct >= 0 ? '+' : '') + varPct + '%</span>'
      : '—';
    var cls     = m.actual ? 'current-month' : '';
    var mesLabel = m.mes + (m.actual ? ' <span style="font-size:9px;opacity:.6">(actual)</span>' : '');

    rowsIng += '<tr>' +
      '<td class="' + cls + '">' + mesLabel + '</td>' +
      '<td class="' + cls + '">' + m.conv + '</td>' +
      '<td class="' + cls + '">' + _fmt(m.svc) + '</td>' +
      '<td class="' + cls + '">' + _fmt(m.deriv) + '</td>' +
      '<td class="' + cls + '">' + _fmt(total) + '</td>' +
      '<td>' + varHtml + '</td>' +
    '</tr>';

    var ocup = m.cupos_total ? Math.round((m.cupos_tomados / m.cupos_total) * 100) + '%' : '—';
    var canc = m.cupos_cancelados != null ? m.cupos_cancelados : '—';
    rowsAct += '<tr>' +
      '<td class="' + cls + '">' + m.vip + '</td>' +
      '<td class="' + cls + '">' + (m.aliados || '—') + '</td>' +
      '<td class="' + cls + '">' + ocup + '</td>' +
      '<td class="' + cls + '">' + canc + '</td>' +
      '<td class="' + cls + '">' + m.tiempo + ' min</td>' +
    '</tr>';
  });

  if (tbodyIng) tbodyIng.innerHTML = rowsIng;
  if (tbodyAct) tbodyAct.innerHTML = rowsAct;
}

// ── TOGGLE DETALLE ──
function dashToggleDetalle() {
  var detalle = document.getElementById('dash-detalle');
  var btn     = document.getElementById('dash-toggle-btn');
  var icon    = document.getElementById('dash-toggle-icon');
  if (!detalle) return;
  var open = detalle.style.display === 'none' || detalle.style.display === '';
  detalle.style.display = open ? 'block' : 'none';
  icon.className = open ? 'fas fa-chevron-up' : 'fas fa-chevron-down';
  var label = btn.querySelector('.dash-toggle-label');
  if (label) label.textContent = open ? 'Ver menos' : 'Ver todo';
}

// ── HELPERS ──
function _dashSet(id, val) {
  var el = document.getElementById(id);
  if (el) el.textContent = val;
}
function _fmt(n) {
  if (!n && n !== 0) return '—';
  return '$' + Number(n).toLocaleString('es-CL');
}
function _fmtK(n) {
  if (n >= 1000000) return '$' + (n/1000000).toFixed(1) + 'M';
  if (n >= 1000)    return '$' + Math.round(n/1000) + 'K';
  return '$' + n;
}
function _pct(part, total) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}
