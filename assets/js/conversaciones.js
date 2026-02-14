// CONVERSACIONES - JAVASCRIPT CON BACKEND REAL
// Sistema de chat en tiempo real estilo WhatsApp
// ============================================

console.log('✅ conversaciones.js cargado');

// Estado global (solo se inicializa una vez)
if (typeof window.conversacionesState === 'undefined') {
    window.conversacionesState = {
        attachedFile: null  // Solo usamos el estado global para attachedFile
    };
}

// Variables locales
let currentConversation = null;
let conversations = [];
let currentMessages = [];
let currentCompanyId = null;
let allMessages = [];
let selectedMessageToReply = null;
let messagesOrderReversed = false;
let isSending = false;

function renderAvatar(containerEl, { avatar_url, name, roundedClass }) {
  if (!containerEl) return;

  // ⛔ Si ya está renderizado el mismo avatar, no hacer nada
  const currentUrl = containerEl.getAttribute("data-avatar-url") || "";
  const newUrl = avatar_url || "";

  if (currentUrl === newUrl) {
    return; // 👈 evita repaint y flicker
  }

  // Guardar el avatar actual
  containerEl.setAttribute("data-avatar-url", newUrl);

  const initials = name
    ? name
        .trim()
        .split(/\s+/)
        .map(p => p[0])
        .join("")
        .substring(0, 2)
        .toUpperCase()
    : "—";

  // Limpiar
  containerEl.innerHTML = "";

  if (avatar_url) {
    containerEl.innerHTML = `
      <img 
        src="${avatar_url}" 
        class="w-full h-full object-cover ${roundedClass}" 
        alt="Avatar"
        loading="lazy"
      />
    `;
  } else {
    containerEl.innerHTML = `
      <div class="w-full h-full flex items-center justify-center bg-purple-500 text-white font-bold ${roundedClass}">
        ${initials}
      </div>
    `;
  }
}




// ============================================
// INICIALIZACIÓN
// ============================================
async function initConversacionesPage() {
    console.log('🚀 Inicializando página de conversaciones');
    
    // Prevenir doble inicialización
    if (window.ConversacionesModuleInitialized) {
        console.log('⚠️ Página ya inicializada, recargando datos...');
        if (window.conversacionesState.currentCompanyId) {
            await cargarConversacionesPorEmpresa(window.conversacionesState.currentCompanyId);
        }
        return;
    }

    // Verificar autenticación
    const token = getToken();
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    // Marcar como inicializado
    window.ConversacionesModuleInitialized = true;

    // Cargar empresas y conversaciones
    await cargarEmpresasYConversaciones();

    // Configurar event listeners
    setupConversacionesEventListeners();

    console.log('✅ Página de conversaciones inicializada');
}

// ============================================
// UI: ESTADO ENVIANDO (SPINNER + BLOQUEO)
// ============================================
function setSendingUI(sending) {
    const sendButton = document.getElementById('sendButton');
    const input = document.getElementById('messageInput');

    if (!sendButton) return;

    isSending = sending;

    if (sending) {
        sendButton.disabled = true;
        sendButton.innerHTML = `
            <i class="fas fa-spinner fa-spin mr-2"></i> Enviando...
        `;
        sendButton.classList.add('opacity-70', 'cursor-not-allowed');
        if (input) input.disabled = true;
    } else {
        sendButton.disabled = false;
        sendButton.innerHTML = `
            <i class="fas fa-paper-plane"></i>
        `;
        sendButton.classList.remove('opacity-70', 'cursor-not-allowed');
        if (input) input.disabled = false;
    }
}


// ============================================
// CARGAR EMPRESAS Y CONVERSACIONES
// ============================================
async function cargarEmpresasYConversaciones() {
    console.log('🔄 Cargando empresas y conversaciones...');

    try {
        const token = localStorage.getItem('token') || getToken();
        const response = await fetch(`${API_BASE_URL}/api/companies`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        const companies = data.companies || [];

        console.log(`✅ ${companies.length} empresas encontradas`);

        // Poblar selector de empresas
        poblarSelectorEmpresas(companies);

        if (companies.length === 0) {
            mostrarEstadoVacio('No hay empresas disponibles');
        }

    } catch (error) {
        console.error('❌ Error cargando empresas:', error);
        mostrarEstadoVacio('Error al cargar empresas');
    }
}

// ============================================
// POBLAR SELECTOR DE EMPRESAS
// ============================================
function poblarSelectorEmpresas(companies) {
    const select = document.getElementById('conversacionesCompanyFilter');
    if (!select) return;

    select.innerHTML = '<option value="">Selecciona una empresa</option>';
    
    companies.forEach(company => {
        const option = document.createElement('option');
        option.value = company.company_id;
        option.textContent = company.name || company.company_id;
        select.appendChild(option);
    });

    // Seleccionar la primera empresa por defecto
    if (companies.length > 0) {
        select.value = companies[0].company_id;
    }

    console.log(`✅ Selector poblado con ${companies.length} empresas`);
}

// ============================================
// CARGAR CONVERSACIONES POR EMPRESA
// ============================================
async function cargarConversacionesPorEmpresa(companyId) {
    console.log('🔄 Cargando conversaciones para empresa:', companyId);

    try {
        // ENDPOINT CORRECTO: /api/chat/conversations (el que sí existe en Render)
        const url = `${API_BASE_URL}/api/chat/conversations?company_id=${companyId}`;
        
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${getToken() || localStorage.getItem('token')}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('Error cargando conversaciones');
        }

        const conversations = await response.json();
        
        console.log(`✅ ${conversations.length} conversaciones cargadas del backend`);
        
        // Procesar conversaciones
        procesarConversaciones(conversations);

    } catch (error) {
        console.error('❌ Error cargando conversaciones:', error);
        mostrarEstadoVacio('Error al cargar conversaciones');
    }
}

