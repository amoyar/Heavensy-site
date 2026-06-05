// ============================================
// COMPANIES.JS — Módulo de Empresas
// Heavensy Admin
// ============================================
// ── BITÁCORA ──
// 2026-06-04 | Fix raíz vista empresa: initCompaniesPage forzaba heavensy-mode
//              incondicionalmente (línea heredada); ahora condicionado a
//              IS_HEAVENSY. Era la causa de que los admins vieran filtros,
//              ojo y Catastro pese a la regla hvy-only.
// 2026-06-04 | Regla hvy-only global inyectada por JS en initCompaniesPage
//              (el <style> del fragmento HTML no llegaba vía el router).
// 2026-06-04 | Vista empresa: título "Empresa · nombre" (o "Mis empresas" si
//              administra varias); el ojo y Catastro quedan ocultos por la
//              regla hvy-only agregada en companies.html.
// 2026-06-04 | Filtros (empresas y usuarios) convertidos a dropdowns Heavensy
//              vía hvySelectifyAll (assets/js/hvy-select.js).
// 2026-06-04 | Módulo Empresas multi-empresa por membresía: cada admin ve y
//              administra TODAS sus empresas (el backend filtra por membresía).
//              Stats y acciones (editar/eliminar) operan sobre las propias.
// 2026-06-04 | La cadena de montaje del panel Roles también carga el plan de la
//              empresa (rolCargarMiPlan) para la franja y candados upsell.
// 2026-06-03 | Selector de plan del wizard como dropdown estilo Heavensy
//              (cpPlan*), poblado desde la BD; PLANES_LISTA hidratada de BD;
//              fix toggle 'active' con booleano forzado; encadena
//              rolHidratarModelo al montar la pestaña Roles.

console.log('✅ companies.js cargado');

// ── Estado ────────────────────────────────────
let _companies       = [];      // lista completa desde API
let _companiesFiltered = [];    // lista filtrada
let _editingCompanyId  = null;  // null = nueva empresa
let _currentStep       = 0;
let _selectedRubro     = 'salud';
let _rubroConfig       = null;  // config del template seleccionado

// ── Constantes ────────────────────────────────
const RUBRO_LABELS = {
  salud:        { icon: '🏥', name: 'Salud' },
  cabanas:      { icon: '🏕️', name: 'Cabañas' },
  cowork:       { icon: '💼', name: 'Cowork' },
  fitness:      { icon: '💪', name: 'Fitness' },
  educacion:    { icon: '📚', name: 'Academia' },
  propiedades:  { icon: '🏠', name: 'Propiedades' },
};

const AVAILABILITY_LABELS = {
  por_hora:              'Disponibilidad por hora (con almuerzo)',
  por_hora_sin_almuerzo: 'Disponibilidad por hora (sin pausa)',
  por_dia:               'Disponibilidad por días (check-in/out)',
  por_visita:            'Disponibilidad por visitas',
};

// ============================================
// INICIALIZACIÓN
// ============================================

let _cpUsersInited = false;
let _cpRolesInited  = false;
let _cpViewMode     = 'heavensy'; // 'heavensy' | 'usuario'

async function initCompaniesPage() {
  // Regla global del modo Heavensy: oculta hvy-only / btn-icon-hvy fuera del
  // sidebar (ojo, Catastro, barra de filtros) cuando NO se está en vista Heavensy.
  // Inyectada por JS para no depender de que el router preserve <style> del HTML.
  if (!document.getElementById('hvy-mode-rules')) {
    const st = document.createElement('style');
    st.id = 'hvy-mode-rules';
    st.textContent = 'body:not(.heavensy-mode) .hvy-only,' +
                     'body:not(.heavensy-mode) .btn-icon-hvy{display:none !important;}';
    document.head.appendChild(st);
  }

  // Filtros como dropdowns estilo Heavensy (el select oculto sigue siendo la fuente)
  if (typeof hvySelectifyAll === 'function') {
    hvySelectifyAll(['f-plan', 'f-status', 'f-template', 'u-f-role', 'u-f-status']);
  }

  _cpUsersInited = false;
  _cpRolesInited  = false;
  // El modo Heavensy SOLO para el equipo Heavensy. Antes se forzaba
  // incondicionalmente (herencia de cuando el módulo era solo de Heavensy)
  // y dejaba a los admins de empresa viendo el panel completo.
  _cpViewMode = window.IS_HEAVENSY ? 'heavensy' : 'usuario';
  if (window.IS_HEAVENSY) {
    document.body.classList.add('heavensy-mode');
  } else {
    document.body.classList.remove('heavensy-mode');
  }

  if (window.IS_HEAVENSY) {
    const titleEl = document.querySelector('.companies-title');
    if (titleEl) titleEl.textContent = 'Empresa Heavensy';
    const uTitleEl = document.querySelector('.u-list-title');
    if (uTitleEl) uTitleEl.textContent = 'Usuarios Heavensy';
  }

  _cpUpdateViewBtn();
  await cpHidratarPlanes();
  await fetchCompanies();
  window.addEventListener('hashchange', _cpRestoreMode, { once: true });
}

