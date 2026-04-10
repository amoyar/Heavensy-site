/* ═══════════════════════════════════════════════════════════
   HEAVENSY — MÓDULO SEGUIMIENTO
   assets/js/seguimiento.js
   Versión restaurada — funcional con Venus, resumen IA OK
═══════════════════════════════════════════════════════════ */

/* ─────────────────────────────────────────
   ESTADO GLOBAL
───────────────────────────────────────── */
var SEG = {
  companyId:            null,
  companyNombre:        null,
  clienteId:            null,
  registroId:           null,
  labels:               {},
  contexto:             null,
  hayEntidades:         [],
  hayTodas:             [],
  hayUnsaved:           false,
  tl_visible:           true,
  _toastTimer:          null,
  etiquetasDisponibles: [],
  etiquetasActivas:     [],
  _etiquetaFiltro:      [],
  _slashQuery:          '',
  _cal: { anio: null, mes: null, fechaSel: null },
  _tp:  { hora: null, min: null }
};

/* ─────────────────────────────────────────
   INIT
───────────────────────────────────────── */
function segInit() {
  var companyId = localStorage.getItem('company_id');
  if (!companyId) return;

  segInitCompanyDropdown();
  segCargarEmpresas(companyId);

  window.onCompanyChange = function(id, nom) {
    segSetCompany(id, nom);
  };
}

/* Dropdown idéntico al de conversaciones */
function segInitCompanyDropdown() {
  var btn   = document.getElementById('segCompanyDropdownBtn');
  var list  = document.getElementById('segCompanyDropdownList');
  var items = document.getElementById('segCompanyDropdownItems');
  var label = document.getElementById('segCompanyDropdownLabel');
  var icon  = document.getElementById('segCompanyDropdownIcon');
  var sel   = document.getElementById('segCompanyFilter');
  if (!btn || !sel) return;

  function buildItems() {
    items.innerHTML = '';
    Array.from(sel.options).forEach(function(opt) {
      var div = document.createElement('div');
      div.textContent = opt.text;
      div.dataset.value = opt.value;
      div.style.cssText = 'padding:7px 12px;font-size:13px;cursor:pointer;color:' + (opt.value ? '#374151' : '#9ca3af') + ';';
      div.addEventListener('mouseover', function() { this.style.background = '#EFF6FF'; });
      div.addEventListener('mouseout',  function() {
        this.style.background = sel.value === this.dataset.value ? '#EFF6FF' : '';
      });
      div.addEventListener('click', function() {
        sel.value = this.dataset.value;
        label.textContent = this.textContent;
        label.style.color = this.dataset.value ? '#374151' : '#9ca3af';
        list.style.opacity = '0';
        list.style.transform = 'translateY(-4px)';
        setTimeout(function() { list.style.display = 'none'; }, 180);
        icon.style.transform = '';
        highlightSelected();
        if (sel.value) segSetCompany(sel.value, this.textContent);
      });
      items.appendChild(div);
    });
    highlightSelected();
  }

  function highlightSelected() {
    Array.from(items.children).forEach(function(d) {
      var active = d.dataset.value === sel.value && sel.value !== '';
      d.style.background  = active ? '#EFF6FF' : '';
      d.style.color       = active ? '#7D84C1' : (d.dataset.value ? '#374151' : '#9ca3af');
      d.style.fontWeight  = active ? '600' : '400';
      d.style.borderLeft  = active ? '2px solid #7D84C1' : '';
      d.style.paddingLeft = active ? '10px' : '12px';
    });
  }

  btn.addEventListener('click', function(e) {
    e.stopPropagation();
    var open = list.style.display === 'block' && list.style.opacity !== '0';
    if (open) {
      list.style.opacity = '0';
      list.style.transform = 'translateY(-4px)';
      setTimeout(function() { list.style.display = 'none'; }, 180);
    } else {
      list.style.display = 'block';
      list.style.opacity = '0';
      list.style.transform = 'translateY(-4px)';
      list.style.transition = 'opacity 0.18s ease, transform 0.18s ease';
      requestAnimationFrame(function() {
        requestAnimationFrame(function() {
          list.style.opacity = '1';
          list.style.transform = 'translateY(0)';
        });
      });
    }
    icon.style.transform = open ? '' : 'rotate(180deg)';
  });

  document.addEventListener('click', function(e) {
    var wrap = document.getElementById('segCompanyDropdownWrap');
    if (wrap && !wrap.contains(e.target)) {
      list.style.opacity = '0';
      list.style.transform = 'translateY(-4px)';
      setTimeout(function() { list.style.display = 'none'; }, 180);
      icon.style.transform = '';
    }
  });

  // MutationObserver — igual que conversaciones
  new MutationObserver(function() {
    buildItems();
    label.textContent = 'Seleccione una empresa';
    label.style.color = '#9ca3af';
  }).observe(sel, { childList: true });

  // Si ya hay opciones (recarga), construir inmediatamente
  if (sel.options.length > 1) {
    buildItems();
    var cur = sel.options[sel.selectedIndex];
    label.textContent = (cur && cur.value) ? cur.text : 'Seleccione una empresa';
    label.style.color = (cur && cur.value) ? '#374151' : '#9ca3af';
  }
}

function segCargarEmpresas(defaultId) {
  // Solo poblar el select oculto — igual que poblarSelectorEmpresas en conversaciones
  // El MutationObserver en segInitCompanyDropdown se encarga del resto
  apiCall('/api/companies').then(function(res) {
    var companies = (res.ok && res.data && res.data.companies) ? res.data.companies : [];
    var sel = document.getElementById('segCompanyFilter');
    if (!sel) return;

    sel.innerHTML = '<option value="">Seleccione una empresa</option>';
    companies.forEach(function(c) {
      var opt = document.createElement('option');
      opt.value = c.company_id;
      opt.textContent = c.name || c.company_id;
      sel.appendChild(opt);
    });

    // Auto-seleccionar solo si hay una empresa
    if (companies.length === 1) {
      var c = companies[0];
      sel.value = c.company_id;
      var label = document.getElementById('segCompanyDropdownLabel');
      if (label) { label.textContent = c.name || c.company_id; label.style.color = '#374151'; }
      segSetCompany(c.company_id, c.name || c.company_id);
    }

  }).catch(function() {
    var label = document.getElementById('segCompanyDropdownLabel');
    if (label) label.textContent = 'Error al cargar empresas';
  });
}

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
    'lbl-tl-titulo':        lb.timeline_titulo || 'Linea de tiempo',
    'lbl-tl-titulo-edit':   lb.timeline_titulo || 'Linea de tiempo',
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

/* ─────────────────────────────────────────
   SELECCIONAR CLIENTE
───────────────────────────────────────── */
function segSeleccionarCliente(clienteId, nombre, avatar) {
  if (SEG.clienteId === clienteId) return;

  if (SEG.hayUnsaved) {
    segConfirm('Hay cambios sin guardar. ¿Continuar sin guardar?', function() {
      SEG.hayUnsaved = false;
      segSeleccionarCliente(clienteId, nombre, avatar);
    });
    return;
  }

  SEG.clienteId  = clienteId;
  SEG.registroId = null;
  SEG.hayUnsaved = false;
  SEG._canal     = 'whatsapp';

  // Limpiar estado residual del paciente anterior
  segLimpiarResumen();
  var badgeEnviado = document.getElementById('seg-enviado-badge');
  if (badgeEnviado) badgeEnviado.classList.add('seg-hidden');
  var btnEnviar = document.getElementById('seg-btn-enviar-cliente');
  if (btnEnviar) { btnEnviar.disabled = false; btnEnviar.innerHTML = '<i class="fas fa-paper-plane seg-icon-mr-sm"></i>Enviar al cliente'; }
  // Resetear canal chips
  document.querySelectorAll('.seg-canal-chip').forEach(function(c) { c.classList.remove('active'); });
  var waChip = document.querySelector('.seg-canal-chip[data-canal="whatsapp"]');
  if (waChip) waChip.classList.add('active');
  // Volver siempre al Tab 1
  segSetTab('notas', document.getElementById('seg-tab-notas'));

  // Marcar activo en lista
  document.querySelectorAll('.seg-entity-item').forEach(function(el) {
    el.classList.remove('active');
  });
  var target = document.querySelector('.seg-entity-item[data-wa-id="' + clienteId + '"]');
  if (target) target.classList.add('active');

  // Mostrar spinner mientras carga
  segMostrarCargandoContexto();

  // En móvil — colapsar panel izquierdo automáticamente al seleccionar paciente
  if (window.innerWidth <= 767 && SEG_LEFT_OPEN) {
    segToggleLeftPanel();
  }

  segFetch('/api/seguimiento/clientes/' + clienteId + '/contexto?company_id=' + SEG.companyId, {}, function(data) {
    SEG.contexto   = data;
    SEG.registroId = data.registro_activo ? data.registro_activo._id : null;
    segMostrarRegistroWrap();
    segRenderizarContexto(data);
    // Cargar intensidades del registro activo
    _segIntensidades = {};
    segCargarIntensidades();
    // Mostrar botón colapsar ahora que hay paciente
    var btnCol = document.getElementById('seg-btn-collapse-left');
    if (btnCol) btnCol.classList.remove('seg-hidden');
    if (btnCol) btnCol.classList.remove('seg-hidden');
  }, function() {
    segMostrarEmptyMain();
    segToast('Error al cargar el contexto', 'error');
  });
}

/* ─────────────────────────────────────────
   RENDERIZAR CONTEXTO
───────────────────────────────────────── */
function segRenderizarContexto(ctx) {
  var lb  = SEG.labels;
  var reg = ctx.registro_activo || {};
  var cli = ctx.cliente || {};

  // ── Hero enriquecido ──────────────────────────────
  var numSesiones = cli.total_registros || (ctx.historial ? ctx.historial.length : 0);
  var sub = (lb.registros || 'sesiones') + ': ' + numSesiones;
  if (cli.especialidad || cli.servicio) sub = (cli.especialidad || cli.servicio) + ' · ' + numSesiones + ' ' + (lb.registros || 'sesiones');

  // Chips de etiquetas frecuentes con conteo
  var chips = [];
  if (ctx.etiquetas_frecuentes && ctx.etiquetas_frecuentes.length > 0) {
    ctx.etiquetas_frecuentes.forEach(function(et) {
      chips.push({ cls: 'freq', label: et.nombre, valor: et.count });
    });
  }

  segSetHero(cli.avatar || '?', cli.nombre || cli.wa_id, sub, chips);

  // Nota destacada
  var notaEl = document.getElementById('seg-hero-nota');
  if (notaEl) {
    var nota = ctx.nota_destacada || '';
    if (nota) {
      notaEl.textContent = '"' + nota + (nota.length >= 80 ? '...' : '') + '"';
      notaEl.classList.remove('seg-hidden');
    } else {
      notaEl.classList.add('seg-hidden');
    }
  }

  var statusEl = document.getElementById('seg-hero-status');
  if (statusEl) {
    if (reg._id) {
      statusEl.classList.remove('seg-hidden');
      statusEl.textContent = reg.estado === 'en_curso' ? (lb.status_active||'En curso')
                           : reg.estado === 'enviado'  ? (lb.status_sent||'Enviado')
                           : (lb.status_pending||'Pendiente');
    } else {
      statusEl.classList.add('seg-hidden');
    }
  }

  segRenderizarTimeline(ctx.timeline||[], lb.timeline_titulo, lb.timeline_inicio);

  // Fecha y hora — cargar desde registro activo o poner hoy/ahora como default
  var badgeEl = document.getElementById('seg-badge-estado');
  var hoy = new Date();
  var fechaDefault = segFechaLocalHoy();
  var horaDefault  = hoy.getHours().toString().padStart(2,'0') + ':' +
                     (Math.floor(hoy.getMinutes()/5)*5).toString().padStart(2,'0');
  segSetFecha(reg.fecha || fechaDefault);
  segSetHora(reg.hora   || horaDefault);
  if (badgeEl) badgeEl.textContent = reg.estado === 'en_curso'
    ? (lb.status_active||'En curso') : (lb.status_pending||'Pendiente');

  // Notas privadas + etiquetas del registro
  // ctx.etiquetas = lista de strings disponibles del template
  // reg.etiquetas = lista de strings activas en este registro
  SEG.etiquetasDisponibles = (ctx.etiquetas || []).map(function(e) {
    return typeof e === 'string' ? e : (e.nombre || '');
  }).filter(Boolean);
  SEG.etiquetasActivas = (reg.etiquetas || []).map(function(e) {
    return typeof e === 'string' ? e : (e.nombre || '');
  }).filter(Boolean);
  var notasInput = document.getElementById('seg-campo-notas');
  if (notasInput) {
    notasInput.innerText = reg.notas_internas || '';
    segInicializarEditorNotas();
  }
  segLimpiarTodosChips();
  // Cargar chips guardados — primero los 3 tipos, luego trabajar como selecciones
  if (reg.chips_sintoma)     (reg.chips_sintoma||[]).forEach(function(c){ segAgregarChip('sintoma',c); });
  if (reg.chips_diagnostico) (reg.chips_diagnostico||[]).forEach(function(c){ segAgregarChip('diagnostico',c); });
  if (reg.chips_hipotesis)   (reg.chips_hipotesis||[]).forEach(function(c){ segAgregarChip('hipotesis',c); });
  // trabajar se carga directamente como selecciones (no como chips independientes)
  _segChips.trabajar = (reg.chips_trabajar || []).slice();
  segRenderizarSeccionTrabajar();
  segActualizarHeroChipsTrabajar();
  segRenderizarChipsEtiquetas();

  var tc = document.getElementById('seg-campo-contenido');
  var tt = document.getElementById('seg-campo-tareas');
  var tp = document.getElementById('seg-campo-proxima');
  if (tc) tc.value = reg.contenido_principal || '';
  if (tt) tt.value = reg.tareas || '';
  if (tp) tp.value = reg.proxima_cita || '';

  segRenderizarHistorial(ctx.historial||[], lb);
  segRenderizarEtiquetasActivas(ctx.etiquetas||[], lb);
  segCargarPlantillasContexto(ctx.plantillas || {});
  segCargarAdjuntosContexto(ctx.registro_activo ? (ctx.registro_activo.adjuntos || []) : []);

  var resumenTexto = reg.resumen_editado || reg.resumen_ia || reg.resumen;
  if (resumenTexto) segMostrarResumen(resumenTexto);
  else segLimpiarResumen();

  var progCount = (ctx.mensajes_programados||[]).filter(function(m){ return m.estado === 'pendiente'; }).length;
  var progEl = document.getElementById('seg-prog-count');
  if (progEl) progEl.textContent = progCount > 0 ? progCount + ' mensaje(s) pendiente(s)' : 'Sin mensajes pendientes';

  segRenderizarTLEdit(ctx.timeline||[], lb.timeline_titulo);

  var promBtn = document.getElementById('seg-btn-promover');
  if (promBtn) {
    if (cli.tipo_relacion === 'contacto') promBtn.classList.remove('seg-hidden');
    else promBtn.classList.add('seg-hidden');
  }
}

function segSetHero(avatar, nombre, sub, chips) {
  var avEl = document.getElementById('seg-hero-avatar');
  var nmEl = document.getElementById('seg-hero-name');
  var sbEl = document.getElementById('seg-hero-sub');
  var chEl = document.getElementById('seg-hero-chips');
  if (avEl) avEl.innerHTML = segBuildAvatar(avatar);
  if (nmEl) nmEl.textContent = nombre;
  if (sbEl) sbEl.textContent = sub;
  if (chEl) {
    chEl.innerHTML = chips.map(function(c) {
      return '<span class="seg-hchip seg-hchip-freq">' +
        segEscape(c.label) + ' · <strong>' + c.valor + '</strong>' +
      '</span>';
    }).join('');
  }
}

function segRenderizarNotasDisplay(reg, lb, etiquetas) {
  var el = document.getElementById('seg-notas-display');
  if (!el) return;
  var notas = reg.notas_internas;
  if (!notas) { el.innerHTML = '<span style="color:#b0b9c8;font-size:11px">Sin notas internas.</span>'; return; }
  var html = segEscape(notas);
  etiquetas.forEach(function(et) {
    if (!et.nombre) return;
    var cls = et.tipo === 1 ? 't1' : et.tipo === 2 ? 't2' : 't3';
    var re = new RegExp('(' + segEscapeRegex(et.nombre) + ')', 'gi');
    html = html.replace(re, '<span class="seg-etiqueta-inline ' + cls + '">$1</span>');
  });
  el.innerHTML = html;
}

function segRenderizarTimeline(eventos, titulo, inicio) {
  var tlTitle = document.getElementById('seg-tl-titulo');
  if (tlTitle) tlTitle.textContent = titulo || 'Linea de tiempo';
  var tlEditTitle = document.getElementById('seg-tl-titulo-edit');
  if (tlEditTitle) tlEditTitle.textContent = titulo || 'Linea de tiempo';
  var tlEl = document.getElementById('seg-tl-events');
  if (!tlEl) return;
  if (!eventos || eventos.length === 0) {
    tlEl.innerHTML = '<div style="font-size:10px;color:#b0b9c8;padding:0 4px">' + (inicio||'Sin eventos') + '</div>';
    return;
  }
  tlEl.innerHTML = eventos.map(function(ev, i) {
    var isFirst = i === 0, isLast = i === eventos.length - 1;
    var dotCls = isFirst ? 'birth' : isLast ? 'today' : '';
    var clr = isLast ? 'color:#9961FF' : '';
    var html = '<div class="seg-tl-item">' +
      '<div class="seg-tl-dot ' + dotCls + '"></div>' +
      '<div class="seg-tl-year" style="' + clr + '">' + segEscape(String(ev.year||ev.anio||'')) + '</div>' +
      '<div class="seg-tl-label" style="' + clr + '" data-seg-tooltip="' + segEscape(ev.label||ev.titulo||'') + '">' + segEscape(ev.label||ev.titulo||'') + '</div>' +
    '</div>';
    if (!isLast) html += '<div class="seg-tl-line"></div>';
    return html;
  }).join('');
}

