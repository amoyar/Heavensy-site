// ═══════════════════════════════════════════════
//  ROLES Y PERMISOS — HEAVENSY
// ═══════════════════════════════════════════════
// ── BITÁCORA ──
// 2026-06-04 | Fix: rolCargarMiPlan autosuficiente (lee company_id del token si
//              rolCurrentUser no está seteado; el panel se monta desde companies.js).
// 2026-06-04 | Candado upsell (vista empresa): franja "Tu plan", tab del plan
//              propio con badge y hints "Desde [plan]", tabs superiores con
//              candado y banner upsell, badge "No incluido" si el rol no está
//              en el plan. Init reordenado: plan+matriz cargan antes del render.
// 2026-06-03 | UI: labels PLAN/ROL en el panel SA; chevron de colapso como
//              botón circular clickeable; lista de Roles de Empresa envuelta
//              en card contenedora con header violeta colapsable.

// ── CATASTRO COMPLETO DE SECCIONES ────────────────────────────────────────────
// Valor inicial; en initRolesPage() se reemplaza con los módulos de la BD
// (GET /api/system-roles/modules) vía rolHidratarModelo().
let ROL_CATALOGO = [
  {
    id: 'conversaciones', label: 'Conversaciones', icon: 'fa-comments', color: '#8b5cf6',
    acciones: [
      // Chat principal
      { id: 'ver',               label: 'Ver conversaciones' },
      { id: 'responder',         label: 'Responder mensajes' },
      { id: 'toggle_ia',         label: 'Activar / desactivar IA' },
      { id: 'respuestas_rapidas',label: 'Usar respuestas rápidas' },
      { id: 'adjuntar',          label: 'Adjuntar archivos' },
      { id: 'grabar_audio',      label: 'Grabar audio' },
      // Panel derecho — Contacto
      { id: 'cliente_vip',       label: 'Marcar como Cliente VIP' },
      { id: 'tags',              label: 'Ver y gestionar tags' },
      { id: 'notas',             label: 'Ver y agregar notas' },
      // Panel derecho
      { id: 'embudos',      label: 'Embudos: ver / cambiar etapa / agregar / eliminar' },
      { id: 'seguimiento',  label: 'Seguimiento: ver / crear / editar / completar' },
      { id: 'agenda',       label: 'Agenda: ver cupos / reservar / confirmar / cancelar' },
      { id: 'calendario',   label: 'Calendario de citas: ver / confirmar' },
    ]
  },
  {
    id: 'agenda', label: 'Agenda', icon: 'fa-calendar-alt', color: '#3b82f6',
    acciones: [
      { id: 'ver',             label: 'Ver disponibilidad propia' },
      { id: 'ver_todas',       label: 'Ver disponibilidad de todos' },
      { id: 'gestion_manual',  label: 'Gestión manual de reservas' },
    ]
  },
  {
    id: 'embudos', label: 'Embudos', icon: 'fa-filter', color: '#f59e0b',
    acciones: [
      { id: 'ver',              label: 'Ver embudos' },
      { id: 'editar',           label: 'Editar embudo' },
      { id: 'mover',            label: 'Mover contactos' },
      { id: 'masivos',          label: 'Mensajes masivos/mes', type: 'number' },
      { id: 'seleccionar_card', label: 'Seleccionar card y enviar mensajes' },
    ]
  },
  {
    id: 'chat_interno', label: 'Chat Interno', icon: 'fa-comments', color: '#0891b2',
    acciones: [
      { id: 'acceder',          label: 'Acceder al chat' },
      { id: 'crear_salas',      label: 'Crear salas' },
      { id: 'administrar_salas',label: 'Administrar salas' },
      { id: 'asignar_tareas',   label: 'Asignar tareas' },
      { id: 'crear_votacion',   label: 'Crear votación' },
      { id: 'programar_mensajes', label: 'Programar mensajes' },
      { id: 'crear_notas',      label: 'Crear notas ancladas' },
    ]
  },
  {
    id: 'seguimiento', label: 'Seguimiento', icon: 'fa-clipboard-list', color: '#06b6d4',
    acciones: [
      { id: 'ver',              label: 'Ver seguimientos' },
      { id: 'crear',            label: 'Seguimientos/mes', type: 'number' },
      { id: 'linea_tiempo',     label: 'Línea de tiempo con IA' },
      { id: 'evolucion',        label: 'Evolución de progreso' },
      { id: 'notas_sesion',     label: 'Notas de sesión' },
      { id: 'plantillas',       label: 'Plantillas' },
      { id: 'chips_clinicos',   label: 'Chips de síntomas, diagnósticos e hipótesis' },
      { id: 'resumen_ia',       label: 'Resumen IA de lo trabajado' },
      { id: 'agendar_ia',       label: 'Agendar con IA y recordatorios' },
      { id: 'historial',        label: 'Acceso a historial' },
      { id: 'derivaciones',     label: 'Derivaciones con resumen IA según el rubro' },
    ]
  },
  {
    id: 'usuarios', label: 'Usuarios', icon: 'fa-users', color: '#7c3aed',
    acciones: [
      { id: 'ver',      label: 'Ver usuarios' },
      { id: 'crear',    label: 'Crear usuario', type: 'number' },
      { id: 'editar',   label: 'Editar usuario' },
      { id: 'eliminar', label: 'Eliminar usuario' },
    ]
  },
  {
    id: 'roles', label: 'Roles y Permisos', icon: 'fa-shield-alt', color: '#4f46e5',
    acciones: [
      { id: 'ver',     label: 'Ver roles' },
      { id: 'crear',   label: 'Crear rol', type: 'number' },
      { id: 'editar',  label: 'Editar permisos' },
      { id: 'asignar', label: 'Asignar rol a usuario' },
    ]
  },
  {
    id: 'configuracion', label: 'Configuración', icon: 'fa-cog', color: '#64748b',
    acciones: [
      { id: 'ver',              label: 'Ver configuración' },
      { id: 'editar_empresa',   label: 'Editar configuración de la empresa' },
      { id: 'editar_propia',    label: 'Editar configuración profesional propia' },
      { id: 'editar_usuarios',  label: 'Editar configuración de usuarios de la empresa' },
      { id: 'archivos_50mb',    label: 'Videos / Imágenes 50mb' },
      { id: 'imagenes_5mb',     label: 'Imágenes 5mb' },
      { id: 'capacidad_equipo', label: 'Capacidad del equipo', type: 'number' },
    ]
  },
  {
    id: 'calendario', label: 'Calendario', icon: 'fa-calendar-alt', color: '#0ea5e9',
    acciones: [
      { id: 'ver',                  label: 'Ver calendario' },
      { id: 'bloqueos',             label: 'Agregar bloqueos de agenda' },
      { id: 'bloques_masivos',      label: 'Agregar bloques masivos' },
      { id: 'agenda_propia',        label: 'Revisar agenda profesional propia' },
      { id: 'agenda_profesionales', label: 'Revisar agenda de todos los profesionales' },
      { id: 'agenda_todos',         label: 'Revisar agenda de todos' },
      { id: 'reagendar',            label: 'Reagendar' },
    ]
  },
  {
    id: 'dashboard', label: 'Dashboard', icon: 'fa-chart-pie', color: '#1d4ed8',
    acciones: [
      { id: 'ver_metricas', label: 'Ver métricas' },
    ]
  },
  {
    id: 'empresas', label: 'Empresas', icon: 'fa-building', color: '#0284c7',
    acciones: [
      { id: 'ver',             label: 'Ver empresas' },
      { id: 'crear',           label: 'Crear empresas', type: 'number' },
      { id: 'gestionar',       label: 'Gestionar empresas' },
      { id: 'cantidad_rubros', label: 'Cantidad de rubros', type: 'number' },
    ]
  },
  {
    id: 'pagina_publica', label: 'Página Pública', icon: 'fa-globe', color: '#0d9488',
    acciones: [
      { id: 'visualizar', label: 'Visualizar' },
    ]
  },
  {
    id: 'mi_perfil', label: 'Mi Perfil Personal', icon: 'fa-user-circle', color: '#5b21b6',
    acciones: [
      { id: 'visualizar', label: 'Visualizar' },
      { id: 'editar',     label: 'Editar' },
    ]
  },
  {
    id: 'ia', label: 'Inteligencia Artificial', icon: 'fa-robot', color: '#2563eb',
    acciones: [
      { id: 'usar',                 label: 'Usar IA' },
      { id: 'configurar',           label: 'Configurar IA' },
      { id: 'ver_logs',             label: 'Ver logs de IA' },
      { id: 'asistente_programada', label: 'Asistente programada' },
      { id: 'asistente_personal',   label: 'Asistente personalizada' },
      { id: 'cantidad_mensajes',    label: 'Cantidad de mensajes', type: 'number' },
    ]
  },
];

const ROL_COLORS = [
  '#8e84fa','#5a79d4','#10b981','#f59e0b',
  '#ef4444','#ec4899','#6366f1','#14b8a6',
  '#8b5cf6','#64748b','#0ea5e9','#7c3aed',
];

// ── PLANES ────────────────────────────────────────────────────────────────────
// Valor inicial; se reemplaza con los planes de la BD (GET /api/system-roles/plans).
let ROL_PLANES = [
  { id: 'gratis',          label: 'Gratis',              color: '#9ca3af' },
  { id: 'automate',        label: 'Automate Pro',        color: '#3b82f6' },
  { id: 'secretaria',      label: 'Secretar IA Premium', color: '#8b5cf6' },
  { id: 'enterprise',      label: 'Enterprise',          color: '#f59e0b' },
  { id: 'enterprise_full', label: 'Enterprise Full',     color: '#10b981' },
];

// Estado de permisos por plan — se carga desde API o usa defaults
let rolPlanConfig = null;

