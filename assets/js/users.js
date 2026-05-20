// ============================================
// USERS.JS — Módulo de Usuarios
// Heavensy Admin
// ============================================

console.log('✅ users.js cargado');

// ── Estado ────────────────────────────────────
let _users           = [];
let _usersFiltered   = [];
let _userCompanyId   = null;  // empresa del usuario logueado
let _availableCompanies = []; // empresas disponibles para asignar
let _availableResources = []; // recursos de la empresa
let _editingUsername = null;

// Estado del wizard
let _wCompanies      = [];    // [{ company_id, company_name, roles[], is_primary }]
let _wSelectedResource = null; // resource_id o null

// ── Roles disponibles ─────────────────────────
const AVAILABLE_ROLES = [
  { id: 'ADMIN_ROL',    label: 'Admin',      icon: 'fa-shield-alt' },
  { id: 'OPERATOR_ROL', label: 'Operador',   icon: 'fa-headset' },
  { id: 'VIEWER_ROL',   label: 'Viewer',     icon: 'fa-eye' },
];

// ============================================
// INICIALIZACIÓN
// ============================================

async function initUsersPage() {
  console.log('🚀 Inicializando módulo de usuarios');

  // Obtener empresa del usuario logueado
  const claims = getUserFromToken();
  _userCompanyId = claims?.company_id || localStorage.getItem('company_id');

  await Promise.all([
    fetchUsers(),
    fetchAvailableCompanies(),
  ]);
}

// ============================================
// LISTADO
// ============================================

async function fetchUsers() {
  if (!_userCompanyId) {
    showToast('No se pudo determinar la empresa activa', 'error');
    return;
  }

  const loading = document.getElementById('u-loading');
  const empty   = document.getElementById('u-empty');
  const tbody   = document.getElementById('u-tbody');

  if (loading) loading.style.display = 'flex';
  if (empty)   empty.style.display   = 'none';
  if (tbody)   tbody.innerHTML        = '';

  const res = await apiCall(`/api/companies/${_userCompanyId}/users`);

  if (loading) loading.style.display = 'none';

  if (!res.ok) {
    showToast('Error cargando usuarios', 'error');
    return;
  }

  _users         = res.data.users || [];
  _usersFiltered = [..._users];
  renderUsers();
  updateUserStats();
}

async function fetchAvailableCompanies() {
  const res = await apiCall('/api/companies');
  if (res.ok) _availableCompanies = res.data.companies || [];
}

async function fetchResources(companyId) {
  const res = await apiCall(`/api/agenda/company/${companyId}`);
  if (res.ok) {
    _availableResources = res.data.resources || res.data || [];
  }
}

