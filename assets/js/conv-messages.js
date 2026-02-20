// ============================================
// CONV-MESSAGES.JS — Carga, envío, selección de mensajes
// Archivos adjuntos, grabación de audio
// ============================================

console.log('✅ conv-messages.js cargado');

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
        sendButton.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i> Enviando...`;
        sendButton.classList.add('opacity-70', 'cursor-not-allowed');
        if (input) input.disabled = true;
    } else {
        sendButton.disabled = false;
        sendButton.innerHTML = `<i class="fas fa-paper-plane"></i>`;
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

        poblarSelectorEmpresas(companies);

        if (companies.length === 0) {
            mostrarEstadoVacio('No hay empresas disponibles');
        }

    } catch (error) {
        console.error('❌ Error cargando empresas:', error);
        mostrarEstadoVacio('Error al cargar empresas');
    }
}

function poblarSelectorEmpresas(companies) {
    const select = document.getElementById('conversacionesCompanyFilter');
    if (!select) return;

    select.innerHTML = '<option value="">Seleccione una empresa</option>';

    companies.forEach(company => {
        const option = document.createElement('option');
        option.value = company.company_id;
        option.textContent = company.name || company.company_id;
        select.appendChild(option);
    });

    console.log(`✅ Selector de empresas poblado con ${companies.length} empresas`);
    mostrarEstadoSinEmpresaSeleccionada();
}

// ============================================
// CARGAR CONVERSACIONES POR EMPRESA
// ============================================
async function cargarConversacionesPorEmpresa(companyId) {
    console.log('🔄 Cargando conversaciones para empresa:', companyId);

    try {
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

        const convData = await response.json();

        console.log(`✅ ${convData.length} conversaciones cargadas del backend`);
        procesarConversaciones(convData);

    } catch (error) {
        console.error('❌ Error cargando conversaciones:', error);
        mostrarEstadoVacio('Error al cargar conversaciones');
    }
}

function procesarConversaciones(conversationsData) {
    console.log('🔧 Procesando conversaciones del backend:', conversationsData.length, 'items');

    conversations = conversationsData.map(conv => {
        const userName = conv.name || conv.user_id;

        return {
            id: conv.user_id,
            name: userName,
            phone: conv.user_id,
            avatar_url: conv.avatar_url || null,
            tag: { color: getColorForUser(conv.user_id), label: 'auto' },
            unread: conv.unread || 0,
            status: 'offline',
            lastMessage: conv.last_message || '',
            time: formatTimestamp(conv.timestamp),
            blocked: conv.blocked || false,
            ia_enabled: conv.ia_enabled !== false,
            has_unanswered: conv.has_unanswered || false,
            tags: conv.tags || [],
            plan: conv.plan || '',
            rating: conv.rating || 0,
            messages: []
        };
    });

    console.log(`✅ ${conversations.length} conversaciones procesadas`);
    if (window.isSendingMessage) {
    console.log("⏸️ Skip render: enviando mensaje");
    return;
}
    // 🧠 Importante: SOLO una fuente de render
    
    if (typeof applyAllFilters === "function") {
        applyAllFilters();   // 👈 esto ya renderiza y actualiza contadores
    } else {
        renderConversations();
        updateFilterCounts();
    }

    // Esto sí puede quedarse aquí si depende del total
    buildTagFilters();
}
// ============================================
// MARCAR CONVERSACIÓN COMO LEÍDA
// ============================================
async function markConversationAsRead(userId, companyId) {
    try {
        const url = `${API_BASE_URL}/api/chat/conversations/${userId}/read?company_id=${companyId}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${getToken()}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const data = await response.json();
            console.log(`✅ ${data.marked_count || 0} mensajes marcados como leídos`);
        }
    } catch (e) {
        console.warn('⚠️ Error marcando como leído:', e);
    }
}

// ============================================
// CARGAR MENSAJES DE UNA CONVERSACIÓN
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
// SELECCIONAR CONVERSACIÓN
// ============================================
async function selectConversation(userId, element) {
    console.log('📱 Seleccionando conversación:', userId);

    currentConversation = conversations.find(c => c.id === userId);

    if (!currentConversation) {
        console.warn('⚠️ Conversación no encontrada');
        return;
    }

    mostrarChatActivo();

    // ✅ Mostrar panel derecho de contacto
    if (typeof showContactPanel === "function") {
        showContactPanel();
    }


    currentConversation._sourceElement = element;

    currentConversation.messages = await cargarMensajesDeConversacion(userId);

    loadMessages();
    updateContactPanel();
    updateChatHeader();

    if (currentConversation.unread > 0) {
        currentConversation.unread = 0;
        renderConversations();
        markConversationAsRead(userId, currentCompanyId);
    }

    loadIAStatus(userId, currentCompanyId);

    if (window.onConversationSelectedForContacts) {
        window.onConversationSelectedForContacts(
            currentConversation.id,
            currentConversation.phone,
            currentConversation.name,
            currentCompanyId
        );
    }
}