function rolPlanConfigDefault() {
  // Generar estructura base (todo false)
  const cfg = {};
  ROL_CATALOGO.forEach(mod => {
    cfg[mod.id] = {};
    ROL_PLANES.forEach(plan => {
      cfg[mod.id][plan.id] = {};
      ROL_DEFAULTS.forEach(rol => {
        cfg[mod.id][plan.id][rol.role_id] = {};
        mod.acciones.forEach(acc => { cfg[mod.id][plan.id][rol.role_id][acc.id] = false; });
      });
    });
  });

  // ── PLAN GRATIS — configuración definida ──────────────────────────────────────
  const G = 'gratis', A = 'ADMIN_ROL';
  // Conversaciones
  cfg.conversaciones[G][A] = {ver:true,responder:true,toggle_ia:false,respuestas_rapidas:true,adjuntar:true,grabar_audio:true,cliente_vip:false,tags:true,notas:true,embudos:false,seguimiento:false,agenda:false,calendario:false};
  // Chat interno
  cfg.chat_interno[G][A] = {acceder:true,crear_salas:true,administrar_salas:true,asignar_tareas:false,crear_votacion:false,programar_mensajes:false,crear_notas:false};
  // Usuarios
  cfg.usuarios[G][A] = {ver:true,crear:false,editar:false,eliminar:false};
  // Roles
  cfg.roles[G][A] = {ver:true,crear:false,editar:false,asignar:false};
  // Configuración
  cfg.configuracion[G][A] = {ver:true,editar_empresa:true,editar_propia:false,editar_usuarios:false};
  // Dashboard
  cfg.dashboard[G][A] = {ver_metricas:true};
  // Empresas
  cfg.empresas[G][A] = {ver:true,crear:false,gestionar:false};
  // Página pública
  cfg.pagina_publica[G][A] = {visualizar:true};
  // Mi perfil
  cfg.mi_perfil[G][A] = {visualizar:true,editar:true};

  // Roles activos por plan
  cfg._rolesActivos = {
    gratis:         {ADMIN_ROL:true, OPERADOR_ROL:false, SUPERVISOR_ROL:false, PROFESIONAL_ROL:false, ASISTENTE_ROL:false},
    automate:       {ADMIN_ROL:true, OPERADOR_ROL:true,  SUPERVISOR_ROL:true,  PROFESIONAL_ROL:true,  ASISTENTE_ROL:true},
    secretaria:     {ADMIN_ROL:true, OPERADOR_ROL:true,  SUPERVISOR_ROL:true,  PROFESIONAL_ROL:true,  ASISTENTE_ROL:true},
    enterprise:     {ADMIN_ROL:true, OPERADOR_ROL:true,  SUPERVISOR_ROL:true,  PROFESIONAL_ROL:true,  ASISTENTE_ROL:true},
    enterprise_full:{ADMIN_ROL:true, OPERADOR_ROL:true,  SUPERVISOR_ROL:true,  PROFESIONAL_ROL:true,  ASISTENTE_ROL:true},
  };

  // Secciones activas por plan+rol
  cfg._seccionesActivas = {};
  const todasActivas = {conversaciones:true,agenda:true,embudos:true,chat_interno:true,seguimiento:true,usuarios:true,roles:true,configuracion:true,calendario:true,dashboard:true,empresas:true,pagina_publica:true,mi_perfil:true,ia:true};
  const gratisAdmin  = {conversaciones:true,agenda:false,embudos:false,chat_interno:true,seguimiento:false,usuarios:true,roles:true,configuracion:true,calendario:false,dashboard:true,empresas:true,pagina_publica:true,mi_perfil:true,ia:false};
  ROL_PLANES.forEach(plan => {
    cfg._seccionesActivas[plan.id] = {};
    ROL_DEFAULTS.forEach(rol => {
      cfg._seccionesActivas[plan.id][rol.role_id] = (plan.id === 'gratis' && rol.role_id === 'ADMIN_ROL')
        ? Object.assign({}, gratisAdmin)
        : Object.assign({}, todasActivas);
    });
  });

  return cfg;
}

async function rolCargarPlanConfig() {
  try {
    const res = await apiCall('/api/system-roles/plan-config').catch(() => null);
    // apiCall envuelve en .data el JSON del backend, que a su vez trae .data.config
    if (res?.ok && res?.data?.data?.config) {
      rolPlanConfig = res.data.data.config;
    } else {
      // Fallback: cargar desde localStorage si existe
      const local = localStorage.getItem('heavensy_plan_config');
      rolPlanConfig = local ? JSON.parse(local) : rolPlanConfigDefault();
    }
  } catch {
    const local = localStorage.getItem('heavensy_plan_config');
    rolPlanConfig = local ? JSON.parse(local) : rolPlanConfigDefault();
  }
}

async function rolGuardarPlanConfig(btn) {
  // Feedback en el propio botón (no dependemos de showToast)
  const original = btn ? btn.innerHTML : null;
  const setBtn = (html, bg) => {
    if (!btn) return;
    btn.innerHTML = html;
    if (bg !== undefined) btn.style.background = bg;
  };
  const resetBtn = () => {
    if (!btn) return;
    setTimeout(() => { btn.innerHTML = original; btn.style.background = ''; btn.disabled = false; }, 2000);
  };

  if (btn) btn.disabled = true;
  setBtn('<i class="fas fa-spinner fa-spin"></i> Guardando...');

  try {
    const res = await apiCall('/api/system-roles/plan-config', {
      method: 'PUT',
      body: JSON.stringify({ config: rolPlanConfig })
    });
    if (res?.ok) {
      setBtn('<i class="fas fa-check"></i> Planes guardados', '#10b981');
    } else {
      const msg = res?.data?.error || 'Error al guardar';
      console.error('Error guardando plan-config:', res);
      setBtn('<i class="fas fa-times"></i> ' + msg, '#ef4444');
    }
  } catch (e) {
    console.error('Excepción guardando plan-config:', e);
    setBtn('<i class="fas fa-times"></i> Error de conexión', '#ef4444');
  } finally {
    resetBtn();
  }
}

function rolTogglePlanPerm(modId, planId, roleId, accId, checked) {
  if (!rolPlanConfig) rolPlanConfig = rolPlanConfigDefault();
  if (!rolPlanConfig[modId]) rolPlanConfig[modId] = {};
  if (!rolPlanConfig[modId][planId]) rolPlanConfig[modId][planId] = {};
  if (!rolPlanConfig[modId][planId][roleId]) rolPlanConfig[modId][planId][roleId] = {};
  rolPlanConfig[modId][planId][roleId][accId] = checked;
  // Sincronizar con la franja del rol normal
  const viewChk = document.getElementById('rol-view-chk-' + modId + '-' + planId + '-' + roleId + '-' + accId);
  if (viewChk) viewChk.checked = checked;
}

function rolGlobalSwitchPlan(planId, btn) {
  document.querySelectorAll('.rol-sa-global-plan-tab').forEach(t => t.classList.remove('active'));
  if (btn) btn.classList.add('active');
  // Cambiar plan directamente por ID en cada módulo
  ROL_CATALOGO.forEach(mod => {
    const modEl = document.getElementById('rol-mod-' + mod.id);
    if (!modEl) return;
    modEl.querySelectorAll('.rol-plan-panel').forEach(p => p.classList.remove('active'));
    const planPanel = document.getElementById('rol-pp-' + mod.id + '-' + planId);
    if (planPanel) planPanel.classList.add('active');
    // Actualizar toggle de sección según plan+rol activo
    const activeRoleWrap2 = document.querySelector('.rol-sa-global-role-wrap.active');
    const activeRoleId = activeRoleWrap2 ? activeRoleWrap2.dataset.roleId : ROL_DEFAULTS[0].role_id;
    const secChk = document.getElementById('sec-chk-' + mod.id);
    if (secChk) {
      const secActiva = (rolPlanConfig?._seccionesActivas?.[planId]?.[activeRoleId]?.[mod.id]) !== false;
      secChk.checked = secActiva;
      modEl.classList.toggle('rol-seccion-off', !secActiva);
    }
  });
  // Actualizar toggles de roles en panel global
  document.querySelectorAll('.rol-sa-global-role-wrap').forEach(wrap => {
    const roleId = wrap.dataset.roleId;
    const isActivo = (rolPlanConfig?._rolesActivos?.[planId]?.[roleId]) !== false;
    const chk = wrap.querySelector('input[type="checkbox"]');
    if (chk) chk.checked = isActivo;
  });
  // Mostrar panel del rol activo y actualizar estado de permisos
  const activeRoleWrap = document.querySelector('.rol-sa-global-role-wrap.active');
  if (activeRoleWrap) {
    const roleId = activeRoleWrap.dataset.roleId;
    ROL_CATALOGO.forEach(mod => {
      const planPanel = document.getElementById('rol-pp-' + mod.id + '-' + planId);
      if (!planPanel) return;
      planPanel.querySelectorAll('.rol-role-panel').forEach(p => p.classList.remove('active'));
      const rp = document.getElementById('rol-rp-' + mod.id + '-' + planId + '-' + roleId);
      if (rp) rp.classList.add('active');
    });
    const activo = (rolPlanConfig?._rolesActivos?.[planId]?.[roleId]) !== false;
    rolUpdatePermissionsState(planId, roleId, activo);
  }
}