// ============================================
// PROCESAR CONVERSACIONES
// ============================================
function procesarConversaciones(conversationsData) {
    console.log('🔧 Procesando conversaciones del backend:', conversationsData.length, 'items');
    
    conversations = conversationsData.map(conv => {
        const userName = conv.name || conv.user_id;
        
    return {
        id: conv.user_id,
        name: userName,
        phone: conv.user_id,
        avatar_url: conv.avatar_url || null,   // 👈 FUTURO: foto real
        color: getColorForUser(conv.user_id),
        status: 'offline',
        lastMessage: conv.last_message || '',
        time: formatTimestamp(conv.timestamp),
        unread: conv.unread || 0,
        blocked: conv.blocked || false,
        messages: []
    };

    });
    
    console.log(`✅ ${conversations.length} conversaciones procesadas`);
    renderConversations();
}

// ============================================
// CARGAR MENSAJES DE UNA CONVERSACIÓN ESPECÍFICA
// ============================================
async function cargarMensajesDeConversacion(userId) {
    console.log('📥 Cargando mensajes para usuario:', userId);
    
    try {
        const url = `${API_BASE_URL}/api/chat/conversations/${userId}?company_id=${currentCompanyId}`;
        
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${getToken() || localStorage.getItem('token')}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('Error cargando mensajes');
        }

        const data = await response.json();
        const messages = data.messages || [];
        
        // Mapear estructura del backend al formato esperado por el frontend
        return messages.map(msg => ({
            role: msg.direction === 'inbound' ? 'user' : 'assistant',
            sender_type: msg.direction === 'inbound' ? 'user' : 'assistant',
            content: msg.text || msg.content || '',
            text: msg.text || msg.content || '',
            timestamp: msg.timestamp,
            type: msg.type || 'text',
            cloudinary_url: msg.cloudinary_url || msg.media_url,
            cloudinary_id: msg.cloudinary_id,
            mime_type: msg.mime_type,
            message_id: msg.message_id || msg._id,
            responses: msg.responses || []
        }));
        
    } catch (error) {
        console.error('❌ Error cargando mensajes:', error);
        return [];
    }
}

// ============================================
// RENDERIZAR LISTA DE CONVERSACIONES
// ============================================

function renderConversations() {
    const container = document.getElementById('conversationsList');
    if (!container) return;

    container.innerHTML = '';

    if (conversations.length === 0) {
        container.innerHTML = `
            <div class="p-8 text-center text-gray-500">
                <i class="fas fa-inbox text-4xl mb-3"></i>
                <p>No hay conversaciones</p>
            </div>
        `;
        return;
    }

conversations.forEach((conv) => {
  const isActive = currentConversation && currentConversation.id === conv.id;

  const convDiv = document.createElement('div');
  convDiv.className = `border-b border-gray-100 ${
    isActive ? 'bg-gradient-to-r from-purple-50 to-white' : 'hover:bg-gray-50'
  } cursor-pointer transition-all rounded-2xl mx-2 my-0.5`;

  convDiv.onclick = () => selectConversation(conv.id, convDiv);

  convDiv.innerHTML = `
    <div class="p-2">
      <div class="flex items-center gap-3">
        <div class="relative flex-shrink-0">
          <!-- SOLO contenedor -->
          <div id="avatar-list-${conv.id}"
               class="w-11 h-11 rounded-2xl overflow-hidden shadow-md">
          </div>
        </div>

        <div class="flex-1 min-w-0">
          <div class="flex items-center justify-between mb-0.5">
            <h4 class="font-semibold text-gray-900 text-sm truncate">
              ${escapeHtml(conv.name)}
            </h4>
            <span class="text-xs text-gray-500">${conv.time || ''}</span>
          </div>
          <p class="text-xs text-gray-600 truncate">
            ${escapeHtml(conv.lastMessage || '')}
          </p>
        </div>
      </div>
    </div>
  `;

  container.appendChild(convDiv);

  // ✅ SIEMPRE renderizar avatar (imagen o letras)
  const avatarEl = document.getElementById(`avatar-list-${conv.id}`);
  renderAvatar(avatarEl, {
    avatar_url: conv.avatar_url,
    name: conv.name,
    roundedClass: "rounded-2xl"
  });
});

}

