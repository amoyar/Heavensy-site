// ============================================
// CONV-STATE.JS — Estado global y utilidades
// Compartido por todos los módulos de conversaciones
// ============================================

console.log('✅ conv-state.js cargado');

// Estado global (solo se inicializa una vez)
if (typeof window.conversacionesState === 'undefined') {
    window.conversacionesState = {
        attachedFile: null,
        recordedAudio: null,
        audioExtension: 'ogg',
        audioMimeType: 'audio/ogg;codecs=opus'
    };
}

// Variables de estado del módulo
let currentConversation = null;
let conversations = [];
let currentMessages = [];
let currentCompanyId = null;
let allMessages = [];
let selectedMessageToReply = null;
let messagesOrderReversed = false;
let isSending = false;

// ============================================
// AVATAR RENDERER (compartido)
// ============================================
function renderAvatar(containerEl, { avatar_url, name, roundedClass }) {
    if (!containerEl) return;

    const defaultAvatar = "assets/img/Avatar.png";
    const finalUrl = avatar_url && avatar_url.trim() !== "" ? avatar_url : defaultAvatar;

    const currentUrl = containerEl.getAttribute("data-avatar-url") || "";
    if (currentUrl === finalUrl && containerEl.querySelector("img")) {
        return;
    }

    containerEl.setAttribute("data-avatar-url", finalUrl);

    containerEl.innerHTML = `
        <img 
            src="${finalUrl}" 
            class="w-full h-full object-cover ${roundedClass}" 
            alt="Avatar"
            loading="lazy"
            onerror="this.src='${defaultAvatar}'"
        />
    `;
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

function formatTimestamp(timestamp) {
    if (!timestamp) return '';

    try {
        const date = new Date(timestamp);
        if (isNaN(date.getTime())) return timestamp;

        const now = new Date();
        const isToday = date.toDateString() === now.toDateString();

        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        const isYesterday = date.toDateString() === yesterday.toDateString();

        if (isToday) {
            return date.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
        }
        if (isYesterday) {
            return 'Ayer';
        }

        const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
        if (diffDays < 7) {
            const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
            return days[date.getDay()];
        }

        return date.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' });
    } catch (e) {
        return '';
    }
}

function formatTime(timestamp) {
    if (!timestamp) return '';
    try {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;

        if (diff < 24 * 60 * 60 * 1000) {
            return date.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
        }
        if (diff < 7 * 24 * 60 * 60 * 1000) {
            const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
            return days[date.getDay()];
        }
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

function mapTagColor(colorName) {
    const colorMap = {
        purple: '#7c3aed',
        blue: '#3b82f6',
        green: '#10b981',
        orange: '#f59e0b',
        pink: '#ec4899',
        indigo: '#6366f1',
        red: '#ef4444',
        yellow: '#eab308',
        gray: '#9ca3af'
    };
    return colorMap[colorName] || colorName || '#9ca3af';
}

// ============================================
// UI HELPERS COMPARTIDOS
// ============================================
function mostrarEstadoSinEmpresaSeleccionada() {
    const chatMessages = document.getElementById("chatMessages");
    const chatHeader = document.getElementById("chatHeader");

    if (chatHeader) {
        chatHeader.classList.add("hidden");
    }

    if (!chatMessages) return;

    chatMessages.innerHTML = `
        <div class="h-full flex flex-col items-center justify-center text-center text-gray-400 px-6">
            <div class="w-16 h-16 mb-4 rounded-2xl bg-[#e6ecf7] flex items-center justify-center shadow-sm">
                <i class="fas fa-building text-[#5a7baa] text-3xl"></i>
            </div>
            <h2 class="text-lg font-semibold text-gray-600 mb-1">
                Selecciona una empresa
            </h2>
            <p class="text-sm text-gray-400 max-w-sm">
                Para comenzar, elige una empresa desde el selector de arriba y podrás ver sus conversaciones aquí.
            </p>
        </div>
    `;
}


function mostrarEstadoSinConversacionSeleccionada() {
    const chatContainer = document.getElementById('chatMessages');
    const chatHeader = document.getElementById('chatHeader');
    const contactPanel = document.getElementById('contactDetailPanel');
    const inputBar = document.getElementById('messageInputBar');

    if (chatContainer) chatContainer.innerHTML = '<div class="flex-1 flex items-center justify-center text-gray-400 text-sm"><p>Selecciona una conversación</p></div>';
    if (chatHeader) chatHeader.classList.add('hidden');
    if (contactPanel) contactPanel.classList.add('hidden');
    if (inputBar) inputBar.classList.add('hidden');
}

function mostrarChatActivo() {
    const chatHeader = document.getElementById('chatHeader');
    const contactPanel = document.getElementById('contactDetailPanel');
    const inputBar = document.getElementById('messageInputBar');

    if (chatHeader) chatHeader.classList.remove('hidden');
    if (contactPanel) contactPanel.classList.remove('hidden');
    if (inputBar) inputBar.classList.remove('hidden');
}

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

function resetChatAndContactPanel() {
    currentConversation = null;
    selectedMessageToReply = null;

    const chatHeader = document.getElementById("chatHeader");
    if (chatHeader) chatHeader.classList.add("hidden");

    const contactPanel = document.getElementById("contactDetailPanel");
    if (contactPanel) contactPanel.classList.add("hidden");

    const inputBar = document.getElementById("messageInputBar");
    if (inputBar) inputBar.classList.add("hidden");

    const chatMessages = document.getElementById("chatMessages");
    if (chatMessages) chatMessages.innerHTML = '<div class="flex-1 flex items-center justify-center text-gray-400 text-sm"><p>Selecciona una conversación</p></div>';

    // Limpiar header del contacto
    const contactHeaderAvatar = document.getElementById("contactHeaderAvatar");
    if (contactHeaderAvatar) contactHeaderAvatar.innerHTML = "";
    const contactHeaderName = document.getElementById("contactHeaderName");
    if (contactHeaderName) contactHeaderName.textContent = "—";
    const contactPhone = document.getElementById("contactPhone");
    if (contactPhone) contactPhone.textContent = "";
    const notesContainer = document.getElementById("contactNotesContainer");
    if (notesContainer) notesContainer.innerHTML = "";
    const metaEl = document.getElementById("contactHeaderMeta");
    if (metaEl) metaEl.innerHTML = "";
}

// Exponer globales
window.toggleRightSection = toggleRightSection;
window.toggleLeftSection = toggleLeftSection;