/* ═══════════════════════════════════════════════════════
   SEGUIMIENTO — seg-navegacion.js
   segSeleccionarRegistro (carga registro del historial), segBuscar, segSetTab, segToggleTL.
═══════════════════════════════════════════════════════ */

function segSeleccionarRegistro(registroId) {
  if (!registroId) return;
  if (SEG.hayUnsaved) {
    segConfirm('Hay cambios sin guardar. ¿Continuar?', function() {
      SEG.hayUnsaved = false;
      segSeleccionarRegistro(registroId);
    });
    return;
  }

  // Marcar card como cargando, bloquear otras
  document.querySelectorAll('.seg-hist-card').forEach(function(el) {
    el.classList.remove('active', 'seg-hist-loading');
    el.style.pointerEvents = 'none';
  });
  var cardCargando = document.getElementById('hist-' + registroId);
  if (cardCargando) cardCargando.classList.add('seg-hist-loading');
  SEG.registroId = registroId;
  segFetch('/api/seguimiento/registros/' + registroId, {}, function(resp) {
    // El endpoint devuelve { ok: true, registro: {...} }
    var data = resp.registro || resp;
    var lb = SEG.labels;

    // Siempre partir desde el editor antes de cargar el nuevo registro
    segPnResetearVista();

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
    var _hayUnsavedBak2 = SEG.hayUnsaved;
    SEG.hayUnsaved = false;
    if (data.chips_sintoma)     (data.chips_sintoma||[]).forEach(function(c){ segAgregarChip('sintoma',c); });
    if (data.chips_diagnostico) (data.chips_diagnostico||[]).forEach(function(c){ segAgregarChip('diagnostico',c); });
    if (data.chips_hipotesis)   (data.chips_hipotesis||[]).forEach(function(c){ segAgregarChip('hipotesis',c); });
    _segChips.trabajar = (data.chips_trabajar || []).slice();
    // Limpiar intensidades anteriores y cargar las de este registro
    _segIntensidades = {};
    segRenderizarSeccionTrabajar();
    segActualizarHeroChipsTrabajar();
    SEG.hayUnsaved = _hayUnsavedBak2;
    // Cargar intensidades desde BD (actualiza los badges al llegar)
    segCargarIntensidades();
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
    // Actualizar badge de estado y hero status con color correcto
    var badgeEl = document.getElementById('seg-badge-estado');
    var estadoTxt = data.estado === 'en_curso'  ? (lb.status_active||'En curso')
                  : data.estado === 'enviado'   ? (lb.status_sent||'Enviado')
                  : (lb.status_pending||'Pendiente');
    if (badgeEl) badgeEl.textContent = estadoTxt;
    if (typeof segSetHeroStatus === 'function') segSetHeroStatus(data.estado, lb);
    SEG.hayUnsaved = false;
    // Restaurar cards — quitar loading, marcar activa
    document.querySelectorAll('.seg-hist-card').forEach(function(el) {
      el.classList.remove('seg-hist-loading');
      el.style.pointerEvents = '';
    });
    var cardActiva = document.getElementById('hist-' + registroId);
    if (cardActiva) cardActiva.classList.add('active');
    // Restaurar modo plantilla si el registro fue guardado con una
    if (data.modo_notas && data.modo_notas.indexOf('plantilla:') === 0) {
      var _pidHist = data.modo_notas.replace('plantilla:', '');
      setTimeout(function() {
        segPnFormAbrir(_pidHist, data.campos_plantilla || []);
      }, 150);
    }
  }, function() {
    // Error — restaurar cards
    document.querySelectorAll('.seg-hist-card').forEach(function(el) {
      el.classList.remove('seg-hist-loading');
      el.style.pointerEvents = '';
    });
    segToast('Error al cargar el registro', 'error');
  });
}