// ============================================
// CARGAR MENSAJES EN CHAT
// ============================================
function loadMessages() {
    console.log('💬 Cargando mensajes para:', currentConversation.id);

    const chatContainer = document.getElementById('chatMessages');
    if (!chatContainer || !currentConversation) return;

    try {
        currentMessages = currentConversation.messages || [];
        console.log(`✅ ${currentMessages.length} mensajes cargados`);
        messagesOrderReversed = false;
        renderMessages();

        setTimeout(() => {
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }, 100);

    } catch (error) {
        console.error('❌ Error cargando mensajes:', error);
    }
}

// ============================================
// SELECCIONAR MENSAJE PARA RESPONDER
// ============================================
function selectMessageToReply(message) {
    selectedMessageToReply = message;
    console.log('✅ Mensaje seleccionado para responder:', message.message_id);

    renderMessages();

    const input = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendButton');

    if (input) {
        input.disabled = false;
        input.focus();
        const preview = (message.content || message.text || '').substring(0, 30);
        input.placeholder = `Respondiendo a: "${preview}..."`;
    }

    if (sendButton) {
        sendButton.disabled = false;
        sendButton.classList.remove('bg-gradient-to-r', 'from-gray-300', 'to-gray-400', 'cursor-not-allowed');
        sendButton.classList.add('bg-gradient-to-r', 'from-green-500', 'to-green-600', 'hover:from-green-600', 'hover:to-green-700', 'cursor-pointer', 'hover:shadow-lg');
        sendButton.title = 'Enviar respuesta';
    }
}

function selectMessageByIndex(index) {
    const messagesToRender = messagesOrderReversed
        ? [...currentMessages].reverse()
        : currentMessages;

    const message = messagesToRender[index];
    if (!message) return;

    if (selectedMessageToReply && selectedMessageToReply.message_id === message.message_id) {
        deselectMessage();
    } else {
        selectMessageToReply(message);
    }
}

function deselectMessage() {
    if (!selectedMessageToReply) return;

    selectedMessageToReply = null;
    console.log('❌ Mensaje deseleccionado');

    renderMessages();

    const input = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendButton');

    if (input) {
        input.placeholder = 'Escribe un mensaje...';
    }

    if (sendButton) {
        sendButton.classList.remove('from-green-500', 'to-green-600', 'hover:from-green-600', 'hover:to-green-700');
        sendButton.classList.add('from-purple-500', 'to-purple-600');
    }
}