function renderUsers() {
  const tbody = document.getElementById('u-tbody');
  const empty = document.getElementById('u-empty');
  if (!tbody) return;

  tbody.innerHTML = '';

  if (_usersFiltered.length === 0) {
    if (empty) empty.style.display = 'flex';
    return;
  }
  if (empty) empty.style.display = 'none';

  _usersFiltered.forEach(user => {
    const isActive  = user.status === 'A';
    const roles     = user.company_roles || [];
    const roleLabel = roles[0] || '—';
    const hasResource = !!user.company_resource_id;
    const initials  = _getInitials(user.first_name, user.last_name);
    const color     = _getAvatarColor(user.username || user._id);

    const tr = document.createElement('tr');
    if (!isActive) tr.style.opacity = '.6';

    tr.innerHTML = `
      <td>
        <div class="u-user-cell">
          <div class="u-avatar" style="background:${color.bg};color:${color.text}">${initials}</div>
          <div>
            <div class="u-user-name">${escapeHtml(_fullName(user))}</div>
            <div class="u-user-sub">${escapeHtml(user.username || '')}</div>
          </div>
        </div>
      </td>
      <td>${escapeHtml(user.email || '—')}</td>
      <td><span class="u-badge u-badge-role">${escapeHtml(roleLabel)}</span></td>
      <td>${hasResource ? '<span class="u-badge u-badge-resource">Sí</span>' : '—'}</td>
      <td>${escapeHtml(user.company_name || _userCompanyId || '—')}</td>
      <td>
        <label class="u-switch">
          <input type="checkbox" ${isActive ? 'checked' : ''}
            onchange="toggleUserStatus('${user.username}', ${isActive}, this)"/>
          <span class="u-slider"></span>
        </label>
      </td>
      <td>
        <button class="u-btn-icon" title="Editar" onclick="openUserWizard('${user.username}')">
          <i class="fas fa-pen"></i>
        </button>
        <button class="u-btn-icon danger" title="Desactivar" onclick="confirmDeleteUser('${user.username}')">
          <i class="fas fa-trash"></i>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function updateUserStats() {
  const total    = _users.length;
  const active   = _users.filter(u => u.status === 'A').length;
  const inactive = total - active;
  const el = id => document.getElementById(id);
  if (el('u-st-total'))    el('u-st-total').textContent    = total;
  if (el('u-st-active'))   el('u-st-active').textContent   = active;
  if (el('u-st-inactive')) el('u-st-inactive').textContent = inactive;
}

// ── Filtros ───────────────────────────────────

function filterUsers() {
  const search   = (document.getElementById('u-f-search')?.value   || '').toLowerCase();
  const role     = (document.getElementById('u-f-role')?.value     || '');
  const status   = (document.getElementById('u-f-status')?.value   || '');
  const resource = (document.getElementById('u-f-resource')?.value || '');

  _usersFiltered = _users.filter(u => {
    const matchSearch = !search ||
      u.username?.toLowerCase().includes(search) ||
      u.email?.toLowerCase().includes(search) ||
      _fullName(u).toLowerCase().includes(search);

    const matchRole = !role || (u.company_roles || []).includes(role);

    const matchStatus = !status ||
      (status === 'active'   && u.status === 'A') ||
      (status === 'inactive' && u.status !== 'A');

    const matchResource = !resource ||
      (resource === 'yes' && u.company_resource_id) ||
      (resource === 'no'  && !u.company_resource_id);

    return matchSearch && matchRole && matchStatus && matchResource;
  });

  renderUsers();
}

function clearUserFilters() {
  ['u-f-search','u-f-role','u-f-status','u-f-resource'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  _usersFiltered = [..._users];
  renderUsers();
}

// ── Toggle activo ─────────────────────────────

async function toggleUserStatus(username, currentActive, checkbox) {
  const newStatus = currentActive ? 'I' : 'A';
  const res = await apiCall(`/api/users/${username}`, {
    method: 'PUT',
    body: JSON.stringify({ status: newStatus }),
  });

  if (res.ok) {
    const user = _users.find(u => u.username === username);
    if (user) user.status = newStatus;
    updateUserStats();
    showToast(`Usuario ${newStatus === 'A' ? 'activado' : 'desactivado'}`, 'success');
  } else {
    checkbox.checked = currentActive;
    showToast('Error actualizando usuario', 'error');
  }
}

// ── Eliminar ──────────────────────────────────

function confirmDeleteUser(username) {
  const user = _users.find(u => u.username === username);
  const name = _fullName(user) || username;

  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40';
  modal.innerHTML = `
    <div style="background:#fff;border-radius:12px;padding:24px;max-width:380px;width:100%;margin:0 16px">
      <div style="font-size:14px;font-weight:700;color:#3b4a6b;margin-bottom:8px">¿Desactivar usuario?</div>
      <div style="font-size:12px;color:#6b7280;margin-bottom:20px">
        El usuario <strong>${escapeHtml(name)}</strong> quedará inactivo. Esta acción es reversible.
      </div>
      <div style="display:flex;gap:10px;justify-content:flex-end">
        <button onclick="this.closest('.fixed').remove()"
          style="padding:7px 16px;border:1px solid #e5e7eb;border-radius:7px;font-size:12px;cursor:pointer;background:#fff">
          Cancelar
        </button>
        <button onclick="deactivateUser('${username}');this.closest('.fixed').remove()"
          style="padding:7px 16px;border:none;border-radius:7px;font-size:12px;cursor:pointer;background:#ef4444;color:#fff;font-weight:600">
          Desactivar
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

async function deactivateUser(username) {
  const res = await apiCall(`/api/users/${username}`, { method: 'DELETE' });
  if (res.ok) {
    showToast('Usuario desactivado', 'success');
    await fetchUsers();
  } else {
    showToast('Error desactivando usuario', 'error');
  }
}

// ============================================
// WIZARD
// ============================================

async function openUserWizard(username = null) {
  _editingUsername    = username;
  _wCompanies         = [];
  _wSelectedResource  = null;

  clearUserWizardForm();

  const titleEl = document.getElementById('u-wizard-title');
  if (titleEl) titleEl.textContent = username ? 'Editar usuario' : 'Nuevo usuario';
  const saveBtnText = document.getElementById('u-save-btn-text');
  if (saveBtnText) saveBtnText.textContent = username ? 'Guardar cambios' : 'Crear usuario';

  // Ocultar contraseña en edición
  const pwBlock = document.getElementById('u-password-block');
  if (pwBlock) pwBlock.style.display = username ? 'none' : 'grid';

  // Cargar recursos de la empresa activa
  if (_userCompanyId) await fetchResources(_userCompanyId);

  if (username) {
    await loadUserIntoWizard(username);
  } else {
    // Nueva empresa: agregar empresa activa por defecto
    _wCompanies = [{
      company_id:   _userCompanyId,
      company_name: _getCompanyName(_userCompanyId),
      roles:        [],
      is_primary:   true,
    }];
    renderWizardEmpresas();
  }

  renderWizardResources();
  uShowView('u-view-wizard');
  uGoStep(0);
}

function closeUserWizard() {
  uShowView('u-view-list');
  _editingUsername = null;
}

function uShowView(viewId) {
  document.querySelectorAll('.users-root .view').forEach(v => v.classList.remove('active'));
  const view = document.getElementById(viewId);
  if (view) view.classList.add('active');
}

// ── Cargar usuario en wizard ──────────────────

async function loadUserIntoWizard(username) {
  const res = await apiCall(`/api/users/${username}`);
  if (!res.ok) { showToast('Error cargando usuario', 'error'); return; }

  const user = res.data.user;
  const set  = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
  const setChk = (id, val) => { const el = document.getElementById(id); if (el) el.checked = !!val; };

  set('u-first_name', user.first_name);
  set('u-last_name',  user.last_name);
  set('u-username',   user.username);
  set('u-email',      user.email);
  set('u-phone',      user.phone);
  set('u-rut',        user.rut);
  setChk('u-active',  user.status === 'A');

  // Deshabilitar username en edición
  const usernameEl = document.getElementById('u-username');
  if (usernameEl) { usernameEl.disabled = true; usernameEl.style.background = '#f9fafb'; }

  // Empresas del usuario
  const resCompanies = await apiCall(`/api/users/id/${user._id}/companies`);
  if (resCompanies.ok) {
    _wCompanies = (resCompanies.data.companies || []).map(c => ({
      company_id:   c.company.company_id,
      company_name: c.company.name || c.company.company_id,
      roles:        c.user_relation?.roles || [],
      is_primary:   c.user_relation?.is_primary || false,
    }));
  }
  renderWizardEmpresas();

  // Recurso vinculado
  const resResource = await apiCall(`/api/companies/${_userCompanyId}/users/${user._id}/resource`);
  if (resResource.ok && resResource.data.resource) {
    _wSelectedResource = resResource.data.resource._id;
  }
}

function clearUserWizardForm() {
  ['u-first_name','u-last_name','u-username','u-email','u-phone','u-rut','u-password','u-password2']
    .forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.value = ''; el.disabled = false; el.style.background = ''; }
    });
  const active = document.getElementById('u-active');
  if (active) active.checked = true;

  const errEl = document.getElementById('u-wizard-error');
  if (errEl) errEl.style.display = 'none';

  _wCompanies = [];
  _wSelectedResource = null;
}

