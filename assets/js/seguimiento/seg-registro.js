/* ═══════════════════════════════════════════════════════
   SEGUIMIENTO — seg-registro.js
   segGuardar, segGenerarResumen, segEnviarAlCliente, segPromover, segAddEvento, segSyncTimeline.
═══════════════════════════════════════════════════════ */

function segGuardar() {
  if (!SEG.clienteId) return;
  var nomReg = SEG.labels.registro || 'sesión';
  var btn = document.getElementById('seg-btn-guardar');
  if (btn) { btn.innerHTML = '<i class="fas fa-spinner fa-spin" style="margin-right:5px"></i>Guardando...'; btn.disabled = true; }

  var camposActuales = _segPn.formActivo ? (_segPnConfirmarFijosAbiertos(), segPnRecopilarCampos()) : _segCamposPlantilla;
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
    contenido_principal: document.getElementById('seg-campo-contenido').value,
    tareas:              document.getElementById('seg-campo-tareas').value,
    proxima_cita:        document.getElementById('seg-campo-proxima').value,
    resumen_editado:     (document.getElementById('seg-resumen-text')||{}).innerText || '',
    modo_notas:          _segModoNotas,
    campos_plantilla:    camposActuales
  };

  var url = SEG.registroId ? '/api/seguimiento/registros/' + SEG.registroId : '/api/seguimiento/registros';
  var method = SEG.registroId ? 'PUT' : 'POST';

  segFetch(url, { method: method, body: JSON.stringify(payload) }, function(data) {
    SEG.registroId = data._id || data.id || SEG.registroId;
    SEG.hayUnsaved = false;
    if (btn) { btn.innerHTML = '<i class="fas fa-save" style="margin-right:5px"></i>Guardar ' + nomReg; btn.disabled = false; }
    segToast(nomReg.charAt(0).toUpperCase() + nomReg.slice(1) + ' guardada', 'success');
  }, function() {
    if (btn) { btn.innerHTML = '<i class="fas fa-save" style="margin-right:5px"></i>Guardar ' + nomReg; btn.disabled = false; }
    segToast('Error al guardar', 'error');
  });
}

/* ─────────────────────────────────────────
   GENERAR RESUMEN IA
───────────────────────────────────────── */
function segGenerarResumen() {
  if (!SEG.registroId && !SEG.clienteId) { segToast('Primero guarda el borrador', 'error'); return; }
  if (!SEG.registroId) {
    segGuardar();
    segToast('Guardando antes de generar...', '');
    setTimeout(segGenerarResumen, 1200);
    return;
  }
  segSetTab('cliente', document.getElementById('seg-tab-cliente'));
  segMostrarResumenGenerando();

  // Leer campos del formulario con fallback al contexto
  var reg       = SEG.contexto && SEG.contexto.registro_activo ? SEG.contexto.registro_activo : {};
  var contenido = ((document.getElementById('seg-campo-contenido')||{}).value || reg.contenido_principal || '').trim();
  var tareas    = ((document.getElementById('seg-campo-tareas')||{}).value    || reg.tareas           || '').trim();
  var proxima   = ((document.getElementById('seg-campo-proxima')||{}).value   || reg.proxima_cita     || '').trim();

  if (!contenido && !tareas && !proxima) {
    segLimpiarResumen();
    segToast('Completa al menos un campo antes de generar', 'error');
    return;
  }

  var payload = {
    contenido_principal: contenido,
    tareas:              tareas,
    proxima_cita:        proxima,
    company_id:          SEG.companyId
  };
  segFetch('/api/seguimiento/registros/' + SEG.registroId + '/resumen',
    { method: 'POST', body: JSON.stringify(payload) },
    function(data) {
      segMostrarResumen(data.resumen || data.texto || '');
      if (data.etiquetas && data.etiquetas.length) {
        segMostrarEtiquetasIA(data.etiquetas);
      }
      if (data.aviso) {
        segToast(data.aviso, 'error');
      }
    },
    function() { segLimpiarResumen(); segToast('Error al generar resumen', 'error'); }
  );
}

