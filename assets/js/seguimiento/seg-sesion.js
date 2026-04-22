/* ═══════════════════════════════════════════════════════
   SEGUIMIENTO — seg-sesion.js
   segNuevaSesion, segNuevaSesionConfirm (con preload chips + POST inmediato), segAgregarTarjetaHistorial, segActualizarTarjetaHistorialChips.
═══════════════════════════════════════════════════════ */

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
  // Guardar plantilla activa y chips actuales ANTES de limpiar
  var plantillaActiva = _segPn ? _segPn.formActivo : null;
  var chipsBak = {
    sintoma:     (_segChips.sintoma     || []).slice(),
    diagnostico: (_segChips.diagnostico || []).slice(),
    hipotesis:   (_segChips.hipotesis   || []).slice(),
    trabajar:    (_segChips.trabajar    || []).slice()
  };

  // Resetear modo plantilla
  segPnResetearVista();

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

  // Limpiar chips del DOM pero restaurar desde estado actual (el más actualizado)
  segLimpiarTodosChips();
  _segDiagMode = false;
  _segHipMode  = false;

  // Heredar chips de la sesión anterior (usar estado actual, no acumulados del contexto)
  var _bak = SEG.hayUnsaved;
  SEG.hayUnsaved = false;
  chipsBak.sintoma.forEach(function(c)     { segAgregarChip('sintoma',     c); });
  chipsBak.diagnostico.forEach(function(c) { segAgregarChip('diagnostico', c); });
  chipsBak.hipotesis.forEach(function(c)   { segAgregarChip('hipotesis',   c); });
  chipsBak.trabajar.forEach(function(c)    { segAgregarChip('trabajar',    c); });
  SEG.hayUnsaved = _bak;

  // Actualizar derivaciones hero y panel
  if (typeof segDerActualizarHeroChips === 'function') segDerActualizarHeroChips();
  if (typeof segDerRenderizarChips     === 'function') segDerRenderizarChips();

  segSetFecha(fechaStr);
  segSetHora(horaStr);
  segRenderizarChipsEtiquetas();
  segRenderizarAdjuntos();
  segLimpiarResumen();

  // Hero status → En curso (con color violeta)
  if (typeof segSetHeroStatus === 'function') segSetHeroStatus('en_curso', SEG.labels);
  var badgeEl = document.getElementById('seg-badge-estado');
  if (badgeEl) badgeEl.textContent = SEG.labels.status_active || 'En curso';

  segMostrarRegistroWrap();
  segSetTab('notas', document.getElementById('seg-tab-notas'));

  // Re-abrir plantilla activa si había una
  if (plantillaActiva) {
    setTimeout(function() {
      if (typeof segPnFormAbrir === 'function') segPnFormAbrir(plantillaActiva);
    }, 100);
  }

  // Crear registro en BD inmediatamente y agregar tarjeta al historial
  var payload = {
    company_id:        SEG.companyId,
    cliente_id:        SEG.clienteId,
    fecha:             fechaStr,
    hora:              horaStr,
    estado:            'en_curso',
    chips_sintoma:     (_segChips.sintoma     || []).slice(),
    chips_diagnostico: (_segChips.diagnostico || []).slice(),
    chips_hipotesis:   (_segChips.hipotesis   || []).slice(),
    chips_trabajar:    (_segChips.trabajar     || []).slice(),
    modo_notas:        plantillaActiva ? 'plantilla:' + plantillaActiva : 'editor',
  };
  segFetch('/api/seguimiento/registros', { method: 'POST', body: JSON.stringify(payload) },
    function(data) {
      SEG.registroId = data._id || data.id;
      SEG.hayUnsaved = false;

      // Copiar intensidades del registro anterior al nuevo
      // Así persisten en BD y se muestran al recargar el paciente
      if (_segIntensidades && SEG.registroId) {
        Object.keys(_segIntensidades).forEach(function(nombre) {
          var nivel = _segIntensidades[nombre];
          if (nivel && nivel > 0) {
            segFetch(
              '/api/seguimiento/registros/' + SEG.registroId + '/intensidades/' + encodeURIComponent(nombre),
              { method: 'PUT', body: JSON.stringify({ nivel: nivel, company_id: SEG.companyId, cliente_id: SEG.clienteId }) },
              function() {}, function() {}
            );
          }
        });
      }

      // Agregar tarjeta al historial con chips e intensidades heredados
      segAgregarTarjetaHistorial({
        _id:          SEG.registroId,
        fecha:        fechaStr,
        hora:         horaStr,
        estado:       'en_curso',
        resumen_corto: SEG.labels.registro ? SEG.labels.registro + ' registrado.' : 'Sesión registrada.',
        etiquetas:    [],
        chips_sintoma:     (_segChips.sintoma     || []).slice(),
        chips_diagnostico: (_segChips.diagnostico || []).slice(),
        chips_trabajar:    (_segChips.trabajar     || []).slice(),
        intensidades:      Object.assign({}, _segIntensidades || {}),
      });
    },
    function() {}
  );

  segToast('Nueva ' + (SEG.labels.registro || 'sesión') + ' lista para registrar', 'success');
}

