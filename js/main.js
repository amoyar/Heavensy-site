// Heavensy Admin - Main JavaScript

let socket = null;
let messagesData = [];

// Cargar mensajes desde localStorage al inicio
function loadMessagesFromStorage() {
    try {
        const stored = localStorage.getItem('heavensy_messages');
        if (stored) {
            messagesData = JSON.parse(stored);
            console.log(`📦 ${messagesData.length} mensajes cargados desde localStorage`);
        }
    } catch (error) {
        console.error('Error cargando mensajes:', error);
        messagesData = [];
    }
}

// Guardar mensajes en localStorage
function saveMessagesToStorage() {
    try {
        // Guardar solo los últimos 100 mensajes para no saturar localStorage
        const messagesToSave = messagesData.slice(0, 100);
        localStorage.setItem('heavensy_messages', JSON.stringify(messagesToSave));
    } catch (error) {
        console.error('Error guardando mensajes:', error);
    }
}

// Cargar al inicio
loadMessagesFromStorage();

// Update navbar with user info
function updateNavbar() {
    const userInfo = getUserInfo();
    if (!userInfo) return;
    
    // Actualizar nombre de usuario
    const userNameElement = document.getElementById('userName');
    if (userNameElement) {
        userNameElement.textContent = userInfo.full_name || userInfo.username || 'Usuario';
    }
    
    // Actualizar badge de empresa
    const companyBadge = document.getElementById('companyBadge');
    if (companyBadge && userInfo.company_id) {
        // Formatear el nombre de la empresa
        let companyName = userInfo.company_name || userInfo.company_id;
        
        // Si es LATTICE_001, mostrar solo "Lattice"
        if (companyName === 'LATTICE_001') {
            companyName = 'Lattice';
        } else if (companyName === 'HEAVENSY_001') {
            companyName = 'Heavensy Demo';
        } else {
            // Remover sufijos como _001
            companyName = companyName.replace(/_\d+$/, '');
            // Capitalizar primera letra
            companyName = companyName.charAt(0).toUpperCase() + companyName.slice(1).toLowerCase();
        }
        
        companyBadge.textContent = companyName;
        companyBadge.style.display = 'inline-block';
    }
}

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
    
    // Guardar en localStorage
    saveMessagesToStorage();
    
    // Update messages table if it exists
    const messagesTable = document.getElementById('messagesTable');
    if (messagesTable) {
        renderMessagesTable();
    }
    
    // Update dashboard stats if on dashboard page
    if (window.location.pathname.includes('dashboard.html')) {
        // Incrementar contador de mensajes localmente
        const totalMessagesElement = document.getElementById('totalMessages');
        if (totalMessagesElement) {
            const currentTotal = parseInt(totalMessagesElement.textContent) || 0;
            totalMessagesElement.textContent = currentTotal + 1;
        }
        
        // También recargar stats completos del backend (menos frecuente)
        // Solo cada 5 mensajes para no saturar
        if (messagesData.length % 5 === 0) {
            loadDashboardStats();
        }
    }
    
    // Show notification
    showNewMessageNotification(data);
}