// Carga los planes desde la BD, actualiza PLANES_LISTA y puebla el
// dropdown estilo Heavensy del wizard (w-plan-drop).
async function cpHidratarPlanes() {
  try {
    const res = await apiCall('/api/system-roles/plans');
    // apiCall envuelve el JSON del backend en .data → el dato está en res.data.data.plans
    const plans = res?.data?.data?.plans;
    if (Array.isArray(plans) && plans.length) {
      PLANES_LISTA = plans.map(p => ({ id: p.plan_id, label: p.label }));
    } else {
      console.error('No se pudieron cargar los planes desde la BD');
    }
  } catch (e) {
    console.error('Error cargando planes desde la BD:', e);
  }

  // Poblar el dropdown con PLANES_LISTA (de BD o el valor inicial)
  const drop = document.getElementById('w-plan-drop');
  if (drop) {
    drop.innerHTML = PLANES_LISTA.map(p =>
      `<div class="exc-custom-option" data-value="${p.id}" onclick="cpPlanSelect('${p.id}')">${p.label}</div>`
    ).join('');
  }
}

// ── Dropdown de plan estilo Heavensy (autocontenido en este módulo) ──

function cpPlanToggleDrop(ev) {
  if (ev) ev.stopPropagation();
  const drop    = document.getElementById('w-plan-drop');
  const trigger = document.getElementById('w-plan-trigger');
  if (!drop || !trigger) return;
  const isOpen = drop.classList.contains('open');
  cpPlanCloseDrop();
  if (!isOpen) {
    const rect = trigger.getBoundingClientRect();
    drop.style.left  = rect.left + 'px';
    drop.style.top   = (rect.bottom + 4) + 'px';
    drop.style.width = rect.width + 'px';
    drop.classList.add('open');
    trigger.classList.add('open');
    const reposition = () => {
      if (!drop.classList.contains('open')) {
        window.removeEventListener('scroll', reposition, true);
        window.removeEventListener('resize', reposition);
        return;
      }
      const r = trigger.getBoundingClientRect();
      drop.style.left  = r.left + 'px';
      drop.style.top   = (r.bottom + 4) + 'px';
      drop.style.width = r.width + 'px';
    };
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
  }
}

function cpPlanCloseDrop() {
  const drop    = document.getElementById('w-plan-drop');
  const trigger = document.getElementById('w-plan-trigger');
  if (drop)    drop.classList.remove('open');
  if (trigger) trigger.classList.remove('open');
}

// Selecciona un plan: actualiza el hidden (compatible con get/set), el label y el activo
function cpPlanSelect(planId) {
  cpPlanSetValue(planId);
  cpPlanCloseDrop();
}

// Setea el valor del plan (usado también al cargar una empresa para editar)
function cpPlanSetValue(planId) {
  const hidden = document.getElementById('w-plan_id');
  const label  = document.getElementById('w-plan-label');
  const drop   = document.getElementById('w-plan-drop');
  const plan   = PLANES_LISTA.find(p => p.id === planId);

  if (hidden) hidden.value = plan ? plan.id : '';
  if (label) {
    if (plan) {
      label.textContent = plan.label;
      label.style.color = '#383838';
    } else {
      label.textContent = 'Seleccionar plan';
      label.style.color = '#9BA3C0';
    }
  }
  if (drop) {
    drop.querySelectorAll('.exc-custom-option').forEach(o =>
      o.classList.toggle('active', !!(plan && o.dataset.value === plan.id))
    );
  }
}

// Cerrar el dropdown al hacer click fuera
document.addEventListener('click', (e) => {
  const wrap = e.target.closest && e.target.closest('.exc-custom-select-wrap');
  if (!wrap) cpPlanCloseDrop();
});