function segRenderizarHistorial(historial, lb) {
  var el = document.getElementById('seg-historial-list');
  if (!el) return;
  if (!historial || historial.length === 0) {
    el.innerHTML = '<div style="font-size:10px;color:#b0b9c8">Sin ' + (lb.registros||'registros') + ' anteriores.</div>';
    return;
  }
  el.innerHTML = historial.map(function(h, i) {
    var rid      = h._id || h.id || '';
    var badgeCls = h.estado === 'enviado' ? 'enviado' : h.estado === 'en_curso' ? 'nueva' : 'pendiente';
    var badgeTxt = h.estado === 'enviado' ? 'Enviado' : h.estado === 'en_curso' ? 'En curso' : 'Pendiente';
    var preview  = h.resumen_corto || h.contenido_principal || '';
    var tags     = (h.etiquetas||[]).map(function(t){
      return '<span class="seg-hist-tag">' + segEscape(typeof t === 'string' ? t : (t.nombre||'')) + '</span>';
    }).join('');
    return '<div class="seg-hist-card' + (i===0?' active':'') + '" id="hist-' + segEscape(rid) + '">' +
      '<div class="seg-hist-card-top" onclick="segSeleccionarRegistro(\'' + segEscape(rid) + '\')">' +
        '<div class="seg-hist-date">' + segFormatFechaCorta(h.fecha) + '</div>' +
        '<button class="seg-hist-delete-btn" title="Eliminar sesión" ' +
          'onclick="event.stopPropagation();segMostrarConfirmEliminar(\'' + segEscape(rid) + '\')">' +
          '<i class="fas fa-trash"></i>' +
        '</button>' +
      '</div>' +
      '<div class="seg-hist-preview" onclick="segSeleccionarRegistro(\'' + segEscape(rid) + '\')">' + segEscape(preview) + '</div>' +
      (tags ? '<div class="seg-hist-tags" onclick="segSeleccionarRegistro(\'' + segEscape(rid) + '\')">' + tags + '</div>' : '') +
      '<span class="seg-hist-badge ' + badgeCls + '" onclick="segSeleccionarRegistro(\'' + segEscape(rid) + '\')">' + badgeTxt + '</span>' +
      // Panel de confirmación inline (oculto por defecto)
      '<div class="seg-hist-confirm seg-hidden" id="confirm-' + segEscape(rid) + '">' +
        '<div class="seg-hist-confirm-msg">' +
          '<i class="fas fa-exclamation-triangle"></i>' +
          '¿Eliminar esta ' + segEscape(lb.registro||'sesión') + '? ' +
          'Se borrará permanentemente y no se puede recuperar.' +
        '</div>' +
        '<div class="seg-hist-confirm-btns">' +
          '<button class="seg-hist-confirm-cancel" onclick="segCancelarConfirmEliminar(\'' + segEscape(rid) + '\')">Cancelar</button>' +
          '<button class="seg-hist-confirm-ok" onclick="segConfirmarEliminar(\'' + segEscape(rid) + '\')">Eliminar</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }).join('');
}

function segRenderizarPanelEtiquetasFiltro(lista) {
  // Recopilar todas las etiquetas únicas de todos los pacientes
  var todasEtiquetas = [];
  (lista || []).forEach(function(e) {
    (e.etiquetas || []).forEach(function(et) {
      var nombre = typeof et === 'string' ? et : (et.nombre || '');
      if (nombre && todasEtiquetas.indexOf(nombre) === -1) {
        todasEtiquetas.push(nombre);
      }
    });
  });
  todasEtiquetas.sort();

  var wrap  = document.getElementById('seg-lp-etiquetas-wrap');
  var chips = document.getElementById('seg-lp-etiquetas-chips');
  if (!wrap || !chips) return;

  if (!todasEtiquetas.length) {
    wrap.classList.add('seg-hidden');
    return;
  }
  wrap.classList.remove('seg-hidden');
  segRenderizarChipsFiltro(todasEtiquetas);
}

function segRenderizarChipsFiltro(todasEtiquetas) {
  var chips = document.getElementById('seg-lp-etiquetas-chips');
  if (!chips) return;
  var hayFiltro = SEG._etiquetaFiltro && SEG._etiquetaFiltro.length > 0;
  var html = todasEtiquetas.map(function(nombre) {
    var activa = SEG._etiquetaFiltro.indexOf(nombre) !== -1;
    return '<span class="seg-lp-etiqueta-chip' + (activa ? ' activa' : '') + '"' +
      ' onclick="segFiltrarPorEtiqueta(\'' + segEscape(nombre) + '\')">' +
      (activa ? '<i class="fas fa-check" style="font-size:8px;margin-right:2px"></i>' : '') +
      segEscape(nombre) +
      '</span>';
  }).join('');
  if (hayFiltro) {
    html += '<span class="seg-lp-etiqueta-chip seg-lp-etiqueta-limpiar"' +
      ' onclick="segLimpiarFiltroEtiquetas()">' +
      '<i class="fas fa-times" style="font-size:8px;margin-right:2px"></i>Limpiar' +
      '</span>';
  }
  chips.innerHTML = html;
}

function segRenderizarEtiquetasActivas(etiquetas, lb) {
  // Solo re-renderiza los chips del panel de filtro manteniendo estado
  // Reconstruye la lista de todas las etiquetas de todos los pacientes
  var todasEtiquetas = [];
  (SEG.hayTodas || []).forEach(function(e) {
    (e.etiquetas || []).forEach(function(et) {
      var nombre = typeof et === 'string' ? et : (et.nombre || '');
      if (nombre && todasEtiquetas.indexOf(nombre) === -1) todasEtiquetas.push(nombre);
    });
  });
  todasEtiquetas.sort();
  if (todasEtiquetas.length) segRenderizarChipsFiltro(todasEtiquetas);
}

function segRenderizarTLEdit(eventos, titulo) {
  var el = document.getElementById('seg-tl-edit-list');
  if (!el) return;
  if (!eventos || eventos.length === 0) {
    el.innerHTML = '<div style="font-size:11px;color:#b0b9c8">Sin eventos registrados.</div>';
    return;
  }
  el.innerHTML = eventos.map(function(ev, i) {
    return '<div style="display:flex;align-items:center;gap:8px;padding:7px 10px;background:#f9fafb;border:0.5px solid #e5e7eb;border-radius:8px">' +
      '<span style="font-size:11px;font-weight:700;color:#9961FF;min-width:44px">' + segEscape(String(ev.year||ev.anio||'')) + '</span>' +
      '<span style="font-size:12px;color:#374151;flex:1">' + segEscape(ev.label||ev.titulo||'') + '</span>' +
      '<button onclick="segEliminarEvento(\'' + segEscape(ev._id||String(i)) + '\')" style="background:none;border:none;color:#9ca3af;cursor:pointer;font-size:11px;padding:2px 4px">' +
        '<i class="fas fa-times"></i>' +
      '</button>' +
    '</div>';
  }).join('');
}


/* ─────────────────────────────────────────
   SISTEMA INLINE — CHIPS NOTAS CLÍNICAS
   /palabra → Síntoma (rosado)
   /dpalabra → Diagnóstico (azul, solo existentes)
   "texto" → Hipótesis (morado)
   Espacio confirma la sugerencia inline
───────────────────────────────────────── */

var _segSug = { actual: null, esDiag: false };
var _segHipMode = false; // true cuando hay una " abierta esperando cierre
var _segDiagMode  = false; // true cuando hay // abierto esperando cierre
var _segDiagTimer = null;
var _segDiagMatches = [];
var _segDiagIdx    = -1;

function _segSinTilde(s) {
  return (s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
}

function _segGetTextBeforeCursor(el) {
  var sel = window.getSelection();
  if (!sel.rangeCount) return '';
  var range = sel.getRangeAt(0).cloneRange();
  range.selectNodeContents(el);
  range.setEnd(sel.getRangeAt(0).endContainer, sel.getRangeAt(0).endOffset);
  return range.toString();
}

function _segLimpiarSugerencia() {
  var sug = document.querySelector('#seg-campo-notas .seg-inline-sug');
  if (sug) sug.remove();
  _segSug.actual = null;
}

function _segMostrarSugerencia(resto) {
  _segLimpiarSugerencia();
  if (!resto) return;
  var sel = window.getSelection();
  if (!sel.rangeCount) return;
  var range = sel.getRangeAt(0).cloneRange();
  var span = document.createElement('span');
  span.className = 'seg-inline-sug';
  span.textContent = resto;
  span.contentEditable = 'false';
  range.insertNode(span);
  range.setStartBefore(span);
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
}

function _segConfirmarTag(tag, afterSlash) {
  _segLimpiarSugerencia();
  var editor = document.getElementById('seg-campo-notas');
  if (!editor) return;
  var sel = window.getSelection();
  var gris = '<span style="color:#d0d3e0" contenteditable="false">';
  var esDiag = afterSlash.slice(0, 2).toLowerCase() === 'dx' && afterSlash.length > 2;
  var prefijoGris = esDiag ? gris + '/dx</span>' : gris + '/</span>';
  var reemplazo = prefijoGris + '<span style="color:#374151">' + tag + '</span>\u00a0';

  var html = editor.innerHTML.replace(/<span class="seg-inline-sug"[^>]*>.*?<\/span>/gi, '');

  var idx = -1;
  for (var i = html.length - 1; i >= 0; i--) {
    if (html[i] === '/' && html[i-1] !== '<') { idx = i; break; }
  }

  if (idx !== -1) {
    var fin = idx + 1;
    while (fin < html.length && html[fin] !== '<' && html[fin] !== '\u00a0' && html[fin] !== ' ') fin++;
    editor.innerHTML = html.slice(0, idx) + reemplazo + html.slice(fin);
  } else {
    editor.innerHTML = html + reemplazo;
  }

  var range = document.createRange();
  range.selectNodeContents(editor);
  range.collapse(false);
  sel.removeAllRanges();
  sel.addRange(range);
}

/* ── Dropdown diagnósticos ── */
function _segDiagDropdownMostrar(matches) {
  // En móvil usar bottom sheet
  if (_segEsMobil()) {
    segDiagSheetAbrir(matches);
    return;
  }

  var dd = document.getElementById('seg-diag-dropdown');
  if (!dd) return;

  _segDiagIdx = 0; // primer item activo por defecto

  if (!matches || !matches.length) {
    dd.innerHTML = '<div class="seg-diag-dd-empty">Sin resultados — escribe más</div>';
    _segDiagDropdownPositionar();
    dd.classList.remove('seg-hidden');
    return;
  }

  var html = '<div class="seg-diag-dd-header">Diagnósticos CIE — <kbd>↑↓</kbd> navegar · <kbd>Tab</kbd> seleccionar</div>';
  html += matches.map(function(d, i) {
    return '<div class="seg-diag-dd-item' + (i === 0 ? ' activo' : '') + '"' +
      ' data-idx="' + i + '"' +
      ' onclick="_segDiagDropdownSelec(' + i + ')">' +
      '<span class="seg-diag-dd-codigo">' + segEscape(d.codigo || '—') + '</span>' +
      '<span class="seg-diag-dd-nombre">' + segEscape(d.nombre) + '</span>' +
      '</div>';
  }).join('');
  html += '<div class="seg-diag-dd-hint"><kbd>Tab</kbd> seleccionar · <kbd>Esc</kbd> cancelar · <kbd>//</kbd> confirmar texto libre</div>';

  dd.innerHTML = html;
  _segDiagDropdownPositionar();
  dd.classList.remove('seg-hidden');
}

function _segDiagDropdownPositionar() {
  var dd = document.getElementById('seg-diag-dropdown');
  if (!dd) return;
  var sel = window.getSelection();
  if (!sel || !sel.rangeCount) return;
  var rect = sel.getRangeAt(0).getBoundingClientRect();
  var top  = rect.bottom + 6;
  var left = rect.left;
  // Ajustar si se sale de la pantalla
  if (left + 400 > window.innerWidth) left = window.innerWidth - 410;
  if (top + 280 > window.innerHeight) top = rect.top - 270;
  dd.style.top  = top + 'px';
  dd.style.left = left + 'px';
}

function _segDiagDropdownNavegar(dir) {
  var dd = document.getElementById('seg-diag-dropdown');
  if (!dd || dd.classList.contains('seg-hidden')) return false;
  var items = dd.querySelectorAll('.seg-diag-dd-item');
  if (!items.length) return false;
  items[_segDiagIdx] && items[_segDiagIdx].classList.remove('activo');
  _segDiagIdx = Math.max(0, Math.min(items.length - 1, _segDiagIdx + dir));
  items[_segDiagIdx] && items[_segDiagIdx].classList.add('activo');
  items[_segDiagIdx] && items[_segDiagIdx].scrollIntoView({ block: 'nearest' });
  return true;
}

function _segDiagDropdownSelec(idx) {
  var match = _segDiagMatches[idx !== undefined ? idx : _segDiagIdx];
  if (!match) {
    // Confirmar texto libre si no hay match
    _segDiagDropdownConfirmarLibre();
    return;
  }
  var chipNombre = match.nombre + ' (' + match.codigo + ')';
  _segDiagDropdownCerrar();
  _segDiagConfirmarChip(chipNombre, match.nombre);
}

function _segDiagDropdownConfirmarLibre() {
  var editor = document.getElementById('seg-campo-notas');
  if (!editor) return;
  var fullText   = _segGetTextBeforeCursor(editor);
  var dobleBarra = fullText.lastIndexOf('//');
  var diagTexto  = dobleBarra !== -1 ? fullText.slice(dobleBarra + 2).trim() : '';
  if (!diagTexto) { _segDiagDropdownCerrar(); return; }
  var chipNombre = diagTexto.charAt(0).toUpperCase() + diagTexto.slice(1);
  _segDiagDropdownCerrar();
  _segDiagConfirmarChip(chipNombre, diagTexto);
}

function _segDiagConfirmarChip(chipNombre, textoRaw) {
  var editor = document.getElementById('seg-campo-notas');
  if (!editor) return;
  _segDiagMode = false;
  _segLimpiarSugerencia();

  var html = editor.innerHTML.replace(/<span class="seg-inline-sug"[^>]*>.*?<\/span>/gi, '');
  var pos  = html.lastIndexOf('//');
  if (pos !== -1) {
    var gris     = '<span style="color:#d0d3e0" contenteditable="false">';
    var remplazo = gris + '//</span><span style="color:#374151">' + textoRaw + '</span>' + gris + '//</span>\u00a0';
    var fin      = pos + 2 + textoRaw.length;
    editor.innerHTML = html.slice(0, pos) + remplazo + html.slice(fin > html.length ? html.length : fin);
  }
  try {
    var sel = window.getSelection();
    var r   = document.createRange();
    r.selectNodeContents(editor);
    r.collapse(false);
    sel.removeAllRanges();
    sel.addRange(r);
  } catch(e) { /* foco no disponible — ignorar */ }

  segAgregarChip('diagnostico', chipNombre);
  segMarcarCambios();
}

function _segDiagDropdownCerrar() {
  var dd = document.getElementById('seg-diag-dropdown');
  if (dd) { dd.classList.add('seg-hidden'); dd.innerHTML = ''; }
  _segDiagIdx = -1;
}

// Cerrar al hacer click fuera
document.addEventListener('click', function(e) {
  var dd = document.getElementById('seg-diag-dropdown');
  var ed = document.getElementById('seg-campo-notas');
  if (!dd || dd.classList.contains('seg-hidden')) return;
  if (!dd.contains(e.target) && e.target !== ed) {
    _segDiagDropdownCerrar();
    _segDiagMode = false;
  }
});

// Navegar dropdown con flechas aunque el foco esté en otro lugar
document.addEventListener('keydown', function(e) {
  var dd = document.getElementById('seg-diag-dropdown');
  if (!dd || dd.classList.contains('seg-hidden')) return;
  if (e.key === 'ArrowDown') { e.preventDefault(); _segDiagDropdownNavegar(1); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); _segDiagDropdownNavegar(-1); }
  else if (e.key === 'Tab' || e.key === 'Enter') {
    e.preventDefault();
    if (_segDiagMatches.length) _segDiagDropdownSelec(_segDiagIdx >= 0 ? _segDiagIdx : 0);
    else _segDiagDropdownConfirmarLibre();
  } else if (e.key === 'Escape') {
    _segDiagDropdownCerrar();
    _segDiagMode = false;
  }
});

function segInicializarEditorNotas() {
  var editor = document.getElementById('seg-campo-notas');
  if (!editor) return;
  var nuevo = editor.cloneNode(true);
  editor.parentNode.replaceChild(nuevo, editor);
  editor = nuevo;

  editor.addEventListener('input', function(e) {
    _segLimpiarSugerencia();
    _segSug.actual = null;

    var editorEl = this;

    // Detectar // usando e.data (funciona en Android Chrome con teclado virtual)
    if (!_segDiagMode) {
      var charInsertado = (e && e.data) ? e.data : '';
      if (charInsertado === '/') {
        // Leer texto completo del editor para ver si hay // reciente
        var textoCompleto = editorEl.textContent || editorEl.innerText || '';
        var idx = textoCompleto.lastIndexOf('//');
        if (idx !== -1) {
          var despues = textoCompleto.slice(idx + 2);
          if (despues.indexOf(' ') === -1) {
            _segDiagMode = true;
            _segDiagMatches = [];
            _segDiagIdx = -1;
            _segSug.actual = null;
          }
        }
      }
    }

    var fullText = _segGetTextBeforeCursor(editorEl);

    // Modo diagnóstico activo — buscar en API con el texto escrito
    if (_segDiagMode) {
      var textoFull  = editorEl.textContent || editorEl.innerText || '';
      var dobleBarra = textoFull.lastIndexOf('//');
      var query      = dobleBarra !== -1 ? textoFull.slice(dobleBarra + 2).trim() : '';
      if (query.length >= 2) {
        clearTimeout(_segDiagTimer);
        _segDiagTimer = setTimeout(function() {
          segFetch('/api/seguimiento/diagnosticos?q=' + encodeURIComponent(query) + '&limit=8', {},
            function(data) {
              _segDiagMatches = data.diagnosticos || [];
              _segDiagDropdownMostrar(_segDiagMatches);
            },
            function() {
              _segDiagDropdownMostrar([]);
            }
          );
        }, 300);
      } else if (query.length === 0) {
        _segDiagDropdownCerrar();
      }
      segMarcarCambios();
      return;
    }

    var texto = _segGetTextBeforeCursor(this);
    var lastSlash = texto.lastIndexOf('/');
    if (lastSlash === -1) { segMarcarCambios(); return; }
    var afterSlash = texto.slice(lastSlash + 1);
    if (afterSlash.indexOf(' ') !== -1 || afterSlash.indexOf('\u00a0') !== -1 || afterSlash.indexOf('\n') !== -1) { segMarcarCambios(); return; }

    // Solo síntomas con /palabra
    var query = afterSlash;
    var matches = query.length === 0
      ? SEG.etiquetasDisponibles.slice(0, 8)
      : SEG.etiquetasDisponibles.filter(function(t) {
          return _segSinTilde(t).replace(/\s+/g,'').indexOf(_segSinTilde(query).replace(/\s+/g,'')) === 0;
        });
    if (!matches.length) { segMarcarCambios(); return; }
    _segSug.actual = matches[0];
    var restoReal = matches[0].slice(query.length);
    if (restoReal) _segMostrarSugerencia(restoReal);
    segMarcarCambios();
  });

  editor.addEventListener('keydown', function(e) {

    // ── Manejo de "/" — detectar doble barra para diagnósticos ──
    if (e.key === '/') {
      if (!_segDiagMode) {
        var textoAntes = _segGetTextBeforeCursor(this);
        if (textoAntes.slice(-1) === '/') {
          _segDiagMode = true;
          _segDiagMatches = [];
          _segDiagIdx = -1;
          _segSug.actual = null;
        }
      } else {
        // Segunda '//' cierra con texto libre
        e.preventDefault();
        _segDiagDropdownConfirmarLibre();
        return;
      }
    }

    // ── Navegación dropdown con flechas ──
    if (_segDiagMode) {
      var dd = document.getElementById('seg-diag-dropdown');
      var ddVisible = dd && !dd.classList.contains('seg-hidden');
      if (ddVisible && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
        e.preventDefault(); return; // lo maneja el listener de document
      }
      if (e.key === 'ArrowDown') { e.preventDefault(); _segDiagDropdownNavegar(1); return; }
      if (e.key === 'ArrowUp')   { e.preventDefault(); _segDiagDropdownNavegar(-1); return; }
      if (e.key === 'Tab') {
        e.preventDefault();
        if (_segDiagMatches.length) _segDiagDropdownSelec(_segDiagIdx >= 0 ? _segDiagIdx : 0);
        else _segDiagDropdownConfirmarLibre();
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (_segDiagMatches.length) _segDiagDropdownSelec(_segDiagIdx >= 0 ? _segDiagIdx : 0);
        else _segDiagDropdownConfirmarLibre();
        return;
      }
      if (e.key === 'Escape') {
        _segDiagMode = false;
        _segDiagDropdownCerrar();
        return;
      }
    }

    // ── Hipótesis con "texto" ──
    if (e.key === '"') {
      if (!_segHipMode) {
        _segHipMode = true;
        return;
      } else {
        var textoActual = _segGetTextBeforeCursor(this);
        var primerComilla = textoActual.lastIndexOf('"');
        if (primerComilla !== -1) {
          var hipTexto = textoActual.slice(primerComilla + 1).trim();
          if (hipTexto.length > 0) {
            e.preventDefault();
            _segHipMode = false;
            segAgregarChip('hipotesis', hipTexto);
            var html = this.innerHTML;
            var grisSpan = '<span style="color:#d0d3e0" contenteditable="false">';
            var reemplazo = grisSpan + '"</span><span style="color:#374151">' + hipTexto + '</span>' + grisSpan + '"</span>';
            var pos = html.lastIndexOf('"' + hipTexto);
            if (pos !== -1) {
              this.innerHTML = html.slice(0, pos) + reemplazo + html.slice(pos + ('"' + hipTexto).length);
              var sel2 = window.getSelection();
              var r2 = document.createRange();
              r2.selectNodeContents(this);
              r2.collapse(false);
              sel2.removeAllRanges();
              sel2.addRange(r2);
            }
            return;
          }
        }
        _segHipMode = false;
        return;
      }
    }

    // ── Espacio — confirmar síntoma ──
    if (e.key === ' ') {
      if (_segDiagMode) return; // en modo diag, el espacio es parte del texto
      var sug = document.querySelector('#seg-campo-notas .seg-inline-sug');
      var sugTexto = sug ? sug.textContent : '';
      var textoCompleto = _segGetTextBeforeCursor(this);
      var texto = sugTexto && textoCompleto.endsWith(sugTexto)
        ? textoCompleto.slice(0, -sugTexto.length)
        : textoCompleto;
      var lastSlash = texto.lastIndexOf('/');
      if (lastSlash === -1) return;
      var afterSlash = texto.slice(lastSlash + 1);
      if (afterSlash.indexOf(' ') !== -1 || afterSlash.indexOf('\u00a0') !== -1) return;
      var query = afterSlash;
      if (!query || query.length < 1) return;

      var tagMatch =
        SEG.etiquetasDisponibles.filter(function(t) {
          return _segSinTilde(t).replace(/\s+/g,'') === _segSinTilde(query).replace(/\s+/g,'');
        })[0]
        || (_segSug.actual && _segSinTilde(_segSug.actual).replace(/\s+/g,'').indexOf(_segSinTilde(query).replace(/\s+/g,'')) === 0 ? _segSug.actual : null)
        || SEG.etiquetasDisponibles.filter(function(t) {
          return _segSinTilde(t).replace(/\s+/g,'').indexOf(_segSinTilde(query).replace(/\s+/g,'')) === 0;
        })[0]
        || (query.length > 1 ? query.charAt(0).toUpperCase() + query.slice(1) : null);

      if (!tagMatch) return;
      e.preventDefault();
      _segConfirmarTag(tagMatch, afterSlash);
      segAgregarChip('sintoma', tagMatch);
      if (SEG.etiquetasActivas.indexOf(tagMatch) === -1) {
        SEG.etiquetasActivas.push(tagMatch);
        segRenderizarChipsEtiquetas();
        if (SEG.etiquetasDisponibles.indexOf(tagMatch) === -1) {
          SEG.etiquetasDisponibles.push(tagMatch);
          segFetch('/api/seguimiento/etiquetas',
            { method: 'POST', body: JSON.stringify({ company_id: SEG.companyId, nombre: tagMatch }) },
            function() {}, function() {}
          );
        }
      }
      _segSug.actual = null;
      segMarcarCambios();
      return;
    }

    if (e.key === 'Escape') {
      _segLimpiarSugerencia();
      _segSug.actual = null;
      _segHipMode  = false;
      _segDiagMode = false;
      _segDiagDropdownCerrar();
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      _segLimpiarSugerencia();
      _segSug.actual = null;
      var sel3 = window.getSelection();
      if (sel3.rangeCount) {
        var range3 = sel3.getRangeAt(0);
        range3.deleteContents();
        var br = document.createElement('br');
        range3.insertNode(br);
        range3.setStartAfter(br);
        range3.collapse(true);
        sel3.removeAllRanges();
        sel3.addRange(range3);
      }
      segMarcarCambios();
    }
  });

  editor.addEventListener('keyup', function() {
    var sug = document.querySelector('#seg-campo-notas .seg-inline-sug');
    if (!sug || !_segSug.actual) return;
    var texto = _segGetTextBeforeCursor(this);
    var lastSlash = texto.lastIndexOf('/');
    if (lastSlash === -1) return;
    var afterSlash = texto.slice(lastSlash + 1);
    var esDiag = afterSlash.slice(0, 2).toLowerCase() === 'dx' && afterSlash.length > 2;
    var query  = esDiag ? afterSlash.slice(2) : afterSlash;
    if (_segSinTilde(query.replace(/\s+/g,'')) === _segSinTilde(_segSug.actual.replace(/\s+/g,''))) {
      sug.style.color = '#374151'; sug.style.fontWeight = '500';
    } else {
      sug.style.color = '#c4b5b5'; sug.style.fontWeight = 'normal';
    }
  });
}

function segCerrarSlash() {
  _segLimpiarSugerencia();
  _segSug.actual = null;
}

/* ── 4 SECCIONES DE CHIPS ── */
var _segChips = { sintoma: [], diagnostico: [], hipotesis: [], trabajar: [] };

function segAgregarChip(tipo, nombre) {
  if (!nombre) return;
  nombre = nombre.trim();
  if (!nombre) return;
  if (tipo === 'trabajar') {
    // trabajar solo se agrega via toggle — ignorar llamadas directas
    if (_segChips.trabajar.indexOf(nombre) === -1) {
      _segChips.trabajar.push(nombre);
      segRenderizarSeccionTrabajar();
      segMarcarCambios();
    }
    return;
  }
  if (_segChips[tipo] && _segChips[tipo].indexOf(nombre) === -1) {
    _segChips[tipo].push(nombre);
    segRenderizarSeccionChips(tipo);
    segRenderizarSeccionTrabajar(); // auto-actualizar "lo que abordaremos"
    segMarcarCambios();
  }
}

function segQuitarChip(tipo, nombre) {
  if (!_segChips[tipo]) return;
  _segChips[tipo] = _segChips[tipo].filter(function(c) { return c !== nombre; });
  // Si se quita de síntoma/diagnóstico/hipótesis, también quitar de trabajar si estaba
  if (tipo !== 'trabajar') {
    _segChips.trabajar = _segChips.trabajar.filter(function(c) { return c !== nombre; });
    segRenderizarSeccionTrabajar();
  }
  segRenderizarSeccionChips(tipo);
  segMarcarCambios();
}

function segEditarChipHipotesis(nombre) {
  segPrompt('Editar hipótesis', nombre, function(nuevoNombre) {
    nuevoNombre = (nuevoNombre || '').trim();
    if (!nuevoNombre || nuevoNombre === nombre) return;
    var idx = _segChips.hipotesis.indexOf(nombre);
    if (idx !== -1) _segChips.hipotesis[idx] = nuevoNombre;
    // Actualizar en trabajar si estaba
    var idxT = _segChips.trabajar.indexOf(nombre);
    if (idxT !== -1) _segChips.trabajar[idxT] = nuevoNombre;
    segRenderizarSeccionChips('hipotesis');
    segRenderizarSeccionTrabajar();
    segMarcarCambios();
  });
}

function segEliminarChipHipotesis(nombre) {
  segConfirm('¿Eliminar esta hipótesis?', function() {
    segQuitarChip('hipotesis', nombre);
  });
}

function segToggleTrabajar(nombre) {
  var idx = _segChips.trabajar.indexOf(nombre);
  if (idx !== -1) {
    _segChips.trabajar.splice(idx, 1);
  } else {
    _segChips.trabajar.push(nombre);
  }
  segRenderizarSeccionTrabajar();
  segActualizarHeroChipsTrabajar();
  segMarcarCambios();
}

function segActualizarHeroChipsTrabajar() {
  var chEl = document.getElementById('seg-hero-chips');
  if (!chEl) return;
  var seleccionados = _segChips.trabajar;
  if (!seleccionados.length) {
    chEl.innerHTML = '';
    return;
  }
  chEl.innerHTML = seleccionados.map(function(nombre) {
    return '<span class="seg-hchip seg-hchip-trabajar">' +
      '<i class="fas fa-check" style="font-size:8px;margin-right:3px;color:#16a34a"></i>' +
      segEscape(nombre) +
    '</span>';
  }).join('');
}

function segRenderizarSeccionChips(tipo) {
  var secEl = document.getElementById('seg-sec-' + tipo);
  var chips = document.getElementById('seg-chips-' + tipo);
  if (!chips) return;
  var lista = _segChips[tipo] || [];
  if (secEl) secEl.classList.toggle('seg-hidden', lista.length === 0);

  if (tipo === 'hipotesis') {
    chips.innerHTML = lista.map(function(nombre) {
      return '<span class="seg-chip-hipotesis">' +
        segEscape(nombre) +
        '<button class="seg-chip-remove-btn" onclick="segEditarChipHipotesis(\'' + segEscape(nombre) + '\')" data-seg-tooltip="Editar">' +
          '<i class="fas fa-pencil-alt"></i>' +
        '</button>' +
        '<button class="seg-chip-remove-btn seg-chip-btn-trash" onclick="segEliminarChipHipotesis(\'' + segEscape(nombre) + '\')" data-seg-tooltip="Eliminar">' +
          '<i class="fas fa-trash"></i>' +
        '</button>' +
      '</span>';
    }).join('');
  } else {
    chips.innerHTML = lista.map(function(nombre) {
      return '<span class="seg-chip-' + tipo + '">' +
        segEscape(nombre) +
        '<button class="seg-chip-remove-btn" onclick="segQuitarChip(\'' + tipo + '\',\'' + segEscape(nombre) + '\')">' +
          '<i class="fas fa-times"></i>' +
        '</button>' +
      '</span>';
    }).join('');
  }
}

function segRenderizarSeccionTrabajar() {
  var secEl = document.getElementById('seg-sec-trabajar');
  var chips = document.getElementById('seg-chips-trabajar');
  if (!chips) return;

  // Todos los chips de las otras 3 secciones — sin duplicados
  var vistos = {};
  var todos = [];
  [
    { lista: _segChips.sintoma,     tipo: 'sintoma' },
    { lista: _segChips.diagnostico, tipo: 'diagnostico' },
    { lista: _segChips.hipotesis,   tipo: 'hipotesis' }
  ].forEach(function(grupo) {
    grupo.lista.forEach(function(nombre) {
      if (!vistos[nombre]) {
        vistos[nombre] = true;
        todos.push({ nombre: nombre, tipo: grupo.tipo });
      }
    });
  });

  if (secEl) secEl.classList.toggle('seg-hidden', todos.length === 0);

  chips.innerHTML = todos.map(function(item) {
    var activo   = _segChips.trabajar.indexOf(item.nombre) !== -1;
    var esDiag   = item.tipo === 'diagnostico';
    var nivel    = _segIntensidades[item.nombre];
    var tieneNivel = activo && esDiag && nivel !== undefined && nivel > 0;
    var badgeColor = tieneNivel ? SEG_INTENS_COLORS[nivel] : '';
    var badgeText  = tieneNivel ? SEG_INTENS_TEXT[nivel] : '';
    return '<span class="seg-chip-trabajar' + (activo ? ' activo' : '') + '"' +
      ' onclick="segToggleTrabajar(\'' + segEscape(item.nombre) + '\')">' +
      (activo ? '<i class="fas fa-check" style="font-size:8px;margin-right:3px;color:#16a34a"></i>' : '') +
      segEscape(item.nombre) +
      (activo && esDiag
        ? '<span class="seg-intens-badge" style="background:' + (tieneNivel ? badgeColor : '#e5e7eb') + ';color:' + (tieneNivel ? badgeText : '#9ca3af') + '"' +
          ' onclick="event.stopPropagation();segAbrirModalIntensidad(\'' + segEscape(item.nombre) + '\')"' +
          ' data-seg-tooltip="Escala de intensidad">' +
          (tieneNivel ? nivel : '·') +
          '</span>'
        : '') +
    '</span>';
  }).join('');
}

function segRenderizarTodosChips() {
  ['sintoma','diagnostico','hipotesis'].forEach(segRenderizarSeccionChips);
  segRenderizarSeccionTrabajar();
}

function segLimpiarTodosChips() {
  _segChips = { sintoma: [], diagnostico: [], hipotesis: [], trabajar: [] };
  segRenderizarTodosChips();
  segActualizarHeroChipsTrabajar();
}

function segSeleccionarEtiqueta(etiqueta) {
  segAgregarChip('sintoma', etiqueta);
  if (SEG.etiquetasActivas.indexOf(etiqueta) === -1) {
    SEG.etiquetasActivas.push(etiqueta);
    segRenderizarChipsEtiquetas();
    if (SEG.etiquetasDisponibles.indexOf(etiqueta) === -1) {
      SEG.etiquetasDisponibles.push(etiqueta);
    }
  }
  segMarcarCambios();
}

function segRemoverEtiqueta(etiqueta) {
  SEG.etiquetasActivas = SEG.etiquetasActivas.filter(function(e) { return e !== etiqueta; });
  segRenderizarChipsEtiquetas();
  segMarcarCambios();
}

function segRenderizarChipsEtiquetas() {
  var el = document.getElementById('seg-etiquetas-chips');
  if (!el) return;
  if (!SEG.etiquetasActivas.length) { el.innerHTML = ''; return; }
  el.innerHTML = SEG.etiquetasActivas.map(function(e) {
    return '<span class="seg-etiqueta-chip">' +
      segEscape(e) +
      '<button class="seg-chip-remove" onclick="segRemoverEtiqueta(\'' + segEscape(e) + '\')" title="Quitar">' +
        '<i class="fas fa-times"></i>' +
      '</button>' +
    '</span>';
  }).join('');
}


/* ─────────────────────────────────────────
   ADJUNTOS
───────────────────────────────────────── */
SEG._adjuntos = []; // { nombre, url, cloudinary_id, resource_type, size, mime }

function segCargarAdjuntosContexto(adjuntos) {
  SEG._adjuntos = adjuntos || [];
  segRenderizarAdjuntos();
}

function segDropArchivo(e) {
  e.preventDefault();
  document.getElementById('seg-dropzone').classList.remove('seg-dropzone-over');
  segSeleccionarArchivos(e.dataTransfer.files);
}

function segSeleccionarArchivos(files) {
  if (!files || !files.length) return;
  Array.from(files).forEach(function(file) { segSubirAdjunto(file); });
}

function segSubirAdjunto(file) {
  var maxMB = 20;
  if (file.size > maxMB * 1024 * 1024) {
    segToast('Archivo demasiado grande (máx ' + maxMB + ' MB)', 'error');
    return;
  }

  // Agregar a lista con estado "subiendo"
  var tmpId = 'tmp_' + Date.now();
  SEG._adjuntos.push({ _tmpId: tmpId, nombre: file.name, subiendo: true, size: file.size, mime: file.type });
  segRenderizarAdjuntos();

  var formData = new FormData();
  formData.append('file', file);
  formData.append('modulo', 'seguimiento');
  if (SEG.clienteId) formData.append('cliente_id', SEG.clienteId);

  var token = localStorage.getItem('token') || '';
  fetch(API_BASE_URL + '/api/media/upload', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token },
    body: formData
  })
  .then(function(r) { return r.json(); })
  .then(function(data) {
    // Reemplazar el temporal con el real
    SEG._adjuntos = SEG._adjuntos.map(function(a) {
      if (a._tmpId !== tmpId) return a;
      if (!data.ok) { return null; }
      return {
        nombre:        file.name,
        url:           data.url,
        cloudinary_id: data.cloudinary_id,
        resource_type: data.resource_type,
        size:          data.size,
        mime:          file.type
      };
    }).filter(Boolean);
    segRenderizarAdjuntos();
    segMarcarCambios();
    segToast('Archivo subido', 'success');
  })
  .catch(function() {
    SEG._adjuntos = SEG._adjuntos.filter(function(a) { return a._tmpId !== tmpId; });
    segRenderizarAdjuntos();
    segToast('Error al subir archivo', 'error');
  });
}

