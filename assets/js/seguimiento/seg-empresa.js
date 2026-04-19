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

function segRenderizarLista(lista) {
  var listEl = document.getElementById('seg-entity-list');
  if (!listEl) return;
  var lb = SEG.labels;
  var bannerTxt = 'Solo <strong>' + (lb.clientes||'clientes') + '</strong> con <strong>' + (lb.registros||'registros') + '</strong>';

  if (!lista || lista.length === 0) {
    listEl.innerHTML =
      '<div class="seg-info-banner"><i class="fas fa-info-circle" style="flex-shrink:0;margin-top:1px"></i><span>' + bannerTxt + '</span></div>' +
      '<div class="seg-list-empty"><i class="fas fa-user-slash"></i>No hay ' + (lb.clientes||'clientes') + ' con ' + (lb.registros||'registros') + '</div>';
    return;
  }

  var html = '<div class="seg-info-banner"><i class="fas fa-info-circle" style="flex-shrink:0;margin-top:1px"></i><span>' + bannerTxt + '</span></div>';

  lista.forEach(function(e) {
    var dot = e.estado_registro === 'en_curso' ? 'dot-active'
            : e.estado_registro === 'enviado'  ? 'dot-sent'
            : 'dot-pending';
    var nombre  = e.nombre || e.wa_id || '-';
    var avatar  = e.avatar || (e.es_recurso ? '?' : '?');
    var meta    = segBuildMeta(e, lb);
    var active  = (SEG.clienteId && SEG.clienteId === e.wa_id) ? ' active' : '';

    html += '<div class="seg-entity-item' + active + '" data-wa-id="' + segEscape(e.wa_id) + '"' +
      ' onclick="segSeleccionarCliente(\'' + segEscape(e.wa_id) + '\',\'' + segEscape(nombre) + '\',\'' + segEscape(avatar) + '\')">' +
      '<div class="seg-entity-avatar">' + segBuildAvatar(avatar) + '</div>' +
      '<div class="seg-entity-info">' +
        '<div class="seg-entity-name">' + segEscape(nombre) + '</div>' +
        '<div class="seg-entity-meta">' + meta + '</div>' +
      '</div>' +
      '<div class="seg-entity-dot ' + dot + '"></div>' +
    '</div>';
  });

  listEl.innerHTML = html;
}

function segBuildMeta(e, lb) {
  var parts = [];
  if (e.total_registros) parts.push(e.total_registros + ' ' + (lb.registros||'registros'));
  if (e.especialidad || e.servicio || e.tipo) parts.push(e.especialidad || e.servicio || e.tipo);
  return parts.join(' - ') || '-';
}

function segBuildAvatar(avatar) {
  if (!avatar) return '?';
  if (avatar.startsWith('http')) {
    return '<img src="' + avatar + '" class="seg-entity-avatar-img" alt="avatar" ' +
      'onerror="this.parentNode.innerHTML=\'?\'">'; 
  }
  return avatar;
}