function cpViewAsCompany(companyId) {
  _cpViewMode = 'usuario';
  document.body.classList.remove('heavensy-mode');
  _companiesFiltered = _companies.filter(c => c.company_id === companyId);
  renderCompanies();
  window._cpOverrideCompanyId = companyId;
  _cpUsersInited = false;
  // Actualizar títulos con nombre de la empresa
  const company = _companies.find(c => c.company_id === companyId);
  const companyName = company?.name || companyId;
  const titleEl = document.querySelector('.companies-title');
  if (titleEl) titleEl.textContent = 'Empresa · ' + companyName;
  const uTitleEl = document.querySelector('.u-list-title');
  if (uTitleEl) uTitleEl.textContent = 'Usuarios · ' + companyName;
  _cpUpdateViewBtn();
}

function _cpRestoreMode() {
  if (window.IS_HEAVENSY) {
    document.body.classList.add('heavensy-mode');
  } else {
    document.body.classList.remove('heavensy-mode');
  }
}

function cpToggleView() {
  const isHeavensy = document.body.classList.contains('heavensy-mode');
  if (isHeavensy) {
    _cpViewMode = 'usuario';
    document.body.classList.remove('heavensy-mode');
    // Mostrar solo empresa propia (HEAVENSY_001)
    try {
      const token = localStorage.getItem('token');
      const p = JSON.parse(atob(token.split('.')[1]));
      const userCompanyId = p.company_id || '';
      _companiesFiltered = _companies.filter(c => c.company_id === userCompanyId);
      window._cpOverrideCompanyId = userCompanyId;
    } catch(e) { _companiesFiltered = []; }
    renderCompanies();
    _cpUsersInited = false;
  } else {
    _cpViewMode = 'heavensy';
    document.body.classList.add('heavensy-mode');
    // Restaurar todas las empresas y usuarios de HEAVENSY_001
    _companiesFiltered = [..._companies];
    window._cpOverrideCompanyId = null;
    renderCompanies();
    _cpUsersInited = false;
    const titleEl = document.querySelector('.companies-title');
    if (titleEl) titleEl.textContent = window.IS_HEAVENSY ? 'Empresa Heavensy' : 'Empresas';
    const uTitleEl = document.querySelector('.u-list-title');
    if (uTitleEl) uTitleEl.textContent = window.IS_HEAVENSY ? 'Usuarios Heavensy' : 'Usuarios';
  }
  _cpUpdateViewBtn();
}

function _cpUpdateViewBtn() {
  if (typeof navUpdateEye === 'function') navUpdateEye();
}