function segEliminarAdjunto(idx) {
  var adj = SEG._adjuntos[idx];
  if (!adj) return;
  // Si tiene cloudinary_id, eliminarlo del servidor
  if (adj.cloudinary_id) {
    segFetch('/api/media/delete',
      { method: 'DELETE', body: JSON.stringify({ cloudinary_id: adj.cloudinary_id, resource_type: adj.resource_type || 'image' }) },
      function() {}, function() {}
    );
  }
  SEG._adjuntos.splice(idx, 1);
  segRenderizarAdjuntos();
  segMarcarCambios();
}

function segRenderizarAdjuntos() {
  var el = document.getElementById('seg-adjuntos-lista');
  if (!el) return;
  if (!SEG._adjuntos.length) { el.innerHTML = ''; return; }

  el.innerHTML = SEG._adjuntos.map(function(a, i) {
    var icono = segIconoAdjunto(a.mime || '');
    var tam   = a.size ? segFormatSize(a.size) : '';
    var nombre = segEscape(a.nombre || 'Archivo');

    if (a.subiendo) {
      return '<div class="seg-adjunto-item seg-adjunto-subiendo">' +
        '<div class="seg-spinner" style="width:16px;height:16px;border-width:2px"></div>' +
        '<span class="seg-adjunto-nombre">' + nombre + '</span>' +
        '<span class="seg-adjunto-tam">Subiendo...</span>' +
      '</div>';
    }

    return '<div class="seg-adjunto-item">' +
      '<i class="' + icono + ' seg-adjunto-icon"></i>' +
      '<a class="seg-adjunto-nombre" href="' + segEscape(a.url||'#') + '" target="_blank" title="' + nombre + '">' + nombre + '</a>' +
      '<span class="seg-adjunto-tam">' + tam + '</span>' +
      '<button class="seg-adjunto-remove" onclick="segEliminarAdjunto(' + i + ')" title="Eliminar">' +
        '<i class="fas fa-times"></i>' +
      '</button>' +
    '</div>';
  }).join('');
}

