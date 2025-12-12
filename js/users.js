// Heavensy Admin - Users Module (System Users)

let users = [];
let currentUser = null;
let userModal = null;

document.addEventListener('DOMContentLoaded', () => {
    if (!requireAuth()) return;
    userModal = new bootstrap.Modal(document.getElementById('userModal'));
    loadUsers();
    loadCompaniesForSelect();
});

async function loadUsers() {
    showLoading('Cargando usuarios...');
    try {
        const data = await apiCall(CONFIG.API_ENDPOINTS.USERS);
        users = data.users || data || [];
        renderUsersTable();
        hideLoading();
    } catch (error) {
        hideLoading();
        showError('Error al cargar usuarios: ' + error.message);
        renderEmptyUsersTable();
    }
}

function renderUsersTable() {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;
    
    if (users.length === 0) {
        renderEmptyUsersTable();
        return;
    }
    
    tbody.innerHTML = '';
    users.forEach(user => {
        const row = document.createElement('tr');
        row.className = 'fade-in';
        
        // El backend devuelve companies como array, mostrar la primera
        const companyDisplay = user.companies && user.companies.length > 0 
            ? user.companies[0] 
            : (user.company_id || 'Sin empresa');
        
        // El backend devuelve status: "A" (Activo) o "I" (Inactivo)
        const isActive = user.status === 'A' || user.is_active === true;
        
        row.innerHTML = `
            <td><code>${user.username}</code></td>
            <td>${user.first_name || ''} ${user.last_name || ''}</td>
            <td>${user.email ? `<a href="mailto:${user.email}">${user.email}</a>` : 'N/A'}</td>
            <td><span class="badge bg-secondary">${companyDisplay}</span></td>
            <td><span class="badge bg-primary">${user.role || user.roles || 'Usuario'}</span></td>
            <td>${isActive ? '<span class="badge bg-success">Activo</span>' : '<span class="badge bg-danger">Inactivo</span>'}</td>
            <td>
                <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-warning" onclick="editUser('${user.username}')">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-outline-danger" onclick="deleteUser('${user.username}')">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function renderEmptyUsersTable() {
    const tbody = document.getElementById('usersTableBody');
    if (tbody) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-4"><i class="bi bi-people fs-1 d-block mb-2"></i>No hay usuarios registrados</td></tr>';
    }
}

async function loadCompaniesForSelect() {
    try {
        const data = await apiCall(CONFIG.API_ENDPOINTS.COMPANIES);
        const companies = data.companies || data || [];
        const select = document.getElementById('company_id');
        select.innerHTML = '<option value="">Seleccione una empresa...</option>';
        companies.forEach(company => {
            const option = document.createElement('option');
            option.value = company.company_id;
            option.textContent = company.name;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading companies:', error);
    }
}

function showCreateUserModal() {
    currentUser = null;
    document.getElementById('modalTitle').innerHTML = '<i class="bi bi-person-plus"></i> Nuevo Usuario';
    document.getElementById('userForm').reset();
    userModal.show();
}

async function saveUser() {
    const form = document.getElementById('userForm');
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }
    
    const userData = {
        username: document.getElementById('username').value,
        email: document.getElementById('email').value,
        first_name: document.getElementById('firstName').value,
        last_name: document.getElementById('lastName').value,
        password: document.getElementById('password').value
    };
    
    // Si está editando y el password está vacío, no enviarlo
    if (currentUser && !userData.password) {
        delete userData.password;
    }
    
    const isEditing = currentUser !== null;
    const endpoint = isEditing 
        ? CONFIG.API_ENDPOINTS.USER_BY_ID(currentUser.username)
        : CONFIG.API_ENDPOINTS.USERS;
    const method = isEditing ? 'PUT' : 'POST';
    
    showLoading(isEditing ? 'Actualizando usuario...' : 'Creando usuario...');
    try {
        await apiCall(endpoint, {
            method: method,
            body: JSON.stringify(userData)
        });
        hideLoading();
        userModal.hide();
        showSuccess(isEditing ? 'Usuario actualizado correctamente' : 'Usuario creado correctamente');
        loadUsers();
    } catch (error) {
        hideLoading();
        showError('Error al guardar usuario: ' + error.message);
    }
}

async function deleteUser(userId) {
    if (!confirm('¿Está seguro de que desea eliminar este usuario?')) return;
    showLoading('Eliminando usuario...');
    try {
        await apiCall(CONFIG.API_ENDPOINTS.USER_BY_ID(userId), { method: 'DELETE' });
        hideLoading();
        showSuccess('Usuario eliminado correctamente');
        loadUsers();
    } catch (error) {
        hideLoading();
        showError('Error al eliminar usuario: ' + error.message);
    }
}

function showCreateUserModal() {
    // Resetear usuario actual
    currentUser = null;
    
    // Limpiar el formulario
    document.getElementById('modalTitle').textContent = 'Nuevo Usuario';
    document.getElementById('userForm').reset();
    document.getElementById('username').disabled = false;
    document.getElementById('password').placeholder = 'Contraseña';
    document.getElementById('password').required = true;
    
    // Mostrar el modal
    userModal.show();
}

async function editUser(username) {
    showLoading('Cargando usuario...');
    try {
        // Buscar el usuario por username
        const user = users.find(u => u.username === username);
        
        if (!user) {
            hideLoading();
            showError('Usuario no encontrado');
            return;
        }
        
        // Guardar usuario actual para edición
        currentUser = user;
        
        // Rellenar el formulario del modal
        document.getElementById('modalTitle').textContent = 'Editar Usuario';
        document.getElementById('username').value = user.username;
        document.getElementById('username').disabled = true; // No permitir cambiar username
        document.getElementById('email').value = user.email || '';
        document.getElementById('firstName').value = user.first_name || '';
        document.getElementById('lastName').value = user.last_name || '';
        document.getElementById('password').value = '';
        document.getElementById('password').placeholder = 'Dejar vacío para no cambiar';
        document.getElementById('password').required = false;
        
        // Mostrar el modal
        hideLoading();
        userModal.show();
    } catch (error) {
        hideLoading();
        showError('Error al cargar usuario: ' + error.message);
    }
}
