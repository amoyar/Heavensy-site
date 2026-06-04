// ============================================
// MONITOR EN TIEMPO REAL - JAVASCRIPT
// Integrado con socket_rooms existente
// ============================================
// ── BITÁCORA ──
// 2026-06-03 | Eliminada logout() local: pisaba la logout() global de app.js
//              (solo borraba 'token' y dejaba el refresh_token vivo, por lo que
//              la sesión revivía al llegar a login.html). La desconexión del
//              socket ahora la hace la logout global.

let socket = null;
let soundEnabled = true;
let messagesCount = 0;
let blockedCount = 0;
let monitorCompanies = [];
//let currentCompanyId = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

// 🆕 Deduplicación de mensajes
let recentMessageIds = new Set();
const MESSAGE_ID_CACHE_SIZE = 100;

// 🆕 Cache de empresas (para bot_name)
let companiesCache = {};

// 🆕 Variables para historial de mensajes
let currentUserFilter = null; // null = todos los usuarios
let isLoadingHistory = false;
let hasMoreMessages = true;

// ============================================
// INICIALIZACIÓN
// ============================================

async function initMonitorPage() {
    // Cargar Socket.IO si no está cargado
    if (typeof io === 'undefined') {
        await loadSocketIO();
    }

    // Cargar datos de usuario
    await loadUserInfo();
    
    // Cargar empresas para el filtro
    await loadCompaniesMonitor();
    
    // Cargar estadísticas iniciales
    await loadInitialStats();
    
    // 🆕 Cargar historial de mensajes
    await loadMessageHistory();
    
    // 🆕 Cargar usuarios para el filtro
    await loadActiveUsers();
    
    // Inicializar Socket.IO
    initSocket();
    
    // Cargar estado de rooms
    await loadRoomsStatus();
    
    // Crear elemento de status si no existe
    if (!document.getElementById('monitorConnectionStatus')) {
        const statusWrap = document.createElement('div');
        statusWrap.id = 'monitorConnectionStatus';
        statusWrap.style.cssText = 'display:inline-flex;align-items:center;gap:6px;font-size:12px;margin-bottom:12px;';
        const appEl = document.getElementById('app');
        if (appEl && appEl.firstChild) appEl.insertBefore(statusWrap, appEl.firstChild);
    }

    // Log inicial
    addLog('INFO', 'Monitor en tiempo real iniciado');
    addLog('INFO', `Company ID: ${currentCompanyId}`);
}