// ── Navegación ────────────────────────────────

function uGoStep(step) {
  document.querySelectorAll('.u-step').forEach((el, i) => {
    el.classList.remove('active', 'done');
    if (i < step)   el.classList.add('done');
    if (i === step) el.classList.add('active');
  });
  document.querySelectorAll('.u-wizard-panel').forEach((el, i) => {
    el.classList.toggle('active', i === step);
  });
  if (step === 3) buildUserReview();
}

function uNext(currentStep) {
  if (!uValidateStep(currentStep)) return;
  uGoStep(currentStep + 1);
}

function uValidateStep(step) {
  const errEl = document.getElementById('u-wizard-error');
  if (errEl) errEl.style.display = 'none';

  if (step === 0) {
    const first  = document.getElementById('u-first_name')?.value?.trim();
    const last   = document.getElementById('u-last_name')?.value?.trim();
    const user   = document.getElementById('u-username')?.value?.trim();
    const email  = document.getElementById('u-email')?.value?.trim();
    const pwd    = document.getElementById('u-password')?.value;
    const pwd2   = document.getElementById('u-password2')?.value;

    if (!first)               return uShowError('El nombre es requerido');
    if (!last)                return uShowError('El apellido es requerido');
    if (!_editingUsername && !user)  return uShowError('El username es requerido');
    if (!email || !email.includes('@')) return uShowError('El email es requerido y debe ser válido');
    if (!_editingUsername) {
      if (!pwd || pwd.length < 8)   return uShowError('La contraseña debe tener al menos 8 caracteres');
      if (pwd !== pwd2)              return uShowError('Las contraseñas no coinciden');
    }
  }
  if (step === 1) {
    if (_wCompanies.length === 0) return uShowError('Debes asignar al menos una empresa');
    const sinRoles = _wCompanies.find(c => c.roles.length === 0);
    if (sinRoles) return uShowError(`Asigna al menos un rol en "${sinRoles.company_name}"`);
  }
  return true;
}

