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
        row.innerHTML = `
            <td><code>${user.username}</code></td>
            <td>${user.first_name} ${user.last_name}</td>
            <td><a href="mailto:${user.email}">${user.email}</a></td>
            <td><span class="badge bg-secondary">${user.company_id || 'N/A'}</span></td>
            <td><span class="badge bg-primary">${user.role || 'N/A'}</span></td>
            <td>${user.is_active ? '<span class="badge bg-success">Activo</span>' : '<span class="badge bg-danger">Inactivo</span>'}</td>
            <td>
                <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-warning" onclick="editUser('${user._id || user.id}')">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-outline-danger" onclick="deleteUser('${user._id || user.id}')">
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
        password: document.getElementById('password').value,
        first_name: document.getElementById('first_name').value,
        last_name: document.getElementById('last_name').value,
        company_id: document.getElementById('company_id').value,
        role: document.getElementById('role').value,
        is_active: document.getElementById('is_active').checked
    };
    
    showLoading('Guardando usuario...');
    try {
        await apiCall(CONFIG.API_ENDPOINTS.USERS, {
            method: 'POST',
            body: JSON.stringify(userData)
        });
        hideLoading();
        userModal.hide();
        showSuccess('Usuario creado correctamente');
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

async function editUser(userId) {
    showInfo('Función de edición en desarrollo');
}
