/* ═══════════════════════════════════════════════════════
   SEGUIMIENTO — seg-derivaciones.js
   Panel de derivaciones/asignaciones de profesionales.
   Multi-rubro: salud, fitness, educación, cowork, etc.
═══════════════════════════════════════════════════════ */

var _segDer = {
  visible:      false,
  chipActivo:   null,          // nombre del chip seleccionado
  derivaciones: {},            // { chip_nombre: [{ ...doc }] }
  panelChips:   [],            // chips arrastrados al panel (persisten en BD)
  profesionales: [],           // lista internos de la empresa
  colorChip:    null,          // color badge del chip activo
  modalProf:    null,          // profesional activo en modal historial
  dragOver:     false,         // estado drag & drop
};

// Datos dummy de asignaciones (terapeuta + servicio por chip).
// TODO: reemplazar con datos reales de agenda cuando esté disponible.
var _segDerAsignaciones = {};  // { chip_nombre: { profesional, servicio } }

/* ─────────────────────────────────────────
   INIT — carga al seleccionar cliente
───────────────────────────────────────── */
function segDerInit() {
  _segDer.visible       = false;
  _segDer.chipActivo    = null;
  _segDer.derivaciones  = {};
  _segDer.panelChips    = [];
  _segDer.profesionales = [];
  _segDer.colorChip     = null;
  _segDerAsignaciones   = {};

  var content = document.getElementById('seg-der-content');
  var chev    = document.getElementById('seg-der-chev');
  var detail  = document.getElementById('seg-der-detail');
  if (content) content.classList.add('seg-hidden');
  if (chev)    chev.style.transform = 'rotate(0deg)';
  if (detail)  detail.classList.add('seg-hidden');

  segDerCargar();
  segDerCargarProfesionales();
}

/* ─────────────────────────────────────────
   TOGGLE panel
───────────────────────────────────────── */
function segToggleDer() {
  _segDer.visible = !_segDer.visible;
  var content = document.getElementById('seg-der-content');
  var chev    = document.getElementById('seg-der-chev');
  if (content) content.classList.toggle('seg-hidden', !_segDer.visible);
  if (chev)    chev.style.transform = _segDer.visible ? 'rotate(90deg)' : 'rotate(0deg)';
}

/* ─────────────────────────────────────────
   CARGAR derivaciones del cliente
───────────────────────────────────────── */
function segDerCargar() {
  if (!SEG.clienteId) return;
  var panelLoaded = false;
  var derLoaded   = false;

  function _done() {
    if (!panelLoaded || !derLoaded) return;
    segDerRenderizarChips();
    segDerActualizarSub();
    segDerActualizarHeroChips();
  }

  // Cargar chips del panel
  segFetch(
    '/api/seguimiento/clientes/' + SEG.clienteId + '/derivaciones/panel?company_id=' + SEG.companyId,
    {},
    function(data) {
      _segDer.panelChips = ((data && data.chips) || []).map(function(c) { return c.chip_nombre; });
      panelLoaded = true; _done();
    },
    function() { panelLoaded = true; _done(); }
  );

  // Cargar derivaciones agrupadas
  segFetch(
    '/api/seguimiento/clientes/' + SEG.clienteId + '/derivaciones?company_id=' + SEG.companyId,
    {},
    function(data) {
      _segDer.derivaciones = (data && data.derivaciones) || {};
      derLoaded = true; _done();
    },
    function() { derLoaded = true; _done(); }
  );
}

/* ─────────────────────────────────────────
   CARGAR profesionales internos
───────────────────────────────────────── */
function segDerCargarProfesionales() {
  segFetch(
    '/api/seguimiento/profesionales?company_id=' + SEG.companyId,
    {},
    function(data) {
      _segDer.profesionales = (data && data.profesionales) || [];
      segDerRenderizarAreas();
    },
    function() {}
  );
}

/* ─────────────────────────────────────────
   RENDER chips con nombres de profesionales
───────────────────────────────────────── */
function segDerRenderizarChips() {
  var el = document.getElementById('seg-der-chips');
  if (!el) return;

  var panelNames = _segDer.panelChips || [];

  var dropEmptyHtml = !panelNames.length
    ? '<div class="seg-der-drop-empty">' +
        '<i class="fas fa-code-branch"></i>' +
        '<span>Arrastra un problema desde el encabezado del cliente</span>' +
      '</div>'
    : '';

  var chipsHtml = panelNames.map(function(nombre) {
    var intens  = (_segIntensidades && _segIntensidades[nombre]) || 0;
    var bgColor = (intens > 0 && typeof SEG_INTENS_COLORS !== 'undefined')
      ? SEG_INTENS_COLORS[intens] : '#e5e7eb';
    var txColor = (intens > 0 && typeof SEG_INTENS_TEXT !== 'undefined')
      ? SEG_INTENS_TEXT[intens] : '#6b7280';
    var ders   = _segDer.derivaciones[nombre] || [];
    var activo = _segDer.chipActivo === nombre ? ' activo' : '';

    var profsTxt = ders.length
      ? ders.map(function(d) {
          var n = d.profesional_nombre || '';
          var parts = n.split(' ');
          var abrev = parts.length > 1 ? parts[0].charAt(0) + '. ' + parts.slice(1).join(' ') : n;
          return abrev + (d.tipo === 'externo' ? ' (ext)' : '');
        }).join(' · ')
      : 'sin profesional asignado';

    return '<div class="seg-der-chip' + activo + '" ' +
      'data-nombre="' + segEscape(nombre) + '" ' +
      'onclick="segDerSeleccionarChipEl(this)">' +
      '<div class="seg-der-chip-top">' +
        '<span class="seg-der-chip-nombre">' + segEscape(nombre) + '</span>' +
        (intens
          ? '<span class="seg-der-chip-badge" style="background:' + bgColor + ';color:' + txColor + '">' + intens + '</span>'
          : '<span class="seg-der-chip-badge" style="background:#e5e7eb;color:#9ca3af">·</span>') +
        '<span class="seg-der-chip-quitar" ' +
          'onclick="event.stopPropagation();segDerQuitarDelPanelDirect(this)" ' +
          'data-nombre="' + segEscape(nombre) + '">' +
          '<i class="fas fa-times"></i>' +
        '</span>' +
      '</div>' +
      '<div class="seg-der-chip-profs">' + segEscape(profsTxt) + '</div>' +
    '</div>';
  }).join('');

  var addBtn = panelNames.length
    ? '<div class="seg-der-add-chip-btn" ' +
        'ondragover="segDerDragOver(event)" ondragleave="segDerDragLeave(event)" ondrop="segDerDrop(event)">' +
        '<i class="fas fa-plus"></i> Añadir problema' +
      '</div>'
    : '';

  el.innerHTML = '<div class="seg-der-drop-zone' + (!panelNames.length ? '' : ' seg-der-drop-zone-has-chips') + '" ' +
    'id="seg-der-drop-zone" ' +
    'ondragover="segDerDragOver(event)" ondragleave="segDerDragLeave(event)" ondrop="segDerDrop(event)">' +
    dropEmptyHtml + chipsHtml + addBtn +
    '</div>';
}

