// ============================================
// USERS.JS — Módulo de Usuarios
// Heavensy Admin
// ============================================
// ── BITÁCORA ──
// [v2026.06.16-3] users.js
// 2026-06-16 | Columna "Recurso" de la tabla y filtro "Es recurso": leían
//              user.company_resource_id (campo inexistente) → siempre mostraban "—".
//              Ahora leen user.is_resource (que el backend ya envía en
//              /companies/<id>/users) y muestran "Sí" / "No".
// [v2026.06.16-2] users.js
// 2026-06-16 | El check "es recurso" ahora LEE su estado al editar: loadUserIntoWizard
//              toma is_resource de las empresas del usuario (user_relation.is_resource)
//              y marca el check. Antes solo se marcaba si había un recurso vinculado
//              (resource_id), así que un usuario con is_resource:true pero sin recurso
//              creado salía siempre desmarcado.
// [v2026.06.16-1] users.js
// 2026-06-16 | Paso 3 del wizard rediseñado: de "vincular a recurso existente" a un
//              check único "Este usuario es un recurso reservable" (_wIsResource).
//              Al guardar llama a PUT .../resource-flag {is_resource}, que en backend
//              crea el agenda_resources (si marca) o lo desactiva (si desmarca). En
//              sectores de objeto el check va deshabilitado (recursos objeto se crean
//              en config-rubro). Desmarcar en edición pide confirmación. Eliminado el
//              modelo viejo (_wSelectedResource lista, uSelectResource, uFilterResources).
// [v2026.06.15-3] users.js
// 2026-06-15 | Fix precarga al EDITAR usuario: loadUserIntoWizard llamaba a
//              /api/users/id/<id>/companies (con "/id/" de más) → 404 → _wCompanies
//              quedaba vacío y el paso "Empresa y Rol" no mostraba la empresa ni el
//              rol guardados. Corregido a /api/users/<id>/companies (el real). La
//              forma {company,user_relation} ya calzaba con el .map del front.
// [v2026.06.15-2] users.js
// 2026-06-15 | Fix BUG recurso: fetchResources llamaba a /api/agenda/company/<id>
//              (endpoint inexistente → 404), por lo que el paso 3 "Recurso" del
//              wizard no cargaba nada. Corregido a /api/agenda/resources (el real,
//              toma la empresa del JWT). El guardado de la vinculación
//              (PUT .../users/<uid>/resource) ya existía y funcionaba.
// [v2026.06.15-1] users.js
// 2026-06-15 | Roles del wizard cargados desde BD (GET /api/system-roles) en vez
//              de la lista hardcodeada AVAILABLE_ROLES, que tenía roles inexistentes
//              en inglés (OPERATOR_ROL/VIEWER_ROL) y generaba usuarios con roles
//              inválidos sin permisos efectivos (caso lovichu1). Nuevo
//              loadAvailableRoles() en initUsersPage; mapea role_id→id,
//              role_name→label, ícono por rol con fallback. Excluye el rol
//              superadmin Heavensy del selector. Render y toggle intactos.
// [v2026.06.09-1] users.js
// 2026-06-09 | Aislamiento de empresas: el wizard de usuario nuevo sugiere la
//              empresa según contexto (override / empresa del admin); el superadmin
//              en vista plataforma NO pre-carga ninguna (antes colaba Heavensy como
//              primaria). uAddEmpresa marca como principal la primera empresa.

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
let _wSelectedResource = null; // (legacy) resource_id ya vinculado, para detectar estado al editar
let _wIsResource     = false;  // ¿el usuario es recurso reservable? (modelo nuevo)
let _wEsObjeto       = false;  // ¿el sector de la empresa es de naturaleza objeto? (deshabilita el check)
let _wNaturalezaCargada = false; // ¿ya se evaluó la naturaleza del sector en esta sesión del wizard?

// ── Roles disponibles ─────────────────────────
// Se cargan desde la BD (GET /api/system-roles), NO hardcodeados: la fuente de
// verdad es la colección system_roles. Antes era una lista fija en inglés
// (OPERATOR_ROL / VIEWER_ROL) que no existen en el sistema y producía usuarios
// con roles inválidos sin permisos efectivos.
let AVAILABLE_ROLES = [];

// Ícono por rol (cosmético). Si un rol nuevo no está mapeado, usa un ícono
// genérico — nunca bloquea ni inventa roles.
const _ROLE_ICONS = {
  ADMIN_ROL:       'fa-shield-alt',
  SUPERVISOR_ROL:  'fa-user-tie',
  OPERADOR_ROL:    'fa-headset',
  PROFESIONAL_ROL: 'fa-user-md',
  ASISTENTE_ROL:   'fa-user-clock',
};

