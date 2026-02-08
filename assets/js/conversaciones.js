// ============================================
// CONVERSACIONES - JAVASCRIPT
// Sistema de chat en tiempo real estilo WhatsApp
// ============================================

console.log('✅ conversaciones.js cargado');

let currentConversation = null;
let conversations = [];

// ============================================
// INICIALIZACIÓN
// ============================================
async function initConversacionesPage() {
    console.log('🚀 Inicializando página de conversaciones');

    // Verificar autenticación
    const token = getToken();
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    // Cargar conversaciones
    await cargarConversaciones();

    // Configurar event listeners
    setupEventListeners();

    console.log('✅ Página de conversaciones inicializada');
}

// ============================================
// CARGAR CONVERSACIONES
// ============================================
async function cargarConversaciones() {
    console.log('🔄 Cargando conversaciones...');

    try {
        // En producción, esto vendría del backend
        // Por ahora, usamos datos de ejemplo
        conversations = [
            {
                id: '1',
                name: 'Jorge Guerrero',
                phone: '+56942531118',
                avatar: 'JG',
                status: 'online',
                lastMessage: 'Activo ahora',
                time: 'To 28',
                unread: 0,
                active: true,
                color: 'purple'
            },
            {
                id: '2',
                name: 'Jorge Ramos',
                phone: '+56912345678',
                avatar: 'JR',
                status: 'offline',
                lastMessage: 'ETTM2',
                time: '09:52',
                unread: 0,
                active: false,
                color: 'blue'
            },
            {
                id: '3',
                name: 'Martin Castill',
                phone: '+56923456789',
                avatar: 'MC',
                status: 'offline',
                lastMessage: 'X?',
                time: '05.011',
                unread: 0,
                active: false,
                tags: ['VIP'],
                color: 'green'
            },
            {
                id: '4',
                name: 'Manuel Reyes',
                phone: '+56923456789',
                avatar: 'MR',
                status: 'offline',
                lastMessage: 'Último mensaje...',
                time: '18.01',
                unread: 0,
                active: false,
                color: 'orange'
            },
            {
                id: '5',
                name: 'Laura Pérez',
                phone: '+56934567890',
                avatar: 'LP',
                status: 'offline',
                lastMessage: 'nge al desas el',
                time: '22:39',
                unread: 0,
                active: false,
                color: 'pink'
            }
        ];

        renderConversations();
        
        // Seleccionar primera conversación por defecto
        if (conversations.length > 0) {
            selectConversation(conversations[0].id);
        }

        console.log('✅ Conversaciones cargadas');
    } catch (error) {
        console.error('❌ Error cargando conversaciones:', error);
    }
}

// ============================================
// RENDERIZAR CONVERSACIONES
// ============================================
function renderConversations() {
    const container = document.getElementById('conversationsList');
    if (!container) return;

    // Mantener solo conversaciones dinámicas
    const staticHTML = container.innerHTML;
    // Por ahora mantenemos el HTML estático
    // En producción, aquí renderizarías dinámicamente desde conversations[]
}

// ============================================
// SELECCIONAR CONVERSACIÓN
// ============================================
function selectConversation(conversationId) {
    console.log('📱 Seleccionando conversación:', conversationId);

    currentConversation = conversations.find(c => c.id === conversationId);
    
    if (!currentConversation) {
        console.warn('⚠️ Conversación no encontrada');
        return;
    }

    // Actualizar UI
    updateActiveConversation();
    loadMessages(conversationId);
    updateContactPanel();
}

// ============================================
// ACTUALIZAR CONVERSACIÓN ACTIVA
// ============================================
function updateActiveConversation() {
    // Remover estado activo de todas las conversaciones
    const allConvs = document.querySelectorAll('#conversationsList > div');
    allConvs.forEach(conv => {
        conv.classList.remove('bg-purple-50', 'bg-purple-100');
        conv.classList.add('hover:bg-gray-50');
    });

    // Agregar estado activo a la conversación seleccionada
    // Esto se haría dinámicamente con IDs en producción
}

// ============================================
// CARGAR MENSAJES
// ============================================
async function loadMessages(conversationId) {
    console.log('💬 Cargando mensajes para:', conversationId);

    const chatContainer = document.getElementById('chatMessages');
    if (!chatContainer) return;

    // En producción, cargar desde el backend
    // Por ahora, mantener mensajes de ejemplo del HTML
    
    // Scroll al final
    setTimeout(() => {
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }, 100);
}

