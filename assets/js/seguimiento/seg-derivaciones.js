/* ─────────────────────────────────────────
   CUSTOM DROPDOWNS — reemplazan <select> nativos
───────────────────────────────────────── */
var _segDdState = {};

/* ─────────────────────────────────────────
   ESTADO DEL MÓDULO DERIVACIONES
───────────────────────────────────────── */
var _segDer = {
  panelChips:    [],   // chips arrastrados al panel
  derivaciones:  {},   // { chip_nombre: [derivacion, ...] }
  profesionales: [],   // lista de profesionales internos
  chipActivo:    null, // chip seleccionado actualmente
  colorChip:     null,
  modalProf:     null, // profesional del modal historial abierto
  _historialTexto: '' // texto plano para envío por canal
};

var _segDerAsignaciones = {}; // { chip_nombre: { profesional, servicio } }

function segDdToggle(id) {
  var trigger = document.getElementById('seg-dd-' + id + '-trigger');
  var list    = document.getElementById('seg-dd-' + id + '-list');
  if (!trigger || !list) return;

  // Si ya hay uno abierto, cerrarlo primero
  var prevId = document.body.getAttribute('data-dd-open');
  if (prevId) {
    var prevList    = document.getElementById('seg-dd-' + prevId + '-list');
    var prevWrap    = document.getElementById('seg-dd-' + prevId + '-wrap');
    var prevTrigger = document.getElementById('seg-dd-' + prevId + '-trigger');
    if (prevList && prevWrap) prevWrap.appendChild(prevList);
    if (prevTrigger) prevTrigger.classList.remove('open');
    list.classList.add('seg-hidden');
    document.body.removeAttribute('data-dd-open');
    if (prevId === id) return; // mismo — solo cerrar
  }

  // Mover la lista al body con posición fija
  var rect = trigger.getBoundingClientRect();
  list.classList.remove('seg-hidden');
  list.style.position = 'fixed';
  list.style.top      = (rect.bottom + 4) + 'px';
  list.style.left     = rect.left + 'px';
  list.style.width    = rect.width + 'px';
  list.style.zIndex   = '9999';
  document.body.appendChild(list);
  document.body.setAttribute('data-dd-open', id);
  trigger.classList.add('open');

  setTimeout(function() {
    document.addEventListener('click', function _c(e) {
      if (!list.contains(e.target) && !trigger.contains(e.target)) {
        var wrap = document.getElementById('seg-dd-' + id + '-wrap');
        if (wrap) wrap.appendChild(list);
        list.classList.add('seg-hidden');
        list.style.cssText = '';
        trigger.classList.remove('open');
        document.body.removeAttribute('data-dd-open');
        document.removeEventListener('click', _c);
      }
    });
  }, 10);
}

function segDdSeleccionar(id, val, label) {
  var valEl   = document.getElementById('seg-dd-' + id + '-value');
  var hidden  = document.getElementById('seg-der-sel-' + id);
  var trigger = document.getElementById('seg-dd-' + id + '-trigger');
  var list    = document.getElementById('seg-dd-' + id + '-list');
  var wrap    = document.getElementById('seg-dd-' + id + '-wrap');
  if (valEl)  valEl.textContent = label || val || '— selecciona —';
  if (hidden) { hidden.value = val; hidden.setAttribute('data-nombre', label || ''); }
  // Return list to wrap
  if (list && wrap) { wrap.appendChild(list); list.classList.add('seg-hidden'); list.style.cssText = ''; }
  if (trigger) trigger.classList.remove('open');
  document.body.removeAttribute('data-dd-open');
  if (id === 'area') segDerFiltrarProfesionales();
}

function _segDdMakeItem(ddid, val, label, extra) {
  return '<div class="seg-dd-item" data-ddid="' + ddid + '" data-val="' +
    segEscape(val) + '" data-label="' + segEscape(label) +
    '" onclick="segDdItemClick(this)">' + segEscape(label) + (extra || '') + '</div>';
}