async function loadAvailableRoles() {
  try {
    const res = await apiCall('/api/system-roles');
    // El endpoint devuelve el array de roles directo (no envuelto en {data}).
    const roles = Array.isArray(res.data) ? res.data : (res.data?.roles || []);
    AVAILABLE_ROLES = roles
      // No ofrecer el rol superadmin Heavensy en el wizard de usuarios de empresa
      .filter(r => r.role_id && r.role_id !== 'HEAVENSY_SUPERADMIN_ROL')
      .map(r => ({
        id:    r.role_id,
        label: r.role_name || r.role_id,
        icon:  _ROLE_ICONS[r.role_id] || 'fa-user-tag',
      }));
  } catch (e) {
    console.error('No se pudieron cargar los roles del sistema:', e);
    AVAILABLE_ROLES = [];
  }
}

// ============================================
// INICIALIZACIÓN
// ============================================

async function initUsersPage() {
  const claims = getUserFromToken();
  // Si hay override (ej: SA viendo empresa específica), usarlo
  _userCompanyId = window._cpOverrideCompanyId || claims?.company_id || localStorage.getItem('company_id');

  await Promise.all([
    fetchUsers(),
    fetchAvailableCompanies(),
    loadAvailableRoles(),
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
  // El endpoint correcto es /api/agenda/resources (toma la empresa del JWT).
  // Antes se llamaba /api/agenda/company/<id>, que NO existe → 404 y el paso
  // "Recurso" del wizard quedaba sin datos. companyId se mantiene en la firma
  // por compatibilidad con las llamadas, pero la empresa la resuelve el token.
  const res = await apiCall('/api/agenda/resources');
  if (res.ok) {
    _availableResources = (res.data && (res.data.resources || res.data)) || [];
  } else {
    _availableResources = [];
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
    const initials  = _getInitials(user.first_name, user.last_name);
    const color     = _getAvatarColor(user.username || user._id);
    const hasResource = !!user.is_resource;

    const tr = document.createElement('tr');
    if (!isActive) tr.style.opacity = '.6';

    tr.innerHTML = `
      <td>
        <div class="u-user-cell">
          ${user.avatar_url
            ? `<img src="${user.avatar_url}" class="u-avatar" style="object-fit:cover;border-radius:50%">`
            : `<div class="u-avatar" style="background:${color.bg};color:${color.text}">${initials}</div>`
          }
          <div>
            <div class="u-user-name">${escapeHtml(_fullName(user))}</div>
            <div class="u-user-sub">${escapeHtml(user.username || '')}</div>
          </div>
        </div>
      </td>
      <td>${escapeHtml(user.email || '—')}</td>
      <td><span class="u-badge u-badge-role">${escapeHtml(roleLabel)}</span></td>
      <td>${hasResource ? '<span class="u-badge u-badge-resource">Sí</span>' : '<span class="u-badge">No</span>'}</td>
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
      (resource === 'yes' && u.is_resource) ||
      (resource === 'no'  && !u.is_resource);

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
  _wIsResource        = false;
  _wEsObjeto          = false;
  _wNaturalezaCargada = false;

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
    // Nuevo usuario: sugerir empresa según el CONTEXTO actual.
    // - Con contexto (override) o admin de empresa → sugerir esa empresa.
    // - Superadmin en vista plataforma (sin contexto) → NO pre-cargar: que elija
    //   explícitamente, para no asignar Heavensy por defecto.
    const hayContexto = !!window._cpOverrideCompanyId;
    const esSuperadminSinContexto = window.IS_HEAVENSY && !hayContexto;
    if (esSuperadminSinContexto || !_userCompanyId) {
      _wCompanies = [];
    } else {
      _wCompanies = [{
        company_id:   _userCompanyId,
        company_name: _getCompanyName(_userCompanyId),
        roles:        [],
        is_primary:   true,
      }];
    }
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

  // Empresas del usuario. El endpoint es /api/users/<id>/companies (antes se
  // llamaba con /id/ de más → 404 → el paso "Empresa y Rol" quedaba vacío al
  // editar). La forma devuelta es {company:{...}, user_relation:{roles,is_primary}}.
  const resCompanies = await apiCall(`/api/users/${user._id}/companies`);
  if (resCompanies.ok) {
    _wCompanies = (resCompanies.data.companies || []).map(c => ({
      company_id:   c.company.company_id,
      company_name: c.company.name || c.company.company_id,
      roles:        c.user_relation?.roles || [],
      is_primary:   c.user_relation?.is_primary || false,
      is_resource:  c.user_relation?.is_resource || false,
    }));
    // El check "es recurso" se marca si el usuario ya tiene el flag is_resource
    // en alguna de sus empresas (lo guardado en BD). [16-06]
    if (_wCompanies.some(c => c.is_resource)) _wIsResource = true;
  }
  renderWizardEmpresas();

  // Recurso vinculado: si ya tiene, el usuario ES recurso (check marcado)
  const resResource = await apiCall(`/api/companies/${_userCompanyId}/users/${user._id}/resource`);
  if (resResource.ok && resResource.data.resource) {
    _wSelectedResource = resResource.data.resource._id;
    _wIsResource = true;
  }
  // Naturaleza del sector de la empresa (objeto → check deshabilitado)
  await uCargarNaturalezaSector(_userCompanyId);
  _wNaturalezaCargada = true;
}

// Determina si el sector de la empresa es de naturaleza "objeto" (cabañas, etc.),
// en cuyo caso el check de recurso va deshabilitado. Lo infiere del availability_mode:
// por_dia / por_visita = objeto; por_hora / por_hora_sin_almuerzo = persona.
async function uCargarNaturalezaSector(companyId) {
  _wEsObjeto = false;
  try {
    const res = await apiCall(`/api/companies/${companyId}/config`);
    const cfg = (res && res.data) || {};
    const modo = cfg.availability_mode
      || (cfg.business_config && cfg.business_config.availability_mode)
      || '';
    _wEsObjeto = (modo === 'por_dia' || modo === 'por_visita');
  } catch (e) {
    _wEsObjeto = false; // ante la duda, habilitado (persona)
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
  _wIsResource = false;
  _wEsObjeto = false;
  _wNaturalezaCargada = false;
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
  if (step === 2) renderWizardResources();
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
    is_primary:   _wCompanies.length === 0,   // la primera empresa agregada es la principal
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

// ── Paso 3: Recurso (es recurso reservable) ──────

// Refleja en la UI el estado de _wIsResource y _wEsObjeto.
async function renderWizardResources() {
  // Si hay empresa asignada y aún no se evaluó la naturaleza, hacerlo ahora
  // (en creación, la empresa se elige en el paso 2). Usa la primera empresa.
  if (_wCompanies.length && !_wNaturalezaCargada) {
    await uCargarNaturalezaSector(_wCompanies[0].company_id);
    _wNaturalezaCargada = true;
  }

  const toggle = document.getElementById('u-resource-toggle');
  const check  = document.getElementById('u-check-resource');
  const meta   = document.getElementById('u-resource-toggle-meta');
  const note   = document.getElementById('u-resource-objeto-note');
  if (!toggle) return;

  // Sectores de objeto: el check se muestra deshabilitado (los recursos objeto
  // se crean en config-rubro, no desde el usuario).
  if (_wEsObjeto) {
    _wIsResource = false;
    toggle.classList.add('disabled');
    toggle.style.opacity = '0.5';
    toggle.style.pointerEvents = 'none';
    if (note) note.style.display = 'flex';
  } else {
    toggle.classList.remove('disabled');
    toggle.style.opacity = '';
    toggle.style.pointerEvents = '';
    if (note) note.style.display = 'none';
  }

  toggle.classList.toggle('selected', _wIsResource);
  if (check) check.style.color = _wIsResource ? '#fff' : 'transparent';
  if (meta) meta.textContent = _wIsResource
    ? 'Se creará / mantendrá su ficha en la agenda'
    : 'Podrá recibir reservas en la agenda';
}

// Click en el check. Si está en edición y ya era recurso, desmarcar pide confirmación.
function uToggleEsRecurso(ev) {
  if (ev) ev.preventDefault();
  if (_wEsObjeto) return;

  // Va a pasar a DESMARCADO y ya tenía recurso vinculado → confirmar (lo saca de agenda)
  if (_wIsResource && _wSelectedResource) {
    const ok = confirm('Si quitas la marca de recurso, este profesional se desactivará de la agenda y dejará de recibir reservas. ¿Continuar?');
    if (!ok) return;
  }
  _wIsResource = !_wIsResource;
  renderWizardResources();
}

// ── Paso 4: Revisión ──────────────────────────

function buildUserReview() {
  const container = document.getElementById('u-review-content');
  if (!container) return;

  const get    = id => document.getElementById(id)?.value || '';
  const getChk = id => document.getElementById(id)?.checked;

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
      <div class="u-review-section-title"><i class="fas fa-link"></i> Recurso reservable</div>
      ${_wEsObjeto
        ? `<div class="u-review-val empty">No aplica (recurso de objeto, se crea en Mi empresa)</div>`
        : (_wIsResource
            ? `<div class="u-review-val">✅ Sí — se creará/mantendrá su ficha en la agenda</div>`
            : `<div class="u-review-val empty">No — solo acceso al sistema</div>`)
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

    // ── Marcar como recurso (crea/desactiva el recurso de agenda en backend) ──
    // Solo para sectores de persona; en objeto el check va deshabilitado.
    if (userId && !_wEsObjeto) {
      for (const wc of _wCompanies) {
        await apiCall(`/api/companies/${wc.company_id}/users/${userId}/resource-flag`, {
          method: 'PUT',
          body:   JSON.stringify({ is_resource: _wIsResource }),
        });
      }
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
  { bg: 'linear-gradient(135deg,#8e84fa 0%,#91c0ff 100%)', text: '#fff' },
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
window.uToggleEsRecurso    = uToggleEsRecurso;
window.saveUser            = saveUser;
window.filterUsers         = filterUsers;
window.clearUserFilters    = clearUserFilters;
window.toggleUserStatus    = toggleUserStatus;
window.confirmDeleteUser   = confirmDeleteUser;
window.deactivateUser      = deactivateUser;