// ============================================
// ACTUALIZAR AVATAR DE UNA CONVERSACIÓN DESDE CONTACTS
// ============================================
function updateConversationAvatar(waId, avatarUrl) {
    if (!avatarUrl) return;

    const conv = conversations.find(c => c.id === waId);
    if (!conv) return;

    conv.avatar_url = avatarUrl;

    // Si es la conversación actual, actualizar header
    if (currentConversation && currentConversation.id === waId) {
        currentConversation.avatar_url = avatarUrl;
        updateChatHeader();
    }

    // Re-render lista izquierda
    //nderConversations();
    const avatarEl = document.getElementById(`avatar-list-${waId}`);
    if (avatarEl) {
    renderAvatar(avatarEl, {
        avatar_url: avatarUrl,
        name: conv.name,
        roundedClass: "rounded-2xl"
    });
    }
}

// Exponer globalmente
window.updateConversationAvatar = updateConversationAvatar;

// ============================================
// SELECCIONAR CONVERSACIÓN
// ============================================
async function selectConversation(userId, element) {
    console.log('📱 Seleccionando conversación:', userId);

    currentConversation = conversations.find(c => c.id === userId);

    
    if (!currentConversation) {
        console.warn('⚠️ Conversación no encontrada');
        return;
    }
    currentConversation._sourceElement = element;
    // Cargar mensajes del backend
    currentConversation.messages = await cargarMensajesDeConversacion(userId);
    
    // Actualizar UI
   //enderConversations(); // Re-renderizar para actualizar estado activo
    loadMessages();
    updateContactPanel();
    updateChatHeader();

        // 🔗 Notificar al módulo de contactos
    if (window.onConversationSelectedForContacts) {
        window.onConversationSelectedForContacts(
            currentConversation.id,      // wa_id
            currentConversation.phone,   // phone
            currentConversation.name,    // profile_name
            currentCompanyId             // company_id
        );
    }
}

// ============================================
// CARGAR MENSAJES DE LA CONVERSACIÓN ACTUAL
// ============================================
function loadMessages() {
    console.log('💬 Cargando mensajes para:', currentConversation.id);

    const chatContainer = document.getElementById('chatMessages');
    if (!chatContainer || !currentConversation) return;

    try {
        currentMessages = currentConversation.messages || [];
        console.log(`✅ ${currentMessages.length} mensajes cargados`);
        // ✅ Forzar orden WhatsApp al cargar mensajes
        messagesOrderReversed = false;
        renderMessages();
        
        // Scroll al final
        setTimeout(() => {
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }, 100);

    } catch (error) {
        console.error('❌ Error cargando mensajes:', error);
    }
}

// ============================================
// RENDERIZAR MENSAJES
// ============================================
function renderMessages() {
    const chatContainer = document.getElementById('chatMessages');
    if (!chatContainer) return;

    // Asegurar que el contenedor tiene scroll
    chatContainer.style.overflowY = 'auto';
    //chatContainer.style.maxHeight = 'calc(100vh - 300px)';

    let messagesDiv = chatContainer.querySelector('.space-y-4');
    if (!messagesDiv) {
        messagesDiv = document.createElement('div');
        messagesDiv.className = 'space-y-4 p-6';
        chatContainer.innerHTML = '';
        chatContainer.appendChild(messagesDiv);
    }

    messagesDiv.innerHTML = '';

    if (currentMessages.length === 0) {
        messagesDiv.innerHTML = `
            <div class="text-center py-8 text-gray-500">
                <i class="fas fa-comment-slash text-4xl mb-3"></i>
                <p>No hay mensajes en esta conversación</p>
            </div>
        `;
        return;
    }

    // Aplicar orden según configuración
    const messagesToRender = messagesOrderReversed 
        ? [...currentMessages].reverse() 
        : currentMessages;

    console.log('📊 === DEBUGGING MENSAJES ===');
    console.log('Total mensajes:', currentMessages.length);
    console.log('Orden:', messagesOrderReversed ? 'INVERTIDO (reciente arriba)' : 'NORMAL (reciente abajo)');
    messagesToRender.forEach((msg, idx) => {
        console.log(`${idx + 1}. ${msg.role} - "${(msg.content || msg.text || '').substring(0, 30)}" - ${msg.timestamp}`);
        if (msg.responses && msg.responses.length > 0) {
            console.log(`   └─ ${msg.responses.length} respuestas admin`);
        }
    });
    console.log('=========================');

    messagesToRender.forEach(msg => {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'mb-3';
        
        const isUser = msg.role === 'user' || msg.sender_type === 'user';
        const messageTime = formatTimestamp(msg.timestamp);
        
        // Contenido multimedia
        let mediaContent = '';
        if (msg.cloudinary_url) {
            mediaContent = renderMediaContent(msg);
        }

        const messageText = msg.content || msg.text || '';

        if (isUser) {
            // ======================================
            // MENSAJE DEL USUARIO (WhatsApp) - CLICKEABLE PARA RESPONDER
            // ======================================
            const isSelected = selectedMessageToReply && selectedMessageToReply.message_id === msg.message_id;
            
            // Guardar mensaje en un índice temporal para evitar problemas con JSON.stringify
            const msgIndex = messagesToRender.indexOf(msg);
            
            messageDiv.innerHTML = `
                <!-- Mensaje del usuario con icono - CLICKEABLE -->
                <div 
                    class="flex justify-end items-start gap-2 mb-2 cursor-pointer hover:opacity-80 transition ${isSelected ? 'ring-2 ring-purple-400 rounded-3xl' : ''}"
                    onclick="selectMessageByIndex(${msgIndex})"
                    title="Click para responder este mensaje"
                >
                    <div class="bg-purple-100 rounded-3xl rounded-tr-md px-4 py-3 max-w-md shadow-md">
                        ${mediaContent}
                        ${messageText ? `<p class="text-sm text-gray-800 whitespace-pre-wrap ${mediaContent ? 'mt-2' : ''}">${escapeHtml(messageText)}</p>` : ''}
                        <div class="flex items-center justify-end gap-2 mt-2">
                            <span class="text-xs text-gray-500">${messageTime}</span>
                            <i class="fas fa-check-double text-blue-500 text-xs"></i>
                        </div>
                    </div>
                    <div class="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0 shadow-sm">
                        <i class="fas fa-user text-white text-xs"></i>
                    </div>
                </div>

                ${renderResponses(msg)}
            `;
        } else {
            // ======================================
            // MENSAJE DEL ASISTENTE (Bot)
            // ======================================
            messageDiv.innerHTML = `
                <div class="flex justify-start items-start gap-2">
                    <div class="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0 shadow-sm">
                        <i class="fas fa-robot text-white text-xs"></i>
                    </div>
                    <div class="bg-white rounded-3xl rounded-tl-md px-4 py-3 max-w-md shadow-md border border-gray-100">
                        ${mediaContent}
                        ${messageText ? `<p class="text-sm text-gray-800 whitespace-pre-wrap ${mediaContent ? 'mt-2' : ''}">${escapeHtml(messageText)}</p>` : ''}
                        <span class="text-xs text-gray-500 mt-2 block">${messageTime}</span>
                    </div>
                </div>
            `;
        }
        
        messagesDiv.appendChild(messageDiv);
    });

    // Scroll al final
    setTimeout(() => {
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }, 100);
}