// Show new message notification
function showNewMessageNotification(data) {
    const message = data.message || data.text || 'Nuevo mensaje';
    const from = getMessageUserName(data);
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
                <strong>${getMessageUserName(msg)}</strong><br>
                <small class="text-muted">${formatPhone(msg.from || msg.user_id || msg.from_number)}</small>
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
                <button class="btn btn-sm btn-outline-primary" onclick="viewMessage('${msg.message_id || msg._id || msg.id}')">
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

// ✅ NUEVA FUNCIÓN: Obtener nombre correcto según si es bot o usuario
function getMessageUserName(msg) {
    // Verificar si es mensaje del bot
    const senderType = msg.sender_type || msg.from_number || msg.from;
    const isAiResponse = msg.is_ai_response || msg.is_bot_response;
    const isBot = senderType === 'assistant' || 
                  senderType === 'system' || 
                  msg.from_number === 'assistant' ||
                  msg.role === 'assistant' ||
                  isAiResponse === true;
    
    // Si es bot, retornar "Alicia" o "Asistente IA"
    if (isBot) {
        return 'Alicia';
    }
    
    // Si es usuario, retornar su nombre real
    return msg.profile_name || msg.from_name || msg.user_name || 'Usuario';
}


// View message details
function viewMessage(messageId) {
    // Buscar el mensaje en el array
    const message = messagesData.find(m => (m.message_id === messageId) || (m._id === messageId) || (m.id === messageId));
    
    if (!message) {
        showError('Mensaje no encontrado');
        return;
    }
    
    // Crear contenido del modal
    const messageType = message.message_type || message.type || 'text';
    const senderType = message.sender_type || message.from_number || 'unknown';
    const isBot = senderType === 'assistant' || senderType === 'system' || message.is_ai_response;
    
    const modalContent = `
        <div class="modal fade" id="messageDetailModal" tabindex="-1">
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header bg-heavensy text-white">
                        <h5 class="modal-title">
                            <i class="bi bi-envelope-open"></i> Detalle del Mensaje
                        </h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="row mb-3">
                            <div class="col-md-6">
                                <strong><i class="bi bi-person"></i> Usuario:</strong><br>
                                <span class="text-muted">${getMessageUserName(message)}</span>
                            </div>
                            <div class="col-md-6">
                                <strong><i class="bi bi-telephone"></i> Teléfono:</strong><br>
                                <span class="text-muted">${formatPhone(message.user_id || message.from || message.from_number || 'N/A')}</span>
                            </div>
                        </div>
                        
                        <div class="row mb-3">
                            <div class="col-md-6">
                                <strong><i class="bi bi-clock"></i> Fecha/Hora:</strong><br>
                                <span class="text-muted">${formatDate(message.timestamp || message.created_at)}</span>
                            </div>
                            <div class="col-md-6">
                                <strong><i class="bi bi-tag"></i> Tipo:</strong><br>
                                ${getMessageTypeIcon(messageType)} <span class="text-muted">${messageType}</span>
                            </div>
                        </div>
                        
                        <div class="row mb-3">
                            <div class="col-md-6">
                                <strong><i class="bi bi-arrow-left-right"></i> Origen:</strong><br>
                                ${getBadgeOrigin(message)}
                            </div>
                            <div class="col-md-6">
                                <strong><i class="bi bi-hash"></i> Message ID:</strong><br>
                                <small class="text-muted" style="word-break: break-all;">${message.message_id || message._id || message.id || 'N/A'}</small>
                            </div>
                        </div>
                        
                        <hr>
                        
                        <div class="mb-3">
                            <strong><i class="bi bi-chat-text"></i> Contenido del Mensaje:</strong>
                            <div class="card mt-2">
                                <div class="card-body ${isBot ? 'bg-light' : ''}">
                                    <p class="mb-0" style="white-space: pre-wrap;">${message.text || message.message || message.body || 'Sin contenido'}</p>
                                </div>
                            </div>
                        </div>
                        
                        ${message.media_url ? `
                        <div class="mb-3">
                            <strong><i class="bi bi-paperclip"></i> Archivo Adjunto:</strong><br>
                            <a href="${message.media_url}" target="_blank" class="btn btn-sm btn-outline-primary mt-2">
                                <i class="bi bi-download"></i> Ver/Descargar
                            </a>
                        </div>
                        ` : ''}
                        
                        ${message.company_id ? `
                        <div class="mb-3">
                            <strong><i class="bi bi-building"></i> Empresa:</strong><br>
                            <span class="badge bg-info">${message.company_id}</span>
                        </div>
                        ` : ''}
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                            <i class="bi bi-x-circle"></i> Cerrar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Eliminar modal anterior si existe
    const existingModal = document.getElementById('messageDetailModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Agregar modal al body
    document.body.insertAdjacentHTML('beforeend', modalContent);
    
    // Mostrar modal
    const modal = new bootstrap.Modal(document.getElementById('messageDetailModal'));
    modal.show();
    
    // Limpiar modal cuando se cierre
    document.getElementById('messageDetailModal').addEventListener('hidden.bs.modal', function () {
        this.remove();
    });
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

// Load initial messages from database
async function loadInitialMessages() {
    try {
        // Solo cargar si estamos en el dashboard y no hay mensajes en memoria
        if (!window.location.pathname.includes('dashboard.html')) return;
        
        console.log('📥 Cargando mensajes iniciales desde BD...');
        
        const response = await fetch(`${CONFIG.BACKEND_URL}/api/conversations`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        
        // Si no hay mensajes en localStorage, cargar desde la BD
        if (messagesData.length === 0 && data.conversations && data.conversations.length > 0) {
            // Cargar los últimos 20 mensajes de cada conversación
            const allMessages = [];
            
            // Tomar las primeras 5 conversaciones
            const topConversations = data.conversations.slice(0, 5);
            
            for (const conv of topConversations) {
                try {
                    const msgResponse = await fetch(`${CONFIG.BACKEND_URL}/api/conversations/${conv.user_id}`);
                    if (msgResponse.ok) {
                        const msgData = await msgResponse.json();
                        if (msgData.messages && msgData.messages.length > 0) {
                            // Tomar los últimos 5 mensajes de cada conversación
                            allMessages.push(...msgData.messages.slice(-5));
                        }
                    }
                } catch (err) {
                    console.error(`Error cargando mensajes de ${conv.user_id}:`, err);
                }
            }
            
            // Ordenar por timestamp descendente
            allMessages.sort((a, b) => {
                const timeA = new Date(a.timestamp || a.created_at || 0);
                const timeB = new Date(b.timestamp || b.created_at || 0);
                return timeB - timeA;
            });
            
            // Tomar solo los últimos 20
            messagesData = allMessages.slice(0, 20);
            
            // Guardar en localStorage
            saveMessagesToStorage();
            
            // Renderizar tabla
            const messagesTable = document.getElementById('messagesTable');
            if (messagesTable) {
                renderMessagesTable();
                console.log(`✅ ${messagesData.length} mensajes cargados desde BD`);
            }
        } else {
            console.log(`📦 Usando ${messagesData.length} mensajes desde localStorage`);
        }
        
    } catch (error) {
        console.error('❌ Error cargando mensajes iniciales:', error);
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
    
    // Update navbar with user info
    updateNavbar();
    
    // Initialize Socket.IO if authenticated
    if (isAuthenticated()) {
        initSocket();
    }
    
    // Si estamos en el dashboard, cargar mensajes iniciales
    if (currentPage === 'dashboard.html') {
        const messagesTable = document.getElementById('messagesTable');
        if (messagesTable) {
            if (messagesData.length > 0) {
                console.log(`📊 Renderizando ${messagesData.length} mensajes guardados`);
                renderMessagesTable();
            } else {
                // Cargar mensajes desde la BD si no hay en localStorage
                loadInitialMessages();
            }
        }
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

// ============================================
// FUNCIONES DE FILTRADO Y LIMPIEZA
// ============================================

// Variable global para guardar todos los mensajes sin filtrar
let allMessagesData = [];

// Aplicar filtros a la tabla de mensajes
function applyFilters() {
    const filterUser = document.getElementById('filterUser')?.value.toLowerCase() || '';
    const filterOrigin = document.getElementById('filterOrigin')?.value || '';
    const filterType = document.getElementById('filterType')?.value || '';
    
    // Usar messagesData que ya existe
    const filteredMessages = messagesData.filter(msg => {
        // Filtro por usuario
        const userName = (getMessageUserName(msg) || '').toLowerCase();
        const userPhone = (msg.user_id || msg.from || msg.from_number || '').toLowerCase();
        const userMatch = !filterUser || userName.includes(filterUser) || userPhone.includes(filterUser);
        
        // Filtro por origen (bot/usuario)
        let originMatch = true;
        if (filterOrigin) {
            const senderType = msg.sender_type || msg.from_number;
            const isBot = senderType === 'assistant' || senderType === 'system' || msg.is_ai_response;
            originMatch = (filterOrigin === 'bot' && isBot) || (filterOrigin === 'user' && !isBot);
        }
        
        // Filtro por tipo
        const messageType = msg.message_type || msg.type || 'text';
        const typeMatch = !filterType || messageType === filterType;
        
        return userMatch && originMatch && typeMatch;
    });
    
    // Renderizar mensajes filtrados
    renderFilteredMessages(filteredMessages);
    
    // Mostrar contador de resultados
    const totalCount = messagesData.length;
    const filteredCount = filteredMessages.length;
    console.log(`🔍 Filtrado: ${filteredCount} de ${totalCount} mensajes`);
}

// Renderizar mensajes filtrados
function renderFilteredMessages(messages) {
    const tbody = document.getElementById('messagesTableBody');
    if (!tbody) return;
    
    if (messages.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center text-muted py-4">
                    <i class="bi bi-search fs-1 d-block mb-2"></i>
                    No se encontraron mensajes con los filtros aplicados
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = '';
    
    messages.slice(0, 20).forEach(msg => {
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
                <strong>${getMessageUserName(msg)}</strong><br>
                <small class="text-muted">${formatPhone(msg.from || msg.user_id || msg.from_number)}</small>
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
                <button class="btn btn-sm btn-outline-primary" onclick="viewMessage('${msg.message_id || msg._id || msg.id}')">
                    <i class="bi bi-eye"></i>
                </button>
            </td>
        `;
        
        tbody.appendChild(row);
    });
}