function rolGlobalSwitchRole(wrap, roleId) {
  document.querySelectorAll('.rol-sa-global-role-wrap').forEach(w => {
    w.classList.remove('active');
    w.querySelector('.rol-role-tab')?.classList.remove('active');
  });
  if (wrap) {
    wrap.classList.add('active');
    wrap.querySelector('.rol-role-tab')?.classList.add('active');
  }
  const activePlanTab = document.querySelector('.rol-sa-global-plan-tab.active');
  const planId = activePlanTab ? activePlanTab.dataset.planId : ROL_PLANES[0].id;
  // Cambiar panel de rol activo en todas las secciones
  ROL_CATALOGO.forEach(mod => {
    const planPanel = document.getElementById('rol-pp-' + mod.id + '-' + planId);
    if (!planPanel) return;
    planPanel.querySelectorAll('.rol-role-panel').forEach(p => p.classList.remove('active'));
    const rp = document.getElementById('rol-rp-' + mod.id + '-' + planId + '-' + roleId);
    if (rp) {
      rp.classList.add('active');
      // Refrescar checkboxes desde rolPlanConfig para este rol+plan+mod
      const perms = (rolPlanConfig || {})[mod.id]?.[planId]?.[roleId] || {};
      mod.acciones.forEach(acc => {
        const chk = document.getElementById('plan-chk-' + mod.id + '-' + planId + '-' + roleId + '-' + acc.id);
        if (chk) chk.checked = !!perms[acc.id];
        const numInp = document.getElementById('plan-num-' + mod.id + '-' + planId + '-' + roleId + '-' + acc.id);
        if (numInp) numInp.value = perms['_num_' + acc.id] ?? '';
      });
      // Límite de creación
      const limitInp = document.getElementById('plan-limit-' + mod.id + '-' + planId + '-' + roleId);
      if (limitInp) limitInp.value = perms._limit ?? '';
    }
  });
  // Actualizar toggle de sección para cada módulo según plan+rol
  ROL_CATALOGO.forEach(mod => {
    const secChk = document.getElementById('sec-chk-' + mod.id);
    if (secChk) {
      const secActiva = (rolPlanConfig?._seccionesActivas?.[planId]?.[roleId]?.[mod.id]) !== false;
      secChk.checked = secActiva;
      const modEl = document.getElementById('rol-mod-' + mod.id);
      if (modEl) modEl.classList.toggle('rol-seccion-off', !secActiva);
    }
  });
  // Bloquear permisos si el rol está desactivado para este plan
  const activo = (rolPlanConfig?._rolesActivos?.[planId]?.[roleId]) !== false;
  rolUpdatePermissionsState(planId, roleId, activo);
}

function rolGlobalToggleRol(roleId, activo) {
  const activePlanTab = document.querySelector('.rol-sa-global-plan-tab.active');
  const planId = activePlanTab ? activePlanTab.dataset.planId : ROL_PLANES[0].id;
  rolToggleRolActivo(planId, roleId, activo);
  // Si el rol seleccionado actualmente es este, actualizar estado de permisos
  const activeRoleWrap = document.querySelector('.rol-sa-global-role-wrap.active');
  if (activeRoleWrap && activeRoleWrap.dataset.roleId === roleId) {
    rolUpdatePermissionsState(planId, roleId, activo);
  }
}

function rolUpdatePermissionsState(planId, roleId, activo) {
  ROL_CATALOGO.forEach(mod => {
    const panel = document.getElementById('rol-rp-' + mod.id + '-' + planId + '-' + roleId);
    if (!panel) return;
    panel.querySelectorAll('input[type="checkbox"]:not(.rol-role-tab-toggle input)').forEach(chk => {
      chk.disabled = !activo;
    });
    panel.querySelectorAll('.rol-limit-input').forEach(inp => {
      inp.disabled = !activo;
    });
    panel.style.opacity = activo ? '1' : '0.4';
    panel.style.pointerEvents = activo ? '' : 'none';
    // Mantener el toggle del rol clickeable
    const rolToggle = document.querySelector('.rol-sa-global-role-wrap[data-role-id="' + roleId + '"] input');
    if (rolToggle) { rolToggle.disabled = false; rolToggle.closest('label').style.pointerEvents = ''; }
  });
}

function rolToggleSeccionActivaPlan(modId, activo) {
  const activePlanTab = document.querySelector('.rol-sa-global-plan-tab.active');
  const planId = activePlanTab ? activePlanTab.dataset.planId : ROL_PLANES[0].id;
  const activeRoleWrap = document.querySelector('.rol-sa-global-role-wrap.active');
  const roleId = activeRoleWrap ? activeRoleWrap.dataset.roleId : ROL_DEFAULTS[0].role_id;
  if (!rolPlanConfig._seccionesActivas) rolPlanConfig._seccionesActivas = {};
  if (!rolPlanConfig._seccionesActivas[planId]) rolPlanConfig._seccionesActivas[planId] = {};
  if (!rolPlanConfig._seccionesActivas[planId][roleId]) rolPlanConfig._seccionesActivas[planId][roleId] = {};
  rolPlanConfig._seccionesActivas[planId][roleId][modId] = activo;
  const modEl = document.getElementById('rol-mod-' + modId);
  if (modEl) modEl.classList.toggle('rol-seccion-off', !activo);
}

function rolToggleSeccionActiva(planId, modId, activo) {
  if (!rolPlanConfig) rolPlanConfig = rolPlanConfigDefault();
  if (!rolPlanConfig._seccionesActivas) rolPlanConfig._seccionesActivas = {};
  if (!rolPlanConfig._seccionesActivas[planId]) rolPlanConfig._seccionesActivas[planId] = {};
  rolPlanConfig._seccionesActivas[planId][modId] = activo;
}

function rolToggleRolActivo(planId, roleId, activo) {
  if (!rolPlanConfig) rolPlanConfig = rolPlanConfigDefault();
  if (!rolPlanConfig._rolesActivos) rolPlanConfig._rolesActivos = {};
  if (!rolPlanConfig._rolesActivos[planId]) rolPlanConfig._rolesActivos[planId] = {};
  // Solo guarda el estado — no afecta permisos ni secciones
  rolPlanConfig._rolesActivos[planId][roleId] = activo;
}

function rolSaveNumPerm(modId, planId, roleId, accId, value) {
  if (!rolPlanConfig) rolPlanConfig = rolPlanConfigDefault();
  if (!rolPlanConfig[modId]) rolPlanConfig[modId] = {};
  if (!rolPlanConfig[modId][planId]) rolPlanConfig[modId][planId] = {};
  if (!rolPlanConfig[modId][planId][roleId]) rolPlanConfig[modId][planId][roleId] = {};
  rolPlanConfig[modId][planId][roleId]['_num_' + accId] = value === '' ? null : parseInt(value, 10);
}

function rolSavePlanLimit(modId, planId, roleId, value) {
  if (!rolPlanConfig) rolPlanConfig = rolPlanConfigDefault();
  if (!rolPlanConfig[modId]) rolPlanConfig[modId] = {};
  if (!rolPlanConfig[modId][planId]) rolPlanConfig[modId][planId] = {};
  if (!rolPlanConfig[modId][planId][roleId]) rolPlanConfig[modId][planId][roleId] = {};
  const limit = value === '' ? null : parseInt(value, 10);
  rolPlanConfig[modId][planId][roleId]._limit = limit;
  // Reflejar en la franja del rol normal
  const viewLimit = document.getElementById('rol-view-limit-' + modId + '-' + planId + '-' + roleId);
  if (viewLimit) viewLimit.textContent = limit !== null ? limit : '∞';
}

function rolSwitchPlanTab(btn, modId, planId) {
  const modulo = btn.closest('.rol-modulo');
  if (!modulo) return;
  modulo.querySelectorAll('.rol-plan-tab').forEach(t => t.classList.remove('active'));
  modulo.querySelectorAll('.rol-plan-panel').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  // Actualizar toggle de sección según el plan seleccionado
  const secChk = document.getElementById('sec-chk-' + modId);
  if (secChk) {
    const secActiva = (rolPlanConfig?._seccionesActivas?.[planId]?.[modId]) !== false;
    secChk.checked = secActiva;
    const modEl = document.getElementById('rol-mod-' + modId);
    if (modEl) modEl.classList.toggle('rol-seccion-off', !secActiva);
  }
  const panel = document.getElementById(`rol-pp-${modId}-${planId}`);
  if (panel) panel.classList.add('active');
}

function rolSwitchStripTab(btn, roleId, modId, planId) {
  const strip = btn.closest('.rol-modulo-plan-strip');
  if (!strip) return;
  strip.querySelectorAll('.rol-plan-strip-tab').forEach(t => t.classList.remove('active'));
  strip.querySelectorAll('.rol-plan-strip-panel').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  const panel = document.getElementById('rol-strip-pp-' + roleId + '-' + modId + '-' + planId);
  if (panel) panel.classList.add('active');
}

function rolSwitchRoleTab(wrap, modId, planId, roleId) {
  const panel = document.getElementById(`rol-pp-${modId}-${planId}`);
  if (!panel) return;
  panel.querySelectorAll('.rol-role-tab-wrap').forEach(t => t.classList.remove('active'));
  panel.querySelectorAll('.rol-role-tab').forEach(t => t.classList.remove('active'));
  panel.querySelectorAll('.rol-role-panel').forEach(p => p.classList.remove('active'));
  if (wrap) {
    wrap.classList.add('active');
    const btn = wrap.querySelector('.rol-role-tab');
    if (btn) btn.classList.add('active');
  }
  const rp = document.getElementById(`rol-rp-${modId}-${planId}-${roleId}`);
  if (rp) rp.classList.add('active');
}

function rolTogglePlanModuloActivo(modId, planId, btn) {
  const panel = document.getElementById('rol-pp-' + modId + '-' + planId);
  if (!panel) return;
  const activeTab = panel.querySelector('.rol-role-tab.active');
  if (!activeTab) return;
  const roleId = activeTab.dataset.roleId;
  rolTogglePlanModulo(modId, planId, roleId, btn);
}

