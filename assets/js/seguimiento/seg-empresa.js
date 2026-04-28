/* ═══════════════════════════════════════════════════════
   SEGUIMIENTO — seg-empresa.js
   segSetCompany, segCargarLabels, segAplicarLabels, segCargarClientes, segRenderizarLista, segBuildMeta/Avatar.
═══════════════════════════════════════════════════════ */

function segActualizarSelectorUI() {}

/* ─────────────────────────────────────────
   EMPRESA
───────────────────────────────────────── */
function segSetCompany(companyId, nombre) {
  SEG.companyId      = companyId;
  SEG.companyNombre  = nombre;
  SEG.clienteId      = null;
  SEG.registroId     = null;
  SEG.contexto       = null;
  SEG._etiquetaFiltro = [];

  // Leer el template/rubro de la empresa desde la config global
  SEG.template = (window._companyConfig && window._companyConfig.template) || null;

  var nameEl = document.getElementById('seg-company-name');
  if (nameEl) nameEl.textContent = nombre || companyId;

  segMostrarEmptyMain();

  segCargarLabels(companyId, function() {
    segCargarClientes(companyId);
    segCargarIntensidadLabels();
  });
}

/* ─────────────────────────────────────────
   LABELS
───────────────────────────────────────── */
function segCargarLabels(companyId, callback) {
  segFetch('/api/seguimiento/labels?company_id=' + companyId, {}, function(data) {
    if (data && data.labels) {
      SEG.labels = data.labels;
      segAplicarLabels(data.labels);
    }
    if (callback) callback();
  }, function() {
    if (callback) callback();
  });
}

function segAplicarLabels(lb) {
  var m = {
    'lbl-tab-notas':        'Notas de ' + (lb.registro || 'sesion'),
    'lbl-tab-cliente':      lb.cliente || 'cliente',
    'lbl-notas-internas':   lb.notas_internas || 'Notas internas',
    'lbl-contenido':        lb.contenido_principal || 'Lo que se trabajo',
    'lbl-tareas':           lb.tareas || 'Tareas para el cliente',
    'lbl-proxima':          lb.proxima_cita || 'Proxima sesion',
    'lbl-resumen':          lb.resumen || 'Resumen para el cliente',
    'lbl-tl-titulo':        lb.timeline_titulo || 'Línea de tiempo',
    'lbl-tl-titulo-edit':   lb.timeline_titulo || 'Línea de tiempo',
    'lbl-promover-cliente': lb.cliente || 'cliente',
    'lbl-prog-cliente':     lb.cliente || 'cliente',
    'lbl-empty-cliente':    lb.cliente || 'cliente',
    'lbl-legend-active':    lb.status_active  || 'Registro en curso',
    'lbl-legend-pending':   lb.status_pending || 'Pendiente de envio',
    'lbl-legend-sent':      lb.status_sent    || 'Enviado',
    'lbl-nueva-sesion':     lb.registro || 'sesión',
    'lbl-btn-guardar':      lb.registro || 'sesión'
  };
  Object.keys(m).forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.textContent = m[id];
  });

  var pc = document.getElementById('seg-campo-contenido');
  var pt = document.getElementById('seg-campo-tareas');
  var pp = document.getElementById('seg-campo-proxima');
  if (pc) pc.placeholder = 'Describe el contenido de ' + (lb.registro || 'esta sesion') + '...';
  if (pt) pt.placeholder = (lb.tareas || 'Tareas o indicaciones') + '...';
  if (pp) pp.placeholder = 'Plan para la proxima ' + (lb.registro || 'sesion') + '...';
}

/* ─────────────────────────────────────────
   LISTA DE CLIENTES
───────────────────────────────────────── */
function segCargarClientes(companyId) {
  var listEl = document.getElementById('seg-entity-list');
  if (!listEl) { setTimeout(function(){ segCargarClientes(companyId); }, 100); return; }

  listEl.innerHTML = '<div class="seg-loading-row"><div class="seg-spinner"></div><span>Cargando...</span></div>';

  segFetch('/api/seguimiento/clientes?company_id=' + companyId, {}, function(data) {
    var lista = data.clientes || data || [];
    SEG.hayTodas     = lista;
    SEG.hayEntidades = lista;
    segRenderizarLista(lista);
    // Mostrar etiquetas de todos los pacientes para filtrar
    segRenderizarPanelEtiquetasFiltro(lista);
  }, function() {
    var el = document.getElementById('seg-entity-list');
    if (el) el.innerHTML = '<div class="seg-list-empty"><i class="fas fa-exclamation-circle"></i>Error al cargar.</div>';
  });
}

