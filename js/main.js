// Heavensy Admin - Main JavaScript

let socket = null;
let messagesData = [];

// Initialize Socket.IO connection
function initSocket() {
    if (!isAuthenticated()) return;
    
    socket = io(CONFIG.SOCKET_URL, {
        auth: {
            token: localStorage.getItem(CONFIG.STORAGE_KEYS.AUTH_TOKEN)
        },
        transports: ['websocket', 'polling']
    });
    
    socket.on('connect', () => {
        console.log('Socket connected:', socket.id);
        updateConnectionStatus(true);
    });
    
    socket.on('disconnect', () => {
        console.log('Socket disconnected');
        updateConnectionStatus(false);
    });
    
    socket.on(CONFIG.SOCKET_EVENTS.NEW_MESSAGE, (data) => {
        console.log('New message received:', data);
        handleNewMessage(data);
    });
    
    // También escuchar message_saved (evento del backend)
    socket.on('message_saved', (data) => {
        console.log('Message saved received:', data);
        handleNewMessage(data);
    });
    
    socket.on(CONFIG.SOCKET_EVENTS.USER_BLOCKED, (data) => {
        console.log('User blocked:', data);
        showInfo(`Usuario ${data.user_id} ha sido bloqueado`);
    });
    
    socket.on(CONFIG.SOCKET_EVENTS.USER_UNBLOCKED, (data) => {
        console.log('User unblocked:', data);
        showInfo(`Usuario ${data.user_id} ha sido desbloqueado`);
    });
}

// Update connection status indicator
function updateConnectionStatus(connected) {
    const indicator = document.getElementById('connectionStatus');
    if (indicator) {
        if (connected) {
            indicator.innerHTML = '<span class="status-dot online"></span> Conectado';
            indicator.className = 'badge bg-success';
        } else {
            indicator.innerHTML = '<span class="status-dot offline"></span> Desconectado';
            indicator.className = 'badge bg-danger';
        }
    }
}

// Handle new message from WebSocket
function handleNewMessage(data) {
    // Add message to array
    messagesData.unshift(data);
    
    // Update messages table if it exists
    const messagesTable = document.getElementById('messagesTable');
    if (messagesTable) {
        renderMessagesTable();
    }
    
    // Update dashboard stats if on dashboard page
    if (window.location.pathname.includes('dashboard.html')) {
        loadDashboardStats();
    }
    
    // Show notification
    showNewMessageNotification(data);
}

// Show new message notification
function showNewMessageNotification(data) {
    const message = data.message || data.text || 'Nuevo mensaje';
    const from = data.from_name || data.user_name || 'Usuario';
    showInfo(`Nuevo mensaje de ${from}: ${message.substring(0, 50)}...`);
}

// Render messages table
function renderMessagesTable() {
    const tbody = document.getElementById('messagesTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    messagesData.slice(0, 20).forEach(msg => {
        const row = document.createElement('tr');
        row.className = 'fade-in';
        
        const messageType = msg.message_type || msg.type || 'text';
        const messageTypeIcon = getMessageTypeIcon(messageType);
        const source = msg.source || 'whatsapp';
        const sourceIcon = getSourceIcon(source);
        
        row.innerHTML = `
            <td>
                <small class="text-muted">${formatDate(msg.timestamp || msg.created_at)}</small>
            </td>
            <td>
                <i class="${sourceIcon}"></i>
                <span class="ms-1">${source.toUpperCase()}</span>
            </td>
            <td>
                <strong>${msg.from_name || msg.user_name || 'Usuario'}</strong><br>
                <small class="text-muted">${formatPhone(msg.from || msg.user_id)}</small>
            </td>
            <td>
                <i class="${messageTypeIcon}"></i>
                <span class="ms-1">${messageType}</span>
            </td>
            <td>
                <span class="text-truncate d-inline-block" style="max-width: 300px;">
                    ${msg.message || msg.text || msg.body || 'Sin contenido'}
                </span>
            </td>
            <td>
                ${getBadgeOrigin(msg)}
            </td>
            <td>
                <button class="btn btn-sm btn-outline-primary" onclick="viewMessage('${msg._id || msg.id}')">
                    <i class="bi bi-eye"></i>
                </button>
            </td>
        `;
        
        tbody.appendChild(row);
    });
}