function _segDdPoblar(id, items, placeholder) {
  var list = document.getElementById('seg-dd-' + id + '-list');
  if (!list) return;
  var html = _segDdMakeItem(id, '', placeholder, '');
  items.forEach(function(item) { html += _segDdMakeItem(id, item, item, ''); });
  list.innerHTML = html;
  if (list.firstElementChild) list.firstElementChild.classList.add('seg-dd-placeholder');
  var valEl  = document.getElementById('seg-dd-' + id + '-value');
  var hidden = document.getElementById('seg-der-sel-' + id);
  if (valEl)  valEl.textContent = placeholder;
  if (hidden) hidden.value = '';
}

function _segDdPoblarProfs(id, profs, placeholder) {
  var list = document.getElementById('seg-dd-' + id + '-list');
  if (!list) return;
  var html = _segDdMakeItem(id, '', placeholder, '');
  profs.forEach(function(p) {
    var sub = p.area ? '<span class="seg-dd-item-sub">' + segEscape(p.area) + '</span>' : '';
    html += _segDdMakeItem(id, p._id, p.nombre, sub);
  });
  list.innerHTML = html;
  if (list.firstElementChild) list.firstElementChild.classList.add('seg-dd-placeholder');
  var valEl  = document.getElementById('seg-dd-' + id + '-value');
  var hidden = document.getElementById('seg-der-sel-' + id);
  if (valEl)  valEl.textContent = placeholder;
  if (hidden) { hidden.value = ''; hidden.setAttribute('data-nombre', ''); }
}

function segDdItemClick(el) {
  var id    = el.getAttribute('data-ddid')  || '';
  var val   = el.getAttribute('data-val')   || '';
  var label = el.getAttribute('data-label') || '';
  segDdSeleccionar(id, val, label);
}


/* ─────────────────────────────────────────
   INIT — llamado al cambiar de paciente
───────────────────────────────────────── */
function segDerInit() {
  // Resetear estado
  _segDer.panelChips     = [];
  _segDer.derivaciones   = {};
  _segDer.chipActivo     = null;
  _segDer.colorChip      = null;
  _segDer.modalProf      = null;
  _segDer._historialTexto = '';
  _segDerAsignaciones    = {};

  // Ocultar contenido y detalle
  var content = document.getElementById('seg-der-content');
  var detail  = document.getElementById('seg-der-detail');
  var chev    = document.getElementById('seg-der-chev');
  if (content) content.classList.add('seg-hidden');
  if (detail)  detail.classList.add('seg-hidden');
  if (chev)    chev.style.transform = 'rotate(-90deg)';

  // Limpiar chips del panel
  var chips = document.getElementById('seg-der-chips');
  if (chips) chips.innerHTML = '';

  // Actualizar subtítulo
  segDerActualizarSub();
}

function segToggleDer() {
  var content = document.getElementById('seg-der-content');
  var chev    = document.getElementById('seg-der-chev');
  if (!content) return;
  var isOpen = !content.classList.contains('seg-hidden');
  if (isOpen) {
    content.classList.add('seg-hidden');
    if (chev) chev.style.transform = 'rotate(-90deg)';
  } else {
    content.classList.remove('seg-hidden');
    if (chev) chev.style.transform = '';
    if (!_segDer.panelChips.length && !_segDer.profesionales.length) segDerCargar();
  }
}

