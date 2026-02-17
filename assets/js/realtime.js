// ============================================
// REALTIME.JS - Chat en tiempo real via Socket.IO
// Módulo independiente - NO modifica conversaciones.js
// Se comunica via window.conversacionesAPI
// ============================================

console.log("🔌 realtime.js cargado");

let rtSocket = null;
let rtCurrentCompanyId = null;
let rtCurrentUserId = null;
let rtInitialized = false;
let rtConnecting = false;
const notifiedMessageIds = new Set();
// ============================================
// INICIALIZACIÓN
// ============================================
function initRealtime() {
    if (rtInitialized || rtConnecting) return;
    rtConnecting = true;

    // Socket.IO client ya debería estar cargado por monitor.js
    // Si no, cargarlo dinámicamente
    if (typeof io === 'undefined') {
        console.log('🔌 Cargando Socket.IO client...');
        const script = document.createElement('script');
        script.src = 'https://cdn.socket.io/4.5.4/socket.io.min.js';
        script.onload = () => {
            console.log('✅ Socket.IO client cargado');
            connectRealtime();
        };
        script.onerror = () => console.error('❌ No se pudo cargar Socket.IO client');
        document.head.appendChild(script);
    } else {
        connectRealtime();
    }
}

// ============================================
// CONEXIÓN SOCKET.IO
// ============================================
function connectRealtime() {
    try {
        // Si ya hay socket conectado, no crear otro
        if (rtSocket && rtSocket.connected) {
            console.log('🔌 Realtime ya conectado');
            return;
        }

        // ✅ forceNew: true para no interferir con el socket del monitor
        rtSocket = io(API_BASE_URL, {
            reconnection: true,
            reconnectionAttempts: 10,
            reconnectionDelay: 3000,
            transports: ['websocket', 'polling'],
            //forceNew: true,
            auth: {
                token: typeof getToken === 'function' ? getToken() : ''
            }
        });

        rtSocket.on('connect', () => {
            console.log(`🔌 Realtime conectado: ${rtSocket.id}`);
            rtInitialized = true;
            rtConnecting = false;   // 👈 NUEVO
            
            // Unirse al room de la empresa actual
            syncRooms();
        });

        rtSocket.on('disconnect', (reason) => {
            console.warn(`🔌 Realtime desconectado: ${reason}`);
        });

        rtSocket.on('connect_error', (error) => {
            console.error(`🔌 Realtime error: ${error.message}`);
        });

        rtSocket.on('room_joined', (data) => {
            console.log(`🔌 Realtime unido a room: ${data.room}`);
        });

        // =============================================
        // 📨 EVENTOS DE MENSAJES
        // =============================================

        // Mensaje nuevo desde WhatsApp (usuario o respuesta IA del webhook)
        rtSocket.on('new_message', (data) => {
            console.log('📨 [realtime] new_message:', data);
            handleNewMessage(data);
        });

        // Respuesta del admin (desde otro panel o confirmación propia)
        rtSocket.on('admin_reply', (data) => {
            console.log('📨 [realtime] admin_reply:', data);
            handleAdminReply(data);
        });

        // Debug: escuchar todos los eventos
        rtSocket.onAny((event, ...args) => {
            if (!['ping', 'pong'].includes(event)) {
                console.log(`🔔 [realtime] evento: ${event}`, args);
            }
        });

    } catch (e) {
        console.error('❌ Error conectando realtime:', e);
    }
}