function segDerSeleccionarChipEl(el) {
  var nombre = el.getAttribute('data-nombre');
  if (!nombre) return;

  var detail = document.getElementById('seg-der-detail');

  // Toggle: si ya está activo y el detalle está abierto → cerrar
  if (_segDer.chipActivo === nombre && detail && !detail.classList.contains('seg-hidden')) {
    _segDer.chipActivo = null;
    detail.classList.add('seg-hidden');
    // Quitar activo visual
    document.querySelectorAll('.seg-der-chip').forEach(function(c) { c.classList.remove('activo'); });
    return;
  }

  var intens  = (_segIntensidades && _segIntensidades[nombre]) || 0;
  var bgColor = (intens > 0 && typeof SEG_INTENS_COLORS !== 'undefined')
    ? SEG_INTENS_COLORS[intens] : '#9ca3af';
  segDerSeleccionarChip(nombre, bgColor);
}

function segDerQuitarDelPanelDirect(btn) {
  var nombre = btn.getAttribute('data-nombre');
  if (!nombre || !SEG.clienteId) return;
  segFetch(
    '/api/seguimiento/clientes/' + SEG.clienteId + '/derivaciones/panel',
    { method: 'DELETE', body: JSON.stringify({ company_id: SEG.companyId, chip_nombre: nombre }) },
    function() {
      _segDer.panelChips = _segDer.panelChips.filter(function(n) { return n !== nombre; });
      if (_segDer.chipActivo === nombre) {
        _segDer.chipActivo = null;
        var detail = document.getElementById('seg-der-detail');
        if (detail) detail.classList.add('seg-hidden');
      }
      segDerRenderizarChips();
      segDerActualizarSub();
      segToast('Problema quitado del panel', 'ok');
    },
    function() { segToast('Error al quitar', 'error'); }
  );
}


/* ─────────────────────────────────────────
   DRAG & DROP desde hero chips
───────────────────────────────────────── */
var _segDerDragNombre = null; // chip siendo arrastrado

function segDerChipDragStart(event, nombre) {
  _segDerDragNombre = nombre;
  event.dataTransfer.setData('text/plain', nombre);
  event.dataTransfer.effectAllowed = 'copy';
}

function segDerChipDragEnd(event) {
  _segDerDragNombre = null;
}

function segDerDragOver(event) {
  event.preventDefault();
  event.dataTransfer.dropEffect = 'copy';
  var zone = document.getElementById('seg-der-drop-zone');
  if (zone) zone.classList.add('drag-over');
}

function segDerDragLeave(event) {
  // Only remove if truly leaving the zone (not entering a child)
  var zone = document.getElementById('seg-der-drop-zone');
  if (zone && !zone.contains(event.relatedTarget)) {
    zone.classList.remove('drag-over');
  }
}

function segDerDrop(event) {
  event.preventDefault();
  var zone = document.getElementById('seg-der-drop-zone');
  if (zone) zone.classList.remove('drag-over');
  var nombre = event.dataTransfer.getData('text/plain') || _segDerDragNombre;
  _segDerDragNombre = null;
  _segDerAgregarAlPanel(nombre);
}

// Bar drag handlers — para cuando el panel está colapsado
function segDerBarDragOver(event) {
  event.preventDefault();
  event.dataTransfer.dropEffect = 'copy';
  event.currentTarget.style.background = '#f5f3ff';
}

function segDerBarDragLeave(event) {
  event.currentTarget.style.background = '';
}

function segDerBarDrop(event) {
  event.preventDefault();
  event.currentTarget.style.background = '';
  var nombre = event.dataTransfer.getData('text/plain') || _segDerDragNombre;
  _segDerDragNombre = null;
  if (!_segDer.visible) segToggleDer();
  setTimeout(function() { _segDerAgregarAlPanel(nombre); }, 80);
}

function _segDerAgregarAlPanel(nombre) {
  if (!nombre || !nombre.trim() || !SEG.clienteId) return;
  nombre = nombre.trim();
  if (_segDer.panelChips.indexOf(nombre) !== -1) {
    segToast('Este problema ya está en derivaciones', 'warn'); return;
  }
  segFetch(
    '/api/seguimiento/clientes/' + SEG.clienteId + '/derivaciones/panel',
    { method: 'POST', body: JSON.stringify({ company_id: SEG.companyId, chip_nombre: nombre }) },
    function(data) {
      _segDer.panelChips.push(nombre);
      segDerRenderizarChips();
      segDerActualizarSub();
      var intens = (_segIntensidades && _segIntensidades[nombre]) || 0;
      segDerSeleccionarChip(nombre, _segDerColorIntensidad(intens));
      segToast('Problema agregado a derivaciones', 'ok');
    },
    function() { segToast('Error al agregar al panel', 'error'); }
  );
}

function segDerQuitarDelPanel(nombre) {
  segConfirm(
    '¿Quitar "' + nombre + '" del panel de derivaciones? Las asignaciones de profesionales se conservan.',
    function() {
      segFetch(
        '/api/seguimiento/clientes/' + SEG.clienteId + '/derivaciones/panel',
        { method: 'DELETE', body: JSON.stringify({ company_id: SEG.companyId, chip_nombre: nombre }) },
        function() {
          _segDer.panelChips = _segDer.panelChips.filter(function(n) { return n !== nombre; });
          if (_segDer.chipActivo === nombre) {
            _segDer.chipActivo = null;
            var detail = document.getElementById('seg-der-detail');
            if (detail) detail.classList.add('seg-hidden');
          }
          segDerRenderizarChips();
          segDerActualizarSub();
          segToast('Problema quitado del panel', 'ok');
        },
        function() { segToast('Error al quitar', 'error'); }
      );
    }
  );
}

/* ─────────────────────────────────────────
   HERO CHIPS — agregar terapeuta + servicio (dummy)
   TODO: conectar con datos reales de agenda
───────────────────────────────────────── */
function segDerActualizarHeroChips() {
  // Poblar datos dummy con profesionales de la empresa
  // Se usa el primer profesional disponible como responsable por chip
  var nombres = _segChips ? _segChips.trabajar || [] : [];
  nombres.forEach(function(nombre, i) {
    if (!_segDerAsignaciones[nombre]) {
      var prof  = _segDer.profesionales[i % Math.max(_segDer.profesionales.length, 1)];
      _segDerAsignaciones[nombre] = {
        profesional: prof ? prof.nombre : 'Sin asignar',
        servicio:    prof ? (prof.area || 'General') : '—',
      };
    }
  });
  // Re-renderizar hero chips con datos de terapeuta + servicio
  segActualizarHeroChipsTrabajar();
}