function segIconoAdjunto(mime) {
  if (mime.startsWith('image/'))       return 'fas fa-image';
  if (mime.startsWith('video/'))       return 'fas fa-video';
  if (mime.startsWith('audio/'))       return 'fas fa-music';
  if (mime === 'application/pdf')      return 'fas fa-file-pdf';
  if (mime.includes('word'))           return 'fas fa-file-word';
  if (mime.includes('excel') || mime.includes('spreadsheet')) return 'fas fa-file-excel';
  return 'fas fa-file';
}

function segFormatSize(bytes) {
  if (bytes < 1024)          return bytes + ' B';
  if (bytes < 1024 * 1024)   return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}


SEG._plantillas     = {};
SEG._plantillaModal = { tipo: null, id: null };

function segCargarPlantillasContexto(plantillas) {
  SEG._plantillas = plantillas || {};
  segRenderizarChipsPlantillas('principal');
  segRenderizarChipsPlantillas('tareas');
  segRenderizarChipsPlantillas('proxima');
}

function segRenderizarChipsPlantillas(tipo) {
  var el = document.getElementById('seg-chips-' + tipo);
  if (!el) return;
  var lista = SEG._plantillas[tipo] || [];
  if (!lista.length) {
    el.innerHTML = '<span class="seg-plantillas-vacio">Aún no tienes plantillas.</span>';
    return;
  }
  var campoId = tipo === 'principal' ? 'seg-campo-contenido'
              : tipo === 'tareas'    ? 'seg-campo-tareas'
              : 'seg-campo-proxima';
  el.innerHTML = lista.map(function(p) {
    var pid = segEscape(p._id || p.id);
    return '<span class="seg-plantilla-chip" data-id="' + pid + '"' +
      ' onclick="segTogglePlantilla(\'' + campoId + '\',\'' + pid + '\',\'' + tipo + '\')">' +
      '<i class="fas fa-check seg-chip-check seg-hidden" id="chk-' + pid + '"></i>' +
      segEscape(p.nombre) +
      '<span class="seg-chip-actions">' +
        '<i class="fas fa-pencil-alt" onclick="event.stopPropagation();segEditarPlantilla(\'' + pid + '\',\'' + tipo + '\')" title="Editar"></i>' +
        '<i class="fas fa-trash" onclick="event.stopPropagation();segEliminarPlantilla(\'' + pid + '\',\'' + tipo + '\')" title="Eliminar"></i>' +
      '</span>' +
    '</span>';
  }).join('');
}

function segTogglePlantilla(campoId, plantillaId, tipo) {
  var campo = document.getElementById(campoId);
  if (!campo) return;
  var lista = SEG._plantillas[tipo] || [];
  var p = lista.find(function(x) { return (x._id||x.id) === plantillaId; });
  if (!p) return;
  var chk = document.getElementById('chk-' + plantillaId);
  var separador = '\n--- ' + p.nombre + ' ---\n';
  if (chk && !chk.classList.contains('seg-hidden')) {
    campo.value = campo.value.replace(separador + p.contenido, '').replace(/\n{3,}/g, '\n\n').trim();
    chk.classList.add('seg-hidden');
  } else {
    var actual = campo.value.trim();
    campo.value = actual ? actual + separador + p.contenido : p.contenido;
    if (chk) chk.classList.remove('seg-hidden');
  }
  segMarcarCambios();
}

function segNuevaPlantilla(tipo) {
  SEG._plantillaModal = { tipo: tipo, id: null };
  document.getElementById('seg-plantilla-modal-titulo').textContent = 'Nueva plantilla';
  document.getElementById('seg-plantilla-nombre').value    = '';
  document.getElementById('seg-plantilla-contenido').value = '';
  document.getElementById('seg-plantilla-modal').classList.remove('seg-hidden');
  setTimeout(function() { document.getElementById('seg-plantilla-nombre').focus(); }, 80);
}

function segEditarPlantilla(plantillaId, tipo) {
  var lista = SEG._plantillas[tipo] || [];
  var p = lista.find(function(x) { return (x._id||x.id) === plantillaId; });
  if (!p) return;
  SEG._plantillaModal = { tipo: tipo, id: plantillaId };
  document.getElementById('seg-plantilla-modal-titulo').textContent = 'Editar plantilla';
  document.getElementById('seg-plantilla-nombre').value    = p.nombre || '';
  document.getElementById('seg-plantilla-contenido').value = p.contenido || '';
  document.getElementById('seg-plantilla-modal').classList.remove('seg-hidden');
  setTimeout(function() { document.getElementById('seg-plantilla-nombre').focus(); }, 80);
}

function segCerrarModalPlantilla() {
  document.getElementById('seg-plantilla-modal').classList.add('seg-hidden');
}

function segGuardarPlantilla() {
  var nombre    = document.getElementById('seg-plantilla-nombre').value.trim();
  var contenido = document.getElementById('seg-plantilla-contenido').value.trim();
  var tipo      = SEG._plantillaModal.tipo;
  var id        = SEG._plantillaModal.id;
  if (!nombre) { segToast('Escribe un nombre', 'error'); return; }
  if (!contenido) { segToast('Escribe el contenido', 'error'); return; }

  var payload = { company_id: SEG.companyId, nombre: nombre, contenido: contenido, tipo: tipo };

  if (id) {
    segFetch('/api/seguimiento/plantillas/' + id,
      { method: 'PUT', body: JSON.stringify(payload) },
      function() {
        var lista = SEG._plantillas[tipo] || [];
        var idx = -1;
        lista.forEach(function(x, i) { if ((x._id||x.id) === id) idx = i; });
        if (idx >= 0) { lista[idx].nombre = nombre; lista[idx].contenido = contenido; }
        segRenderizarChipsPlantillas(tipo);
        segCerrarModalPlantilla();
        segToast('Plantilla actualizada', 'success');
      },
      function() { segToast('Error al actualizar', 'error'); }
    );
  } else {
    segFetch('/api/seguimiento/plantillas',
      { method: 'POST', body: JSON.stringify(payload) },
      function(data) {
        if (!SEG._plantillas[tipo]) SEG._plantillas[tipo] = [];
        SEG._plantillas[tipo].push({ _id: data._id || data.id, nombre: nombre, contenido: contenido, tipo: tipo });
        segRenderizarChipsPlantillas(tipo);
        segCerrarModalPlantilla();
        segToast('Plantilla creada', 'success');
      },
      function() { segToast('Error al crear', 'error'); }
    );
  }
}

function segMostrarConfirmEliminar(rid) {
  // Cerrar cualquier otra confirmación abierta
  document.querySelectorAll('.seg-hist-confirm').forEach(function(el) {
    el.classList.add('seg-hidden');
  });
  var confirmEl = document.getElementById('confirm-' + rid);
  if (confirmEl) confirmEl.classList.remove('seg-hidden');
}

function segCancelarConfirmEliminar(rid) {
  var confirmEl = document.getElementById('confirm-' + rid);
  if (confirmEl) confirmEl.classList.add('seg-hidden');
}

function segConfirmarEliminar(rid) {
  segEliminarRegistro(rid);
}

function segEliminarRegistro(registroId) {
  var lb = SEG.labels;
  var nomReg = lb.registro || 'sesión';
  segFetch('/api/seguimiento/registros/' + registroId,
    { method: 'DELETE', body: JSON.stringify({ company_id: SEG.companyId }) },
    function() {
      segToast(nomReg.charAt(0).toUpperCase() + nomReg.slice(1) + ' eliminada', 'success');
      if (SEG.registroId === registroId) {
        SEG.registroId = null;
        SEG.hayUnsaved = false;
        segNuevaSesionConfirm();
      }
      if (SEG.clienteId) {
        segFetch('/api/seguimiento/clientes/' + SEG.clienteId + '/contexto?company_id=' + SEG.companyId, {},
          function(data) {
            SEG.contexto = data;
            segRenderizarHistorial(data.historial || [], SEG.labels);
          }, function() {}
        );
      }
    },
    function() { segToast('Error al eliminar', 'error'); }
  );
}

/* ─────────────────────────────────────────
   TOGGLE PANELES (izquierdo y derecho)
───────────────────────────────────────── */
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



function segGuardar() {
  if (!SEG.clienteId) return;
  var nomReg = SEG.labels.registro || 'sesión';
  var btn = document.getElementById('seg-btn-guardar');
  if (btn) { btn.innerHTML = '<i class="fas fa-spinner fa-spin" style="margin-right:5px"></i>Guardando...'; btn.disabled = true; }

  var payload = {
    company_id:          SEG.companyId,
    cliente_id:          SEG.clienteId,
    fecha:               (document.getElementById('seg-campo-fecha')||{}).value || '',
    hora:                (document.getElementById('seg-campo-hora')||{}).value  || '',
    notas_internas:      (document.getElementById('seg-campo-notas')||{}).innerText || '',
    etiquetas:           SEG.etiquetasActivas.slice(),
    chips_sintoma:       (_segChips.sintoma||[]).slice(),
    chips_diagnostico:   (_segChips.diagnostico||[]).slice(),
    chips_hipotesis:     (_segChips.hipotesis||[]).slice(),
    chips_trabajar:      (_segChips.trabajar||[]).slice(),
    adjuntos:            SEG._adjuntos.filter(function(a){ return !a.subiendo; }),
    contenido_principal: document.getElementById('seg-campo-contenido').value,
    tareas:              document.getElementById('seg-campo-tareas').value,
    proxima_cita:        document.getElementById('seg-campo-proxima').value,
    resumen_editado:     (document.getElementById('seg-resumen-text')||{}).innerText || ''
  };

  var url = SEG.registroId ? '/api/seguimiento/registros/' + SEG.registroId : '/api/seguimiento/registros';
  var method = SEG.registroId ? 'PUT' : 'POST';

  segFetch(url, { method: method, body: JSON.stringify(payload) }, function(data) {
    SEG.registroId = data._id || data.id || SEG.registroId;
    SEG.hayUnsaved = false;
    if (btn) { btn.innerHTML = '<i class="fas fa-save" style="margin-right:5px"></i>Guardar ' + nomReg; btn.disabled = false; }
    segToast(nomReg.charAt(0).toUpperCase() + nomReg.slice(1) + ' guardada', 'success');
  }, function() {
    if (btn) { btn.innerHTML = '<i class="fas fa-save" style="margin-right:5px"></i>Guardar ' + nomReg; btn.disabled = false; }
    segToast('Error al guardar', 'error');
  });
}

/* ─────────────────────────────────────────
   GENERAR RESUMEN IA
───────────────────────────────────────── */
function segGenerarResumen() {
  if (!SEG.registroId && !SEG.clienteId) { segToast('Primero guarda el borrador', 'error'); return; }
  if (!SEG.registroId) {
    segGuardar();
    segToast('Guardando antes de generar...', '');
    setTimeout(segGenerarResumen, 1200);
    return;
  }
  segSetTab('cliente', document.getElementById('seg-tab-cliente'));
  segMostrarResumenGenerando();

  // Leer campos del formulario con fallback al contexto
  var reg       = SEG.contexto && SEG.contexto.registro_activo ? SEG.contexto.registro_activo : {};
  var contenido = ((document.getElementById('seg-campo-contenido')||{}).value || reg.contenido_principal || '').trim();
  var tareas    = ((document.getElementById('seg-campo-tareas')||{}).value    || reg.tareas           || '').trim();
  var proxima   = ((document.getElementById('seg-campo-proxima')||{}).value   || reg.proxima_cita     || '').trim();

  if (!contenido && !tareas && !proxima) {
    segLimpiarResumen();
    segToast('Completa al menos un campo antes de generar', 'error');
    return;
  }

  var payload = {
    contenido_principal: contenido,
    tareas:              tareas,
    proxima_cita:        proxima,
    company_id:          SEG.companyId
  };
  segFetch('/api/seguimiento/registros/' + SEG.registroId + '/resumen',
    { method: 'POST', body: JSON.stringify(payload) },
    function(data) {
      segMostrarResumen(data.resumen || data.texto || '');
      if (data.etiquetas && data.etiquetas.length) {
        segMostrarEtiquetasIA(data.etiquetas);
      }
    },
    function() { segLimpiarResumen(); segToast('Error al generar resumen', 'error'); }
  );
}

function segRegenerarResumen() {
  var badge = document.getElementById('seg-enviado-badge');
  if (badge) badge.classList.add('seg-hidden');
  var btnEnviar = document.getElementById('seg-btn-enviar-cliente');
  if (btnEnviar) { btnEnviar.disabled = false; btnEnviar.innerHTML = '<i class="fas fa-paper-plane seg-icon-mr-sm"></i>Enviar al cliente'; }
  segGenerarResumen();
}

/* ─────────────────────────────────────────
   CANAL DE ENVÍO
───────────────────────────────────────── */
SEG._canal = 'whatsapp';

function segSetCanal(canal, el) {
  SEG._canal = canal;
  document.querySelectorAll('.seg-canal-chip').forEach(function(c) {
    c.classList.remove('active');
  });
  if (el) el.classList.add('active');
  // Resetear estado enviado si cambia el canal
  var badge = document.getElementById('seg-enviado-badge');
  if (badge) badge.classList.add('seg-hidden');
  var btnEnviar = document.getElementById('seg-btn-enviar-cliente');
  if (btnEnviar) { btnEnviar.disabled = false; btnEnviar.innerHTML = '<i class="fas fa-paper-plane seg-icon-mr-sm"></i>Enviar al cliente'; }
}

/* ─────────────────────────────────────────
   ETIQUETAS SUGERIDAS POR IA
───────────────────────────────────────── */
function segMostrarEtiquetasIA(etiquetas) {
  var wrap  = document.getElementById('seg-etiquetas-ia-wrap');
  var chips = document.getElementById('seg-etiquetas-ia-chips');
  if (!wrap || !chips) return;
  chips.innerHTML = etiquetas.map(function(et) {
    var yaActiva = SEG.etiquetasActivas.indexOf(et) !== -1;
    return '<span class="seg-etiqueta-ia-chip' + (yaActiva ? ' aceptada' : '') + '"' +
      ' onclick="segAceptarEtiquetaIA(\'' + segEscape(et) + '\', this)">' +
      (yaActiva ? '<i class="fas fa-check"></i> ' : '<i class="fas fa-plus"></i> ') +
      segEscape(et) + '</span>';
  }).join('');
  wrap.classList.remove('seg-hidden');
}

function segAceptarEtiquetaIA(etiqueta, el) {
  if (SEG.etiquetasActivas.indexOf(etiqueta) === -1) {
    SEG.etiquetasActivas.push(etiqueta);
    segRenderizarChipsEtiquetas();
    segMarcarCambios();
  }
  if (el) {
    el.classList.add('aceptada');
    el.innerHTML = '<i class="fas fa-check"></i> ' + segEscape(etiqueta);
  }
}

