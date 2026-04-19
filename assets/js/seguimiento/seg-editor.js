/* ═══════════════════════════════════════════════════════
   SEGUIMIENTO — seg-editor.js
   Editor contenteditable de notas clínicas. Sugerencias inline, dropdown CIE-10, chips hipótesis/diagnóstico desde texto.

   Atajos en el editor:
     /palabra   → Síntoma (rosado)
     /dpalabra  → Diagnóstico (azul, solo existentes en CIE-10)
     "texto"    → Hipótesis (morado)
     Espacio    → confirma la sugerencia inline
═══════════════════════════════════════════════════════ */

var _segSug = { actual: null, esDiag: false };
var _segHipMode = false; // true cuando hay una " abierta esperando cierre
var _segDiagMode  = false; // true cuando hay // abierto esperando cierre
var _segDiagTimer = null;
var _segDiagMatches = [];
var _segDiagIdx    = -1;
var _segEditorActivo = null; // editor contenteditable con foco actual (principal o campo de plantilla)

function _segGetEditor() {
  return _segEditorActivo || document.getElementById('seg-campo-notas');
}

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
  var ed = _segGetEditor();
  var sug = ed ? ed.querySelector('.seg-inline-sug') : document.querySelector('#seg-campo-notas .seg-inline-sug');
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
  var editor = _segGetEditor();
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
function _segDiagDropdownMostrar(matches, query) {
  // En móvil usar bottom sheet
  if (_segEsMobil()) {
    segDiagSheetAbrir(matches, query || '');
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
  var editor = _segGetEditor();
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
  var editor = _segGetEditor();
  if (!editor) return;
  _segDiagMode = false;
  _segLimpiarSugerencia();

  var html = editor.innerHTML.replace(/<span class="seg-inline-sug"[^>]*>.*?<\/span>/gi, '');
  var pos  = html.lastIndexOf('//');
  if (pos !== -1) {
    var gris     = '<span style="color:#d0d3e0" contenteditable="false">';
    var remplazo = gris + '//</span><span style="color:#374151">' + textoRaw + '</span>' + gris + '//</span>\u00a0';
    // Calcular fin: saltar exactamente el texto que el usuario escribió después de //
    // No usar textoRaw.length (nombre del diagnóstico) — puede diferir del query escrito
    var afterSlashes = html.slice(pos + 2);
    var nextTag      = afterSlashes.indexOf('<');
    var queryEnHtml  = nextTag === -1 ? afterSlashes : afterSlashes.slice(0, nextTag);
    var fin          = pos + 2 + queryEnHtml.length;
    editor.innerHTML = html.slice(0, pos) + remplazo + html.slice(fin > html.length ? html.length : fin);
  }
  var sel = window.getSelection();
  var r   = document.createRange();
  r.selectNodeContents(editor);
  r.collapse(false);
  sel.removeAllRanges();
  sel.addRange(r);

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

function segInicializarEditorNotas(editorOverride) {
  // Acepta un elemento DOM específico (para campos del formulario de plantilla)
  // o busca el editor principal si no se pasa ninguno
  var editor = editorOverride || document.getElementById('seg-campo-notas');
  if (!editor) return;
  // Solo clonar el editor principal (evita problemas con elementos del formulario)
  if (!editorOverride) {
    var nuevo = editor.cloneNode(true);
    editor.parentNode.replaceChild(nuevo, editor);
    editor = nuevo;
  }

  // Rastrear qué editor tiene foco para que chips/síntomas se inserten en el correcto
  // No limpiamos en blur porque el dropdown/sheet recibe el click antes de que
  // _segDiagConfirmarChip se ejecute — el último editor activo se mantiene hasta
  // que otro editor tome el foco.
  editor.addEventListener('focus', function() { _segEditorActivo = this; });

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
              _segDiagDropdownMostrar(_segDiagMatches, query);
            },
            function() {
              _segDiagDropdownMostrar([], query);
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

    // Solo síntomas con /palabra — requiere al menos 1 letra para mostrar sugerencia
    var query = afterSlash;
    if (query.length === 0) { segMarcarCambios(); return; } // esperar que escriba algo
    var matches = SEG.etiquetasDisponibles.filter(function(t) {
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

    // ── Tab — confirmar sugerencia inline (igual que Espacio pero sin agregar espacio) ──
    if (e.key === 'Tab' && !_segDiagMode) {
      // Buscar sugerencia inline directamente en el DOM
      var sugTab = document.querySelector('.seg-inline-sug');
      var sugTextoTab = sugTab ? sugTab.textContent : '';
      if (sugTextoTab) {
        e.preventDefault();
        var textoTab = _segGetTextBeforeCursor(this);
        var lastSlashTab = textoTab.lastIndexOf('/');
        if (lastSlashTab !== -1) {
          var afterSlashTab = textoTab.slice(lastSlashTab + 1);
          var tagTab = afterSlashTab + sugTextoTab;
          if (afterSlashTab.indexOf(' ') === -1 && tagTab.length > 0) {
            _segConfirmarTag(tagTab, afterSlashTab);
            segAgregarChip('sintoma', tagTab);
            if (SEG.etiquetasActivas.indexOf(tagTab) === -1) {
              SEG.etiquetasActivas.push(tagTab);
              segRenderizarChipsEtiquetas();
            }
          }
        }
        return;
      }
      // Sin sugerencia — prevenir salto de foco en campos de plantilla
      if (this.classList.contains('seg-pn-fijo-editor') || this.classList.contains('seg-pn-form-campo-editor')) {
        e.preventDefault();
      }
      return;
    }

    // ── Espacio — confirmar síntoma ──
    if (e.key === ' ') {
      if (_segDiagMode) return; // en modo diag, el espacio es parte del texto
      var sug = this.querySelector('.seg-inline-sug') || document.querySelector('#seg-campo-notas .seg-inline-sug');
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