// Get message type icon
function getMessageTypeIcon(type) {
    const icons = {
        'text': 'bi bi-chat-text text-primary',
        'image': 'bi bi-image text-success',
        'audio': 'bi bi-mic text-info',
        'video': 'bi bi-camera-video text-warning',
        'document': 'bi bi-file-earmark text-secondary',
        'location': 'bi bi-geo-alt text-danger'
    };
    return icons[type] || 'bi bi-chat text-muted';
}

// Get source icon
function getSourceIcon(source) {
    const icons = {
        'whatsapp': 'bi bi-whatsapp text-success',
        'facebook': 'bi bi-facebook text-primary',
        'instagram': 'bi bi-instagram text-danger',
        'web': 'bi bi-globe text-info'
    };
    return icons[source.toLowerCase()] || 'bi bi-chat text-muted';
}

// Get origin badge (Usuario, Bot, Sistema)
function getBadgeOrigin(msg) {
    // Verificar múltiples campos que pueden indicar origen
    const senderType = msg.sender_type || msg.from_number || msg.from;
    const isAiResponse = msg.is_ai_response || msg.is_bot_response;
    
    // Si sender_type es 'assistant' o 'system', es del bot
    if (senderType === 'assistant' || senderType === 'system') {
        return '<span class="badge bg-primary"><i class="bi bi-robot"></i> Bot</span>';
    }
    
    // Si from_number es 'assistant', es del bot
    if (msg.from_number === 'assistant') {
        return '<span class="badge bg-primary"><i class="bi bi-robot"></i> Bot</span>';
    }
    
    // Si tiene flag de AI response
    if (isAiResponse === true) {
        return '<span class="badge bg-primary"><i class="bi bi-robot"></i> Bot</span>';
    }
    
    // Por defecto, es del usuario
    return '<span class="badge bg-secondary"><i class="bi bi-person"></i> Usuario</span>';
}

// View message details
function viewMessage(messageId) {
    showInfo('Función de vista de mensaje en desarrollo');
    // TODO: Implement message detail view
}

// Load dashboard statistics
async function loadDashboardStats() {
    try {
        const data = await apiCall(CONFIG.API_ENDPOINTS.DASHBOARD);
        updateDashboardStats(data);
    } catch (error) {
        console.error('Error loading dashboard stats:', error);
    }
}

// Update dashboard statistics
function updateDashboardStats(data) {
    // Extract stats from response
    const stats = data.stats || data;
    
    // Update stat cards
    const elements = {
        'totalMessages': stats.total_messages || 0,
        'totalUsers': stats.unique_users || 0,
        'blockedUsers': stats.blocked_users || 0,
        'responseRate': stats.response_rate || 0
    };
    
    Object.keys(elements).forEach(key => {
        const element = document.getElementById(key);
        if (element) {
            element.textContent = elements[key];
        }
    });
}

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
    // Check authentication for protected pages
    const protectedPages = ['dashboard.html', 'companies.html', 'users.html', 'conversations.html', 'config.html'];
    const currentPage = window.location.pathname.split('/').pop();
    
    if (protectedPages.includes(currentPage)) {
        if (!requireAuth()) return;
    }
    
    // Initialize Socket.IO if authenticated
    if (isAuthenticated()) {
        initSocket();
    }
    
    // Mark active nav link
    const navLinks = document.querySelectorAll('.sidebar .nav-link');
    navLinks.forEach(link => {
        if (link.getAttribute('href') === currentPage) {
            link.classList.add('active');
        }
    });
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (socket) {
        socket.disconnect();
    }
});
