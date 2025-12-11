// Heavensy Admin - Configuration (PRODUCTION VERSION)

const CONFIG = {
    // PRODUCTION MODE: Connects to real backend
    DEMO_MODE: false, // Backend real conectado
    
    // URLs BASE (sin endpoints específicos - se concatenan automáticamente)
    BACKEND_URL: 'https://heavensy-api-backend.onrender.com',
    WEBHOOK_URL: 'https://heavensy-api-webhook.onrender.com',
    SOCKET_URL: 'https://heavensy-api-backend.onrender.com',
    
    // For local development, change URLs to:
    // BACKEND_URL: 'http://localhost:5001',
    // WEBHOOK_URL: 'http://localhost:10000',
    // SOCKET_URL: 'http://localhost:5001',
    
    API_ENDPOINTS: {
        // Authentication
        LOGIN: '/api/auth/login',
        LOGOUT: '/api/auth/logout',
        REFRESH: '/api/auth/refresh',
        
        // Companies
        COMPANIES: '/api/companies',
        COMPANY_BY_ID: (id) => `/api/companies/${id}`,
        COMPANY_STATS: (id) => `/api/companies/${id}/stats`,
        
        // Users (System Users)
        USERS: '/api/users',
        USER_BY_ID: (id) => `/api/users/${id}`,
        USER_ROLES: '/api/users/roles',
        USER_ASSIGN_ROLE: (userId, roleId) => `/api/users/${userId}/roles/${roleId}`,
        
        // WhatsApp Users
        WHATSAPP_USERS: '/api/whatsapp-users',
        WHATSAPP_USER: (userId) => `/api/whatsapp-users/${userId}`,
        WHATSAPP_USER_MESSAGES: (userId) => `/api/whatsapp-users/${userId}/messages`,
        WHATSAPP_USER_BLOCK: (userId) => `/api/whatsapp-users/${userId}/block`,
        WHATSAPP_USER_UNBLOCK: (userId) => `/api/whatsapp-users/${userId}/unblock`,
        BLOCKED_USERS: '/api/whatsapp-users/blocked',
        
        // Conversations
        CONVERSATIONS: '/api/conversations',
        CONVERSATION_BY_ID: (id) => `/api/conversations/${id}`,
        SEND_MESSAGE: (conversationId) => `/api/conversations/${conversationId}/send`,
        
        // Dashboard
        DASHBOARD: '/api/dashboard',
        
        // Multimedia
        MEDIA: '/api/media',
        MEDIA_STATS: '/api/media/stats',
        
        // Configuration
        CONFIG: '/api/config',
        
        // Webhook
        WEBHOOK_VERIFY: '/webhook/message',
        WEBHOOK_HEALTH: '/api/health'  // Backend health check
    },
    
    STORAGE_KEYS: {
        AUTH_TOKEN: 'heavensy_auth_token',
        USER_INFO: 'heavensy_user_info',
        REFRESH_TOKEN: 'heavensy_refresh_token'
    },
    
    SOCKET_EVENTS: {
        CONNECT: 'connect',
        DISCONNECT: 'disconnect',
        NEW_MESSAGE: 'new_message',
        MESSAGE_SENT: 'message_sent',
        USER_BLOCKED: 'user_blocked',
        USER_UNBLOCKED: 'user_unblocked'
    }
};

// Helper function to get full API URL
function getApiUrl(endpoint) {
    return `${CONFIG.BACKEND_URL}${endpoint}`;
}

// Helper function to get webhook URL
function getWebhookUrl(endpoint) {
    return `${CONFIG.WEBHOOK_URL}${endpoint}`;
}

// Helper function to get authorization headers
function getAuthHeaders() {
    const token = localStorage.getItem(CONFIG.STORAGE_KEYS.AUTH_TOKEN);
    return {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
    };
}

// Helper function to check if user is authenticated
function isAuthenticated() {
    return !!localStorage.getItem(CONFIG.STORAGE_KEYS.AUTH_TOKEN);
}

// Helper function to get user info
function getUserInfo() {
    const userInfo = localStorage.getItem(CONFIG.STORAGE_KEYS.USER_INFO);
    return userInfo ? JSON.parse(userInfo) : null;
}

