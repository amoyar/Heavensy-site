/* ═══════════════════════════════════════════════════════
   SEGUIMIENTO — seg-contexto.js
   segSeleccionarCliente, segRenderizarContexto, segSetHero, segRenderizarHistorial, segRenderizarTimeline, segRenderizarTLEdit.
═══════════════════════════════════════════════════════ */

function segSeleccionarCliente(clienteId, nombre, avatar, citaId, citaStatus) {
  // Mismo cliente Y misma cita → no recargar
  if (SEG.clienteId === clienteId && SEG.citaId === (citaId || null)) return;

  if (SEG.hayUnsaved) {
    segConfirm('Hay cambios sin guardar. ¿Continuar sin guardar?', function() {
      SEG.hayUnsaved = false;
      segSeleccionarCliente(clienteId, nombre, avatar, citaId, citaStatus);
    });
    return;
  }

  SEG.clienteId  = clienteId;
  SEG.registroId = null;
  SEG.citaId     = citaId   || null;
  SEG.citaStatus = citaStatus || null;
  SEG.hayUnsaved = false;
  SEG._canal     = 'whatsapp';

  // Actualizar visual active en la lista sin re-renderizar
  if (typeof segActualizarActivoLista === 'function') segActualizarActivoLista();

  // Resetear panel de evolución
  segResetEvolucion();

  // Resetear e iniciar panel de derivaciones
  if (typeof segDerInit === 'function') segDerInit();

  // Unirse al room de Socket.IO para recibir eventos en tiempo real
  if (typeof window.setRealtimeContext === 'function') {
    window.setRealtimeContext({
      companyId: SEG.companyId,
      userId:    clienteId
    });
  }

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

  // Marcar activo en lista — usar citaId si está disponible para distinguir citas del mismo paciente
  document.querySelectorAll('.seg-entity-item').forEach(function(el) {
    el.classList.remove('active');
  });
  var selector = SEG.citaId
    ? '.seg-entity-item[data-wa-id="' + clienteId + '"][data-cita-id="' + SEG.citaId + '"]'
    : '.seg-entity-item[data-wa-id="' + clienteId + '"]';
  var target = document.querySelector(selector);
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
    // Cargar intensidades primero, luego derivaciones (secuencial — evita race condition)
    _segIntensidades = {};
    segCargarIntensidades(function() {
      // Una vez cargadas las intensidades, cargar derivaciones
      // Así segActualizarHeroChipsTrabajar siempre tiene _segIntensidades disponible
      if (typeof segDerCargar === 'function') segDerCargar();
    });
    // Mostrar botón colapsar ahora que hay paciente
    var btnCol = document.getElementById('seg-btn-collapse-left');
    if (btnCol) btnCol.classList.remove('seg-hidden');
  }, function() {
    segMostrarEmptyMain();
    segToast('Error al cargar el contexto', 'error');
  });
}