function segDerResumenCopiar() {
  var texto = _segDerResumenTextoPlano();
  if (!texto) return;
  try {
    navigator.clipboard.writeText(texto);
    segToast('Resumen copiado al portapapeles', 'ok');
  } catch(e) {
    document.execCommand('copy');
    segToast('Resumen copiado', 'ok');
  }
}

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

  // Cargar profesionales internos (para los selects)
  segDerCargarProfesionales();
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
      segDerActualizarHeroChips(); // actualizar chips del hero con datos reales
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
        '<span>Arrastra un problema aquí · Click en el chip para asignar profesionales</span>' +
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
      'data-seg-tooltip="Click para asignar profesionales" ' +
      'onclick="segDerSeleccionarChipEl(this)">' +
      '<div class="seg-der-chip-top">' +
        '<span class="seg-der-chip-nombre">' + segEscape(nombre) + '</span>' +
        (intens
          ? '<span class="seg-der-chip-badge" style="background:' + bgColor + ';color:' + txColor + '">' + intens + '</span>'
          : '<span class="seg-der-chip-badge" style="background:#e5e7eb;color:#9ca3af">·</span>') +
        '<span class="seg-der-chip-quitar" ' +
          'onclick="event.stopPropagation();segDerQuitarDelPanelDirect(this)" ' +
          'data-nombre="' + segEscape(nombre) + '" ' +
          'data-seg-tooltip="Quitar del panel de derivaciones">' +
          '<i class="fas fa-times"></i>' +
        '</span>' +
      '</div>' +
      '<div class="seg-der-chip-profs">' + segEscape(profsTxt) + '</div>' +
    '</div>';
  }).join('');

  var addBtn = '';  // Drop sobre el cuadro violeta ya es suficiente

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

  // Mostrar confirm inline debajo del chip
  var chip = btn.closest('.seg-der-chip');
  if (!chip) return;

  // Si ya hay un confirm para este chip, cancelarlo
  var existing = chip.querySelector('.seg-der-panel-confirm');
  if (existing) { existing.remove(); return; }

  // Popover flotante — no ocupa espacio en el layout
  var pop = document.createElement('div');
  pop.className = 'seg-der-panel-confirm';
  var nombreCorto = nombre.length > 35 ? nombre.substring(0, 33) + '…' : nombre;
  pop.innerHTML =
    '<p class="seg-der-panel-confirm-msg">' +
      '<i class="fas fa-exclamation-triangle"></i> ' +
      '¿Quitar <strong>' + segEscape(nombreCorto) + '</strong> del panel?' +
    '</p>' +
    '<div class="seg-der-panel-confirm-btns">' +
      '<button onclick="segDerCerrarPanelConfirm(this)">Cancelar</button>' +
      '<button class="ok" data-nombre="' + segEscape(nombre) + '" onclick="segDerQuitarPanelConfirmado(this)">Quitar</button>' +
    '</div>';

  // Anclar al chip — mismo ancho
  var rect = chip.getBoundingClientRect();
  pop.style.position = 'fixed';
  pop.style.top      = (rect.bottom + 4) + 'px';
  pop.style.left     = rect.left + 'px';
  pop.style.width    = Math.max(rect.width, 240) + 'px';
  pop.style.zIndex   = '200';
  document.body.appendChild(pop);

  // Cerrar al click fuera
  setTimeout(function() {
    document.addEventListener('click', function _close(e) {
      if (!pop.contains(e.target) && e.target !== btn) {
        pop.remove();
        document.removeEventListener('click', _close);
      }
    });
  }, 10);
}

function segDerCerrarPanelConfirm(btn) {
  var pop = btn.closest('.seg-der-panel-confirm');
  if (pop) pop.remove();
}

function segDerQuitarPanelConfirmado(btn) {
  var nombre = btn.getAttribute('data-nombre');
  var pop    = btn.closest('.seg-der-panel-confirm');
  if (pop) pop.remove();
  _segDerQuitarDelPanelExec(nombre);
}

