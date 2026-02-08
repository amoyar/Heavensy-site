// ============================================
// USERS COMPLETE - HEAVENSY ADMIN
// ============================================

let users = [];
let editingUsername = null;
let currentUserCompanies = [];
let AVAILABLE_COMPANIES = [];
let AVAILABLE_ROLES = [];

// Paginación
let currentPage = 1;
let itemsPerPage = 10;
let totalUsers = 0;

// ============================================
// INIT
// ============================================

function initUsersPage() {
  console.log('✅ Página de usuarios iniciada');
  fetchCompaniesForUsers();
  fetchSystemRoles();
  fetchUsers();
  
  const form = document.getElementById('userForm');
  if (form) {
    form.addEventListener('submit', handleSaveUser);
  }
}

// ============================================
// FETCH DATA
// ============================================

async function fetchCompaniesForUsers() {
  const res = await apiCall('/api/companies', {
    loaderMessage: 'Cargando empresas...'
  });

  if (!res || !res.ok) {
    showToast('Error cargando empresas', 'error');
    return;
  }

  AVAILABLE_COMPANIES = res.data.companies || res.data || [];
}

async function fetchSystemRoles() {
  const res = await apiCall('/api/system-roles');

  if (!res || !res.ok) {
    showToast('Error cargando roles', 'error');
    return;
  }

  AVAILABLE_ROLES = res.data || [];
}

async function fetchUsers() {
  const res = await apiCall('/api/users', {
    loaderMessage: 'Cargando usuarios...'
  });

  if (!res || !res.ok) {
    showToast('Error cargando usuarios', 'error');
    return;
  }

  users = res.data.users || res.data || [];
  totalUsers = users.length;
  
  updateStats();
  renderUsers();
  renderPagination();
}

// ============================================
// STATS
// ============================================

function updateStats() {
  const total = users.length;
  const active = users.filter(u => u.status === 'A').length;
  const inactive = total - active;

  const totalEl = document.getElementById('totalUsers');
  const activeEl = document.getElementById('activeUsers');
  const inactiveEl = document.getElementById('inactiveUsers');

  if (totalEl) totalEl.textContent = total;
  if (activeEl) activeEl.textContent = active;
  if (inactiveEl) inactiveEl.textContent = inactive;
}

// ============================================
// TOGGLE STATUS
// ============================================

async function toggleUserStatus(username, currentStatus) {
  const newStatus = currentStatus === 'A' ? 'I' : 'A';
  
  try {
    const res = await apiCall(`/api/users/${username}`, {
      method: 'PUT',
      body: JSON.stringify({ status: newStatus }),
      loaderMessage: 'Actualizando estado...'
    });

    if (res && res.ok) {
      showToast(
        `Usuario ${newStatus === 'A' ? 'activado' : 'desactivado'} correctamente`,
        'success'
      );
      
      const user = users.find(u => u.username === username);
      if (user) {
        user.status = newStatus;
      }
      
      updateStats();
      renderUsers();
    } else {
      showToast(res.data?.msg || 'Error al cambiar estado', 'error');
    }
  } catch (error) {
    console.error('Error:', error);
    showToast('Error de conexión', 'error');
  }
}

// ============================================
// DELETE USER
// ============================================