function segRegenerarResumen() {
  segGenerarResumen();
}

/* ─────────────────────────────────────────
   CANAL DE ENVÍO
───────────────────────────────────────── */
SEG._canal = 'whatsapp';

function segSetCanal(canal, el) {
  SEG._canal = canal;
  document.querySelectorAll('.seg-canal-chip').forEach(function(c) {
    c.classList.remove('active');
  });
  if (el) el.classList.add('active');
  // Resetear estado enviado si cambia el canal
  var badge = document.getElementById('seg-enviado-badge');
  if (badge) badge.classList.add('seg-hidden');
  var btnEnviar = document.getElementById('seg-btn-enviar-cliente');
  if (btnEnviar) { btnEnviar.disabled = false; btnEnviar.innerHTML = '<i class="fas fa-paper-plane seg-icon-mr-sm"></i>Enviar al cliente'; }
}

/* ─────────────────────────────────────────
   ETIQUETAS SUGERIDAS POR IA
───────────────────────────────────────── */
function segMostrarEtiquetasIA(etiquetas) {
  var wrap  = document.getElementById('seg-etiquetas-ia-wrap');
  var chips = document.getElementById('seg-etiquetas-ia-chips');
  if (!wrap || !chips) return;
  chips.innerHTML = etiquetas.map(function(et) {
    var yaActiva = SEG.etiquetasActivas.indexOf(et) !== -1;
    return '<span class="seg-etiqueta-ia-chip' + (yaActiva ? ' aceptada' : '') + '"' +
      ' onclick="segAceptarEtiquetaIA(\'' + segEscape(et) + '\', this)">' +
      (yaActiva ? '<i class="fas fa-check"></i> ' : '<i class="fas fa-plus"></i> ') +
      segEscape(et) + '</span>';
  }).join('');
  wrap.classList.remove('seg-hidden');
}

function segAceptarEtiquetaIA(etiqueta, el) {
  if (SEG.etiquetasActivas.indexOf(etiqueta) === -1) {
    SEG.etiquetasActivas.push(etiqueta);
    segRenderizarChipsEtiquetas();
    segMarcarCambios();
  }
  if (el) {
    el.classList.add('aceptada');
    el.innerHTML = '<i class="fas fa-check"></i> ' + segEscape(etiqueta);
  }
}

/* ─────────────────────────────────────────
   ENVIAR AL CLIENTE
───────────────────────────────────────── */
function segEnviarAlCliente() {
  if (!SEG.registroId) { segToast('Primero guarda el borrador', 'error'); return; }
  var resumen = document.getElementById('seg-resumen-text').innerText || '';
  if (!resumen.trim()) { segToast('El resumen está vacío', 'error'); return; }

  var canal = SEG._canal || 'whatsapp';

  // Para email: pedir email si no está en el contexto
  if (canal === 'email') {
    var emailCtx = (SEG.contexto && SEG.contexto.cliente && SEG.contexto.cliente.email) || '';
    if (!emailCtx) {
      segPrompt('¿Cuál es el email del cliente?', function(email) {
        if (!email || !email.includes('@')) { segToast('Email inválido', 'error'); return; }
        _segEnviarConEmail(resumen, canal, email);
      });
      return;
    }
    _segEnviarConEmail(resumen, canal, emailCtx);
    return;
  }

  _segEnviarConEmail(resumen, canal, '');
}