// Limpiar filtros
function resetFilters() {
    const filterUser = document.getElementById('filterUser');
    const filterOrigin = document.getElementById('filterOrigin');
    const filterType = document.getElementById('filterType');
    
    if (filterUser) filterUser.value = '';
    if (filterOrigin) filterOrigin.value = '';
    if (filterType) filterType.value = '';
    
    // Renderizar todos los mensajes
    renderMessagesTable();
}

// Limpiar dashboard (eliminar localStorage)
function clearDashboardMessages() {
    if (confirm('⚠️ ¿Estás seguro de que quieres limpiar todos los mensajes del dashboard?\n\nEsto NO eliminará los mensajes de la base de datos, solo del dashboard local.')) {
        // Limpiar localStorage
        localStorage.removeItem('heavensy_messages');
        
        // Limpiar array
        messagesData = [];
        
        // Limpiar tabla
        const tbody = document.getElementById('messagesTableBody');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center text-muted py-4">
                        <i class="bi bi-check-circle fs-1 text-success d-block mb-2"></i>
                        Dashboard limpiado. Los nuevos mensajes aparecerán aquí en tiempo real.
                    </td>
                </tr>
            `;
        }
        
        // Limpiar filtros
        resetFilters();
        
        showSuccess('✅ Dashboard limpiado exitosamente');
        
        console.log('🧹 Dashboard limpiado - localStorage y array vaciados');
    }
}