// ============================================
// ENVIAR MENSAJE
// ============================================
async function sendMessage() {
    const input = document.querySelector('#chatMessages + div input[type="text"]');
    if (!input) return;

    const message = input.value.trim();
    if (!message) return;

    console.log('📤 Enviando mensaje:', message);

    try {
        // Agregar mensaje a la UI
        addMessageToChat({
            text: message,
            sender: 'user',
            time: new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }),
            read: false
        });

        // Limpiar input
        input.value = '';

        // En producción, enviar al backend
        // await apiCall('/api/messages/send', { ... });

        console.log('✅ Mensaje enviado');
    } catch (error) {
        console.error('❌ Error enviando mensaje:', error);
        alert('Error al enviar el mensaje');
    }
}

// ============================================
// AGREGAR MENSAJE AL CHAT
// ============================================
function addMessageToChat(message) {
    const chatContainer = document.getElementById('chatMessages');
    if (!chatContainer) return;

    const messagesDiv = chatContainer.querySelector('.space-y-4');
    if (!messagesDiv) return;

    const messageDiv = document.createElement('div');
    messageDiv.className = `flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`;

    const bubbleClass = message.sender === 'user' 
        ? 'bg-purple-100 rounded-2xl rounded-tr-sm' 
        : 'bg-white rounded-2xl rounded-tl-sm shadow-sm border border-gray-100';

    messageDiv.innerHTML = `
        <div class="${bubbleClass} px-4 py-3 max-w-md">
            <p class="text-sm text-gray-800">${escapeHtml(message.text)}</p>
            ${message.sender === 'user' ? `
                <div class="flex items-center justify-end gap-2 mt-1">
                    <span class="text-xs text-gray-500">${message.time}</span>
                    <i class="fas fa-check${message.read ? '-double text-blue-500' : ' text-gray-400'} text-xs"></i>
                </div>
            ` : `
                <span class="text-xs text-gray-500 mt-1 block">${message.time}</span>
            `}
        </div>
    `;

    messagesDiv.appendChild(messageDiv);

    // Scroll al final
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

// ============================================
// ACTUALIZAR PANEL DE CONTACTO
// ============================================
function updateContactPanel() {
    if (!currentConversation) return;

    // Actualizar información del contacto en el panel derecho
    // En producción, actualizar dinámicamente
    console.log('📋 Actualizando panel de contacto');
}

// ============================================
// CONFIGURAR EVENT LISTENERS
// ============================================
function setupEventListeners() {
    // Enter en input de mensaje
    const messageInput = document.querySelector('input[placeholder="Escribe un mensaje..."]');
    if (messageInput) {
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
    }

    // Botón enviar
    const sendButton = messageInput?.parentElement?.querySelector('button.bg-green-500');
    if (sendButton) {
        sendButton.addEventListener('click', sendMessage);
    }

    // Búsqueda de conversaciones
    const searchInput = document.getElementById('searchConversations');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            filterConversations(e.target.value);
        });
    }

    // Click en conversaciones (delegación de eventos)
    const conversationsList = document.getElementById('conversationsList');
    if (conversationsList) {
        conversationsList.addEventListener('click', (e) => {
            const conversationDiv = e.target.closest('#conversationsList > div');
            if (conversationDiv) {
                const index = Array.from(conversationsList.children).indexOf(conversationDiv);
                if (conversations[index]) {
                    selectConversation(conversations[index].id);
                }
            }
        });
    }
}

// ============================================
// FILTRAR CONVERSACIONES
// ============================================
function filterConversations(searchTerm) {
    const term = searchTerm.toLowerCase();
    
    const allConvs = document.querySelectorAll('#conversationsList > div');
    allConvs.forEach((conv, index) => {
        const conversation = conversations[index];
        if (!conversation) return;

        const matchesSearch = 
            conversation.name.toLowerCase().includes(term) ||
            conversation.phone.includes(term) ||
            (conversation.lastMessage && conversation.lastMessage.toLowerCase().includes(term));

        conv.style.display = matchesSearch ? 'block' : 'none';
    });
}

// ============================================
// UTILIDADES
// ============================================
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================
// WEBSOCKET / TIEMPO REAL (FUTURO)
// ============================================
function setupRealtimeConnection() {
    // Aquí se configurará Socket.IO para mensajes en tiempo real
    console.log('🔌 Configuración de conexión en tiempo real pendiente');
}

// Auto-inicialización si es necesario
if (typeof window !== 'undefined') {
    console.log('📱 Módulo de conversaciones listo');
}