function uShowError(msg) {
  const errEl  = document.getElementById('u-wizard-error');
  const msgEl  = document.getElementById('u-wizard-error-msg');
  if (errEl)  errEl.style.display  = 'flex';
  if (msgEl)  msgEl.textContent    = msg;
  return false;
}

// ── Paso 2: Empresas ─────────────────────────

function renderWizardEmpresas() {
  const container = document.getElementById('u-empresas-list');
  if (!container) return;
  container.innerHTML = '';

  _wCompanies.forEach((wc, idx) => {
    const card = document.createElement('div');
    card.className = 'u-empresa-card';

    const rolesHtml = AVAILABLE_ROLES.map(r => `
      <div class="u-role-chip ${wc.roles.includes(r.id) ? 'selected' : ''}"
           onclick="uToggleRole(${idx}, '${r.id}', this)">
        <i class="fas ${r.icon}"></i> ${r.label}
      </div>
    `).join('');

    card.innerHTML = `
      <div class="u-empresa-card-header">
        <div style="display:flex;align-items:center;gap:8px">
          <span class="u-empresa-card-title">${escapeHtml(wc.company_name)}</span>
          ${wc.is_primary ? '<span class="u-primary-badge">Principal</span>' : ''}
        </div>
        ${_wCompanies.length > 1
          ? `<button class="u-empresa-card-remove" onclick="uRemoveEmpresa(${idx})"><i class="fas fa-times"></i></button>`
          : ''}
      </div>
      <div class="u-form-group" style="margin-bottom:10px">
        <label>Empresa</label>
        <select onchange="uUpdateEmpresa(${idx}, 'company_id', this.value)">
          ${_availableCompanies.map(c => `
            <option value="${c.company_id}" ${c.company_id === wc.company_id ? 'selected' : ''}>
              ${escapeHtml(c.name || c.company_id)}
            </option>
          `).join('')}
        </select>
      </div>
      <div class="u-form-group">
        <label>Roles</label>
        <div class="u-roles-grid">${rolesHtml}</div>
      </div>
      <div style="margin-top:10px">
        <label class="u-check-label">
          <input type="checkbox" ${wc.is_primary ? 'checked' : ''}
            onchange="uUpdateEmpresa(${idx}, 'is_primary', this.checked)"/>
          Empresa principal
        </label>
      </div>
    `;
    container.appendChild(card);
  });
}