/* ─────────────────────────────────────────
   FILTROS AGENDA — Hoy / Semana / Todos
───────────────────────────────────────── */
var _segFiltroActivo  = 'hoy';
var _segAgendaActual  = []; // pacientes actualmente mostrados en la lista

function segRenderizarFiltrosAgenda(containerEl) {
  // Evitar duplicados — solo insertar si no existen aún
  if (containerEl.querySelector('.seg-agenda-filtros')) {
    // Solo actualizar activo
    containerEl.querySelectorAll('.seg-agenda-filtro-chip').forEach(function(c) {
      c.classList.toggle('activo', c.getAttribute('data-filtro') === _segFiltroActivo);
    });
    return;
  }
  var filtros = [
    { id: 'hoy',    label: 'Hoy' },
    { id: 'semana', label: 'Semana' },
    { id: 'todos',  label: 'Todos' },
  ];
  var html = '<div class="seg-agenda-filtros">' +
    filtros.map(function(f) {
      return '<span class="seg-agenda-filtro-chip' + (_segFiltroActivo === f.id ? ' activo' : '') + '" ' +
        'data-filtro="' + f.id + '" onclick="segCambiarFiltroAgendaEl(this)">' + f.label + '</span>';
    }).join('') +
  '</div>';
  containerEl.insertAdjacentHTML('afterbegin', html);
}

function segCambiarFiltroAgendaEl(el) {
  segCambiarFiltroAgenda(el.getAttribute('data-filtro') || 'hoy');
}

function segCambiarFiltroAgenda(filtro) {
  _segFiltroActivo = filtro;
  if (filtro === 'todos') {
    segFetch('/api/seguimiento/clientes?company_id=' + SEG.companyId, {}, function(data) {
      segRenderizarListaNormal(data.clientes || []);
    }, function() {});
  } else {
    segCargarAgendaDia(filtro);
  }
}

function segFormatFechaAgenda(fechaStr) {
  if (!fechaStr) return '';
  var d = new Date(fechaStr + 'T12:00:00');
  if (isNaN(d)) return '';
  var dias  = ['Do','Lu','Ma','Mi','Ju','Vi','Sá'];
  var meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  return dias[d.getDay()] + ' · ' + d.getDate() + ' ' + meses[d.getMonth()];
}