// ============================================
// ALTERNAR ORDEN DE MENSAJES
// ============================================
function toggleMessageOrder() {
    messagesOrderReversed = !messagesOrderReversed;
    
    const button = document.getElementById('toggleMessageOrder');
    const icon = button?.querySelector('i');
    
    if (messagesOrderReversed) {
        // Orden invertido (más reciente arriba)
        if (icon) {
            icon.className = 'fas fa-arrow-up-short-wide text-purple-600';
        }
        if (button) {
            button.title = 'Orden invertido: más recientes arriba';
        }
        console.log('📊 Orden invertido: más recientes arriba');
    } else {
        // Orden normal WhatsApp (más reciente abajo)
        if (icon) {
            icon.className = 'fas fa-arrow-down-short-wide text-gray-600 group-hover:text-purple-600';
        }
        if (button) {
            button.title = 'Orden WhatsApp: más recientes abajo';
        }
        console.log('📊 Orden WhatsApp: más recientes abajo');
    }
    
    // Re-renderizar mensajes con nuevo orden
    renderMessages();
}

// Hacer la función accesible globalmente
if (typeof window !== 'undefined') {
}

// ============================================
// MANEJAR SELECCIÓN DE ARCHIVO
// ============================================
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    console.log('📎 Archivo seleccionado:', file.name, file.type, file.size);
    
    // Validar tamaño (máximo 10MB)
    if (file.size > 10 * 1024 * 1024) {
        alert('El archivo es demasiado grande. Máximo 10MB.');
        return;
    }
    
    window.conversacionesState.attachedFile = file;
    showAttachmentPreview(file);
}

