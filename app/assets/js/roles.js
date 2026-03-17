// ============================================
// ROLES PAGE - HEAVENSY ADMIN
// ============================================

let roles = [];

function initRolesPage() {
  loadRoles();
}

async function loadRoles() {
  try {
    const response = await apiCall('/api/system-roles', {
      loaderMessage: 'Cargando roles...'
    });
    console.log('📥 Roles response:', response);
    
    if (response.ok) {
      // Manejar diferentes estructuras
      if (Array.isArray(response.data)) {
        roles = response.data;
      } else if (response.data.roles) {
        roles = response.data.roles;
      } else if (response.data.system_roles) {
        roles = response.data.system_roles;
      } else {
        roles = [];
      }
      
      console.log('✅ Roles cargados:', roles.length, roles);
      renderRoles();
    } else {
      showToast('Error cargando roles', 'error');
    }
  } catch (error) {
    console.error('❌ Error:', error);
    showToast('Error de conexión', 'error');
  }
}

function renderRoles() {
  const container = document.getElementById('rolesContainer');
  
  if (!roles || roles.length === 0) {
    container.innerHTML = '<p class="text-center text-gray-500 py-8">No hay roles configurados en el sistema</p>';
    return;
  }
  
  container.innerHTML = roles.map(role => {
    const roleId = role.role_id || role.id || 'N/A';
    const roleName = role.role_name || role.name || 'Sin nombre';
    const description = role.description || 'Sin descripción';
    const level = role.level || 0;
    const isActive = role.is_active !== false;
    
    return `
      <div class="border border-gray-200 rounded-lg p-6">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h4 class="text-lg font-semibold text-gray-900">${escapeHtml(roleName)}</h4>
            <p class="text-sm text-gray-600">${escapeHtml(description)}</p>
            <div class="mt-2 flex items-center space-x-3">
              <span class="inline-block px-2 py-1 text-xs rounded ${isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                ${isActive ? 'Activo' : 'Inactivo'}
              </span>
              <span class="text-xs text-gray-500">Nivel: ${level}</span>
              <span class="text-xs text-gray-500">ID: ${escapeHtml(roleId)}</span>
            </div>
          </div>
        </div>
        ${renderPermissions(role.permissions)}
      </div>
    `;
  }).join('');
}

function renderPermissions(permissions) {
  if (!permissions || typeof permissions !== 'object') {
    return '<p class="text-gray-500 text-sm">Sin permisos definidos</p>';
  }
  
  return `
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      ${Object.entries(permissions).map(([module, perms]) => {
        const activePerms = Object.entries(perms).filter(([k, v]) => v === true);
        
        if (activePerms.length === 0) return '';
        
        return `
          <div class="border border-gray-200 rounded-lg p-3">
            <p class="font-semibold text-gray-700 mb-2 text-sm">${escapeHtml(module)}</p>
            <div class="space-y-1">
              ${activePerms.map(([perm]) => `
                <div class="flex items-center text-xs text-gray-600">
                  <i class="fas fa-check text-green-600 mr-2"></i>
                  <span>${escapeHtml(perm)}</span>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}