// Cargar Socket.IO dinámicamente
function loadSocketIO() {
    return new Promise((resolve, reject) => {
        if (typeof io !== 'undefined') {
            resolve();
            return;
        }
        
        const script = document.createElement('script');
        script.src = 'https://cdn.socket.io/4.5.4/socket.io.min.js';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

// ============================================
// SOCKET.IO CONNECTION
// ============================================

function initSocket() {
    addLog('INFO', `Conectando a: ${API_BASE_URL}`);
    
    socket = io(API_BASE_URL, {
        auth: {
            token: getToken()
        },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: MAX_RECONNECT_ATTEMPTS
    });

    // ==========================================
    // CONNECTION EVENTS
    // ==========================================
    
    socket.on('connect', () => {
        reconnectAttempts = 0;
        updateConnectionStatus('connected');
        addLog('SUCCESS', `Conectado - SID: ${socket.id.substring(0, 8)}...`);
        
        // Join company room usando tu sistema de rooms
        if (currentCompanyId) {
            joinCompanyRoom();
        }
    });

    socket.on('disconnect', (reason) => {
        updateConnectionStatus('disconnected');
        addLog('ERROR', `Desconectado: ${reason}`);
        
        if (reason === 'io server disconnect') {
            // Servidor cerró conexión, reconectar manualmente
            socket.connect();
        }
    });

    socket.on('connect_error', (error) => {
        reconnectAttempts++;
        updateConnectionStatus('error');
        addLog('ERROR', `Error conexión (intento ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}): ${error.message}`);
        
        if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
            addLog('ERROR', 'Máximo de intentos alcanzado. Recarga la página.');
        }
    });

    socket.on('reconnect', (attemptNumber) => {
        addLog('SUCCESS', `Reconectado después de ${attemptNumber} intentos`);
        reconnectAttempts = 0;
    });

    socket.on('reconnect_attempt', (attemptNumber) => {
        addLog('INFO', `Intentando reconectar... (${attemptNumber})`);
    });

    socket.on('reconnect_failed', () => {
        addLog('ERROR', 'Reconexión fallida. Recarga la página.');
    });

    // ==========================================
    // ROOM EVENTS (usando tu sistema)
    // ==========================================
    
    socket.on('room_joined', (data) => {
        addLog('SUCCESS', `✅ Unido a room: ${data.room}`);
        console.log('Room joined data:', data);
    });

    socket.on('room_left', (data) => {
        addLog('INFO', `Salió de room: ${data.room}`);
    });

    socket.on('error', (error) => {
        addLog('ERROR', `Socket error: ${error.message || error}`);
        console.error('Socket error:', error);
    });

    // ==========================================
    // MESSAGE EVENTS (CRÍTICOS)
    // ==========================================
    
    // Evento principal: new_message
    socket.on('new_message', (data) => {
        console.log('📨 new_message recibido:', data);
        handleNewMessage(data);
    });

    // Mensajes bloqueados por moderación
    socket.on('message_blocked', (data) => {
        console.log('🚫 message_blocked recibido:', data);
        handleBlockedMessage(data);
    });

    // Usuario bloqueado
    socket.on('user_blocked', (data) => {
        console.log('👤🚫 user_blocked recibido:', data);
        handleUserBlocked(data);
    });

    // Usuario desbloqueado
    socket.on('user_unblocked', (data) => {
        console.log('👤✅ user_unblocked recibido:', data);
        handleUserUnblocked(data);
    });

    // Debug: Escuchar TODOS los eventos
    socket.onAny((eventName, ...args) => {
        console.log(`🔔 Evento recibido: ${eventName}`, args);
    });
}

function joinCompanyRoom() {
    addLog('INFO', `Uniéndose a room de empresa: ${currentCompanyId}`);
    
    socket.emit('join_room', {
        type: 'company',
        company_id: currentCompanyId
    });
}

// ============================================
// MESSAGE HANDLERS
// ============================================

// 🆕 FUNCIÓN: Cargar bot_name desde empresa
async function loadCompanyBotName(company_id) {
    // Si ya está en caché, retornar inmediatamente
    if (companiesCache[company_id]?.bot_name) {
        return companiesCache[company_id].bot_name;
    }
    
    try {
        // Obtener empresa desde API
        const response = await fetch(`${API_BASE_URL}/api/companies/${company_id}`, {
            headers: {
                'Authorization': `Bearer ${getToken()}`
            }
        });
        
        if (!response.ok) {
            console.warn(`⚠️ No se pudo obtener empresa ${company_id}`);
            return 'Asistente';
        }
        
        const data = await response.json();
        const company = data.company || data;
        
        // Extraer bot_name
        const bot_name = company.bot_config?.bot_name || 'Asistente';
        
        // Guardar en caché
        companiesCache[company_id] = {
            bot_name: bot_name,
            phone_number_id: company.phone_number_id || company.whatsapp_config?.phone_number_id
        };
        
        console.log(`✅ Bot name cacheado para ${company_id}: ${bot_name}`);
        
        return bot_name;
        
    } catch (error) {
        console.error(`❌ Error obteniendo bot_name para ${company_id}:`, error);
        return 'Asistente';
    }
}

function handleNewMessage(data) {
    messagesCount++;
    document.getElementById('messagesToday').textContent = messagesCount;
    
    // Reproducir sonido
    if (soundEnabled) {
        playNotificationSound();
    }
    
    // Agregar mensaje al feed
    addMessageToFeed({
        ...data,
        blocked: false
    });
    
    // Log
    const senderType = data.sender_type || 'unknown';
    const userId = data.user_id || 'unknown';
    addLog('INFO', `📨 Mensaje ${senderType}: ${userId}`);
    
    // Actualizar conversaciones activas
    updateActiveConversations();
}

function handleBlockedMessage(data) {
    blockedCount++;
    document.getElementById('blockedMessages').textContent = blockedCount;
    
    // Agregar al feed con estilo de bloqueado
    addMessageToFeed({
        ...data,
        blocked: true
    });
    
    addLog('WARNING', `🚫 Bloqueado: ${data.user_id} - ${data.reason || 'Sin razón'}`);
    
    // Sonido diferente para bloqueados
    if (soundEnabled) {
        // Podrías agregar un sonido diferente aquí
        playNotificationSound();
    }
}

function handleUserBlocked(data) {
    addLog('WARNING', `👤🚫 Usuario bloqueado: ${data.user_id}`);
    updateBlockedUsers();
}

function handleUserUnblocked(data) {
    addLog('INFO', `👤✅ Usuario desbloqueado: ${data.user_id}`);
    updateBlockedUsers();
}

// ============================================
// UI UPDATES
// ============================================

async function addMessageToFeed(data, isHistory = false) {
    const container = document.getElementById('messagesContainer');
    
    // 🆕 DEDUPLICACIÓN: Verificar si el mensaje ya fue procesado
    const messageId = data.message_id;
    if (messageId) {
        if (recentMessageIds.has(messageId)) {
            console.log(`⚠️ Mensaje duplicado ignorado: ${messageId}`);
            return; // Ignorar mensaje duplicado
        }
        
        // Agregar a caché de IDs recientes
        recentMessageIds.add(messageId);
        
        // Limitar tamaño del caché
        if (recentMessageIds.size > MESSAGE_ID_CACHE_SIZE) {
            const idsArray = Array.from(recentMessageIds);
            recentMessageIds = new Set(idsArray.slice(-MESSAGE_ID_CACHE_SIZE));
        }
    }
    
    // Remover mensaje de "esperando" o "no hay mensajes"
    const emptyState = container.querySelector('.text-center:not(#loadingIndicator)');
    if (emptyState) {
        emptyState.remove();
    }
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message-item p-4 rounded-lg border ${
        data.blocked ? 'bg-red-50 border-red-300' : 
        data.sender_type === 'user' ? 'bg-blue-50 border-blue-200' : 
        'bg-green-50 border-green-200'
    }`;
    
    const senderIcon = data.sender_type === 'user' ? 
        '<i class="fas fa-user text-blue-600"></i>' : 
        '<i class="fas fa-robot text-green-600"></i>';
    
    const blockBadge = data.blocked ? 
        '<span class="ml-2 px-2 py-1 bg-red-500 text-white text-xs rounded-full">BLOQUEADO</span>' : '';
    
    // ✨ Obtener nombres correctos
    let displayName = '';
    
    if (data.sender_type === 'user') {
        // Usuario: nombre + teléfono
        const userName = data.profile_name || data.user_name || 'Usuario';
        const phone = data.user_id ? formatPhone(data.user_id) : '';
        displayName = phone ? `${userName} ${phone}` : userName;
        
    } else {
        // Bot: SOLO nombre (sin teléfono del usuario)
        let botName = data.bot_name || data.assistant_name;
        
        // Si no viene bot_name, intentar obtenerlo de la empresa
        if (!botName && data.company_id) {
            try {
                botName = await loadCompanyBotName(data.company_id);
            } catch (error) {
                console.warn('Error obteniendo bot_name:', error);
                botName = 'Asistente';
            }
        }
        
        // ✅ SOLO EL NOMBRE DEL BOT (sin número)
        displayName = botName || 'Asistente';
    }
    
    const senderLabel = data.sender_type === 'user' ? 'Usuario' : 'Asistente';
    
    messageDiv.innerHTML = `
        <div class="flex items-start justify-between">
            <div class="flex-1">
                <div class="flex items-center space-x-2 mb-2">
                    ${senderIcon}
                    <span class="text-xs text-gray-500">${senderLabel}</span>
                    <span class="font-semibold text-gray-900">${displayName}</span>
                    ${blockBadge}
                    <span class="text-xs text-gray-400">${formatTime(data.timestamp)}</span>
                </div>
                <p class="text-sm text-gray-700 whitespace-pre-wrap">${escapeHtml(data.text || data.message || 'Sin contenido')}</p>
                ${data.reason ? `<p class="text-xs text-red-600 mt-2"><i class="fas fa-exclamation-circle"></i> Razón: ${escapeHtml(data.reason)}</p>` : ''}
                ${data.message_id ? `<p class="text-xs text-gray-400 mt-1">ID: ${data.message_id.substring(0, 16)}...</p>` : ''}
            </div>
            <div class="ml-4 text-right">
                <span class="text-xs font-mono text-gray-500">${data.company_id || currentCompanyId}</span>
            </div>
        </div>
    `;
    
    // 🆕 Si es historial, agregar al final (antes del botón "Cargar más")
    // Si es tiempo real, agregar al inicio
    if (isHistory) {
        // Buscar el botón "Cargar más" si existe
        const loadMoreBtn = container.querySelector('#loadMoreBtn');
        if (loadMoreBtn) {
            container.insertBefore(messageDiv, loadMoreBtn);
        } else {
            container.appendChild(messageDiv);
        }
    } else {
        // Tiempo real: agregar al inicio (más reciente arriba)
        container.insertBefore(messageDiv, container.firstChild);
    }
    
    // No limitar mensajes cuando cargamos historial
    if (!isHistory) {
        // Limitar a 200 mensajes en tiempo real para rendimiento
        const messages = Array.from(container.children).filter(el => el.classList.contains('message-item'));
        while (messages.length > 200) {
            messages[messages.length - 1].remove();
            messages.pop();
        }
    }
}

function addLog(type, message) {
    const container = document.getElementById('logsContainer');
    const timestamp = new Date().toLocaleTimeString();
    
    const colorMap = {
        'INFO': 'text-blue-400',
        'SUCCESS': 'text-green-400',
        'WARNING': 'text-yellow-400',
        'ERROR': 'text-red-400'
    };
    
    const iconMap = {
        'INFO': 'ℹ️',
        'SUCCESS': '✅',
        'WARNING': '⚠️',
        'ERROR': '❌'
    };
    
    const logDiv = document.createElement('div');
    logDiv.className = `${colorMap[type] || 'text-gray-400'} mb-1`;
    logDiv.textContent = `[${timestamp}] ${iconMap[type] || ''} ${message}`;
    
    container.insertBefore(logDiv, container.firstChild);
    
    // Limitar a 100 logs
    while (container.children.length > 100) {
        container.removeChild(container.lastChild);
    }
    
    // Auto-scroll al último log
    container.scrollTop = 0;
}

function updateConnectionStatus(status) {
    // Usar elemento propio del módulo monitor — no tocar el connectionStatus de la navbar
    const statusEl = document.getElementById('monitorConnectionStatus');
    if (!statusEl) return;

    const statusConfig = {
        connected:    { color: 'bg-green-500',  text: 'Conectado',       pulse: true  },
        disconnected: { color: 'bg-red-500',     text: 'Desconectado',    pulse: false },
        error:        { color: 'bg-yellow-500',  text: 'Reconectando...', pulse: true  }
    };

    const config = statusConfig[status] || statusConfig.disconnected;

    statusEl.innerHTML = `
        <span class="h-3 w-3 rounded-full ${config.color} ${config.pulse ? 'pulse-dot' : ''}"></span>
        <span class="text-sm ${status === 'connected' ? 'text-green-600' : 'text-gray-600'}">${config.text}</span>
    `;
}

async function updateBlockedUsers() {
    try {
        const response = await apiCall(`/api/admin/${currentCompanyId}/blocked-users`);
        
        if (response.ok) {
            const container = document.getElementById('blockedUsersContainer');
            const users = response.data?.blocked_users || response.data?.users || [];
            
            document.getElementById('blockedMessages').textContent = users.length;
            
            if (users.length === 0) {
                container.innerHTML = '<p class="text-sm text-gray-500 text-center py-4">Sin usuarios bloqueados</p>';
                return;
            }
            
            container.innerHTML = users.map(user => `
                <div class="flex items-center justify-between p-3 border-b border-gray-100 hover:bg-gray-50">
                    <div class="flex-1">
                        <p class="text-sm font-medium text-gray-900">${formatPhone(user.user_id)}</p>
                        <p class="text-xs text-gray-500 mt-1">${escapeHtml(user.reason || 'Sin razón especificada')}</p>
                        <p class="text-xs text-gray-400 mt-0.5">${formatTime(user.blocked_at)}</p>
                    </div>
                    <button 
                        onclick="unblockUser('${user.user_id}')" 
                        class="ml-2 px-3 py-1 text-xs bg-blue-100 text-blue-600 hover:bg-blue-200 rounded-lg transition"
                        title="Desbloquear usuario"
                    >
                        <i class="fas fa-unlock"></i> Desbloquear
                    </button>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Error cargando usuarios bloqueados:', error);
        addLog('ERROR', 'Error cargando usuarios bloqueados');
    }
}

function updateActiveConversations() {
    // Contar IDs únicos de usuarios en mensajes visibles
    const messages = document.querySelectorAll('.message-item:not([style*="display: none"])');
    const userIds = new Set();
    
    messages.forEach(msg => {
        const userSpan = msg.querySelector('.font-semibold');
        if (userSpan) {
            userIds.add(userSpan.textContent);
        }
    });
    
    document.getElementById('activeConversations').textContent = userIds.size;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

async function loadUserInfo() {
    try {
        const claims = parseJWT(getToken());
        currentCompanyId = claims.company_id || claims.companies?.[0];
        
        // Verificar que el elemento existe antes de modificarlo
        const usernameEl = document.getElementById('username');
        if (usernameEl) {
            usernameEl.textContent = claims.username || claims.email || 'Admin';
        }
        
        addLog('INFO', `Usuario: ${claims.username || 'Admin'}`);
    } catch (error) {
        console.error('Error cargando info de usuario:', error);
        addLog('ERROR', 'Error cargando información del usuario');
    }
}

async function loadCompaniesMonitor() {
    try {
        const response = await apiCall('/api/companies');
        
        if (response.ok) {
            monitorCompanies = response.data.companies || [];
            
            const select = document.getElementById('companyFilter');
            select.innerHTML = '<option value="">Todas las empresas</option>';
            
            monitorCompanies.forEach(company => {
                const option = document.createElement('option');
                option.value = company.company_id;
                option.textContent = `${company.name} (${company.company_id})`;
                
                // Seleccionar la empresa actual por defecto
                if (company.company_id === currentCompanyId) {
                    option.selected = true;
                }
                
                select.appendChild(option);
            });
            
            addLog('SUCCESS', `${monitorCompanies.length} empresas cargadas`);
        }
    } catch (error) {
        console.error('Error cargando empresas:', error);
        addLog('ERROR', 'Error cargando lista de empresas');
    }
}

async function loadInitialStats() {
    try {
        // Intentar cargar desde tu endpoint de métricas existente
        const response = await apiCall(`/api/admin/${currentCompanyId}/metrics`);
        
        if (response.ok) {
            const metrics = response.data.metrics || response.data;
            
            document.getElementById('activeConversations').textContent = metrics.active_chats || metrics.chats || 0;
            document.getElementById('blockedMessages').textContent = metrics.blocked_chats || metrics.blocked || 0;
            
            addLog('SUCCESS', 'Estadísticas iniciales cargadas');
        }
    } catch (error) {
        console.error('Error cargando estadísticas:', error);
        addLog('WARNING', 'No se pudieron cargar estadísticas iniciales');
    }
    
    // Cargar usuarios bloqueados
    await updateBlockedUsers();
}

// ============================================
// 🆕 CARGA DE HISTORIAL DE MENSAJES
// ============================================

async function loadMessageHistory(limit = 50) {
    if (isLoadingHistory) {
        console.log('⚠️ Ya se está cargando historial');
        return;
    }
    
    isLoadingHistory = true;
    const container = document.getElementById('messagesContainer');
    
    try {
        console.log('🔄 Iniciando carga de historial...');
        
        // Mostrar indicador de carga
        showLoadingIndicator(container);
        
        // Construir query params
        const params = new URLSearchParams({
            limit: limit
        });
        
        // SIEMPRE agregar company_id
        if (currentCompanyId) {
            params.append('company_id', currentCompanyId);
        }
        
        // Si hay filtro de usuario específico
        if (currentUserFilter) {
            params.append('user_id', currentUserFilter);
        }
        
        const url = `${API_BASE_URL}/api/chat/messages/history?${params}`;
        console.log('📍 Cargando desde:', url);
        
        addLog('INFO', `Cargando historial de mensajes... (limit: ${limit})`);
        
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${getToken()}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Error ${response.status}: ${errorText}`);
        }
        
        const data = await response.json();
        console.log('✅ Respuesta recibida:', data);
        
        const messages = data.messages || [];
        console.log(`📨 Total mensajes: ${messages.length}`);
        
        addLog('SUCCESS', `${messages.length} mensajes cargados del historial`);
        
        // Limpiar container (quitar loading)
        removeLoadingIndicator(container);
        
        // Si no hay mensajes
        if (messages.length === 0) {
            console.log('⚠️ No hay mensajes para mostrar');
            if (container.children.length === 0) {
                container.innerHTML = '<p class="text-center text-gray-500 py-8">No hay mensajes para mostrar</p>';
            }
            hasMoreMessages = false;
            return;
        }
        
        // Agregar mensajes al feed (invertir para mostrar de antiguo a reciente)
        console.log('📝 Agregando mensajes al DOM...');
        let addedCount = 0;
        
        for (let i = messages.length - 1; i >= 0; i--) {
            const msg = messages[i];
            
            try {
                await addMessageToFeed({
                    sender_type: msg.sender_type || (msg.role === 'user' ? 'user' : 'assistant'),
                    user_id: msg.user_id || msg.phone,
                    profile_name: msg.profile_name,
                    company_id: msg.company_id,
                    text: msg.text || msg.content || msg.message,
                    timestamp: msg.timestamp,
                    message_id: msg.message_id || msg._id,
                    bot_name: msg.bot_name,
                    blocked: false
                }, true); // true = es historial
                
                addedCount++;
            } catch (error) {
                console.error(`❌ Error agregando mensaje ${i}:`, error);
            }
        }
        
        console.log(`✅ ${addedCount} mensajes agregados al DOM`);
        addLog('INFO', `${addedCount} mensajes mostrados en el monitor`);
        
        // Si recibimos menos mensajes que el límite, no hay más
        hasMoreMessages = messages.length === limit;
        
    } catch (error) {
        console.error('❌ Error cargando historial:', error);
        addLog('ERROR', `Error cargando historial: ${error.message}`);
        removeLoadingIndicator(container);
        
        const container2 = document.getElementById('messagesContainer');
        if (container2.children.length === 0) {
            container2.innerHTML = `
                <div class="text-center text-red-500 py-8">
                    <i class="fas fa-exclamation-circle text-2xl mb-2"></i>
                    <p>Error al cargar mensajes</p>
                    <p class="text-sm text-gray-600 mt-2">${error.message}</p>
                    <button onclick="reloadMessageHistory()" class="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
                        Reintentar
                    </button>
                </div>
            `;
        }
    } finally {
        isLoadingHistory = false;
        console.log('🏁 Carga de historial finalizada');
    }
}

function showLoadingIndicator(container) {
    const loading = document.createElement('div');
    loading.id = 'loadingIndicator';
    loading.className = 'text-center py-8';
    loading.innerHTML = `
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent"></div>
        <p class="text-gray-500 mt-2">Cargando mensajes...</p>
    `;
    container.appendChild(loading);
}

function removeLoadingIndicator(container) {
    const loading = container.querySelector('#loadingIndicator');
    if (loading) {
        loading.remove();
    }
}

function addLoadMoreButton(container) {
    // Remover botón anterior si existe
    const existingBtn = container.querySelector('#loadMoreBtn');
    if (existingBtn) existingBtn.remove();
    
    const btn = document.createElement('button');
    btn.id = 'loadMoreBtn';
    btn.className = 'w-full py-3 text-blue-600 hover:text-blue-800 hover:bg-blue-50 transition-colors border-t border-gray-200';
    btn.innerHTML = '<i class="fas fa-chevron-up mr-2"></i> Cargar mensajes anteriores';
    btn.onclick = () => loadMessageHistory(50);
    
    container.appendChild(btn);
}

async function loadRoomsStatus() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/socket/rooms/stats`, {
            headers: {
                'Authorization': `Bearer ${getToken()}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            const stats = data.stats || {};
            
            document.getElementById('onlineUsers').textContent = stats.total_clients || 0;
            
            // Mostrar rooms activos en el panel de conexiones
            displayActiveConnections(stats.rooms_detail || {});
            
            addLog('INFO', `Rooms activos: ${stats.total_rooms || 0}`);
            addLog('INFO', `Clientes conectados: ${stats.total_clients || 0}`);
        }
    } catch (error) {
        console.error('Error cargando estado de rooms:', error);
        addLog('WARNING', 'No se pudo cargar estado de conexiones');
    }
}

function displayActiveConnections(roomsDetail) {
    const container = document.getElementById('connectionsContainer');
    
    if (!roomsDetail || Object.keys(roomsDetail).length === 0) {
        container.innerHTML = '<p class="text-sm text-gray-500 text-center py-4">Sin conexiones activas</p>';
        return;
    }
    
    const html = Object.entries(roomsDetail).map(([room, count]) => {
        const isCompanyRoom = room.startsWith('company:');
        const icon = isCompanyRoom ? 'fa-building' : 'fa-user';
        const color = isCompanyRoom ? 'text-blue-600' : 'text-green-600';
        
        return `
            <div class="flex items-center justify-between p-2 border-b border-gray-100">
                <div class="flex items-center space-x-2 flex-1">
                    <i class="fas ${icon} ${color} text-sm"></i>
                    <span class="text-xs text-gray-700 truncate">${room}</span>
                </div>
                <span class="text-xs font-semibold text-gray-900">${count}</span>
            </div>
        `;
    }).join('');
    
    container.innerHTML = html;
}

function filterMessages() {
    const filter = document.getElementById('companyFilter').value;
    const messages = document.querySelectorAll('.message-item');
    
    let visibleCount = 0;
    
    messages.forEach(msg => {
        const companySpan = msg.querySelector('.text-xs.font-mono');
        const companyId = companySpan ? companySpan.textContent.trim() : '';
        
        if (!filter || companyId === filter) {
            msg.style.display = 'block';
            visibleCount++;
        } else {
            msg.style.display = 'none';
        }
    });
    
    addLog('INFO', `Filtro aplicado: ${visibleCount} mensajes visibles`);
    updateActiveConversations();
}

function clearMessages() {
    const container = document.getElementById('messagesContainer');
    container.innerHTML = `
        <div class="text-center text-gray-500 py-20">
            <i class="fas fa-inbox text-4xl mb-4"></i>
            <p>Esperando mensajes...</p>
        </div>
    `;
    messagesCount = 0;
    document.getElementById('messagesToday').textContent = '0';
    document.getElementById('activeConversations').textContent = '0';
    addLog('INFO', 'Feed de mensajes limpiado');
}

// 🆕 Funciones para filtros y recarga de historial

function clearMessagesAndReload() {
    clearMessages();
    recentMessageIds.clear(); // Limpiar caché de deduplicación
    hasMoreMessages = true;
    loadMessageHistory();
}

async function reloadMessageHistory() {
    addLog('INFO', 'Recargando historial de mensajes...');
    const container = document.getElementById('messagesContainer');
    container.innerHTML = ''; // Limpiar todo
    recentMessageIds.clear(); // Limpiar caché de deduplicación
    hasMoreMessages = true;
    await loadMessageHistory();
}

async function handleUserFilterChange() {
    const select = document.getElementById('userFilter');
    currentUserFilter = select.value || null;
    
    addLog('INFO', currentUserFilter ? 
        `Filtrando por usuario: ${currentUserFilter}` : 
        'Mostrando todos los usuarios'
    );
    
    // Recargar mensajes con el nuevo filtro
    await reloadMessageHistory();
}

async function handleCompanyChange() {
    const select = document.getElementById('companyFilter');
    const previousCompanyId = currentCompanyId;
    currentCompanyId = select.value;
    
    if (previousCompanyId !== currentCompanyId) {
        addLog('INFO', `Cambiando a empresa: ${currentCompanyId || 'Todas'}`);
        
        // Limpiar filtro de usuario
        currentUserFilter = null;
        const userSelect = document.getElementById('userFilter');
        if (userSelect) {
            userSelect.value = '';
        }
        
        // Recargar historial y reconectar socket
        await reloadMessageHistory();
        
        // Reconectar al room de la nueva empresa
        if (socket && socket.connected) {
            socket.emit('join_room', {
                type: 'company',
                company_id: currentCompanyId
            });
        }
        
        // Actualizar estadísticas
        await loadInitialStats();
    }
}

// 🆕 Cargar usuarios activos para el selector
async function loadActiveUsers() {
    if (!currentCompanyId) return;
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/chat/${currentCompanyId}/chats`, {
            headers: {
                'Authorization': `Bearer ${getToken()}`
            }
        });
        
        if (!response.ok) return;
        
        const data = await response.json();
        const conversations = data.conversations || [];
        
        const userSelect = document.getElementById('userFilter');
        if (!userSelect) return;
        
        // Limpiar opciones actuales (excepto "Todos")
        userSelect.innerHTML = '<option value="">Todos los usuarios</option>';
        
        // Agregar usuarios
        conversations.forEach(conv => {
            const option = document.createElement('option');
            option.value = conv.phone || conv.user_id;
            option.textContent = `${conv.profile_name || conv.name || 'Usuario'} (${conv.phone || conv.user_id})`;
            userSelect.appendChild(option);
        });
        
        addLog('INFO', `${conversations.length} usuarios disponibles en el filtro`);
        
    } catch (error) {
        console.error('Error cargando usuarios:', error);
    }
}

function toggleSound() {
    soundEnabled = !soundEnabled;
    const icon = document.querySelector('#soundToggle i');
    icon.className = soundEnabled ? 'fas fa-volume-up text-gray-600' : 'fas fa-volume-mute text-gray-400';
    
    const btn = document.getElementById('soundToggle');
    btn.title = soundEnabled ? 'Desactivar sonido' : 'Activar sonido';
    
    addLog('INFO', `🔊 Sonido ${soundEnabled ? 'activado' : 'desactivado'}`);
    
    // Reproducir sonido de prueba si se activa
    if (soundEnabled) {
        playNotificationSound();
    }
}

function playNotificationSound() {
    try {
        const audio = document.getElementById('notificationSound');
        audio.currentTime = 0;
        audio.play().catch(err => {
            console.error('Error reproduciendo sonido:', err);
            // Navegador bloqueó autoplay, no hacer nada
        });
    } catch (error) {
        console.error('Error con audio:', error);
    }
}

function parseJWT(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(
            atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
        );
        return JSON.parse(jsonPayload);
    } catch (error) {
        console.error('Error parseando JWT:', error);
        return {};
    }
}

function formatTime(timestamp) {
    if (!timestamp) return new Date().toLocaleTimeString('es-CL');
    
    try {
        const date = new Date(timestamp);
        return date.toLocaleTimeString('es-CL', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    } catch {
        return timestamp;
    }
}

function formatPhone(phone) {
    if (!phone) return 'Desconocido';
    
    // Formato chileno: +56 9 1234 5678
    if (phone.startsWith('569')) {
        return `+56 9 ${phone.substring(3, 7)} ${phone.substring(7)}`;
    }
    
    return phone;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function unblockUser(userId) {
    try {
        addLog('INFO', `Desbloqueando usuario: ${userId}`);
        
        const response = await apiCall(`/api/admin/${currentCompanyId}/users/${userId}/unblock`, {
            method: 'POST'
        });
        
        if (response.ok) {
            addLog('SUCCESS', `✅ Usuario ${formatPhone(userId)} desbloqueado`);
            await updateBlockedUsers();
        } else {
            const error = response.data?.error || 'Error desconocido';
            addLog('ERROR', `Error desbloqueando usuario: ${error}`);
            showAlert(error);
        }
    } catch (error) {
        console.error('Error desbloqueando usuario:', error);
        addLog('ERROR', `Error desbloqueando usuario: ${error.message}`);
        showAlert('Error desbloqueando usuario. Intenta nuevamente.');
    }
}

function showAlert(message) {
    // Podrías usar SweetAlert2 o un toast personalizado
    alert(message);
}

// ============================================
// PERIODIC UPDATES
// ============================================

// Actualizar estadísticas cada 30 segundos
setInterval(async () => {
    if (socket && socket.connected) {
        await loadRoomsStatus();
    }
}, 30000);

// ============================================
// CLEANUP
// ============================================

window.addEventListener('beforeunload', () => {
    if (socket) {
        socket.disconnect();
    }
});