function rolTogglePlanModulo(modId, planId, roleId, btn) {
  if (!rolPlanConfig) rolPlanConfig = rolPlanConfigDefault();
  const mod = ROL_CATALOGO.find(m => m.id === modId);
  if (!mod) return;
  if (!rolPlanConfig[modId]) rolPlanConfig[modId] = {};
  if (!rolPlanConfig[modId][planId]) rolPlanConfig[modId][planId] = {};
  if (!rolPlanConfig[modId][planId][roleId]) rolPlanConfig[modId][planId][roleId] = {};
  const activar = btn.dataset.activar === 'true';
  mod.acciones.forEach(acc => {
    rolPlanConfig[modId][planId][roleId][acc.id] = activar;
    const chk = document.getElementById('plan-chk-' + modId + '-' + planId + '-' + roleId + '-' + acc.id);
    if (chk) chk.checked = activar;
    const viewChk = document.getElementById('rol-view-chk-' + modId + '-' + planId + '-' + roleId + '-' + acc.id);
    if (viewChk) viewChk.checked = activar;
  });
  btn.dataset.activar = (!activar).toString();
  btn.textContent = activar ? 'Desactivar todo' : 'Activar todo';
}

// ── ROL HEAVENSY SUPERADMIN (solo visible para superadmins) ───────────────────
const ROL_HEAVENSY_SA = {
  role_id: 'HEAVENSY_SUPERADMIN_ROL',
  role_name: 'Super Admin Heavensy',
  description: 'Acceso total al sistema. Solo visible para el equipo de Heavensy.',
  color: '#1e1e2e',
  level: 0,
  is_heavensy: true,
  permissions: Object.fromEntries(
    ['conversaciones','agenda','embudos','chat_interno','seguimiento','usuarios',
     'roles','configuracion','calendario','dashboard','empresas','pagina_publica',
     'mi_perfil','ia'].map(mod => [mod, Object.fromEntries(
       (ROL_CATALOGO.find(c => c.id === mod)?.acciones || []).map(a => [a.id, true])
     )])
  )
};

function rolEsSuperAdmin() {
  try {
    const token = localStorage.getItem('token');
    if (!token) return false;
    const p     = JSON.parse(atob(token.split('.')[1]));
    const roles = p.roles || [];
    const cid   = p.company_id || '';
    return cid === 'HEAVENSY_001'
      || roles.some(r => ['SUPERADMIN_ROL','superadmin','HEAVENSY_ADMIN'].includes(r))
      || (p.role || '').toLowerCase() === 'superadmin';
  } catch { return false; }
}

// ── STATE ──────────────────────────────────────────────────────────────────────
let rolRoles      = [];   // all roles
let rolUsuarios   = [];   // all users
let rolSeleccionado = null; // selected role id
let rolPendingPerms = {};   // unsaved permission changes
let rolEditingId    = null; // rol being edited in modal
let rolCurrentUser  = null;
let rolMiPlanId     = null; // plan de la empresa actual (para candados upsell)

// ── INIT ───────────────────────────────────────────────────────────────────────
async function initRolesPage() {
  try {
    const token = localStorage.getItem('token');
    if (token) {
      const p = JSON.parse(atob(token.split('.')[1]));
      rolCurrentUser = { id: p.user_id || p.sub, company_id: p.company_id, role: p.role };
    }
  } catch (e) {}

  // Hidratar catálogo de módulos y planes desde la BD (con fallback al hardcode)
  await rolHidratarModelo();

  // Plan de la empresa y matriz primero: el render de roles depende de ambos
  await Promise.all([rolCargarMiPlan(), rolCargarPlanConfig()]);
  await Promise.all([rolCargarRoles(), rolCargarUsuarios()]);
}

// Carga el plan de la empresa actual (para la franja y los candados upsell)
async function rolCargarMiPlan() {
  try {
    // Autosuficiente: si rolCurrentUser aún no está seteado (el panel se monta
    // desde companies.js sin pasar por initRolesPage), leer el token directo.
    let cid = rolCurrentUser?.company_id;
    if (!cid) {
      try {
        const t = localStorage.getItem('token');
        if (t) cid = JSON.parse(atob(t.split('.')[1])).company_id;
      } catch {}
    }
    if (!cid) return;
    const res  = await apiCall(`/api/companies/${cid}`);
    const plan = res?.data?.company?.plan_id;
    if (plan) {
      rolMiPlanId = String(plan).trim().toLowerCase();
    } else {
      console.error('La empresa no tiene plan_id: candados de plan desactivados');
    }
  } catch (e) {
    console.error('Error cargando el plan de la empresa:', e);
  }
}

// ── Helpers de upsell ──
function rolEsVistaEmpresa() { return !rolEsSuperAdmin(); }
function rolPlanIndex(planId) { return ROL_PLANES.findIndex(p => p.id === planId); }
// Primer plan (en orden comercial) que incluye la acción para el rol, o null
function rolPlanMinimoPara(modId, roleId, accId) {
  for (const p of ROL_PLANES) {
    if (rolPlanConfig?.[modId]?.[p.id]?.[roleId]?.[accId] === true) return p;
  }
  return null;
}

// Carga módulos y planes desde la BD y reemplaza los arrays locales.
// apiCall envuelve el JSON del backend en .data, y el backend responde
// { ok, data: { modules/plans } } → el dato real está en res.data.data.*
async function rolHidratarModelo() {
  try {
    const [resMods, resPlans] = await Promise.all([
      apiCall('/api/system-roles/modules'),
      apiCall('/api/system-roles/plans'),
    ]);

    const mods = resMods?.data?.data?.modules;
    if (Array.isArray(mods) && mods.length) {
      ROL_CATALOGO = mods.map(m => ({
        id: m.module_id,
        label: m.label,
        icon: m.icon,
        color: m.color,
        acciones: m.acciones || [],
      }));
    } else {
      console.error('No se pudieron cargar los módulos desde la BD');
    }

    const plans = resPlans?.data?.data?.plans;
    if (Array.isArray(plans) && plans.length) {
      ROL_PLANES = plans.map(p => ({
        id: p.plan_id,
        label: p.label,
        color: p.color,
      }));
    } else {
      console.error('No se pudieron cargar los planes desde la BD');
    }
  } catch (e) {
    console.error('Error al cargar el modelo de permisos desde la BD:', e);
  }
}

// ── TABS ───────────────────────────────────────────────────────────────────────
function rolTab(tab) {
  document.querySelectorAll('.rol-tab-btn').forEach((b, i) => {
    b.classList.toggle('active', ['roles','usuarios','catalogo'][i] === tab);
  });
  document.querySelectorAll('.rol-tab-content').forEach(el => el.classList.remove('active'));
  document.getElementById(`rol-tab-${tab}`)?.classList.add('active');

  if (tab === 'catalogo') rolRenderCatalogo();
}