function _segDerQuitarDelPanelExec(nombre) {
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
   HERO CHIPS — subline con profesional asignado
───────────────────────────────────────── */
function segDerActualizarHeroChips() {
  var nombres = _segChips ? _segChips.trabajar || [] : [];
  nombres.forEach(function(nombre) {
    var ders = _segDer.derivaciones[nombre] || [];
    if (ders.length) {
      // Construir subline con todos los profesionales (abreviados)
      var profs = ders.map(function(d) {
        var n     = d.profesional_nombre || '';
        var parts = n.split(' ');
        var abrev = parts.length > 1 ? parts[0].charAt(0) + '. ' + parts.slice(1).join(' ') : n;
        return abrev + (d.tipo === 'externo' ? ' (ext)' : '');
      });
      _segDerAsignaciones[nombre] = {
        profesional: profs.join(' · '),
        servicio:    '',
      };
    } else {
      _segDerAsignaciones[nombre] = { profesional: 'Sin asignar', servicio: '' };
    }
  });
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
  var dot    = document.getElementById('seg-der-detail-dot');
  var title  = document.getElementById('seg-der-detail-nombre');
  var codigo = document.getElementById('seg-der-detail-codigo');
  if (dot) dot.style.color = color;
  // Separar código entre paréntesis al final: "Nombre largo (A07.8)" → "Nombre largo" + "(A07.8)"
  var matchCod = nombre.match(/^(.*?)\s*(\([^)]+\))\s*$/);
  if (matchCod) {
    if (title)  title.textContent  = matchCod[1];
    if (codigo) codigo.textContent = matchCod[2];
  } else {
    if (title)  title.textContent  = nombre;
    if (codigo) codigo.textContent = '';
  }

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
        'data-id="' + segEscape(d._id) + '" ' +
        'data-nombre="' + segEscape(d.profesional_nombre) + '" ' +
        'onclick="segDerConfirmarQuitarEl(this)" ' +
        'data-seg-tooltip="Quitar derivación">' +
        '<i class="fas fa-trash"></i></div>'
      : '';

    var confirm = !d.es_responsable
      ? '<div class="seg-der-confirm" id="seg-der-confirm-' + d._id + '">' +
          '<div class="seg-der-confirm-msg"><i class="fas fa-exclamation-triangle"></i>' +
          '¿Quitar la derivación a <strong>' + segEscape(d.profesional_nombre) + '</strong>? ' +
          'Se eliminará el vínculo con este problema.</div>' +
          '<div class="seg-der-confirm-btns">' +
            '<button class="seg-der-confirm-cancel" ' +
              'data-id="' + segEscape(d._id) + '" ' +
              'onclick="segDerCancelarConfirmEl(this)">Cancelar</button>' +
            '<button class="seg-der-confirm-ok" ' +
              'data-id="' + segEscape(d._id) + '" ' +
              'onclick="segDerEliminarEl(this)">Quitar</button>' +
          '</div>' +
        '</div>'
      : '';

    return '<div class="seg-der-card" ' +
      'data-seg-tooltip="' + segEscape(d.profesional_nombre) + (d.area_nombre ? ' · ' + d.area_nombre : '') + '">' +
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
  segDerDdRenderizarArea(areas);
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
      return '<option value="' + segEscape(p._id) + '" data-nombre="' + segEscape(p.nombre) + '">' +
        segEscape(p.nombre) + '</option>';
    }).join('');
  segDerDdRenderizarProf(filtrados);
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
      segDerActualizarHeroChips();
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
      segDerActualizarHeroChips();
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
// Wrappers that read from data attributes
function segDerConfirmarQuitarEl(btn) {
  var id     = btn.getAttribute('data-id');
  var nombre = btn.getAttribute('data-nombre');
  segDerConfirmarQuitar(btn, id, nombre);
}
function segDerCancelarConfirmEl(btn) {
  var id = btn.getAttribute('data-id');
  segDerCancelarConfirm(id);
}
function segDerEliminarEl(btn) {
  var id = btn.getAttribute('data-id');
  segDerEliminar(id);
}

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
      segDerActualizarHeroChips();
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

function _segDerResumenTextoPlano() {
  var cuerpo = document.getElementById('seg-der-resumen-texto');
  if (!cuerpo) return '';
  var texto = '';
  cuerpo.childNodes.forEach(function(n) {
    if (n.nodeType === 1) {
      var t = n.textContent.trim();
      if (n.tagName === 'DIV' && n.style && n.style.textTransform === 'uppercase') {
        texto += '\n' + t + '\n';
      } else {
        texto += t + '\n';
      }
    }
  });
  return texto.trim();
}