function confirmDeleteUser(username) {
  const user = users.find(u => u.username === username);
  const userName = user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || username : username;
  
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50';
  modal.innerHTML = `
    <div class="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4">
      <div class="p-6">
        <div class="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full mb-4">
          <i class="fas fa-exclamation-triangle text-red-600 text-2xl"></i>
        </div>
        <h3 class="text-xl font-bold text-gray-900 text-center mb-2">¿Eliminar Usuario?</h3>
        <p class="text-gray-600 text-center mb-2">
          Estás a punto de eliminar al usuario:
        </p>
        <p class="text-lg font-semibold text-gray-900 text-center mb-4">
          ${escapeHtml(userName)}
        </p>
        <div class="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
          <div class="flex">
            <i class="fas fa-exclamation-circle text-yellow-400 mt-0.5 mr-3"></i>
            <div class="text-sm text-yellow-700">
              <p class="font-medium mb-1">¡Advertencia!</p>
              <p>Esta acción eliminará permanentemente al usuario de la base de datos y no se puede deshacer.</p>
            </div>
          </div>
        </div>
      </div>
      <div class="flex gap-3 px-6 py-4 bg-gray-50 rounded-b-xl">
        <button
          onclick="this.closest('.fixed').remove()"
          class="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          Cancelar
        </button>
        <button
          onclick="deleteUser('${username}'); this.closest('.fixed').remove();"
          class="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700"
        >
          Sí, eliminar
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
}

async function deleteUser(username) {
  try {
    const res = await apiCall(`/api/users/${username}`, {
      method: 'DELETE',
      loaderMessage: 'Eliminando usuario...'
    });

    if (res && res.ok) {
      showToast('Usuario eliminado correctamente', 'success');
      
      users = users.filter(u => u.username !== username);
      totalUsers = users.length;
      
      const totalPages = Math.ceil(totalUsers / itemsPerPage);
      if (currentPage > totalPages && currentPage > 1) {
        currentPage--;
      }
      
      updateStats();
      renderUsers();
      renderPagination();
    } else {
      showToast(res.data?.msg || 'Error al eliminar usuario', 'error');
    }
  } catch (error) {
    console.error('Error:', error);
    showToast('Error de conexión', 'error');
  }
}

// ============================================
// RENDER USERS WITH PAGINATION
// ============================================

function renderUsers() {
  const tbody = document.getElementById('usersTable');
  if (!tbody) return;

  tbody.innerHTML = '';

  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedUsers = users.slice(startIndex, endIndex);

  const showingFrom = document.getElementById('showingFrom');
  const showingTo = document.getElementById('showingTo');
  const totalRecords = document.getElementById('totalRecords');

  if (showingFrom) showingFrom.textContent = totalUsers > 0 ? startIndex + 1 : 0;
  if (showingTo) showingTo.textContent = Math.min(endIndex, totalUsers);
  if (totalRecords) totalRecords.textContent = totalUsers;

  if (paginatedUsers.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="px-6 py-12 text-center text-gray-500">
          <i class="fas fa-users text-4xl mb-3"></i>
          <p>No hay usuarios registrados</p>
        </td>
      </tr>
    `;
    return;
  }

  paginatedUsers.forEach(u => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-gray-50';

    const isActive = u.status === 'A';
    
    // Obtener nombres de empresas
    let companiesText = '-';
    if (u.companies && u.companies.length > 0) {
      const companyNames = u.companies.map(uc => {
        const company = AVAILABLE_COMPANIES.find(c => c.company_id === uc.company_id);
        return company ? company.name : uc.company_id;
      });
      companiesText = companyNames.join(', ');
    }

    tr.innerHTML = `
      <td class="px-6 py-4 text-sm font-medium text-gray-900">${escapeHtml(u.username)}</td>
      <td class="px-6 py-4 text-sm text-gray-900">${escapeHtml(u.first_name || '')} ${escapeHtml(u.last_name || '')}</td>
      <td class="px-6 py-4 text-sm text-gray-700">${escapeHtml(u.email || '')}</td>
      <td class="px-6 py-4 text-sm text-gray-700">${escapeHtml(u.phone || '-')}</td>
      <td class="px-6 py-4 text-sm text-gray-700">
        <span title="${escapeHtml(companiesText)}">${escapeHtml(companiesText)}</span>
      </td>
      <td class="px-6 py-4">
        <button
          onclick="toggleUserStatus('${u.username}', '${u.status}')"
          class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
            isActive ? 'bg-green-500' : 'bg-gray-300'
          }"
          title="${isActive ? 'Click para desactivar' : 'Click para activar'}"
        >
          <span class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            isActive ? 'translate-x-6' : 'translate-x-1'
          }"></span>
        </button>
        <span class="ml-2 text-sm font-medium ${
          isActive ? 'text-green-700' : 'text-gray-500'
        }">
          ${isActive ? 'Activo' : 'Inactivo'}
        </span>
      </td>
      <td class="px-6 py-4 text-right">
        <button 
          onclick="openUserModal('${u.username}')"
          class="text-blue-600 hover:text-blue-800 text-sm font-medium mr-3"
          title="Editar usuario"
        >
          <i class="fas fa-edit"></i>
        </button>
        <button 
          onclick="confirmDeleteUser('${u.username}')"
          class="text-red-600 hover:text-red-800 text-sm font-medium"
          title="Eliminar usuario"
        >
          <i class="fas fa-trash"></i>
        </button>
      </td>
    `;

    tbody.appendChild(tr);
  });
}