// ── CARGAR ROLES ───────────────────────────────────────────────────────────────
const ROL_DEFAULTS = [
  {
    role_id: 'ADMIN_ROL', role_name: 'Administrador', color: '#5a79d4', level: 1,
    description: 'Acceso completo al sistema',
    permissions: {
      conversaciones: {ver:true,  responder:true,  toggle_ia:true,  respuestas_rapidas:true,  adjuntar:true,  grabar_audio:true,  cliente_vip:true,  tags:true,  notas:true,  embudos:true,  seguimiento:true,  agenda:true,  calendario:true},
      agenda:         {ver:true,  ver_todas:true,  crear:true,  editar:true,  cancelar:true},
      embudos:        {ver:true,  crear:true,  editar:true,  mover:true,  eliminar:true,  masivos:true,  seleccionar_card:true},
      chat_interno:   {acceder:true,  crear_salas:true,  administrar_salas:true,  asignar_tareas:true,  crear_votacion:true,  programar_mensajes:true,  crear_notas:true},
      seguimiento:    {ver:true,  crear:true,  linea_tiempo:true,  evolucion:true,  notas_sesion:true,  plantillas:true,  chips_clinicos:true,  resumen_ia:true,  agendar_ia:true,  historial:true,  derivaciones:true},
      usuarios:       {ver:true,  crear:true,  editar:true,  eliminar:true},
      roles:          {ver:true,  crear:true,  editar:true,  asignar:true},
      configuracion:  {ver:true,  editar_empresa:true,  editar_propia:true,  editar_usuarios:true},
      calendario:     {ver:true,  bloqueos:true,  bloques_masivos:true,  agenda_propia:true,  agenda_profesionales:true,  agenda_todos:true,  reagendar:true},
      dashboard:      {ver_metricas:true},
      empresas:       {ver:true,  crear:true,  gestionar:true},
      pagina_publica: {visualizar:true},
      mi_perfil:      {visualizar:true,  editar:true},
      ia:             {usar:true,  configurar:true,  ver_logs:true},
    }
  },
  {
    role_id: 'OPERADOR_ROL', role_name: 'Operador', color: '#6366f1', level: 2,
    description: 'Gestión de conversaciones y moderación',
    permissions: {
      conversaciones: {ver:true,  responder:true,  toggle_ia:true,  respuestas_rapidas:true,  adjuntar:true,  grabar_audio:true,  cliente_vip:false, tags:true,  notas:true,  embudos:true,  seguimiento:false, agenda:true,  calendario:true},
      agenda:         {ver:true,  ver_todas:false, crear:true,  editar:true,  cancelar:true},
      embudos:        {ver:true,  crear:false, editar:false, mover:true,  eliminar:false, masivos:true,  seleccionar_card:true},
      chat_interno:   {acceder:true,  crear_salas:false, administrar_salas:false, asignar_tareas:true,  crear_votacion:true,  programar_mensajes:true,  crear_notas:true},
      seguimiento:    {ver:true,  crear:false, linea_tiempo:false, evolucion:false, notas_sesion:false, plantillas:false, chips_clinicos:false, resumen_ia:false, agendar_ia:false, historial:true,  derivaciones:false},
      usuarios:       {ver:true,  crear:false, editar:false, eliminar:false},
      roles:          {ver:true,  crear:false, editar:false, asignar:false},
      configuracion:  {ver:true,  editar_empresa:false, editar_propia:true,  editar_usuarios:false},
      calendario:     {ver:true,  bloqueos:false, bloques_masivos:false, agenda_propia:true,  agenda_profesionales:false, agenda_todos:false, reagendar:true},
      dashboard:      {ver_metricas:true},
      empresas:       {ver:true,  crear:false, gestionar:false},
      pagina_publica: {visualizar:true},
      mi_perfil:      {visualizar:true,  editar:true},
      ia:             {usar:true,  configurar:false, ver_logs:false},
    }
  },
  {
    role_id: 'SUPERVISOR_ROL', role_name: 'Supervisor', color: '#5a79d4', level: 2,
    description: 'Visión completa de la operación, sin acceso a configuración',
    permissions: {
      conversaciones: {ver:true,  responder:true,  toggle_ia:true,  respuestas_rapidas:true,  adjuntar:true,  grabar_audio:true,  cliente_vip:true,  tags:true,  notas:true,  embudos:true,  seguimiento:true,  agenda:true,  calendario:true},
      agenda:         {ver:true,  ver_todas:true,  crear:true,  editar:true,  cancelar:true},
      embudos:        {ver:true,  crear:true,  editar:true,  mover:true,  eliminar:false, masivos:true,  seleccionar_card:true},
      chat_interno:   {acceder:true,  crear_salas:true,  administrar_salas:true,  asignar_tareas:true,  crear_votacion:true,  programar_mensajes:true,  crear_notas:true},
      seguimiento:    {ver:true,  crear:true,  linea_tiempo:true,  evolucion:true,  notas_sesion:true,  plantillas:true,  chips_clinicos:true,  resumen_ia:true,  agendar_ia:true,  historial:true,  derivaciones:true},
      usuarios:       {ver:true,  crear:false, editar:false, eliminar:false},
      roles:          {ver:true,  crear:false, editar:false, asignar:false},
      configuracion:  {ver:true,  editar_empresa:false, editar_propia:true,  editar_usuarios:false},
      calendario:     {ver:true,  bloqueos:true,  bloques_masivos:false, agenda_propia:true,  agenda_profesionales:true,  agenda_todos:true,  reagendar:true},
      dashboard:      {ver_metricas:true},
      empresas:       {ver:true,  crear:false, gestionar:false},
      pagina_publica: {visualizar:true},
      mi_perfil:      {visualizar:true,  editar:true},
      ia:             {usar:true,  configurar:false, ver_logs:true},
    }
  },
  {
    role_id: 'PROFESIONAL_ROL', role_name: 'Profesional', color: '#10b981', level: 3,
    description: 'Su agenda, sus pacientes y chat interno',
    permissions: {
      conversaciones: {ver:true,  responder:true,  toggle_ia:false, respuestas_rapidas:true,  adjuntar:true,  grabar_audio:true,  cliente_vip:false, tags:true,  notas:true,  embudos:false, seguimiento:true,  agenda:true,  calendario:true},
      agenda:         {ver:true,  ver_todas:false, crear:true,  editar:true,  cancelar:true},
      embudos:        {ver:true,  crear:false, editar:false, mover:true,  eliminar:false, masivos:false, seleccionar_card:false},
      chat_interno:   {acceder:true,  crear_salas:false, administrar_salas:false, asignar_tareas:false, crear_votacion:true,  programar_mensajes:true,  crear_notas:true},
      seguimiento:    {ver:true,  crear:true,  linea_tiempo:true,  evolucion:true,  notas_sesion:true,  plantillas:true,  chips_clinicos:true,  resumen_ia:true,  agendar_ia:true,  historial:true,  derivaciones:true},
      usuarios:       {ver:false, crear:false, editar:false, eliminar:false},
      roles:          {ver:false, crear:false, editar:false, asignar:false},
      configuracion:  {ver:false, editar_empresa:false, editar_propia:true,  editar_usuarios:false},
      calendario:     {ver:true,  bloqueos:true,  bloques_masivos:false, agenda_propia:true,  agenda_profesionales:false, agenda_todos:false, reagendar:true},
      dashboard:      {ver_metricas:false},
      empresas:       {ver:false, crear:false, gestionar:false},
      pagina_publica: {visualizar:true},
      mi_perfil:      {visualizar:true,  editar:true},
      ia:             {usar:true,  configurar:false, ver_logs:false},
    }
  },
  {
    role_id: 'ASISTENTE_ROL', role_name: 'Asistente', color: '#f59e0b', level: 4,
    description: 'Gestiona agenda, atiende conversaciones y coordina el equipo',
    permissions: {
      conversaciones: {ver:true,  responder:true,  toggle_ia:true,  respuestas_rapidas:true,  adjuntar:true,  grabar_audio:true,  cliente_vip:false, tags:true,  notas:true,  embudos:true,  seguimiento:true,  agenda:true,  calendario:true},
      agenda:         {ver:true,  ver_todas:true,  crear:true,  editar:true,  cancelar:true},
      embudos:        {ver:true,  crear:false, editar:false, mover:true,  eliminar:false, masivos:true,  seleccionar_card:true},
      chat_interno:   {acceder:true,  crear_salas:false, administrar_salas:false, asignar_tareas:true,  crear_votacion:true,  programar_mensajes:true,  crear_notas:true},
      seguimiento:    {ver:true,  crear:true,  linea_tiempo:false, evolucion:false, notas_sesion:true,  plantillas:true,  chips_clinicos:false, resumen_ia:false, agendar_ia:true,  historial:true,  derivaciones:false},
      usuarios:       {ver:true,  crear:false, editar:false, eliminar:false},
      roles:          {ver:true,  crear:false, editar:false, asignar:false},
      configuracion:  {ver:true,  editar_empresa:false, editar_propia:true,  editar_usuarios:false},
      calendario:     {ver:true,  bloqueos:true,  bloques_masivos:true,  agenda_propia:true,  agenda_profesionales:true,  agenda_todos:true,  reagendar:true},
      dashboard:      {ver_metricas:true},
      empresas:       {ver:false, crear:false, gestionar:false},
      pagina_publica: {visualizar:true},
      mi_perfil:      {visualizar:true,  editar:true},
      ia:             {usar:true,  configurar:false, ver_logs:false},
    }
  },
];

async function rolCargarRoles() {
  const cid = rolCurrentUser?.company_id;
  try {
    let roles = [];

    // 1. Intentar endpoint de empresa con los nuevos roles
    if (cid) {
      const res = await apiCall(`/api/system-roles/companies/${cid}/roles`).catch(() => null);
      if (res?.ok) {
        roles = res.data.roles || [];
      }
    }

    // 2. Fallback: cargar roles del sistema
    if (!roles.length) {
      const r2 = await apiCall('/api/system-roles').catch(() => null);
      if (r2?.ok || r2?.data) {
        const raw = r2?.data;
        roles = Array.isArray(raw) ? raw : (raw?.roles || []);
        roles = roles.map(r => ({ ...r, is_system: true }));
      }
    }

    // 3. Añadir roles por defecto si no están ya (deduplicar por ID y por nombre)
    const existingIds    = new Set(roles.map(r => (r.role_id || r.id || '').toLowerCase()));
    const existingNames  = new Set(roles.map(r => (r.role_name || r.name || '').toLowerCase()));
    for (const def of ROL_DEFAULTS) {
      const defId   = (def.role_id || '').toLowerCase();
      const defName = (def.role_name || '').toLowerCase();
      if (!existingIds.has(defId) && !existingNames.has(defName)) {
        roles.push({ ...def, is_custom: true, is_system: false, _local: true });
      }
    }

    // Excluir Visualizador y el Super Admin Heavensy (este se pinta en su propio bloque)
    rolRoles = roles.filter(r => {
      const rid = r.role_id || r.id;
      return rid !== 'VIEWER_ROL'
        && rid !== 'HEAVENSY_SUPERADMIN_ROL'
        && !r.is_heavensy;
    });
    rolRenderLista();
  } catch (e) {
    console.error('Error cargando roles:', e);
    rolRoles = ROL_DEFAULTS.map(d => ({ ...d, is_custom: true, is_system: false, _local: true }));
    rolRenderLista();
  }
}

// ── RENDER ACORDEÓN ────────────────────────────────────────────────────────────
function rolRenderLista() {
  const el = document.getElementById('rol-acordeon');
  if (!rolRoles.length) {
    el.innerHTML = '<p style="text-align:center;color:#9ba3c0;padding:40px;font-size:13px">No hay roles configurados</p>';
    return;
  }

  let html = '';

  // Bloque Super Admin Heavensy: SOLO visible para el equipo Heavensy
  if (rolEsSuperAdmin()) {
    html += `
      <div class="hvy-only" style="flex-direction:column;width:100%">
        <div class="rol-sa-separador">
          <span><i class="fas fa-lock"></i> Solo equipo Heavensy</span>
        </div>
        ${_rolAcordCard(ROL_HEAVENSY_SA)}
      </div>
    `;
  }

  // Franja del plan (solo vista empresa)
  if (rolEsVistaEmpresa() && rolMiPlanId) {
    const _miPlan = ROL_PLANES.find(p => p.id === rolMiPlanId);
    const _lbl    = _miPlan ? _miPlan.label : rolMiPlanId;
    html += `
      <div class="rol-plan-banner">
        <span><i class="fas fa-crown"></i> Tu plan: <b>${escapeHtml(_lbl)}</b> — las opciones con <i class="fas fa-lock"></i> se activan al mejorar el plan</span>
        <a class="rol-plan-banner-btn" href="pages/planes_heavensy_v6.html">Ver planes <i class="fas fa-arrow-right"></i></a>
      </div>`;
  }

  html += `
    <div class="rol-acord-card open" id="rol-acord-EMPRESA_ROLES">
      <div class="rol-acord-header" onclick="rolToggleAcord('EMPRESA_ROLES')">
        <div class="rol-card-avatar" style="background:rgba(255,255,255,0.2);color:#fff"><i class="fas fa-briefcase"></i></div>
        <div class="rol-card-info">
          <div class="rol-card-name" style="color:#fff">Roles de Empresa</div>
          <div class="rol-card-meta" style="color:rgba(255,255,255,0.9)">
            Plantillas de los roles del sistema y sus permisos.
          </div>
        </div>
        <button class="rol-acord-chev-btn" title="Mostrar / ocultar"
          onclick="event.stopPropagation();rolToggleAcord('EMPRESA_ROLES')">
          <i class="fas fa-chevron-down"></i>
        </button>
      </div>
      <div class="rol-acord-body" id="rol-body-EMPRESA_ROLES">
        <div class="rol-acord-body-inner">
          ${rolRoles.map(r => _rolAcordCard(r)).join('')}
        </div>
      </div>
    </div>`;

  el.innerHTML = html;
}