function uAddEmpresa() {
  const unusedCompany = _availableCompanies.find(
    c => !_wCompanies.find(wc => wc.company_id === c.company_id)
  );
  if (!unusedCompany) { showToast('No hay más empresas disponibles', 'warning'); return; }

  _wCompanies.push({
    company_id:   unusedCompany.company_id,
    company_name: unusedCompany.name || unusedCompany.company_id,
    roles:        [],
    is_primary:   false,
  });
  renderWizardEmpresas();
}

function uRemoveEmpresa(idx) {
  _wCompanies.splice(idx, 1);
  renderWizardEmpresas();
}

function uToggleRole(idx, roleId, el) {
  const roles = _wCompanies[idx].roles;
  const i = roles.indexOf(roleId);
  if (i >= 0) roles.splice(i, 1);
  else roles.push(roleId);
  el.classList.toggle('selected', roles.includes(roleId));
}

function uUpdateEmpresa(idx, field, value) {
  _wCompanies[idx][field] = value;
  if (field === 'company_id') {
    const company = _availableCompanies.find(c => c.company_id === value);
    _wCompanies[idx].company_name = company?.name || value;
  }
  renderWizardEmpresas();
}

// ── Paso 3: Recursos ──────────────────────────

function renderWizardResources() {
  const list  = document.getElementById('u-resource-list');
  const empty = document.getElementById('u-resource-empty');
  if (!list) return;

  // Limpiar lista (mantener el empty)
  Array.from(list.children).forEach(c => {
    if (c.id !== 'u-resource-empty') c.remove();
  });

  // Mostrar "sin recurso" como seleccionado por defecto
  const noneOpt = document.getElementById('u-opt-none');
  if (noneOpt) noneOpt.classList.toggle('selected', !_wSelectedResource);
  const noneCheck = document.getElementById('u-check-none');
  if (noneCheck) noneCheck.style.color = !_wSelectedResource ? '#fff' : 'transparent';

  const freeResources = _availableResources.filter(r => !r.user_id || r._id === _wSelectedResource);

  if (freeResources.length === 0) {
    if (empty) empty.style.display = 'flex';
    return;
  }
  if (empty) empty.style.display = 'none';

  freeResources.forEach(resource => {
    const item = document.createElement('div');
    item.className = `u-resource-item${resource._id === _wSelectedResource ? ' selected' : ''}`;
    item.dataset.id = resource._id;
    item.onclick = () => uSelectResource(resource._id);

    const color = resource.color || '#9961FF';
    const isSelected = resource._id === _wSelectedResource;

    item.innerHTML = `
      <div class="u-resource-dot" style="background:${color}"></div>
      <div style="flex:1">
        <div class="u-resource-name">${escapeHtml(resource.name || resource.resource_id)}</div>
        <div class="u-resource-meta">${escapeHtml(resource.resource_type || '')}${resource.specialty ? ' · ' + resource.specialty : ''}</div>
      </div>
      <div class="u-resource-check" style="color:${isSelected ? '#fff' : 'transparent'}">
        <i class="fas fa-check" style="font-size:9px"></i>
      </div>
    `;
    list.appendChild(item);
  });
}

