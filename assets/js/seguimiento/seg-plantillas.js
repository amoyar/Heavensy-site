/* ═══════════════════════════════════════════════════════
   SEGUIMIENTO — seg-plantillas.js
   Builder de plantillas notas. Campos fijos, formulario inline, drag & drop, vista previa, auditoría, datepicker/dropdown custom, socket timeline.
═══════════════════════════════════════════════════════ */

/* ══════════════════════════════════════════════════════
   PLANTILLA NOTAS CLÍNICAS — FORM BUILDER (Puntos 3, 4, 5)
══════════════════════════════════════════════════════ */
var _segPn = {
  campos:     [],    // [{tipo, label, opciones, fijo}]
  editId:     null,
  formActivo: null,
  layout:     [],   // [{fila:[idx,...]}] — orden y agrupación de campos
};

// Estado por campo para los date pickers del formulario de plantilla
// { idx: { anio, mes, fechaSel } }
var _segPnFormDp = {};

function segNuevaPlantillaNotas(plantillaId) {
  _segPn.campos = [];
  _segPn.layout = [];
  _segPn.editId = plantillaId || null;

  if (plantillaId) {
    var lista = SEG._plantillas['notas'] || [];
    var p = lista.find(function(x) { return (x._id || x.id) === plantillaId; });
    if (p) {
      _segPn.campos = (p.campos || []).map(function(c) {
        return { tipo: c.tipo, label: c.label || '', opciones: c.opciones || '', fijo: !!c.fijo };
      });
      _segPn.layout = (p.layout || []).map(function(f) { return { fila: f.fila.slice() }; });
      if (!_segPn.layout.length) _segPnRecalcLayout();
      document.getElementById('seg-pn-nombre').value = p.nombre || '';
      document.getElementById('seg-pn-modal-titulo').textContent = 'Editar plantilla';
    }
  } else {
    document.getElementById('seg-pn-nombre').value = '';
    document.getElementById('seg-pn-modal-titulo').textContent = 'Nueva plantilla de notas';
  }

  segPnRenderCampos();
  segPnRenderPreview();
  document.getElementById('seg-pn-modal').classList.remove('seg-hidden');
  setTimeout(function() { document.getElementById('seg-pn-nombre').focus(); }, 80);
}

function segPnCerrar() {
  document.getElementById('seg-pn-modal').classList.add('seg-hidden');
  _segPn.campos = [];
  _segPn.layout = [];
  _segPn.editId = null;
}

/* ── Punto 3: Agregar campo SIN label pre-relleno ── */
function segPnAgregarCampo(tipo) {
  // label vacío — el placeholder del input pide al usuario que lo rellene
  _segPn.campos.push({ tipo: tipo, label: '', opciones: '', fijo: false });
  segPnRenderCampos();
  segPnRenderPreview();
  // Foco en el último input de label agregado
  setTimeout(function() {
    var inputs = document.querySelectorAll('#seg-pn-campos-wrap .seg-pn-campo-label-input');
    if (inputs.length) inputs[inputs.length - 1].focus();
  }, 50);
}

function segPnEliminarCampo(idx) {
  _segPn.campos.splice(idx, 1);
  // Actualizar layout: quitar el índice eliminado y decrementar los superiores
  _segPn.layout = _segPn.layout.map(function(f) {
    return { fila: f.fila
      .filter(function(i) { return i !== idx; })
      .map(function(i) { return i > idx ? i - 1 : i; })
    };
  }).filter(function(f) { return f.fila.length > 0; });
  segPnRenderCampos();
  segPnRenderPreview();
}

function segPnCampoLabelChange(idx, val) {
  if (_segPn.campos[idx] !== undefined) _segPn.campos[idx].label = val;
  segPnRenderPreview();
}

function segPnCampoOpcionesChange(idx, val) {
  if (_segPn.campos[idx] !== undefined) _segPn.campos[idx].opciones = val;
  segPnRenderPreview();
}

function segPnCampoFijoChange(idx, checked) {
  if (_segPn.campos[idx] !== undefined) _segPn.campos[idx].fijo = !!checked;
}

/* ── Renderizar campos en el builder ── */
function segPnRenderCampos() {
  var wrap = document.getElementById('seg-pn-campos-wrap');
  if (!wrap) return;
  if (!_segPn.campos.length) {
    wrap.innerHTML = '<div style="font-size:12px;color:#9ca3af;padding:6px 0">Aún no hay campos. Agrégalos con los botones de abajo.</div>';
    _segPn.layout = [];
    return;
  }
  // Sincronizar layout con campos actuales
  _segPnSyncLayout();

  var tipoLabels = { 'texto-corto': 'Texto corto', 'texto-largo': 'Texto largo',
    'numero': 'Número', 'selector': 'Selector', 'fecha': 'Fecha' };

  // Renderizar por filas
  var html = '';
  _segPn.layout.forEach(function(fila, fi) {
    var esFilaMulti = fila.fila.length > 1;
    html += '<div class="seg-pn-layout-fila' + (esFilaMulti ? ' seg-pn-layout-fila--multi' : '') + '" data-fila="' + fi + '"' +
      ' ondragover="event.preventDefault();segPnDragOverFila(event,' + fi + ')"' +
      ' ondrop="segPnDropEnFila(event,' + fi + ')">';
    fila.fila.forEach(function(ci) {
      var c = _segPn.campos[ci];
      if (!c) return;
      var esSelector = c.tipo === 'selector';
      html += '<div class="seg-pn-campo-item" draggable="true" data-ci="' + ci + '"' +
        ' ondragstart="segPnDragStart(event,' + ci + ')"' +
        ' ondragend="segPnDragEnd(event)">' +
        '<i class="fas fa-grip-vertical seg-pn-campo-drag"></i>' +
        '<div class="seg-pn-campo-body">' +
          '<span class="seg-pn-campo-tipo-badge">' + (tipoLabels[c.tipo] || c.tipo) + '</span>' +
          '<input class="seg-pn-campo-label-input" type="text"' +
            ' value="' + segEscape(c.label) + '"' +
            ' placeholder="Ingrese el nombre del campo"' +
            ' oninput="segPnCampoLabelChange(' + ci + ', this.value)">' +
          (esSelector
            ? '<input class="seg-pn-opciones-input" type="text"' +
                ' value="' + segEscape(c.opciones || '') + '"' +
                ' placeholder="Opciones separadas por coma: Leve, Moderado, Grave"' +
                ' oninput="segPnCampoOpcionesChange(' + ci + ', this.value)">'
            : '') +
          '<label class="seg-pn-campo-fijo-wrap" title="Campo fijo: se recuerda entre sesiones">' +
            '<input type="checkbox" class="seg-pn-campo-fijo-chk"' +
              (c.fijo ? ' checked' : '') +
              ' onchange="segPnCampoFijoChange(' + ci + ', this.checked)">' +
            '<i class="fas fa-lock seg-pn-campo-fijo-icon"></i>' +
            '<span>Fijo</span>' +
          '</label>' +
        '</div>' +
        '<button class="seg-pn-campo-del" onclick="segPnEliminarCampo(' + ci + ')" data-seg-tooltip="Eliminar campo">' +
          '<i class="fas fa-times"></i>' +
        '</button>' +
      '</div>';
    });
    // Zona de drop para agregar a esta fila (si tiene 1 campo y no es texto-largo)
    var ci0 = fila.fila[0];
    var c0  = _segPn.campos[ci0];
    if (fila.fila.length === 1 && c0 && c0.tipo !== 'texto-largo') {
      html += '<div class="seg-pn-drop-aqui" ' +
        'ondragover="event.preventDefault();this.classList.add(\'hover\')" ' +
        'ondragleave="this.classList.remove(\'hover\')" ' +
        'ondrop="segPnDropEnFila(event,' + fi + ');this.classList.remove(\'hover\')">' +
        '<i class="fas fa-plus"></i>' +
      '</div>';
    }
    html += '</div>';
  });
  wrap.innerHTML = html;
}