// Helper function for API calls
async function apiCall(endpoint, options = {}) {
    // If in demo mode, return demo data
    if (CONFIG.DEMO_MODE) {
        return getDemoData(endpoint, options);
    }
    
    const url = getApiUrl(endpoint);
    const headers = getAuthHeaders();
    
    const config = {
        ...options,
        headers: {
            ...headers,
            ...options.headers
        }
    };
    
    // Add timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    try {
        const response = await fetch(url, {
            ...config,
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        // Check if response is JSON
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || `HTTP ${response.status}: ${response.statusText}`);
            }
            
            return data;
        } else {
            // If not JSON, return text
            const text = await response.text();
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return { data: text };
        }
    } catch (error) {
        clearTimeout(timeoutId);
        
        if (error.name === 'AbortError') {
            throw new Error('La solicitud tardó demasiado tiempo (timeout)');
        }
        
        console.error('API Error:', error);
        throw error;
    }
}

// Get demo data based on endpoint
function getDemoData(endpoint, options = {}) {
    console.log('Demo mode: returning demo data for', endpoint);
    
    // Simulate API delay
    return new Promise((resolve) => {
        setTimeout(() => {
            // Dashboard stats
            if (endpoint === CONFIG.API_ENDPOINTS.DASHBOARD) {
                resolve({
                    total_messages: 1234,
                    total_users: 56,
                    blocked_users: 3,
                    response_rate: 94
                });
            }
            
            // Companies
            else if (endpoint === CONFIG.API_ENDPOINTS.COMPANIES) {
                resolve({
                    companies: [
                        {
                            company_id: 'HEAVENSY_001',
                            name: 'Heavensy Demo',
                            contact_email: 'contacto@heavensy.com',
                            contact_phone: '+56912345678',
                            active: true,
                            bot_config: { bot_name: 'Alicia' },
                            whatsapp_config: { phone_number_id: '492838720578038' }
                        },
                        {
                            company_id: 'LATTICE_001',
                            name: 'Lattice Terapia',
                            contact_email: 'info@lattice.cl',
                            contact_phone: '+56987654321',
                            active: true,
                            bot_config: { bot_name: 'Asistente' },
                            whatsapp_config: { phone_number_id: '814189351782625' }
                        }
                    ]
                });
            }
            
            // Users
            else if (endpoint === CONFIG.API_ENDPOINTS.USERS) {
                resolve({
                    users: [
                        {
                            _id: '1',
                            username: 'admin',
                            email: 'admin@heavensy.com',
                            first_name: 'Admin',
                            last_name: 'Demo',
                            company_id: 'HEAVENSY_001',
                            role: 'ADMIN_ROL',
                            is_active: true
                        },
                        {
                            _id: '2',
                            username: 'operador',
                            email: 'operador@heavensy.com',
                            first_name: 'Operador',
                            last_name: 'Demo',
                            company_id: 'HEAVENSY_001',
                            role: 'OPERATOR_ROL',
                            is_active: true
                        }
                    ]
                });
            }
            
            // WhatsApp Users
            else if (endpoint === CONFIG.API_ENDPOINTS.WHATSAPP_USERS) {
                resolve({
                    users: [
                        {
                            user_id: '56912345678',
                            phone_number: '56912345678',
                            name: 'Juan Pérez',
                            company_id: 'HEAVENSY_001',
                            message_count: 15,
                            is_blocked: false,
                            last_message_at: new Date().toISOString()
                        },
                        {
                            user_id: '56987654321',
                            phone_number: '56987654321',
                            name: 'María González',
                            company_id: 'HEAVENSY_001',
                            message_count: 8,
                            is_blocked: false,
                            last_message_at: new Date(Date.now() - 3600000).toISOString()
                        },
                        {
                            user_id: '56955555555',
                            phone_number: '56955555555',
                            name: 'Usuario Bloqueado',
                            company_id: 'HEAVENSY_001',
                            message_count: 3,
                            is_blocked: true,
                            last_message_at: new Date(Date.now() - 86400000).toISOString()
                        }
                    ]
                });
            }
            
            // Conversations
            else if (endpoint === CONFIG.API_ENDPOINTS.CONVERSATIONS) {
                resolve({
                    conversations: [
                        {
                            _id: 'conv1',
                            user_name: 'Juan Pérez',
                            company_id: 'HEAVENSY_001',
                            message_count: 15,
                            updated_at: new Date().toISOString()
                        },
                        {
                            _id: 'conv2',
                            user_name: 'María González',
                            company_id: 'HEAVENSY_001',
                            message_count: 8,
                            updated_at: new Date(Date.now() - 3600000).toISOString()
                        }
                    ]
                });
            }
            
            // Media stats
            else if (endpoint === CONFIG.API_ENDPOINTS.MEDIA_STATS) {
                resolve({
                    images: 45,
                    videos: 12,
                    audios: 8
                });
            }
            
            // Config
            else if (endpoint === CONFIG.API_ENDPOINTS.CONFIG) {
                resolve({
                    max_messages_per_user: 150,
                    message_retention_days: 90,
                    enable_moderation: true
                });
            }
            
            // Default response for other endpoints
            else {
                resolve({
                    success: true,
                    message: 'Demo mode: operación simulada',
                    data: []
                });
            }
        }, 300); // 300ms delay to simulate API call
    });
}