function segRenderizarContexto(ctx) {
  var lb  = SEG.labels;
  var reg = ctx.registro_activo || {};
  var cli = ctx.cliente || {};

  // Siempre partir desde el editor (nunca dejar plantilla de registro anterior activa)
  segPnResetearVista();

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
      segSetHeroStatus(reg.estado, lb);
    } else {
      statusEl.classList.add('seg-hidden');
    }
  }

  // Resetear siempre al cargar un registro, luego activar modo lectura si está cerrado
  segDesactivarModoLectura();
  segActualizarBtnCerrar(reg._id ? reg.estado : null);
  if (reg._id && reg.estado === 'cerrado') {
    setTimeout(segActivarModoLectura, 100);
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
  if (badgeEl) {
    var estadoTxt = reg.estado === 'en_curso'  ? (lb.status_active||'En curso')
                  : reg.estado === 'enviado'   ? (lb.status_sent||'Enviado')
                  : reg.estado === 'cerrado'   ? 'Cerrado'
                  : (lb.status_pending||'Pendiente');
    badgeEl.textContent = estadoTxt;
    badgeEl.className = 'seg-badge-cur seg-badge-' + (reg.estado || 'pendiente');
  }

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
  // Cargar chips guardados — suprimir marcarCambios durante la carga
  var _hayUnsavedBak = SEG.hayUnsaved;
  SEG.hayUnsaved = false;
  if (reg.chips_sintoma)     (reg.chips_sintoma||[]).forEach(function(c){ segAgregarChip('sintoma',c); });
  if (reg.chips_diagnostico) (reg.chips_diagnostico||[]).forEach(function(c){ segAgregarChip('diagnostico',c); });
  if (reg.chips_hipotesis)   (reg.chips_hipotesis||[]).forEach(function(c){ segAgregarChip('hipotesis',c); });
  _segChips.trabajar = (reg.chips_trabajar || []).slice();
  segRenderizarSeccionTrabajar();
  segActualizarHeroChipsTrabajar();
  if (typeof segDerRenderizarChips === 'function') segDerRenderizarChips();
  SEG.hayUnsaved = _hayUnsavedBak;
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
  // Configuración dinámica desde BD
  if (ctx.opciones_cobro && ctx.opciones_cobro.length) {
    segRenderizarDropdownCobro(ctx.opciones_cobro);
  }
  segAplicarPlaceholders(lb);

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

  // Restaurar modo plantilla si el registro fue guardado con una
  if (reg.modo_notas && reg.modo_notas.indexOf('plantilla:') === 0) {
    var _pidCtx = reg.modo_notas.replace('plantilla:', '');
    setTimeout(function() {
      segPnFormAbrir(_pidCtx, reg.campos_plantilla || []);
    }, 150);
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

function segSetHeroStatus(estado, lb) {
  var el = document.getElementById('seg-hero-status');
  if (!el) return;
  el.classList.remove('estado-en-curso', 'estado-enviado', 'estado-pendiente', 'estado-cerrado');
  if (estado === 'en_curso') {
    el.textContent = (lb && lb.status_active)  || 'En curso';
    el.classList.add('estado-en-curso');
  } else if (estado === 'enviado') {
    el.textContent = (lb && lb.status_sent)    || 'Enviado';
    el.classList.add('estado-enviado');
  } else if (estado === 'cerrado') {
    el.textContent = 'Cerrado';
    el.classList.add('estado-cerrado');
  } else {
    el.textContent = (lb && lb.status_pending) || 'Pendiente';
    el.classList.add('estado-pendiente');
  }
  el.classList.remove('seg-hidden');
}

function segRenderizarTimelineActual() {
  var ctx = SEG.contexto;
  if (!ctx || !ctx.timeline) return;
  var lb = SEG.labels || {};
  segRenderizarTimeline(ctx.timeline, lb.timeline_titulo, lb.timeline_inicio);
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
  var _MESES_TL = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  var toggleBtn = document.getElementById('seg-tl-toggle-hora');
  var _tlMostrarHora = toggleBtn ? toggleBtn.classList.contains('activo') : true;

  tlEl.innerHTML = eventos.map(function(ev, i) {
    var isFirst = i === 0, isLast = i === eventos.length - 1;
    var dotCls = isFirst ? 'birth' : isLast ? 'today' : '';
    var clr    = isLast ? 'color:#9961FF' : '';
    var evId   = ev._id || ev.id || '';
    var evLabel= ev.label || ev.titulo || '';

    // Formato fecha: si tiene mes → "Abr 2026", si no → "2026"
    var anio = ev.year || ev.anio || '';
    var mes  = ev.mes  || ev.month || null;
    var dia  = ev.dia  || null;
    var evHora = ev.hora || '';
    var fechaTxt = anio ? String(anio) : '';
    if (mes && mes >= 1 && mes <= 12) fechaTxt = _MESES_TL[mes - 1] + ' ' + anio;
    if (dia) fechaTxt = dia + ' ' + fechaTxt;

    var evYear = fechaTxt; // used by data attributes for edit

    var dotClick = (!isFirst && evId)
      ? 'onclick="segTlPuntoClick(event, this)" ' +
        'data-ev-id="' + segEscape(evId) + '" ' +
        'data-ev-year="' + segEscape(String(anio)) + '" ' +
        'data-ev-mes="' + segEscape(String(mes || '')) + '" ' +
        'data-ev-dia="' + segEscape(String(dia || '')) + '" ' +
        'data-ev-hora="' + segEscape(evHora) + '" ' +
        'data-ev-label="' + segEscape(evLabel) + '" ' +
        'style="cursor:pointer" data-seg-tooltip="Editar o eliminar"'
      : '';

    var horaHtml = (_tlMostrarHora && evHora)
      ? '<div class="seg-tl-hora" style="' + clr + '">' + segEscape(evHora.slice(0,5)) + '</div>'
      : '';

    var html = '<div class="seg-tl-item">' +
      '<div class="seg-tl-dot ' + dotCls + '" ' + dotClick + '></div>' +
      '<div class="seg-tl-year" style="' + clr + '">' + segEscape(fechaTxt) + '</div>' +
      horaHtml +
      '<div class="seg-tl-label" style="' + clr + '" data-seg-tooltip="' + segEscape(evLabel) + '">' + segEscape(evLabel) + '</div>' +
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

  var MAX_CHIP_LEN = 18; // caracteres antes de truncar

  function _chipTruncado(nombre, bgColor, textColor, borderColor, clsExtra) {
    var truncado = nombre.length > MAX_CHIP_LEN ? nombre.slice(0, MAX_CHIP_LEN) + '...' : nombre;
    var tooltip  = nombre.length > MAX_CHIP_LEN ? ' data-seg-tooltip="' + segEscape(nombre) + '"' : '';
    return '<span class="seg-hist-chip' + (clsExtra ? ' ' + clsExtra : '') + '"' +
      ' style="background:' + bgColor + ';color:' + textColor + ';border:0.5px solid ' + borderColor + '"' +
      tooltip + '>' + segEscape(truncado) + '</span>';
  }

  function _chipTrabajar(nombre, nivel, colors, texts) {
    var truncado = nombre.length > MAX_CHIP_LEN ? nombre.slice(0, MAX_CHIP_LEN) + '...' : nombre;
    var tooltip  = nombre.length > MAX_CHIP_LEN ? ' data-seg-tooltip="' + segEscape(nombre) + '"' : '';
    var badge = '';
    if (nivel !== null && nivel !== undefined) {
      var badgeColor = (nivel && colors && colors[nivel]) ? colors[nivel] : '#e5e7eb';
      var badgeTxt   = (nivel && texts  && texts[nivel])  ? texts[nivel]  : '#9ca3af';
      badge = '<span class="seg-hist-intens-badge" style="background:' + badgeColor + ';color:' + badgeTxt + '">' +
        (nivel || '·') +
      '</span>';
    }
    return '<span class="seg-hist-chip seg-hist-chip-trabajar"' + tooltip + '>' +
      segEscape(truncado) +
      badge +
    '</span>';
  }

  el.innerHTML = historial.map(function(h, i) {
    var rid        = h._id || h.id || '';
    var badgeCls   = h.estado === 'enviado'  ? 'enviado'
                   : h.estado === 'en_curso' ? 'nueva'
                   : h.estado === 'cerrado'  ? 'cerrado'
                   : 'pendiente';
    var badgeTxt   = h.estado === 'enviado'  ? 'Enviado'
                   : h.estado === 'en_curso' ? 'En curso'
                   : h.estado === 'cerrado'  ? 'Cerrado'
                   : 'Pendiente';
    var preview    = h.resumen_corto || h.contenido_principal || '';
    var intens     = h.intensidades || {};
    var colors     = SEG_INTENS_COLORS;
    var texts      = SEG_INTENS_TEXT;

    // Síntomas = sintoma + diagnostico combinados
    var sintomas = [].concat(h.chips_sintoma || [], h.chips_diagnostico || []);
    var trabajar = h.chips_trabajar || [];

    var sintChips = sintomas.map(function(n) {
      return _chipTruncado(n, '#ede9fe', '#5b21b6', '#c4b5fd', '');
    }).join('');

    var trabChips = trabajar.map(function(n) {
      var esDiag  = (h.chips_diagnostico || []).indexOf(n) !== -1;
      var esSint  = (h.chips_sintoma || []).indexOf(n) !== -1;
      var conIntens = esDiag || esSint;
      var nivel   = conIntens ? (intens[n] || 0) : null;
      return _chipTrabajar(n, nivel, colors, texts);
    }).join('');

    var secSint = sintChips
      ? '<div class="seg-hist-chips-sec">' +
          '<span class="seg-hist-chips-label">Síntomas</span>' +
          '<div class="seg-hist-chips-row">' + sintChips + '</div>' +
        '</div>'
      : '';

    var secTrab = trabChips
      ? '<div class="seg-hist-chips-sec">' +
          '<span class="seg-hist-chips-label">Lo que se abordó</span>' +
          '<div class="seg-hist-chips-row">' + trabChips + '</div>' +
        '</div>'
      : '';

    return '<div class="seg-hist-card' + (i===0?' active':'') + '" id="hist-' + segEscape(rid) + '">' +
      '<div class="seg-hist-card-top" onclick="segSeleccionarRegistro(\'' + segEscape(rid) + '\')">' +
        '<div class="seg-hist-date">' + segFormatFechaCorta(h.fecha) + (h.hora ? '<span class="seg-hist-hora">' + h.hora + '</span>' : '') + '</div>' +
        '<button class="seg-hist-delete-btn" data-seg-tooltip="Eliminar sesión" ' +
          'onclick="event.stopPropagation();segMostrarConfirmEliminar(\'' + segEscape(rid) + '\')">' +
          '<i class="fas fa-trash"></i>' +
        '</button>' +
      '</div>' +
      '<div class="seg-hist-preview" onclick="segSeleccionarRegistro(\'' + segEscape(rid) + '\')">' + segEscape(preview) + '</div>' +
      (secSint || secTrab
        ? '<div class="seg-hist-chips-wrap" onclick="segSeleccionarRegistro(\'' + segEscape(rid) + '\')">' +
            secSint + secTrab +
          '</div>'
        : '') +
      '<span class="seg-hist-badge ' + badgeCls + '" onclick="segSeleccionarRegistro(\'' + segEscape(rid) + '\')">' + badgeTxt + '</span>' +
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
   MODO LECTURA — sesión cerrada
───────────────────────────────────────── */
function segActivarModoLectura() {
  // Bloquear todos los campos editables
  var campos = ['seg-campo-notas', 'seg-campo-contenido', 'seg-campo-tareas', 'seg-campo-proxima'];
  campos.forEach(function(id) {
    var el = document.getElementById(id);
    if (el) {
      el.setAttribute('contenteditable', 'false');
      el.setAttribute('readonly', true);
      el.classList.add('seg-campo-cerrado');
    }
  });
  // Deshabilitar botón guardar (no ocultar — mantiene visible la barra)
  var btnGuardar = document.getElementById('seg-btn-guardar');
  if (btnGuardar) { btnGuardar.disabled = true; btnGuardar.classList.add('seg-campo-cerrado'); }
  // Ocultar botones de edición secundarios
  var ocultar = ['seg-btn-generar-ia', 'seg-btn-enviar-cliente',
                 'seg-btn-nueva-sesion', 'seg-tl-add-btn'];
  ocultar.forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.classList.add('seg-hidden');
  });
  // Ocultar botón cerrar, mostrar badge
  var btnCerrar = document.getElementById('seg-btn-cerrar-sesion');
  if (btnCerrar) btnCerrar.classList.add('seg-hidden');
  // Deshabilitar autoguardado
  SEG._cerrado = true;
}

function segDesactivarModoLectura() {
  // Restaurar campos editables
  var campos = ['seg-campo-notas', 'seg-campo-contenido', 'seg-campo-tareas', 'seg-campo-proxima'];
  campos.forEach(function(id) {
    var el = document.getElementById(id);
    if (el) {
      el.setAttribute('contenteditable', id === 'seg-campo-notas' ? 'true' : 'false');
      el.removeAttribute('readonly');
      el.classList.remove('seg-campo-cerrado');
    }
  });
  // Restaurar botón guardar
  var btnGuardar = document.getElementById('seg-btn-guardar');
  if (btnGuardar) { btnGuardar.disabled = false; btnGuardar.classList.remove('seg-campo-cerrado'); }
  // Restaurar botones secundarios
  var mostrar = ['seg-btn-generar-ia', 'seg-btn-nueva-sesion'];
  mostrar.forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.classList.remove('seg-hidden');
  });
  SEG._cerrado = false;
}

function segActualizarBtnCerrar(estado) {
  var btn = document.getElementById('seg-btn-cerrar-sesion');
  if (!btn) return;
  if (estado === 'cerrado') {
    btn.classList.add('seg-hidden');
  } else if (estado && SEG.registroId) {
    btn.classList.remove('seg-hidden');
  } else {
    btn.classList.add('seg-hidden');
  }
}