function _segEnviarConEmail(resumen, canal, clienteEmail) {
  var btnEnviar = document.getElementById('seg-btn-enviar-cliente');
  if (btnEnviar) { btnEnviar.disabled = true; btnEnviar.innerHTML = '<i class="fas fa-spinner fa-spin seg-icon-mr-sm"></i>Enviando...'; }

  segFetch('/api/seguimiento/registros/' + SEG.registroId + '/enviar',
    { method: 'POST', body: JSON.stringify({
        resumen:          resumen,
        canal:            canal,
        company_id:       SEG.companyId,
        cliente_email:    clienteEmail,
        chips_sintoma:    (_segChips.sintoma||[]).slice(),
        chips_diagnostico:(_segChips.diagnostico||[]).slice(),
        chips_hipotesis:  (_segChips.hipotesis||[]).slice(),
        chips_trabajar:   (_segChips.trabajar||[]).slice()
    }) },
    function() {
      // Badge "Enviado por X" en Tab 2
      var badge   = document.getElementById('seg-enviado-badge');
      var badgeTxt = document.getElementById('seg-enviado-txt');
      var iconMap = { whatsapp: 'WhatsApp', chat: 'Chat Heavensy', email: 'Email' };
      if (badgeTxt) badgeTxt.textContent = 'Enviado por ' + (iconMap[canal] || canal);
      if (badge) badge.classList.remove('seg-hidden');
      if (btnEnviar) { btnEnviar.disabled = true; btnEnviar.innerHTML = '<i class="fas fa-check seg-icon-mr-sm"></i>Enviado'; }

      // Badge de estado en hero y date-row
      var heroStatus = document.getElementById('seg-hero-status');
      if (heroStatus) heroStatus.textContent = SEG.labels.status_sent || 'Enviado';
      var badgeEstado = document.getElementById('seg-badge-estado');
      if (badgeEstado) badgeEstado.textContent = SEG.labels.status_sent || 'Enviado';

      // Actualizar tarjeta activa en historial directamente en el DOM
      var card = document.querySelector('.seg-hist-card.active');
      if (card) {
        var badgeCard = card.querySelector('.seg-hist-badge');
        if (badgeCard) {
          badgeCard.className = 'seg-hist-badge enviado';
          badgeCard.textContent = 'Enviado';
        }
      }
      // También actualizar en la lista de entidades del panel izquierdo
      if (SEG.clienteId) {
        var entityItem = document.querySelector('.seg-entity-item[data-wa-id="' + SEG.clienteId + '"]');
        if (entityItem) {
          var dot = entityItem.querySelector('.seg-entity-dot');
          if (dot) { dot.className = 'seg-entity-dot dot-sent'; }
        }
      }

      segToast('Enviado por ' + (iconMap[canal] || canal), 'success');
    },
    function() {
      if (btnEnviar) { btnEnviar.disabled = false; btnEnviar.innerHTML = '<i class="fas fa-paper-plane seg-icon-mr-sm"></i>Enviar al cliente'; }
      segToast('Error al enviar', 'error');
    }
  );
}

// Mantener funciones legacy por compatibilidad
function segEnviarWA()    { SEG._canal = 'whatsapp'; segEnviarAlCliente(); }
function segEnviarEmail() { SEG._canal = 'email';    segEnviarAlCliente(); }



/* ─────────────────────────────────────────
   PROMOVER
───────────────────────────────────────── */
function segPromover() {
  if (!SEG.clienteId) return;
  var lb = SEG.labels;
  segConfirm('¿Promover este contacto a ' + (lb.cliente||'cliente') + '?', function() {
    segFetch('/api/seguimiento/clientes/' + SEG.clienteId + '/promover',
      { method: 'POST', body: JSON.stringify({ company_id: SEG.companyId }) },
      function() {
        segToast('Promovido a ' + (lb.cliente||'cliente'), 'success');
        var btn = document.getElementById('seg-btn-promover');
        if (btn) btn.classList.add('seg-hidden');
      },
      function() { segToast('Error al promover', 'error'); }
    );
  });
}