// ============================================
// PAGINATION
// ============================================

function renderPagination() {
  const container = document.getElementById('paginationControls');
  if (!container) return;

  const totalPages = Math.ceil(totalUsers / itemsPerPage);
  
  let html = '';

  html += `
    <div class="flex items-center gap-2">
      <span class="text-sm text-gray-600">Mostrar:</span>
      <select 
        onchange="changeItemsPerPage(this.value)" 
        class="border rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500"
      >
        <option value="5" ${itemsPerPage === 5 ? 'selected' : ''}>5</option>
        <option value="10" ${itemsPerPage === 10 ? 'selected' : ''}>10</option>
        <option value="20" ${itemsPerPage === 20 ? 'selected' : ''}>20</option>
        <option value="50" ${itemsPerPage === 50 ? 'selected' : ''}>50</option>
      </select>
    </div>
  `;

  if (totalPages <= 1) {
    container.innerHTML = html;
    return;
  }

  html += '<div class="flex gap-2">';

  html += `
    <button 
      onclick="changePage(${currentPage - 1})"
      ${currentPage === 1 ? 'disabled' : ''}
      class="px-3 py-1 rounded border ${
        currentPage === 1
          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
          : 'bg-white text-gray-700 hover:bg-gray-50'
      }"
    >
      <i class="fas fa-chevron-left"></i>
    </button>
  `;

  const maxVisible = 5;
  let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
  let endPage = Math.min(totalPages, startPage + maxVisible - 1);

  if (endPage - startPage < maxVisible - 1) {
    startPage = Math.max(1, endPage - maxVisible + 1);
  }

  if (startPage > 1) {
    html += `
      <button onclick="changePage(1)" class="px-3 py-1 rounded border bg-white text-gray-700 hover:bg-gray-50">1</button>
    `;
    if (startPage > 2) {
      html += `<span class="px-2 text-gray-400">...</span>`;
    }
  }

  for (let i = startPage; i <= endPage; i++) {
    html += `
      <button 
        onclick="changePage(${i})"
        class="px-3 py-1 rounded border ${
          i === currentPage
            ? 'bg-blue-600 text-white'
            : 'bg-white text-gray-700 hover:bg-gray-50'
        }"
      >
        ${i}
      </button>
    `;
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      html += `<span class="px-2 text-gray-400">...</span>`;
    }
    html += `
      <button onclick="changePage(${totalPages})" class="px-3 py-1 rounded border bg-white text-gray-700 hover:bg-gray-50">${totalPages}</button>
    `;
  }

  html += `
    <button 
      onclick="changePage(${currentPage + 1})"
      ${currentPage === totalPages ? 'disabled' : ''}
      class="px-3 py-1 rounded border ${
        currentPage === totalPages
          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
          : 'bg-white text-gray-700 hover:bg-gray-50'
      }"
    >
      <i class="fas fa-chevron-right"></i>
    </button>
  `;

  html += '</div>';

  container.innerHTML = html;
}

function changePage(page) {
  const totalPages = Math.ceil(totalUsers / itemsPerPage);
  
  if (page < 1 || page > totalPages) return;
  
  currentPage = page;
  renderUsers();
  renderPagination();
}