/* ─────────────────────────────────────────
   ENVIAR AL CLIENTE
───────────────────────────────────────── */
function segEnviarAlCliente() {
  if (!SEG.registroId) { segToast('Primero guarda el borrador', 'error'); return; }
  var resumen = document.getElementById('seg-resumen-text').innerText || '';
  if (!resumen.trim()) { segToast('El resumen está vacío', 'error'); return; }

  var canal     = SEG._canal || 'whatsapp';
  var btnEnviar = document.getElementById('seg-btn-enviar-cliente');
  if (btnEnviar) { btnEnviar.disabled = true; btnEnviar.innerHTML = '<i class="fas fa-spinner fa-spin seg-icon-mr-sm"></i>Enviando...'; }

  segFetch('/api/seguimiento/registros/' + SEG.registroId + '/enviar',
    { method: 'POST', body: JSON.stringify({ resumen: resumen, canal: canal, company_id: SEG.companyId }) },
    function() {
      // Badge "Enviado por X" en Tab 2
      var badge   = document.getElementById('seg-enviado-badge');
      var badgeTxt = document.getElementById('seg-enviado-txt');
      var iconMap = { whatsapp: 'WhatsApp', chat: 'Chat Heavensy', email: 'Email' };
      if (badgeTxt) badgeTxt.textContent = 'Enviado por ' + (iconMap[canal] || canal);
      if (badge) {
        badge.classList.remove('seg-hidden');
        badge.className = badge.className
          .replace(/seg-enviado-canal-\S+/g, '').trim();
        badge.classList.add('seg-enviado-canal-' + (canal || 'whatsapp'));
      }
      if (btnEnviar) { btnEnviar.disabled = true; btnEnviar.innerHTML = '<i class="fas fa-check seg-icon-mr-sm"></i>Enviado'; }

      // Badge de estado en hero y date-row
      var heroStatus = document.getElementById('seg-hero-status');
      if (heroStatus) heroStatus.textContent = SEG.labels.status_sent || 'Enviado';
      var badgeEstado = document.getElementById('seg-badge-estado');
      if (badgeEstado) badgeEstado.textContent = SEG.labels.status_sent || 'Enviado';

      // Actualizar tarjeta activa en historial directamente en el DOM
      var card = document.querySelector('.seg-hist-card.active');
      if (card) {
        var badgeCard = card.querySelector('.seg-hist-badge');
        if (badgeCard) {
          badgeCard.className = 'seg-hist-badge enviado';
          badgeCard.textContent = 'Enviado';
        }
      }
      // También actualizar en la lista de entidades del panel izquierdo
      if (SEG.clienteId) {
        var entityItem = document.querySelector('.seg-entity-item[data-wa-id="' + SEG.clienteId + '"]');
        if (entityItem) {
          var dot = entityItem.querySelector('.seg-entity-dot');
          if (dot) { dot.className = 'seg-entity-dot dot-sent'; }
        }
      }

      segToast('Enviado por ' + (iconMap[canal] || canal), 'success');
    },
    function() {
      if (btnEnviar) { btnEnviar.disabled = false; btnEnviar.innerHTML = '<i class="fas fa-paper-plane seg-icon-mr-sm"></i>Enviar al cliente'; }
      segToast('Error al enviar', 'error');
    }
  );
}

// Mantener funciones legacy por compatibilidad
function segEnviarWA()    { SEG._canal = 'whatsapp'; segEnviarAlCliente(); }
function segEnviarEmail() { SEG._canal = 'email';    segEnviarAlCliente(); }



/* ─────────────────────────────────────────
   PROMOVER
───────────────────────────────────────── */
function segPromover() {
  if (!SEG.clienteId) return;
  var lb = SEG.labels;
  segConfirm('¿Promover este contacto a ' + (lb.cliente||'cliente') + '?', function() {
    segFetch('/api/seguimiento/clientes/' + SEG.clienteId + '/promover',
      { method: 'POST', body: JSON.stringify({ company_id: SEG.companyId }) },
      function() {
        segToast('Promovido a ' + (lb.cliente||'cliente'), 'success');
        var btn = document.getElementById('seg-btn-promover');
        if (btn) btn.classList.add('seg-hidden');
      },
      function() { segToast('Error al promover', 'error'); }
    );
  });
}

/* ─────────────────────────────────────────
   TIMELINE
───────────────────────────────────────── */
function segAddEvento() {
  var anioActual = new Date().getFullYear();
  segPromptNumero('Año del evento', 1900, anioActual, anioActual, function(anio) {
    segPrompt('Descripción', 'ej: Primera consulta', function(label) {
      segFetch('/api/seguimiento/clientes/' + SEG.clienteId + '/timeline',
        { method: 'POST', body: JSON.stringify({ company_id: SEG.companyId, anio: parseInt(anio), titulo: label }) },
        function(data) {
          if (SEG.contexto) {
            SEG.contexto.timeline = SEG.contexto.timeline || [];
            SEG.contexto.timeline.push({ anio: parseInt(anio), titulo: label, _id: data._id });
            segRenderizarTimeline(SEG.contexto.timeline, SEG.labels.timeline_titulo, SEG.labels.timeline_inicio);
            segRenderizarTLEdit(SEG.contexto.timeline, SEG.labels.timeline_titulo);
          }
          segToast('Evento agregado', 'success');
        },
        function() { segToast('Error al agregar evento', 'error'); }
      );
    });
  });
}

function segPromptNumero(titulo, min, max, defaultVal, onAceptar) {
  var overlay = document.getElementById('seg-modal-overlay');
  var title   = document.getElementById('seg-modal-title');
  var inputW  = document.getElementById('seg-modal-input-wrap');
  var input   = document.getElementById('seg-modal-input');
  var btnOk   = document.getElementById('seg-modal-ok');
  var btnCan  = document.getElementById('seg-modal-cancel');
  if (!overlay) return;

  title.textContent    = titulo;
  inputW.style.display = 'block';
  input.type           = 'number';
  input.min            = min;
  input.max            = max;
  input.value          = defaultVal;
  input.placeholder    = min + ' - ' + max;
  btnOk.textContent    = 'Aceptar';
  btnOk.className      = 'seg-modal-btn seg-modal-btn-primary';
  overlay.classList.remove('seg-hidden');
  setTimeout(function() { input.select(); }, 80);

  btnOk.onclick = function() {
    var val = parseInt(input.value);
    if (isNaN(val) || val < min || val > max) {
      input.style.borderColor = '#ef4444';
      input.focus();
      return;
    }
    input.type = 'text'; // reset para próximo uso
    input.style.borderColor = '';
    overlay.classList.add('seg-hidden');
    if (onAceptar) onAceptar(val);
  };
  btnCan.onclick = function() {
    input.type = 'text';
    input.style.borderColor = '';
    overlay.classList.add('seg-hidden');
  };
  input.onkeydown = function(e) {
    if (e.key === 'Enter')  btnOk.onclick();
    if (e.key === 'Escape') btnCan.onclick();
  };
}

function segEliminarEvento(eventoId) {
  segConfirm('¿Eliminar este evento?', function() {
  segFetch('/api/seguimiento/timeline/' + eventoId,
    { method: 'DELETE', body: JSON.stringify({ company_id: SEG.companyId }) },
    function() {
      if (SEG.contexto) {
        SEG.contexto.timeline = (SEG.contexto.timeline||[]).filter(function(ev){ return ev._id !== eventoId; });
        segRenderizarTimeline(SEG.contexto.timeline, SEG.labels.timeline_titulo, SEG.labels.timeline_inicio);
        segRenderizarTLEdit(SEG.contexto.timeline, SEG.labels.timeline_titulo);
      }
      segToast('Evento eliminado', 'success');
    },
    function() { segToast('Error al eliminar', 'error'); }
  );
  }); // cierre segConfirm
}

function segSyncTimeline() {
  if (!SEG.clienteId) return;
  segFetch('/api/seguimiento/clientes/' + SEG.clienteId + '/timeline/sync',
    { method: 'POST', body: JSON.stringify({ company_id: SEG.companyId }) },
    function(data) {
      if (data.timeline && SEG.contexto) {
        SEG.contexto.timeline = data.timeline;
        segRenderizarTimeline(data.timeline, SEG.labels.timeline_titulo, SEG.labels.timeline_inicio);
        segRenderizarTLEdit(data.timeline, SEG.labels.timeline_titulo);
      }
      segToast('Linea de tiempo sincronizada', 'success');
    },
    function() { segToast('Error al sincronizar', 'error'); }
  );
}

/* ─────────────────────────────────────────
   SELECCIONAR REGISTRO DEL HISTORIAL
───────────────────────────────────────── */
function segSeleccionarRegistro(registroId) {
  if (!registroId) return;
  if (SEG.hayUnsaved) {
    segConfirm('Hay cambios sin guardar. ¿Continuar?', function() {
      SEG.hayUnsaved = false;
      segSeleccionarRegistro(registroId);
    });
    return;
  }
  SEG.registroId = registroId;
  segFetch('/api/seguimiento/registros/' + registroId, {}, function(resp) {
    // El endpoint devuelve { ok: true, registro: {...} }
    var data = resp.registro || resp;
    var lb = SEG.labels;
    var tc = document.getElementById('seg-campo-contenido');
    var tt = document.getElementById('seg-campo-tareas');
    var tp = document.getElementById('seg-campo-proxima');
    var tn = document.getElementById('seg-campo-notas');
    var tf = document.getElementById('seg-campo-fecha');
    var th = document.getElementById('seg-campo-hora');
    if (tc) tc.value = data.contenido_principal || '';
    if (tt) tt.value = data.tareas || '';
    if (tp) tp.value = data.proxima_cita || '';
    if (tn) { tn.innerText = data.notas_internas || ''; segInicializarEditorNotas(); }
    // Cargar chips
    segLimpiarTodosChips();
    if (data.chips_sintoma)     (data.chips_sintoma||[]).forEach(function(c){ segAgregarChip('sintoma',c); });
    if (data.chips_diagnostico) (data.chips_diagnostico||[]).forEach(function(c){ segAgregarChip('diagnostico',c); });
    if (data.chips_hipotesis)   (data.chips_hipotesis||[]).forEach(function(c){ segAgregarChip('hipotesis',c); });
    _segChips.trabajar = (data.chips_trabajar || []).slice();
    segRenderizarSeccionTrabajar();
    segActualizarHeroChipsTrabajar();
    if (tf) tf.value = data.fecha || '';
    if (th) th.value = data.hora || '';
    // Etiquetas del registro (array de strings)
    SEG.etiquetasActivas = (data.etiquetas || []).map(function(e) {
      return typeof e === 'string' ? e : (e.nombre || '');
    }).filter(Boolean);
    segRenderizarChipsEtiquetas();
    // Adjuntos
    SEG._adjuntos = data.adjuntos || [];
    segRenderizarAdjuntos();
    // Resumen
    var resumenTexto = data.resumen_editado || data.resumen_ia || data.resumen;
    if (resumenTexto) segMostrarResumen(resumenTexto);
    else segLimpiarResumen();
    // Marcar activo en historial
    document.querySelectorAll('.seg-hist-card').forEach(function(el){ el.classList.remove('active'); });
    var card = document.querySelector('.seg-hist-card[onclick*="' + registroId + '"]');
    if (card) card.classList.add('active');
    // Actualizar badge de estado
    var badgeEl = document.getElementById('seg-badge-estado');
    if (badgeEl) badgeEl.textContent = data.estado === 'en_curso'
      ? (lb.status_active||'En curso') : (lb.status_pending||'Pendiente');
    SEG.hayUnsaved = false;
  }, function() { segToast('Error al cargar el registro', 'error'); });
}

/* ─────────────────────────────────────────
   BUSQUEDA
───────────────────────────────────────── */
function segBuscar(query) {
  var q = (query||'').toLowerCase().trim();
  if (!q) { segRenderizarLista(SEG.hayTodas); return; }
  segRenderizarLista(SEG.hayTodas.filter(function(e) {
    return (e.nombre||'').toLowerCase().includes(q) ||
           (e.wa_id||'').toLowerCase().includes(q) ||
           (e.especialidad||'').toLowerCase().includes(q);
  }));
}

/* ─────────────────────────────────────────
   TABS
───────────────────────────────────────── */
function segSetTab(id, el) {
  document.querySelectorAll('.seg-tab').forEach(function(t){ t.classList.remove('active'); });
  document.querySelectorAll('.seg-tab-panel').forEach(function(p){ p.classList.remove('active'); });
  if (el) el.classList.add('active');
  var panel = document.getElementById('seg-panel-' + id);
  if (panel) panel.classList.add('active');
}