/* ─────────────────────────────────────────
   DUMMY DATA — para visualización en desarrollo
   TODO: eliminar cuando el backend retorne datos reales
───────────────────────────────────────── */
function _segDerInyectarDummyDerivaciones() {
  // Solo inyectar si el chip está en el panel y no tiene derivaciones reales
  _segDer.panelChips.forEach(function(nombre) {
    if (_segDer.derivaciones[nombre] && _segDer.derivaciones[nombre].length) return;
    _segDer.derivaciones[nombre] = [
      {
        _id: 'dummy-' + nombre + '-1',
        tipo: 'interno',
        profesional_id: 'usr1',
        profesional_nombre: 'Dra. María García',
        area_nombre: 'Psicología clínica',
        lugar_nombre: '',
        es_responsable: true,
        fecha_derivacion: new Date().toISOString(),
      },
      {
        _id: 'dummy-' + nombre + '-2',
        tipo: 'externo',
        profesional_id: null,
        profesional_nombre: 'Dr. Roberto López',
        area_nombre: 'Psiquiatría',
        lugar_nombre: 'Clínica Las Condes',
        es_responsable: false,
        fecha_derivacion: new Date(Date.now() - 86400000 * 3).toISOString(),
      }
    ];
  });
}

function _segDerColorIntensidad(n) {
  if (!n || n <= 0) return '#9ca3af';
  if (n <= 3) return '#059669';
  if (n <= 6) return '#d97706';
  return '#dc2626';
}

/* ─────────────────────────────────────────
   SELECCIONAR chip → mostrar detalle
───────────────────────────────────────── */
function segDerCerrarModal() {
  var overlay = document.getElementById('seg-der-modal-overlay');
  if (overlay) overlay.classList.add('seg-hidden');
  _segDer.modalProf = null;
  _segDer._historialTexto = '';
}

function segDerCerrarResumen() {
  var overlay = document.getElementById('seg-der-resumen-overlay');
  if (overlay) overlay.classList.add('seg-hidden');
}

function segDerCerrarDetalle() {
  _segDer.chipActivo = null;
  var detail = document.getElementById('seg-der-detail');
  if (detail) detail.classList.add('seg-hidden');
  document.querySelectorAll('.seg-der-chip').forEach(function(c) { c.classList.remove('activo'); });
}

function segDerSeleccionarChip(nombre, color) {
  _segDer.chipActivo = nombre;
  _segDer.colorChip  = color;

  // Actualizar chips activo visual
  document.querySelectorAll('.seg-der-chip').forEach(function(el) {
    var n = el.getAttribute('data-nombre');
    el.classList.toggle('activo', n === nombre);
  });

  // Header detalle
  var dot   = document.getElementById('seg-der-detail-dot');
  var title = document.getElementById('seg-der-detail-nombre');
  if (dot)   dot.style.color = color;
  if (title) title.textContent = nombre;

  // Mostrar panel detalle (estaba oculto)
  var detail = document.getElementById('seg-der-detail');
  if (detail) detail.classList.remove('seg-hidden');

  segDerRenderizarLista();
}

/* ─────────────────────────────────────────
   RENDER lista de profesionales del chip
───────────────────────────────────────── */
function segDerRenderizarLista() {
  var el = document.getElementById('seg-der-lista');
  if (!el || !_segDer.chipActivo) return;

  var ders = _segDer.derivaciones[_segDer.chipActivo] || [];
  if (!ders.length) {
    el.innerHTML = '<div class="seg-der-ses-empty">Sin profesionales asignados aún.</div>';
    return;
  }

  el.innerHTML = ders.map(function(d) {
    var iniciales = _segDerIniciales(d.profesional_nombre);
    var avatarBg  = d.tipo === 'externo' ? '#fef3c7' : (d.es_responsable ? '#ede9fe' : '#e1f5ee');
    var avatarClr = d.tipo === 'externo' ? '#92400e' : (d.es_responsable ? '#5b21b6' : '#0f6e56');

    var badges = '';
    if (d.es_responsable) badges += '<span class="seg-der-badge seg-der-badge-resp">responsable</span>';
    else badges += '<span class="seg-der-badge seg-der-badge-asignado">' +
      'asignado ' + _segDerFechaCorta(d.fecha_derivacion) + '</span>';
    if (d.tipo === 'externo') badges += '<span class="seg-der-badge seg-der-badge-externo">externo</span>';

    var histBtn = '<div class="seg-der-icon-btn hist" ' +
      'data-der-id="' + segEscape(d._id) + '" ' +
      'data-nombre="' + segEscape(d.profesional_nombre) + '" ' +
      'data-area="' + segEscape(d.area_nombre || '') + '" ' +
      'data-lugar="' + segEscape(d.lugar_nombre || '') + '" ' +
      'data-tipo="' + segEscape(d.tipo || 'interno') + '" ' +
      'data-responsable="' + (d.es_responsable ? '1' : '0') + '" ' +
      'onclick="segDerAbrirHistorialEl(this)" ' +
      'data-seg-tooltip="Ver historial de registros">' +
      '<i class="fas fa-clock-rotate-left"></i></div>';

    var delBtn = !d.es_responsable
      ? '<div class="seg-der-icon-btn del" ' +
        'onclick="segDerConfirmarQuitar(this,' + JSON.stringify(d._id) + ',' + JSON.stringify(d.profesional_nombre) + ')" ' +
        'data-seg-tooltip="Quitar derivación">' +
        '<i class="fas fa-trash"></i></div>'
      : '';

    var confirm = !d.es_responsable
      ? '<div class="seg-der-confirm" id="seg-der-confirm-' + d._id + '">' +
          '<div class="seg-der-confirm-msg"><i class="fas fa-exclamation-triangle"></i>' +
          '¿Quitar la derivación a <strong>' + segEscape(d.profesional_nombre) + '</strong>? ' +
          'Se eliminará el vínculo con este problema.</div>' +
          '<div class="seg-der-confirm-btns">' +
            '<button class="seg-der-confirm-cancel" onclick="segDerCancelarConfirm(' + JSON.stringify(d._id) + ')">Cancelar</button>' +
            '<button class="seg-der-confirm-ok" onclick="segDerEliminar(' + JSON.stringify(d._id) + ')">Quitar</button>' +
          '</div>' +
        '</div>'
      : '';

    return '<div class="seg-der-card">' +
      '<div class="seg-der-avatar" style="background:' + avatarBg + ';color:' + avatarClr + '">' + iniciales + '</div>' +
      '<div class="seg-der-card-info">' +
        '<div class="seg-der-card-nombre">' + segEscape(d.profesional_nombre) + '</div>' +
        '<div class="seg-der-card-area">' + segEscape(d.area_nombre || '') +
          (d.lugar_nombre ? ' · ' + segEscape(d.lugar_nombre) : '') + '</div>' +
        '<div class="seg-der-card-badges">' + badges + '</div>' +
      '</div>' +
      '<div class="seg-der-card-actions">' + histBtn + delBtn + '</div>' +
      confirm +
    '</div>';
  }).join('');

  // Tooltip
  if (typeof _segAgendaTooltipInit === 'function') _segAgendaTooltipInit();
}