function changeItemsPerPage(value) {
  itemsPerPage = parseInt(value);
  currentPage = 1;
  renderUsers();
  renderPagination();
}

// ============================================
// MODAL
// ============================================

function openUserModal(username = null) {
  editingUsername = username;

  const modal = document.getElementById('userModal');
  const form = document.getElementById('userForm');
  const title = document.getElementById('userModalTitle');
  const passwordBlock = document.getElementById('passwordBlock');
  const usernameInput = document.getElementById('username');

  if (!modal || !form) return;

  modal.classList.remove('hidden');
  form.reset();

  if (username) {
    title.textContent = 'Editar usuario';
    if (passwordBlock) passwordBlock.classList.add('hidden');
    if (usernameInput) usernameInput.disabled = true;

    const user = users.find(u => u.username === username);
    if (user) {
      // Información básica
      document.getElementById('username').value = user.username || '';
      document.getElementById('user_id').value = user.user_id || '';
      document.getElementById('first_name').value = user.first_name || '';
      document.getElementById('last_name').value = user.last_name || '';
      document.getElementById('email').value = user.email || '';
      document.getElementById('phone').value = user.phone || '';
      document.getElementById('rut').value = user.rut || '';
      document.getElementById('user_status').checked = user.status === 'A';
      
      // Fechas (solo lectura)
      if (user.date_created) {
        document.getElementById('date_created').value = formatDate(user.date_created);
      }
      if (user.date_updated) {
        document.getElementById('date_updated').value = formatDate(user.date_updated);
      }

      // Empresas y roles
      currentUserCompanies = user.companies || [];
      renderUserCompanies();
    }
  } else {
    title.textContent = 'Nuevo usuario';
    if (passwordBlock) passwordBlock.classList.remove('hidden');
    if (usernameInput) usernameInput.disabled = false;

    // Limpiar campos de solo lectura
    document.getElementById('date_created').value = '';
    document.getElementById('date_updated').value = '';

    currentUserCompanies = [];
    renderUserCompanies();
  }
}

function closeUserModal() {
  const modal = document.getElementById('userModal');
  if (modal) {
    modal.classList.add('hidden');
  }
  editingUsername = null;
}

// ============================================
// USER COMPANIES
// ============================================

function renderUserCompanies() {
  const container = document.getElementById('userCompanies');
  if (!container) return;

  container.innerHTML = '';

  if (currentUserCompanies.length === 0) {
    container.innerHTML = `
      <p class="text-sm text-gray-500 text-center py-4">
        No hay empresas asignadas. Haz clic en "Agregar empresa" para asignar una.
      </p>
    `;
    return;
  }

  currentUserCompanies.forEach((uc, idx) => {
    const div = document.createElement('div');
    div.className = 'border rounded-lg p-4 bg-gray-50';

    // Obtener el primer rol del array (o vacío si no hay)
    const firstRole = (uc.roles && uc.roles.length > 0) ? uc.roles[0] : '';
    
    // Mostrar marca de empresa principal
    const isPrimaryBadge = uc.is_primary ? 
      '<span class="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">Principal</span>' : '';

    div.innerHTML = `
      <div class="flex items-center gap-2 mb-3">
        <h4 class="text-sm font-semibold text-gray-700 flex-1">Empresa ${idx + 1}</h4>
        ${isPrimaryBadge}
        <button type="button" onclick="removeUserCompany(${idx})" class="text-red-600 hover:text-red-800">
          <i class="fas fa-trash"></i>
        </button>
      </div>
      
      <div class="space-y-3">
        <div>
          <label class="block text-xs text-gray-600 mb-1">Empresa</label>
          <select class="w-full border rounded px-3 py-2 text-sm" onchange="updateUserCompany(${idx}, 'company_id', this.value)">
            <option value="">Seleccionar empresa</option>
            ${AVAILABLE_COMPANIES.map(c => `
              <option value="${c.company_id}" ${c.company_id === uc.company_id ? 'selected' : ''}>
                ${c.name}
              </option>
            `).join('')}
          </select>
        </div>

        <div>
          <label class="block text-xs text-gray-600 mb-1">Rol</label>
          <select class="w-full border rounded px-3 py-2 text-sm" onchange="updateUserCompanyRole(${idx}, this.value)">
            <option value="">Seleccionar rol</option>
            ${AVAILABLE_ROLES.map(r => `
              <option value="${r.role_id}" ${r.role_id === firstRole ? 'selected' : ''}>
                ${r.role_name}
              </option>
            `).join('')}
          </select>
        </div>

        <div>
          <label class="flex items-center gap-2 cursor-pointer">
            <input 
              type="checkbox" 
              ${uc.is_primary ? 'checked' : ''} 
              onchange="updateUserCompanyPrimary(${idx}, this.checked)"
              class="w-4 h-4 text-blue-600"
            />
            <span class="text-sm text-gray-700">Empresa principal</span>
          </label>
        </div>
      </div>
    `;

    container.appendChild(div);
  });
}