// ============================================
// ENVIAR MENSAJE
// ============================================
async function sendMessage() {
    if (isSending) {
        console.warn('⏳ Ya se está enviando un mensaje...');
        return;
    }

    const input = document.getElementById('messageInput');
    if (!input) return;

    const message = input.value.trim();
    const hasFile = !!window.conversacionesState.attachedFile;
    const hasAudio = !!window.conversacionesState.recordedAudio;

    if (!message && !hasFile && !hasAudio) {
        showMessageError('Debes escribir un mensaje o adjuntar un archivo');
        return;
    }

    if (!currentConversation) {
        showMessageError('No hay conversación seleccionada');
        return;
    }

    if (!selectedMessageToReply) {
        const lastUserMsg = [...currentMessages].reverse().find(m => m.role === 'user');
        if (lastUserMsg) {
            selectedMessageToReply = lastUserMsg;
        } else {
            showMessageError('No hay mensajes del usuario para responder');
            return;
        }
    }

    hideMessageError();
    isSending = true;
    setSendingUI(true);

    try {
        const adminResponse = {
            text: message,
            sent_at: new Date().toISOString(),
            sent_by: { user_id: 'current_admin', name: 'Super Admin' }
        };

        const fileToSend = window.conversacionesState.attachedFile;
        const audioToSend = window.conversacionesState.recordedAudio;

        const messageToUpdate = currentMessages.find(
            m => m.message_id === selectedMessageToReply.message_id
        );
        if (!messageToUpdate) throw new Error('Mensaje no encontrado');

        if (!messageToUpdate.responses) messageToUpdate.responses = [];
        messageToUpdate.responses.push(adminResponse);

        selectedMessageToReply = null;
        input.value = '';
        renderMessages();

        const formData = new FormData();
        formData.append('text', message || '');

        if (fileToSend) {
            formData.append('file', fileToSend);
        } else if (audioToSend) {
            const ext = window.conversacionesState.audioExtension || 'ogg';
            formData.append('file', audioToSend, `audio_message.${ext}`);
        }

        const endpoint = `${API_BASE_URL}/api/chat/messages/${messageToUpdate.message_id}/reply`;

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${getToken()}` },
            body: formData
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(err);
        }

        const result = await response.json();

        if (!result.success) {
            throw new Error(result.error || 'Error desconocido');
        }

        clearAttachment();
        clearAudioRecording();
        const freshMessages = await cargarMensajesDeConversacion(currentConversation.id);
        currentConversation.messages = freshMessages;
        loadMessages();
        await cargarConversacionesPorEmpresa(currentCompanyId);

    } catch (error) {
        console.error('❌ Error enviando mensaje:', error);
        showMessageError('Error al enviar el mensaje: ' + error.message);
        clearAttachment();
    } finally {
        isSending = false;
        setSendingUI(false);
    }
}

// ============================================
// MANEJAR ARCHIVOS ADJUNTOS
// ============================================
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
        alert('El archivo es demasiado grande. Máximo 10MB.');
        return;
    }

    window.conversacionesState.attachedFile = file;
    showAttachmentPreview(file);
}

function showAttachmentPreview(file) {
    const preview = document.getElementById('attachmentPreview');
    const content = document.getElementById('previewContent');
    if (!preview || !content) return;

    const type = file.type;
    const name = file.name;
    const size = (file.size / 1024).toFixed(1) + ' KB';

    if (type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
            content.innerHTML = `<div class="flex items-center gap-3"><img src="${e.target.result}" class="w-16 h-16 rounded-lg object-cover" /><div><p class="text-sm font-medium text-gray-900">${name}</p><p class="text-xs text-gray-500">${size}</p></div></div>`;
        };
        reader.readAsDataURL(file);
    } else if (type.startsWith('video/')) {
        content.innerHTML = `<div class="flex items-center gap-3"><div class="w-16 h-16 rounded-lg bg-purple-100 flex items-center justify-center"><i class="fas fa-video text-purple-600 text-2xl"></i></div><div><p class="text-sm font-medium text-gray-900">${name}</p><p class="text-xs text-gray-500">${size}</p></div></div>`;
    } else if (type.startsWith('audio/')) {
        content.innerHTML = `<div class="flex items-center gap-3"><div class="w-16 h-16 rounded-lg bg-green-100 flex items-center justify-center"><i class="fas fa-microphone text-green-600 text-2xl"></i></div><div><p class="text-sm font-medium text-gray-900">${name}</p><p class="text-xs text-gray-500">${size}</p></div></div>`;
    } else {
        const icon = type.includes('pdf') ? 'fa-file-pdf' : type.includes('word') ? 'fa-file-word' : type.includes('excel') ? 'fa-file-excel' : 'fa-file';
        const color = type.includes('pdf') ? 'red' : type.includes('word') ? 'blue' : type.includes('excel') ? 'green' : 'gray';
        content.innerHTML = `<div class="flex items-center gap-3"><div class="w-16 h-16 rounded-lg bg-${color}-100 flex items-center justify-center"><i class="fas ${icon} text-${color}-600 text-2xl"></i></div><div><p class="text-sm font-medium text-gray-900">${name}</p><p class="text-xs text-gray-500">${size}</p></div></div>`;
    }

    preview.classList.remove('hidden');
}

function clearAttachment() {
    window.conversacionesState.attachedFile = null;
    const preview = document.getElementById('attachmentPreview');
    const fileInput = document.getElementById('fileInput');
    if (preview) preview.classList.add('hidden');
    if (fileInput) fileInput.value = '';
}

// ============================================
// 🎤 GRABACIÓN DE AUDIO
// ============================================
let mediaRecorder = null;
let audioChunks = [];
let recordingTimer = null;
const MAX_RECORDING_SECONDS = 120;

async function startRecording() {
    try {
        clearAudioRecording();

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

        let mimeType = 'audio/ogg;codecs=opus';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = 'audio/mp4';
        }
        if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = 'audio/webm;codecs=opus';
        }

        const fileExtension = mimeType.includes('ogg') ? 'ogg'
            : mimeType.includes('mp4') ? 'mp4'
            : 'webm';

        window.conversacionesState.audioExtension = fileExtension;
        window.conversacionesState.audioMimeType = mimeType;

        mediaRecorder = new MediaRecorder(stream, { mimeType });
        audioChunks = [];

        mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) audioChunks.push(e.data);
        };

        mediaRecorder.onstop = () => {
            stream.getTracks().forEach(t => t.stop());

            if (audioChunks.length === 0) return;

            const blob = new Blob(audioChunks, { type: mimeType });
            window.conversacionesState.recordedAudio = blob;

            const player = document.getElementById('audioPlayer');
            const preview = document.getElementById('audioPreview');
            if (player && preview) {
                player.src = URL.createObjectURL(blob);
                preview.classList.remove('hidden');
                preview.classList.add('flex');
            }

            const micBtn = document.getElementById('micButton');
            if (micBtn) micBtn.classList.add('hidden');

            console.log(`🎤 Audio grabado: ${(blob.size / 1024).toFixed(1)} KB`);
        };

        mediaRecorder.start();

        const indicator = document.getElementById('recordingIndicator');
        const micIcon = document.getElementById('micIcon');
        if (indicator) { indicator.classList.remove('hidden'); indicator.classList.add('flex'); }
        if (micIcon) micIcon.className = 'fas fa-microphone text-red-500 text-sm animate-pulse';

        recordingTimer = setTimeout(() => stopRecording(), MAX_RECORDING_SECONDS * 1000);

        console.log('🎤 Grabando audio...');

    } catch (err) {
        console.error('❌ Error accediendo al micrófono:', err);
        showMessageError('No se pudo acceder al micrófono. Verifica los permisos.');
    }
}

function stopRecording() {
    if (recordingTimer) { clearTimeout(recordingTimer); recordingTimer = null; }

    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
    }

    const indicator = document.getElementById('recordingIndicator');
    const micIcon = document.getElementById('micIcon');
    if (indicator) { indicator.classList.add('hidden'); indicator.classList.remove('flex'); }
    if (micIcon) micIcon.className = 'fas fa-microphone text-gray-400 group-hover:text-purple-500 text-sm';
}

function clearAudioRecording() {
    window.conversacionesState.recordedAudio = null;
    audioChunks = [];

    const player = document.getElementById('audioPlayer');
    const preview = document.getElementById('audioPreview');
    const micBtn = document.getElementById('micButton');

    if (player) { player.src = ''; player.pause(); }
    if (preview) { preview.classList.add('hidden'); preview.classList.remove('flex'); }
    if (micBtn) micBtn.classList.remove('hidden');
}

// ============================================
// TOGGLE IA POR CONVERSACIÓN
// ============================================
let currentIAEnabled = true;

async function loadIAStatus(userId, companyId) {
    try {
        const url = `${API_BASE_URL}/api/chat/conversations/${userId}/ia?company_id=${companyId}`;
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${getToken()}` }
        });

        if (response.ok) {
            const data = await response.json();
            currentIAEnabled = data.ia_enabled !== false;
        } else {
            currentIAEnabled = true;
        }
    } catch (e) {
        currentIAEnabled = true;
    }

    // ✅ Sincronizar estado real con la conversación actual y la lista global
    if (currentConversation && currentConversation.id === userId) {
        currentConversation.ia_enabled = currentIAEnabled;
    }
    const idx = conversations.findIndex(c => c.id === userId);
    if (idx !== -1 && conversations[idx].ia_enabled !== currentIAEnabled) {
        conversations[idx].ia_enabled = currentIAEnabled;
        // Actualizar contadores de filtros
        if (typeof updateFilterCounts === "function") {
            updateFilterCounts();
        }
    }

    updateIAToggleUI();
}

