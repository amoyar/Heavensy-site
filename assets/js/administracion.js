// ============================================================
// ADMINISTRACION.JS — Panel Enterprise Heavensy
// ============================================================
// Endpoints que el backend debe implementar:
//
//   GET  /api/companies/:companyId/users
//          → [{ _id, name, email, role, photo_url, is_online, ... }]
//          → Cada user puede tener carga laboral en el mismo objeto
//            o expuesta por el siguiente endpoint:
//
//   GET  /api/companies/:companyId/users/:userId/workload
//          → { conversaciones: N, seguimientos: N, tareas: N,
//               masivos_usados: N, masivos_limite: N, sin_responder: bool }
//
//   GET  /api/seguimientos/vencidos
//          → [{ _id, cliente_nombre, cliente_foto, profesional_nombre,
//               fecha_vencimiento }]
//
//   GET  /api/conversations/priority
//          → [{ _id, cliente_nombre, cliente_foto, atendido_por,
//               ultima_interaccion, sin_ia: true }]
//
//   GET  /api/tasks/unassigned
//          → [{ _id, titulo, fecha_creacion }]
//
//   POST /api/tasks
//          Body: { titulo, descripcion, fecha_limite, asignado_a, creado_por }
//          → { _id, ... }
// ============================================================

// ── Estado interno del módulo ──────────────────────────────
let _adm_pollingTimer  = null;
let _adm_teamUsers     = [];   // cache de usuarios cargados
let _adm_taskTargetId  = null; // userId pre-seleccionado en modal

// ── Getters de contexto ────────────────────────────────────
function _adm_getCompanyId() {
  const user = getUserFromToken();
  return user?.company_id || localStorage.getItem('company_id') || null;
}

function _adm_getMyId() {
  const user = getUserFromToken();
  return user?.user_id || user?.sub || null;
}

// ============================================================
// initAdministracionPage — llamada por el router
// ============================================================
function initAdministracionPage() {
  // Limpiar polling anterior si existía
  if (_adm_pollingTimer) {
    clearInterval(_adm_pollingTimer);
    _adm_pollingTimer = null;
  }

  // Carga inicial de todos los bloques
  adm_cargarEquipo();
  adm_cargarVencidos();
  adm_cargarPrioritarios();
  adm_cargarTareasSinAsignar();

  // Polling cada 30 segundos para actualizar estados
  _adm_pollingTimer = setInterval(() => {
    adm_cargarEquipo(true); // silencioso (sin loader de grid)
    adm_actualizarStats();
  }, 30000);

  // Limpiar polling cuando se sale de la página
  window.addEventListener('hashchange', () => {
    if (_adm_pollingTimer) {
      clearInterval(_adm_pollingTimer);
      _adm_pollingTimer = null;
    }
  }, { once: true });
}

// ============================================================
// adm_cargarEquipo — carga usuarios + carga laboral
// ============================================================
async function adm_cargarEquipo(silencioso = false) {
  const companyId = _adm_getCompanyId();
  if (!companyId) {
    _adm_renderGridVacio('No se pudo obtener la empresa activa.');
    return;
  }

  if (!silencioso) {
    const grid = document.getElementById('adm-team-grid');
    if (grid) grid.innerHTML = '<div class="adm-empty-state"><i class="fas fa-spinner fa-spin"></i><span>Cargando equipo…</span></div>';
  }

  // GET usuarios de la empresa
  const res = await apiCall(`/api/companies/${companyId}/users`);

  let users = [];
  if (res.ok && Array.isArray(res.data)) {
    users = res.data;
  } else if (res.ok && Array.isArray(res.data?.users)) {
    users = res.data.users;
  }

  _adm_teamUsers = users;

  if (users.length === 0) {
    _adm_renderGridVacio('No hay integrantes en el equipo.');
    adm_actualizarStats();
    return;
  }

  // Para cada usuario, intentar cargar carga laboral
  const tarjetas = await Promise.all(users.map(async (user) => {
    let carga = null;
    try {
      const resC = await apiCall(`/api/companies/${companyId}/users/${user._id}/workload`);
      if (resC.ok && resC.data) {
        carga = resC.data;
      }
    } catch (_) {}
    return adm_renderTarjeta(user, carga);
  }));

  const grid = document.getElementById('adm-team-grid');
  if (grid) grid.innerHTML = tarjetas.join('');

  // Poblar select del modal con usuarios actuales
  _adm_poblarSelectModal(users);

  // Actualizar stats del header
  adm_actualizarStats();
}