// ============================================
// MOSTRAR PREVIEW DEL ARCHIVO
// ============================================
function showAttachmentPreview(file) {
    const preview = document.getElementById('attachmentPreview');
    const content = document.getElementById('previewContent');
    
    if (!preview || !content) return;
    
    const type = file.type;
    const name = file.name;
    const size = (file.size / 1024).toFixed(1) + ' KB';
    
    let previewHTML = '';
    
    // IMAGEN
    if (type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
            content.innerHTML = `
                <div class="flex items-center gap-3">
                    <img src="${e.target.result}" class="w-16 h-16 rounded-lg object-cover" />
                    <div>
                        <p class="text-sm font-medium text-gray-900">${name}</p>
                        <p class="text-xs text-gray-500">${size}</p>
                    </div>
                </div>
            `;
        };
        reader.readAsDataURL(file);
    }
    // VIDEO
    else if (type.startsWith('video/')) {
        content.innerHTML = `
            <div class="flex items-center gap-3">
                <div class="w-16 h-16 rounded-lg bg-purple-100 flex items-center justify-center">
                    <i class="fas fa-video text-purple-600 text-2xl"></i>
                </div>
                <div>
                    <p class="text-sm font-medium text-gray-900">${name}</p>
                    <p class="text-xs text-gray-500">${size}</p>
                </div>
            </div>
        `;
    }
    // AUDIO
    else if (type.startsWith('audio/')) {
        content.innerHTML = `
            <div class="flex items-center gap-3">
                <div class="w-16 h-16 rounded-lg bg-green-100 flex items-center justify-center">
                    <i class="fas fa-microphone text-green-600 text-2xl"></i>
                </div>
                <div>
                    <p class="text-sm font-medium text-gray-900">${name}</p>
                    <p class="text-xs text-gray-500">${size}</p>
                </div>
            </div>
        `;
    }
    // DOCUMENTO
    else {
        const icon = type.includes('pdf') ? 'fa-file-pdf' : 
                     type.includes('word') ? 'fa-file-word' :
                     type.includes('excel') ? 'fa-file-excel' : 'fa-file';
        const color = type.includes('pdf') ? 'red' : 
                      type.includes('word') ? 'blue' :
                      type.includes('excel') ? 'green' : 'gray';
        
        content.innerHTML = `
            <div class="flex items-center gap-3">
                <div class="w-16 h-16 rounded-lg bg-${color}-100 flex items-center justify-center">
                    <i class="fas ${icon} text-${color}-600 text-2xl"></i>
                </div>
                <div>
                    <p class="text-sm font-medium text-gray-900">${name}</p>
                    <p class="text-xs text-gray-500">${size}</p>
                </div>
            </div>
        `;
    }
    
    preview.classList.remove('hidden');
}

// ============================================
// LIMPIAR ARCHIVO ADJUNTO
// ============================================
function clearAttachment() {
    window.conversacionesState.attachedFile = null;
    const preview = document.getElementById('attachmentPreview');
    const fileInput = document.getElementById('fileInput');
    
    if (preview) preview.classList.add('hidden');
    if (fileInput) fileInput.value = '';
    
    console.log('🗑️ Archivo eliminado');
}

// Hacer funciones accesibles globalmente
if (typeof window !== 'undefined') {
    window.handleFileSelect = handleFileSelect;
    window.clearAttachment = clearAttachment;
}

// ============================================
// RENDERIZAR RESPUESTAS MANUALES (ADMIN)
// ============================================
function renderResponses(msg) {
    if (!msg.responses || !Array.isArray(msg.responses) || msg.responses.length === 0) {
        return '';
    }

    return `
        <div class="space-y-2 mt-2">
            ${msg.responses.map(resp => {
                const respTime = formatTimestamp(resp.sent_at);
                const sentBy = resp.sent_by?.name || 'Admin';
                
                // Renderizar contenido multimedia si existe
                let mediaContent = '';
                if (resp.cloudinary_url) {
                    mediaContent = renderMediaContent({
                        cloudinary_url: resp.cloudinary_url,
                        type: resp.type,
                        mime_type: resp.mime_type,
                        content: resp.content || resp.text
                    });
                }
                
                return `
                    <div class="flex justify-end items-start gap-2">
                        <div class="bg-green-100 rounded-3xl rounded-tr-md px-4 py-3 max-w-md shadow-md">
                            ${mediaContent}
                            ${resp.text ? `<p class="text-sm text-gray-800 whitespace-pre-wrap ${mediaContent ? 'mt-2' : ''}">${escapeHtml(resp.text)}</p>` : ''}
                            <div class="flex items-center justify-end gap-2 mt-2">
                                <span class="text-xs text-gray-600">
                                    <i class="fas fa-user-shield"></i> ${escapeHtml(sentBy)}
                                </span>
                                <span class="text-xs text-gray-500">${respTime}</span>
                                <i class="fas fa-check-double text-green-600 text-xs"></i>
                            </div>
                        </div>
                        <div class="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center flex-shrink-0 shadow-sm">
                            <i class="fas fa-user-shield text-white text-xs"></i>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

// ============================================
// RENDERIZAR CONTENIDO MULTIMEDIA
// ============================================
function renderMediaContent(msg) {
    if (!msg.cloudinary_url) return '';
    
    const url = msg.cloudinary_url;
    const type = msg.type || '';
    const mimeType = msg.mime_type || '';
    
    // IMÁGENES
    if (type === 'image' || mimeType.startsWith('image/')) {
        const thumbnailUrl = url.includes('cloudinary.com') 
            ? url.replace('/upload/', '/upload/w_300,h_300,c_fill,q_auto/')
            : url;
            
        return `
                <img 
                    src="${thumbnailUrl}"
                    class="max-w-[180px] max-h-[180px] rounded-xl cursor-pointer hover:opacity-90 transition object-cover"
                    loading="lazy"
                    onclick="window.open('${url}', '_blank')"
                    alt="Imagen"
                />
            `;
    }
    
    // AUDIO
    if (type === 'audio' || mimeType.startsWith('audio/')) {
        return `
            <div class="bg-gray-50 rounded-xl p-3">
                <div class="flex items-center gap-2 mb-2">
                    <i class="fas fa-microphone text-purple-600"></i>
                    <span class="text-xs font-medium text-gray-700">Audio</span>
                </div>
                <audio controls class="w-full" style="height: 32px;">
                    <source src="${url}" type="${mimeType}">
                </audio>
            </div>
        `;
    }
    
    // VIDEO
    if (type === 'video' || mimeType.startsWith('video/')) {
        return `
            <div class="bg-gray-50 rounded-xl p-2">
                <video controls class="max-w-[220px] max-h-[180px] rounded-lg">
                    <source src="${url}" type="${mimeType}">
                </video>
            </div>
        `;
    }
    
    // DOCUMENTOS Y OTROS
    const fileInfo = getFileInfo(type, mimeType);
    return `
        <a 
            href="${url}" 
            target="_blank"
            class="flex items-center gap-3 bg-gray-50 hover:bg-gray-100 rounded-xl p-3 transition group"
        >
            <div class="w-10 h-10 rounded-lg ${fileInfo.bgColor} flex items-center justify-center">
                <i class="${fileInfo.icon} ${fileInfo.iconColor}"></i>
            </div>
            <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-gray-900 truncate">${fileInfo.label}</p>
                <p class="text-xs text-gray-500">Click para abrir</p>
            </div>
            <i class="fas fa-external-link-alt text-gray-400 group-hover:text-purple-600 text-sm"></i>
        </a>
    `;
}

// ============================================
// OBTENER INFO DE ARCHIVO
// ============================================
function getFileInfo(type, mimeType) {
    const defaults = {
        icon: 'fas fa-file',
        iconColor: 'text-gray-600',
        bgColor: 'bg-gray-100',
        label: 'Documento'
    };
    
    if (type === 'document' || mimeType.includes('pdf')) {
        return {
            icon: 'fas fa-file-pdf',
            iconColor: 'text-red-600',
            bgColor: 'bg-red-100',
            label: 'PDF'
        };
    }
    
    if (mimeType.includes('word') || mimeType.includes('document')) {
        return {
            icon: 'fas fa-file-word',
            iconColor: 'text-blue-600',
            bgColor: 'bg-blue-100',
            label: 'Word'
        };
    }
    
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) {
        return {
            icon: 'fas fa-file-excel',
            iconColor: 'text-green-600',
            bgColor: 'bg-green-100',
            label: 'Excel'
        };
    }
    
    if (mimeType.includes('zip') || mimeType.includes('rar')) {
        return {
            icon: 'fas fa-file-archive',
            iconColor: 'text-yellow-600',
            bgColor: 'bg-yellow-100',
            label: 'Archivo'
        };
    }
    
    return defaults;
}