// ============================================
// ROOMS: Sincronizar con estado de conversaciones
// ============================================
function syncRooms() {
    const state = getConvState();

    // Join company room
    if (state.currentCompanyId && state.currentCompanyId !== rtCurrentCompanyId) {
        if (rtCurrentCompanyId) {
            leaveRoom('company', rtCurrentCompanyId);
        }
        rtCurrentCompanyId = state.currentCompanyId;
        joinRoom('company', rtCurrentCompanyId);
    }

    // Join user room si hay conversación abierta
    const newUserId = state.currentConversation?.id || null;
    if (newUserId !== rtCurrentUserId) {
        if (rtCurrentUserId && rtCurrentCompanyId) {
            leaveRoom('user', rtCurrentCompanyId, rtCurrentUserId);
        }
        rtCurrentUserId = newUserId;
        if (rtCurrentUserId && rtCurrentCompanyId) {
            joinRoom('user', rtCurrentCompanyId, rtCurrentUserId);
        }
    }
}

function joinRoom(type, companyId, userId) {
    if (!rtSocket || !rtSocket.connected) return;
    
    const data = { type, company_id: companyId };
    if (userId) data.user_id = userId;
    
    rtSocket.emit('join_room', data);
    console.log(`🔌 join_room: ${type}:${companyId}${userId ? ':' + userId : ''}`);
}

function leaveRoom(type, companyId, userId) {
    if (!rtSocket || !rtSocket.connected) return;
    
    const data = { type, company_id: companyId };
    if (userId) data.user_id = userId;
    
    rtSocket.emit('leave_room', data);
}

// ============================================
// HELPER: Estado de conversaciones
// ============================================
function getConvState() {
    if (window.conversacionesAPI && window.conversacionesAPI.getState) {
        return window.conversacionesAPI.getState();
    }
    return { currentConversation: null, conversations: [], currentMessages: [], currentCompanyId: null };
}

function getConvAPI() {
    return window.conversacionesAPI || null;
}

// ============================================
// 📨 HANDLER: Mensaje nuevo (usuario o IA)
// ============================================
function handleNewMessage(data) {
    const state = getConvState();
    const api = getConvAPI();
    if (!api) return;

    const msgCompanyId = data.company_id;
    const msgUserId = data.user_id;

    // Solo procesar mensajes de la empresa actual
    if (msgCompanyId !== state.currentCompanyId) return;

    // 1. Actualizar lista de conversaciones (panel izquierdo)
    updateConversationList(data, state, api);

    // 2. Si el chat abierto es de este usuario, agregar mensaje al chat
    if (state.currentConversation && state.currentConversation.id === msgUserId) {
        addMessageToChat(data, state, api);
        showMessageNotification(data, state);   // ✅ TAMBIÉN mostrar
    } else {
        showMessageNotification(data, state);
    }
}

// ============================================
// 📨 HANDLER: Respuesta del admin
// ============================================
function handleAdminReply(data) {
    const state = getConvState();
    const api = getConvAPI();
    if (!api) return;

    const msgCompanyId = data.company_id;
    const msgUserId = data.user_id;

    if (msgCompanyId !== state.currentCompanyId) return;

    // Actualizar lista
    updateConversationList({
        ...data,
        text: data.response?.text || "(Respuesta del admin)",
        sender_type: "admin"
    }, state, api);

    // Si el chat abierto es de este usuario, recargar mensajes
    if (state.currentConversation && state.currentConversation.id === msgUserId) {
        refreshChat(msgUserId, api);
    }
}

// ============================================
// ACTUALIZAR LISTA DE CONVERSACIONES
// ============================================
function updateConversationList(data, state, api) {
    const userId = data.user_id;
    const text = data.text || "";
    const timestamp = data.timestamp || new Date().toISOString();

    const conv = state.conversations.find(c => c.id === userId);

    if (conv) {
        conv.last_message = text.substring(0, 100);
        conv.timestamp = timestamp;

        // Incrementar no leídos si NO es el chat activo
        if (!state.currentConversation || state.currentConversation.id !== userId) {
            conv.unread = (conv.unread || 0) + 1;
        }

        // Mover al tope de la lista
        const idx = state.conversations.indexOf(conv);
        if (idx > 0) {
            state.conversations.splice(idx, 1);
            state.conversations.unshift(conv);
        }

        api.renderConversations();
    } else {
        // Conversación nueva → recargar lista
        api.cargarConversacionesPorEmpresa(state.currentCompanyId);
    }
}