// ── Utilidad: render grid vacío ────────────────────────────
function _adm_renderGridVacio(msg = 'Sin datos.') {
  const grid = document.getElementById('adm-team-grid');
  if (grid) grid.innerHTML = `<div class="adm-empty-state"><i class="fas fa-users-slash"></i><span>${msg}</span></div>`;
}

// ============================================================
// adm_renderTarjeta — genera HTML de cada tarjeta de miembro
//
// user  → objeto usuario del backend
// carga → { conversaciones, seguimientos, tareas,
//            masivos_usados, masivos_limite, sin_responder }
//          null = sin datos
// ============================================================
function adm_renderTarjeta(user, carga) {
  const nombre  = escapeHtml(user.name || user.nombre || 'Sin nombre');
  const iniciales = _adm_iniciales(nombre);
  const foto    = user.photo_url || user.foto_url || null;
  const online  = user.is_online === true || user.online === true;
  const rol     = user.role || user.rol || 'usuario';

  // Avatar
  const avatarInner = foto
    ? `<img src="${escapeHtml(foto)}" alt="${iniciales}" onerror="this.style.display='none'">`
    : iniciales;

  // Badge de rol
  const rolClass = _adm_rolClass(rol);
  const rolLabel = _adm_rolLabel(rol);

  // Carga laboral — fallback a 0 si no hay datos
  let tieneDatos = carga !== null && carga !== undefined;
  const conv     = tieneDatos ? (carga.conversaciones ?? 0) : 0;
  const segs     = tieneDatos ? (carga.seguimientos   ?? 0) : 0;
  const tareas   = tieneDatos ? (carga.tareas         ?? 0) : 0;
  const masUsado = tieneDatos ? (carga.masivos_usados ?? 0) : 0;
  const masLim   = tieneDatos ? (carga.masivos_limite ?? 10) : 10;
  const sinResp  = tieneDatos ? (carga.sin_responder === true) : false;

  // Porcentaje de carga
  const pct      = adm_calcularCarga({ conversaciones: conv, seguimientos: segs, tareas });
  const barClass = pct < 50 ? 'low' : pct < 80 ? 'medium' : 'high';
  const sobrecargado = pct > 80;

  // Alertas
  let alertasHtml = '';
  if (sobrecargado)  alertasHtml += `<span class="adm-alert-badge adm-alert-overload"><i class="fas fa-exclamation-triangle"></i> Sobrecargado</span>`;
  if (sinResp)       alertasHtml += `<span class="adm-alert-badge adm-alert-noresponse"><i class="fas fa-clock"></i> Sin responder +30 min</span>`;

  const noDataNote = tieneDatos ? '' : '<span class="adm-no-data">Sin datos de carga</span>';

  return `
    <div class="adm-member-card">
      <div class="adm-card-top">
        <div class="adm-avatar">
          ${avatarInner}
          <span class="adm-online-dot ${online ? 'online' : 'offline'}"></span>
        </div>
        <div class="adm-card-info">
          <div class="adm-card-name" title="${nombre}">${nombre}</div>
          <span class="adm-card-role-badge ${rolClass}">${rolLabel}</span>
        </div>
      </div>

      ${alertasHtml ? `<div class="adm-card-alerts">${alertasHtml}</div>` : ''}

      <div class="adm-load-pills">
        <span class="adm-pill" title="Seguimientos">
          <i class="fas fa-layer-group"></i> ${segs}
        </span>
        <span class="adm-pill" title="Conversaciones">
          <i class="fas fa-comments"></i> ${conv}
        </span>
        <span class="adm-pill" title="Tareas">
          <i class="fas fa-list-check"></i> ${tareas}
        </span>
      </div>

      <div class="adm-progress-row">
        <span class="adm-progress-label">Carga</span>
        <div class="adm-progress-bar-wrap">
          <div class="adm-progress-bar-fill ${barClass}" style="width:${pct}%;"></div>
        </div>
        <span class="adm-progress-pct">${pct}%</span>
      </div>

      <div class="adm-masivos-row">
        <i class="fas fa-paper-plane"></i>
        Masivos del mes: <strong>${masUsado}/${masLim}</strong>
      </div>

      ${noDataNote}

      <button class="adm-btn-asignar" onclick="adm_abrirAsignarTarea('${escapeHtml(user._id)}', '${nombre.replace(/'/g, "\\'")}')">
        <i class="fas fa-plus"></i> Asignar tarea
      </button>
    </div>
  `;
}