async function toggleIAForConversation() {
    if (!currentConversation || !currentCompanyId) return;

    const newState = !currentIAEnabled;

    try {
        const url = `${API_BASE_URL}/api/chat/conversations/${currentConversation.id}/ia?company_id=${currentCompanyId}`;
        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${getToken()}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ enabled: newState })
        });

        if (response.ok) {
            currentIAEnabled = newState;
            updateIAToggleUI();

            // ✅ 1) Actualizar conversación actual
            if (currentConversation) {
                currentConversation.ia_enabled = newState;
            }

            // ✅ 2) Actualizar también en la lista del estado global
            if (window.conversacionesAPI && typeof window.conversacionesAPI.getState === "function") {
                const state = window.conversacionesAPI.getState();
                const list = state.conversations || [];
                const idx = list.findIndex(c => c.id === currentConversation.id);
                if (idx !== -1) {
                    list[idx].ia_enabled = newState;
                }
            }

            // ✅ 3) Re-render de la lista
            if (typeof renderConversations === "function") {
                renderConversations();
            }

            // 🔽 🔽 🔽 ESTE ES EL CAMBIO QUE FALTABA 🔽 🔽 🔽
            // ✅ 4) Recalcular contadores de filtros
            if (typeof window.updateFilterCounts === "function") {
                window.updateFilterCounts();
            }

            if (newState) {
                showSystemBubble("🤖 La IA ha sido activada para esta conversación.");
            } else {
                showSystemBubble("⚠️ La IA ha sido desactivada. Las respuestas serán manuales.");
            }

            console.log("🤖 IA actualizada:", currentConversation.id, "=>", newState);
        }
    } catch (e) {
        console.warn('⚠️ Error toggling IA:', e);
    }
}