/* ── Helpers de layout ── */

function _segPnLayoutDefault() {
  // Cada campo en su propia fila
  return _segPn.campos.map(function(c, i) { return { fila: [i] }; });
}

function _segPnRecalcLayout() {
  _segPn.layout = _segPnLayoutDefault();
}

function _segPnSyncLayout() {
  // Asegurar que todos los campos tienen una fila en el layout
  var enLayout = [];
  _segPn.layout.forEach(function(f) { f.fila.forEach(function(i) { enLayout.push(i); }); });
  // Agregar campos nuevos al final
  _segPn.campos.forEach(function(c, i) {
    if (enLayout.indexOf(i) === -1) {
      _segPn.layout.push({ fila: [i] });
    }
  });
  // Limpiar índices de campos eliminados
  _segPn.layout = _segPn.layout.map(function(f) {
    return { fila: f.fila.filter(function(i) { return i < _segPn.campos.length; }) };
  }).filter(function(f) { return f.fila.length > 0; });
}

/* ── Drag & Drop en el builder ── */
var _segDnD = { ci: null }; // índice del campo siendo arrastrado

function segPnDragStart(ev, ci) {
  _segDnD.ci = ci;
  ev.dataTransfer.effectAllowed = 'move';
  ev.currentTarget.classList.add('seg-pn-dragging');
}

function segPnDragEnd(ev) {
  _segDnD.ci = null;
  document.querySelectorAll('.seg-pn-campo-item').forEach(function(el) {
    el.classList.remove('seg-pn-dragging');
  });
  document.querySelectorAll('.seg-pn-layout-fila').forEach(function(el) {
    el.classList.remove('seg-pn-drag-over');
  });
}

function segPnDragOverFila(ev, fi) {
  ev.preventDefault();
  document.querySelectorAll('.seg-pn-layout-fila').forEach(function(el) {
    el.classList.remove('seg-pn-drag-over');
  });
  var filaEl = document.querySelector('.seg-pn-layout-fila[data-fila="' + fi + '"]');
  if (filaEl) filaEl.classList.add('seg-pn-drag-over');
}

function segPnDropEnFila(ev, fiDestino) {
  ev.preventDefault();
  var ciSrc = _segDnD.ci;
  if (ciSrc === null) return;

  // Encontrar fila origen
  var fiOrigen = -1;
  _segPn.layout.forEach(function(f, fi) {
    if (f.fila.indexOf(ciSrc) !== -1) fiOrigen = fi;
  });
  if (fiOrigen === -1) return;

  var cSrc = _segPn.campos[ciSrc];

  if (fiOrigen === fiDestino) return; // misma fila, nada que hacer

  // Quitar de fila origen
  _segPn.layout[fiOrigen].fila = _segPn.layout[fiOrigen].fila.filter(function(i) { return i !== ciSrc; });
  if (_segPn.layout[fiOrigen].fila.length === 0) {
    _segPn.layout.splice(fiOrigen, 1);
    // Ajustar índice destino si era posterior al origen
    if (fiDestino > fiOrigen) fiDestino--;
  }

  // Agregar a fila destino (máx 2 por fila, no texto-largo)
  var filaDest = _segPn.layout[fiDestino];
  if (filaDest && filaDest.fila.length < 2 && cSrc.tipo !== 'texto-largo') {
    filaDest.fila.push(ciSrc);
  } else {
    // Crear nueva fila antes de la destino
    _segPn.layout.splice(fiDestino, 0, { fila: [ciSrc] });
  }

  // Limpiar filas vacías
  _segPn.layout = _segPn.layout.filter(function(f) { return f.fila.length > 0; });

  segPnRenderCampos();
  segPnRenderPreview();
}




var _segCamposFijosActuales = {}; // { label: valor } cargados desde BD

function segCargarCamposFijos(plantillaId, plantilla, soloMemoria) {
  // soloMemoria=true: solo carga _segCamposFijosActuales sin tocar el DOM
  // (cuando ya se restauraron valores del historial)
  segFetch('/api/seguimiento/clientes/' + SEG.clienteId + '/campos-fijos/' + plantillaId +
    '?company_id=' + SEG.companyId, {},
    function(data) {
      _segCamposFijosActuales = data.campos || {};
      if (soloMemoria) return; // No sobreescribir DOM si viene del historial
      // Poblar campos fijos con valores de BD solo en sesión nueva
      (plantilla.campos || []).forEach(function(c, i) {
        if (!c.fijo) return;
        var val    = _segCamposFijosActuales[c.label] || '';
        var valEl  = document.getElementById('seg-pn-fijo-val-' + i);
        var hidEl  = document.getElementById('seg-pn-form-f-' + i);
        var display = _segFijoFormatDisplay(val, c.tipo);
        if (valEl) valEl.textContent = display || '—';
        if (hidEl) hidEl.value = val;
      });
    },
    function() {} // silencioso si falla
  );
}

function _segFijoFormatDisplay(val, tipo) {
  if (!val) return '';
  if (tipo === 'fecha') {
    try {
      var d = new Date(val + 'T12:00:00');
      if (isNaN(d.getTime())) return val;
      return String(d.getDate()).padStart(2,'0') + '/' +
             String(d.getMonth()+1).padStart(2,'0') + '/' +
             d.getFullYear();
    } catch(e) { return val; }
  }
  return val;
}