function segCargarAgendaDia(rango) {
  var listEl = document.getElementById('seg-entity-list');
  if (!listEl) return;
  var hoy = new Date();
  var fechaStr = hoy.getFullYear() + '-' +
    String(hoy.getMonth()+1).padStart(2,'0') + '-' +
    String(hoy.getDate()).padStart(2,'0');

  listEl.innerHTML = '<div class="seg-list-empty"><i class="fas fa-spinner fa-spin"></i> Cargando agenda...</div>';

  segFetch('/api/seguimiento/agenda-pacientes?company_id=' + SEG.companyId + '&rango=' + rango + '&fecha=' + fechaStr, {},
    function(data) {
      var pacientes = data.pacientes || [];
      if (!pacientes.length) {
        listEl.innerHTML = '<div class="seg-list-empty"><i class="fas fa-calendar-day"></i>' +
          (rango === 'hoy' ? 'Sin pacientes agendados hoy' : 'Sin pacientes en la semana') +
          '</div>';
        segRenderizarFiltrosAgenda(listEl);
        return;
      }
      var html = pacientes.map(function(p) {
        var active = (SEG.clienteId && SEG.clienteId === p.wa_id && SEG.citaId === (p.cita_id || null)) ? ' active' : '';
        var nombre = segEscape(p.nombre || p.wa_id);
        var avatar = p.avatar || '?';
        var metaParts = [];
        if (p.hora_inicio) metaParts.push('<span class="seg-entity-hora">' + p.hora_inicio + '</span>');
        if (p.servicio)    metaParts.push(segEscape(p.servicio));
        if (p.duracion)    metaParts.push(p.duracion + ' min');
        var meta = metaParts.join(' · ');
        var fechaMeta = segFormatFechaAgenda(p.fecha || '');

        var citaId = segEscape(p.cita_id || '');
        var citaStatus = segEscape(p.status || '');
        return '<div class="seg-entity-item seg-entity-item--agenda' + active + '" data-wa-id="' + segEscape(p.wa_id) + '" data-cita-id="' + citaId + '" data-cita-status="' + citaStatus + '"' +
          ' onclick="segSeleccionarCliente(\'' + segEscape(p.wa_id) + '\',\'' + nombre + '\',\'' + segEscape(avatar) + '\',\'' + citaId + '\',\'' + citaStatus + '\')">' +
          '<div class="seg-entity-avatar seg-entity-avatar--sm">' + segBuildAvatar(avatar) + '</div>' +
          '<div class="seg-entity-info">' +
            '<div class="seg-entity-name-row">' +
              '<span class="seg-entity-name">' + nombre + '</span>' +
              (fechaMeta ? '<span class="seg-entity-fecha">' + fechaMeta + '</span>' : '') +
            '</div>' +
            '<div class="seg-entity-meta">' + meta + '</div>' +
            '<div class="seg-cita-chips" onclick="event.stopPropagation()">' + segBuildCitaChips(citaId, p.status || '') + '</div>' +
          '</div>' +
        '</div>';
      }).join('');

      _segAgendaActual = pacientes;
      listEl.innerHTML = html;
      segRenderizarFiltrosAgenda(listEl);
    },
    function() {
      // Si falla (usuario sin agenda), cargar lista normal
      segFetch('/api/seguimiento/clientes?company_id=' + SEG.companyId, {}, function(data) {
        segRenderizarListaNormal(data.clientes || []);
      }, function() {});
    }
  );
}

function segRenderizarLista(lista) {
  _segFiltroActivo = 'hoy';
  // Al cargar empresa, arrancar con agenda del día
  segCargarAgendaDia('hoy');
}

function segRenderizarListaNormal(lista) {
  var listEl = document.getElementById('seg-entity-list');
  if (!listEl) return;
  var lb = SEG.labels;

  if (!lista || lista.length === 0) {
    listEl.innerHTML = '<div class="seg-list-empty"><i class="fas fa-user-slash"></i>No hay ' +
      (lb.clientes||'pacientes') + ' con registros</div>';
    segRenderizarFiltrosAgenda(listEl);
    return;
  }

  _segAgendaActual = lista;
  var html = lista.map(function(e) {
    var dot    = e.estado_registro === 'en_curso' ? 'dot-active'
               : e.estado_registro === 'enviado'  ? 'dot-sent' : 'dot-pending';
    var nombre = e.nombre || e.wa_id || '-';
    var avatar = e.avatar || '?';
    var active = (SEG.clienteId && SEG.clienteId === e.wa_id) ? ' active' : '';
    return '<div class="seg-entity-item' + active + '" data-wa-id="' + segEscape(e.wa_id) + '"' +
      ' onclick="segSeleccionarCliente(\'' + segEscape(e.wa_id) + '\',\'' + segEscape(nombre) + '\',\'' + segEscape(avatar) + '\')">' +
      '<div class="seg-entity-avatar">' + segBuildAvatar(avatar) + '</div>' +
      '<div class="seg-entity-info">' +
        '<div class="seg-entity-name">' + segEscape(nombre) + '</div>' +
        '<div class="seg-entity-meta">' + segBuildMeta(e, lb) + '</div>' +
      '</div>' +
      '<div class="seg-entity-dot ' + dot + '"></div>' +
    '</div>';
  }).join('');

  listEl.innerHTML = html;
  segRenderizarFiltrosAgenda(listEl);
}

function segBuildMeta(e, lb) {
  var parts = [];
  if (e.especialidad || e.servicio || e.tipo) parts.push(e.especialidad || e.servicio || e.tipo);
  return parts.join(' · ') || '-';
}