function _rolHeavensySACard(rol) {
  const id   = rol.role_id || rol.id;
  const cfg  = rolPlanConfig || rolPlanConfigDefault();

  const modulosHtml = ROL_CATALOGO.map(mod => {
    const tabsHtml = ROL_PLANES.map((plan, i) => `
      <button class="rol-plan-tab${i === 0 ? ' active' : ''}"
        style="--plan-color:${plan.color}"
        data-plan-id="${plan.id}"
        onclick="rolSwitchPlanTab(this,'${mod.id}','${plan.id}')">
        <span class="rol-plan-tab-dot"></span>
        ${escapeHtml(plan.label)}
      </button>`).join('');

    const panelsHtml = ROL_PLANES.map((plan, i) => {
      // allOn del primer rol para el estado inicial del botón
      const firstRolePerms = cfg[mod.id]?.[plan.id]?.[ROL_DEFAULTS[0]?.role_id] || {};
      const allOnFirst = mod.acciones.every(a => firstRolePerms[a.id]);

      const roleTabsHtml = ROL_DEFAULTS.map((rol, j) => {
        const isRolActivo = (rolPlanConfig?._rolesActivos?.[plan.id]?.[rol.role_id]) !== false;
        return `<div class="rol-role-tab-wrap${j === 0 ? ' active' : ''}" data-role-id="${rol.role_id}" style="--role-color:${rol.color}">
          <button class="rol-role-tab${j === 0 ? ' active' : ''}"
            data-role-id="${rol.role_id}"
            onclick="rolSwitchRoleTab(this.closest('.rol-role-tab-wrap'),'${mod.id}','${plan.id}','${rol.role_id}')"
            style="--role-color:${rol.color}">
            ${escapeHtml(rol.role_name)}
          </button>
          <label class="rol-role-tab-toggle" onclick="event.stopPropagation()">
            <input type="checkbox" ${isRolActivo ? 'checked' : ''}
              onchange="rolToggleRolActivo('${plan.id}','${rol.role_id}',this.checked)">
            <span class="rol-role-tab-slider"></span>
          </label>
        </div>`;
      }).join('');

      const rolePanelsHtml = ROL_DEFAULTS.map((rol, j) => {
        const rolePerms = cfg[mod.id]?.[plan.id]?.[rol.role_id] || {};
        const allOn     = mod.acciones.every(a => rolePerms[a.id]);
        const toggles   = mod.acciones.map(acc => `
          <div class="rol-toggle-row">
            <span class="rol-toggle-label">${escapeHtml(acc.label)}</span>
            <label class="rol-switch">
              <input type="checkbox" id="plan-chk-${mod.id}-${plan.id}-${rol.role_id}-${acc.id}"
                ${rolePerms[acc.id] ? 'checked' : ''}
                onchange="rolTogglePlanPerm('${mod.id}','${plan.id}','${rol.role_id}','${acc.id}',this.checked)">
              <span class="rol-switch-slider"></span>
            </label>
          </div>`).join('');

        const isActivo  = (rolPlanConfig?._rolesActivos?.[plan.id]?.[rol.role_id]) !== false;
        const limitVal = cfg[mod.id]?.[plan.id]?.[rol.role_id]?._limit ?? '';
        const togglesHtml = mod.acciones.map(acc => {
          // Acción tipo número: solo campo numérico, sin toggle
          if (acc.type === 'number') {
            const numVal = cfg[mod.id]?.[plan.id]?.[rol.role_id]?.['_num_' + acc.id] ?? '';
            return `<div class="rol-toggle-row">
              <span class="rol-toggle-label">${escapeHtml(acc.label)}</span>
              <div class="rol-num-wrap">
                <input type="number" class="rol-limit-input rol-limit-input--wide"
                  id="plan-num-${mod.id}-${plan.id}-${rol.role_id}-${acc.id}"
                  value="${numVal}" placeholder="∞" min="0"
                  onchange="rolSaveNumPerm('${mod.id}','${plan.id}','${rol.role_id}','${acc.id}',this.value)">
                <button class="rol-num-inf-btn" type="button" title="Sin límite"
                  onclick="this.previousElementSibling.value='';rolSaveNumPerm('${mod.id}','${plan.id}','${rol.role_id}','${acc.id}','')">∞</button>
              </div>
            </div>`;
          }
          const limitInput = '';
          return `<div class="rol-toggle-row">
            <span class="rol-toggle-label">${escapeHtml(acc.label)}</span>
            ${limitInput}
            <label class="rol-switch">
              <input type="checkbox" id="plan-chk-${mod.id}-${plan.id}-${rol.role_id}-${acc.id}"
                ${(cfg[mod.id]?.[plan.id]?.[rol.role_id]?.[acc.id]) ? 'checked' : ''}
                onchange="rolTogglePlanPerm('${mod.id}','${plan.id}','${rol.role_id}','${acc.id}',this.checked)">
              <span class="rol-switch-slider"></span>
            </label>
          </div>`;
        }).join('');
        return `<div class="rol-role-panel${j === 0 ? ' active' : ''}${!isActivo ? ' rol-inactivo' : ''}" id="rol-rp-${mod.id}-${plan.id}-${rol.role_id}">
          <div class="rol-modulo-body" data-mod-id="${mod.id}">${togglesHtml}</div>
        </div>`;
      }).join('');

      return `<div class="rol-plan-panel${i === 0 ? ' active' : ''}" id="rol-pp-${mod.id}-${plan.id}">
        ${rolePanelsHtml}
      </div>`;
    }).join('');

    const secActivaDefault = (rolPlanConfig?._seccionesActivas?.[ROL_PLANES[0].id]?.[ROL_DEFAULTS[0].role_id]?.[mod.id]) !== false;
    return `<div class="rol-modulo${!secActivaDefault ? ' rol-seccion-off' : ''}" id="rol-mod-${mod.id}">
      <div class="rol-modulo-header">
        <div class="rol-modulo-icon" style="background:${mod.color}">
          <i class="fas ${mod.icon}"></i>
        </div>
        <span class="rol-modulo-name">${escapeHtml(mod.label)}</span>
        <label class="rol-seccion-toggle" onclick="event.stopPropagation()" title="Activar/desactivar sección en este plan"
          style="--sec-color:${mod.color}">
          <input type="checkbox" id="sec-chk-${mod.id}" ${secActivaDefault ? 'checked' : ''}
            onchange="rolToggleSeccionActivaPlan('${mod.id}',this.checked)">
          <span class="rol-role-tab-slider"></span>
        </label>
      </div>
      ${panelsHtml}
    </div>`;
  }).join('');

  return `
    <div class="rol-acord-card" id="rol-acord-${id}">
      <div class="rol-acord-header" onclick="rolToggleAcord('${id}')">
        <div class="rol-card-avatar" style="background:#3b5bdb">S</div>
        <div class="rol-card-info">
          <div class="rol-card-name" style="color:#fff">Super Admin Heavensy</div>
          <div class="rol-card-meta" style="color:rgba(255,255,255,0.9)">
            <span class="rol-badge sistema" style="background:rgba(255,255,255,0.2);color:#fff">Sistema</span>
            Acceso total al sistema. Solo visible para el equipo de Heavensy.
          </div>
        </div>
        <div class="rol-acord-actions" onclick="event.stopPropagation()">
          <button class="rol-btn-save rol-btn-sa-save" onclick="rolGuardarPlanConfig(this)">
            <i class="fas fa-save"></i> Guardar planes
          </button>
        </div>
        <button class="rol-acord-chev-btn" title="Mostrar / ocultar"
          onclick="event.stopPropagation();rolToggleAcord('${id}')">
          <i class="fas fa-chevron-down"></i>
        </button>
      </div>
      <div class="rol-acord-body" id="rol-body-${id}">
        <div class="rol-sa-global-panel">
          <div class="rol-sa-row-label"><i class="fas fa-crown"></i> Plan</div>
          <div class="rol-plan-tabs-bar">
            ${ROL_PLANES.map((plan, i) => `
              <button class="rol-plan-tab rol-sa-global-plan-tab${i === 0 ? ' active' : ''}"
                style="--plan-color:${plan.color}" data-plan-id="${plan.id}"
                onclick="rolGlobalSwitchPlan('${plan.id}',this)">
                <span class="rol-plan-tab-dot"></span>
                ${escapeHtml(plan.label)}
              </button>`).join('')}
          </div>
          <div class="rol-sa-row-label"><i class="fas fa-users"></i> Rol</div>
          <div class="rol-role-tabs-bar">
            <div class="rol-role-tabs-scroll">
              ${ROL_DEFAULTS.map((rol, j) => {
                const isActivo = (rolPlanConfig?._rolesActivos?.[ROL_PLANES[0].id]?.[rol.role_id]) !== false;
                return `<div class="rol-role-tab-wrap rol-sa-global-role-wrap${j === 0 ? ' active' : ''}"
                  data-role-id="${rol.role_id}" style="--role-color:${rol.color};cursor:pointer"
                  onclick="rolGlobalSwitchRole(this,'${rol.role_id}')">
                  <button class="rol-role-tab${j === 0 ? ' active' : ''}"
                    data-role-id="${rol.role_id}" style="--role-color:${rol.color};pointer-events:none">
                    ${escapeHtml(rol.role_name)}
                  </button>
                  <label class="rol-role-tab-toggle" onclick="event.stopPropagation();rolGlobalSwitchRole(this.closest('.rol-sa-global-role-wrap'),'${rol.role_id}')">
                    <input type="checkbox" ${isActivo ? 'checked' : ''}
                      data-role-id="${rol.role_id}"
                      onclick="event.stopPropagation()"
                      onchange="rolGlobalToggleRol('${rol.role_id}',this.checked)">
                    <span class="rol-role-tab-slider"></span>
                  </label>
                </div>`;
              }).join('')}
            </div>
          </div>
        </div>
        ${modulosHtml}
      </div>
    </div>`;
}