// ============================================================
// adm_calcularCarga — porcentaje 0-100
// Pesos: conversaciones 40%, seguimientos 40%, tareas 20%
// Máximos: conv=10, seg=8, tareas=15
// ============================================================
function adm_calcularCarga({ conversaciones = 0, seguimientos = 0, tareas = 0 }) {
  const MAX_CONV = 10;
  const MAX_SEG  = 8;
  const MAX_TASK = 15;

  const pConv  = Math.min(conversaciones / MAX_CONV, 1) * 40;
  const pSeg   = Math.min(seguimientos   / MAX_SEG,  1) * 40;
  const pTask  = Math.min(tareas         / MAX_TASK, 1) * 20;

  return Math.round(pConv + pSeg + pTask);
}

// ============================================================
// adm_cargarVencidos — GET /api/seguimientos/vencidos
// ============================================================
async function adm_cargarVencidos() {
  let items = [];
  try {
    const res = await apiCall('/api/seguimientos/vencidos');
    if (res.ok && Array.isArray(res.data)) items = res.data;
    else if (res.ok && Array.isArray(res.data?.seguimientos)) items = res.data.seguimientos;
  } catch (_) {}

  const lista = document.getElementById('adm-list-vencidos');
  const badge = document.getElementById('adm-badge-vencidos');
  if (!lista) return;

  if (badge) {
    badge.textContent = items.length;
    badge.classList.toggle('zero', items.length === 0);
  }

  if (items.length === 0) {
    lista.innerHTML = '<div class="adm-side-empty">Sin seguimientos vencidos</div>';
    return;
  }

  lista.innerHTML = items.map(item => {
    const cNombre  = escapeHtml(item.cliente_nombre  || 'Cliente');
    const pNombre  = escapeHtml(item.profesional_nombre || '—');
    const foto     = item.cliente_foto || null;
    const ini      = _adm_iniciales(cNombre);
    const fecha    = _adm_formatFechaCorta(item.fecha_vencimiento);

    return `
      <div class="adm-side-item">
        <div class="adm-side-avatar">
          ${foto ? `<img src="${escapeHtml(foto)}" alt="${ini}" onerror="this.style.display='none'">` : ini}
        </div>
        <div class="adm-side-info">
          <div class="adm-side-name">${cNombre}</div>
          <div class="adm-side-sub"><i class="fas fa-user-tie" style="font-size:9px;"></i> ${pNombre}</div>
        </div>
        <span class="adm-side-date-red" title="Venció ${fecha}"><i class="fas fa-clock"></i> ${fecha}</span>
      </div>
    `;
  }).join('');

  adm_actualizarStats();
}

// ============================================================
// adm_cargarPrioritarios — GET /api/conversations/priority
// ============================================================
async function adm_cargarPrioritarios() {
  let items = [];
  try {
    const res = await apiCall('/api/conversations/priority');
    if (res.ok && Array.isArray(res.data)) items = res.data;
    else if (res.ok && Array.isArray(res.data?.conversations)) items = res.data.conversations;
  } catch (_) {}

  const lista = document.getElementById('adm-list-prioritarios');
  const badge = document.getElementById('adm-badge-prioritarios');
  if (!lista) return;

  if (badge) {
    badge.textContent = items.length;
    badge.classList.toggle('zero', items.length === 0);
  }

  if (items.length === 0) {
    lista.innerHTML = '<div class="adm-side-empty">Sin clientes prioritarios</div>';
    return;
  }

  lista.innerHTML = items.map(item => {
    const cNombre = escapeHtml(item.cliente_nombre || 'Cliente');
    const aNombre = escapeHtml(item.atendido_por   || '—');
    const foto    = item.cliente_foto || null;
    const ini     = _adm_iniciales(cNombre);
    const fecha   = _adm_formatFechaCorta(item.ultima_interaccion);

    return `
      <div class="adm-side-item">
        <div class="adm-side-avatar">
          ${foto ? `<img src="${escapeHtml(foto)}" alt="${ini}" onerror="this.style.display='none'">` : ini}
        </div>
        <div class="adm-side-info">
          <div class="adm-side-name">${cNombre}</div>
          <div class="adm-side-sub"><i class="fas fa-user" style="font-size:9px;"></i> ${aNombre} · ${fecha}</div>
        </div>
        <span class="adm-side-badge-noai">Sin IA</span>
      </div>
    `;
  }).join('');
}