function uSelectResource(resourceId) {
  _wSelectedResource = resourceId;

  // Actualizar UI
  document.querySelectorAll('.u-resource-item, .u-no-resource-opt').forEach(el => {
    const isSelected = resourceId
      ? el.dataset.id === resourceId
      : el.id === 'u-opt-none';
    el.classList.toggle('selected', isSelected);
    const check = el.querySelector('.u-resource-check');
    if (check) check.style.color = isSelected ? '#fff' : 'transparent';
  });
}

function uFilterResources(q) {
  document.querySelectorAll('.u-resource-item').forEach(item => {
    const name = item.querySelector('.u-resource-name')?.textContent?.toLowerCase() || '';
    item.style.display = name.includes(q.toLowerCase()) ? '' : 'none';
  });
}

// ── Paso 4: Revisión ──────────────────────────

function buildUserReview() {
  const container = document.getElementById('u-review-content');
  if (!container) return;

  const get    = id => document.getElementById(id)?.value || '';
  const getChk = id => document.getElementById(id)?.checked;

  const resource = _wSelectedResource
    ? _availableResources.find(r => r._id === _wSelectedResource)
    : null;

  container.innerHTML = `
    <div class="u-review-section">
      <div class="u-review-section-title"><i class="fas fa-user"></i> Datos personales</div>
      <div class="u-review-grid">
        <div class="u-review-row">
          <span class="u-review-label">Nombre completo</span>
          <span class="u-review-val">${escapeHtml(get('u-first_name') + ' ' + get('u-last_name')) || '—'}</span>
        </div>
        <div class="u-review-row">
          <span class="u-review-label">Username</span>
          <span class="u-review-val">${escapeHtml(get('u-username')) || '—'}</span>
        </div>
        <div class="u-review-row">
          <span class="u-review-label">Email</span>
          <span class="u-review-val">${escapeHtml(get('u-email')) || '—'}</span>
        </div>
        <div class="u-review-row">
          <span class="u-review-label">Teléfono</span>
          <span class="u-review-val ${!get('u-phone') ? 'empty' : ''}">${escapeHtml(get('u-phone')) || 'Sin teléfono'}</span>
        </div>
        <div class="u-review-row">
          <span class="u-review-label">Estado</span>
          <span class="u-review-val">${getChk('u-active') ? '✅ Activo' : '⏸ Inactivo'}</span>
        </div>
      </div>
    </div>

    <div class="u-review-section">
      <div class="u-review-section-title"><i class="fas fa-building"></i> Empresas y Roles</div>
      ${_wCompanies.map(wc => `
        <div style="margin-bottom:8px;padding:8px;background:#f9fafb;border-radius:7px">
          <div style="font-size:12px;font-weight:600;color:#3b4a6b">${escapeHtml(wc.company_name)}</div>
          <div style="font-size:11px;color:#7D84C1;margin-top:2px">
            Roles: ${wc.roles.join(', ') || '—'}
            ${wc.is_primary ? ' · <span style="color:#d97706">Principal</span>' : ''}
          </div>
        </div>
      `).join('')}
    </div>

    <div class="u-review-section">
      <div class="u-review-section-title"><i class="fas fa-link"></i> Recurso vinculado</div>
      ${resource
        ? `<div class="u-review-val">${escapeHtml(resource.name || resource.resource_id)}</div>`
        : `<div class="u-review-val empty">Sin recurso vinculado</div>`
      }
    </div>
  `;
}

// ── Guardar ───────────────────────────────────