// ============================================
// FORMATEAR TIMESTAMP
// ============================================
function formatTimestamp(timestamp) {
    if (!timestamp) return '';
    
    try {
        const date = new Date(timestamp);
        const now = new Date();
        
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        
        // Si es hoy, solo mostrar hora
        const isToday = date.toDateString() === now.toDateString();
        if (isToday) {
            return `${hours}:${minutes}`;
        }
        
        // Si no, mostrar fecha corta
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        return `${day}/${month} ${hours}:${minutes}`;
    } catch (e) {
        return '';
    }
}

// ============================================
// ACTUALIZAR HEADER DEL CHAT
// ============================================
function updateChatHeader() {
  if (!currentConversation) return;

  const headerAvatar = document.getElementById("chatHeaderAvatar");
  const headerName = document.getElementById("chatHeaderName");
  const headerPhone = document.getElementById("chatHeaderPhone");

  const name = currentConversation.name || "—";
  const phone = currentConversation.phone || "—";

  if (headerName) headerName.textContent = name;
  if (headerPhone) headerPhone.textContent = phone;

  renderAvatar(headerAvatar, {
    avatar_url: currentConversation.avatar_url,
    name: name,
    roundedClass: "rounded-2xl"
  });
}





// ============================================
// ACTUALIZAR PANEL DE CONTACTO
// ============================================
function updateContactPanel() {
    if (!currentConversation) return;

    // Header del panel de contacto (derecha)
    const nameEl = document.getElementById("contactHeaderName");
    const avatarEl = document.getElementById("contactHeaderAvatar");
    const phoneEl = document.getElementById("contactPhone"); // ya lo tienes en la sección Contacto

    const name = currentConversation.name || "Sin nombre";
    const phone = currentConversation.phone || "";

        // Ejemplo futuro acá injectar datos reales
    // const stars = currentConversation.stars || 5;
    // const plan = currentConversation.plan || "Premium";

    if (nameEl) nameEl.textContent = name;
    if (phoneEl) phoneEl.textContent = phone;

    if (avatarEl) {
    renderAvatar(avatarEl, {
        avatar_url: currentConversation.avatar_url,
        name: name,
        roundedClass: "rounded-xl"
    });
    }


}