function segPnFijoEditar(idx) {
  var lista = SEG._plantillas['notas'] || [];
  var p = lista.find(function(x) { return String(x._id || x.id).trim() === String(_segPn.formActivo).trim(); });
  if (!p) return;
  var c      = p.campos[idx];
  var wrap   = document.getElementById('seg-pn-fijo-wrap-' + idx);
  var valEl  = document.getElementById('seg-pn-fijo-val-' + idx);
  var hidEl  = document.getElementById('seg-pn-form-f-' + idx);
  if (!wrap || !c) return;

  // Si ya está en modo edición, no abrir de nuevo
  if (wrap.classList.contains('editando')) return;
  wrap.classList.add('editando');

  var actual = (hidEl ? hidEl.value : '') || '';

  function _guardarFijo(nuevoVal) {
    nuevoVal = (nuevoVal || '').trim();
    // Actualizar memoria primero
    if (!_segCamposFijosActuales) _segCamposFijosActuales = {};
    _segCamposFijosActuales[c.label] = nuevoVal;
    // Restaurar wrap con el nuevo valor (usa referencias DOM frescas)
    _segPnFijoRestaurarWrapConValor(idx, nuevoVal, c.tipo);
    // Guardar en BD solo si cambió
    if (nuevoVal === actual) return;
    segFetch('/api/seguimiento/clientes/' + SEG.clienteId +
      '/campos-fijos/' + _segPn.formActivo + '/' + encodeURIComponent(c.label), {
        method: 'PUT',
        body: JSON.stringify({ valor: nuevoVal, plantilla_nombre: p.nombre, company_id: SEG.companyId })
      },
      function() { segToast('Campo guardado', 'success'); },
      function() { segToast('Error al guardar campo fijo', 'error'); }
    );
    segMarcarCambios();
  }

  if (c.tipo === 'selector') {
    var opciones = (c.opciones || '').split(',').map(function(o){return o.trim();}).filter(Boolean);
    // Reemplazar contenido del wrap con select inline
    wrap.innerHTML =
      '<select class="seg-pn-fijo-select" id="seg-pn-fijo-sel-' + idx + '" onchange="segPnFijoConfirmarSel(' + idx + ')">' +
        '<option value="">Seleccionar...</option>' +
        opciones.map(function(o) {
          return '<option value="' + segEscape(o) + '"' + (o === actual ? ' selected' : '') + '>' + segEscape(o) + '</option>';
        }).join('') +
      '</select>' +
      '<button class="seg-pn-fijo-ok-btn" onclick="segPnFijoConfirmarSel(' + idx + ')"><i class="fas fa-check"></i></button>' +
      '<button class="seg-pn-fijo-cancel-btn" onclick="segPnFijoCancelar(' + idx + ')"><i class="fas fa-times"></i></button>';
    window['_segFijoGuardar_' + idx] = _guardarFijo;
    setTimeout(function() { var s = document.getElementById('seg-pn-fijo-sel-' + idx); if (s) s.focus(); }, 30);

  } else if (c.tipo === 'fecha') {
    // Input date inline
    wrap.innerHTML =
      '<input type="date" class="seg-pn-fijo-input" id="seg-pn-fijo-inp-' + idx + '" value="' + segEscape(actual) + '">' +
      '<button class="seg-pn-fijo-ok-btn" onclick="segPnFijoConfirmarInp(' + idx + ')"><i class="fas fa-check"></i></button>' +
      '<button class="seg-pn-fijo-cancel-btn" onclick="segPnFijoCancelar(' + idx + ')"><i class="fas fa-times"></i></button>';
    window['_segFijoGuardar_' + idx] = _guardarFijo;
    setTimeout(function() { var inp = document.getElementById('seg-pn-fijo-inp-' + idx); if (inp) inp.focus(); }, 30);

  } else {
    // texto-corto, texto-largo, numero
    var inputType = c.tipo === 'numero' ? 'number' : 'text';
    if (c.tipo === 'texto-corto' || c.tipo === 'texto-largo') {
      // Usar contenteditable para soportar CIE-10, síntomas, hipótesis
      var minH = c.tipo === 'texto-largo' ? 'min-height:72px;' : '';
      wrap.innerHTML =
        '<div class="seg-pn-form-campo-editor seg-pn-fijo-editor" id="seg-pn-fijo-inp-' + idx + '"' +
          ' contenteditable="true" spellcheck="true"' +
          ' data-placeholder="' + segEscape(c.label) + '..."' +
          ' data-tipo="' + c.tipo + '"' +
          ' style="flex:1;' + minH + '"' +
          ' onkeydown="if(event.key===\'Escape\'){event.preventDefault();segPnFijoCancelar(' + idx + ')}">' +
          segEscape(actual) +
        '</div>' +
        '<button class="seg-pn-fijo-ok-btn" onclick="segPnFijoConfirmarEditor(' + idx + ')"><i class="fas fa-check"></i></button>' +
        '<button class="seg-pn-fijo-cancel-btn" onclick="segPnFijoCancelar(' + idx + ')"><i class="fas fa-times"></i></button>';
      window['_segFijoGuardar_' + idx] = _guardarFijo;
      setTimeout(function() {
        var el = document.getElementById('seg-pn-fijo-inp-' + idx);
        if (el) {
          segInicializarEditorNotas(el);
          // Mover cursor al final
          try {
            var range = document.createRange();
            var sel2 = window.getSelection();
            range.selectNodeContents(el);
            range.collapse(false);
            sel2.removeAllRanges();
            sel2.addRange(range);
          } catch(e2) {}
          el.focus();
        }
      }, 30);
    } else {
      wrap.innerHTML =
        '<input type="' + inputType + '" class="seg-pn-fijo-input" id="seg-pn-fijo-inp-' + idx + '" value="' + segEscape(actual) + '" placeholder="' + segEscape(c.label) + '..."' +
          ' onkeydown="if(event.key===\'Enter\')segPnFijoConfirmarInp(' + idx + ');if(event.key===\'Escape\')segPnFijoCancelar(' + idx + ')">' +
        '<button class="seg-pn-fijo-ok-btn" onclick="segPnFijoConfirmarInp(' + idx + ')"><i class="fas fa-check"></i></button>' +
        '<button class="seg-pn-fijo-cancel-btn" onclick="segPnFijoCancelar(' + idx + ')"><i class="fas fa-times"></i></button>';
      window['_segFijoGuardar_' + idx] = _guardarFijo;
      setTimeout(function() {
        var inp = document.getElementById('seg-pn-fijo-inp-' + idx);
        if (inp) { inp.focus(); inp.select(); }
      }, 30);
    }
  }
}

function segPnFijoConfirmarEditor(idx) {
  // Buscar el editor por ID primero, luego por clase dentro del wrap
  var el   = document.getElementById('seg-pn-fijo-inp-' + idx);
  var wrap = document.getElementById('seg-pn-fijo-wrap-' + idx);
  if (!el && wrap) el = wrap.querySelector('.seg-pn-fijo-editor, [contenteditable="true"]');
  var fn   = window['_segFijoGuardar_' + idx];
  var val  = el ? (el.innerText || el.textContent || '').trim() : '';
  if (fn) fn(val);
  _segPnFijoRestaurarWrap(idx);
}

function segPnFijoConfirmarInp(idx) {
  var inp  = document.getElementById('seg-pn-fijo-inp-' + idx);
  var wrap = document.getElementById('seg-pn-fijo-wrap-' + idx);
  if (!inp && wrap) inp = wrap.querySelector('input[type="number"], input[type="date"], input[type="text"]');
  var fn   = window['_segFijoGuardar_' + idx];
  if (fn) fn(inp ? inp.value : '');
  _segPnFijoRestaurarWrap(idx);
}

function segPnFijoConfirmarSel(idx) {
  var sel = document.getElementById('seg-pn-fijo-sel-' + idx);
  var fn  = window['_segFijoGuardar_' + idx];
  if (fn) fn(sel ? sel.value : '');
  _segPnFijoRestaurarWrap(idx);
}

function segPnFijoCancelar(idx) {
  var wrap  = document.getElementById('seg-pn-fijo-wrap-' + idx);
  var hidEl = document.getElementById('seg-pn-form-f-' + idx);
  if (wrap) wrap.classList.remove('editando');
  _segPnFijoRestaurarWrap(idx);
}

function _segPnFijoRestaurarWrapConValor(idx, val, tipo) {
  var wrap = document.getElementById('seg-pn-fijo-wrap-' + idx);
  if (!wrap) return;
  wrap.classList.remove('editando');
  var display = _segFijoFormatDisplay(val, tipo);
  wrap.innerHTML =
    '<span class="seg-pn-fijo-valor" id="seg-pn-fijo-val-' + idx + '">' + segEscape(display || '—') + '</span>' +
    '<button class="seg-pn-fijo-edit-btn" onclick="segPnFijoEditar(' + idx + ')" title="Editar"><i class="fas fa-pencil-alt"></i></button>' +
    '<input type="hidden" id="seg-pn-form-f-' + idx + '" value="' + segEscape(val || '') + '">';
}

function _segPnFijoRestaurarWrap(idx) {
  // Leer valor desde memoria
  var lista = SEG._plantillas['notas'] || [];
  var p = lista.find(function(x) { return String(x._id || x.id).trim() === String(_segPn.formActivo).trim(); });
  var c = p && p.campos ? p.campos[idx] : null;
  var label = c ? c.label : '';
  var tipo  = c ? c.tipo  : 'texto-corto';
  var val   = (_segCamposFijosActuales && _segCamposFijosActuales[label]) || '';
  _segPnFijoRestaurarWrapConValor(idx, val, tipo);
}


/* ═══════════════════════════════════════════════════════════════
   PANEL DE AUDITORÍA DE CAMPOS FIJOS
═══════════════════════════════════════════════════════════════ */