// Wake backend function
async function wakeBackend() {
    if (CONFIG.DEMO_MODE) {
        showInfo('Modo Demo activo. El backend no es necesario.');
        return;
    }
    
    showLoading('Activando backend...');
    try {
        const response = await fetch(getApiUrl(CONFIG.API_ENDPOINTS.WEBHOOK_HEALTH), {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });
        
        if (response.ok) {
            const data = await response.json();
            showSuccess(`Backend activado: ${data.status}`);
        } else {
            showError('Error al activar el backend (status: ' + response.status + ')');
        }
    } catch (error) {
        console.error('Error waking backend:', error);
        showError('Error al contactar con el backend. El servidor puede estar dormido, espera 30-60 segundos e intenta nuevamente.');
    } finally {
        hideLoading();
    }
}

// UI Helper functions
function showLoading(message = 'Cargando...') {
    const overlay = document.createElement('div');
    overlay.className = 'loading-overlay';
    overlay.id = 'loadingOverlay';
    overlay.innerHTML = `
        <div class="loading-content">
            <div class="spinner-border spinner-border-heavensy mb-3" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
            <p class="mb-0">${message}</p>
        </div>
    `;
    document.body.appendChild(overlay);
}

function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.remove();
    }
}

function showSuccess(message) {
    showAlert(message, 'success');
}

function showError(message) {
    showAlert(message, 'danger');
}

function showInfo(message) {
    showAlert(message, 'info');
}

function showAlert(message, type = 'info') {
    const alertContainer = document.getElementById('alertContainer');
    if (!alertContainer) {
        const container = document.createElement('div');
        container.id = 'alertContainer';
        container.style.position = 'fixed';
        container.style.top = '80px';
        container.style.right = '20px';
        container.style.zIndex = '9999';
        container.style.minWidth = '350px';
        container.style.maxWidth = '500px';
        document.body.appendChild(container);
    }
    
    const alert = document.createElement('div');
    alert.className = `alert alert-${type} alert-dismissible fade show`;
    alert.setAttribute('role', 'alert');
    alert.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    document.getElementById('alertContainer').appendChild(alert);
    
    setTimeout(() => {
        alert.remove();
    }, 10000); // 10 seconds for error messages with instructions
}

// Format date helper
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('es-CL', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Format phone number helper
function formatPhone(phone) {
    if (!phone) return '';
    // Remove non-numeric characters
    const cleaned = phone.replace(/\D/g, '');
    // Format as +56 9 XXXX XXXX
    if (cleaned.length === 11 && cleaned.startsWith('56')) {
        return `+${cleaned.slice(0, 2)} ${cleaned.slice(2, 3)} ${cleaned.slice(3, 7)} ${cleaned.slice(7)}`;
    }
    return phone;
}

// Export config
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}