function _rolAcordCard(rol) {
  if (rol.is_heavensy) return _rolHeavensySACard(rol);

  const id     = rol.role_id || rol.id;
  const name   = rol.role_name || rol.name || id;
  const desc   = rol.description || '';
  const color  = rol.color || _rolColorForId(id);
  const custom = rol.is_custom;
  const letra  = (name[0] || 'R').toUpperCase();
  const perms  = rol.permissions || {};

  const modulosHtml = ROL_CATALOGO.map(mod => {
    return `
      <div class="rol-modulo">
        <div class="rol-modulo-header">
          <div class="rol-modulo-icon" style="background:${mod.color}">
            <i class="fas ${mod.icon}"></i>
          </div>
          <span class="rol-modulo-name">${escapeHtml(mod.label)}</span>
        </div>
        <div class="rol-modulo-plan-strip">
          <div class="rol-plan-strip-bar">
            ${ROL_PLANES.map((plan, pi) => {
              const _emp   = rolEsVistaEmpresa();
              const _miIdx = rolPlanIndex(rolMiPlanId);
              const _esMio = _emp && _miIdx >= 0 && plan.id === rolMiPlanId;
              const _esSup = _emp && _miIdx >= 0 && pi > _miIdx;
              const _act   = (_emp && _miIdx >= 0) ? _esMio : pi === 0;
              const _lock  = _esSup ? '<i class="fas fa-lock rol-tab-lock"></i>' : '';
              const _mybdg = _esMio ? '<span class="rol-tab-myplan">Tu plan</span>' : '';
              return '<button class="rol-plan-strip-tab' + (_act?' active':'') + '" style="--plan-color:' + plan.color + '" onclick="rolSwitchStripTab(this,\'' + id + '\',\'' + mod.id + '\',\'' + plan.id + '\')">' + _lock + '<span class="rol-plan-tab-dot"></span>' + escapeHtml(plan.label) + _mybdg + '</button>';
            }).join('')}
          </div>
          ${ROL_PLANES.map((plan, pi) => {
            const _emp   = rolEsVistaEmpresa();
            const _miIdx = rolPlanIndex(rolMiPlanId);
            const _esMio = _emp && _miIdx >= 0 && plan.id === rolMiPlanId;
            const _esSup = _emp && _miIdx >= 0 && pi > _miIdx;
            const _act   = (_emp && _miIdx >= 0) ? _esMio : pi === 0;
            const planRolePerms = (rolPlanConfig||{})[mod.id]?.[plan.id]?.[id] || {};
            const stripLimit    = planRolePerms._limit !== undefined && planRolePerms._limit !== null ? planRolePerms._limit : '∞';
            const stripToggles  = mod.acciones.map(acc => {
              const badge = acc.id === 'crear'
                ? '<span class="rol-limit-badge" id="rol-view-limit-' + mod.id + '-' + plan.id + '-' + id + '">' + stripLimit + '</span>'
                : '';
              let hint = '';
              if (_esMio && planRolePerms[acc.id] !== true) {
                const minPlan = rolPlanMinimoPara(mod.id, id, acc.id);
                if (minPlan && rolPlanIndex(minPlan.id) > _miIdx) {
                  hint = ' <span class="rol-hint-upgrade"><i class="fas fa-lock"></i> Desde ' + escapeHtml(minPlan.label) + '</span>';
                }
              }
              return '<div class="rol-toggle-row rol-strip-row' + (hint ? ' rol-row-locked' : '') + '"><span class="rol-toggle-label">' + escapeHtml(acc.label) + hint + '</span>' + badge + '<label class="rol-switch rol-switch-view"><input type="checkbox" id="rol-view-chk-' + mod.id + '-' + plan.id + '-' + id + '-' + acc.id + '" ' + (planRolePerms[acc.id]?'checked':'') + ' disabled><span class="rol-switch-slider"></span></label></div>';
            }).join('');
            const upsell = _esSup
              ? '<div class="rol-strip-upsell"><span><i class="fas fa-star"></i> Esto es lo que incluye <b>' + escapeHtml(plan.label) + '</b> para este rol</span><a class="rol-plan-banner-btn" href="pages/planes_heavensy_v6.html">Ver planes <i class="fas fa-arrow-right"></i></a></div>'
              : '';
            return '<div class="rol-plan-strip-panel' + (_act?' active':'') + '" id="rol-strip-pp-' + id + '-' + mod.id + '-' + plan.id + '"><div class="rol-modulo-body">' + upsell + stripToggles + '</div></div>';
          }).join('')}
        </div>
      </div>`;
  }).join('');

  return `
    <div class="rol-acord-card" id="rol-acord-${id}">
      <div class="rol-acord-header" onclick="rolToggleAcord('${id}')">
        <div class="rol-card-avatar" style="background:${color}">${letra}</div>
        <div class="rol-card-info">
          <div class="rol-card-name">${escapeHtml(name)}</div>
          <div class="rol-card-meta">
            ${(rolEsVistaEmpresa() && rolMiPlanId && rolPlanConfig?._rolesActivos?.[rolMiPlanId]?.[id] === false)
              ? '<span class="rol-badge rol-badge-noplan"><i class="fas fa-lock"></i> No incluido en tu plan</span>' : ''}
            ${desc ? `<span>${escapeHtml(desc)}</span>` : ''}
          </div>
        </div>
        <div class="rol-acord-actions" onclick="event.stopPropagation()">
          <button class="rol-btn-sm rol-btn-edit" onclick="rolAbrirEditar('${id}')">
            <i class="fas fa-pen"></i> Editar
          </button>
        </div>
        <div class="rol-acord-chevron"><i class="fas fa-chevron-down"></i></div>
      </div>
      <div class="rol-acord-body">
        <div class="rol-acord-body-inner">
          ${modulosHtml}
          <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:16px;padding-top:14px;border-top:1px solid var(--rol-border)">
            <button class="rol-btn-cancel" onclick="rolCancelarPermisos('${id}')">Cancelar</button>
            <button class="rol-btn-nuevo" style="padding:8px 18px;font-size:12px" onclick="rolGuardarPermisos('${id}')">
              <i class="fas fa-check"></i> Guardar permisos
            </button>
          </div>
        </div>
      </div>
    </div>`;
}

function rolToggleAcord(roleId) {
  const card = document.getElementById(`rol-acord-${roleId}`);
  if (!card) return;
  card.classList.toggle('open');
}

function _rolColorForId(id) {
  const map = { ADMIN_ROL: '#8e84fa', OPERATOR_ROL: '#5a79d4', VIEWER_ROL: '#10b981' };
  return map[id] || ROL_COLORS[Math.abs(id.split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % ROL_COLORS.length];
}

// ── TOGGLE PERMISO ─────────────────────────────────────────────────────────────
function rolTogglePerm(roleId, modulo, accion, value) {
  const rol = rolRoles.find(r => (r.role_id || r.id) === roleId);
  if (!rol) return;
  if (!rol.permissions) rol.permissions = {};
  if (!rol.permissions[modulo]) rol.permissions[modulo] = {};
  rol.permissions[modulo][accion] = value;
  // Actualizar el header "Activar/Desactivar todo"
  const mod    = ROL_CATALOGO.find(m => m.id === modulo);
  const modEl  = [...document.querySelectorAll('.rol-modulo-name')].find(el => el.textContent === mod?.label);
  if (modEl) {
    const btn    = modEl.closest('.rol-modulo-header')?.querySelector('.rol-modulo-toggle-all');
    const allOn  = mod.acciones.every(a => rol.permissions[modulo]?.[a.id]);
    if (btn) btn.textContent = allOn ? 'Desactivar todo' : 'Activar todo';
  }
}

function rolToggleModulo(roleId, modulo, value, btn) {
  const rol = rolRoles.find(r => (r.role_id || r.id) === roleId);
  if (!rol) return;
  if (!rol.permissions)         rol.permissions = {};
  if (!rol.permissions[modulo]) rol.permissions[modulo] = {};

  const mod = ROL_CATALOGO.find(m => m.id === modulo);
  mod?.acciones.forEach(a => { rol.permissions[modulo][a.id] = value; });

  // Actualizar checkboxes en el DOM sin re-render
  const card = document.getElementById(`rol-acord-${roleId}`);
  if (card) {
    mod?.acciones.forEach(a => {
      const cb = card.querySelector(`input[onchange*="'${modulo}','${a.id}'"]`);
      if (cb) cb.checked = value;
    });
  }
  if (btn) btn.textContent = value ? 'Desactivar todo' : 'Activar todo';
}

// ── GUARDAR PERMISOS ───────────────────────────────────────────────────────────
async function rolGuardarPermisos(roleId) {
  const rol = rolRoles.find(r => (r.role_id || r.id) === roleId);
  if (!rol) return;
  const cid = rolCurrentUser?.company_id;

  try {
    let ok = false;

    if (cid) {
      // Si el rol es _local (aún no en BD), intentar crearlo primero
      if (rol._local) {
        const cr = await apiCall(`/api/system-roles/companies/${cid}/roles`, {
          method: 'POST',
          body: JSON.stringify({ ...rol, is_custom: true })
        }).catch(() => null);
        if (cr?.ok) { rol._local = false; }
      }

      const res = await apiCall(
        `/api/system-roles/companies/${cid}/roles/${roleId}`,
        { method: 'PUT', body: JSON.stringify({ permissions: rol.permissions }) }
      ).catch(() => null);
      ok = res?.ok || res?.status === 200;
    }

    // Guardar en memoria local siempre (funciona aunque no haya backend)
    showToast(ok ? 'Permisos guardados' : 'Guardado localmente (backend pendiente)', ok ? 'success' : 'warning');
  } catch (e) {
    showToast('Guardado localmente', 'warning');
  }
}

function rolCancelarPermisos(roleId) {
  rolCargarRoles().then(() => rolRenderPermisos(roleId));
}

// ── CREAR / EDITAR ROL ────────────────────────────────────────────────────────
function rolAbrirCrear() {
  rolEditingId = null;
  document.getElementById('rol-modal-titulo').textContent = 'Nuevo rol';
  document.getElementById('rol-input-nombre').value = '';
  document.getElementById('rol-input-desc').value   = '';
  document.getElementById('rol-input-color').value  = '#8e84fa';
  _rolRenderColorGrid('#8e84fa');
  document.getElementById('rol-modal').style.display = 'flex';
}

function rolAbrirEditar(roleId) {
  const rol = rolRoles.find(r => (r.role_id || r.id) === roleId);
  if (!rol) return;
  rolEditingId = roleId;
  const name  = rol.role_name || rol.name || '';
  const color = rol.color || _rolColorForId(roleId);
  document.getElementById('rol-modal-titulo').textContent = 'Editar rol';
  document.getElementById('rol-input-nombre').value = name;
  document.getElementById('rol-input-desc').value   = rol.description || '';
  document.getElementById('rol-input-color').value  = color;
  _rolRenderColorGrid(color);
  document.getElementById('rol-modal').style.display = 'flex';
}

function _rolRenderColorGrid(selected) {
  document.getElementById('rol-color-grid').innerHTML = ROL_COLORS.map(c => `
    <div class="rol-color-dot${c === selected ? ' selected' : ''}"
         style="background:${c}"
         onclick="rolSelectColor('${c}')"></div>
  `).join('');
}

function rolSelectColor(color) {
  document.getElementById('rol-input-color').value = color;
  document.querySelectorAll('.rol-color-dot').forEach(d => {
    d.classList.toggle('selected', d.style.background === color || `rgb(${_hexToRgb(color)})` === d.style.background);
  });
}

function _hexToRgb(hex) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `${r}, ${g}, ${b}`;
}