// ============================================
// SELECCIONAR MENSAJE PARA RESPONDER
// ============================================
function selectMessageToReply(message) {
    selectedMessageToReply = message;
    console.log('✅ Mensaje seleccionado para responder:', message.message_id);
    console.log('📝 Contenido:', message.content || message.text);
    
    // Re-renderizar para mostrar el mensaje seleccionado
    renderMessages();
    
    // Habilitar input y botón
    const input = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendButton');
    
    if (input) {
        input.disabled = false;
        input.focus();
        const preview = (message.content || message.text || '').substring(0, 30);
        input.placeholder = `Respondiendo a: "${preview}..."`;
        console.log('✅ Input habilitado');
    }
    
    if (sendButton) {
        sendButton.disabled = false;
        sendButton.classList.remove('bg-gradient-to-r', 'from-gray-300', 'to-gray-400', 'cursor-not-allowed');
        sendButton.classList.add('bg-gradient-to-r', 'from-green-500', 'to-green-600', 'hover:from-green-600', 'hover:to-green-700', 'cursor-pointer', 'hover:shadow-lg');
        sendButton.title = 'Enviar respuesta';
        console.log('✅ Botón habilitado');
    }
}

// ============================================
// SELECCIONAR MENSAJE POR ÍNDICE (versión simple que funciona)
// ============================================
function selectMessageByIndex(index) {
    const messagesToRender = messagesOrderReversed 
        ? [...currentMessages].reverse() 
        : currentMessages;
    
    const message = messagesToRender[index];
    
    if (!message) return;
    
    // TOGGLE: Si el mensaje ya está seleccionado, deseleccionar
    if (selectedMessageToReply && selectedMessageToReply.message_id === message.message_id) {
        console.log('🔄 Mismo mensaje clickeado - deseleccionando');
        deselectMessage();
    } else {
        // Seleccionar nuevo mensaje
        selectMessageToReply(message);
    }
}

// Hacer la función accesible globalmente
if (typeof window !== 'undefined') {
}