/* ─────────────────────────────────────────
   ÁREAS para selector interno
───────────────────────────────────────── */
function segDerRenderizarAreas() {
  var sel = document.getElementById('seg-der-sel-area');
  if (!sel) return;
  // Recoger todas las áreas únicas de todos los profesionales
  var areas = [];
  _segDer.profesionales.forEach(function(p) {
    var profAreas = p.areas && p.areas.length ? p.areas : (p.area ? [p.area] : []);
    profAreas.forEach(function(a) {
      if (a && areas.indexOf(a) === -1) areas.push(a);
    });
  });
  areas.sort();
  sel.innerHTML = '<option value="">— área / servicio —</option>' +
    areas.map(function(a) { return '<option value="' + segEscape(a) + '">' + segEscape(a) + '</option>'; }).join('');
  segDerFiltrarProfesionales();
}

function segDerFiltrarProfesionales() {
  var area = (document.getElementById('seg-der-sel-area') || {}).value || '';
  var sel  = document.getElementById('seg-der-sel-prof');
  if (!sel) return;
  var filtrados = area
    ? _segDer.profesionales.filter(function(p) {
        var profAreas = p.areas && p.areas.length ? p.areas : (p.area ? [p.area] : []);
        return profAreas.indexOf(area) !== -1;
      })
    : _segDer.profesionales;
  sel.innerHTML = '<option value="">— profesional —</option>' +
    filtrados.map(function(p) {
      return '<option value="' + p._id + '" ' +
        'data-nombre="' + segEscape(p.nombre) + '" ' +
        'data-area="' + segEscape(area || p.area || '') + '">' +
        segEscape(p.nombre) + '</option>';
    }).join('');
}

/* ─────────────────────────────────────────
   AGREGAR profesional interno
───────────────────────────────────────── */
function segDerAgregarInterno() {
  if (!_segDer.chipActivo) return;
  var selProf = document.getElementById('seg-der-sel-prof');
  var selArea = document.getElementById('seg-der-sel-area');
  if (!selProf || !selProf.value) {
    segToast('Selecciona un profesional', 'warn'); return;
  }
  var opt    = selProf.options[selProf.selectedIndex];
  var nombre = opt.getAttribute('data-nombre') || opt.text;
  var area   = opt.getAttribute('data-area') || (selArea ? selArea.value : '');

  // Verificar que no esté ya asignado
  var ders = _segDer.derivaciones[_segDer.chipActivo] || [];
  if (ders.find(function(d) { return d.profesional_id === selProf.value; })) {
    segToast('Este profesional ya está asignado', 'warn'); return;
  }

  var _chipActivo = _segDer.chipActivo;
  segFetch(
    '/api/seguimiento/clientes/' + SEG.clienteId + '/derivaciones',
    { method: 'POST', body: JSON.stringify({
      company_id: SEG.companyId, chip_nombre: _chipActivo, tipo: 'interno',
      profesional_id: selProf.value, profesional_nombre: nombre,
      area_nombre: area, es_responsable: false,
    })},
    function(data) {
      if (!_segDer.derivaciones[_chipActivo]) _segDer.derivaciones[_chipActivo] = [];
      _segDer.derivaciones[_chipActivo].push(data.derivacion || data);
      segDerRenderizarLista();
      segDerRenderizarChips();
      segDerActualizarSub();
      segToast('Profesional asignado', 'ok');
      if (selProf) selProf.value = '';
    },
    function() { segToast('Error al asignar profesional', 'error'); }
  );
}

/* ─────────────────────────────────────────
   AGREGAR profesional externo
───────────────────────────────────────── */
function segDerAgregarExterno() {
  if (!_segDer.chipActivo) return;
  var nombre = (document.getElementById('seg-der-ext-nombre') || {}).value || '';
  var area   = (document.getElementById('seg-der-ext-area')   || {}).value || '';
  var lugar  = (document.getElementById('seg-der-ext-lugar')  || {}).value || '';

  if (!nombre.trim()) { segToast('Ingresa el nombre del profesional', 'warn'); return; }

  var _chipActivo2 = _segDer.chipActivo;
  segFetch(
    '/api/seguimiento/clientes/' + SEG.clienteId + '/derivaciones',
    { method: 'POST', body: JSON.stringify({
      company_id: SEG.companyId, chip_nombre: _chipActivo2, tipo: 'externo',
      profesional_nombre: nombre.trim(), area_nombre: area.trim(), lugar_nombre: lugar.trim(),
      es_responsable: false,
    })},
    function(data) {
      if (!_segDer.derivaciones[_chipActivo2]) _segDer.derivaciones[_chipActivo2] = [];
      _segDer.derivaciones[_chipActivo2].push(data.derivacion || data);
      segDerRenderizarLista();
      segDerRenderizarChips();
      segDerActualizarSub();
      segToast('Profesional externo agregado', 'ok');
      ['seg-der-ext-nombre','seg-der-ext-area','seg-der-ext-lugar'].forEach(function(id) {
        var el = document.getElementById(id); if (el) el.value = '';
      });
    },
    function() { segToast('Error al agregar profesional externo', 'error'); }
  );
}

/* ─────────────────────────────────────────
   CONFIRMAR / CANCELAR / ELIMINAR
───────────────────────────────────────── */
function segDerConfirmarQuitar(btn, id, nombre) {
  // Cerrar cualquier confirm abierto
  document.querySelectorAll('.seg-der-confirm.show').forEach(function(el) { el.classList.remove('show'); });
  var el = document.getElementById('seg-der-confirm-' + id);
  if (el) el.classList.add('show');
}

function segDerCancelarConfirm(id) {
  var el = document.getElementById('seg-der-confirm-' + id);
  if (el) el.classList.remove('show');
}

function segDerEliminar(id) {
  segFetch(
    '/api/seguimiento/derivaciones/' + id + '?company_id=' + SEG.companyId,
    { method: 'DELETE' },
    function() {
      Object.keys(_segDer.derivaciones).forEach(function(chip) {
        _segDer.derivaciones[chip] = _segDer.derivaciones[chip].filter(function(d) { return d._id !== id; });
      });
      segDerRenderizarLista();
      segDerRenderizarChips();
      segDerActualizarSub();
      segToast('Derivación eliminada', 'ok');
    },
    function() { segToast('Error al eliminar derivación', 'error'); }
  );
}

