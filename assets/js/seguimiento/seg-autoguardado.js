/* ═══════════════════════════════════════════════════════
   SEGUIMIENTO — seg-autoguardado.js
   segCargarConfigAutoguardado, segAutoguardadoDebounce, segAutoguardar, segMostrarIndicadorAutoguardado.
═══════════════════════════════════════════════════════ */

var SEG_autoTimer = null;
var SEG_AUTOSAVE_DELAY = 5000;       // ms — se actualiza desde config del backend
var SEG_AUTOSAVE_MIN_INTERVAL = 3000; // ms mínimo entre guardados

function segCargarConfigAutoguardado() {
  segFetch('/api/seguimiento/config', {},
    function(data) {
      if (data && data.config) {
        SEG_AUTOSAVE_DELAY        = (data.config.autosave_delay_sec        || 5) * 1000;
        SEG_AUTOSAVE_MIN_INTERVAL = (data.config.autosave_min_interval_sec || 3) * 1000;
      }
    },
    function() {} // silencioso — usa defaults si falla
  );
}

function segAutoguardadoDebounce() {
  clearTimeout(SEG_autoTimer);
  SEG_autoTimer = setTimeout(function() {
    segAutoguardar();
  }, SEG_AUTOSAVE_DELAY);
}

function segAutoguardar() {
  // Salvedades — no guardar si:
  if (!SEG.hayUnsaved)   return; // nada cambió
  if (!SEG.clienteId)    return; // sin cliente
  if (!SEG.companyId)    return; // sin empresa

  // Hay adjuntos subiendo
  var subiendo = SEG._adjuntos && SEG._adjuntos.some(function(a) { return a.subiendo; });
  if (subiendo) {
    // Hay adjuntos subiendo — reintentar
    SEG_autoTimer = setTimeout(segAutoguardar, SEG_AUTOSAVE_MIN_INTERVAL);
    return;
  }

  // Botón guardar deshabilitado (ya está guardando)
  var btn = document.getElementById('seg-btn-guardar');
  if (btn && btn.disabled) return;

  // Resumen generándose
  var generando = document.getElementById('seg-resumen-generando');
  if (generando && !generando.classList.contains('seg-hidden')) return;

  // Todo OK — guardar silenciosamente
  segAutoguardarSilencioso();
}

function segAutoguardarSilencioso() {
  // No autoguardar si el dropdown CIE-10 está activo — evita cerrar el editor
  if (_segDiagMode) return;
  var diagDd = document.getElementById('seg-diag-dropdown');
  if (diagDd && !diagDd.classList.contains('seg-hidden')) return;
  var diagSheet = document.getElementById('seg-diag-sheet');
  if (diagSheet && !diagSheet.classList.contains('seg-hidden')) return;

  var btn = document.getElementById('seg-btn-guardar');
  // Indicador visual sutil
  segMostrarIndicadorAutoguardado('guardando');

  var nomReg = SEG.labels.registro || 'sesión';
  var camposActualesAuto = _segPn.formActivo ? segPnRecopilarCampos() : _segCamposPlantilla;
  var payload = {
    company_id:          SEG.companyId,
    cliente_id:          SEG.clienteId,
    fecha:               (document.getElementById('seg-campo-fecha')||{}).value || '',
    hora:                (document.getElementById('seg-campo-hora')||{}).value  || '',
    notas_internas:      (document.getElementById('seg-campo-notas')||{}).innerText || '',
    etiquetas:           SEG.etiquetasActivas.slice(),
    chips_sintoma:       (_segChips.sintoma||[]).slice(),
    chips_diagnostico:   (_segChips.diagnostico||[]).slice(),
    chips_hipotesis:     (_segChips.hipotesis||[]).slice(),
    chips_trabajar:      (_segChips.trabajar||[]).slice(),
    adjuntos:            SEG._adjuntos.filter(function(a){ return !a.subiendo; }),
    contenido_principal: (document.getElementById('seg-campo-contenido')||{}).value || '',
    tareas:              (document.getElementById('seg-campo-tareas')||{}).value    || '',
    proxima_cita:        (document.getElementById('seg-campo-proxima')||{}).value   || '',
    resumen_editado:     (document.getElementById('seg-resumen-text')||{}).innerText || '',
    modo_notas:          _segModoNotas,
    campos_plantilla:    camposActualesAuto
  };

  var url    = SEG.registroId ? '/api/seguimiento/registros/' + SEG.registroId : '/api/seguimiento/registros';
  var method = SEG.registroId ? 'PUT' : 'POST';

  segFetch(url, { method: method, body: JSON.stringify(payload) }, function(data) {
    SEG.registroId = data._id || data.id || SEG.registroId;
    SEG.hayUnsaved = false;
    segMostrarIndicadorAutoguardado('guardado');
  }, function() {
    segMostrarIndicadorAutoguardado('error');
  });
}

function segMostrarIndicadorAutoguardado(estado) {
  var el = document.getElementById('seg-autosave-indicator');
  if (!el) return;
  if (estado === 'guardando') {
    el.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Guardando...';
    el.className = 'seg-autosave guardando';
  } else if (estado === 'guardado') {
    el.innerHTML = '<span class="seg-autosave-check"><i class="fas fa-check"></i></span> Guardado';
    el.className = 'seg-autosave guardado';
    setTimeout(function() { el.className = 'seg-autosave'; el.innerHTML = ''; }, 3000);
  } else {
    el.innerHTML = '<i class="fas fa-exclamation-circle"></i> Error al guardar';
    el.className = 'seg-autosave error';
    setTimeout(function() { el.className = 'seg-autosave'; el.innerHTML = ''; }, 4000);
  }
}