function segAgregarTarjetaHistorial(h) {
  var el = document.getElementById('seg-historial-list');
  if (!el) return;
  var lb  = SEG.labels || {};
  var rid = h._id || h.id || '';

  // Construir secciones de chips para la tarjeta del historial
  var MAX_LEN = 18;
  var sintomas = [].concat(h.chips_sintoma || [], h.chips_diagnostico || []);
  var trabajar = h.chips_trabajar || [];
  var intens   = h.intensidades || {};
  var colors   = typeof SEG_INTENS_COLORS !== 'undefined' ? SEG_INTENS_COLORS : {};
  var texts    = typeof SEG_INTENS_TEXT   !== 'undefined' ? SEG_INTENS_TEXT   : {};

  var sintChips = sintomas.map(function(n) {
    var t = n.length > MAX_LEN ? n.slice(0, MAX_LEN) + '...' : n;
    var tip = n.length > MAX_LEN ? ' data-seg-tooltip="' + segEscape(n) + '"' : '';
    return '<span class="seg-hist-chip" style="background:#ede9fe;color:#5b21b6;border:0.5px solid #c4b5fd"' + tip + '>' + segEscape(t) + '</span>';
  }).join('');

  var trabChipsHtml = trabajar.map(function(n) {
    var esDiag = (h.chips_diagnostico || []).indexOf(n) !== -1;
    var esSint = (h.chips_sintoma || []).indexOf(n) !== -1;
    var nivel  = (esDiag || esSint) ? (intens[n] || 0) : null;
    var t = n.length > MAX_LEN ? n.slice(0, MAX_LEN) + '...' : n;
    var tip = n.length > MAX_LEN ? ' data-seg-tooltip="' + segEscape(n) + '"' : '';
    var badge = '';
    if (nivel !== null) {
      var bg  = (nivel && colors[nivel]) ? colors[nivel] : '#e5e7eb';
      var txt = (nivel && texts[nivel])  ? texts[nivel]  : '#9ca3af';
      badge = '<span class="seg-hist-intens-badge" style="background:' + bg + ';color:' + txt + '">' + (nivel || '·') + '</span>';
    }
    return '<span class="seg-hist-chip seg-hist-chip-trabajar"' + tip + '>' + segEscape(t) + badge + '</span>';
  }).join('');

  var secSint = sintChips
    ? '<div class="seg-hist-chips-sec"><span class="seg-hist-chips-label">Síntomas</span><div class="seg-hist-chips-row">' + sintChips + '</div></div>'
    : '';
  var secTrab = trabChipsHtml
    ? '<div class="seg-hist-chips-sec"><span class="seg-hist-chips-label">Lo que se abordó</span><div class="seg-hist-chips-row">' + trabChipsHtml + '</div></div>'
    : '';
  var chipsWrap = (secSint || secTrab)
    ? '<div class="seg-hist-chips-wrap" onclick="segSeleccionarRegistro(\'' + segEscape(rid) + '\')">' + secSint + secTrab + '</div>'
    : '';

  var cardHtml =
    '<div class="seg-hist-card active" id="hist-' + segEscape(rid) + '">' +
      '<div class="seg-hist-card-top" onclick="segSeleccionarRegistro(\'' + segEscape(rid) + '\')">' +
        '<div class="seg-hist-date">' + segFormatFechaCorta(h.fecha) + (h.hora ? '<span class="seg-hist-hora">' + h.hora + '</span>' : '') + '</div>' +
        '<button class="seg-hist-delete-btn" data-seg-tooltip="Eliminar sesión" ' +
          'onclick="event.stopPropagation();segMostrarConfirmEliminar(\'' + segEscape(rid) + '\')">' +
          '<i class="fas fa-trash"></i>' +
        '</button>' +
      '</div>' +
      '<div class="seg-hist-preview" onclick="segSeleccionarRegistro(\'' + segEscape(rid) + '\')">' +
        segEscape(h.resumen_corto || '') +
      '</div>' +
      chipsWrap +
      '<span class="seg-hist-badge nueva" onclick="segSeleccionarRegistro(\'' + segEscape(rid) + '\')">' +
        (lb.status_active || 'En curso') +
      '</span>' +
      '<div class="seg-hist-confirm seg-hidden" id="confirm-' + segEscape(rid) + '">' +
        '<div class="seg-hist-confirm-msg">' +
          '<i class="fas fa-exclamation-triangle"></i>' +
          '¿Eliminar esta ' + segEscape(lb.registro||'sesión') + '? Se borrará permanentemente.' +
        '</div>' +
        '<div class="seg-hist-confirm-btns">' +
          '<button class="seg-hist-confirm-cancel" onclick="segCancelarConfirmEliminar(\'' + segEscape(rid) + '\')">Cancelar</button>' +
          '<button class="seg-hist-confirm-ok" onclick="segConfirmarEliminar(\'' + segEscape(rid) + '\')">Eliminar</button>' +
        '</div>' +
      '</div>' +
    '</div>';

  // Quitar active de tarjetas anteriores
  el.querySelectorAll('.seg-hist-card.active').forEach(function(c) { c.classList.remove('active'); });
  // Insertar al inicio
  el.insertAdjacentHTML('afterbegin', cardHtml);
}