// ============================================================
// adm_cargarTareasSinAsignar — GET /api/tasks/unassigned
// ============================================================
async function adm_cargarTareasSinAsignar() {
  let items = [];
  try {
    const res = await apiCall('/api/tasks/unassigned');
    if (res.ok && Array.isArray(res.data)) items = res.data;
    else if (res.ok && Array.isArray(res.data?.tasks)) items = res.data.tasks;
  } catch (_) {}

  const lista = document.getElementById('adm-list-sinasignar');
  const badge = document.getElementById('adm-badge-sinasignar');
  if (!lista) return;

  if (badge) {
    badge.textContent = items.length;
    badge.classList.toggle('zero', items.length === 0);
  }

  if (items.length === 0) {
    lista.innerHTML = '<div class="adm-side-empty">No hay tareas sin asignar</div>';
    return;
  }

  lista.innerHTML = items.map(item => {
    const titulo = escapeHtml(item.titulo || 'Tarea sin título');
    const fecha  = _adm_formatFechaCorta(item.fecha_creacion);

    return `
      <div class="adm-side-item adm-task-cola">
        <div class="adm-task-cola-row">
          <span class="adm-task-title" title="${titulo}">${titulo}</span>
          <button class="adm-btn-asignar-cola" onclick="adm_abrirAsignarTarea(null, null, '${escapeHtml(item._id)}', '${titulo.replace(/'/g, "\\'")}')">
            Asignar
          </button>
        </div>
        <span class="adm-task-date"><i class="fas fa-calendar-alt"></i> ${fecha}</span>
      </div>
    `;
  }).join('');

  adm_actualizarStats();
}

// ============================================================
// adm_abrirAsignarTarea — abre el modal pre-seleccionando user
// userId   → ID del miembro (null si viene de la cola)
// userName → nombre del miembro (null si viene de la cola)
// tareaId  → ID de la tarea existente en cola (null si es nueva)
// tareaTit → título pre-cargado si viene de la cola
// ============================================================
function adm_abrirAsignarTarea(userId, userName, tareaId = null, tareaTit = null) {
  _adm_taskTargetId = tareaId || null;

  const modal = document.getElementById('adm-modal-tarea');
  if (!modal) return;

  // Limpiar form
  const inputTit = document.getElementById('adm-tarea-titulo');
  const inputDesc = document.getElementById('adm-tarea-descripcion');
  const inputFecha = document.getElementById('adm-tarea-fecha');
  const selUser = document.getElementById('adm-tarea-asignado');

  if (inputTit)  inputTit.value  = tareaTit || '';
  if (inputDesc) inputDesc.value = '';
  if (inputFecha) {
    // Por defecto: 3 días desde hoy
    const d = new Date();
    d.setDate(d.getDate() + 3);
    inputFecha.value = d.toISOString().slice(0, 16);
  }

  // Pre-seleccionar usuario si aplica
  if (selUser && userId) {
    const opt = selUser.querySelector(`option[value="${userId}"]`);
    if (opt) selUser.value = userId;
  } else if (selUser) {
    selUser.value = '';
  }

  modal.style.display = 'flex';
}

// ── Cerrar modal al click en overlay (fuera del cuadro) ───
function adm_cerrarModal(event) {
  const modal = document.getElementById('adm-modal-tarea');
  if (event.target === modal) adm_cerrarModalDirecto();
}

function adm_cerrarModalDirecto() {
  const modal = document.getElementById('adm-modal-tarea');
  if (modal) modal.style.display = 'none';
  _adm_taskTargetId = null;
}

// ============================================================
// adm_guardarTarea — POST /api/tasks
// Guarda localmente si falla el POST
// ============================================================
async function adm_guardarTarea() {
  const titulo     = document.getElementById('adm-tarea-titulo')?.value.trim();
  const descripcion = document.getElementById('adm-tarea-descripcion')?.value.trim();
  const fechaLimite = document.getElementById('adm-tarea-fecha')?.value;
  const asignadoA   = document.getElementById('adm-tarea-asignado')?.value;

  if (!titulo) {
    showToast('El título es obligatorio.', 'warning');
    document.getElementById('adm-tarea-titulo')?.focus();
    return;
  }

  const myId = _adm_getMyId();

  const payload = {
    titulo,
    descripcion: descripcion || '',
    fecha_limite: fechaLimite || null,
    asignado_a: asignadoA || null,
    creado_por: myId,
    ...(  _adm_taskTargetId ? { tarea_existente_id: _adm_taskTargetId } : {} )
  };

  let guardadoOk = false;

  try {
    const res = await apiCall('/api/tasks', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      guardadoOk = true;
    }
  } catch (_) {}

  if (guardadoOk) {
    showToast('Tarea asignada correctamente.', 'success');
  } else {
    // Fallback: guardar en localStorage
    _adm_guardarTareaLocal(payload);
    showToast('Tarea guardada localmente (sin conexión al servidor).', 'warning');
  }

  adm_cerrarModalDirecto();

  // Refrescar listas
  adm_cargarEquipo(true);
  adm_cargarTareasSinAsignar();
}