/* ─────────────────────────────────────────
   BUSQUEDA
───────────────────────────────────────── */
function segBuscar(query) {
  var q = (query||'').toLowerCase().trim();
  var listEl = document.getElementById('seg-entity-list');
  if (!listEl) return;

  // Sin búsqueda: restaurar vista actual según filtro activo
  if (!q) {
    if (typeof segCambiarFiltroAgenda === 'function') {
      segCambiarFiltroAgenda(typeof _segFiltroActivo !== 'undefined' ? _segFiltroActivo : 'hoy');
    }
    return;
  }

  // Filtrar sobre la lista actualmente visible (_segAgendaActual)
  var fuente = (typeof _segAgendaActual !== 'undefined' && _segAgendaActual.length)
    ? _segAgendaActual
    : (SEG.hayTodas || []);

  var filtrados = fuente.filter(function(e) {
    return (e.nombre||'').toLowerCase().includes(q) ||
           (e.wa_id||'').toLowerCase().includes(q) ||
           (e.especialidad||'').toLowerCase().includes(q) ||
           (e.servicio||'').toLowerCase().includes(q);
  });

  // Renderizar resultados sin cambiar el filtro activo
  if (filtrados.length === 0) {
    listEl.innerHTML = '<div class="seg-list-empty"><i class="fas fa-search"></i> Sin resultados para "' + segEscape(query) + '"</div>';
  } else {
    // Usar el renderer apropiado según el filtro activo
    if (typeof _segFiltroActivo !== 'undefined' && _segFiltroActivo !== 'todos') {
      // Agenda mode — render como tarjetas de agenda
      var html = filtrados.map(function(p) {
        var active = (SEG.clienteId && SEG.clienteId === p.wa_id) ? ' active' : '';
        var nombre = segEscape(p.nombre || p.wa_id);
        var avatar = p.avatar || '?';
        var metaParts = [];
        if (p.hora_inicio) metaParts.push('<span class="seg-entity-hora">' + p.hora_inicio + '</span>');
        if (p.servicio)    metaParts.push(segEscape(p.servicio));
        if (p.duracion)    metaParts.push(p.duracion + ' min');
        var meta = metaParts.join(' · ') || segEscape(p.especialidad || p.servicio || '');
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
      listEl.innerHTML = html;
      segRenderizarFiltrosAgenda(listEl);
    } else {
      segRenderizarListaNormal(filtrados);
    }
  }
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
   TIMELINE — popover editar/eliminar punto
───────────────────────────────────────── */
function segTlPuntoClick(event, dot) {
  event.stopPropagation();
  var evId    = dot.getAttribute('data-ev-id')    || '';
  var evYear  = dot.getAttribute('data-ev-year')  || '';
  var evLabel = dot.getAttribute('data-ev-label') || '';
  if (!evId) return;
  // Cerrar cualquier popover abierto
  var existing = document.getElementById('seg-tl-popover');
  if (existing) {
    if (existing.getAttribute('data-ev-id') === evId) {
      existing.remove(); return;
    }
    existing.remove();
  }

  var dot = event.currentTarget;
  var rect = dot.getBoundingClientRect();
  var wrap = document.getElementById('seg-tl-wrap') || document.body;
  var wRect = wrap.getBoundingClientRect();

  var pop = document.createElement('div');
  pop.id = 'seg-tl-popover';
  pop.setAttribute('data-ev-id', evId);
  pop.className = 'seg-tl-popover';
  pop.innerHTML =
    '<div class="seg-tl-pop-title">' + segEscape(evYear) + ' · ' + segEscape(evLabel) + '</div>' +
    '<button class="seg-tl-pop-btn" ' +
      'data-ev-id="' + segEscape(evId) + '" ' +
      'data-ev-year="' + segEscape(evYear) + '" ' +
      'data-ev-label="' + segEscape(evLabel) + '" ' +
      'onclick="segTlEditarPuntoEl(this)">' +
      '<i class="fas fa-pencil"></i> Editar' +
    '</button>' +
    '<button class="seg-tl-pop-btn danger" ' +
      'data-ev-id="' + segEscape(evId) + '" ' +
      'data-ev-label="' + segEscape(evLabel) + '" ' +
      'onclick="segTlEliminarPuntoEl(this)">' +
      '<i class="fas fa-trash"></i> Eliminar' +
    '</button>';

  // Position below the dot
  pop.style.left = (rect.left - wRect.left + rect.width / 2 - 70) + 'px';
  pop.style.top  = (rect.bottom - wRect.top + 6) + 'px';
  wrap.style.position = 'relative';
  wrap.appendChild(pop);

  // Close on click outside
  setTimeout(function() {
    document.addEventListener('click', function _close() {
      var p = document.getElementById('seg-tl-popover');
      if (p) p.remove();
      document.removeEventListener('click', _close);
    });
  }, 10);
}

function segTlEditarPuntoEl(btn) {
  segTlEditarPunto(
    btn.getAttribute('data-ev-id'),
    btn.getAttribute('data-ev-year'),
    btn.getAttribute('data-ev-label')
  );
}

function segTlEliminarPuntoEl(btn) {
  segTlEliminarPunto(
    btn.getAttribute('data-ev-id'),
    btn.getAttribute('data-ev-label')
  );
}

/* ─────────────────────────────────────────
   PICKERS DEL MODAL TIMELINE
───────────────────────────────────────── */
var _segTlCal = { anio: null, mes: null, fechaSel: '' };
var _segTlTp  = { hora: null, min: null };

function segTlToggleDatePicker() {
  var dp = document.getElementById('seg-tl-datepicker');
  if (!dp) return;
  if (dp.classList.contains('seg-hidden')) {
    var hoy = new Date();
    if (!_segTlCal.anio) { _segTlCal.anio = hoy.getFullYear(); _segTlCal.mes = hoy.getMonth(); }
    segTlRenderizarCalendario();
    dp.classList.remove('seg-hidden');
    // Posicionar con fixed para escapar el stacking context del modal
    var btn = document.getElementById('seg-tl-fecha-btn');
    if (btn) {
      var r = btn.getBoundingClientRect();
      dp.style.position = 'fixed';
      dp.style.top  = (r.bottom + 4) + 'px';
      dp.style.left = r.left + 'px';
      dp.style.zIndex = '1000';
    }
    var tp = document.getElementById('seg-tl-timepicker');
    if (tp) tp.classList.add('seg-hidden');
  } else {
    dp.classList.add('seg-hidden');
  }
}

function segTlCalNavMes(delta) {
  _segTlCal.mes += delta;
  if (_segTlCal.mes < 0)  { _segTlCal.mes = 11; _segTlCal.anio--; }
  if (_segTlCal.mes > 11) { _segTlCal.mes = 0;  _segTlCal.anio++; }
  segTlRenderizarCalendario();
}

function segTlRenderizarCalendario() {
  var tituloEl = document.getElementById('seg-tl-cal-titulo');
  var diasEl   = document.getElementById('seg-tl-cal-dias');
  if (!tituloEl || !diasEl) return;
  var _M = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  var anio = _segTlCal.anio, mes = _segTlCal.mes;
  tituloEl.textContent = _M[mes] + ' ' + anio;
  var primerDia = new Date(anio, mes, 1).getDay();
  var offset    = (primerDia === 0) ? 6 : primerDia - 1;
  var diasEnMes = new Date(anio, mes + 1, 0).getDate();
  var html = '';
  for (var i = 0; i < offset; i++) html += '<div></div>';
  for (var d = 1; d <= diasEnMes; d++) {
    var fStr = anio + '-' + String(mes+1).padStart(2,'0') + '-' + String(d).padStart(2,'0');
    var cls = 'cal-day' + (fStr === _segTlCal.fechaSel ? ' cal-day--selected' : '');
    html += '<div class="' + cls + '" onclick="segTlSeleccionarFecha(\'' + fStr + '\')">' +
      '<span class="cal-day-num">' + d + '</span></div>';
  }
  diasEl.innerHTML = html;
}

function segTlSeleccionarFecha(fechaStr) {
  _segTlCal.fechaSel = fechaStr;
  var disp = document.getElementById('seg-tl-fecha-display');
  if (disp) {
    var d = new Date(fechaStr + 'T12:00:00');
    var M = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
    disp.textContent = d.getDate() + ' ' + M[d.getMonth()] + ' ' + d.getFullYear();
  }
  var dp = document.getElementById('seg-tl-datepicker');
  if (dp) dp.classList.add('seg-hidden');
}

function segTlToggleTimePicker() {
  var tp = document.getElementById('seg-tl-timepicker');
  if (!tp) return;
  if (tp.classList.contains('seg-hidden')) {
    segTlRenderizarTimePicker();
    tp.classList.remove('seg-hidden');
    // Posicionar con fixed para escapar el stacking context del modal
    var btn = document.getElementById('seg-tl-hora-btn');
    if (btn) {
      var r = btn.getBoundingClientRect();
      tp.style.position = 'fixed';
      tp.style.top  = (r.bottom + 4) + 'px';
      tp.style.left = r.left + 'px';
      tp.style.zIndex = '1000';
    }
    var dp = document.getElementById('seg-tl-datepicker');
    if (dp) dp.classList.add('seg-hidden');
  } else {
    tp.classList.add('seg-hidden');
  }
}

function segTlRenderizarTimePicker() {
  var horasEl = document.getElementById('seg-tl-tp-horas');
  var minsEl  = document.getElementById('seg-tl-tp-minutos');
  if (!horasEl || !minsEl) return;
  var curH = _segTlTp.hora !== null ? _segTlTp.hora : new Date().getHours();
  var curM = _segTlTp.min  !== null ? _segTlTp.min  : 0;
  var htmlH = '', htmlM = '';
  for (var h = 0; h <= 23; h++) {
    htmlH += '<div class="seg-tp-item' + (h === curH ? ' active' : '') + '" onclick="segTlSelHora(' + h + ')">' +
      String(h).padStart(2,'0') + '</div>';
  }
  for (var m = 0; m < 60; m += 5) {
    htmlM += '<div class="seg-tp-item' + (m === curM ? ' active' : '') + '" onclick="segTlSelMin(' + m + ')">' +
      String(m).padStart(2,'0') + '</div>';
  }
  horasEl.innerHTML = htmlH;
  minsEl.innerHTML  = htmlM;
  setTimeout(function() {
    var hA = horasEl.querySelector('.active');
    var mA = minsEl.querySelector('.active');
    if (hA) hA.scrollIntoView({ block: 'nearest' });
    if (mA) mA.scrollIntoView({ block: 'nearest' });
  }, 30);
}

function segTlSelHora(h) {
  _segTlTp.hora = h;
  document.querySelectorAll('#seg-tl-tp-horas .seg-tp-item').forEach(function(el, i) {
    el.classList.toggle('active', i === h);
  });
  segTlActualizarHoraDisplay();
}

function segTlSelMin(m) {
  _segTlTp.min = m;
  document.querySelectorAll('#seg-tl-tp-minutos .seg-tp-item').forEach(function(el, i) {
    el.classList.toggle('active', i * 5 === m);
  });
  segTlActualizarHoraDisplay();
  setTimeout(function() {
    var tp = document.getElementById('seg-tl-timepicker');
    if (tp) tp.classList.add('seg-hidden');
  }, 150);
}

function segTlActualizarHoraDisplay() {
  var h = _segTlTp.hora !== null ? _segTlTp.hora : 0;
  var m = _segTlTp.min  !== null ? _segTlTp.min  : 0;
  var horaStr = String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0');
  var disp = document.getElementById('seg-tl-hora-display');
  if (disp) disp.textContent = horaStr;
}

function segTlToggleHora(btn) {
  btn.classList.toggle('activo');
  segRenderizarTimelineActual();
}

function segTlEditarPunto(evId, evYear, evLabel) {
  var pop = document.getElementById('seg-tl-popover');
  if (pop) pop.remove();

  var dot    = document.querySelector('[data-ev-id="' + evId + '"]');
  var evMes  = dot ? (dot.getAttribute('data-ev-mes')  || '') : '';
  var evDia  = dot ? (dot.getAttribute('data-ev-dia')  || '') : '';
  var evHora = dot ? (dot.getAttribute('data-ev-hora') || '') : '';

  var fechaISO = '';
  if (evYear) {
    var yy = String(evYear).padStart(4,'0');
    var mm = evMes ? String(evMes).padStart(2,'0') : '01';
    var dd = evDia ? String(evDia).padStart(2,'0') : '01';
    fechaISO = yy + '-' + mm + '-' + dd;
  }

  var overlay = document.createElement('div');
  overlay.id = 'seg-tl-edit-modal';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.35);z-index:900;display:flex;align-items:center;justify-content:center;';
  overlay.innerHTML =
    '<div style="background:#fff;border-radius:12px;width:340px;">' +
      '<div style="padding:12px 16px;border-bottom:.5px solid #e5e7eb;display:flex;align-items:center;justify-content:space-between;">' +
        '<span style="font-size:13px;font-weight:600;color:#374151">Editar evento</span>' +
        '<button data-close-tl-modal="1" style="border:none;background:none;font-size:18px;cursor:pointer;color:#9ca3af;line-height:1">×</button>' +
      '</div>' +
      '<div style="padding:14px 16px;display:flex;flex-direction:column;gap:12px;">' +
        '<div>' +
          '<label style="font-size:11px;color:#6b7280;display:block;margin-bottom:4px">Descripción</label>' +
          '<input id="seg-tl-edit-label" type="text" value="' + segEscape(evLabel) + '" style="width:100%;box-sizing:border-box;font-size:12px;padding:7px 10px;border:.5px solid #d1d5db;border-radius:8px;font-family:inherit">' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;position:relative">' +
          '<div>' +
            '<label style="font-size:11px;color:#6b7280;display:block;margin-bottom:4px">Fecha</label>' +
            '<div class="seg-picker-wrap" id="seg-tl-fecha-wrap">' +
              '<button class="seg-picker-btn" id="seg-tl-fecha-btn" onclick="segTlToggleDatePicker()" type="button" style="width:100%">' +
                '<i class="fas fa-calendar-alt" style="color:#9961FF;font-size:11px"></i>' +
                '<span id="seg-tl-fecha-display">' + (fechaISO ? fechaISO : '—') + '</span>' +
              '</button>' +
              '<div class="seg-datepicker seg-hidden" id="seg-tl-datepicker">' +
                '<div class="cal-nav">' +
                  '<button class="cal-nav-btn" onclick="segTlCalNavMes(-1)" type="button"><i class="fas fa-chevron-left"></i></button>' +
                  '<span class="cal-nav-title" id="seg-tl-cal-titulo"></span>' +
                  '<button class="cal-nav-btn" onclick="segTlCalNavMes(1)" type="button"><i class="fas fa-chevron-right"></i></button>' +
                '</div>' +
                '<div class="cal-grid" style="padding:4px 4px 2px">' +
                  '<div class="cal-day-header">Lun</div><div class="cal-day-header">Mar</div>' +
                  '<div class="cal-day-header">Mié</div><div class="cal-day-header">Jue</div>' +
                  '<div class="cal-day-header">Vie</div><div class="cal-day-header">Sáb</div>' +
                  '<div class="cal-day-header">Dom</div>' +
                '</div>' +
                '<div class="cal-grid cal-days-grid" id="seg-tl-cal-dias"></div>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div>' +
            '<label style="font-size:11px;color:#6b7280;display:block;margin-bottom:4px">Hora <span style=\"font-size:10px;color:#9ca3af\">(opcional)</span></label>' +
            '<div class="seg-picker-wrap" id="seg-tl-hora-wrap">' +
              '<button class="seg-picker-btn" id="seg-tl-hora-btn" onclick="segTlToggleTimePicker()" type="button" style="width:100%">' +
                '<i class="fas fa-clock" style="color:#9961FF;font-size:11px"></i>' +
                '<span id="seg-tl-hora-display">' + (evHora ? evHora.slice(0,5) : '—') + '</span>' +
              '</button>' +
              '<div class="seg-timepicker seg-hidden" id="seg-tl-timepicker">' +
                '<div class="seg-tp-title">HH : MM</div>' +
                '<div class="seg-tp-cols">' +
                  '<div class="seg-tp-col-wrap"><div class="seg-tp-col" id="seg-tl-tp-horas"></div></div>' +
                  '<div class="seg-tp-col-wrap"><div class="seg-tp-col" id="seg-tl-tp-minutos"></div></div>' +
                '</div>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div style="display:flex;justify-content:flex-end;gap:8px;padding-top:4px">' +
          '<button data-close-tl-modal="1" style="font-size:12px;padding:6px 14px;border-radius:20px;border:.5px solid #d1d5db;background:transparent;cursor:pointer;color:#6b7280">Cancelar</button>' +
          '<button data-save-tl-modal="1" style="font-size:12px;padding:6px 14px;border-radius:20px;border:none;background:#9961FF;color:#fff;cursor:pointer;font-weight:600">Guardar</button>' +
        '</div>' +
      '</div>' +
    '</div>';

  overlay.dataset.evId = evId;
  document.body.appendChild(overlay);

  // Inicializar estado de los pickers con valores actuales del evento
  _segTlCal = { anio: null, mes: null, fechaSel: fechaISO };
  if (fechaISO) {
    var fp = fechaISO.split('-');
    _segTlCal.anio = parseInt(fp[0]);
    _segTlCal.mes  = parseInt(fp[1]) - 1;
  } else {
    var _hn = new Date();
    _segTlCal.anio = _hn.getFullYear();
    _segTlCal.mes  = _hn.getMonth();
  }
  _segTlTp = { hora: null, min: null };
  if (evHora) {
    var hp = evHora.slice(0,5).split(':');
    _segTlTp.hora = parseInt(hp[0]);
    _segTlTp.min  = parseInt(hp[1]);
  }

  // Wire buttons via JS — avoid quote nesting in HTML strings
  overlay.querySelectorAll('[data-close-tl-modal]').forEach(function(btn) {
    btn.addEventListener('click', function() { overlay.remove(); });
  });
  var saveBtn = overlay.querySelector('[data-save-tl-modal]');
  if (saveBtn) saveBtn.addEventListener('click', function() { segTlGuardarEdicion(evId); });

  // Cerrar pickers TL al click fuera
  document.addEventListener('click', function _tlOutsideClick(e) {
    var fw = document.getElementById('seg-tl-fecha-wrap');
    var hw = document.getElementById('seg-tl-hora-wrap');
    var dp = document.getElementById('seg-tl-datepicker');
    var tp = document.getElementById('seg-tl-timepicker');
    if (dp && fw && !fw.contains(e.target)) dp.classList.add('seg-hidden');
    if (tp && hw && !hw.contains(e.target)) tp.classList.add('seg-hidden');
    if (!document.getElementById('seg-tl-edit-modal')) {
      document.removeEventListener('click', _tlOutsideClick);
    }
  });

  setTimeout(function() { var inp = document.getElementById('seg-tl-edit-label'); if (inp) inp.focus(); }, 80);
  overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });
}

