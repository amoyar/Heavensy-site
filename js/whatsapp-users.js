// Heavensy Admin - WhatsApp Users Module

let whatsappUsers = [];

document.addEventListener('DOMContentLoaded', () => {
    if (!requireAuth()) return;
    loadWhatsAppUsers();
});

async function loadWhatsAppUsers() {
    showLoading('Cargando usuarios de WhatsApp...');
    try {
        const data = await apiCall(CONFIG.API_ENDPOINTS.WHATSAPP_USERS);
        whatsappUsers = data.users || data || [];
        renderWhatsAppUsersTable();
        hideLoading();
    } catch (error) {
        hideLoading();
        showError('Error al cargar usuarios: ' + error.message);
        document.getElementById('whatsappUsersTableBody').innerHTML = '<tr><td colspan="7" class="text-center text-muted py-4">Error al cargar datos</td></tr>';
    }
}

function renderWhatsAppUsersTable() {
    const tbody = document.getElementById('whatsappUsersTableBody');
    if (!tbody) return;
    
    if (whatsappUsers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-4"><i class="bi bi-whatsapp fs-1 d-block mb-2"></i>No hay usuarios de WhatsApp</td></tr>';
        return;
    }
    
    tbody.innerHTML = '';
    whatsappUsers.forEach(user => {
        const row = document.createElement('tr');
        row.className = 'fade-in';
        row.innerHTML = `
            <td><strong>${formatPhone(user.phone_number || user.user_id)}</strong></td>
            <td>${user.name || user.username || 'N/A'}</td>
            <td><span class="badge bg-secondary">${user.company_id || 'N/A'}</span></td>
            <td><span class="badge bg-info">${user.message_count || 0}</span></td>
            <td>${user.is_blocked ? '<span class="badge bg-danger">Bloqueado</span>' : '<span class="badge bg-success">Activo</span>'}</td>
            <td><small class="text-muted">${formatDate(user.last_message_at || user.updated_at)}</small></td>
            <td>
                <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-primary" onclick="viewWhatsAppUser('${user.user_id || user.phone_number}')" title="Ver mensajes">
                        <i class="bi bi-chat-dots"></i>
                    </button>
                    ${user.is_blocked ? 
                        `<button class="btn btn-outline-success" onclick="unblockUser('${user.user_id || user.phone_number}')" title="Desbloquear">
                            <i class="bi bi-unlock"></i>
                        </button>` :
                        `<button class="btn btn-outline-danger" onclick="blockUser('${user.user_id || user.phone_number}')" title="Bloquear">
                            <i class="bi bi-lock"></i>
                        </button>`
                    }
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
}

async function blockUser(userId) {
    if (!confirm('¿Está seguro de que desea bloquear este usuario?')) return;
    showLoading('Bloqueando usuario...');
    try {
        await apiCall(CONFIG.API_ENDPOINTS.WHATSAPP_USER_BLOCK(userId), { method: 'POST' });
        hideLoading();
        showSuccess('Usuario bloqueado correctamente');
        loadWhatsAppUsers();
    } catch (error) {
        hideLoading();
        showError('Error al bloquear usuario: ' + error.message);
    }
}

async function unblockUser(userId) {
    showLoading('Desbloqueando usuario...');
    try {
        await apiCall(CONFIG.API_ENDPOINTS.WHATSAPP_USER_UNBLOCK(userId), { method: 'POST' });
        hideLoading();
        showSuccess('Usuario desbloqueado correctamente');
        loadWhatsAppUsers();
    } catch (error) {
        hideLoading();
        showError('Error al desbloquear usuario: ' + error.message);
    }
}

async function viewWhatsAppUser(userId) {
    showLoading('Cargando mensajes...');
    try {
        const data = await apiCall(CONFIG.API_ENDPOINTS.WHATSAPP_USER(userId));
        hideLoading();
        showUserMessages(data);
    } catch (error) {
        hideLoading();
        showError('Error al cargar mensajes: ' + error.message);
    }
}

function showUserMessages(data) {
    const container = document.getElementById('responseContainer');
    const messages = data.messages || [];
    
    let messagesHtml = messages.map(msg => {
        const isBot = msg.is_bot_response || msg.role === 'assistant';
        return `
            <div class="message-bubble ${isBot ? 'bot' : 'user'} mb-2">
                <div class="d-flex justify-content-between align-items-start">
                    <div>
                        <strong>${isBot ? 'Bot' : 'Usuario'}</strong>
                        <p class="mb-0 mt-1">${msg.message || msg.text || msg.body}</p>
                    </div>
                    <small class="text-muted ms-2">${formatDate(msg.timestamp || msg.created_at)}</small>
                </div>
            </div>
        `;
    }).join('');
    
    container.innerHTML = `
        <div class="card shadow-sm mt-4">
            <div class="card-header">
                <h5 class="mb-0"><i class="bi bi-chat-dots"></i> Conversación con ${formatPhone(data.user_id)}</h5>
            </div>
            <div class="card-body">
                <div style="max-height: 500px; overflow-y: auto;">
                    ${messagesHtml || '<p class="text-muted">No hay mensajes</p>'}
                </div>
                <button class="btn btn-secondary mt-3" onclick="document.getElementById('responseContainer').innerHTML = ''">
                    <i class="bi bi-x"></i> Cerrar
                </button>
            </div>
        </div>
    `;
    container.scrollIntoView({ behavior: 'smooth' });
}

async function loadBlockedUsers() {
    showLoading('Cargando usuarios bloqueados...');
    try {
        const data = await apiCall(CONFIG.API_ENDPOINTS.BLOCKED_USERS);
        whatsappUsers = data.users || data || [];
        renderWhatsAppUsersTable();
        hideLoading();
        showInfo(`Se encontraron ${whatsappUsers.length} usuarios bloqueados`);
    } catch (error) {
        hideLoading();
        showError('Error al cargar usuarios bloqueados: ' + error.message);
    }
}