function segAbrirAuditoriaCampos(plantillaId) {
  var modal = document.getElementById('seg-auditoria-modal');
  if (!modal) return;
  var lista   = document.getElementById('seg-auditoria-lista');
  var titulo  = document.getElementById('seg-auditoria-titulo');
  var p       = (SEG._plantillas['notas'] || []).find(function(x) {
    return String(x._id || x.id).trim() === String(plantillaId).trim();
  });
  if (titulo) titulo.textContent = 'Historial de cambios — ' + (p ? p.nombre : '');
  if (lista)  lista.innerHTML = '<div class="seg-auditoria-loading"><i class="fas fa-spinner fa-spin"></i> Cargando...</div>';
  modal.classList.remove('seg-hidden');

  segFetch('/api/seguimiento/clientes/' + SEG.clienteId + '/auditoria-campos' +
    '?company_id=' + SEG.companyId + '&plantilla_id=' + plantillaId + '&limit=100', {},
    function(data) {
      var registros = data.auditoria || [];
      if (!registros.length) {
        lista.innerHTML = '<div class="seg-auditoria-empty">Sin cambios registrados aún.</div>';
        return;
      }
      lista.innerHTML = '<table class="seg-auditoria-table">' +
        '<thead><tr>' +
          '<th>Fecha</th><th>Campo</th><th>Valor anterior</th><th>Valor nuevo</th><th>Modificado por</th>' +
        '</tr></thead><tbody>' +
        registros.map(function(r) {
          var fecha = r.fecha ? new Date(r.fecha).toLocaleString('es-CL', {
            day:'2-digit', month:'2-digit', year:'numeric',
            hour:'2-digit', minute:'2-digit'
          }) : '—';
          return '<tr>' +
            '<td>' + segEscape(fecha) + '</td>' +
            '<td><strong>' + segEscape(r.campo || '—') + '</strong></td>' +
            '<td class="seg-auditoria-anterior">' + segEscape(r.valor_anterior || '—') + '</td>' +
            '<td class="seg-auditoria-nuevo">' + segEscape(r.valor_nuevo || '—') + '</td>' +
            '<td>' + segEscape(r.modificado_por || '—') + '</td>' +
          '</tr>';
        }).join('') +
        '</tbody></table>';
    },
    function() {
      lista.innerHTML = '<div class="seg-auditoria-empty">Error al cargar historial.</div>';
    }
  );
}

function segCerrarAuditoriaCampos() {
  var modal = document.getElementById('seg-auditoria-modal');
  if (modal) modal.classList.add('seg-hidden');
}


function segPnRenderPreview() {
  var el = document.getElementById('seg-pn-preview');
  if (!el) return;
  if (!_segPn.campos.length) {
    el.innerHTML = '<span class="seg-pn-preview-empty">Agrega campos para ver la vista previa</span>';
    return;
  }

  function _previewCampo(c) {
    var label = c.label || '(sin nombre)';
    var inputHtml = '';
    if (c.tipo === 'texto-corto') {
      inputHtml = '<div class="seg-pn-preview-input">' + segEscape(label) + '...</div>';
    } else if (c.tipo === 'texto-largo') {
      inputHtml = '<div class="seg-pn-preview-textarea"></div>';
    } else if (c.tipo === 'numero') {
      inputHtml = '<div class="seg-pn-preview-input">0</div>';
    } else if (c.tipo === 'selector') {
      var opciones = (c.opciones || '').split(',').map(function(o) { return o.trim(); }).filter(Boolean);
      inputHtml = '<div class="seg-pn-preview-select">' +
        (opciones.length ? segEscape(opciones[0]) : 'Seleccionar...') + ' ▾</div>';
    } else if (c.tipo === 'fecha') {
      inputHtml = '<div class="seg-pn-preview-input">DD-MM-AAAA</div>';
    }
    var fijoTag = c.fijo ? ' <span style="font-size:9px;color:#9961FF">🔒 Fijo</span>' : '';
    return '<div class="seg-pn-preview-campo">' +
      '<div class="seg-pn-preview-label">' + segEscape(label) + fijoTag + '</div>' +
      inputHtml +
    '</div>';
  }

  // Usar layout para mostrar columnas en la preview
  _segPnSyncLayout();
  el.innerHTML = _segPn.layout.map(function(fila) {
    var multi = fila.fila.length > 1;
    var style = multi ? 'display:grid;grid-template-columns:1fr 1fr;gap:8px;' : '';
    return '<div style="' + style + 'margin-bottom:8px">' +
      fila.fila.map(function(ci) {
        var c = _segPn.campos[ci];
        return c ? _previewCampo(c) : '';
      }).join('') +
    '</div>';
  }).join('');
}

/* ── Guardar plantilla ── */
function segPnGuardar() {
  var nombre = (document.getElementById('seg-pn-nombre').value || '').trim();
  if (!nombre) { segToast('Escribe un nombre para la plantilla', 'error'); return; }
  if (!_segPn.campos.length) { segToast('Agrega al menos un campo', 'error'); return; }
  for (var i = 0; i < _segPn.campos.length; i++) {
    if (!(_segPn.campos[i].label || '').trim()) {
      segToast('Completa el nombre de todos los campos', 'error'); return;
    }
  }

  var payload = {
    company_id: SEG.companyId,
    nombre: nombre,
    tipo: 'notas',
    campos: _segPn.campos.map(function(c) {
      return { tipo: c.tipo, label: c.label.trim(), opciones: c.opciones || '', fijo: !!c.fijo };
    }),
    layout: _segPn.layout.length ? _segPn.layout : _segPnLayoutDefault()
  };

  var id = _segPn.editId;
  var url = id ? '/api/seguimiento/plantillas/' + id : '/api/seguimiento/plantillas';
  var method = id ? 'PUT' : 'POST';

  segFetch(url, { method: method, body: JSON.stringify(payload) },
    function(data) {
      if (!SEG._plantillas['notas']) SEG._plantillas['notas'] = [];
      if (id) {
        var lista = SEG._plantillas['notas'];
        var idx = -1;
        lista.forEach(function(x, i) { if ((x._id || x.id) === id) idx = i; });
        if (idx >= 0) lista[idx] = { _id: id, nombre: nombre, campos: payload.campos, layout: payload.layout, tipo: 'notas' };
      } else {
        SEG._plantillas['notas'].push({ _id: data._id || data.id, nombre: nombre, campos: payload.campos, layout: payload.layout, tipo: 'notas' });
      }
      segPnRenderChips();
      segPnCerrar();
      segToast('Plantilla guardada', 'success');
    },
    function() { segToast('Error al guardar la plantilla', 'error'); }
  );
}

/* ── Chips de plantillas notas ── */
function segPnRenderChips() {
  var el = document.getElementById('seg-chips-notas');
  if (!el) return;
  var lista = SEG._plantillas['notas'] || [];
  if (!lista.length) {
    el.innerHTML = '<span class="seg-plantillas-vacio">Aún no tienes plantillas.</span>';
    return;
  }
  el.innerHTML = lista.map(function(p) {
    var pid = p._id || p.id || '';
    var pidEsc = segEscape(pid);
    return '<span class="seg-plantilla-chip" data-id="' + pidEsc + '"' +
      ' onclick="segPnChipToggle(\'' + pidEsc + '\')">' +
      '<i class="fas fa-check seg-chip-check seg-hidden" id="pnchk-' + pidEsc + '"></i>' +
      segEscape(p.nombre) +
      '<span class="seg-chip-actions">' +
        '<i class="fas fa-pencil-alt" onclick="event.stopPropagation();segNuevaPlantillaNotas(\'' + pidEsc + '\')" title="Editar"></i>' +
        '<i class="fas fa-trash" onclick="event.stopPropagation();segPnEliminarPlantilla(\'' + pidEsc + '\')" title="Eliminar"></i>' +
      '</span>' +
    '</span>';
  }).join('');
}

function segPnChipToggle(plantillaId) {
  if (_segPn.formActivo === plantillaId) {
    // Ya está activa → deseleccionar y volver al editor
    segPnFormVolver();
  } else {
    // Abrir esta plantilla
    segPnFormAbrir(plantillaId);
  }
}

function segPnEliminarPlantilla(plantillaId) {
  segConfirm('¿Eliminar esta plantilla?', function() {
    segFetch('/api/seguimiento/plantillas/' + plantillaId,
      { method: 'DELETE', body: JSON.stringify({ company_id: SEG.companyId }) },
      function() {
        SEG._plantillas['notas'] = (SEG._plantillas['notas'] || []).filter(function(x) {
          return (x._id || x.id) !== plantillaId;
        });
        segPnRenderChips();
        // Si el formulario activo era esta plantilla, volver al editor
        if (_segPn.formActivo === plantillaId) segPnFormVolver();
        segToast('Plantilla eliminada', 'success');
      },
      function() { segToast('Error al eliminar', 'error'); }
    );
  });
}