// ============================================
// ENVIAR MENSAJE
// ============================================
async function sendMessage() {
    if (isSending) {
        console.warn('⏳ Ya se está enviando un mensaje...');
        return;
    }
    setSendingUI(true);
    console.log('🚀 sendMessage() llamada');
    
    const input = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendButton');
    
    if (!input) {
        console.error('❌ No se encontró el input');
        alert('Error: No se encontró el campo de texto');
        return;
    }

    const message = input.value.trim();

    if (!message && !window.conversacionesState.attachedFile) {
        alert('Debes escribir un mensaje o adjuntar un archivo');
        return;
    }
    
    if (!currentConversation) return;
    if (!selectedMessageToReply) {
        alert('Por favor, selecciona un mensaje del usuario para responder');
        return;
    }

    try {
        // 🔒 Activar UI de envío
        setSendingUI(true);

        const adminResponse = {
            text: message,
            sent_at: new Date().toISOString(),
            sent_by: { user_id: 'current_admin', name: 'Super Admin' }
        };

        const fileToSend = window.conversacionesState.attachedFile;

        const messageToUpdate = currentMessages.find(m => m.message_id === selectedMessageToReply.message_id);
        if (!messageToUpdate) throw new Error('Mensaje no encontrado');

        if (!messageToUpdate.responses) messageToUpdate.responses = [];
        messageToUpdate.responses.push(adminResponse);

        selectedMessageToReply = null;
        input.value = '';
        renderMessages();
       //enderConversations();

        // ENVIAR AL BACKEND
        const formData = new FormData();
        formData.append('text', message || '');

        if (fileToSend) {
            formData.append('file', fileToSend);
        }

        const endpoint = `${API_BASE_URL}/api/chat/messages/${messageToUpdate.message_id}/reply`;


        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${getToken()}`
            },
            body: formData
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(err);
        }

        const result = await response.json();

        if (result.success) {
            clearAttachment();

            const freshMessages = await cargarMensajesDeConversacion(currentConversation.id);
            currentConversation.messages = freshMessages;
            loadMessages();
            await cargarConversacionesPorEmpresa(currentCompanyId);
            setSendingUI(false);
        } else {
            throw new Error(result.error || 'Error desconocido');
        }

        // ✅ Apagar UI enviando
        setSendingUI(false);

    } catch (error) {
        console.error('❌ Error enviando mensaje:', error);
        alert('Error al enviar el mensaje: ' + error.message);
        setSendingUI(false);
        clearAttachment();
    }
}
// ============================================
// CONFIGURAR EVENT LISTENERS
// ============================================
function setupConversacionesEventListeners() {
    console.log('🔧 Configurando event listeners...');

    // Cambio de empresa
    const companySelect = document.getElementById('conversacionesCompanyFilter');
    if (companySelect) {
        companySelect.addEventListener('change', async (e) => {
            const companyId = e.target.value;
            if (companyId) {
                currentCompanyId = companyId;
                await cargarConversacionesPorEmpresa(companyId);
            }
        });
    }

    // Búsqueda de conversaciones
    const searchInput = document.getElementById('searchConversations');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            filterConversations(e.target.value);
        });
    }

    console.log('✅ Event listeners configurados');
}

// ============================================
// DESELECCIONAR MENSAJE
// ============================================
function deselectMessage() {
    if (!selectedMessageToReply) return;
    
    selectedMessageToReply = null;
    console.log('❌ Mensaje deseleccionado');
    
    // Deshabilitar input y botón
    const input = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendButton');
    
    if (input) {
        input.disabled = true;
        input.value = '';
        input.placeholder = 'Selecciona un mensaje para responder...';
    }
    
    if (sendButton) {
        sendButton.disabled = true;
        sendButton.classList.remove('bg-gradient-to-r', 'from-green-500', 'to-green-600', 'hover:from-green-600', 'hover:to-green-700', 'cursor-pointer', 'hover:shadow-lg');
        sendButton.classList.add('bg-gradient-to-r', 'from-gray-300', 'to-gray-400', 'cursor-not-allowed');
        sendButton.title = 'Selecciona un mensaje del usuario para responder';
    }
    
    // Limpiar archivo adjunto si hay
    clearAttachment();
    
    // Re-renderizar para quitar el highlight
    renderMessages();
}

// Hacer la función accesible globalmente
if (typeof window !== 'undefined') {
}

// ============================================
// FILTRAR CONVERSACIONES
// ============================================
function filterConversations(searchTerm) {
    const term = searchTerm.toLowerCase().trim();
    
    if (!term) {
        renderConversations();
        return;
    }

    const filtered = conversations.filter(conv => 
        conv.name.toLowerCase().includes(term) ||
        conv.phone.includes(term) ||
        conv.lastMessage.toLowerCase().includes(term)
    );

    // Guardar conversaciones originales
    const temp = conversations;
    conversations = filtered;
    renderConversations();
    conversations = temp;
}

// ============================================
// MOSTRAR ESTADO VACÍO
// ============================================
function mostrarEstadoVacio(mensaje) {
    const container = document.getElementById('conversationsList');
    if (container) {
        container.innerHTML = `
            <div class="p-8 text-center text-gray-500">
                <i class="fas fa-inbox text-4xl mb-3"></i>
                <p>${mensaje}</p>
            </div>
        `;
    }
}

// ============================================
// UTILIDADES
// ============================================
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getInitials(name) {
    if (!name) return '??';
    const parts = name.trim().split(' ').filter(p => p.length > 0);
    if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
}

function getColorForUser(userId) {
    const colors = ['purple', 'blue', 'green', 'orange', 'pink', 'indigo', 'red', 'yellow'];
    const hash = (userId || '').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
}

function formatTime(timestamp) {
    if (!timestamp) return '';
    
    try {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        
        // Si es hoy, mostrar hora
        if (diff < 24 * 60 * 60 * 1000) {
            return date.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
        }
        
        // Si es esta semana, mostrar día
        if (diff < 7 * 24 * 60 * 60 * 1000) {
            const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
            return days[date.getDay()];
        }
        
        // Si no, mostrar fecha
        return date.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' });
    } catch (e) {
        return '';
    }
}

function getMessagePreview(msg) {
    if (!msg) return '';
    if (msg.text) return msg.text;
    if (msg.type === 'image') return '📷 Imagen';
    if (msg.type === 'document') return '📄 Documento';
    if (msg.type === 'audio') return '🎤 Audio';
    if (msg.type === 'video') return '🎥 Video';
    return 'Mensaje';
}
function toggleLeftSection(sectionId) {
    const section = document.getElementById(sectionId);
    const icon = document.getElementById(sectionId + 'Icon');

    if (!section || !icon) return;

    const isHidden = section.classList.contains('hidden');

    if (isHidden) {
        section.classList.remove('hidden');
        icon.classList.remove('fa-chevron-right');
        icon.classList.add('fa-chevron-down');
    } else {
        section.classList.add('hidden');
        icon.classList.remove('fa-chevron-down');
        icon.classList.add('fa-chevron-right');
    }
}
function toggleRightSection(sectionId) {
    const section = document.getElementById(sectionId);
    const icon = document.getElementById(sectionId + 'Icon');

    if (!section || !icon) return;

    const isHidden = section.classList.contains('hidden');

    if (isHidden) {
        section.classList.remove('hidden');
        icon.classList.remove('fa-chevron-right');
        icon.classList.add('fa-chevron-down');
    } else {
        section.classList.add('hidden');
        icon.classList.remove('fa-chevron-down');
        icon.classList.add('fa-chevron-right');
    }
}

window.toggleRightSection = toggleRightSection;

window.toggleLeftSection = toggleLeftSection;

// Auto-inicialización
console.log('📱 Módulo de conversaciones listo');

// ============================================
// EXPONER FUNCIONES GLOBALMENTE
// ============================================
window.initConversacionesPage = initConversacionesPage;
window.sendMessage = sendMessage;
window.selectMessageByIndex = selectMessageByIndex;
window.selectMessageToReply = selectMessageToReply;
window.deselectMessage = deselectMessage;
window.toggleMessageOrder = toggleMessageOrder;
window.handleFileSelect = handleFileSelect;
window.clearAttachment = clearAttachment;