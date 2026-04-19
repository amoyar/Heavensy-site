/* ═══════════════════════════════════════════════════════
   SEGUIMIENTO — seg-chips.js
   Chips síntoma/diagnóstico/hipótesis/trabajar. segAgregarChip, segToggleTrabajar, segRenderizarSeccionChips, etiquetas.
═══════════════════════════════════════════════════════ */

var _segChips = { sintoma: [], diagnostico: [], hipotesis: [], trabajar: [] };
var _segModoNotas      = 'editor';   // 'editor' | 'plantilla:{id}'
var _segCamposPlantilla = [];        // [{label, valor, tipo}] — valores actuales del form

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
  segActualizarTarjetaHistorialChips();
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
    var esDiag = _segChips.diagnostico.indexOf(nombre) !== -1 || _segChips.sintoma.indexOf(nombre) !== -1;
    var nivel  = esDiag ? _segIntensidades[nombre] : undefined;
    var tieneNivel = esDiag && nivel !== undefined && nivel > 0;
    var badgeColor     = tieneNivel ? SEG_INTENS_COLORS[nivel] : '#e5e7eb';
    var badgeTextColor = tieneNivel ? SEG_INTENS_TEXT[nivel]   : '#9ca3af';
    // Datos de terapeuta + servicio (dummy hasta conectar con agenda)
    var asign    = (typeof _segDerAsignaciones !== 'undefined' && _segDerAsignaciones[nombre]) || null;
    var profTxt  = asign ? asign.profesional : '';
    var servTxt  = asign ? asign.servicio    : '';
    var subline  = [profTxt, servTxt].filter(Boolean).join(' · ');
    return '<span class="seg-hchip seg-hchip-trabajar" draggable="true" ' +
      'data-chip="' + segEscape(nombre) + '" ' +
      'ondragstart="segDerChipDragStart(event, this.dataset.chip)" ' +
      'ondragend="segDerChipDragEnd(event)" ' +
      'data-seg-tooltip="Arrastra al panel de derivaciones para derivar">' +
      '<span class="seg-hchip-main">' +
        '<i class="fas fa-check" style="font-size:8px;margin-right:3px;color:#16a34a"></i>' +
        segEscape(nombre) +
        (esDiag
          ? '<span class="seg-intens-badge"' +
              ' style="background:' + badgeColor + ';color:' + badgeTextColor + '"' +
              ' onclick="event.stopPropagation();segAbrirModalIntensidad(\'' + segEscape(nombre) + '\')"' +
              ' data-seg-tooltip="Escala de intensidad">' +
              (tieneNivel ? nivel : '·') +
            '</span>'
          : '') +
      '</span>' +
      (subline ? '<span class="seg-hchip-sub">' + segEscape(subline) + '</span>' : '') +
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
    var activo    = _segChips.trabajar.indexOf(item.nombre) !== -1;
    var conIntens = item.tipo === 'diagnostico' || item.tipo === 'sintoma';
    var nivel     = _segIntensidades[item.nombre];
    var tieneNivel = activo && conIntens && nivel !== undefined && nivel > 0;
    var badgeColor = tieneNivel ? SEG_INTENS_COLORS[nivel] : '';
    var badgeText  = tieneNivel ? SEG_INTENS_TEXT[nivel] : '';
    return '<span class="seg-chip-trabajar' + (activo ? ' activo' : '') + '"' +
      ' onclick="segToggleTrabajar(\'' + segEscape(item.nombre) + '\')">' +
      (activo ? '<i class="fas fa-check" style="font-size:8px;margin-right:3px;color:#16a34a"></i>' : '') +
      segEscape(item.nombre) +
      (activo && conIntens
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