/* ── Punto 4: Formulario inline reemplaza el editor ── */
/* ── Resetear vista al editor por defecto ── */
function segPnResetearVista() {
  _segModoNotas       = 'editor';
  _segCamposPlantilla = [];
  _segPn.formActivo   = null;
  var edWrap  = document.getElementById('seg-notas-editor-wrap');
  var frmWrap = document.getElementById('seg-notas-formulario');
  if (edWrap)  edWrap.classList.remove('seg-hidden');
  if (frmWrap) frmWrap.classList.add('seg-hidden');
  // Quitar marca activa de chips de plantilla
  document.querySelectorAll('#seg-chips-notas .seg-plantilla-chip').forEach(function(chip) {
    chip.classList.remove('used');
    var chk = chip.querySelector('.seg-chip-check');
    if (chk) chk.classList.add('seg-hidden');
  });
}

/* ── Recopilar valores actuales del formulario activo ── */
function _segPnConfirmarFijosAbiertos() {
  // No confirmar si el dropdown CIE-10 está activo
  if (_segDiagMode) return;
  var diagDd = document.getElementById('seg-diag-dropdown');
  if (diagDd && !diagDd.classList.contains('seg-hidden')) return;
  // Si hay algún campo fijo en modo edición, confirmarlo antes de recopilar
  var wraps = document.querySelectorAll('.seg-pn-fijo-wrap.editando');
  wraps.forEach(function(wrap) {
    var idMatch = wrap.id.match(/seg-pn-fijo-wrap-(\d+)/);
    if (!idMatch) return;
    var idx = parseInt(idMatch[1]);
    // Detectar qué tipo de editor está abierto
    var editor = wrap.querySelector('[contenteditable="true"]');
    var input  = wrap.querySelector('input[type="number"], input[type="date"], input[type="text"]');
    var select = wrap.querySelector('select');
    if (editor) {
      segPnFijoConfirmarEditor(idx);
    } else if (select) {
      segPnFijoConfirmarSel(idx);
    } else if (input) {
      segPnFijoConfirmarInp(idx);
    }
  });
}

function segPnRecopilarCampos() {
  if (!_segPn.formActivo) return [];
  var lista = SEG._plantillas['notas'] || [];
  var p = lista.find(function(x) { return (x._id || x.id) === _segPn.formActivo; });
  if (!p || !p.campos) return [];
  return p.campos.map(function(c, i) {
    var val = '';
    if (c.fijo) {
      var wrap = document.getElementById('seg-pn-fijo-wrap-' + i);
      if (wrap && wrap.classList.contains('editando')) {
        // Campo en edición — leer sin cerrar el editor
        var editor = wrap.querySelector('[contenteditable="true"]');
        var input  = wrap.querySelector('input[type="number"], input[type="date"], input[type="text"]');
        var sel    = wrap.querySelector('select');
        if (editor)    val = (editor.innerText || editor.textContent || '').trim();
        else if (sel)  val = sel.value;
        else if (input) val = input.value;
      } else {
        // Campo en lectura — leer hidden input o memoria
        var el = document.getElementById('seg-pn-form-f-' + i);
        val = (el && el.value) ? el.value.trim() : '';
        if (!val && _segCamposFijosActuales && _segCamposFijosActuales[c.label]) {
          val = _segCamposFijosActuales[c.label];
        }
      }
    } else {
      var el2 = document.getElementById('seg-pn-form-f-' + i);
      val = el2 ? (el2.innerText || el2.value || '').trim() : '';
    }
    return { label: c.label, valor: val, tipo: c.tipo };
  });
}

