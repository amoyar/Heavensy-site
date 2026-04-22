/* ═══════════════════════════════════════════════════════
   SEGUIMIENTO — seg-adjuntos.js
   Upload adjuntos, preview, dropzone, dropdown cobro, plantillas chips (menú selección).
═══════════════════════════════════════════════════════ */

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
    var nombre = segEscape(a.nombre || 'Archivo');
    var mime   = a.mime || '';
    var esImg  = mime.startsWith('image/');

    if (a.subiendo) {
      return '<div class="seg-adj-card seg-adj-card--subiendo">' +
        '<div class="seg-adj-card-preview">' +
          '<div class="seg-spinner" style="width:28px;height:28px;border-width:3px"></div>' +
        '</div>' +
        '<span class="seg-adj-card-nombre">Subiendo...</span>' +
      '</div>';
    }

    var preview = esImg
      ? '<img class="seg-adj-card-img" src="' + segEscape(a.url || '') + '" alt="' + nombre + '" loading="lazy">'
      : '<i class="' + segIconoAdjunto(mime) + ' seg-adj-card-icon"></i>';

    return '<div class="seg-adj-card">' +
      '<button class="seg-adj-card-remove" onclick="event.preventDefault();segEliminarAdjunto(' + i + ')" data-seg-tooltip="Eliminar">' +
        '<i class="fas fa-times"></i>' +
      '</button>' +
      '<a class="seg-adj-card-link" href="' + segEscape(a.url || '#') + '" target="_blank" data-seg-tooltip="' + nombre + '">' +
        '<div class="seg-adj-card-preview">' + preview + '</div>' +
        '<span class="seg-adj-card-nombre">' + nombre + '</span>' +
      '</a>' +
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

/* ─── Dropdown cobro dinámico ─────────────────────────────── */
var _segOpcionesCobro = []; // cargado desde contexto

function segRenderizarDropdownCobro(opciones) {
  if (!opciones || !opciones.length) return;
  _segOpcionesCobro = opciones;
  var list    = document.getElementById('seg-agenda-dd-list');
  var labelEl = document.getElementById('seg-agenda-dd-label');
  var hidden  = document.getElementById('seg-agenda-timer');
  if (!list) return;

  // Encontrar opción activa por defecto
  var defecto = opciones.find(function(o) { return o.activo_por_defecto; }) || opciones[1] || opciones[0];

  list.innerHTML = opciones.map(function(o) {
    var activo = o.activo_por_defecto ? ' activo' : '';
    return '<div class="seg-agenda-dd-item' + activo + '" onclick="segAgendaDdSelect(' +
      o.valor + ',\'' + o.label.replace(/'/g, "\\'") + '\')">' + o.label + '</div>';
  }).join('');

  // Setear valor por defecto
  if (defecto) {
    if (labelEl) labelEl.textContent = defecto.label;
    if (hidden)  hidden.value = defecto.valor;
  }
}

/* ─── Placeholders dinámicos desde labels de BD ──────────── */
function segAplicarPlaceholders(labels) {
  if (!labels) return;
  var mapa = {
    'seg-campo-notas':     labels.placeholder_notas     || 'Escribe /síntoma, //diagnóstico CIE-10, "hipótesis"...',
    'seg-campo-contenido': labels.placeholder_contenido || 'Describe el contenido de esta sesión...',
    'seg-campo-tareas':    labels.placeholder_tareas    || 'Tareas o indicaciones...',
    'seg-campo-proxima':   labels.placeholder_proxima   || 'Plan para la próxima vez...',
  };
  Object.keys(mapa).forEach(function(id) {
    var el = document.getElementById(id);
    if (!el) return;
    if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
      el.placeholder = mapa[id];
    } else {
      el.dataset.placeholder = mapa[id]; // contenteditable
    }
  });
}

function segCargarPlantillasContexto(plantillas) {
  SEG._plantillas = plantillas || {};
  segRenderizarChipsPlantillas('principal');
  segRenderizarChipsPlantillas('tareas');
  segRenderizarChipsPlantillas('proxima');
  segPnRenderChips();
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
        '<i class="fas fa-pencil-alt" onclick="event.stopPropagation();segEditarPlantilla(\'' + pid + '\',\'' + tipo + '\')" data-seg-tooltip="Editar"></i>' +
        '<i class="fas fa-trash" onclick="event.stopPropagation();segEliminarPlantilla(\'' + pid + '\',\'' + tipo + '\')" data-seg-tooltip="Eliminar"></i>' +
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