/* ─────────────────────────────────────────
   TIMELINE TOGGLE
───────────────────────────────────────── */
function segToggleTL() {
  var c  = document.getElementById('seg-tl-content');
  var ch = document.getElementById('seg-tl-chev');
  if (!c) return;
  SEG.tl_visible = !SEG.tl_visible;
  c.style.display = SEG.tl_visible ? 'flex' : 'none';
  if (ch) ch.style.transform = SEG.tl_visible ? '' : 'rotate(-90deg)';
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
  if (textEl)    { textEl.classList.remove('seg-hidden'); textEl.innerHTML = texto; }
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

/* ─────────────────────────────────────────
   AUTOGUARDADO — debounce 5 segundos
───────────────────────────────────────── */
var SEG_autoTimer = null;

function segAutoguardadoDebounce() {
  clearTimeout(SEG_autoTimer);
  SEG_autoTimer = setTimeout(function() {
    segAutoguardar();
  }, 5000);
}

function segAutoguardar() {
  // Salvedades — no guardar si:
  if (!SEG.hayUnsaved)   return; // nada cambió
  if (!SEG.clienteId)    return; // sin cliente
  if (!SEG.companyId)    return; // sin empresa

  // Hay adjuntos subiendo
  var subiendo = SEG._adjuntos && SEG._adjuntos.some(function(a) { return a.subiendo; });
  if (subiendo) {
    // Reintentar en 3 segundos
    SEG_autoTimer = setTimeout(segAutoguardar, 3000);
    return;
  }

  // Botón guardar deshabilitado (ya está guardando)
  var btn = document.getElementById('seg-btn-guardar');
  if (btn && btn.disabled) return;

  // Resumen generándose
  var generando = document.getElementById('seg-resumen-generando');
  if (generando && !generando.classList.contains('seg-hidden')) return;

  // Todo OK — guardar silenciosamente
  segAutoguardarSilencioso();
}

function segAutoguardarSilencioso() {
  var btn = document.getElementById('seg-btn-guardar');
  // Indicador visual sutil
  segMostrarIndicadorAutoguardado('guardando');

  var nomReg = SEG.labels.registro || 'sesión';
  var payload = {
    company_id:          SEG.companyId,
    cliente_id:          SEG.clienteId,
    fecha:               (document.getElementById('seg-campo-fecha')||{}).value || '',
    hora:                (document.getElementById('seg-campo-hora')||{}).value  || '',
    notas_internas:      (document.getElementById('seg-campo-notas')||{}).innerText || '',
    etiquetas:           SEG.etiquetasActivas.slice(),
    chips_sintoma:       (_segChips.sintoma||[]).slice(),
    chips_diagnostico:   (_segChips.diagnostico||[]).slice(),
    chips_hipotesis:     (_segChips.hipotesis||[]).slice(),
    chips_trabajar:      (_segChips.trabajar||[]).slice(),
    adjuntos:            SEG._adjuntos.filter(function(a){ return !a.subiendo; }),
    contenido_principal: (document.getElementById('seg-campo-contenido')||{}).value || '',
    tareas:              (document.getElementById('seg-campo-tareas')||{}).value    || '',
    proxima_cita:        (document.getElementById('seg-campo-proxima')||{}).value   || '',
    resumen_editado:     (document.getElementById('seg-resumen-text')||{}).innerText || ''
  };

  var url    = SEG.registroId ? '/api/seguimiento/registros/' + SEG.registroId : '/api/seguimiento/registros';
  var method = SEG.registroId ? 'PUT' : 'POST';

  segFetch(url, { method: method, body: JSON.stringify(payload) }, function(data) {
    SEG.registroId = data._id || data.id || SEG.registroId;
    SEG.hayUnsaved = false;
    segMostrarIndicadorAutoguardado('guardado');
  }, function() {
    segMostrarIndicadorAutoguardado('error');
  });
}

function segMostrarIndicadorAutoguardado(estado) {
  var el = document.getElementById('seg-autosave-indicator');
  if (!el) return;
  if (estado === 'guardando') {
    el.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Guardando...';
    el.className = 'seg-autosave guardando';
  } else if (estado === 'guardado') {
    el.innerHTML = '<span class="seg-autosave-check"><i class="fas fa-check"></i></span> Guardado';
    el.className = 'seg-autosave guardado';
    setTimeout(function() { el.className = 'seg-autosave'; el.innerHTML = ''; }, 3000);
  } else {
    el.innerHTML = '<i class="fas fa-exclamation-circle"></i> Error al guardar';
    el.className = 'seg-autosave error';
    setTimeout(function() { el.className = 'seg-autosave'; el.innerHTML = ''; }, 4000);
  }
}
function segVerPlantillas()  { segToast('Modulo de plantillas - proximamente', ''); }
function segNuevoMensajeProg(){ segToast('Programar mensaje - proximamente', ''); }

/* ─────────────────────────────────────────
   MODALES CUSTOM — reemplazan confirm/prompt nativos
───────────────────────────────────────── */
function segConfirm(mensaje, onAceptar, onCancelar) {
  var overlay = document.getElementById('seg-modal-overlay');
  var title   = document.getElementById('seg-modal-title');
  var body    = document.getElementById('seg-modal-body');
  var inputW  = document.getElementById('seg-modal-input-wrap');
  var btnOk   = document.getElementById('seg-modal-ok');
  var btnCan  = document.getElementById('seg-modal-cancel');
  if (!overlay) return;

  title.textContent  = mensaje;
  body.style.display = 'none';
  inputW.style.display = 'none';
  btnOk.textContent  = 'Confirmar';
  btnOk.className    = 'seg-modal-btn seg-modal-btn-danger';
  overlay.classList.remove('seg-hidden');

  btnOk.onclick = function() {
    overlay.classList.add('seg-hidden');
    if (onAceptar) onAceptar();
  };
  btnCan.onclick = function() {
    overlay.classList.add('seg-hidden');
    if (onCancelar) onCancelar();
  };
}

function segPrompt(titulo, placeholder, onAceptar) {
  var overlay = document.getElementById('seg-modal-overlay');
  var title   = document.getElementById('seg-modal-title');
  var body    = document.getElementById('seg-modal-body');
  var inputW  = document.getElementById('seg-modal-input-wrap');
  var input   = document.getElementById('seg-modal-input');
  var btnOk   = document.getElementById('seg-modal-ok');
  var btnCan  = document.getElementById('seg-modal-cancel');
  if (!overlay) return;

  title.textContent      = titulo;
  body.style.display     = 'none';
  inputW.style.display   = 'block';
  input.placeholder      = placeholder || '';
  input.value            = '';
  btnOk.textContent      = 'Aceptar';
  btnOk.className        = 'seg-modal-btn seg-modal-btn-primary';
  overlay.classList.remove('seg-hidden');
  setTimeout(function() { input.focus(); }, 80);

  btnOk.onclick = function() {
    var val = input.value.trim();
    if (!val) { input.focus(); return; }
    overlay.classList.add('seg-hidden');
    if (onAceptar) onAceptar(val);
  };
  btnCan.onclick = function() {
    overlay.classList.add('seg-hidden');
  };
  input.onkeydown = function(e) {
    if (e.key === 'Enter') btnOk.onclick();
    if (e.key === 'Escape') btnCan.onclick();
  };
}


function segToast(msg, tipo, duracion) {
  var el     = document.getElementById('seg-toast');
  var msgEl  = document.getElementById('seg-toast-msg');
  var iconEl = document.getElementById('seg-toast-icon');
  if (!el || !msgEl) return;
  msgEl.textContent = msg;
  el.className = 'seg-toast visible';
  if (tipo === 'success') { el.className += ' success'; if (iconEl) iconEl.className = 'fas fa-check-circle'; }
  else if (tipo === 'error') { el.className += ' error'; if (iconEl) iconEl.className = 'fas fa-exclamation-circle'; }
  else if (typeof tipo === 'number') { duracion = tipo; if (iconEl) iconEl.className = 'fas fa-info-circle'; }
  else { if (iconEl) iconEl.className = 'fas fa-info-circle'; }
  clearTimeout(SEG._toastTimer);
  SEG._toastTimer = setTimeout(function(){ el.classList.remove('visible'); }, duracion || 2800);
}

/* ─────────────────────────────────────────
   FETCH — delega en apiCall() de app.js
───────────────────────────────────────── */
function segFetch(url, opts, onSuccess, onError) {
  var endpoint = url.replace(/^https?:\/\/[^/]+/, '');
  var options = {};
  if (opts.method) options.method = opts.method;
  if (opts.body)   options.body   = opts.body;

  apiCall(endpoint, options)
    .then(function(res) {
      if (!res || !res.ok) { if (onError) onError(res); return; }
      if (onSuccess) {
        try { onSuccess(res.data); }
        catch(cbErr) { console.error('[Seguimiento] callback error:', cbErr, endpoint); }
      }
    })
    .catch(function(err) {
      console.error('[Seguimiento]', err, endpoint);
      if (onError) onError(err);
    });
}

/* ─────────────────────────────────────────
   UTILS
───────────────────────────────────────── */
function segEscape(str) {
  if (typeof str !== 'string') return String(str || '');
  return str
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function segEscapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function segFormatFecha(date) {
  var d = date instanceof Date ? date : new Date(date);
  var m = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  return String(d.getDate()).padStart(2,'0') + ' ' + m[d.getMonth()] + ' ' + d.getFullYear();
}

function segFormatFechaCorta(dateStr) {
  if (!dateStr) return '-';
  try {
    var hoy  = new Date();
    var hoyStr = hoy.getFullYear() + '-' +
      String(hoy.getMonth()+1).padStart(2,'0') + '-' +
      String(hoy.getDate()).padStart(2,'0');
    var ayer = new Date(hoy); ayer.setDate(hoy.getDate()-1);
    var ayerStr = ayer.getFullYear() + '-' +
      String(ayer.getMonth()+1).padStart(2,'0') + '-' +
      String(ayer.getDate()).padStart(2,'0');

    var fechaSolo = dateStr.substring(0, 10);

    if (fechaSolo === hoyStr)  return 'Hoy · ' + segFormatFecha(new Date(fechaSolo + 'T12:00:00'));
    if (fechaSolo === ayerStr) return 'Ayer';
    return segFormatFecha(new Date(fechaSolo + 'T12:00:00'));
  } catch(e) { return dateStr; }
}

/* Fecha local del navegador en formato YYYY-MM-DD — evita desfase UTC */
function segFechaLocalHoy() {
  var d = new Date();
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}
function segNuevaSesion() {
  if (!SEG.clienteId) { segToast('Selecciona un paciente primero', 'error'); return; }
  if (SEG.hayUnsaved) {
    segConfirm('Hay cambios sin guardar. ¿Crear nueva sesión de todas formas?', function() {
      SEG.hayUnsaved = false;
      segNuevaSesionConfirm();
    });
    return;
  }
  segNuevaSesionConfirm();
}

function segNuevaSesionConfirm() {
  // Limpiar todos los campos
  SEG.registroId = null;
  SEG.hayUnsaved = false;
  SEG.etiquetasActivas = [];
  SEG._adjuntos = [];

  var hoy = new Date();
  var fechaStr = segFechaLocalHoy();
  var horaStr  = hoy.getHours().toString().padStart(2,'0') + ':' +
                 (Math.floor(hoy.getMinutes()/5)*5).toString().padStart(2,'0');

  var tc = document.getElementById('seg-campo-contenido');
  var tt = document.getElementById('seg-campo-tareas');
  var tp = document.getElementById('seg-campo-proxima');
  var tn = document.getElementById('seg-campo-notas');
  if (tc) tc.value = '';
  if (tt) tt.value = '';
  if (tp) tp.value = '';
  if (tn) tn.innerText = '';
  segLimpiarTodosChips();
  _segIntensidades = {};
  _segDiagMode = false;
  _segHipMode  = false;

  segSetFecha(fechaStr);
  segSetHora(horaStr);
  segRenderizarChipsEtiquetas();
  segRenderizarAdjuntos();
  segLimpiarResumen();

  var badgeEl = document.getElementById('seg-badge-estado');
  if (badgeEl) badgeEl.textContent = SEG.labels.status_active || 'En curso';

  segMostrarRegistroWrap();
  segSetTab('notas', document.getElementById('seg-tab-notas'));
  segToast('Nueva ' + (SEG.labels.registro || 'sesión') + ' lista para registrar', 'success');
}

/* ─────────────────────────────────────────
   DATE PICKER
───────────────────────────────────────── */
var _MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
              'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function segToggleDatePicker() {
  var dp = document.getElementById('seg-datepicker');
  if (!dp) return;
  if (dp.classList.contains('seg-hidden')) {
    // Inicializar con fecha actual o seleccionada
    var hoy = new Date();
    var fSel = SEG._cal.fechaSel ? new Date(SEG._cal.fechaSel + 'T12:00:00') : hoy;
    SEG._cal.anio = fSel.getFullYear();
    SEG._cal.mes  = fSel.getMonth();
    segRenderizarCalendario();
    dp.classList.remove('seg-hidden');
    // Cerrar time picker si está abierto
    var tp = document.getElementById('seg-timepicker');
    if (tp) tp.classList.add('seg-hidden');
  } else {
    dp.classList.add('seg-hidden');
  }
}

function segCalNavMes(delta) {
  SEG._cal.mes += delta;
  if (SEG._cal.mes < 0)  { SEG._cal.mes = 11; SEG._cal.anio--; }
  if (SEG._cal.mes > 11) { SEG._cal.mes = 0;  SEG._cal.anio++; }
  segRenderizarCalendario();
}

function segRenderizarCalendario() {
  var tituloEl = document.getElementById('seg-cal-titulo');
  var diasEl   = document.getElementById('seg-cal-dias');
  if (!tituloEl || !diasEl) return;

  var anio = SEG._cal.anio;
  var mes  = SEG._cal.mes;
  tituloEl.textContent = _MESES[mes] + ' ' + anio;

  var primerDia = new Date(anio, mes, 1).getDay(); // 0=dom
  // Convertir a lunes=0
  var offset = (primerDia === 0) ? 6 : primerDia - 1;
  var diasEnMes = new Date(anio, mes + 1, 0).getDate();
  var hoy = new Date();
  var hoyStr = hoy.getFullYear() + '-' +
    String(hoy.getMonth()+1).padStart(2,'0') + '-' +
    String(hoy.getDate()).padStart(2,'0');

  var html = '';
  // Espacios vacíos
  for (var i = 0; i < offset; i++) html += '<div></div>';
  // Días
  for (var d = 1; d <= diasEnMes; d++) {
    var fechaStr = anio + '-' + String(mes+1).padStart(2,'0') + '-' + String(d).padStart(2,'0');
    var cls = 'cal-day';
    if (fechaStr === hoyStr)          cls += ' cal-day--today';
    if (fechaStr === SEG._cal.fechaSel) cls += ' cal-day--selected';
    html += '<div class="' + cls + '" onclick="segSeleccionarFecha(\'' + fechaStr + '\')">' +
      '<span class="cal-day-num">' + d + '</span>' +
    '</div>';
  }
  diasEl.innerHTML = html;
}

function segSeleccionarFecha(fechaStr) {
  SEG._cal.fechaSel = fechaStr;
  segSetFecha(fechaStr);
  document.getElementById('seg-datepicker').classList.add('seg-hidden');
  segMarcarCambios();
}

function segSetFecha(fechaStr) {
  SEG._cal.fechaSel = fechaStr;
  var hidden = document.getElementById('seg-campo-fecha');
  var display = document.getElementById('seg-fecha-display');
  if (hidden) hidden.value = fechaStr;
  if (display && fechaStr) {
    var d = new Date(fechaStr + 'T12:00:00');
    var meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
    display.textContent = d.getDate() + ' ' + meses[d.getMonth()] + ' ' + d.getFullYear();
  }
}

/* ─────────────────────────────────────────
   TIME PICKER
───────────────────────────────────────── */
function segToggleTimePicker() {
  var tp = document.getElementById('seg-timepicker');
  if (!tp) return;
  if (tp.classList.contains('seg-hidden')) {
    segRenderizarTimePicker();
    tp.classList.remove('seg-hidden');
    var dp = document.getElementById('seg-datepicker');
    if (dp) dp.classList.add('seg-hidden');
  } else {
    tp.classList.add('seg-hidden');
  }
}

function segRenderizarTimePicker() {
  var horasEl = document.getElementById('seg-tp-horas');
  var minsEl  = document.getElementById('seg-tp-minutos');
  if (!horasEl || !minsEl) return;

  var curHora = SEG._tp.hora !== null ? SEG._tp.hora : new Date().getHours();
  var curMin  = SEG._tp.min  !== null ? SEG._tp.min  : Math.floor(new Date().getMinutes()/5)*5;

  var htmlH = '';
  for (var h = 0; h <= 23; h++) {
    var cls = 'seg-tp-item' + (h === curHora ? ' active' : '');
    htmlH += '<div class="' + cls + '" onclick="segSeleccionarHora(' + h + ')">' +
      String(h).padStart(2,'0') + '</div>';
  }
  horasEl.innerHTML = htmlH;

  var htmlM = '';
  for (var m = 0; m < 60; m += 5) {
    var cls2 = 'seg-tp-item' + (m === curMin ? ' active' : '');
    htmlM += '<div class="' + cls2 + '" onclick="segSeleccionarMinuto(' + m + ')">' +
      String(m).padStart(2,'0') + '</div>';
  }
  minsEl.innerHTML = htmlM;

  // Scroll al ítem activo (sin barra visible)
  setTimeout(function() {
    var hA = horasEl.querySelector('.active');
    var mA = minsEl.querySelector('.active');
    if (hA) hA.scrollIntoView({ block: 'nearest' });
    if (mA) mA.scrollIntoView({ block: 'nearest' });
  }, 30);
}

function segSeleccionarHora(h) {
  SEG._tp.hora = h;
  segActualizarHora();
  document.querySelectorAll('#seg-tp-horas .seg-tp-item').forEach(function(el, i) {
    el.classList.toggle('seg-tp-selected', i === h);
  });
}

function segSeleccionarMinuto(m) {
  SEG._tp.min = m;
  segActualizarHora();
  document.querySelectorAll('#seg-tp-minutos .seg-tp-item').forEach(function(el, i) {
    el.classList.toggle('seg-tp-selected', i*5 === m);
  });
  setTimeout(function() {
    var tp = document.getElementById('seg-timepicker');
    if (tp) tp.classList.add('seg-hidden');
  }, 150);
}

function segActualizarHora() {
  var h = SEG._tp.hora !== null ? SEG._tp.hora : 0;
  var m = SEG._tp.min  !== null ? SEG._tp.min  : 0;
  var horaStr = String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0');
  segSetHora(horaStr);
  segMarcarCambios();
}

function segSetHora(horaStr) {
  if (!horaStr) return;
  var parts = horaStr.split(':');
  SEG._tp.hora = parseInt(parts[0]);
  SEG._tp.min  = parseInt(parts[1]);
  var hidden  = document.getElementById('seg-campo-hora');
  var display = document.getElementById('seg-hora-display');
  if (hidden)  hidden.value = horaStr;
  if (display) display.textContent = horaStr;
}

// Cerrar pickers al hacer click fuera
document.addEventListener('click', function(e) {
  var fechaWrap = document.getElementById('seg-fecha-wrap');
  var horaWrap  = document.getElementById('seg-hora-wrap');
  var dp = document.getElementById('seg-datepicker');
  var tp = document.getElementById('seg-timepicker');
  if (dp && fechaWrap && !fechaWrap.contains(e.target)) dp.classList.add('seg-hidden');
  if (tp && horaWrap  && !horaWrap.contains(e.target))  tp.classList.add('seg-hidden');
});


window.segEliminarRegistro     = segEliminarRegistro;
window.segMostrarConfirmEliminar = segMostrarConfirmEliminar;
window.segCancelarConfirmEliminar = segCancelarConfirmEliminar;
window.segConfirmarEliminar    = segConfirmarEliminar;
window.segToggleSidePanel      = segToggleSidePanel;
/* ═══════════════════════════════════════════
   SISTEMA DE INTENSIDADES
═══════════════════════════════════════════ */
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
  segFetch('/api/seguimiento/intensidad-labels?company_id=' + SEG.companyId, {},
    function(data) {
      if (data.niveles && data.niveles.length === 8) {
        SEG_INTENS_LABELS = data.niveles;
      }
      if (data.colores && data.colores.length === 8) {
        SEG_INTENS_COLORS = data.colores;
      }
    },
    function() {} // silencioso — usa fallback hardcoded
  );
}

function segCargarIntensidades() {
  if (!SEG.registroId) return;
  segFetch('/api/seguimiento/registros/' + SEG.registroId + '/intensidades', {},
    function(data) {
      _segIntensidades = data.intensidades || {};
      segRenderizarSeccionTrabajar();
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
      function() {}, function() {}
    );
  }
  segCerrarModalIntensidad();
  segRenderizarSeccionTrabajar();
  segActualizarHeroChipsTrabajar();
  segMarcarCambios();
}

function segCerrarModalIntensidad() {
  var modal = document.getElementById('seg-intensidad-modal');
  if (modal) modal.classList.add('seg-hidden');
  _segIntensidadActual = null;
}

/* ═══════════════════════════════════════════════════════
   MODAL AGENDA — Próxima Sesión
   Reutiliza endpoints existentes del módulo /api/agenda
═══════════════════════════════════════════════════════ */
var _segAgenda = {
  modo:          'sesion',   // 'sesion' | 'recordatorio'
  servicios:     [],         // lista de servicios de la empresa
  svcSelec:      null,       // { service_id, resource_id, name, duration, price }
  especialistas: [],         // especialistas con ese servicio
  espSelec:      null,       // { resource_id, resource_name, service_id }
  cal:           { anio: null, mes: null },
  diaSelec:      null,       // 'YYYY-MM-DD'
  slotsDisp:     {},         // { 'YYYY-MM-DD': [ {start, end}, ... ] }
  horaSelec:     null,       // { start, end }
};

var MESES_AGENDA = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                    'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
var DIAS_AGENDA  = ['Lu','Ma','Mi','Ju','Vi','Sá','Do'];

function segAbrirModalAgenda() {
  // Resetear estado
  _segAgenda.svcSelec    = null;
  _segAgenda.espSelec    = null;
  _segAgenda.diaSelec    = null;
  _segAgenda.horaSelec   = null;
  _segAgenda.slotsDisp   = {};

  var now = new Date();
  _segAgenda.cal = { anio: now.getFullYear(), mes: now.getMonth() };

  // Resetear UI
  document.getElementById('seg-agenda-horas-wrap').classList.add('seg-hidden');
  document.getElementById('seg-agenda-horas').innerHTML = '';
  document.getElementById('seg-agenda-resumen').classList.add('seg-hidden');
  document.getElementById('seg-agenda-confirmar-btn').disabled = true;
  segAgendaModo('sesion');

  // Abrir modal
  document.getElementById('seg-agenda-modal').classList.remove('seg-hidden');

  // Cargar servicios de la empresa
  segFetch('/api/agenda/company?limit=5', {},
    function(data) {
      _segAgenda.servicios = data.services || [];
      segAgendaRenderServicios();
      segAgendaRenderCal();
    },
    function() {
      document.getElementById('seg-agenda-servicios').innerHTML =
        '<span style="font-size:10px;color:#ef4444">Error cargando servicios</span>';
    }
  );
}

function segCerrarModalAgenda() {
  document.getElementById('seg-agenda-modal').classList.add('seg-hidden');
}