function _segDerGenerarResumenPDF(callback) {
  var cuerpo = document.getElementById('seg-der-resumen-texto');
  if (!cuerpo) { segToast('Sin contenido para generar PDF', 'warn'); return; }

  function buildPDF() {
    var jsPDF = window.jspdf && window.jspdf.jsPDF;
    if (!jsPDF) { segToast('Error cargando jsPDF', 'error'); return; }

    var doc      = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    var pageW    = doc.internal.pageSize.getWidth();
    var margin   = 18;
    var maxW     = pageW - margin * 2;
    var y        = 20;
    var chip     = _segDer.chipActivo || 'Derivación';

    // Header
    doc.setFillColor(245, 240, 255);
    doc.rect(0, 0, pageW, 22, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(90, 33, 182);
    doc.text('Informe de Derivación', margin, 14);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(107, 114, 128);
    doc.text(chip, margin, 19.5);
    y = 30;

    // Parsear nodos del div renderizado
    cuerpo.childNodes.forEach(function(n) {
      if (n.nodeType !== 1) return;
      var t = n.textContent.trim();
      if (!t) return;

      if (n.tagName === 'DIV' && n.style && n.style.textTransform === 'uppercase') {
        // Título de sección
        if (y > 20) y += 4;
        doc.setDrawColor(200, 200, 200);
        doc.line(margin, y, pageW - margin, y);
        y += 5;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(125, 132, 193);
        doc.text(t.toUpperCase(), margin, y);
        y += 5;
      } else if (n.tagName === 'DIV') {
        // Línea "Campo: Valor"
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        var ci = t.indexOf(': ');
        if (ci !== -1 && ci < 35) {
          var label = t.substring(0, ci + 1);
          var valor = t.substring(ci + 2);
          doc.setTextColor(107, 114, 128);
          doc.text(label, margin, y);
          var lw = doc.getTextWidth(label + ' ');
          doc.setTextColor(55, 65, 81);
          doc.setFont('helvetica', 'bold');
          var lines = doc.splitTextToSize(valor, maxW - lw);
          doc.text(lines, margin + lw, y);
          doc.setFont('helvetica', 'normal');
          y += lines.length * 4.5;
        } else {
          doc.setTextColor(55, 65, 81);
          var lines = doc.splitTextToSize(t, maxW);
          doc.text(lines, margin, y);
          y += lines.length * 4.5;
        }
      } else if (n.tagName === 'P') {
        // Párrafo
        y += 2;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(55, 65, 81);
        var lines = doc.splitTextToSize(t, maxW);
        lines.forEach(function(line) {
          if (y > 275) { doc.addPage(); y = 20; }
          doc.text(line, margin, y);
          y += 5;
        });
        y += 2;
      }
      if (y > 275) { doc.addPage(); y = 20; }
    });

    // Footer
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(156, 163, 175);
    doc.text('Generado por Heavensy', margin, 287);

    var b64 = doc.output('datauristring').split(',')[1];
    callback(b64);
  }

  if (window.jspdf && window.jspdf.jsPDF) {
    buildPDF();
  } else {
    var s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    s.onload = buildPDF;
    s.onerror = function() { segToast('Error cargando jsPDF', 'error'); };
    document.head.appendChild(s);
  }
}

function segDerResumenEnviarWA() {
  var chip = _segDer.chipActivo || 'derivacion';
  var filename = 'resumen_derivacion_' + chip.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30) + '.pdf';
  segToast('Generando PDF...', 'info');
  _segDerGenerarResumenPDF(function(b64) {
    segFetch(
      '/api/seguimiento/clientes/' + SEG.clienteId + '/derivaciones/resumen-ia/enviar',
      { method: 'POST', body: JSON.stringify({
        canal: 'whatsapp', pdf_base64: b64,
        filename: filename, company_id: SEG.companyId
      })},
      function(data) {
        if (data && data.ok) segToast('PDF enviado por WhatsApp', 'ok');
        else segToast((data && data.error) || 'Error enviando por WhatsApp', 'error');
      },
      function() { segToast('Error enviando por WhatsApp', 'error'); }
    );
  });
}