function updateIAToggleUI() {
    const btn = document.getElementById('iaToggleBtn');
    const dot = document.getElementById('iaToggleDot');
    const track = btn?.querySelector('.relative');

    if (!btn || !dot || !track) return;

    if (currentIAEnabled) {
        btn.className = 'flex items-center gap-1 cursor-pointer select-none px-1.5 py-0.5 rounded-full transition-all bg-[#dbe4f0] hover:bg-[#c8d5e8]';
        btn.title = 'Desactivar respuestas automáticas de IA';
        track.className = 'relative w-6 h-3.5 rounded-full bg-[#8faed4] transition-all';
        dot.className = 'absolute top-0.5 left-3 w-2.5 h-2.5 rounded-full bg-white shadow transition-all';
        btn.querySelector('i').className = 'fas fa-robot text-[10px] text-[#5a7baa]';
    } else {
        btn.className = 'flex items-center gap-1 cursor-pointer select-none px-1.5 py-0.5 rounded-full transition-all bg-red-50 hover:bg-red-100';
        btn.title = 'Activar respuestas automáticas de IA';
        track.className = 'relative w-6 h-3.5 rounded-full bg-red-300 transition-all';
        dot.className = 'absolute top-0.5 left-0.5 w-2.5 h-2.5 rounded-full bg-white shadow transition-all';
        btn.querySelector('i').className = 'fas fa-robot text-[10px] text-red-400';
    }
}

// ============================================
// MENSAJES DE ERROR
// ============================================
function showMessageError(text) {
    const bubble = document.getElementById("messageErrorBubble");
    const textEl = document.getElementById("messageErrorText");
    const input = document.getElementById("messageInput");

    if (textEl) textEl.textContent = text;
    if (bubble) {
        bubble.classList.remove("hidden");
        bubble.classList.add("flex");
    }
    if (input) input.classList.add("ring-2", "ring-red-300");

    setTimeout(() => hideMessageError(), 4000);
}

function hideMessageError() {
    const bubble = document.getElementById("messageErrorBubble");
    const input = document.getElementById("messageInput");
    if (bubble) {
        bubble.classList.add("hidden");
        bubble.classList.remove("flex");
    }
    if (input) input.classList.remove("ring-2", "ring-red-300");
}

function showMessageInputError(text) {
    const el = document.getElementById('messageError');
    if (!el) return;
    el.textContent = text;
    el.classList.remove('hidden');
    el.classList.add('animate-pulse');
    setTimeout(() => {
        el.classList.add('hidden');
        el.classList.remove('animate-pulse');
    }, 2500);
}

// ============================================
// EXPONER FUNCIONES GLOBALMENTE
// ============================================
window.handleFileSelect = handleFileSelect;
window.clearAttachment = clearAttachment;
window.startRecording = startRecording;
window.stopRecording = stopRecording;
window.clearAudioRecording = clearAudioRecording;
window.toggleIAForConversation = toggleIAForConversation;

// Exponer funciones al orquestador
window.sendMessage = sendMessage;
window.selectMessageByIndex = selectMessageByIndex;
window.selectMessageToReply = selectMessageToReply;
window.deselectMessage = deselectMessage;
window.toggleMessageOrder = toggleMessageOrder; // si existe en este módulo