async function saveUser() {
  const saveBtn = document.getElementById('u-save-btn');
  if (saveBtn) saveBtn.disabled = true;

  const errEl = document.getElementById('u-wizard-error');
  if (errEl) errEl.style.display = 'none';

  try {
    const get    = id => document.getElementById(id)?.value?.trim() || null;
    const getChk = id => document.getElementById(id)?.checked ?? true;

    const userData = {
      first_name: get('u-first_name'),
      last_name:  get('u-last_name'),
      email:      get('u-email'),
      phone:      get('u-phone'),
      rut:        get('u-rut'),
      status:     getChk('u-active') ? 'A' : 'I',
    };

    let userId = null;

    if (_editingUsername) {
      // ── EDITAR ──
      const res = await apiCall(`/api/users/${_editingUsername}`, {
        method: 'PUT',
        body:   JSON.stringify(userData),
      });
      if (!res.ok) { uShowError(res.data?.error || 'Error actualizando usuario'); return; }

      // Obtener user_id para actualizar relaciones
      const resUser = await apiCall(`/api/users/${_editingUsername}`);
      if (resUser.ok) userId = resUser.data.user?._id;

    } else {
      // ── CREAR ──
      userData.username = get('u-username');
      userData.password = document.getElementById('u-password')?.value;

      const res = await apiCall('/api/users', {
        method: 'POST',
        body:   JSON.stringify(userData),
      });
      if (!res.ok) { uShowError(res.data?.error || 'Error creando usuario'); return; }
      userId = res.data.username; // backend retorna username o _id
    }

    // ── Vincular empresas y roles ──
    for (const wc of _wCompanies) {
      await apiCall(`/api/companies/${wc.company_id}/users/${userId}`, {
        method: 'POST',
        body:   JSON.stringify({ roles: wc.roles, is_primary: wc.is_primary }),
      });
    }

    // ── Vincular recurso ──
    if (_wSelectedResource && userId) {
      await apiCall(`/api/companies/${_userCompanyId}/users/${userId}/resource`, {
        method: 'PUT',
        body:   JSON.stringify({ resource_id: _wSelectedResource }),
      });
    }

    showToast(_editingUsername ? 'Usuario actualizado ✅' : 'Usuario creado ✅', 'success');
    closeUserWizard();
    await fetchUsers();

  } catch (err) {
    uShowError('Error inesperado: ' + err.message);
  } finally {
    if (saveBtn) saveBtn.disabled = false;
  }
}

// ============================================
// HELPERS
// ============================================

function _fullName(user) {
  if (!user) return '';
  return [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username || '';
}

function _getInitials(first, last) {
  const f = (first || '')[0] || '';
  const l = (last  || '')[0] || '';
  return (f + l).toUpperCase() || '?';
}

function _getCompanyName(companyId) {
  const c = _availableCompanies.find(c => c.company_id === companyId);
  return c?.name || companyId || '—';
}

const _avatarPalette = [
  { bg: '#E1DEFF', text: '#7c3aed' },
  { bg: '#dbeafe', text: '#1d4ed8' },
  { bg: '#dcfce7', text: '#15803d' },
  { bg: '#fef3c7', text: '#d97706' },
  { bg: '#fee2e2', text: '#dc2626' },
  { bg: '#e0f2fe', text: '#0369a1' },
];

function _getAvatarColor(seed) {
  let hash = 0;
  for (let i = 0; i < (seed || '').length; i++) hash += seed.charCodeAt(i);
  return _avatarPalette[hash % _avatarPalette.length];
}

// ============================================
// EXPONER GLOBALMENTE
// ============================================

window.initUsersPage       = initUsersPage;
window.openUserWizard      = openUserWizard;
window.closeUserWizard     = closeUserWizard;
window.uGoStep             = uGoStep;
window.uNext               = uNext;
window.uAddEmpresa         = uAddEmpresa;
window.uRemoveEmpresa      = uRemoveEmpresa;
window.uToggleRole         = uToggleRole;
window.uUpdateEmpresa      = uUpdateEmpresa;
window.uSelectResource     = uSelectResource;
window.uFilterResources    = uFilterResources;
window.saveUser            = saveUser;
window.filterUsers         = filterUsers;
window.clearUserFilters    = clearUserFilters;
window.toggleUserStatus    = toggleUserStatus;
window.confirmDeleteUser   = confirmDeleteUser;
window.deactivateUser      = deactivateUser;