function addCompanyToUser() {
  currentUserCompanies.push({ 
    company_id: '', 
    roles: [],
    is_primary: currentUserCompanies.length === 0  // Primera empresa es principal por defecto
  });
  renderUserCompanies();
}

function updateUserCompany(idx, field, value) {
  if (currentUserCompanies[idx]) {
    currentUserCompanies[idx][field] = value;
  }
}

function updateUserCompanyRole(idx, roleId) {
  if (currentUserCompanies[idx]) {
    // Guardar el rol como array (formato del backend)
    currentUserCompanies[idx].roles = roleId ? [roleId] : [];
  }
}

function updateUserCompanyPrimary(idx, isPrimary) {
  // Si se marca como principal, desmarcar las demás
  if (isPrimary) {
    currentUserCompanies.forEach((uc, i) => {
      uc.is_primary = (i === idx);
    });
    renderUserCompanies();
  } else {
    currentUserCompanies[idx].is_primary = false;
  }
}

function removeUserCompany(idx) {
  currentUserCompanies.splice(idx, 1);
  
  // Si no queda ninguna principal, marcar la primera como principal
  if (currentUserCompanies.length > 0) {
    const hasPrimary = currentUserCompanies.some(uc => uc.is_primary);
    if (!hasPrimary) {
      currentUserCompanies[0].is_primary = true;
    }
  }
  
  renderUserCompanies();
}

// ============================================
// SAVE USER
// ============================================

async function handleSaveUser(e) {
  e.preventDefault();

  const userData = {
    username: document.getElementById('username').value,
    user_id: document.getElementById('user_id').value,
    first_name: document.getElementById('first_name').value,
    last_name: document.getElementById('last_name').value,
    email: document.getElementById('email').value,
    phone: document.getElementById('phone').value,
    rut: document.getElementById('rut').value,
    status: document.getElementById('user_status').checked ? 'A' : 'I',
    companies: currentUserCompanies.filter(c => c.company_id && c.roles && c.roles.length > 0)
  };

  if (!editingUsername) {
    userData.password = document.getElementById('password').value;
    if (!userData.password) {
      showToast('La contraseña es requerida', 'warning');
      return;
    }
  }

  try {
    let res;
    if (editingUsername) {
      res = await apiCall(`/api/users/${editingUsername}`, {
        method: 'PUT',
        body: JSON.stringify(userData),
        loaderMessage: 'Actualizando usuario...'
      });
    } else {
      res = await apiCall('/api/users', {
        method: 'POST',
        body: JSON.stringify(userData),
        loaderMessage: 'Creando usuario...'
      });
    }

    if (res && res.ok) {
      showToast(editingUsername ? 'Usuario actualizado' : 'Usuario creado', 'success');
      closeUserModal();
      fetchUsers();
    } else {
      showToast(res.data?.msg || 'Error al guardar usuario', 'error');
    }
  } catch (error) {
    console.error('Error:', error);
    showToast('Error de conexión', 'error');
  }
}