function segPnFormAbrir(plantillaId, valores) {
  var lista = SEG._plantillas['notas'] || [];
  // Comparación robusta: normalizar ambos lados como string trimado
  var pidStr = String(plantillaId || '').trim();
  var p = lista.find(function(x) {
    return String(x._id || x.id || '').trim() === pidStr;
  });
  if (!p || !p.campos || !p.campos.length) return;

  _segPn.formActivo = plantillaId;
  _segModoNotas     = 'plantilla:' + plantillaId;

  // Ocultar editor, mostrar formulario
  document.getElementById('seg-notas-editor-wrap').classList.add('seg-hidden');
  document.getElementById('seg-notas-formulario').classList.remove('seg-hidden');

  // Título del formulario
  document.getElementById('seg-pn-form-nombre').textContent = p.nombre;

  // Marcar chip activo
  document.querySelectorAll('#seg-chips-notas .seg-plantilla-chip').forEach(function(chip) {
    var chk = chip.querySelector('.seg-chip-check');
    if (chip.dataset.id === plantillaId) {
      chip.classList.add('used');
      if (chk) chk.classList.remove('seg-hidden');
    } else {
      chip.classList.remove('used');
      if (chk) chk.classList.add('seg-hidden');
    }
  });

  // Renderizar campos del formulario respetando el layout guardado
  var wrap = document.getElementById('seg-pn-form-campos');
  var layout = (p.layout && p.layout.length) ? p.layout : p.campos.map(function(c, i) { return { fila: [i] }; });

  // Función auxiliar para renderizar un campo por índice
  function _renderCampoFormAbrir(c, i, enFilaMulti) {
    var esFijo = !!c.fijo;
    var fijoTag = esFijo
      ? '<span class="seg-pn-fijo-badge"><i class="fas fa-lock"></i> Fijo</span>'
      : '';
    var labelHtml = '<div class="seg-pn-form-campo-label">' + segEscape(c.label) + fijoTag + '</div>';
    var input = '';

    if (esFijo) {
      // Mostrar valor actual con lápiz — el display depende del tipo
      var displayFijo = c.tipo === 'selector'
        ? '<span class="seg-pn-fijo-valor" id="seg-pn-fijo-val-' + i + '">Seleccionar...</span>'
        : c.tipo === 'fecha'
          ? '<span class="seg-pn-fijo-valor" id="seg-pn-fijo-val-' + i + '">—</span>'
          : '<span class="seg-pn-fijo-valor" id="seg-pn-fijo-val-' + i + '">—</span>';
      input = '<div class="seg-pn-fijo-wrap" id="seg-pn-fijo-wrap-' + i + '">' +
        displayFijo +
        '<button class="seg-pn-fijo-edit-btn" onclick="segPnFijoEditar(' + i + ')" title="Editar">' +
          '<i class="fas fa-pencil-alt"></i>' +
        '</button>' +
        '<input type="hidden" id="seg-pn-form-f-' + i + '" value="">' +
      '</div>';
    } else if (c.tipo === 'texto-corto' || c.tipo === 'texto-largo') {
      input = '<div class="seg-pn-form-campo-editor"' +
        ' id="seg-pn-form-f-' + i + '"' +
        ' data-tipo="' + c.tipo + '"' +
        ' data-placeholder="' + segEscape(c.label) + '..."' +
        ' contenteditable="true" spellcheck="true"></div>';
    } else if (c.tipo === 'numero') {
      input = '<input type="number" class="seg-pn-form-campo-input"' +
        ' id="seg-pn-form-f-' + i + '" placeholder="0">';
    } else if (c.tipo === 'selector') {
      var opciones = (c.opciones || '').split(',').map(function(o) { return o.trim(); }).filter(Boolean);
      input = '<div class="seg-agenda-dd-wrap seg-pn-form-dd-wrap" id="seg-pn-form-dd-' + i + '">' +
        '<button class="seg-agenda-dd-btn" type="button" onclick="segPnFormDdToggle(' + i + ')">' +
          '<span id="seg-pn-form-dd-label-' + i + '">Seleccionar...</span>' +
          '<i class="fas fa-chevron-down seg-agenda-dd-chevron"></i>' +
        '</button>' +
        '<div class="seg-agenda-dd-list seg-pn-form-dd-list seg-hidden" id="seg-pn-form-dd-list-' + i + '">' +
          opciones.map(function(o) {
            return '<div class="seg-agenda-dd-item" onclick="segPnFormDdSelec(' + i + ',\'' + o.replace(/'/g, "\\'") + '\')">' + segEscape(o) + '</div>';
          }).join('') +
        '</div>' +
        '<input type="hidden" id="seg-pn-form-f-' + i + '" value="">' +
      '</div>';
    } else if (c.tipo === 'fecha') {
      var hoy2 = new Date();
      _segPnFormDp[i] = { anio: hoy2.getFullYear(), mes: hoy2.getMonth(), fechaSel: '', modo: 'dias' };
      var dh = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map(function(d) {
        return '<div class="cal-day-header">' + d + '</div>';
      }).join('');
      input = '<div class="seg-picker-wrap seg-pn-form-dp-wrap">' +
        '<button class="seg-picker-btn seg-pn-form-dp-btn" type="button" onclick="segPnFormDpToggle(' + i + ')">' +
          '<i class="fas fa-calendar-alt" style="color:#9961FF;font-size:11px"></i>' +
          '<span id="seg-pn-form-dp-display-' + i + '">—</span>' +
        '</button>' +
        '<div class="seg-datepicker seg-hidden" id="seg-pn-form-dp-' + i + '">' +
          '<div class="cal-nav">' +
            '<button class="cal-nav-btn" type="button" onclick="segPnFormDpNavMes(' + i + ',-1)"><i class="fas fa-chevron-left"></i></button>' +
            '<span class="cal-nav-title" id="seg-pn-form-dp-titulo-' + i + '"></span>' +
            '<button class="cal-nav-btn" type="button" onclick="segPnFormDpNavMes(' + i + ',1)"><i class="fas fa-chevron-right"></i></button>' +
          '</div>' +
          '<div class="cal-grid" id="seg-pn-form-dp-dayhead-' + i + '" style="padding:4px 4px 2px">' + dh + '</div>' +
          '<div class="cal-grid cal-days-grid" id="seg-pn-form-dp-dias-' + i + '"></div>' +
        '</div>' +
        '<input type="hidden" id="seg-pn-form-f-' + i + '" value="">' +
      '</div>';
    }
    // En fila multi, los campos nunca son --full (ocupan su columna)
    // En fila simple, texto-largo y fijos son --full
    var colClass = (!enFilaMulti && (esFijo || c.tipo === 'texto-largo')) ? 'seg-pn-form-campo--full' : '';
    return '<div class="seg-pn-form-campo' + (colClass ? ' ' + colClass : '') + (esFijo ? ' seg-pn-form-campo--fijo' : '') + '">' + labelHtml + input + '</div>';
  }

  // Renderizar por filas del layout
  wrap.innerHTML = layout.map(function(fila) {
    var multi = fila.fila.length > 1;
    return '<div class="seg-pn-form-fila' + (multi ? ' seg-pn-form-fila--multi' : '') + '">' +
      fila.fila.map(function(ci) {
        var c = p.campos[ci];
        return c ? _renderCampoFormAbrir(c, ci, multi) : '';
      }).join('') +
    '</div>';
  }).join('');

  // Punto 5: Inicializar comandos CIE-10/síntomas en los campos contenteditable
  p.campos.forEach(function(c, i) {
    if (c.tipo === 'texto-corto' || c.tipo === 'texto-largo') {
      var el = document.getElementById('seg-pn-form-f-' + i);
      if (el) segInicializarEditorNotas(el);
    }
  });

  // Restaurar valores guardados si se proporcionan (desde historial o contexto)
  if (valores && valores.length) {
    p.campos.forEach(function(c, i) {
      var saved = valores[i];
      if (!saved || !saved.valor) return;
      var el = document.getElementById('seg-pn-form-f-' + i);
      if (!el) return;
      if (c.fijo) {
        // Campo fijo: restaurar con valor del snapshot histórico
        if (!_segCamposFijosActuales) _segCamposFijosActuales = {};
        _segCamposFijosActuales[c.label] = saved.valor;
        _segPnFijoRestaurarWrapConValor(i, saved.valor, c.tipo);
      } else if (c.tipo === 'texto-corto' || c.tipo === 'texto-largo') {
        // Usar textContent evita disparar el evento input en Safari/iOS
        el.textContent = saved.valor;
      } else if (c.tipo === 'numero') {
        el.value = saved.valor;
      } else if (c.tipo === 'selector') {
        segPnFormDdSelec(i, saved.valor);
      } else if (c.tipo === 'fecha') {
        segPnFormDpSelec(i, saved.valor);
      }
    });
  }

  // Forzar re-render de chips para que queden visibles tras abrir el formulario
  segRenderizarTodosChips();

  // Cargar valores de campos fijos desde BD (si hay cliente activo)
  // Si ya se restauraron valores del historial, solo cargar en memoria
  if (SEG.clienteId && SEG.companyId) {
    var _tieneValores = valores && valores.length && valores.some(function(v){ return v && v.valor; });
    segCargarCamposFijos(plantillaId, p, _tieneValores);
  }
}

/* ── Punto 4: Volver al editor normal ── */
function segPnFormVolver() {
  // Confirmar cualquier campo fijo que esté en modo edición
  _segPnConfirmarFijosAbiertos();
  // Guardar campos actuales en memoria (para autoguardado)
  if (_segPn.formActivo) {
    _segCamposPlantilla = segPnRecopilarCampos();
  }
  // Volver al editor sin tocar notas_internas — la plantilla se guarda en campos_plantilla
  segPnResetearVista();
  segMarcarCambios();
}

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
  // Cargar config del autoguardado desde backend
  segCargarConfigAutoguardado();
  // Inicializar editor notas al cargar la página
  setTimeout(segInicializarEditorNotas, 100);
  // Escuchar eventos de timeline IA via Socket.IO
  segRegistrarSocketTimeline();
}

function segRegistrarSocketTimeline() {
  // Exponer callback que realtime.js llamará al recibir el evento
  window.segOnTimelineUpdated = function(data) {
    // Solo procesar si es para el cliente activo
    if (!SEG.clienteId || data.cliente_id !== SEG.clienteId) return;
    // Actualizar timeline en UI
    if (data.timeline && SEG.labels) {
      segRenderizarTimeline(
        data.timeline,
        SEG.labels.timeline_titulo,
        SEG.labels.timeline_inicio
      );
      segRenderizarTLEdit(data.timeline, SEG.labels.timeline_titulo);
      if (SEG.contexto) SEG.contexto.timeline = data.timeline;
    }
    // Toast informativo
    var n = data.nuevos || 0;
    if (n > 0) {
      segToast(
        '📅 ' + n + ' evento' + (n > 1 ? 's' : '') + ' agregado' + (n > 1 ? 's' : '') + ' a la línea de tiempo',
        'success'
      );
    }
  };
}

(function segAutoInit() {
  if (document.getElementById('seg-entity-list')) {
    // DOM listo — siempre inicializar (puede ser re-navegación)
    segInit();
  } else {
    setTimeout(segAutoInit, 80);
  }
})();

/* ═══════════════════════════════════════════════════════
   FORM BUILDER — DATE PICKER Y DROPDOWN CUSTOM
   Reutilizan las clases CSS del calendario y dropdown
   de la sección de Agenda (cal-nav, cal-day, etc.)
═══════════════════════════════════════════════════════ */

var _MESES_DP = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                 'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