/* ─────────────────────────────────────────
   ACTUALIZAR subtítulo del panel
───────────────────────────────────────── */
function segDerActualizarSub() {
  var sub   = document.getElementById('seg-der-sub');
  if (!sub) return;
  var chips = Object.keys(_segDer.derivaciones).filter(function(k) {
    return _segDer.derivaciones[k].length > 0;
  });
  var total = chips.reduce(function(acc, k) { return acc + _segDer.derivaciones[k].length; }, 0);
  sub.textContent = chips.length
    ? chips.length + ' ' + (chips.length === 1 ? 'problema' : 'problemas') + ' · ' + total + ' ' + (total === 1 ? 'profesional' : 'profesionales')
    : '';
}

/* ─────────────────────────────────────────
   MODAL HISTORIAL por profesional
───────────────────────────────────────── */
function segDerAbrirHistorialEl(el) {
  // Reconstruir profDoc desde data attributes (evita problemas de comillas)
  var profDoc = {
    _id:               el.getAttribute('data-der-id')    || '',
    profesional_nombre: el.getAttribute('data-nombre')   || '',
    area_nombre:       el.getAttribute('data-area')      || '',
    lugar_nombre:      el.getAttribute('data-lugar')     || '',
    tipo:              el.getAttribute('data-tipo')      || 'interno',
    es_responsable:    el.getAttribute('data-responsable') === '1',
  };
  segDerAbrirHistorial(profDoc);
}

function segDerAbrirHistorial(profDoc) {
  _segDer.modalProf = profDoc;
  document.querySelectorAll('.seg-der-confirm.show').forEach(function(el) { el.classList.remove('show'); });

  // Header
  var iniciales = _segDerIniciales(profDoc.profesional_nombre);
  var avatarBg  = profDoc.tipo === 'externo' ? '#fef3c7' : (profDoc.es_responsable ? '#ede9fe' : '#e1f5ee');
  var avatarClr = profDoc.tipo === 'externo' ? '#92400e' : (profDoc.es_responsable ? '#5b21b6' : '#0f6e56');

  var av = document.getElementById('seg-der-modal-avatar');
  if (av) { av.textContent = iniciales; av.style.background = avatarBg; av.style.color = avatarClr; }

  var nom = document.getElementById('seg-der-modal-nombre');
  if (nom) nom.textContent = profDoc.profesional_nombre;

  var area = document.getElementById('seg-der-modal-area');
  if (area) area.textContent = (profDoc.area_nombre || '') + (profDoc.lugar_nombre ? ' · ' + profDoc.lugar_nombre : '');

  var tags = document.getElementById('seg-der-modal-tags');
  if (tags) {
    var chipTag = '<span class="seg-der-modal-tag seg-der-modal-tag-chip">' +
      '<i class="fas fa-circle" style="font-size:6px;color:' + (_segDer.colorChip || '#dc2626') + '"></i> ' +
      segEscape(_segDer.chipActivo || '') + '</span>';
    var rolTag  = '<span class="seg-der-modal-tag seg-der-modal-tag-rol">' +
      (profDoc.es_responsable ? 'responsable' : 'asignado') + '</span>';
    var extTag  = profDoc.tipo === 'externo'
      ? '<span class="seg-der-modal-tag" style="background:#fef3c7;color:#92400e">externo</span>' : '';
    tags.innerHTML = chipTag + rolTag + extTag;
  }

  // Cargar sesiones desde BD
  segDerCargarSesionesModal(profDoc);

  // Mostrar modal
  var overlay = document.getElementById('seg-der-modal-overlay');
  if (overlay) overlay.classList.remove('seg-hidden');
}

function segDerCargarSesionesModal(profDoc) {
  var body = document.getElementById('seg-der-modal-body');
  if (!body) return;
  body.innerHTML = '<div class="seg-der-ses-empty"><i class="fas fa-spinner fa-spin"></i> Cargando...</div>';
  _segDer._historialTexto = ''; // reset texto para envío

  var chip    = encodeURIComponent(_segDer.chipActivo || '');
  var ctxDone = false, hisDone = false;
  var ctxData = null, hisData = null;

  function _renderizar() {
    if (!ctxDone || !hisDone) return;
    var cliente   = (ctxData && ctxData.cliente) || {};
    var labels    = (ctxData && ctxData.labels) || {};
    var registros = (hisData && hisData.registros) || [];

    // Actualizar tag cantidad
    var tags = document.getElementById('seg-der-modal-tags');
    if (tags) {
      var nTag = tags.querySelector('.seg-der-modal-tag-n');
      var txt  = registros.length + (registros.length === 1 ? ' registro' : ' registros');
      if (nTag) nTag.textContent = txt;
      else tags.insertAdjacentHTML('beforeend',
        '<span class="seg-der-modal-tag seg-der-modal-tag-n">' + txt + '</span>');
    }

    // Campos fijos del paciente (del primer registro con campos_plantilla)
    var camposFijos = [];
    for (var i = 0; i < registros.length; i++) {
      if (registros[i].campos_plantilla && registros[i].campos_plantilla.length) {
        camposFijos = registros[i].campos_plantilla; break;
      }
    }

    // Header con datos del paciente
    var encabezadoHtml = '';
    if (cliente.nombre || camposFijos.length) {
      var filasCampos = camposFijos.filter(function(c) { return c.label && c.valor; })
        .map(function(c) {
          return '<div class="seg-der-campo-fijo">' +
            '<span class="seg-der-campo-label">' + segEscape(c.label) + '</span>' +
            '<span class="seg-der-campo-valor">' + segEscape(c.valor) + '</span>' +
          '</div>';
        }).join('');

      encabezadoHtml = '<div class="seg-der-paciente-hdr">' +
        '<div class="seg-der-paciente-nombre">' +
          '<i class="fas fa-user-circle"></i> ' + segEscape(cliente.nombre || 'Cliente') +
          (cliente.anio_nacimiento ? '<span class="seg-der-paciente-meta">' +
            cliente.anio_nacimiento + '</span>' : '') +
        '</div>' +
        (filasCampos ? '<div class="seg-der-campos-grid">' + filasCampos + '</div>' : '') +
      '</div>';
    }

    if (!registros.length) {
      body.innerHTML = encabezadoHtml +
        '<div class="seg-der-ses-empty">Sin registros para este problema con este profesional.</div>';
      return;
    }

    // Construir texto plano para envío (acumulado)
    var textoParts = [];
    if (cliente.nombre) textoParts.push('Cliente: ' + cliente.nombre);
    if (cliente.anio_nacimiento) textoParts.push('Año nac.: ' + cliente.anio_nacimiento);
    camposFijos.filter(function(c) { return c.label && c.valor; }).forEach(function(c) {
      textoParts.push(c.label + ': ' + c.valor);
    });
    textoParts.push('─'.repeat(30));
    textoParts.push('Profesional: ' + profDoc.profesional_nombre);
    textoParts.push('Problema: ' + (_segDer.chipActivo || ''));
    textoParts.push('─'.repeat(30));
    textoParts.push('');

    registros.forEach(function(r, idx) {
      var fecha = _segDerFormatFecha(r.fecha) + (r.hora ? ' ' + r.hora : '');
      textoParts.push('Registro ' + (idx+1) + ' — ' + fecha);
      if (r.notas_internas) textoParts.push('Notas: ' + r.notas_internas);
      if (r.contenido_principal) textoParts.push('Lo trabajado: ' + r.contenido_principal);
      if (r.tareas) textoParts.push('Tareas: ' + r.tareas);
      if (r.proxima_cita) textoParts.push('Próximo: ' + r.proxima_cita);
      if (r.resumen_editado || r.resumen_ia) textoParts.push('Resumen: ' + (r.resumen_editado || r.resumen_ia));
      textoParts.push('');
    });
    _segDer._historialTexto = textoParts.join('\n');

    body.innerHTML = encabezadoHtml +
      registros.map(function(r, idx) {
        return _segDerRenderRegistro(r, idx);
      }).join('');
  }

  // Carga paralela contexto + historial completo
  segFetch(
    '/api/seguimiento/clientes/' + SEG.clienteId + '/contexto?company_id=' + SEG.companyId,
    {},
    function(d) { ctxData = d; ctxDone = true; _renderizar(); },
    function()  { ctxData = {}; ctxDone = true; _renderizar(); }
  );
  segFetch(
    '/api/seguimiento/clientes/' + SEG.clienteId + '/derivaciones/historial?company_id=' + SEG.companyId + '&chip=' + chip,
    {},
    function(d) { hisData = d; hisDone = true; _renderizar(); },
    function()  { hisData = {registros:[]}; hisDone = true; _renderizar(); }
  );
}

