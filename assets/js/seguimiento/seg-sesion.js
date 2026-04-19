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
  // Resetear modo plantilla → siempre partir desde editor
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
  segLimpiarTodosChips();
  _segIntensidades = {};
  _segDiagMode = false;
  _segHipMode  = false;

  // Precargar chips acumulados de sesiones anteriores
  var acum = SEG.contexto && SEG.contexto.chips_acumulados;
  if (acum) {
    var _bak = SEG.hayUnsaved;
    SEG.hayUnsaved = false;
    (acum.sintoma     || []).forEach(function(c) { segAgregarChip('sintoma',     c); });
    (acum.diagnostico || []).forEach(function(c) { segAgregarChip('diagnostico', c); });
    (acum.hipotesis   || []).forEach(function(c) { segAgregarChip('hipotesis',   c); });
    SEG.hayUnsaved = _bak;
  }

  segSetFecha(fechaStr);
  segSetHora(horaStr);
  segRenderizarChipsEtiquetas();
  segRenderizarAdjuntos();
  segLimpiarResumen();

  var badgeEl = document.getElementById('seg-badge-estado');
  if (badgeEl) badgeEl.textContent = SEG.labels.status_active || 'En curso';

  segMostrarRegistroWrap();
  segSetTab('notas', document.getElementById('seg-tab-notas'));

  // Crear registro en BD inmediatamente y agregar tarjeta al historial
  var payload = {
    company_id: SEG.companyId,
    cliente_id: SEG.clienteId,
    fecha:      fechaStr,
    hora:       horaStr,
    estado:     'en_curso',
  };
  segFetch('/api/seguimiento/registros', { method: 'POST', body: JSON.stringify(payload) },
    function(data) {
      SEG.registroId = data._id || data.id;
      SEG.hayUnsaved = false;
      // Agregar tarjeta al historial inmediatamente
      segAgregarTarjetaHistorial({
        _id:          SEG.registroId,
        fecha:        fechaStr,
        hora:         horaStr,
        estado:       'en_curso',
        resumen_corto: SEG.labels.registro ? SEG.labels.registro + ' registrado.' : 'Sesión registrada.',
        etiquetas:    [],
        chips_sintoma:     [],
        chips_diagnostico: [],
        chips_trabajar:    [],
        intensidades:      {},
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

  var cardHtml =
    '<div class="seg-hist-card active" id="hist-' + segEscape(rid) + '">' +
      '<div class="seg-hist-card-top" onclick="segSeleccionarRegistro(\'' + segEscape(rid) + '\')">' +
        '<div class="seg-hist-date">' + segFormatFechaCorta(h.fecha) + '</div>' +
        '<button class="seg-hist-delete-btn" title="Eliminar sesión" ' +
          'onclick="event.stopPropagation();segMostrarConfirmEliminar(\'' + segEscape(rid) + '\')">' +
          '<i class="fas fa-trash"></i>' +
        '</button>' +
      '</div>' +
      '<div class="seg-hist-preview" onclick="segSeleccionarRegistro(\'' + segEscape(rid) + '\')">' +
        segEscape(h.resumen_corto || '') +
      '</div>' +
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