/* ── Date Picker ── */
function segPnFormDpToggle(idx) {
  var dp  = document.getElementById('seg-pn-form-dp-' + idx);
  var btn = document.getElementById('seg-pn-form-dp-' + idx);
  // Find the trigger button
  var dpWrap = dp ? dp.closest('.seg-pn-form-dp-wrap') : null;
  var triggerBtn = dpWrap ? dpWrap.querySelector('.seg-pn-form-dp-btn') : null;
  if (!dp) return;

  // Cerrar todos los demás
  document.querySelectorAll('.seg-datepicker').forEach(function(el) {
    if (el !== dp) { el.classList.add('seg-hidden'); el.style.cssText = ''; }
  });
  document.querySelectorAll('.seg-pn-form-dd-list').forEach(function(el) {
    el.classList.add('seg-hidden'); el.style.cssText = '';
  });

  if (dp.classList.contains('seg-hidden')) {
    segPnFormDpRender(idx);
    dp.classList.remove('seg-hidden');
    // Posicionar con fixed para salir del overflow
    if (triggerBtn) {
      var r = triggerBtn.getBoundingClientRect();
      dp.style.cssText = 'position:fixed;top:' + (r.bottom + 4) + 'px;left:' + r.left + 'px;z-index:9999;width:220px;';
    }
  } else {
    dp.classList.add('seg-hidden');
    dp.style.cssText = '';
  }
}

function segPnFormDpNavMes(idx, delta) {
  var st = _segPnFormDp[idx];
  if (!st) return;
  if (st.modo === 'anios') {
    st.anioBase = (st.anioBase || st.anio) + delta * 12;
    segPnFormDpRender(idx); return;
  }
  if (st.modo === 'meses') {
    st.anio += delta;
    segPnFormDpRender(idx); return;
  }
  st.mes += delta;
  if (st.mes < 0)  { st.mes = 11; st.anio--; }
  if (st.mes > 11) { st.mes = 0;  st.anio++; }
  segPnFormDpRender(idx);
}

function segPnFormDpClickTitulo(idx) {
  var st = _segPnFormDp[idx];
  if (!st) return;
  if (!st.modo || st.modo === 'dias')  { st.modo = 'meses'; }
  else if (st.modo === 'meses')        { st.modo = 'anios'; st.anioBase = st.anio; }
  else                                  { st.modo = 'dias'; }
  segPnFormDpRender(idx);
}

function segPnFormDpRender(idx) {
  var st = _segPnFormDp[idx];
  if (!st) return;
  var tituloEl = document.getElementById('seg-pn-form-dp-titulo-' + idx);
  var diasEl   = document.getElementById('seg-pn-form-dp-dias-' + idx);
  var headEl   = document.getElementById('seg-pn-form-dp-dayhead-' + idx);
  if (!tituloEl || !diasEl) return;

  var hoy = new Date();
  var hoyStr = hoy.getFullYear() + '-' +
    String(hoy.getMonth()+1).padStart(2,'0') + '-' +
    String(hoy.getDate()).padStart(2,'0');

  var modo = st.modo || 'dias';

  if (modo === 'anios') {
    tituloEl.textContent = (st.anioBase || st.anio) + ' – ' + ((st.anioBase || st.anio) + 11);
    if (headEl) headEl.style.display = 'none';
    var html = '<div class="seg-dp-grid-meses">';
    for (var y = (st.anioBase || st.anio); y < (st.anioBase || st.anio) + 12; y++) {
      var cls = 'seg-dp-mes-item' + (y === st.anio ? ' activo' : '');
      html += '<div class="' + cls + '" onclick="segPnFormDpSelecAnio(' + idx + ',' + y + ')">' + y + '</div>';
    }
    html += '</div>';
    diasEl.innerHTML = html;
    return;
  }

  if (modo === 'meses') {
    tituloEl.textContent = st.anio;
    if (headEl) headEl.style.display = 'none';
    var meses = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    var html2 = '<div class="seg-dp-grid-meses">';
    meses.forEach(function(m, mi) {
      var cls2 = 'seg-dp-mes-item' + (mi === st.mes ? ' activo' : '');
      html2 += '<div class="' + cls2 + '" onclick="segPnFormDpSelecMes(' + idx + ',' + mi + ')">' + m + '</div>';
    });
    html2 += '</div>';
    diasEl.innerHTML = html2;
    return;
  }

  // Modo días
  tituloEl.innerHTML = '<span class="seg-dp-titulo-link" onclick="segPnFormDpClickTitulo(' + idx + ')">' +
    _MESES_DP[st.mes] + ' ' + st.anio + '</span>';
  if (headEl) headEl.style.display = '';

  var primerDia = new Date(st.anio, st.mes, 1).getDay();
  var offset    = (primerDia === 0) ? 6 : primerDia - 1;
  var diasEnMes = new Date(st.anio, st.mes + 1, 0).getDate();
  var html3 = '';
  for (var e = 0; e < offset; e++) html3 += '<div></div>';
  for (var d = 1; d <= diasEnMes; d++) {
    var fechaStr = st.anio + '-' + String(st.mes+1).padStart(2,'0') + '-' + String(d).padStart(2,'0');
    var cls3 = 'cal-day';
    if (fechaStr === hoyStr)      cls3 += ' cal-day--today';
    if (fechaStr === st.fechaSel) cls3 += ' cal-day--selected';
    html3 += '<div class="' + cls3 + '" onclick="segPnFormDpSelec(' + idx + ',\'' + fechaStr + '\')">' +
      '<span class="cal-day-num">' + d + '</span></div>';
  }
  diasEl.innerHTML = html3;
}

function segPnFormDpSelecAnio(idx, anio) {
  var st = _segPnFormDp[idx];
  if (!st) return;
  st.anio = anio;
  st.modo = 'meses';
  segPnFormDpRender(idx);
}

function segPnFormDpSelecMes(idx, mes) {
  var st = _segPnFormDp[idx];
  if (!st) return;
  st.mes  = mes;
  st.modo = 'dias';
  segPnFormDpRender(idx);
}

function segPnFormDpSelec(idx, fechaStr) {
  var st = _segPnFormDp[idx];
  if (!st) return;
  st.fechaSel = fechaStr;
  // Guardar en hidden input
  var hidden = document.getElementById('seg-pn-form-f-' + idx);
  if (hidden) hidden.value = fechaStr;
  // Actualizar display
  var display = document.getElementById('seg-pn-form-dp-display-' + idx);
  if (display && fechaStr) {
    var d = new Date(fechaStr + 'T12:00:00');
    var meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
    display.textContent = d.getDate() + ' ' + meses[d.getMonth()] + ' ' + d.getFullYear();
  }
  // Cerrar calendar
  var dp = document.getElementById('seg-pn-form-dp-' + idx);
  if (dp) dp.classList.add('seg-hidden');
}

/* ── Custom Dropdown (selector) ── */
function segPnFormDdToggle(idx) {
  var list = document.getElementById('seg-pn-form-dd-list-' + idx);
  var wrap = document.getElementById('seg-pn-form-dd-' + idx);
  var btn  = wrap ? wrap.querySelector('.seg-agenda-dd-btn') : null;
  if (!list) return;

  // Cerrar todos los demás
  document.querySelectorAll('.seg-pn-form-dd-list').forEach(function(el) {
    if (el !== list) { el.classList.add('seg-hidden'); el.style.cssText = ''; }
  });
  document.querySelectorAll('.seg-agenda-dd-wrap').forEach(function(el) {
    if (el !== wrap) el.classList.remove('abierto');
  });
  document.querySelectorAll('.seg-datepicker').forEach(function(el) {
    el.classList.add('seg-hidden'); el.style.cssText = '';
  });

  var isOpen = !list.classList.contains('seg-hidden');
  if (isOpen) {
    list.classList.add('seg-hidden');
    list.style.cssText = '';
    if (wrap) wrap.classList.remove('abierto');
  } else {
    list.classList.remove('seg-hidden');
    if (wrap) wrap.classList.add('abierto');
    // Posicionar con fixed para salir del overflow
    if (btn) {
      var r = btn.getBoundingClientRect();
      list.style.cssText = 'position:fixed;top:' + (r.bottom + 4) + 'px;left:' + r.left + 'px;' +
        'min-width:' + r.width + 'px;z-index:9999;';
    }
  }
}


/* ── Vista previa en tiempo real ── */