function segDerResumenEnviarEmail() {
  var chip = _segDer.chipActivo || 'derivacion';
  var filename = 'resumen_derivacion_' + chip.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30) + '.pdf';
  var emailCtx = (SEG.contexto && SEG.contexto.cliente && SEG.contexto.cliente.email) || '';

  function doEnviar(email) {
    segToast('Generando PDF...', 'info');
    _segDerGenerarResumenPDF(function(b64) {
      segFetch(
        '/api/seguimiento/clientes/' + SEG.clienteId + '/derivaciones/resumen-ia/enviar',
        { method: 'POST', body: JSON.stringify({
          canal: 'email', pdf_base64: b64,
          filename: filename, email: email, company_id: SEG.companyId
        })},
        function(data) {
          if (data && data.ok) segToast('PDF enviado por email', 'ok');
          else segToast((data && data.error) || 'Error enviando por email', 'error');
        },
        function() { segToast('Error enviando por email', 'error'); }
      );
    });
  }

  if (emailCtx) {
    doEnviar(emailCtx);
  } else {
    segPrompt('Email del destinatario:', function(email) {
      if (email && email.indexOf('@') !== -1) doEnviar(email);
      else segToast('Email inválido', 'warn');
    });
  }
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

function segDerResumenIA() {
  if (!_segDer.chipActivo) { segToast('Selecciona un problema primero', 'warn'); return; }
  var chip    = _segDer.chipActivo;
  var overlay = document.getElementById('seg-der-resumen-overlay');
  var sub     = document.getElementById('seg-der-resumen-subtitulo');
  var loading = document.getElementById('seg-der-resumen-loading');
  var cuerpo  = document.getElementById('seg-der-resumen-texto');

  // Abrir modal con estado de carga
  if (sub)     sub.textContent = chip;
  if (loading) { loading.style.display = ''; }
  if (cuerpo)  { cuerpo.style.display = 'none'; cuerpo.innerHTML = ''; }
  if (overlay) overlay.classList.remove('seg-hidden');

  segFetch(
    '/api/seguimiento/clientes/' + SEG.clienteId + '/derivaciones/resumen-ia',
    { method: 'POST', body: JSON.stringify({ chip: chip, company_id: SEG.companyId }) },
    function(data) {
      if (!data || !data.ok) {
        segToast(data.error || 'Error al generar resumen', 'error');
        if (overlay) overlay.classList.add('seg-hidden');
        return;
      }
      if (sub) sub.textContent = chip + ' · ' + (data.total_registros || '') + ' sesiones';

      // Renderizar informe estructurado — parsear secciones
      if (cuerpo && data.resumen) {
        var lineas     = data.resumen.split('\n');
        var html       = '';
        var bufP       = [];
        var primerTit  = true;

        function flushP() {
          var txt = bufP.join(' ').trim();
          if (txt) html += '<p style="margin:0 0 10px">' + segEscape(txt) + '</p>';
          bufP = [];
        }

        lineas.forEach(function(linea) {
          var t = linea.trim();
          if (!t) { flushP(); return; }
          // Título: toda la línea en mayúsculas, 4+ chars, no empieza con número
          if (t === t.toUpperCase() && t.replace(/[^A-ZÁÉÍÓÚÑ ]/gi,'').length >= 4 && !/^[0-9]/.test(t)) {
            flushP();
            var bord = primerTit ? 'padding-top:0' :
              'padding-top:12px;border-top:0.5px solid #e8ecf5';
            primerTit = false;
            html += '<div style="font-size:9px;font-weight:700;color:#7D84C1;text-transform:uppercase;' +
                    'letter-spacing:.05em;margin:0 0 8px;' + bord + '">' + segEscape(t) + '</div>';
          } else if (t.indexOf(': ') !== -1 && t.indexOf(': ') < 35) {
            // Línea tipo "Campo: Valor"
            flushP();
            var ci    = t.indexOf(': ');
            var label = t.substring(0, ci).trim();
            var valor = t.substring(ci + 2).trim();
            html += '<div style="font-size:11px;color:#6b7280;margin-bottom:3px">' +
                    segEscape(label) + ': <span style="color:#374151;font-weight:500">' +
                    segEscape(valor) + '</span></div>';
          } else {
            bufP.push(t);
          }
        });
        flushP();
        cuerpo.innerHTML = html;
        cuerpo.style.display = '';
      }
      if (loading) loading.style.display = 'none';
    },
    function() {
      segToast('Error al generar resumen IA', 'error');
      if (overlay) overlay.classList.add('seg-hidden');
    }
  );
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
/* ─────────────────────────────────────────
   CUSTOM DROPDOWNS — área y profesional
───────────────────────────────────────── */
function segDerDdToggle(tipo) {
  var listId = tipo === 'area' ? 'seg-der-dd-area-list' : 'seg-der-dd-prof-list';
  var chevId = tipo === 'area' ? 'seg-der-dd-area-chev' : 'seg-der-dd-prof-chev';
  var btnId  = tipo === 'area' ? 'seg-der-dd-area-btn'  : 'seg-der-dd-prof-btn';
  var list   = document.getElementById(listId);
  var chev   = document.getElementById(chevId);
  var btn    = document.getElementById(btnId);
  if (!list) return;
  var isOpen = !list.classList.contains('seg-hidden');
  // Cerrar ambos primero
  ['seg-der-dd-area-list','seg-der-dd-prof-list'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.classList.add('seg-hidden');
  });
  ['seg-der-dd-area-chev','seg-der-dd-prof-chev'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.style.transform = '';
  });
  ['seg-der-dd-area-btn','seg-der-dd-prof-btn'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.classList.remove('open');
  });
  if (!isOpen) {
    list.classList.remove('seg-hidden');
    if (chev) chev.style.transform = 'rotate(180deg)';
    if (btn)  btn.classList.add('open');
    // Enfocar buscador al abrir
    var searchEl = document.getElementById(tipo === 'area' ? 'seg-der-dd-area-search' : 'seg-der-dd-prof-search');
    if (searchEl) { searchEl.value = ''; segDerDdFiltrar(tipo); setTimeout(function(){ searchEl.focus(); }, 30); }
    // Cerrar al click fuera
    setTimeout(function() {
      document.addEventListener('click', function _close(e) {
        var wrap = document.getElementById(tipo === 'area' ? 'seg-der-dd-area-wrap' : 'seg-der-dd-prof-wrap');
        if (wrap && !wrap.contains(e.target)) {
          list.classList.add('seg-hidden');
          if (chev) chev.style.transform = '';
          if (btn)  btn.classList.remove('open');
          document.removeEventListener('click', _close);
        }
      });
    }, 10);
  }
}

