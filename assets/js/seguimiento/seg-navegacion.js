/* ═══════════════════════════════════════════════════════
   SEGUIMIENTO — seg-navegacion.js
   segSeleccionarRegistro (carga registro del historial), segBuscar, segSetTab, segToggleTL.
═══════════════════════════════════════════════════════ */

function segSeleccionarRegistro(registroId) {
  if (!registroId) return;
  if (SEG.hayUnsaved) {
    segConfirm('Hay cambios sin guardar. ¿Continuar?', function() {
      SEG.hayUnsaved = false;
      segSeleccionarRegistro(registroId);
    });
    return;
  }

  // Marcar card como cargando, bloquear otras
  document.querySelectorAll('.seg-hist-card').forEach(function(el) {
    el.classList.remove('active', 'seg-hist-loading');
    el.style.pointerEvents = 'none';
  });
  var cardCargando = document.getElementById('hist-' + registroId);
  if (cardCargando) cardCargando.classList.add('seg-hist-loading');
  SEG.registroId = registroId;
  segFetch('/api/seguimiento/registros/' + registroId, {}, function(resp) {
    // El endpoint devuelve { ok: true, registro: {...} }
    var data = resp.registro || resp;
    var lb = SEG.labels;

    // Siempre partir desde el editor antes de cargar el nuevo registro
    segPnResetearVista();

    var tc = document.getElementById('seg-campo-contenido');
    var tt = document.getElementById('seg-campo-tareas');
    var tp = document.getElementById('seg-campo-proxima');
    var tn = document.getElementById('seg-campo-notas');
    var tf = document.getElementById('seg-campo-fecha');
    var th = document.getElementById('seg-campo-hora');
    if (tc) tc.value = data.contenido_principal || '';
    if (tt) tt.value = data.tareas || '';
    if (tp) tp.value = data.proxima_cita || '';
    if (tn) { tn.innerText = data.notas_internas || ''; segInicializarEditorNotas(); }
    // Cargar chips
    segLimpiarTodosChips();
    var _hayUnsavedBak2 = SEG.hayUnsaved;
    SEG.hayUnsaved = false;
    if (data.chips_sintoma)     (data.chips_sintoma||[]).forEach(function(c){ segAgregarChip('sintoma',c); });
    if (data.chips_diagnostico) (data.chips_diagnostico||[]).forEach(function(c){ segAgregarChip('diagnostico',c); });
    if (data.chips_hipotesis)   (data.chips_hipotesis||[]).forEach(function(c){ segAgregarChip('hipotesis',c); });
    _segChips.trabajar = (data.chips_trabajar || []).slice();
    // Limpiar intensidades anteriores y cargar las de este registro
    _segIntensidades = {};
    segRenderizarSeccionTrabajar();
    segActualizarHeroChipsTrabajar();
    SEG.hayUnsaved = _hayUnsavedBak2;
    // Cargar intensidades desde BD (actualiza los badges al llegar)
    segCargarIntensidades();
    if (tf) tf.value = data.fecha || '';
    if (th) th.value = data.hora || '';
    // Etiquetas del registro (array de strings)
    SEG.etiquetasActivas = (data.etiquetas || []).map(function(e) {
      return typeof e === 'string' ? e : (e.nombre || '');
    }).filter(Boolean);
    segRenderizarChipsEtiquetas();
    // Adjuntos
    SEG._adjuntos = data.adjuntos || [];
    segRenderizarAdjuntos();
    // Resumen
    var resumenTexto = data.resumen_editado || data.resumen_ia || data.resumen;
    if (resumenTexto) segMostrarResumen(resumenTexto);
    else segLimpiarResumen();
    // Actualizar badge de estado
    var badgeEl = document.getElementById('seg-badge-estado');
    if (badgeEl) badgeEl.textContent = data.estado === 'en_curso'
      ? (lb.status_active||'En curso') : (lb.status_pending||'Pendiente');
    SEG.hayUnsaved = false;
    // Restaurar cards — quitar loading, marcar activa
    document.querySelectorAll('.seg-hist-card').forEach(function(el) {
      el.classList.remove('seg-hist-loading');
      el.style.pointerEvents = '';
    });
    var cardActiva = document.getElementById('hist-' + registroId);
    if (cardActiva) cardActiva.classList.add('active');
    // Restaurar modo plantilla si el registro fue guardado con una
    if (data.modo_notas && data.modo_notas.indexOf('plantilla:') === 0) {
      var _pidHist = data.modo_notas.replace('plantilla:', '');
      setTimeout(function() {
        segPnFormAbrir(_pidHist, data.campos_plantilla || []);
      }, 150);
    }
  }, function() {
    // Error — restaurar cards
    document.querySelectorAll('.seg-hist-card').forEach(function(el) {
      el.classList.remove('seg-hist-loading');
      el.style.pointerEvents = '';
    });
    segToast('Error al cargar el registro', 'error');
  });
}

/* ─────────────────────────────────────────
   BUSQUEDA
───────────────────────────────────────── */
function segBuscar(query) {
  var q = (query||'').toLowerCase().trim();
  if (!q) { segRenderizarLista(SEG.hayTodas); return; }
  segRenderizarLista(SEG.hayTodas.filter(function(e) {
    return (e.nombre||'').toLowerCase().includes(q) ||
           (e.wa_id||'').toLowerCase().includes(q) ||
           (e.especialidad||'').toLowerCase().includes(q);
  }));
}

/* ─────────────────────────────────────────
   TABS
───────────────────────────────────────── */
function segSetTab(id, el) {
  document.querySelectorAll('.seg-tab').forEach(function(t){ t.classList.remove('active'); });
  document.querySelectorAll('.seg-tab-panel').forEach(function(p){ p.classList.remove('active'); });
  if (el) el.classList.add('active');
  var panel = document.getElementById('seg-panel-' + id);
  if (panel) panel.classList.add('active');
}

/* ─────────────────────────────────────────
   TIMELINE TOGGLE
───────────────────────────────────────── */
function segToggleTL() {
  var c  = document.getElementById('seg-tl-content');
  var ch = document.getElementById('seg-tl-chev');
  if (!c) return;
  SEG.tl_visible = !SEG.tl_visible;
  c.style.display = SEG.tl_visible ? 'flex' : 'none';
  if (ch) ch.style.transform = SEG.tl_visible ? '' : 'rotate(-90deg)';
}