// ── Fallback: guardar tarea en localStorage ────────────────
function _adm_guardarTareaLocal(payload) {
  try {
    const key   = 'adm_tareas_locales';
    const prev  = JSON.parse(localStorage.getItem(key) || '[]');
    prev.push({ ...payload, _local_id: Date.now(), _timestamp: new Date().toISOString() });
    localStorage.setItem(key, JSON.stringify(prev));
  } catch (_) {}
}

// ============================================================
// adm_actualizarStats — actualiza los 4 contadores del header
// ============================================================
function adm_actualizarStats() {
  // Online
  const online = _adm_teamUsers.filter(u => u.is_online === true || u.online === true).length;
  _adm_setStat('adm-stat-online', online);

  // Conversaciones activas (suma de todos los miembros)
  let totalConv = 0;
  _adm_teamUsers.forEach(u => { totalConv += (u._carga?.conversaciones ?? 0); });
  _adm_setStat('adm-stat-conv', totalConv);

  // Tareas pendientes (suma)
  let totalTareas = 0;
  _adm_teamUsers.forEach(u => { totalTareas += (u._carga?.tareas ?? 0); });
  // También contar sin asignar (badge)
  const sinAsignarBadge = document.getElementById('adm-badge-sinasignar');
  totalTareas += parseInt(sinAsignarBadge?.textContent || '0', 10);
  _adm_setStat('adm-stat-tareas', totalTareas);

  // Seguimientos vencidos
  const vencidosBadge = document.getElementById('adm-badge-vencidos');
  _adm_setStat('adm-stat-vencidos', parseInt(vencidosBadge?.textContent || '0', 10));
}

function _adm_setStat(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

// ============================================================
// Helpers internos
// ============================================================

// Iniciales (hasta 2 letras) a partir de un nombre
function _adm_iniciales(nombre = '') {
  return nombre
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(p => p[0]?.toUpperCase() || '')
    .join('');
}

// Clase CSS de badge por rol
function _adm_rolClass(rol = '') {
  const r = rol.toLowerCase();
  if (r.includes('admin'))      return 'adm-role-admin';
  if (r.includes('prof'))       return 'adm-role-profesional';
  if (r.includes('secret'))     return 'adm-role-secretaria';
  return 'adm-role-default';
}

// Etiqueta legible de rol
function _adm_rolLabel(rol = '') {
  const labels = {
    admin: 'Administrador',
    administrador: 'Administrador',
    profesional: 'Profesional',
    secretaria: 'Secretaria',
    secretario: 'Secretario',
    usuario: 'Usuario',
    owner: 'Dueño'
  };
  return labels[rol.toLowerCase()] || rol;
}

// Fecha corta legible
function _adm_formatFechaCorta(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: '2-digit' });
  } catch (_) {
    return iso;
  }
}

// Poblar el <select> del modal con los usuarios disponibles
function _adm_poblarSelectModal(users) {
  const sel = document.getElementById('adm-tarea-asignado');
  if (!sel) return;

  const current = sel.value;
  sel.innerHTML = '<option value="">Seleccionar integrante…</option>';

  users.forEach(u => {
    const opt = document.createElement('option');
    opt.value = u._id;
    opt.textContent = u.name || u.nombre || u.email || u._id;
    sel.appendChild(opt);
  });

  if (current) sel.value = current;
}

// ============================================================
// Exposición global — requerida por router y HTML inline
// ============================================================
window.initAdministracionPage  = initAdministracionPage;
window.adm_abrirAsignarTarea   = adm_abrirAsignarTarea;
window.adm_guardarTarea        = adm_guardarTarea;
window.adm_cerrarModal         = adm_cerrarModal;
window.adm_cerrarModalDirecto  = adm_cerrarModalDirecto;
window.adm_cargarEquipo        = adm_cargarEquipo;