function segDerDdRenderizarArea(areas) {
  var list  = document.getElementById('seg-der-dd-area-list');
  var label = document.getElementById('seg-der-dd-area-label');
  if (!list) return;
  list.innerHTML =
    '<div class="seg-der-dd-search-wrap">' +
      '<i class="fas fa-search"></i>' +
      '<input class="seg-der-dd-search" id="seg-der-dd-area-search" type="text" placeholder="Buscar..." autocomplete="off" ' +
        'oninput="segDerDdFiltrar(\'area\')">' +
    '</div>' +
    '<div id="seg-der-dd-area-opts">' +
      areas.map(function(a) {
        return '<div class="seg-der-dd-opt" data-val="' + segEscape(a) + '" data-label="' + segEscape(a) + '" onclick="segDerDdSelAreaEl(this)">' +
          '<span class="seg-der-dd-dot"></span>' + segEscape(a) + '</div>';
      }).join('') +
    '</div>';
  var curVal = (document.getElementById('seg-der-sel-area') || {}).value || '';
  if (!curVal && label) label.textContent = '— área / servicio —';
}
function segDerDdRenderizarProf(profs) {
  var list  = document.getElementById('seg-der-dd-prof-list');
  var label = document.getElementById('seg-der-dd-prof-label');
  if (!list) return;
  list.innerHTML =
    '<div class="seg-der-dd-search-wrap">' +
      '<i class="fas fa-search"></i>' +
      '<input class="seg-der-dd-search" id="seg-der-dd-prof-search" type="text" placeholder="Buscar..." autocomplete="off" ' +
        'oninput="segDerDdFiltrar(\'prof\')">' +
    '</div>' +
    '<div id="seg-der-dd-prof-opts">' +
      profs.map(function(p) {
        return '<div class="seg-der-dd-opt" data-val="' + segEscape(p._id) + '" data-label="' + segEscape(p.nombre) + '" onclick="segDerDdSelProfEl(this)">' +
          '<span class="seg-der-dd-dot"></span>' + segEscape(p.nombre) + '</div>';
      }).join('') +
    '</div>';
  if (label) label.textContent = '— profesional —';
}
function segDerDdFiltrar(tipo) {
  var inputId = tipo === 'area' ? 'seg-der-dd-area-search' : 'seg-der-dd-prof-search';
  var optsId  = tipo === 'area' ? 'seg-der-dd-area-opts'   : 'seg-der-dd-prof-opts';
  var input   = document.getElementById(inputId);
  var opts    = document.getElementById(optsId);
  if (!input || !opts) return;
  var q = input.value.toLowerCase().trim();
  var items = opts.querySelectorAll('.seg-der-dd-opt');
  var visible = 0;
  items.forEach(function(item) {
    var match = item.getAttribute('data-label').toLowerCase().indexOf(q) !== -1;
    item.style.display = match ? '' : 'none';
    if (match) visible++;
  });
  var empty = opts.querySelector('.seg-der-dd-empty');
  if (visible === 0) {
    if (!empty) {
      var e = document.createElement('div');
      e.className = 'seg-der-dd-empty';
      e.textContent = 'Sin resultados';
      opts.appendChild(e);
    }
  } else {
    if (empty) empty.remove();
  }
}