/* ── Guardar plantilla ── */

/* ── Chips de plantillas notas ── */



/* ── Punto 4: Formulario inline reemplaza el editor ── */
/* ── Resetear vista al editor por defecto ── */

/* ── Recopilar valores actuales del formulario activo ── */



/* ── Punto 4: Volver al editor normal ── */



(function segAutoInit() {
  if (document.getElementById('seg-entity-list')) {
    // DOM listo — siempre inicializar (puede ser re-navegación)
    segInit();
  } else {
    setTimeout(segAutoInit, 80);
  }
})();

/* ═══════════════════════════════════════════════════════
   FORM BUILDER — DATE PICKER Y DROPDOWN CUSTOM
   Reutilizan las clases CSS del calendario y dropdown
   de la sección de Agenda (cal-nav, cal-day, etc.)
═══════════════════════════════════════════════════════ */

var _MESES_DP = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                 'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

/* ── Date Picker ── */







/* ── Custom Dropdown (selector) ── */

function segPnFormDdSelec(idx, val) {
  var hidden = document.getElementById('seg-pn-form-f-' + idx);
  var label  = document.getElementById('seg-pn-form-dd-label-' + idx);
  var list   = document.getElementById('seg-pn-form-dd-list-' + idx);
  var wrap   = document.getElementById('seg-pn-form-dd-' + idx);
  if (hidden) hidden.value = val;
  if (label)  label.textContent = val;
  // Marcar activo
  if (list) {
    list.querySelectorAll('.seg-agenda-dd-item').forEach(function(item) {
      item.classList.toggle('activo', item.textContent.trim() === val);
    });
    list.classList.add('seg-hidden');
  }
  if (wrap) wrap.classList.remove('abierto');
}

// Cerrar pickers/dropdowns del form al hacer click fuera
document.addEventListener('click', function(e) {
  if (!e.target.closest('.seg-pn-form-dp-wrap') && !e.target.closest('.seg-pn-form-dp-btn')) {
    document.querySelectorAll('[id^="seg-pn-form-dp-"]').forEach(function(dp) {
      if (dp.classList.contains('seg-datepicker')) {
        dp.classList.add('seg-hidden');
        dp.style.cssText = '';
      }
    });
  }
  if (!e.target.closest('.seg-pn-form-dd-wrap')) {
    document.querySelectorAll('.seg-pn-form-dd-list').forEach(function(el) {
      el.classList.add('seg-hidden');
      el.style.cssText = '';
    });
    // Solo quitar clase 'abierto' de dropdowns del formulario de plantilla (no del modal agenda)
    document.querySelectorAll('.seg-pn-form-dd-wrap').forEach(function(el) {
      el.classList.remove('abierto');
    });
  }
});



(function segSuscribirTimeline() {
  function _handler(data) {
    if (!SEG.clienteId || data.cliente_id !== SEG.clienteId) return;
    if (data.timeline && SEG.labels) {
      segRenderizarTimeline(data.timeline, SEG.labels.timeline_titulo, SEG.labels.timeline_inicio);
      segRenderizarTLEdit(data.timeline, SEG.labels.timeline_titulo);
      if (SEG.contexto) SEG.contexto.timeline = data.timeline;
    }
    var n = data.nuevos || 0;
    if (n > 0) {
      segToast('📅 ' + n + ' evento' + (n > 1 ? 's' : '') + ' agregado' + (n > 1 ? 's' : '') + ' a la línea de tiempo', 'success');
    }
  }
  // Intentar suscribir via rtEvents si ya está disponible
  if (window.rtEvents) {
    window.rtEvents.on('seguimiento_timeline_updated', _handler);
    console.log('✅ [Seguimiento] suscrito a seguimiento_timeline_updated via rtEvents');
  } else {
    // rtEvents aún no cargó — esperar
    document.addEventListener('DOMContentLoaded', function() {
      if (window.rtEvents) {
        window.rtEvents.on('seguimiento_timeline_updated', _handler);
        console.log('✅ [Seguimiento] suscrito a seguimiento_timeline_updated (DOMContentLoaded)');
      }
    });
  }
  // También exponer como fallback directo
  window.segOnTimelineUpdated = _handler;
})();
/* ═══════════════════════════════════════════════════════
   EXPORTS GLOBALES — funciones expuestas al DOM
   (onclick handlers, router, módulos externos)
═══════════════════════════════════════════════════════ */

window.segEliminarRegistro     = segEliminarRegistro;
window.segMostrarConfirmEliminar = segMostrarConfirmEliminar;
window.segCancelarConfirmEliminar = segCancelarConfirmEliminar;
window.segConfirmarEliminar    = segConfirmarEliminar;
window.segToggleSidePanel      = segToggleSidePanel;
window.segAbrirModalAgenda       = segAbrirModalAgenda;
window._segDiagDropdownSelec     = _segDiagDropdownSelec;
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
window.segRenderizarDropdownCobro = segRenderizarDropdownCobro;
window.segAplicarPlaceholders    = segAplicarPlaceholders;
window.segAgendaSetCanal         = segAgendaSetCanal;
window.segAgendaSesionSetCanal   = segAgendaSesionSetCanal;
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
window.segToggleEvo           = segToggleEvo;
window.segAddEvento           = segAddEvento;
window.segEliminarEvento      = segEliminarEvento;
window.segSyncTimeline        = segSyncTimeline;
window.segMarcarCambios       = segMarcarCambios;
window.segVerPlantillas       = segVerPlantillas;
window.segNuevoMensajeProg    = segNuevoMensajeProg;
window.segEditarResumen       = segEditarResumen;
window.segPnDragStart   = segPnDragStart;
window.segPnDragEnd     = segPnDragEnd;
window.segPnDragOverFila = segPnDragOverFila;
window.segPnDropEnFila  = segPnDropEnFila;
window.initSeguimientoPage    = initSeguimientoPage;
window.segNuevaPlantillaNotas  = segNuevaPlantillaNotas;
window.segPnCerrar             = segPnCerrar;
window.segPnAgregarCampo       = segPnAgregarCampo;
window.segPnEliminarCampo      = segPnEliminarCampo;
window.segPnCampoLabelChange   = segPnCampoLabelChange;
window.segPnCampoOpcionesChange = segPnCampoOpcionesChange;
window.segPnGuardar            = segPnGuardar;
window.segPnEliminarPlantilla  = segPnEliminarPlantilla;
window.segPnFormAbrir          = segPnFormAbrir;
window.segPnFormVolver         = segPnFormVolver;
window.segPnChipToggle         = segPnChipToggle;
window.segPnResetearVista      = segPnResetearVista;
window.segPnRecopilarCampos    = segPnRecopilarCampos;
window.segPnFormDpToggle    = segPnFormDpToggle;
window.segPnFormDpNavMes    = segPnFormDpNavMes;
window.segPnFormDpSelec     = segPnFormDpSelec;
window.segPnFormDpClickTitulo = segPnFormDpClickTitulo;
window.segPnFormDpSelecAnio = segPnFormDpSelecAnio;
window.segPnFormDpSelecMes  = segPnFormDpSelecMes;
window.segPnFormDdToggle  = segPnFormDdToggle;
window.segPnFormDdSelec   = segPnFormDdSelec;
window.segPnFijoConfirmarEditor = segPnFijoConfirmarEditor;
window.segPnFijoConfirmarInp    = segPnFijoConfirmarInp;
window.segPnFijoConfirmarSel    = segPnFijoConfirmarSel;
window.segPnFijoCancelar        = segPnFijoCancelar;
window._segPnFijoRestaurarWrap  = _segPnFijoRestaurarWrap;
window._segPnFijoRestaurarWrapConValor = _segPnFijoRestaurarWrapConValor;
window.segPnFijoEditar          = segPnFijoEditar;
window.segAbrirAuditoriaCampos  = segAbrirAuditoriaCampos;
window.segCerrarAuditoriaCampos = segCerrarAuditoriaCampos;