// Funciones de envío desde el modal historial
function segDerHistorialCopiar() {
  if (!_segDer._historialTexto) return;
  try {
    navigator.clipboard.writeText(_segDer._historialTexto);
    segToast('Historial copiado al portapapeles', 'ok');
  } catch(e) {
    segToast('Selecciona el texto y copia manualmente', 'info');
  }
}

function segDerHistorialEnviarWA() {
  if (!_segDer._historialTexto) return;
  _segDerEnviarTexto(_segDer._historialTexto, 'whatsapp', '');
}

function segDerHistorialEnviarEmail() {
  if (!_segDer._historialTexto) return;
  var asunto = 'Historial ' + (_segDer.chipActivo || '');
  _segDerEnviarTextoEmail(_segDer._historialTexto, asunto);
}

function segDerResumenEnviarWA() {
  var ta = document.getElementById('seg-der-resumen-texto');
  if (!ta || !ta.value) return;
  _segDerEnviarTexto(ta.value, 'whatsapp', '');
}

function segDerResumenEnviarEmail() {
  var ta = document.getElementById('seg-der-resumen-texto');
  if (!ta || !ta.value) return;
  var asunto = 'Resumen derivacion: ' + (_segDer.chipActivo || '');
  _segDerEnviarTextoEmail(ta.value, asunto);
}

// Shared: enviar por WhatsApp (API si hay registro activo, sino wa.me fallback)
function _segDerRenderRegistro(r, idx) {
  var chip = _segDer.chipActivo;
  var fecha = _segDerFormatFecha(r.fecha) + (r.hora ? ' ' + r.hora : '');

  // Intensidad: buscar en objeto intensidades o en chips_trabajar embebido
  var intens = 0;
  if (r.intensidades) {
    intens = r.intensidades[chip] || 0;
  }
  if (!intens && r.chips_trabajar) {
    r.chips_trabajar.forEach(function(c) {
      if ((c.nombre || c) === chip && c.intensidad) intens = c.intensidad;
    });
  }
  var bgColor = typeof SEG_INTENS_COLORS !== 'undefined' && intens > 0
    ? SEG_INTENS_COLORS[intens]
    : (intens > 6 ? '#dc2626' : intens > 3 ? '#d97706' : intens > 0 ? '#059669' : '#9ca3af');
  var txColor = typeof SEG_INTENS_TEXT !== 'undefined' && intens > 0
    ? SEG_INTENS_TEXT[intens] : '#fff';

  var bodyHtml = '';

  if (r.notas_internas) {
    bodyHtml += '<div class="seg-der-ses-label">Notas de sesión</div>' +
      '<div class="seg-der-ses-text">' + segEscape(r.notas_internas).split('\n').join('<br>') + '</div>' +
      '<div class="seg-der-ses-sep"></div>';
  }
  if (r.contenido_principal) {
    bodyHtml += '<div class="seg-der-ses-label">Lo que se trabajó</div>' +
      '<div class="seg-der-ses-text">' + segEscape(r.contenido_principal).split('\n').join('<br>') + '</div>' +
      '<div class="seg-der-ses-sep"></div>';
  }
  var chips_trab = (r.chips_trabajar || []).filter(function(c) { return (c.nombre || c) === chip; });
  if (chips_trab.length) {
    bodyHtml += '<div class="seg-der-ses-chips">' +
      chips_trab.map(function(c) {
        var n  = c.nombre || c;
        var iv = (r.intensidades && r.intensidades[n]) || c.intensidad || 0;
        var ib = typeof SEG_INTENS_COLORS !== 'undefined' && iv > 0 ? SEG_INTENS_COLORS[iv] : bgColor;
        var it = typeof SEG_INTENS_TEXT !== 'undefined' && iv > 0 ? SEG_INTENS_TEXT[iv] : '#fff';
        return '<span class="seg-der-ses-chip">' + segEscape(n) +
          (iv ? '<span class="seg-der-ses-intens-badge" style="background:' + ib + ';color:' + it + '">' + iv + '</span>' : '') +
          '</span>';
      }).join('') + '</div><div class="seg-der-ses-sep"></div>';
  }
  if ((r.chips_sintoma || []).length) {
    bodyHtml += '<div class="seg-der-ses-label">Síntomas</div>' +
      '<div class="seg-der-ses-chips">' +
      (r.chips_sintoma || []).map(function(c) {
        return '<span class="seg-der-ses-chip-sint">' + segEscape(c.nombre || c) + '</span>';
      }).join('') + '</div><div class="seg-der-ses-sep"></div>';
  }
  if (r.tareas) {
    bodyHtml += '<div class="seg-der-ses-label">Tareas para el cliente</div>' +
      '<div class="seg-der-ses-text">' + segEscape(r.tareas) + '</div>' +
      '<div class="seg-der-ses-sep"></div>';
  }
  if (r.proxima_cita) {
    bodyHtml += '<div class="seg-der-ses-label">Próximo registro</div>' +
      '<div class="seg-der-ses-text">' + segEscape(r.proxima_cita) + '</div>';
  }
  if (!bodyHtml) {
    bodyHtml = '<div class="seg-der-ses-text" style="color:#9ca3af">Sin detalle registrado.</div>';
  }

  return '<div class="seg-der-ses-card">' +
    '<div class="seg-der-ses-hdr" onclick="segDerToggleSes(this)">' +
      '<span class="seg-der-ses-num">Registro ' + (idx + 1) + '</span>' +
      '<span class="seg-der-ses-fecha">' + fecha + '</span>' +
      (r.hora ? '<span class="seg-der-ses-hora">' + r.hora + '</span>' : '') +
      '<div class="seg-der-ses-intens">intensidad ' +
        '<span class="seg-der-ses-dot" style="background:' + bgColor + ';color:' + txColor + '">' +
        (intens || '—') + '</span>' +
      '</div>' +
      '<span class="seg-der-ses-chev"><i class="fas fa-chevron-down"></i></span>' +
    '</div>' +
    '<div class="seg-der-ses-body" style="display:' + (idx === 0 ? 'block' : 'none') + '">' +
      bodyHtml +
    '</div>' +
  '</div>';
}

