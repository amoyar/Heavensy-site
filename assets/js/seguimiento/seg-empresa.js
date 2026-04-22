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
        var active = (SEG.clienteId && SEG.clienteId === p.wa_id) ? ' active' : '';
        var nombre = segEscape(p.nombre || p.wa_id);
        var avatar = p.avatar || '?';
        var metaParts = [];
        if (p.hora_inicio) metaParts.push('<span class="seg-entity-hora">' + p.hora_inicio + '</span>');
        if (p.servicio)    metaParts.push(segEscape(p.servicio));
        if (p.duracion)    metaParts.push(p.duracion + ' min');
        var meta = metaParts.join(' · ');

        return '<div class="seg-entity-item' + active + '" data-wa-id="' + segEscape(p.wa_id) + '"' +
          ' onclick="segSeleccionarCliente(\'' + segEscape(p.wa_id) + '\',\'' + nombre + '\',\'' + segEscape(avatar) + '\')">' +
          '<div class="seg-entity-avatar">' + segBuildAvatar(avatar) + '</div>' +
          '<div class="seg-entity-info">' +
            '<div class="seg-entity-name">' + nombre + '</div>' +
            '<div class="seg-entity-meta">' + meta + '</div>' +
          '</div>' +
          '<div class="seg-entity-dot dot-active"></div>' +
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