function rolCerrarModal() {
  document.getElementById('rol-modal').style.display = 'none';
}

async function rolGuardarRol() {
  const name  = document.getElementById('rol-input-nombre').value.trim();
  const desc  = document.getElementById('rol-input-desc').value.trim();
  const color = document.getElementById('rol-input-color').value;
  const cid   = rolCurrentUser?.company_id;

  if (!name) { document.getElementById('rol-input-nombre').focus(); return; }

  const data = { role_name: name, description: desc, color };

  try {
    let res;
    if (rolEditingId) {
      res = await apiCall(`/api/system-roles/companies/${cid}/roles/${rolEditingId}`,
        { method: 'PUT', body: JSON.stringify(data) });
    } else {
      res = await apiCall(`/api/system-roles/companies/${cid}/roles`,
        { method: 'POST', body: JSON.stringify(data) });
    }
    if (res.ok || res.status === 200 || res.status === 201) {
      showToast(rolEditingId ? 'Rol actualizado' : 'Rol creado', 'success');
      rolCerrarModal();
      await rolCargarRoles();
      if (rolEditingId) rolRenderPermisos(rolEditingId);
    } else {
      showToast('Error al guardar', 'error');
    }
  } catch (e) {
    showToast('Error de conexión', 'error');
  }
}

async function rolEliminar(roleId) {
  if (!confirm('¿Eliminar este rol? Esta acción no se puede deshacer.')) return;
  const cid = rolCurrentUser?.company_id;
  try {
    const res = await apiCall(`/api/system-roles/companies/${cid}/roles/${roleId}`,
      { method: 'DELETE' });
    if (res.ok) {
      showToast('Rol eliminado', 'success');
      rolSeleccionado = null;
      document.getElementById('rol-permisos').innerHTML =
        '<div class="rol-permisos-empty"><i class="fas fa-shield-alt"></i><span>Selecciona un rol</span></div>';
      await rolCargarRoles();
    } else {
      showToast(res.data?.error || 'No se puede eliminar', 'error');
    }
  } catch (e) {
    showToast('Error de conexión', 'error');
  }
}

// ── USUARIOS ───────────────────────────────────────────────────────────────────
async function rolCargarUsuarios() {
  const cid = rolCurrentUser?.company_id;
  if (!cid) return;
  try {
    const res = await apiCall(`/api/system-roles/companies/${cid}/members`);
    if (res.ok) {
      rolUsuarios = res.data.members || [];
    } else {
      // Fallback: users endpoint
      const r2 = await apiCall(`/api/companies/${cid}/users`);
      rolUsuarios = (r2.data?.users || r2.data || []).map(u => ({
        user_id:  u.user_id || u._id,
        username: u.username || u.name || u.email,
        email:    u.email || '',
        role:     (u.roles?.[0]) || u.role || 'VIEWER_ROL',
      }));
    }
    rolRenderUsuarios(rolUsuarios);
  } catch (e) {
    console.error('Error cargando usuarios:', e);
  }
}

function rolRenderUsuarios(lista) {
  const el = document.getElementById('rol-usuarios-tabla');
  if (!lista.length) {
    el.innerHTML = '<p style="text-align:center;padding:40px;color:#9ba3c0;font-size:13px">No hay usuarios</p>';
    return;
  }

  const opcionesRoles = rolRoles.map(r => {
    const id   = r.role_id || r.id;
    const name = r.role_name || r.name || id;
    return `<option value="${escapeHtml(id)}">${escapeHtml(name)}</option>`;
  }).join('');

  el.innerHTML = `
    <div class="rol-table">
      <div class="rol-table-head">
        <span>Usuario</span>
        <span>Email</span>
        <span>Rol actual</span>
        <span></span>
      </div>
      ${lista.map(u => {
        const initials = (u.username || '?').split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
        return `
          <div class="rol-table-row" id="rol-row-${u.user_id}">
            <div class="rol-user-cell">
              <div class="rol-user-avatar">${escapeHtml(initials)}</div>
              <div>
                <div class="rol-user-name">${escapeHtml(u.username || '')}</div>
              </div>
            </div>
            <div style="font-size:12px;color:#9ba3c0">${escapeHtml(u.email || '')}</div>
            <div>
              <select class="rol-select" id="rol-sel-${u.user_id}"
                onchange="document.getElementById('rol-savebtn-${u.user_id}').classList.remove('saved')">
                ${opcionesRoles.replace(`value="${u.role}"`, `value="${u.role}" selected`)}
              </select>
            </div>
            <div>
              <button class="rol-save-user-btn" id="rol-savebtn-${u.user_id}"
                onclick="rolAsignarRol('${u.user_id}')">
                Guardar
              </button>
            </div>
          </div>`;
      }).join('')}
    </div>`;
}

function rolFiltrarUsuarios(query) {
  const q = query.toLowerCase();
  const filtrados = rolUsuarios.filter(u =>
    (u.username || '').toLowerCase().includes(q) ||
    (u.email || '').toLowerCase().includes(q)
  );
  rolRenderUsuarios(filtrados);
}

async function rolAsignarRol(userId) {
  const sel = document.getElementById(`rol-sel-${userId}`);
  const btn = document.getElementById(`rol-savebtn-${userId}`);
  if (!sel) return;
  const cid    = rolCurrentUser?.company_id;
  const roleId = sel.value;

  try {
    const res = await apiCall(
      `/api/system-roles/companies/${cid}/members/${userId}/role`,
      { method: 'PUT', body: JSON.stringify({ role_id: roleId }) }
    );
    if (res.ok) {
      btn.textContent = '✓ Guardado';
      btn.classList.add('saved');
      setTimeout(() => { btn.textContent = 'Guardar'; btn.classList.remove('saved'); }, 2500);
      // Actualizar estado local
      const u = rolUsuarios.find(u => u.user_id === userId);
      if (u) u.role = roleId;
    } else {
      showToast('Error al asignar', 'error');
    }
  } catch (e) {
    showToast('Error de conexión', 'error');
  }
}

// ── CATASTRO ───────────────────────────────────────────────────────────────────
function rolRenderCatalogo() {
  const head = document.getElementById('rol-catalogo-head');
  const body = document.getElementById('rol-catalogo-body');
  if (!head || !body) return;

  // Header: Función | roles...
  const rolesCols = rolRoles.slice(0, 8);
  head.innerHTML = `<tr>
    <th style="min-width:200px">Sección / Función</th>
    ${rolesCols.map(r => `<th class="rol-col">${escapeHtml(r.role_name || r.name || r.role_id)}</th>`).join('')}
  </tr>`;

  let rows = '';
  ROL_CATALOGO.forEach(mod => {
    rows += `<tr>
      <td class="rol-cat-modulo" colspan="${rolesCols.length + 1}">
        <div class="rol-cat-modulo-icon" style="background:${mod.color}">
          <i class="fas ${mod.icon}"></i>
        </div>
        ${escapeHtml(mod.label)}
      </td>
    </tr>`;
    mod.acciones.forEach(acc => {
      const checks = rolesCols.map(r => {
        const perms = r.permissions || {};
        const ok    = perms[mod.id]?.[acc.id];
        return `<td class="rol-cat-check${ok ? '' : ' off'}">
          <i class="fas ${ok ? 'fa-check-circle' : 'fa-times-circle'}"></i>
        </td>`;
      }).join('');
      rows += `<tr>
        <td class="rol-cat-accion">${escapeHtml(acc.label)}</td>
        ${checks}
      </tr>`;
    });
  });
  body.innerHTML = rows;
}