function segBuildAvatar(avatar) {
  if (!avatar) return '?';
  if (avatar.startsWith('http')) {
    return '<img src="' + avatar + '" class="seg-entity-avatar-img" alt="avatar" ' +
      'onerror="this.parentNode.innerHTML=\'?\'">'; 
  }
  return avatar;
}
/* ─────────────────────────────────────────
   CHIPS DE ESTADO DE CITA
───────────────────────────────────────── */
var _SEG_CITA_CHIPS = [
  { status: 'arrived', label: 'Presentado', icon: 'fa-user-check', tooltip: 'El paciente se presentó a la cita' },
  { status: 'no_show', label: 'Ausente',  icon: 'fa-user-times', tooltip: 'El paciente no se presentó a la cita' }
];

function segBuildCitaChips(citaId, currentStatus) {
  if (!citaId) return '';
  return _SEG_CITA_CHIPS.map(function(c) {
    var isActive = currentStatus === c.status;
    return '<span class="seg-cita-chip' + (isActive ? ' activo status-' + c.status : '') + '" ' +
      'data-cita-id="' + citaId + '" data-status="' + c.status + '" ' +

      'onclick="segActualizarCitaStatus(this)">' +
      '<i class="fas ' + c.icon + '"></i> ' + c.label +
    '</span>';
  }).join('');
}

var _segTipEl = null;
function segChipTooltipShow(el) {
  segChipTooltipHide();
  var text = el.getAttribute('data-tip');
  if (!text) return;
  var tip = document.createElement('span');
  tip.className = 'seg-tooltip-body';
  tip.textContent = text;
  document.body.appendChild(tip);
  _segTipEl = tip;
  var r = el.getBoundingClientRect();
  tip.style.opacity = '0';
  requestAnimationFrame(function() {
    var tw = tip.offsetWidth;
    var left = r.left + r.width / 2 - tw / 2;
    var top  = r.top - tip.offsetHeight - 6 + window.scrollY;
    if (left < 6) left = 6;
    if (left + tw > window.innerWidth - 6) left = window.innerWidth - tw - 6;
    tip.style.left = left + 'px';
    tip.style.top  = top + 'px';
    tip.style.opacity = '1';
  });
}
function segChipTooltipHide() {
  if (_segTipEl) { _segTipEl.remove(); _segTipEl = null; }
}

function segActualizarCitaStatus(el) {
  var citaId = el.getAttribute('data-cita-id');
  var status  = el.getAttribute('data-status');
  if (!citaId || !status) return;

  // Si ya está activo, no hacer nada
  if (el.classList.contains('activo')) return;

  var url    = status === 'cancelled'
    ? '/api/agenda/appointments/' + citaId + '/cancel'
    : '/api/agenda/appointments/' + citaId + '/status';
  var method = 'PATCH';
  var body   = status === 'cancelled' ? {} : { status: status };

  // Feedback optimista — marcar chip activo inmediatamente
  var container = el.closest('.seg-cita-chips');
  if (container) {
    container.querySelectorAll('.seg-cita-chip').forEach(function(c) {
      c.classList.remove('activo', 'status-arrived', 'status-no_show', 'status-cancelled');
    });
    el.classList.add('activo', 'status-' + status);
  }

  // Actualizar SEG.citaStatus si es la cita activa
  if (SEG.citaId && SEG.citaId === citaId) {
    SEG.citaStatus = status;
  }

  segFetch(url, { method: method, body: JSON.stringify(body) },
    function() {
      segToast('Estado actualizado', 'ok');
      // Actualizar data-cita-status en la tarjeta
      var card = el.closest('[data-cita-id]');
      if (card) card.setAttribute('data-cita-status', status);
    },
    function() {
      segToast('Error al actualizar estado', 'error');
      // Revertir feedback optimista
      if (container) {
        container.querySelectorAll('.seg-cita-chip').forEach(function(c) {
          c.classList.remove('activo', 'status-arrived', 'status-no_show', 'status-cancelled');
        });
      }
    }
  );
}

/* ─────────────────────────────────────────
   Actualizar clase active en lista sin re-renderizar
───────────────────────────────────────── */
function segActualizarActivoLista() {
  var listEl = document.getElementById('seg-entity-list');
  if (!listEl) return;
  listEl.querySelectorAll('.seg-entity-item').forEach(function(el) {
    var waId   = el.getAttribute('data-wa-id');
    var citaId = el.getAttribute('data-cita-id');
    var isActive = SEG.clienteId && waId === SEG.clienteId &&
                   (citaId || null) === SEG.citaId;
    el.classList.toggle('active', !!isActive);
  });
}