/* ─────────────────────────────────────────
   TIMELINE
───────────────────────────────────────── */
function segAddEvento() {
  var anioActual = new Date().getFullYear();
  segPromptNumero('Año del evento', 1900, anioActual, anioActual, function(anio) {
    segPrompt('Descripción', 'ej: Primera consulta', function(label) {
      segFetch('/api/seguimiento/clientes/' + SEG.clienteId + '/timeline',
        { method: 'POST', body: JSON.stringify({ company_id: SEG.companyId, anio: parseInt(anio), titulo: label }) },
        function(data) {
          if (SEG.contexto) {
            SEG.contexto.timeline = SEG.contexto.timeline || [];
            SEG.contexto.timeline.push({ anio: parseInt(anio), titulo: label, _id: data._id });
            segRenderizarTimeline(SEG.contexto.timeline, SEG.labels.timeline_titulo, SEG.labels.timeline_inicio);
            segRenderizarTLEdit(SEG.contexto.timeline, SEG.labels.timeline_titulo);
          }
          segToast('Evento agregado', 'success');
        },
        function() { segToast('Error al agregar evento', 'error'); }
      );
    });
  });
}

function segPromptNumero(titulo, min, max, defaultVal, onAceptar) {
  var overlay = document.getElementById('seg-modal-overlay');
  var title   = document.getElementById('seg-modal-title');
  var inputW  = document.getElementById('seg-modal-input-wrap');
  var input   = document.getElementById('seg-modal-input');
  var btnOk   = document.getElementById('seg-modal-ok');
  var btnCan  = document.getElementById('seg-modal-cancel');
  if (!overlay) return;

  title.textContent    = titulo;
  inputW.style.display = 'block';
  input.type           = 'number';
  input.min            = min;
  input.max            = max;
  input.value          = defaultVal;
  input.placeholder    = min + ' - ' + max;
  btnOk.textContent    = 'Aceptar';
  btnOk.className      = 'seg-modal-btn seg-modal-btn-primary';
  overlay.classList.remove('seg-hidden');
  setTimeout(function() { input.select(); }, 80);

  btnOk.onclick = function() {
    var val = parseInt(input.value);
    if (isNaN(val) || val < min || val > max) {
      input.style.borderColor = '#ef4444';
      input.focus();
      return;
    }
    input.type = 'text'; // reset para próximo uso
    input.style.borderColor = '';
    overlay.classList.add('seg-hidden');
    if (onAceptar) onAceptar(val);
  };
  btnCan.onclick = function() {
    input.type = 'text';
    input.style.borderColor = '';
    overlay.classList.add('seg-hidden');
  };
  input.onkeydown = function(e) {
    if (e.key === 'Enter')  btnOk.onclick();
    if (e.key === 'Escape') btnCan.onclick();
  };
}

function segEliminarEvento(eventoId) {
  segConfirm('¿Eliminar este evento?', function() {
  segFetch('/api/seguimiento/timeline/' + eventoId,
    { method: 'DELETE', body: JSON.stringify({ company_id: SEG.companyId }) },
    function() {
      if (SEG.contexto) {
        SEG.contexto.timeline = (SEG.contexto.timeline||[]).filter(function(ev){ return ev._id !== eventoId; });
        segRenderizarTimeline(SEG.contexto.timeline, SEG.labels.timeline_titulo, SEG.labels.timeline_inicio);
        segRenderizarTLEdit(SEG.contexto.timeline, SEG.labels.timeline_titulo);
      }
      segToast('Evento eliminado', 'success');
    },
    function() { segToast('Error al eliminar', 'error'); }
  );
  }); // cierre segConfirm
}

function segSyncTimeline() {
  if (!SEG.clienteId) return;
  segFetch('/api/seguimiento/clientes/' + SEG.clienteId + '/timeline/sync',
    { method: 'POST', body: JSON.stringify({ company_id: SEG.companyId }) },
    function(data) {
      if (data.timeline && SEG.contexto) {
        SEG.contexto.timeline = data.timeline;
        segRenderizarTimeline(data.timeline, SEG.labels.timeline_titulo, SEG.labels.timeline_inicio);
        segRenderizarTLEdit(data.timeline, SEG.labels.timeline_titulo);
      }
      segToast('Linea de tiempo sincronizada', 'success');
    },
    function() { segToast('Error al sincronizar', 'error'); }
  );
}