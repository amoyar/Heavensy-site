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
        // Extraer campos con prioridades correctas
        const phone = user.user_id || user.phone || user.phone_number || 'Sin teléfono';
        const name = user.profile_name || user.name || user.username || 'Sistema';
        const company = user.company_id || user.company_name || 'N/A';
        const messageCount = user.message_count || user.total_messages || 0;
        const isBlocked = user.blocked || user.is_blocked || false;
        const lastUpdated = user.last_updated || user.last_interaction || user.updated_at || user.last_message_at;
        
        const row = document.createElement('tr');
        row.className = 'fade-in';
        row.innerHTML = `
            <td><strong>${formatPhone(phone)}</strong></td>
            <td>${name}</td>
            <td><span class="badge bg-info">${company}</span></td>
            <td><span class="badge bg-primary">${messageCount}</span></td>
            <td>${isBlocked ? '<span class="badge bg-danger">Bloqueado</span>' : '<span class="badge bg-success">Activo</span>'}</td>
            <td><small class="text-muted">${formatDate(lastUpdated)}</small></td>
            <td>
                <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-primary" onclick="viewWhatsAppUser('${phone}')" title="Ver mensajes">
                        <i class="bi bi-chat-dots"></i>
                    </button>
                    ${isBlocked ? 
                        `<button class="btn btn-outline-success" onclick="unblockUser('${phone}')" title="Desbloquear">
                            <i class="bi bi-unlock"></i>
                        </button>` :
                        `<button class="btn btn-outline-danger" onclick="blockUser('${phone}')" title="Bloquear">
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
        // Usar el endpoint /api/whatsapp-users/{phone} que sí existe
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
    const userName = data.profile_name || 'Usuario';
    const phone = data.phone || data.user_id;
    
    let messagesHtml = messages.map(msg => {
        const isBot = msg.role === 'assistant' || msg.sender_type === 'assistant' || msg.from_number === 'assistant' || msg.is_bot_response;
        const timestamp = msg.timestamp || msg.created_at;
        const time = timestamp ? new Date(timestamp).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }) : '';
        
        // CRÍTICO: Leer 'content' primero
        const messageText = msg.content || msg.message || msg.text || msg.body || 'Sin contenido';
        
        return `
            <div class="message-bubble ${isBot ? 'bot' : 'user'} mb-2">
                <div class="d-flex justify-content-between align-items-start">
                    <div>
                        <strong>${isBot ? '🤖 Bot Alicia' : '👤 ' + userName}</strong>
                        <p class="mb-0 mt-1">${messageText}</p>
                    </div>
                    <small class="text-muted ms-2">${time}</small>
                </div>
            </div>
        `;
    }).join('');
    
    container.innerHTML = `
        <div class="card shadow-sm mt-4">
            <div class="card-header bg-heavensy text-white">
                <h5 class="mb-0"><i class="bi bi-chat-dots"></i> Conversación con ${userName}</h5>
                <small>${formatPhone(phone)} - ${messages.length} mensajes</small>
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