function segDerDdSelAreaEl(el) {
  segDerDdSelArea(el.getAttribute('data-val') || '', el.getAttribute('data-label') || '');
}

function segDerDdSelProfEl(el) {
  segDerDdSelProf(el.getAttribute('data-val') || '', el.getAttribute('data-label') || '');
}

function segDerDdSelArea(val, label) {
  var sel = document.getElementById('seg-der-sel-area');
  var lbl = document.getElementById('seg-der-dd-area-label');
  var list = document.getElementById('seg-der-dd-area-list');
  var chev = document.getElementById('seg-der-dd-area-chev');
  var btn  = document.getElementById('seg-der-dd-area-btn');
  if (sel) { sel.value = val; sel.dispatchEvent(new Event('change')); }
  if (lbl) lbl.textContent = label;
  if (list) {
    list.querySelectorAll('.seg-der-dd-opt').forEach(function(o) {
      o.classList.toggle('selected', o.textContent.trim() === label && val !== '');
    });
    list.classList.add('seg-hidden');
  }
  if (chev) chev.style.transform = '';
  if (btn)  btn.classList.remove('open');
}

function segDerDdSelProf(val, label) {
  var sel  = document.getElementById('seg-der-sel-prof');
  var lbl  = document.getElementById('seg-der-dd-prof-label');
  var list = document.getElementById('seg-der-dd-prof-list');
  var chev = document.getElementById('seg-der-dd-prof-chev');
  var btn  = document.getElementById('seg-der-dd-prof-btn');
  if (sel) sel.value = val;
  if (lbl) lbl.textContent = label;
  if (list) {
    list.querySelectorAll('.seg-der-dd-opt').forEach(function(o) {
      o.classList.toggle('selected', o.textContent.trim() === label && val !== '');
    });
    list.classList.add('seg-hidden');
  }
  if (chev) chev.style.transform = '';
  if (btn)  btn.classList.remove('open');
}