function cpSwitchTab(tab, btn) {
  document.querySelectorAll('.cp-main-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('#companiesRoot .cp-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('cp-panel-' + tab).classList.add('active');

  if (tab === 'usuarios' && !_cpUsersInited) {
    _cpUsersInited = true;
    if (typeof initUsersPage === 'function') initUsersPage();
  }
  if (tab === 'roles' && !_cpRolesInited) {
    _cpRolesInited = true;
    try {
      const token = localStorage.getItem('token');
      if (token) {
        const p = JSON.parse(atob(token.split('.')[1]));
        window.rolCurrentUser = { id: p.user_id || p.sub, company_id: p.company_id, role: p.role };
      }
    } catch(e) {}
    if (typeof rolCargarPlanConfig === 'function') {
      // Hidratar módulos/planes desde la BD ANTES de cargar config y roles.
      const _hidratar = (typeof rolHidratarModelo === 'function')
        ? rolHidratarModelo()
        : Promise.resolve();
      const _miPlan = (typeof rolCargarMiPlan === 'function')
        ? rolCargarMiPlan()
        : Promise.resolve();
      Promise.all([_hidratar, _miPlan]).then(() => rolCargarPlanConfig()).then(() => {
        if (typeof rolCargarRoles === 'function') rolCargarRoles();
      });
    }
  }
  if (tab === 'catastro') {
    if (typeof rolRenderCatalogo === 'function') rolRenderCatalogo();
  }
}

// ============================================
// LISTADO
// ============================================

async function fetchCompanies() {
  const tbody   = document.getElementById('companies-tbody');
  const loading = document.getElementById('companies-loading');
  const empty   = document.getElementById('companies-empty');

  if (loading) loading.style.display = 'flex';
  if (empty)   empty.style.display   = 'none';
  if (tbody)   tbody.innerHTML       = '';

  const res = await apiCall('/api/companies', { loaderMessage: 'Cargando empresas...' });

  if (loading) loading.style.display = 'none';

  if (!res.ok) {
    showToast('Error cargando empresas', 'error');
    return;
  }

  _companies         = res.data.companies || [];
  _companiesFiltered = [..._companies];
  renderCompanies();
  updateStats();

  // Vista empresa: título personalizado (igual que "ver como empresa")
  if (!window.IS_HEAVENSY) {
    const titleEl = document.querySelector('.companies-title');
    if (titleEl) {
      titleEl.textContent = _companies.length === 1
        ? 'Empresa · ' + (_companies[0].name || _companies[0].company_id)
        : 'Mis empresas';
    }
  }
}

function renderCompanies() {
  const tbody = document.getElementById('companies-tbody');
  const empty = document.getElementById('companies-empty');
  if (!tbody) return;

  tbody.innerHTML = '';

  if (_companiesFiltered.length === 0) {
    if (empty) empty.style.display = 'flex';
    return;
  }
  if (empty) empty.style.display = 'none';

  _companiesFiltered.forEach(company => {
    const tr = document.createElement('tr');
    const isActive    = company.active !== false;
    const rubro       = company.business_config?.template || '—';
    const rubroInfo   = RUBRO_LABELS[rubro] || { icon: '🏢', name: rubro };
    const hasWa       = !!(company.whatsapp_config?.phone_number_id || company.phone_number_id);
    const plan        = company.plan_id || '—';

    tr.innerHTML = `
      <td>
        <div class="company-name-cell">${escapeHtml(company.name || company.company_id)}</div>
        <div class="company-id-cell">${escapeHtml(company.company_id)}</div>
      </td>
      <td>
        <span class="badge-rubro">${rubroInfo.icon} ${rubroInfo.name}</span>
      </td>
      <td><span class="badge-plan">${escapeHtml(plan)}</span></td>
      <td>
        <span class="wa-indicator ${hasWa ? 'ok' : 'miss'}">
          <i class="fab fa-whatsapp"></i>
          ${hasWa ? 'Configurado' : 'Sin config'}
        </span>
      </td>
      <td>
        <label class="switch">
          <input type="checkbox" ${isActive ? 'checked' : ''}
            onchange="toggleCompanyStatus('${company.company_id}', ${isActive}, this)" />
          <span class="slider"></span>
        </label>
      </td>
      <td>
        <button class="btn-icon btn-icon-hvy" title="Ver como empresa" onclick="cpViewAsCompany('${company.company_id}')">
          <i class="fas fa-eye"></i>
        </button>
        <button class="btn-icon" title="Editar" onclick="openWizard('${company.company_id}')">
          <i class="fas fa-pen"></i>
        </button>
        <button class="btn-icon danger" title="Eliminar" onclick="confirmDeleteCompany('${company.company_id}')">
          <i class="fas fa-trash"></i>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Valor inicial; se reemplaza con los planes de la BD (GET /api/system-roles/plans)
// en cpHidratarPlanes(), llamada desde initCompaniesPage().
let PLANES_LISTA = [
  { id: 'gratis',          label: 'Gratis'              },
  { id: 'automate',        label: 'Automate Pro'        },
  { id: 'secretaria',      label: 'Secretar IA Premium' },
  { id: 'enterprise',      label: 'Enterprise'          },
  { id: 'enterprise_full', label: 'Enterprise Full'     },
];

function updateStats() {
  const total = _companies.length;
  const el    = id => document.getElementById(id);
  if (el('st-total')) el('st-total').textContent = total;

  const bar = el('st-plans-bar');
  if (!bar) return;

  // Contar empresas por plan_id
  const counts = {};
  _companies.forEach(c => {
    const pid = (c.plan_id || '').toLowerCase();
    counts[pid] = (counts[pid] || 0) + 1;
  });

  // Limpiar cards anteriores
  bar.querySelectorAll('.stat-plan').forEach(s => s.remove());

  // Una card fija por cada plan conocido
  PLANES_LISTA.forEach(({ id, label }) => {
    const div = document.createElement('div');
    div.className = 'stat stat-plan';
    div.innerHTML =
      '<div class="stat-label">' + label + '</div>' +
      '<div class="stat-val">' + (counts[id] || 0) + '</div>';
    bar.appendChild(div);
  });
}

// ── Filtros ───────────────────────────────────

function filterCompanies() {
  const search   = (document.getElementById('f-search')?.value   || '').toLowerCase();
  const plan     = (document.getElementById('f-plan')?.value     || '');
  const status   = (document.getElementById('f-status')?.value   || '');
  const template = (document.getElementById('f-template')?.value || '');

  _companiesFiltered = _companies.filter(c => {
    const matchSearch = !search ||
      c.company_id?.toLowerCase().includes(search) ||
      c.name?.toLowerCase().includes(search) ||
      c.contact_email?.toLowerCase().includes(search);

    const matchPlan   = !plan   || c.plan_id === plan;
    const matchStatus = !status ||
      (status === 'active'   && c.active !== false) ||
      (status === 'inactive' && c.active === false);
    const matchTemplate = !template || c.business_config?.template === template;

    return matchSearch && matchPlan && matchStatus && matchTemplate;
  });

  renderCompanies();
}

function clearCompanyFilters() {
  ['f-search','f-plan','f-status','f-template'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  _companiesFiltered = [..._companies];
  renderCompanies();
}

// ── Toggle activo ─────────────────────────────

async function toggleCompanyStatus(companyId, currentActive, checkbox) {
  const newActive = !currentActive;
  const res = await apiCall(`/api/companies/${companyId}`, {
    method: 'PUT',
    body: JSON.stringify({ active: newActive }),
  });

  if (res.ok) {
    const company = _companies.find(c => c.company_id === companyId);
    if (company) company.active = newActive;
    updateStats();
    showToast(`Empresa ${newActive ? 'activada' : 'desactivada'}`, 'success');
  } else {
    checkbox.checked = currentActive; // revertir
    showToast('Error actualizando empresa', 'error');
  }
}

// ── Eliminar ──────────────────────────────────

function confirmDeleteCompany(companyId) {
  const company = _companies.find(c => c.company_id === companyId);
  const name    = company?.name || companyId;

  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40';
  modal.innerHTML = `
    <div style="background:#fff;border-radius:12px;padding:24px;max-width:380px;width:100%;margin:0 16px">
      <div style="font-size:14px;font-weight:700;color:#3b4a6b;margin-bottom:8px">
        ¿Desactivar empresa?
      </div>
      <div style="font-size:12px;color:#6b7280;margin-bottom:20px">
        La empresa <strong>${escapeHtml(name)}</strong> quedará inactiva. Esta acción es reversible.
      </div>
      <div style="display:flex;gap:10px;justify-content:flex-end">
        <button onclick="this.closest('.fixed').remove()"
          style="padding:7px 16px;border:1px solid #e5e7eb;border-radius:7px;font-size:12px;cursor:pointer;background:#fff">
          Cancelar
        </button>
        <button onclick="deleteCompany('${companyId}');this.closest('.fixed').remove()"
          style="padding:7px 16px;border:none;border-radius:7px;font-size:12px;cursor:pointer;background:#ef4444;color:#fff;font-weight:600">
          Desactivar
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

async function deleteCompany(companyId) {
  const res = await apiCall(`/api/companies/${companyId}`, { method: 'DELETE' });
  if (res.ok) {
    showToast('Empresa desactivada', 'success');
    await fetchCompanies();
  } else {
    showToast('Error desactivando empresa', 'error');
  }
}

// ============================================
// WIZARD
// ============================================

async function openWizard(companyId = null) {
  _editingCompanyId = companyId;
  _currentStep      = 0;
  _selectedRubro    = 'salud';
  _rubroConfig      = null;

  // Asegurar que el dropdown de plan tenga opciones (por si el init no las pobló)
  const planDrop = document.getElementById('w-plan-drop');
  if (planDrop && planDrop.children.length === 0) {
    await cpHidratarPlanes();
  }
  // Resetear selección de plan (en edición, loadCompanyIntoWizard la setea después)
  cpPlanSetValue('');

  // Limpiar formulario
  clearWizardForm();

  // Título
  const titleEl = document.getElementById('wizard-title');
  if (titleEl) titleEl.textContent = companyId ? 'Editar empresa' : 'Nueva empresa';

  const saveBtnText = document.getElementById('save-btn-text');
  if (saveBtnText) saveBtnText.textContent = companyId ? 'Guardar cambios' : 'Crear empresa';

  // Si edición: cargar datos
  if (companyId) {
    await loadCompanyIntoWizard(companyId);
  } else {
    // Nueva empresa: cargar template salud por defecto
    await loadRubroTemplate('salud');
  }

  // Mostrar vista wizard
  showView('view-wizard');
  wGoStep(0);
}

function closeWizard() {
  showView('view-list');
  _editingCompanyId = null;
}

function showView(viewId) {
  document.querySelectorAll('#cp-panel-empresas .view').forEach(v => v.classList.remove('active'));
  const view = document.getElementById(viewId);
  if (view) view.classList.add('active');
}

// ── Cargar empresa en wizard ──────────────────

async function loadCompanyIntoWizard(companyId) {
  const [resCompany, resConfig] = await Promise.all([
    apiCall(`/api/companies/${companyId}`),
    apiCall(`/api/companies/${companyId}/config`),
  ]);

  if (!resCompany.ok) {
    showToast('Error cargando empresa', 'error');
    return;
  }

  const company = resCompany.data.company;
  const config  = resConfig.ok ? resConfig.data.config : null;

  // Paso 1: Datos básicos
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
  const setChk = (id, val) => { const el = document.getElementById(id); if (el) el.checked = !!val; };

  set('w-company_id',       company.company_id);
  set('w-name',             company.name);
  set('w-legal_name',       company.legal_name);
  set('w-rut',              company.rut);
  set('w-description',      company.description);
  set('w-contact_email',    company.contact_email);
  set('w-contact_phone',    company.contact_phone);
  set('w-address',          company.address);
  set('w-website',          company.website);
  cpPlanSetValue(company.plan_id);
  setChk('w-active',        company.active !== false);

  // Paso 2: Rubro
  const template = config?.template || 'salud';
  _selectedRubro = template;
  document.querySelectorAll('.rubro-card').forEach(card => {
    card.classList.toggle('active', card.dataset.key === template);
  });
  await loadRubroTemplate(template);

  // Paso 3: WhatsApp
  const wa = company.whatsapp_config || {};
  set('w-phone_number_id',  company.phone_number_id || wa.phone_number_id);
  set('w-wa_webhook_url',   wa.webhook_url);
  set('w-wa_access_token',  ''); // no mostrar token por seguridad
  set('w-wa_verify_token',  '');

  // Paso 4: Bot
  const bot = company.bot_config || {};
  set('w-bot_name',          bot.name || company.bot_name);
  set('w-max_messages',      bot.max_messages || company.max_messages);
  set('w-greeting_message',  bot.greeting_message || company.greeting_message);
  setChk('w-bot_active',     bot.active !== false);

  // Deshabilitar company_id en edición
  const cidEl = document.getElementById('w-company_id');
  if (cidEl) { cidEl.disabled = true; cidEl.style.background = '#f9fafb'; }
}

function clearWizardForm() {
  const fields = ['w-company_id','w-name','w-legal_name','w-rut','w-description',
    'w-contact_email','w-contact_phone','w-address','w-website',
    'w-phone_number_id','w-wa_webhook_url','w-wa_access_token','w-wa_verify_token',
    'w-bot_name','w-max_messages','w-greeting_message'];

  fields.forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.value = ''; el.disabled = false; el.style.background = ''; }
  });

  const wActive   = document.getElementById('w-active');
  const botActive = document.getElementById('w-bot_active');
  if (wActive)   wActive.checked   = true;
  if (botActive) botActive.checked = true;

  // Reset rubro
  document.querySelectorAll('.rubro-card').forEach(card => {
    card.classList.toggle('active', card.dataset.key === 'salud');
  });
  _selectedRubro = 'salud';

  // Limpiar error
  const errEl = document.getElementById('wizard-error');
  if (errEl) errEl.style.display = 'none';
}

// ── Navegación de pasos ───────────────────────

function wGoStep(step) {
  _currentStep = step;

  // Actualizar step indicators
  document.querySelectorAll('.step').forEach((el, i) => {
    el.classList.remove('active', 'done');
    if (i < step)  el.classList.add('done');
    if (i === step) el.classList.add('active');
  });

  // Mostrar panel correcto
  document.querySelectorAll('.wizard-panel').forEach((el, i) => {
    el.classList.toggle('active', i === step);
  });

  // Al llegar a revisión: construir el resumen
  if (step === 4) buildReview();
}

function wNext(currentStep) {
  // Validar paso actual
  if (!validateStep(currentStep)) return;
  wGoStep(currentStep + 1);
}

function validateStep(step) {
  const errEl = document.getElementById('wizard-error');
  if (errEl) errEl.style.display = 'none';

  if (step === 0) {
    const cid   = document.getElementById('w-company_id')?.value?.trim();
    const name  = document.getElementById('w-name')?.value?.trim();
    const email = document.getElementById('w-contact_email')?.value?.trim();

    if (!_editingCompanyId && !cid) {
      showWizardError('El ID de empresa es requerido');
      return false;
    }
    if (!name) {
      showWizardError('El nombre comercial es requerido');
      return false;
    }
    if (!email || !email.includes('@')) {
      showWizardError('El email de contacto es requerido y debe ser válido');
      return false;
    }
  }
  return true;
}

function showWizardError(msg) {
  const errEl = document.getElementById('wizard-error');
  if (!errEl) return;
  errEl.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${escapeHtml(msg)}`;
  errEl.style.display = 'flex';
}

// ── Rubro ─────────────────────────────────────

async function selectRubro(key, card) {
  _selectedRubro = key;
  document.querySelectorAll('.rubro-card').forEach(c => c.classList.remove('active'));
  card.classList.add('active');
  await loadRubroTemplate(key);
}

async function loadRubroTemplate(key) {
  const res = await apiCall(`/api/companies/templates/${key}`);
  if (!res.ok) return;

  _rubroConfig = res.data.config;
  renderTemplatePreview(_rubroConfig);
}

function renderTemplatePreview(config) {
  if (!config) return;

  const badgeEl   = document.getElementById('tp-badge');
  const modeEl    = document.getElementById('tp-mode');
  const labelsEl  = document.getElementById('tp-labels');
  const modulesEl = document.getElementById('tp-modules');

  if (badgeEl) {
    const l = config.labels || {};
    badgeEl.textContent = `${l.recurso || '—'} · ${l.servicio || '—'}`;
  }
  if (modeEl) {
    modeEl.textContent = AVAILABILITY_LABELS[config.availability_mode] || config.availability_mode;
  }
  if (labelsEl) {
    const l = config.labels || {};
    const items = [
      ['Recurso', l.recurso], ['Servicio', l.servicio],
      ['Sección', l.seccion_lateral], ['Tab agenda', l.tab_agenda],
    ];
    labelsEl.innerHTML = items.map(([k, v]) =>
      `<div class="tp-label-chip">${k}: <span>${escapeHtml(v || '—')}</span></div>`
    ).join('');
  }
  if (modulesEl) {
    const m = config.modules || {};
    const mods = ['agenda','calendario','especialidad','servicios','inventario','pagos'];
    modulesEl.innerHTML = mods.map(mod =>
      `<span class="tp-module ${m[mod] ? 'on' : 'off'}">
        <i class="fas fa-${m[mod] ? 'check' : 'times'}"></i> ${mod}
      </span>`
    ).join('');
  }
}

// ── Revisión ──────────────────────────────────

function buildReview() {
  const container = document.getElementById('review-content');
  if (!container) return;

  const get    = id => document.getElementById(id)?.value || '';
  const getChk = id => document.getElementById(id)?.checked;
  const rubro  = RUBRO_LABELS[_selectedRubro] || { icon: '🏢', name: _selectedRubro };

  container.innerHTML = `
    <div class="review-section">
      <div class="review-section-title"><i class="fas fa-building"></i> Datos básicos</div>
      <div class="review-grid">
        <div class="review-row">
          <span class="review-label">ID Empresa</span>
          <span class="review-val ${!get('w-company_id') ? 'empty' : ''}">${escapeHtml(get('w-company_id')) || '(sin ID)'}</span>
        </div>
        <div class="review-row">
          <span class="review-label">Nombre</span>
          <span class="review-val">${escapeHtml(get('w-name')) || '—'}</span>
        </div>
        <div class="review-row">
          <span class="review-label">Email</span>
          <span class="review-val">${escapeHtml(get('w-contact_email')) || '—'}</span>
        </div>
        <div class="review-row">
          <span class="review-label">Plan</span>
          <span class="review-val">${escapeHtml(get('w-plan_id')) || '—'}</span>
        </div>
        <div class="review-row">
          <span class="review-label">Estado</span>
          <span class="review-val">${getChk('w-active') ? '✅ Activa' : '⏸ Inactiva'}</span>
        </div>
      </div>
    </div>

    <div class="review-section">
      <div class="review-section-title"><i class="fas fa-th-large"></i> Rubro</div>
      <div class="review-val">${rubro.icon} ${rubro.name}</div>
      ${_rubroConfig ? `
        <div style="margin-top:8px;font-size:11px;color:#7D84C1">
          ${_rubroConfig.labels?.recurso || '—'} · ${_rubroConfig.labels?.servicio || '—'} ·
          ${AVAILABILITY_LABELS[_rubroConfig.availability_mode] || _rubroConfig.availability_mode}
        </div>` : ''}
    </div>

    <div class="review-section">
      <div class="review-section-title"><i class="fab fa-whatsapp"></i> WhatsApp</div>
      <div class="review-grid">
        <div class="review-row">
          <span class="review-label">Phone Number ID</span>
          <span class="review-val ${!get('w-phone_number_id') ? 'empty' : ''}">${escapeHtml(get('w-phone_number_id')) || 'Sin configurar'}</span>
        </div>
        <div class="review-row">
          <span class="review-label">Access Token</span>
          <span class="review-val ${!get('w-wa_access_token') ? 'empty' : ''}">${get('w-wa_access_token') ? '••••••••' : 'Sin configurar'}</span>
        </div>
      </div>
    </div>

    <div class="review-section">
      <div class="review-section-title"><i class="fas fa-robot"></i> Bot</div>
      <div class="review-grid">
        <div class="review-row">
          <span class="review-label">Nombre</span>
          <span class="review-val">${escapeHtml(get('w-bot_name')) || '—'}</span>
        </div>
        <div class="review-row">
          <span class="review-label">Estado</span>
          <span class="review-val">${getChk('w-bot_active') ? '✅ Activo' : '⏸ Inactivo'}</span>
        </div>
      </div>
    </div>
  `;
}

// ── Guardar ───────────────────────────────────

async function saveCompany() {
  const saveBtn = document.getElementById('save-btn');
  if (saveBtn) { saveBtn.disabled = true; }

  const errEl = document.getElementById('wizard-error');
  if (errEl) errEl.style.display = 'none';

  try {
    const get    = id => document.getElementById(id)?.value?.trim() || null;
    const getChk = id => document.getElementById(id)?.checked ?? true;

    // Construir payload empresa
    const companyData = {
      name:          get('w-name'),
      legal_name:    get('w-legal_name'),
      rut:           get('w-rut'),
      description:   get('w-description'),
      contact_email: get('w-contact_email'),
      contact_phone: get('w-contact_phone'),
      address:       get('w-address'),
      website:       get('w-website'),
      plan_id:       get('w-plan_id'),
      active:        getChk('w-active'),
      phone_number_id: get('w-phone_number_id'),
      whatsapp_config: {
        phone_number_id: get('w-phone_number_id'),
        webhook_url:     get('w-wa_webhook_url'),
        ...(get('w-wa_access_token') ? { access_token: get('w-wa_access_token') } : {}),
        ...(get('w-wa_verify_token') ? { verify_token: get('w-wa_verify_token') } : {}),
      },
      bot_config: {
        name:             get('w-bot_name'),
        max_messages:     parseInt(get('w-max_messages')) || 150,
        greeting_message: get('w-greeting_message'),
        active:           getChk('w-bot_active'),
      },
    };

    let companyId = _editingCompanyId;

    if (_editingCompanyId) {
      // ── EDITAR ──
      const res = await apiCall(`/api/companies/${_editingCompanyId}`, {
        method: 'PUT',
        body:   JSON.stringify(companyData),
      });
      if (!res.ok) {
        showWizardError(res.data?.error || 'Error actualizando empresa');
        return;
      }
    } else {
      // ── CREAR ──
      companyData.company_id = get('w-company_id');
      const res = await apiCall('/api/companies', {
        method: 'POST',
        body:   JSON.stringify(companyData),
      });
      if (!res.ok) {
        showWizardError(res.data?.error || 'Error creando empresa');
        return;
      }
      companyId = res.data.company_id;
    }

    // ── Guardar business_config ──
    if (_rubroConfig && companyId) {
      const configPayload = {
        template:          _selectedRubro,
        labels:            _rubroConfig.labels,
        modules:           _rubroConfig.modules,
        resource_defaults: _rubroConfig.resource_defaults,
        availability_mode: _rubroConfig.availability_mode,
      };
      await apiCall(`/api/companies/${companyId}/config`, {
        method: 'PUT',
        body:   JSON.stringify(configPayload),
      });
    }

    showToast(
      _editingCompanyId ? 'Empresa actualizada ✅' : 'Empresa creada ✅',
      'success'
    );
    closeWizard();
    await fetchCompanies();

  } catch (err) {
    showWizardError('Error inesperado: ' + err.message);
  } finally {
    if (saveBtn) saveBtn.disabled = false;
  }
}

// ============================================
// EXPONER GLOBALMENTE
// ============================================

window.initCompaniesPage    = initCompaniesPage;
window.cpSwitchTab          = cpSwitchTab;
window.cpToggleView         = cpToggleView;
window.cpViewAsCompany      = cpViewAsCompany;
window.openWizard           = openWizard;
window.closeWizard          = closeWizard;
window.wGoStep              = wGoStep;
window.wNext                = wNext;
window.selectRubro          = selectRubro;
window.saveCompany          = saveCompany;
window.filterCompanies      = filterCompanies;
window.clearCompanyFilters  = clearCompanyFilters;
window.toggleCompanyStatus  = toggleCompanyStatus;
window.confirmDeleteCompany = confirmDeleteCompany;
window.deleteCompany        = deleteCompany;