function segActualizarTarjetaHistorialChips() {
  if (!SEG.registroId) return;
  var card = document.getElementById('hist-' + SEG.registroId);
  if (!card) return;

  // Construir chips de "Lo que se abordó"
  var trabChips = (_segChips.trabajar || []).map(function(n) {
    var esDiag  = _segChips.diagnostico.indexOf(n) !== -1;
    var esSint  = _segChips.sintoma.indexOf(n) !== -1;
    var conIntens = esDiag || esSint;
    var nivel   = conIntens ? (_segIntensidades[n] || 0) : null;
    var truncado = n.length > 18 ? n.slice(0, 18) + '...' : n;
    var tooltip  = n.length > 18 ? ' data-seg-tooltip="' + segEscape(n) + '"' : '';
    var badge = '';
    if (nivel !== null) {
      var badgeColor = (nivel && SEG_INTENS_COLORS && SEG_INTENS_COLORS[nivel]) ? SEG_INTENS_COLORS[nivel] : '#e5e7eb';
      var badgeTxt   = (nivel && SEG_INTENS_TEXT  && SEG_INTENS_TEXT[nivel])   ? SEG_INTENS_TEXT[nivel]   : '#9ca3af';
      badge = '<span class="seg-hist-intens-badge" style="background:' + badgeColor + ';color:' + badgeTxt + '">' + (nivel || '·') + '</span>';
    }
    return '<span class="seg-hist-chip seg-hist-chip-trabajar"' + tooltip + '>' + segEscape(truncado) + badge + '</span>';
  }).join('');

  // Buscar o crear la sección "Lo que se abordó" en la tarjeta
  var wrap = card.querySelector('.seg-hist-chips-wrap');
  if (trabChips) {
    var secTrab = '<div class="seg-hist-chips-sec">' +
      '<span class="seg-hist-chips-label">Lo que se abordó</span>' +
      '<div class="seg-hist-chips-row">' + trabChips + '</div>' +
    '</div>';
    if (wrap) {
      // Actualizar solo la sección trabajar
      var secExist = wrap.querySelector('.seg-hist-chips-sec:last-child');
      if (secExist && secExist.querySelector('.seg-hist-chips-label') &&
          secExist.querySelector('.seg-hist-chips-label').textContent === 'Lo que se abordó') {
        secExist.outerHTML = secTrab;
      } else {
        wrap.insertAdjacentHTML('beforeend', secTrab);
      }
    } else {
      // Crear wrap antes del badge de estado
      var badge = card.querySelector('.seg-hist-badge');
      if (badge) {
        var newWrap = document.createElement('div');
        newWrap.className = 'seg-hist-chips-wrap';
        newWrap.innerHTML = secTrab;
        card.insertBefore(newWrap, badge);
      }
    }
  } else if (wrap) {
    // Sin chips — quitar sección si estaba vacía
    var secTrabVacia = wrap.querySelector('.seg-hist-chips-sec:last-child');
    if (secTrabVacia && secTrabVacia.querySelector('.seg-hist-chips-label') &&
        secTrabVacia.querySelector('.seg-hist-chips-label').textContent === 'Lo que se abordó') {
      if (wrap.children.length === 1) {
        wrap.remove();
      } else {
        secTrabVacia.remove();
      }
    }
  }
}