function segDerToggleSes(hdr) {
  var body = hdr.nextElementSibling;
  var chev = hdr.querySelector('.seg-der-ses-chev');
  if (!body) return;
  var open = body.style.display !== 'none';
  body.style.display = open ? 'none' : 'block';
  if (chev) chev.style.transform = open ? 'rotate(-90deg)' : 'rotate(0deg)';
}


function _segDerEnviarTexto(texto, canal, email) {
  if (SEG.registroId) {
    segFetch('/api/seguimiento/registros/' + SEG.registroId + '/enviar',
      { method: 'POST', body: JSON.stringify({
        resumen: texto, canal: canal,
        company_id: SEG.companyId, cliente_email: email,
      })},
      function() { segToast('Enviado por ' + canal, 'ok'); },
      function() {
        // fallback
        var waNum = (SEG.clienteId || '').replace(/[^0-9]/g, '');
        window.open('https://wa.me/' + waNum + '?text=' + encodeURIComponent(texto), '_blank');
      }
    );
  } else {
    var waNum = (SEG.clienteId || '').replace(/[^0-9]/g, '');
    window.open('https://wa.me/' + waNum + '?text=' + encodeURIComponent(texto), '_blank');
    segToast('Abriendo WhatsApp...', 'ok');
  }
}

// Shared: enviar por email (pide email si no está en contexto)
function _segDerEnviarTextoEmail(texto, asunto) {
  var emailCtx = (SEG.contexto && SEG.contexto.cliente && SEG.contexto.cliente.email) || '';
  function _doSend(email) {
    if (SEG.registroId) {
      segFetch('/api/seguimiento/registros/' + SEG.registroId + '/enviar',
        { method: 'POST', body: JSON.stringify({
          resumen: texto, canal: 'email',
          company_id: SEG.companyId, cliente_email: email,
        })},
        function() { segToast('Enviado por email', 'ok'); },
        function() {
          window.open('mailto:' + email + '?subject=' + encodeURIComponent(asunto) + '&body=' + encodeURIComponent(texto), '_blank');
        }
      );
    } else {
      window.open('mailto:' + email + '?subject=' + encodeURIComponent(asunto) + '&body=' + encodeURIComponent(texto), '_blank');
      segToast('Abriendo email...', 'ok');
    }
  }
  if (!emailCtx) {
    segPrompt('Email del cliente:', function(email) {
      if (!email || !email.includes('@')) { segToast('Email invalido', 'error'); return; }
      _doSend(email);
    });
  } else {
    _doSend(emailCtx);
  }
}

function segDerResumenIAModal() { segDerResumenIA(); }

/* ─────────────────────────────────────────
   PDF historial completo
───────────────────────────────────────── */
function segDerHistorialPDF() {
  if (!_segDer.chipActivo) { segToast('Selecciona un problema primero', 'warn'); return; }
  var chip = _segDer.chipActivo;
  segToast('Preparando historial...', 'info');

  var chipEnc = encodeURIComponent(chip);
  Promise.all ? (function() {
    // Carga contexto (datos del cliente) e historial en paralelo
    var ctxDone = false, hisDone = false;
    var ctxData = null, hisData = null;

    function _tryRender() {
      if (!ctxDone || !hisDone) return;
      _segDerGenerarPDF(ctxData, hisData, chip);
    }

    segFetch(
      '/api/seguimiento/clientes/' + SEG.clienteId + '/contexto?company_id=' + SEG.companyId,
      {},
      function(d) { ctxData = d; ctxDone = true; _tryRender(); },
      function() { ctxData = {}; ctxDone = true; _tryRender(); }
    );
    segFetch(
      '/api/seguimiento/clientes/' + SEG.clienteId + '/derivaciones/historial?company_id=' + SEG.companyId + '&chip=' + chipEnc,
      {},
      function(d) { hisData = d; hisDone = true; _tryRender(); },
      function() { hisData = {registros:[]}; hisDone = true; _tryRender(); }
    );
  })() : null;
}