function segTlGuardarEdicion(evId) {
  var label = (document.getElementById('seg-tl-edit-label') || {}).value || '';
  if (!label.trim()) { segToast('Escribe una descripción', 'warn'); return; }

  // Leer fecha del picker custom (ISO guardado en _segTlCal.fechaSel)
  var fecha = _segTlCal.fechaSel || '';
  // Leer hora del picker custom
  var horaStr = '';
  if (_segTlTp.hora !== null) {
    horaStr = String(_segTlTp.hora).padStart(2,'0') + ':' +
              String(_segTlTp.min !== null ? _segTlTp.min : 0).padStart(2,'0');
  }

  var payload = { company_id: SEG.companyId, label: label.trim(), titulo: label.trim() };
  if (fecha) {
    var parts = fecha.split('-');
    if (parts.length === 3) {
      payload.anio = parseInt(parts[0]);
      payload.mes  = parseInt(parts[1]);
      payload.dia  = parseInt(parts[2]);
    }
  }
  if (horaStr) payload.hora = horaStr;

  var overlay = document.getElementById('seg-tl-edit-modal');
  if (overlay) overlay.remove();

  segFetch('/api/seguimiento/timeline/' + evId,
    { method: 'PUT', body: JSON.stringify(payload) },
    function() {
      segToast('Evento actualizado', 'ok');
      segFetch('/api/seguimiento/clientes/' + SEG.clienteId + '/contexto?company_id=' + SEG.companyId, {},
        function(data) {
          if (data && data.timeline) {
            segRenderizarTimeline(data.timeline,
              data.labels && data.labels.timeline_titulo,
              data.labels && data.labels.timeline_inicio);
          }
        },
        function() {}
      );
    },
    function() { segToast('Error al actualizar', 'error'); }
  );
}

function segTlEliminarPunto(evId, evLabel) {
  var pop = document.getElementById('seg-tl-popover');
  if (pop) pop.remove();
  segConfirm('¿Eliminar el evento "' + evLabel + '"?', function() {
    segFetch('/api/seguimiento/timeline/' + evId + '?company_id=' + SEG.companyId,
      { method: 'DELETE' },
      function() {
        segToast('Evento eliminado', 'ok');
        segFetch('/api/seguimiento/clientes/' + SEG.clienteId + '/contexto?company_id=' + SEG.companyId, {},
          function(data) { if (data && data.ok) segRenderizarTimeline(data.timeline, data.labels && data.labels.timeline_titulo, data.labels && data.labels.timeline_inicio); },
          function() {}
        );
      },
      function() { segToast('Error al eliminar', 'error'); }
    );
  });
}