function segAgendaModo(modo) {
  _segAgenda.modo = modo;
  document.getElementById('seg-agenda-modo-sesion').classList.toggle('activo', modo === 'sesion');
  document.getElementById('seg-agenda-modo-recordatorio').classList.toggle('activo', modo === 'recordatorio');
  document.getElementById('seg-agenda-sesion-wrap').classList.toggle('seg-hidden', modo !== 'sesion');
  document.getElementById('seg-agenda-recordatorio-wrap').classList.toggle('seg-hidden', modo !== 'recordatorio');
  segAgendaActualizarConfirmar();
}

function segAgendaRenderServicios() {
  var el = document.getElementById('seg-agenda-servicios');
  if (!_segAgenda.servicios.length) {
    el.innerHTML = '<span style="font-size:10px;color:#9ca3af">Sin servicios configurados</span>';
    return;
  }
  el.innerHTML = _segAgenda.servicios.map(function(svc) {
    var nombre = svc.name.replace(/'/g, "\\'");
    return '<span class="seg-agenda-svc-chip" onclick="segAgendaSelecSvc(\'' + nombre + '\')">' +
      segEscape(svc.name) + '</span>';
  }).join('');
}

function segAgendaSelecSvc(nombre) {
  var svc = _segAgenda.servicios.find(function(s) { return s.name === nombre; });
  if (!svc) return;

  // Marcar chip activo
  document.querySelectorAll('.seg-agenda-svc-chip').forEach(function(c) {
    c.classList.toggle('activo', c.textContent === nombre);
  });

  // Determinar especialistas para este servicio
  var especialistas = svc.specialists || [];
  _segAgenda.especialistas = especialistas;
  _segAgenda.horaSelec = null;
  _segAgenda.diaSelec  = null;
  _segAgenda.slotsDisp = {};

  // Si hay un solo especialista seleccionarlo automáticamente
  if (especialistas.length === 1) {
    _segAgenda.espSelec = especialistas[0];
    _segAgenda.svcSelec = {
      service_id:    especialistas[0].service_id,
      resource_id:   especialistas[0].resource_id,
      resource_name: especialistas[0].resource_name,
      name:          svc.name,
      duration:      svc.duration,
      price:         svc.price,
    };
    document.getElementById('seg-agenda-especialista-wrap').classList.add('seg-hidden');
  } else {
    // Mostrar selector de especialista
    _segAgenda.svcSelec = null;
    _segAgenda.espSelec = null;
    segAgendaRenderEspecialistas(especialistas, svc);
    document.getElementById('seg-agenda-especialista-wrap').classList.remove('seg-hidden');
  }

  // Cargar slots del mes actual
  segAgendaCargarMes();
  // Esconder placeholder
  var ph = document.getElementById('seg-agenda-placeholder');
  if (ph) ph.classList.add('seg-hidden');
  segAgendaActualizarConfirmar();
}

function segAgendaRenderEspecialistas(especialistas, svc) {
  var el = document.getElementById('seg-agenda-especialistas');
  el.innerHTML = especialistas.map(function(esp) {
    var rid   = esp.resource_id.replace(/'/g, "\\'");
    var rname = esp.resource_name.replace(/'/g, "\\'");
    var sid   = esp.service_id.replace(/'/g, "\\'");
    var sname = svc.name.replace(/'/g, "\\'");
    return '<span class="seg-agenda-svc-chip" onclick="segAgendaSelecEsp(\'' +
      rid + '\',\'' + rname + '\',\'' + sid + '\',\'' + sname + '\',' +
      svc.duration + ',' + (svc.price || 0) + ')">' +
      segEscape(esp.resource_name) + '</span>';
  }).join('');
}

function segAgendaSelecEsp(resource_id, resource_name, service_id, svc_name, duration, price) {
  _segAgenda.espSelec = { resource_id: resource_id, resource_name: resource_name, service_id: service_id };
  _segAgenda.svcSelec = { service_id: service_id, resource_id: resource_id,
    resource_name: resource_name, name: svc_name, duration: duration, price: price };
  document.querySelectorAll('#seg-agenda-especialistas .seg-agenda-svc-chip').forEach(function(c) {
    c.classList.toggle('activo', c.textContent === resource_name);
  });
  _segAgenda.diaSelec  = null;
  _segAgenda.horaSelec = null;
  _segAgenda.slotsDisp = {};
  segAgendaCargarMes();
  segAgendaActualizarConfirmar();
}

function segAgendaCargarMes() {
  if (!_segAgenda.svcSelec) return;
  var anio = _segAgenda.cal.anio;
  var mes  = _segAgenda.cal.mes;
  var from = anio + '-' + String(mes + 1).padStart(2,'0') + '-01';
  var rid  = _segAgenda.svcSelec.resource_id;
  var sid  = _segAgenda.svcSelec.service_id;

  // Obtener slots del mes completo
  segFetch('/api/agenda/availability/' + rid + '/' + sid + '?from=' + from + '&limit=60', {},
    function(data) {
      _segAgenda.slotsDisp = {};
      (data.slots || []).forEach(function(s) {
        if (!_segAgenda.slotsDisp[s.date]) _segAgenda.slotsDisp[s.date] = [];
        _segAgenda.slotsDisp[s.date].push(s);
      });
      segAgendaRenderCal();
    },
    function() {}
  );
}

function segAgendaCalNav(dir) {
  _segAgenda.cal.mes += dir;
  if (_segAgenda.cal.mes > 11) { _segAgenda.cal.mes = 0;  _segAgenda.cal.anio++; }
  if (_segAgenda.cal.mes < 0)  { _segAgenda.cal.mes = 11; _segAgenda.cal.anio--; }
  segAgendaCargarMes();
  segAgendaRenderCal();
}

function segAgendaRenderCal() {
  var anio   = _segAgenda.cal.anio;
  var mes    = _segAgenda.cal.mes;
  var mesEl  = document.getElementById('seg-agenda-cal-mes');
  var gridEl = document.getElementById('seg-agenda-cal-grid');
  if (mesEl) mesEl.textContent = MESES_AGENDA[mes] + ' ' + anio;

  var hoy        = new Date();
  var primerDia  = new Date(anio, mes, 1);
  var diasMes    = new Date(anio, mes + 1, 0).getDate();
  // Lunes=0 ... Domingo=6
  var offsetLunes = (primerDia.getDay() + 6) % 7;

  var html = DIAS_AGENDA.map(function(d) {
    return '<div class="seg-agenda-cal-head">' + d + '</div>';
  }).join('');

  for (var i = 0; i < offsetLunes; i++) html += '<div class="seg-agenda-cal-day vacio"></div>';

  for (var d = 1; d <= diasMes; d++) {
    var fecha     = anio + '-' + String(mes+1).padStart(2,'0') + '-' + String(d).padStart(2,'0');
    var esHoy     = (anio === hoy.getFullYear() && mes === hoy.getMonth() && d === hoy.getDate());
    var esPasado  = new Date(anio, mes, d) < new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    var tieneSlot = !!(_segAgenda.slotsDisp[fecha] && _segAgenda.slotsDisp[fecha].length);
    var esSelec   = _segAgenda.diaSelec === fecha;

    var cls = 'seg-agenda-cal-day';
    if (esSelec)  cls += ' seleccionado';
    else if (esHoy)    cls += ' hoy';
    if (esPasado) cls += ' pasado';
    else if (!tieneSlot && _segAgenda.svcSelec) cls += ' sin-slots';
    else if (tieneSlot) cls += ' con-slots';

    var onclick = (!esPasado && tieneSlot)
      ? ' onclick="segAgendaSelecDia(\'' + fecha + '\')"'
      : '';

    html += '<div class="' + cls + '"' + onclick + '>' + d + '</div>';
  }

  if (gridEl) gridEl.innerHTML = html;
}

function segAgendaSelecDia(fecha) {
  _segAgenda.diaSelec  = fecha;
  _segAgenda.horaSelec = null;
  segAgendaRenderCal();

  var horasEl = document.getElementById('seg-agenda-horas');
  var wrapEl  = document.getElementById('seg-agenda-horas-wrap');
  var timerEl = document.getElementById('seg-agenda-timer-wrap');

  if (!_segAgenda.svcSelec) return;

  // Mostrar spinner mientras carga disponibilidad fresca
  wrapEl.classList.remove('seg-hidden');
  timerEl.classList.add('seg-hidden');
  horasEl.innerHTML = '<span style="color:#888;font-size:12px">' +
    '<i class="fas fa-spinner fa-spin"></i> Verificando disponibilidad...</span>';

  var svc = _segAgenda.svcSelec;

  function _renderSlots(slots) {
    _segAgenda.slotsDisp[fecha] = slots;
    if (!slots.length) {
      wrapEl.classList.add('seg-hidden');
      timerEl.classList.add('seg-hidden');
      horasEl.innerHTML = '';
      return;
    }
    horasEl.innerHTML = slots.map(function(s) {
      return '<span class="seg-agenda-hora-chip" onclick="segAgendaSelecHora(\'' +
        s.start + '\',\'' + s.end + '\')">' + s.start + '</span>';
    }).join('');
    segAgendaActualizarConfirmar();
  }

  segFetch('/api/agenda/availability/' + svc.resource_id + '/' + svc.service_id +
    '?date=' + fecha, {},
    function(data) { _renderSlots(data.slots || []); },
    function()     { _renderSlots(_segAgenda.slotsDisp[fecha] || []); }
  );
}

function segAgendaSelecHora(start, end) {
  _segAgenda.horaSelec = { start: start, end: end };
  segAgendaAviso(null); // limpiar aviso al seleccionar nueva hora
  document.querySelectorAll('.seg-agenda-hora-chip').forEach(function(c) {
    c.classList.toggle('activo', c.textContent === start);
  });
  // Mostrar timer al seleccionar hora
  document.getElementById('seg-agenda-timer-wrap').classList.remove('seg-hidden');
  segAgendaActualizarConfirmar();
}

function segAgendaActualizarConfirmar() {
  var btn     = document.getElementById('seg-agenda-confirmar-btn');
  var resumen = document.getElementById('seg-agenda-resumen');
  if (!btn) return;

  if (_segAgenda.modo === 'recordatorio') {
    var diaRec = _segAgenda.diaSelec;
    var ok = !!diaRec;
    btn.disabled = !ok;
    if (ok && resumen) {
      resumen.classList.remove('seg-hidden');
      resumen.textContent = 'Recordatorio programado para el ' + diaRec;
    }
    return;
  }

  var ok = !!(_segAgenda.svcSelec && _segAgenda.diaSelec && _segAgenda.horaSelec);
  btn.disabled = !ok;
  if (ok && resumen) {
    resumen.classList.remove('seg-hidden');
    var svc = _segAgenda.svcSelec;

    // Formatear fecha como "miércoles, 8 de abril"
    var partes    = _segAgenda.diaSelec.split('-');
    var fechaObj  = new Date(parseInt(partes[0]), parseInt(partes[1]) - 1, parseInt(partes[2]));
    var diasNombre = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
    var mesesNombre = ['enero','febrero','marzo','abril','mayo','junio',
                       'julio','agosto','septiembre','octubre','noviembre','diciembre'];
    var fechaFmt  = diasNombre[fechaObj.getDay()] + ', ' +
                    fechaObj.getDate() + ' de ' + mesesNombre[fechaObj.getMonth()];

    // Leer cobro del dropdown
    var timerVal  = parseInt(document.getElementById('seg-agenda-timer').value) || 0;
    var cobroLabel = document.getElementById('seg-agenda-dd-label');
    var cobro     = (timerVal > 0 && cobroLabel) ? cobroLabel.textContent.trim() : null;

    resumen.innerHTML = '<i class="fas fa-check-circle" style="color:#16a34a;margin-right:4px"></i>' +
      '📅 ' + fechaFmt + ' · ' +
      '<strong>' + segEscape(svc.name) + '</strong>' +
      (cobro ? ' · Cobro: ' + cobro : '');
  } else if (resumen) {
    resumen.classList.add('seg-hidden');
  }
}

function segAgendaAviso(msg) {
  var el  = document.getElementById('seg-agenda-aviso');
  var txt = document.getElementById('seg-agenda-aviso-msg');
  if (!el || !txt) return;
  if (msg) {
    txt.textContent = msg;
    el.classList.remove('seg-hidden');
  } else {
    el.classList.add('seg-hidden');
    txt.textContent = '';
  }
}



function segConfirmarAgenda() {
  if (_segAgenda.modo === 'recordatorio') {
    segConfirmarRecordatorio();
    return;
  }
  if (!_segAgenda.svcSelec || !_segAgenda.diaSelec || !_segAgenda.horaSelec) return;

  var btn = document.getElementById('seg-agenda-confirmar-btn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verificando...';

  var svc   = _segAgenda.svcSelec;
  var timer = parseInt(document.getElementById('seg-agenda-timer').value) || 0;
  var link  = (document.getElementById('seg-agenda-link-pago').value || '').trim();

  function resetBtn() {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-check"></i> Confirmar';
  }

  // ── Capa 2: validar disponibilidad fresca antes del POST ──────────────────
  segFetch('/api/agenda/availability/' + svc.resource_id + '/' + svc.service_id +
    '?date=' + _segAgenda.diaSelec, {},
    function(avData) {
      var horaSelec = _segAgenda.horaSelec.start;
      var slots     = avData.slots || [];
      var aun_disp  = slots.some(function(s) { return s.start === horaSelec; });

      if (!aun_disp) {
        resetBtn();
        // Refrescar chips con disponibilidad actual
        var horasEl = document.getElementById('seg-agenda-horas');
        _segAgenda.slotsDisp[_segAgenda.diaSelec] = slots;
        _segAgenda.horaSelec = null;
        segAgendaActualizarConfirmar();
        if (horasEl) {
          horasEl.innerHTML = slots.map(function(s) {
            return '<span class="seg-agenda-hora-chip" onclick="segAgendaSelecHora(\'' +
              s.start + '\',\'' + s.end + '\')">' + s.start + '</span>';
          }).join('');
        }
        segAgendaAviso('Este horario ya no está disponible — fue reservado recientemente. Selecciona otro.');
        return;
      }

      // Slot confirmado disponible — proceder con la reserva
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
      _hacerReserva();
    },
    function() {
      // Si falla la validación, proceder igual (el POST detectará el 409)
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
      _hacerReserva();
    }
  );

  // Crear reserva en el módulo Agenda
  function _hacerReserva() {
  segFetch('/api/agenda/reservations', {
    method: 'POST',
    body: JSON.stringify({
      resource_id: svc.resource_id,
      service_id:  svc.service_id,
      contact_id:  SEG.clienteId,
      date:        _segAgenda.diaSelec,
      start:       _segAgenda.horaSelec.start,
      notes:       'Agendado desde Seguimiento'
    })
  },
  function(data) {
    resetBtn();
    var appointment_id = data.appointment_id || data.id || '';

    // Guardar en el registro de seguimiento
    var proxData = {
      appointment_id: appointment_id,
      service_name:   svc.name,
      resource_name:  svc.resource_name || '',
      fecha:          _segAgenda.diaSelec,
      hora:           _segAgenda.horaSelec.start,
      precio:         svc.price || null,
      link_pago:      link,
      timer_horas:    timer,
    };

    if (SEG.registroId) {
      segFetch('/api/seguimiento/registros/' + SEG.registroId, {
        method: 'PUT',
        body: JSON.stringify({ proxima_sesion_data: proxData })
      }, function() {}, function() {});
    }

    // Crear mensaje programado de cobro si hay timer
    if (timer > 0 && link && SEG.registroId) {
      var fechaHora = new Date(_segAgenda.diaSelec + 'T' + _segAgenda.horaSelec.start);
      fechaHora.setHours(fechaHora.getHours() - timer);
      var msgText = '🔔 Recordatorio de pago:\n' +
        'Para confirmar su sesión de ' + svc.name + ' el ' + _segAgenda.diaSelec +
        ' a las ' + _segAgenda.horaSelec.start + ', por favor realice el pago:\n' + link;

      segFetch('/api/seguimiento/mensajes-programados', {
        method: 'POST',
        body: JSON.stringify({
          company_id:  SEG.companyId,
          cliente_id:  SEG.clienteId,
          registro_id: SEG.registroId,
          fecha_envio: fechaHora.toISOString().slice(0,16),
          mensaje:     msgText,
          canal:       'whatsapp',
          tipo:        'cobro_sesion',
        })
      }, function() {}, function() {});
    }

    // Actualizar UI
    segActualizarProximaSesionUI(proxData);
    segAgendaAviso(null); segCerrarModalAgenda();
    segMarcarCambios();

    // Avisar si hubo advertencia de email
    if (data.email_warning || data.warnings) {
      segToast('✅ Sesión agendada · ⚠️ Notificación por email no enviada', 5000);
    } else {
      segToast('✅ Sesión agendada para el ' + _segAgenda.diaSelec + ' a las ' + _segAgenda.horaSelec.start);
    }
  },
  function(err) {
    resetBtn();
    // Detectar si el slot ya está reservado (409 duplicate)
    if (err && (err.status === 409 || (err.data && err.data.code === 'duplicate'))) {
      // Limpiar hora seleccionada y refrescar slots del día
      _segAgenda.horaSelec = null;
      segAgendaActualizarConfirmar();
      segAgendaAviso('Esta hora ya fue reservada o confirmada. Selecciona otro horario.');
      if (_segAgenda.diaSelec && _segAgenda.svcSelec) {
        segFetch('/api/agenda/availability/' + _segAgenda.svcSelec.resource_id +
          '/' + _segAgenda.svcSelec.service_id + '?date=' + _segAgenda.diaSelec, {},
          function(data) {
            var slots = data.slots || [];
            _segAgenda.slotsDisp[_segAgenda.diaSelec] = slots;
            segAgendaSelecDia(_segAgenda.diaSelec);
          },
          function() {}
        );
      }
    } else {
      segToast('❌ Error al agendar. Intente nuevamente.');
    }
  });
  } // fin _hacerReserva
}

function segConfirmarRecordatorio() {
  if (!_segAgenda.diaSelec) return;
  var hora  = segAgendaTpGetValue();
  var link  = (document.getElementById('seg-agenda-link-agenda').value || '').trim();
  var msg   = (document.getElementById('seg-agenda-msg-rec').value || '').trim();

  if (!msg) {
    msg = '🔔 Recordatorio: Le informamos que es momento de agendar su próxima sesión.' +
      (link ? '\\n\\nAgenda aquí: ' + link : '');
  }

  if (SEG.registroId) {
    segFetch('/api/seguimiento/mensajes-programados', {
      method: 'POST',
      body: JSON.stringify({
        company_id:  SEG.companyId,
        cliente_id:  SEG.clienteId,
        registro_id: SEG.registroId,
        fecha_envio: _segAgenda.diaSelec + 'T' + hora,
        mensaje:     msg,
        canal:       'whatsapp',
        tipo:        'recordatorio_agenda',
      })
    }, function() {}, function() {});
  }

  segCerrarModalAgenda();
  segToast('✅ Recordatorio programado para el ' + _segAgenda.diaSelec);
}

function segActualizarProximaSesionUI(data) {
  // Actualizar el campo de próxima sesión visible en el panel
  var el = document.getElementById('seg-proxima-sesion-display');
  if (!el) return;
  el.textContent = data.fecha + ' ' + data.hora + ' — ' + data.service_name;
}

window.segAbrirModalAgenda       = segAbrirModalAgenda;
window._segDiagDropdownSelec     = _segDiagDropdownSelec;

/* ─────────────────────────────────────────
   TIMEPICKER AGENDA RECORDATORIO
───────────────────────────────────────── */
var _segAgendaTp = { hora: 10, min: 0 };

function segAgendaTpToggle() {
  var tp = document.getElementById('seg-agenda-timepicker');
  if (!tp) return;
  if (tp.classList.contains('seg-hidden')) {
    segAgendaTpRender();
    tp.classList.remove('seg-hidden');
  } else {
    tp.classList.add('seg-hidden');
  }
}

function segAgendaTpRender() {
  var horasEl = document.getElementById('seg-agenda-tp-horas');
  var minsEl  = document.getElementById('seg-agenda-tp-minutos');
  if (!horasEl || !minsEl) return;
  var curH = _segAgendaTp.hora;
  var curM = _segAgendaTp.min;
  var htmlH = '';
  for (var h = 0; h <= 23; h++) {
    var cls = 'seg-tp-item' + (h === curH ? ' active' : '');
    htmlH += '<div class="' + cls + '" onclick="segAgendaTpSelHora(' + h + ')">' +
      String(h).padStart(2,'0') + '</div>';
  }
  horasEl.innerHTML = htmlH;
  var htmlM = '';
  for (var m = 0; m < 60; m += 5) {
    var cls2 = 'seg-tp-item' + (m === curM ? ' active' : '');
    htmlM += '<div class="' + cls2 + '" onclick="segAgendaTpSelMin(' + m + ')">' +
      String(m).padStart(2,'0') + '</div>';
  }
  minsEl.innerHTML = htmlM;
  setTimeout(function() {
    var hA = horasEl.querySelector('.active');
    var mA = minsEl.querySelector('.active');
    if (hA) hA.scrollIntoView({ block: 'nearest' });
    if (mA) mA.scrollIntoView({ block: 'nearest' });
  }, 30);
}

function segAgendaTpSelHora(h) {
  _segAgendaTp.hora = h;
  segAgendaTpActualizar();
  document.querySelectorAll('#seg-agenda-tp-horas .seg-tp-item').forEach(function(el, i) {
    el.classList.toggle('active', i === h);
  });
}

function segAgendaTpSelMin(m) {
  _segAgendaTp.min = m;
  segAgendaTpActualizar();
  document.querySelectorAll('#seg-agenda-tp-minutos .seg-tp-item').forEach(function(el, i) {
    el.classList.toggle('active', i * 5 === m);
  });
  setTimeout(function() {
    var tp = document.getElementById('seg-agenda-timepicker');
    if (tp) tp.classList.add('seg-hidden');
  }, 150);
}

function segAgendaTpActualizar() {
  var horaStr = String(_segAgendaTp.hora).padStart(2,'0') + ':' +
                String(_segAgendaTp.min).padStart(2,'0');
  var display = document.getElementById('seg-agenda-hora-display');
  if (display) display.textContent = horaStr;
}

function segAgendaTpGetValue() {
  return String(_segAgendaTp.hora).padStart(2,'0') + ':' +
         String(_segAgendaTp.min).padStart(2,'0');
}

// Cerrar al click fuera
document.addEventListener('click', function(e) {
  var wrap = document.getElementById('seg-agenda-hora-wrap');
  var tp   = document.getElementById('seg-agenda-timepicker');
  if (tp && wrap && !wrap.contains(e.target)) tp.classList.add('seg-hidden');
});


/* ─────────────────────────────────────────
   CUSTOM DROPDOWN — ACTIVAR COBRO
───────────────────────────────────────── */
function segAgendaDdToggle() {
  var wrap = document.getElementById('seg-agenda-timer-wrap-dd');
  var list = document.getElementById('seg-agenda-dd-list');
  if (!wrap || !list) return;
  var abierto = !list.classList.contains('seg-hidden');
  if (abierto) {
    list.classList.add('seg-hidden');
    wrap.classList.remove('abierto');
  } else {
    list.classList.remove('seg-hidden');
    wrap.classList.add('abierto');
  }
}

function segAgendaDdSelect(valor, label) {
  var hidden = document.getElementById('seg-agenda-timer');
  if (hidden) hidden.value = valor;
  var lbl = document.getElementById('seg-agenda-dd-label');
  if (lbl) lbl.textContent = label;
  document.querySelectorAll('.seg-agenda-dd-item').forEach(function(el) {
    el.classList.toggle('activo', el.textContent.trim() === label);
  });
  var list = document.getElementById('seg-agenda-dd-list');
  var wrap = document.getElementById('seg-agenda-timer-wrap-dd');
  if (list) list.classList.add('seg-hidden');
  if (wrap) wrap.classList.remove('abierto');
  // Refrescar resumen
  segAgendaActualizarConfirmar();
}

// Cerrar al click fuera
document.addEventListener('click', function(e) {
  var wrap = document.getElementById('seg-agenda-timer-wrap-dd');
  var list = document.getElementById('seg-agenda-dd-list');
  if (list && wrap && !wrap.contains(e.target)) {
    list.classList.add('seg-hidden');
    wrap.classList.remove('abierto');
  }
});


/* ─────────────────────────────────────────
   BOTTOM SHEET DIAGNÓSTICOS — MÓVIL
───────────────────────────────────────── */
function _segEsMobil() {
  return window.innerWidth <= 768 || ('ontouchstart' in window && window.innerWidth <= 900);
}

function segDiagSheetAbrir(matches) {
  var overlay = document.getElementById('seg-diag-sheet-overlay');
  var sheet   = document.getElementById('seg-diag-sheet');
  var input   = document.getElementById('seg-diag-sheet-input');
  if (!overlay || !sheet) return;

  // Guardar matches actuales para filtrar
  segDiagSheetAbrir._matches = matches || [];

  // Renderizar lista
  segDiagSheetRenderizar(segDiagSheetAbrir._matches);

  // Mostrar
  overlay.classList.remove('seg-hidden');
  sheet.classList.remove('seg-hidden');
  // Animar entrada con pequeño delay
  requestAnimationFrame(function() {
    sheet.classList.add('visible');
  });

  // Limpiar buscador y foco
  if (input) {
    input.value = '';
    setTimeout(function() { input.focus(); }, 300);
  }
}

function segDiagSheetRenderizar(matches) {
  var list = document.getElementById('seg-diag-sheet-list');
  if (!list) return;

  if (!matches || !matches.length) {
    list.innerHTML = '<div class="seg-diag-sheet-empty">Sin resultados — prueba con otro término</div>';
    return;
  }

  list.innerHTML = matches.map(function(d, i) {
    return '<div class="seg-diag-sheet-item" onclick="segDiagSheetSelec(' + i + ')">' +
      '<span class="seg-diag-sheet-codigo">' + segEscape(d.codigo || '—') + '</span>' +
      '<span class="seg-diag-sheet-nombre">' + segEscape(d.nombre) + '</span>' +
      '</div>';
  }).join('');
}

function segDiagSheetFiltrar(q) {
  // Filtrar desde todos los matches originales
  var todos = segDiagSheetAbrir._matches || [];
  if (!q || !q.trim()) {
    segDiagSheetRenderizar(todos);
    return;
  }
  var qn = q.trim().toLowerCase()
    .replace(/[áàä]/g,'a').replace(/[éèë]/g,'e')
    .replace(/[íìï]/g,'i').replace(/[óòö]/g,'o').replace(/[úùü]/g,'u');
  var filtrados = todos.filter(function(d) {
    var n = (d.nombre || '').toLowerCase()
      .replace(/[áàä]/g,'a').replace(/[éèë]/g,'e')
      .replace(/[íìï]/g,'i').replace(/[óòö]/g,'o').replace(/[úùü]/g,'u');
    return n.indexOf(qn) !== -1 || (d.codigo || '').toLowerCase().indexOf(qn) !== -1;
  });
  segDiagSheetRenderizar(filtrados);
}

function segDiagSheetSelec(idx) {
  // Reconstruir lista visible según filtro actual del buscador
  var input = document.getElementById('seg-diag-sheet-input');
  var q = input ? input.value.trim() : '';
  var todos = segDiagSheetAbrir._matches || [];
  var visibles = !q ? todos : todos.filter(function(d) {
    var qn = q.toLowerCase().replace(/[áàä]/g,'a').replace(/[éèë]/g,'e')
      .replace(/[íìï]/g,'i').replace(/[óòö]/g,'o').replace(/[úùü]/g,'u');
    var n = (d.nombre||'').toLowerCase().replace(/[áàä]/g,'a').replace(/[éèë]/g,'e')
      .replace(/[íìï]/g,'i').replace(/[óòö]/g,'o').replace(/[úùü]/g,'u');
    return n.indexOf(qn) !== -1 || (d.codigo||'').toLowerCase().indexOf(qn) !== -1;
  });
  var match = visibles[idx] || todos[idx];
  if (!match) return;

  // Cerrar sheet primero
  segDiagSheetCerrar();

  // Llamar _segDiagConfirmarChip exactamente igual que desktop
  // El try/catch interno garantiza que segAgregarChip siempre se ejecuta
  var chipNombre = match.nombre + ' (' + match.codigo + ')';
  _segDiagConfirmarChip(chipNombre, match.nombre);
}

function segDiagSheetCerrar() {
  var overlay = document.getElementById('seg-diag-sheet-overlay');
  var sheet   = document.getElementById('seg-diag-sheet');
  if (!sheet) return;
  sheet.classList.remove('visible');
  setTimeout(function() {
    if (overlay) overlay.classList.add('seg-hidden');
    if (sheet) sheet.classList.add('seg-hidden');
    // Limpiar modo diag
    _segDiagMode = false;
    _segDiagDropdownCerrar();
  }, 280);
}

window.segCerrarModalAgenda      = segCerrarModalAgenda;
window.segAgendaModo             = segAgendaModo;
window.segAgendaCalNav           = segAgendaCalNav;
window.segAgendaSelecSvc         = segAgendaSelecSvc;
window.segAgendaSelecEsp         = segAgendaSelecEsp;
window.segAgendaSelecDia         = segAgendaSelecDia;
window.segAgendaSelecHora        = segAgendaSelecHora;
window.segConfirmarAgenda        = segConfirmarAgenda;
window.segAgendaTpToggle         = segAgendaTpToggle;
window.segAgendaDdToggle         = segAgendaDdToggle;

function segAbrirCie10Movil() {
  // Leer texto del editor como query inicial
  var editor = document.getElementById('seg-campo-notas');
  var query  = (editor ? (editor.textContent || editor.innerText || '') : '').trim();

  // Limpiar el texto del editor del contenido usado como query
  // (no borramos — el usuario decide qué hacer)

  _segDiagMode = true;
  _segDiagMatches = [];

  // Abrir bottom sheet vacío primero
  segDiagSheetAbrir([]);

  // Pre-rellenar el buscador con el texto del editor
  var input = document.getElementById('seg-diag-sheet-input');
  if (input && query) {
    input.value = query;
  }

  // Buscar con el texto del editor como query, o fallback genérico
  var q = query.length >= 2 ? query : 'trastorno';
  segFetch('/api/seguimiento/diagnosticos?q=' + encodeURIComponent(q) + '&limit=20', {},
    function(data) {
      var matches = data.diagnosticos || [];
      segDiagSheetAbrir._matches = matches;
      segDiagSheetRenderizar(matches);
    },
    function() {}
  );
}

window.segDiagSheetCerrar        = segDiagSheetCerrar;
window.segAbrirCie10Movil        = segAbrirCie10Movil;
window.segDiagSheetSelec         = segDiagSheetSelec;
window.segDiagSheetFiltrar       = segDiagSheetFiltrar;
window.segAgendaDdSelect         = segAgendaDdSelect;
window.segAgendaTpSelHora        = segAgendaTpSelHora;
window.segAgendaTpSelMin         = segAgendaTpSelMin;
window.segAbrirModalIntensidad   = segAbrirModalIntensidad;
window.segSeleccionarIntensidad  = segSeleccionarIntensidad;
window.segCerrarModalIntensidad  = segCerrarModalIntensidad;
window.segToggleLeftPanel        = segToggleLeftPanel;
window.segQuitarChip             = segQuitarChip;
window.segToggleTrabajar         = segToggleTrabajar;
window.segEditarChipHipotesis    = segEditarChipHipotesis;
window.segEliminarChipHipotesis  = segEliminarChipHipotesis;
window.segToggleEtiquetasPanel   = segToggleEtiquetasPanel;
window.segFiltrarPorEtiqueta     = segFiltrarPorEtiqueta;
window.segLimpiarFiltroEtiquetas = segLimpiarFiltroEtiquetas;
window.segToggleRightPanel     = segToggleRightPanel;
window.segNuevaSesion          = segNuevaSesion;
window.segToggleDatePicker     = segToggleDatePicker;
window.segCalNavMes            = segCalNavMes;
window.segSeleccionarFecha     = segSeleccionarFecha;
window.segToggleTimePicker     = segToggleTimePicker;
window.segSeleccionarHora      = segSeleccionarHora;
window.segSeleccionarMinuto    = segSeleccionarMinuto;
/* ─────────────────────────────────────────
   TOOLTIP JS — evita problemas con overflow:hidden
───────────────────────────────────────── */
(function() {
  var tip = document.createElement('div');
  tip.id = 'seg-tooltip';
  tip.style.cssText = [
    'position:fixed',
    'background:#f5f3ff',
    'color:#7D84C1',
    'border:1px solid #c4b5fd',
    'font-size:10px',
    'font-weight:600',
    'padding:4px 8px',
    'border-radius:6px',
    'white-space:nowrap',
    'z-index:99999',
    'pointer-events:none',
    'box-shadow:0 2px 8px rgba(153,97,255,.15)',
    'display:none',
    'font-family:inherit'
  ].join(';');
  document.body.appendChild(tip);

  document.addEventListener('mouseover', function(e) {
    var el = e.target.closest('[data-seg-tooltip]');
    if (el) {
      tip.textContent = el.getAttribute('data-seg-tooltip');
      tip.style.display = 'block';
    }
  });
  document.addEventListener('mousemove', function(e) {
    if (tip.style.display === 'block') {
      tip.style.left = (e.clientX + 10) + 'px';
      tip.style.top  = (e.clientY - 28) + 'px';
    }
  });
  document.addEventListener('mouseout', function(e) {
    if (!e.relatedTarget || !e.relatedTarget.closest('[data-seg-tooltip]')) {
      tip.style.display = 'none';
    }
  });
})();

window.segInit                = segInit;
window.segSetCompany          = segSetCompany;
window.segSeleccionarCliente  = segSeleccionarCliente;
window.segSeleccionarRegistro = segSeleccionarRegistro;
window.segGuardar             = segGuardar;
window.segGenerarResumen      = segGenerarResumen;
window.segRegenerarResumen    = segRegenerarResumen;
window.segSetCanal            = segSetCanal;
window.segEnviarAlCliente     = segEnviarAlCliente;
window.segAceptarEtiquetaIA   = segAceptarEtiquetaIA;
window.segEnviarWA            = segEnviarWA;
window.segEnviarEmail         = segEnviarEmail;
window.segPromover            = segPromover;
window.segBuscar              = segBuscar;
window.segSetTab              = segSetTab;
window.segToggleTL            = segToggleTL;
window.segAddEvento           = segAddEvento;
window.segEliminarEvento      = segEliminarEvento;
window.segSyncTimeline        = segSyncTimeline;
window.segMarcarCambios       = segMarcarCambios;
window.segVerPlantillas       = segVerPlantillas;
window.segNuevoMensajeProg    = segNuevoMensajeProg;
window.segEditarResumen       = segEditarResumen;

/* ─────────────────────────────────────────
   AUTO-INIT
   El router llama initSeguimientoPage() al cargar la página.
   Si no existe ese hook, el IIFE hace polling como fallback.
───────────────────────────────────────── */
function initSeguimientoPage() {
  // Resetear estado para re-inicialización limpia
  SEG.clienteId     = null;
  SEG.registroId    = null;
  SEG.contexto      = null;
  SEG.hayUnsaved    = false;
  SEG.etiquetasActivas     = [];
  SEG.etiquetasDisponibles = [];
  SEG._adjuntos     = [];
  SEG._plantillas   = {};
  SEG._canal        = 'whatsapp';
  segInit();
  // Inicializar editor notas al cargar la página
  setTimeout(segInicializarEditorNotas, 100);
}
window.initSeguimientoPage = initSeguimientoPage;

(function segAutoInit() {
  if (document.getElementById('seg-entity-list')) {
    // DOM listo — siempre inicializar (puede ser re-navegación)
    segInit();
  } else {
    setTimeout(segAutoInit, 80);
  }
})();