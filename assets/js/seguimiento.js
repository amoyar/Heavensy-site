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
  _slashQuery:          '',
  _cal: { anio: null, mes: null, fechaSel: null }, // date picker state
  _tp:  { hora: null, min: null }                  // time picker state
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
  SEG.companyId     = companyId;
  SEG.companyNombre = nombre;
  SEG.clienteId     = null;
  SEG.registroId    = null;
  SEG.contexto      = null;

  var nameEl = document.getElementById('seg-company-name');
  if (nameEl) nameEl.textContent = nombre || companyId;

  segMostrarEmptyMain();

  segCargarLabels(companyId, function() {
    segCargarClientes(companyId);
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

  segFetch('/api/seguimiento/clientes/' + clienteId + '/contexto?company_id=' + SEG.companyId, {}, function(data) {
    SEG.contexto   = data;
    SEG.registroId = data.registro_activo ? data.registro_activo._id : null;
    segMostrarRegistroWrap();
    segRenderizarContexto(data);
    // Mostrar botón colapsar ahora que hay paciente
    var btnCol = document.getElementById('seg-btn-collapse-left');
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
  if (notasInput) notasInput.value = reg.notas_internas || '';
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

function segRenderizarEtiquetasActivas(etiquetas, lb) {
  var el = document.getElementById('seg-etiquetas-activas');
  if (!el) return;
  var lista = (etiquetas || []).map(function(et) {
    return typeof et === 'string' ? et : (et.nombre || '');
  }).filter(Boolean);
  el.innerHTML = lista.map(function(nombre) {
    return '<span class="seg-hist-tag">' + segEscape(nombre) + '</span>';
  }).join('') || '<span style="font-size:10px;color:#b0b9c8">Sin etiquetas</span>';
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
   SISTEMA /SLASH — ETIQUETAS EN NOTAS
───────────────────────────────────────── */
function segNotasInput(textarea) {
  var val    = textarea.value;
  var cursor = textarea.selectionStart;
  // Buscar /palabra antes del cursor
  var antes  = val.substring(0, cursor);
  var match  = antes.match(/\/(\w*)$/);

  if (!match) {
    segCerrarSlash();
    return;
  }

  var query = match[1].toLowerCase();
  SEG._slashQuery = query;

  // Filtrar etiquetas disponibles
  var sugeridas = SEG.etiquetasDisponibles.filter(function(e) {
    return e.toLowerCase().includes(query) &&
           SEG.etiquetasActivas.indexOf(e) === -1;
  }).slice(0, 6);

  if (!match) {
    // No hay sugerencias pero sí hay query activa — mantener query para crear con espacio
    SEG._slashQuery = query;
    var drop = document.getElementById('seg-slash-dropdown');
    if (drop) drop.classList.add('seg-hidden');
    return;
  }

  var items = document.getElementById('seg-slash-items');
  var drop  = document.getElementById('seg-slash-dropdown');
  if (!items || !drop) return;

  items.innerHTML = sugeridas.map(function(e) {
    return '<div class="seg-slash-item" onmousedown="segSeleccionarEtiqueta(\'' + segEscape(e) + '\')">' +
      '<i class="fas fa-tag"></i> ' + segEscape(e) + '</div>';
  }).join('');

  drop.classList.remove('seg-hidden');
}

function segNotasKeydown(e) {
  var drop = document.getElementById('seg-slash-dropdown');
  if (!drop || drop.classList.contains('seg-hidden')) return;
  var items = drop.querySelectorAll('.seg-slash-item');
  var active = drop.querySelector('.seg-slash-item.active');
  var idx = Array.from(items).indexOf(active);

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (active) active.classList.remove('active');
    var next = items[(idx + 1) % items.length];
    if (next) next.classList.add('active');
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (active) active.classList.remove('active');
    var prev = items[(idx - 1 + items.length) % items.length];
    if (prev) prev.classList.add('active');
  } else if (e.key === 'Enter' && active) {
    e.preventDefault();
    segSeleccionarEtiqueta(active.textContent.replace(/^\s*\S+\s/, '').trim());
  } else if (e.key === 'Escape') {
    segCerrarSlash();
  } else if (e.key === ' ') {
    // Espacio con /palabra activo — crear etiqueta con la query actual
    if (SEG._slashQuery) {
      e.preventDefault();
      // Buscar match exacto en disponibles, si no crear nueva
      var match = SEG.etiquetasDisponibles.find(function(et) {
        return et.toLowerCase() === SEG._slashQuery.toLowerCase();
      }) || SEG._slashQuery;
      segSeleccionarEtiqueta(match);
    }
  }
}

function segSeleccionarEtiqueta(etiqueta) {
  if (!etiqueta) return;
  var textarea = document.getElementById('seg-campo-notas');
  if (!textarea) return;

  // Reemplazar /query por el nombre de la etiqueta en el texto
  var val    = textarea.value;
  var cursor = textarea.selectionStart;
  var antes  = val.substring(0, cursor);
  var nuevo  = antes.replace(/\/\w*$/, etiqueta + ' ');
  textarea.value = nuevo + val.substring(cursor);
  textarea.selectionStart = textarea.selectionEnd = nuevo.length;

  // Agregar chip si no está ya
  if (SEG.etiquetasActivas.indexOf(etiqueta) === -1) {
    SEG.etiquetasActivas.push(etiqueta);
    segRenderizarChipsEtiquetas();
    segMarcarCambios();
    // Si es etiqueta nueva (no estaba en disponibles), guardarla como custom
    if (SEG.etiquetasDisponibles.indexOf(etiqueta) === -1) {
      SEG.etiquetasDisponibles.push(etiqueta);
      segFetch('/api/seguimiento/etiquetas',
        { method: 'POST', body: JSON.stringify({ company_id: SEG.companyId, nombre: etiqueta }) },
        function() {}, // silencioso
        function() {}
      );
    }
  }
  segCerrarSlash();
  textarea.focus();
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

function segCerrarSlash() {
  SEG._slashQuery = '';
  var drop = document.getElementById('seg-slash-dropdown');
  if (drop) drop.classList.add('seg-hidden');
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
    notas_internas:      (document.getElementById('seg-campo-notas')||{}).value || '',
    etiquetas:           SEG.etiquetasActivas.slice(),
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
      if (badge) badge.classList.remove('seg-hidden');
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
    if (tn) tn.value = data.notas_internas || '';
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
  // Sin paciente → ocultar botón y restaurar panel si estaba colapsado
  var btnCol = document.getElementById('seg-btn-collapse-left');
  if (btnCol) btnCol.classList.add('seg-hidden');
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
    notas_internas:      (document.getElementById('seg-campo-notas')||{}).value || '',
    etiquetas:           SEG.etiquetasActivas.slice(),
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


function segToast(msg, tipo) {
  var el     = document.getElementById('seg-toast');
  var msgEl  = document.getElementById('seg-toast-msg');
  var iconEl = document.getElementById('seg-toast-icon');
  if (!el || !msgEl) return;
  msgEl.textContent = msg;
  el.className = 'seg-toast visible';
  if (tipo === 'success') { el.className += ' success'; if (iconEl) iconEl.className = 'fas fa-check-circle'; }
  else if (tipo === 'error') { el.className += ' error'; if (iconEl) iconEl.className = 'fas fa-exclamation-circle'; }
  else { if (iconEl) iconEl.className = 'fas fa-info-circle'; }
  clearTimeout(SEG._toastTimer);
  SEG._toastTimer = setTimeout(function(){ el.classList.remove('visible'); }, 2800);
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
      if (onSuccess) onSuccess(res.data);
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
  if (tn) tn.value = '';

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
window.segToggleLeftPanel      = segToggleLeftPanel;
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