// ============================================
// AGREGAR MENSAJE AL CHAT ABIERTO
// ============================================
function addMessageToChat(data, state, api) {
    const messageId = data.message_id || `rt_${Date.now()}`;

    // Verificar duplicados
    if (state.currentMessages.some(m => m.message_id === messageId)) return;

    const senderType = data.sender_type === "user" ? "user" : "assistant";


    const newMsg = {
    message_id: messageId,
    role: senderType,              // ✅ CLAVE
    sender_type: senderType,       // ✅ CLAVE
    direction: senderType === "user" ? "inbound" : "outbound",
    content: data.text || "",
    text: data.text || "",
    timestamp: data.timestamp || new Date().toISOString(),
    type: data.type || "text",
    media_url: data.media_url || null,
    cloudinary_url: data.cloudinary_url || null,
    cloudinary_id: data.cloudinary_id || null,
    mime_type: data.mime_type || null,
    read: false,
    responses: []
    };


    state.currentMessages.push(newMsg);
    api.loadMessages();
    scrollToBottom();
}

// ============================================
// REFRESH COMPLETO DEL CHAT
// ============================================
async function refreshChat(userId, api) {
    try {
        const freshMessages = await api.cargarMensajesDeConversacion(userId);
        const state = getConvState();
        if (state.currentConversation) {
            state.currentConversation.messages = freshMessages;
        }
        api.loadMessages();
        scrollToBottom();
    } catch (e) {
        console.error('❌ Error refrescando chat:', e);
    }
}

function scrollToBottom() {
    const container = document.getElementById('messagesContainer');
    if (container) {
        setTimeout(() => { container.scrollTop = container.scrollHeight; }, 150);
    }
}

// ============================================
// 🔔 NOTIFICACIONES VISUALES
// ============================================

function showMessageNotification(data, state) {
    const senderName = data.profile_name || data.user_id || "Contacto";
    const text = data.text || "(Mensaje nuevo)";
    const userId = data.user_id;
    const msgId = data.message_id || data.wamid || `${data.user_id}_${data.timestamp}`;
    
    if (notifiedMessageIds.has(msgId)) {
        return; // ⛔ Ya se mostró esta notificación
    }

     notifiedMessageIds.add(msgId);
    // Limpieza para no crecer infinito
    setTimeout(() => notifiedMessageIds.delete(msgId), 60000);
    
    // Crear el contenedor de notificaciones si no existe
    let notifContainer = document.getElementById('rtNotificationContainer');
    if (!notifContainer) {
        notifContainer = document.createElement('div');
        notifContainer.id = 'rtNotificationContainer';
        notifContainer.style.cssText = `
            position: fixed;
            top: 16px;
            right: 16px;
            z-index: 9999;
            display: flex;
            flex-direction: column;
            gap: 8px;
            max-width: 380px;
        `;
        document.body.appendChild(notifContainer);
    }

    // Crear notificación
    const notif = document.createElement('div');
    notif.style.cssText = `
        background: white;
        border-left: 4px solid #7c3aed;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.15);
        padding: 12px 16px;
        display: flex;
        align-items: flex-start;
        gap: 10px;
        cursor: pointer;
        animation: rtSlideIn 0.3s ease-out;
        transition: opacity 0.3s, transform 0.3s;
        min-width: 280px;
    `;

    const preview = text.length > 80 ? text.substring(0, 80) + '...' : text;
    const avatarUrl = data.avatar_url || "assets/img/Avatar.png";

    notif.innerHTML = `
        <div style="flex-shrink:0; width:36px; height:36px; border-radius:50%; overflow:hidden; background:#e5e7eb;">
            <img 
                src="${avatarUrl}" 
                alt="avatar"
                style="width:100%; height:100%; object-fit:cover;"
                onerror="this.src='assets/img/Avatar.png'"
            />
        </div>
        <div style="flex:1; min-width:0;">
            <div style="font-weight:600; font-size:13px; color:#1f2937; margin-bottom:2px;">
                ${escapeNotifHtml(senderName)}
            </div>
            <div style="font-size:12px; color:#6b7280; line-height:1.3; word-break:break-word;">
                ${escapeNotifHtml(preview)}
            </div>
        </div>
        <button style="flex-shrink:0; background:none; border:none; color:#9ca3af; cursor:pointer; padding:2px; font-size:16px; line-height:1;" title="Cerrar">&times;</button>
    `;


    // Click en notificación → abrir esa conversación
    notif.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') {
            removeNotification(notif);
            return;
        }
        removeNotification(notif);
        openConversationFromNotification(userId, state);
    });

    notifContainer.appendChild(notif);

    // Sonido de notificación
    playNotificationSound();

    // Auto-cerrar después de 6 segundos
    setTimeout(() => {
        removeNotification(notif);
    }, 6000);
}