function _segDerGenerarPDF(ctxData, hisData, chip) {
  var registros    = (hisData && hisData.registros) || [];
  var cliente      = (ctxData && ctxData.cliente) || {};
  var labels       = (ctxData && ctxData.labels) || {};
  var nombreCliente = cliente.nombre || 'Cliente';
  var anioBirth     = cliente.anio_nacimiento ? 'Año nac.: ' + cliente.anio_nacimiento : '';

  // Obtener primer registro con campos_plantilla para datos fijos
  var camposFijos = [];
  for (var i = 0; i < registros.length; i++) {
    var cf = registros[i].campos_plantilla;
    if (cf && cf.length) { camposFijos = cf; break; }
  }

  var css = '<style>' +
    'body{font-family:Arial,sans-serif;font-size:11px;color:#1f2937;max-width:720px;margin:30px auto;padding:20px}' +
    'h1{font-size:16px;color:#5b21b6;margin-bottom:2px}' +
    '.meta{font-size:10px;color:#6b7280;margin-bottom:14px}' +
    '.encabezado{background:#EFF6FF;border:1px solid #C9D9FF;border-radius:6px;padding:12px 14px;margin-bottom:18px}' +
    '.encabezado h2{font-size:13px;color:#1e40af;margin:0 0 8px}' +
    '.campos-grid{display:grid;grid-template-columns:1fr 1fr;gap:4px 16px}' +
    '.campo-fijo{font-size:10px}.campo-fijo strong{color:#374151}' +
    '.registro{margin-bottom:14px;border:1px solid #e5e7eb;border-radius:6px;page-break-inside:avoid;overflow:hidden}' +
    '.reg-hdr{background:#f9fafb;padding:8px 12px;border-bottom:1px solid #e5e7eb;display:flex;align-items:center;gap:10px}' +
    '.reg-num{background:#5b21b6;color:#fff;border-radius:10px;padding:1px 8px;font-size:10px;font-weight:bold}' +
    '.reg-fecha{font-weight:bold;font-size:11px}' +
    '.intens-dot{display:inline-block;border-radius:50%;width:18px;height:18px;text-align:center;line-height:18px;font-size:9px;font-weight:bold;color:#fff;margin-left:6px}' +
    '.reg-body{padding:10px 12px}' +
    '.sec-label{font-size:9px;text-transform:uppercase;color:#9ca3af;font-weight:bold;margin:8px 0 2px;letter-spacing:.04em}' +
    '.sec-text{color:#374151;line-height:1.5;margin-bottom:4px}' +
    '.chip-tag{display:inline-block;background:#ede9fe;color:#5b21b6;border-radius:10px;padding:1px 7px;font-size:9px;font-weight:bold;margin:2px 2px}' +
    '.chip-sint{display:inline-block;background:#fce7f3;color:#9d174d;border-radius:10px;padding:1px 7px;font-size:9px;font-weight:bold;margin:2px 2px}' +
    '.sep{height:1px;background:#f3f4f6;margin:6px 0}' +
    '.footer{font-size:9px;color:#9ca3af;text-align:center;margin-top:20px;border-top:1px solid #e5e7eb;padding-top:8px}' +
  '</style>';

  // Encabezado con datos del paciente
  var encabezado = '<div class="encabezado">' +
    '<h2>Datos del ' + (labels.cliente || 'Cliente') + '</h2>' +
    '<div class="campos-grid">';

  // Datos básicos
  if (anioBirth) encabezado += '<div class="campo-fijo"><strong>Año nacimiento:</strong> ' + cliente.anio_nacimiento + '</div>';

  // Campos fijos de plantilla
  camposFijos.forEach(function(c) {
    if (c.label && c.valor) {
      encabezado += '<div class="campo-fijo"><strong>' + c.label + ':</strong> ' + c.valor + '</div>';
    }
  });

  encabezado += '</div></div>';

  // Registros
  var regHtml = registros.map(function(r, idx) {
    var fecha  = _segDerFormatFecha(r.fecha) + (r.hora ? ' ' + r.hora : '');
    var intens = (r.intensidades && r.intensidades[chip]) || 0;
    var iColor = intens > 0 ? (intens <= 3 ? '#059669' : intens <= 6 ? '#d97706' : '#dc2626') : '#9ca3af';

    var body = '';
    if (r.notas_internas) {
      body += '<div class="sec-label">Notas de sesión</div>' +
        '<div class="sec-text">' + r.notas_internas.split('\n').join('<br>') + '</div><div class="sep"></div>';
    }
    if (r.contenido_principal) {
      body += '<div class="sec-label">' + (labels.contenido_principal || 'Lo que se trabajó') + '</div>' +
        '<div class="sec-text">' + r.contenido_principal.split('\n').join('<br>') + '</div><div class="sep"></div>';
    }
    // Chips
    var ct = (r.chips_trabajar || []).filter(function(c) { return (c.nombre||c) === chip; });
    if (ct.length) {
      body += ct.map(function(c) {
        return '<span class="chip-tag">' + (c.nombre||c) + (intens ? ' (' + intens + ')' : '') + '</span>';
      }).join('');
      body += '<div class="sep"></div>';
    }
    if ((r.chips_sintoma||[]).length) {
      body += '<div class="sec-label">Síntomas</div>' +
        (r.chips_sintoma||[]).map(function(c) {
          return '<span class="chip-sint">' + (c.nombre||c) + '</span>';
        }).join('') + '<div class="sep"></div>';
    }
    if (r.tareas) {
      body += '<div class="sec-label">Tareas</div><div class="sec-text">' + r.tareas + '</div><div class="sep"></div>';
    }
    if (r.proxima_cita) {
      body += '<div class="sec-label">Próximo registro</div><div class="sec-text">' + r.proxima_cita + '</div>';
    }
    if (r.resumen_editado || r.resumen_ia) {
      body += '<div class="sec-label">Resumen IA</div><div class="sec-text">' +
        (r.resumen_editado || r.resumen_ia).split('\n').join('<br>') + '</div>';
    }
    if (!body) body = '<div class="sec-text" style="color:#9ca3af">Sin detalle registrado.</div>';

    return '<div class="registro">' +
      '<div class="reg-hdr">' +
        '<span class="reg-num">Registro ' + (idx+1) + '</span>' +
        '<span class="reg-fecha">' + fecha + '</span>' +
        (intens ? '<span class="intens-dot" style="background:' + iColor + '">' + intens + '</span>' : '') +
      '</div>' +
      '<div class="reg-body">' + body + '</div>' +
    '</div>';
  }).join('');

  var html = '<!DOCTYPE html><html><head><meta charset="utf-8">' +
    '<title>Historial ' + chip + ' - ' + nombreCliente + '</title>' + css + '</head><body>' +
    '<h1>Historial — ' + chip + '</h1>' +
    '<div class="meta">Cliente: <strong>' + nombreCliente + '</strong>&nbsp;|&nbsp;' +
      'Generado: ' + new Date().toLocaleDateString('es-CL') + '</div>' +
    encabezado + regHtml +
    '<div class="footer">Heavensy — documento confidencial</div>' +
    '</body></html>';

  var win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(function() { win.print(); }, 600);
    segToast('Historial listo para imprimir', 'ok');
  } else {
    segToast('Activa las ventanas emergentes para imprimir', 'warn');
  }
}


function segDerExportarPDF() { segDerHistorialPDF(); }

/* ─────────────────────────────────────────
   HELPERS
───────────────────────────────────────── */
function _segDerIniciales(nombre) {
  if (!nombre) return '?';
  var parts = nombre.replace(/^(Dr\.|Dra\.|Lic\.)\s*/i, '').split(' ');
  return parts.length >= 2
    ? (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase()
    : nombre.slice(0, 2).toUpperCase();
}

function _segDerFechaCorta(isoStr) {
  if (!isoStr) return '';
  try {
    var d = new Date(isoStr);
    return d.getDate() + ' ' + ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'][d.getMonth()];
  } catch(e) { return ''; }
}

function _segDerFormatFecha(isoStr) {
  if (!isoStr) return '';
  try {
    var d   = new Date(isoStr);
    var mes = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'][d.getMonth()];
    return d.getDate() + ' ' + mes + ' ' + d.getFullYear();
  } catch(e) { return isoStr; }
}
/* ─────────────────────────────────────────
   DOCUMENT-LEVEL DROP — fallback global
   Captura drops en toda la página para el panel de derivaciones
───────────────────────────────────────── */
(function() {
  document.addEventListener('dragover', function(event) {
    if (_segDerDragNombre) event.preventDefault();
  });
  document.addEventListener('drop', function(event) {
    if (!_segDerDragNombre) return;
    var target = event.target;
    // Solo actuar si el drop fue sobre el panel de derivaciones o la drop zone
    var panel = document.getElementById('seg-der-panel');
    if (panel && panel.contains(target)) return; // ya lo maneja el panel
    _segDerDragNombre = null;
  });
})();