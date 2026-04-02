// ============================================
// COMPANIES.JS — Módulo de Empresas
// Heavensy Admin
// ============================================

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

async function initCompaniesPage() {
  console.log('🚀 Inicializando módulo de empresas');
  await fetchCompanies();
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

function updateStats() {
  const total    = _companies.length;
  const active   = _companies.filter(c => c.active !== false).length;
  const inactive = total - active;

  const el = id => document.getElementById(id);
  if (el('st-total'))    el('st-total').textContent    = total;
  if (el('st-active'))   el('st-active').textContent   = active;
  if (el('st-inactive')) el('st-inactive').textContent = inactive;
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
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
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
  set('w-plan_id',          company.plan_id);
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