function removeNotification(notif) {
    if (!notif || !notif.parentElement) return;
    notif.style.opacity = '0';
    notif.style.transform = 'translateX(100%)';
    setTimeout(() => {
        if (notif.parentElement) notif.parentElement.removeChild(notif);
    }, 300);
}

function openConversationFromNotification(userId, state) {
    const api = getConvAPI();
    if (!api) return;

    const convElement = document.querySelector(`[data-conversation-id="${userId}"]`);
    if (convElement) {
        api.selectConversation(userId, convElement);
    } else {
        api.selectConversation(userId, null);
    }
}

function playNotificationSound() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.frequency.value = 800;
        osc.type = 'sine';
        gain.gain.value = 0.1;
        
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        osc.stop(ctx.currentTime + 0.3);
    } catch (e) {
        // Silenciar si AudioContext no disponible
    }
}

function escapeNotifHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================
// CSS ANIMATION
// ============================================
function injectNotificationStyles() {
    if (document.getElementById('rtNotifStyles')) return;
    const style = document.createElement('style');
    style.id = 'rtNotifStyles';
    style.textContent = `
        @keyframes rtSlideIn {
            from { opacity: 0; transform: translateX(100%); }
            to { opacity: 1; transform: translateX(0); }
        }
    `;
    document.head.appendChild(style);
}

// ============================================
// HOOKS: Detectar cambios en empresa y conversación
// ============================================
function setupRealtimeHooks() {
    // Hook 1: Cambio de empresa
    const companySelect = document.getElementById('conversacionesCompanyFilter');
    if (companySelect) {
        companySelect.addEventListener('change', () => {
            setTimeout(syncRooms, 200);
        });
    }

    // Hook 2: Cambio de conversación (observar header del chat)
    const chatHeader = document.getElementById('chatHeaderName');
    if (chatHeader) {
        const observer = new MutationObserver(() => {
            setTimeout(syncRooms, 100);
        });
        observer.observe(chatHeader, { childList: true, characterData: true, subtree: true });
    }

    // Hook 3: Polling como fallback (cada 2s verifica si cambió empresa o conversación)
    setInterval(() => {
        const state = getConvState();
        const needsSync = (
            (state.currentCompanyId && state.currentCompanyId !== rtCurrentCompanyId) ||
            ((state.currentConversation?.id || null) !== rtCurrentUserId)
        );
        if (needsSync) syncRooms();
    }, 2000);
}

// ============================================
// AUTO-INIT
// ============================================
function waitAndInit() {
    if (window.conversacionesAPI) {
        console.log('🔌 conversacionesAPI detectado, iniciando realtime...');
        injectNotificationStyles();
        initRealtime();
        setTimeout(setupRealtimeHooks, 2000);
    } else {
        setTimeout(waitAndInit, 500);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(waitAndInit, 1500);
});