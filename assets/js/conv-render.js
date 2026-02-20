// ============================================
// CONV-RENDER.JS — Renderizado de UI
// Conversaciones (sidebar), mensajes (chat), media
// ============================================

console.log('✅ conv-render.js cargado');

// ============================================
// RENDER: Lista de conversaciones (sidebar)
// ============================================

function renderConversations(list = conversations) {
    const container = document.getElementById('conversationsList');
    if (!container) return;

    container.innerHTML = '';

    const data = list || [];

    if (data.length === 0) {
        container.innerHTML = `
            <div class="flex flex-col items-center justify-center h-full text-gray-400 text-sm gap-2 py-10">
                <i class="fas fa-comments text-3xl"></i>
                <span>No hay conversaciones</span>
            </div>
        `;
        return;
    }

    data.forEach(conv => {
        const item = document.createElement('div');
        item.className = 'conversation-item border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-all rounded-2xl mx-2 my-0.5 p-2';
        item.dataset.conversationId = conv.id;

        // Resaltar si está seleccionada
        if (currentConversation && currentConversation.id === conv.id) {
            item.classList.add('bg-purple-50');
        }

        item.innerHTML = `
            <div class="flex items-center gap-3">
                <!-- Avatar -->
                <div class="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden" id="avatar-list-${conv.id}">
                    ${
                        conv.avatar_url
                            ? `<img src="${conv.avatar_url}" class="w-full h-full object-cover" />`
                            : `<span class="text-sm font-semibold text-gray-600">
                                   ${(conv.name || conv.phone || '?').substring(0, 2).toUpperCase()}
                               </span>`
                    }
                </div>

                <div class="flex-1 min-w-0">
                    <div class="flex justify-between items-center">
                        <!-- Nombre + mini etiqueta -->
                        <div class="flex items-center gap-2 min-w-0">
                            <span class="font-medium text-sm text-gray-800 truncate">
                                ${conv.name || conv.phone}
                            </span>

                            <!-- 🏷️ Mini etiqueta decorativa -->
<span 
  class="inline-flex items-center justify-center w-4 h-4 rounded bg-white text-[10px] flex-shrink-0"
  title="${(conv.tag && conv.tag.label) ? conv.tag.label : 'Etiqueta'}"
>
  <i 
    class="fas fa-tag text-[10px]" 
    style="color:${(conv.tag && conv.tag.color) ? conv.tag.color : '#9ca3af'}"
  ></i>
</span>
                        </div>

                        <span class="text-xs text-gray-400">
                            ${conv.time || ''}
                        </span>
                    </div>

                    <div class="flex justify-between items-center gap-2">
                        <div class="flex flex-col min-w-0">
                            <span class="text-xs text-gray-500 truncate">
                                ${conv.lastMessage || ''}
                            </span>

                            <!-- 🤖 Estado IA -->
                            ${
                                conv.ia_enabled === false
                                    ? `<span class="text-[10px] text-red-400 mt-0.5">IA desactivada</span>`
                                    : ''
                            }
                        </div>

                        <div class="flex items-center gap-1 flex-shrink-0">
                            <!-- 🟢 Puntitos de colores por TAG (más pequeños) -->
                            ${
                                (conv.tags || []).map(t => `
                                    <span 
                                        title="${t.label}"
                                        class="w-2 h-2 rounded-full inline-block"
                                        style="background:${t.color || '#999'}"
                                    ></span>
                                `).join('')
                            }

                            <!-- 📩 Unread -->
                            ${
                                (conv.unread || 0) > 0
                                    ? `<span class="ml-1 text-xs bg-purple-500 text-white rounded-full px-2 py-0.5">
                                           ${conv.unread}
                                       </span>`
                                    : ''
                            }
                        </div>
                    </div>
                </div>
            </div>
        `;

        item.addEventListener('click', () => {
            if (typeof selectConversation === 'function') {
                selectConversation(conv.id, item);
            }
        });

        container.appendChild(item);

        // Actualizar avatar dinámico si existe helper
        if (typeof updateConversationAvatar === 'function') {
            updateConversationAvatar(conv.id, conv.avatar_url);
        }
    });
}
// ============================================
// RENDER: Mensajes del chat
// ============================================
function renderMessages() {
    const chatContainer = document.getElementById('chatMessages');
    if (!chatContainer) return;

    chatContainer.style.overflowY = 'auto';

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

    const messagesToRender = messagesOrderReversed
        ? [...currentMessages].reverse()
        : currentMessages;

    messagesToRender.forEach(msg => {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'mb-3';

        const isUser = msg.role === 'user' || msg.sender_type === 'user';
        const messageTime = formatTimestamp(msg.timestamp);

        let mediaContent = '';
        if (msg.cloudinary_url) {
            mediaContent = renderMediaContent(msg);
        }

        const messageText = msg.content || msg.text || '';

        if (isUser) {
            const isSelected = selectedMessageToReply && selectedMessageToReply.message_id === msg.message_id;
            const msgIndex = messagesToRender.indexOf(msg);

            messageDiv.innerHTML = `
                <div 
                    class="flex justify-end items-start gap-2 mb-2 cursor-pointer hover:opacity-80 transition ${isSelected ? 'ring-2 ring-purple-400 rounded-3xl' : ''}"
                    onclick="selectMessageByIndex(${msgIndex})"
                    title="Click para responder este mensaje"
                >
                    <div class="bg-[#e7f0fd] rounded-3xl rounded-tr-md px-4 py-3 max-w-md shadow-md">
                        ${mediaContent}
                        ${messageText ? `<p class="text-sm text-gray-800 whitespace-pre-wrap ${mediaContent ? 'mt-2' : ''}">${escapeHtml(messageText)}</p>` : ''}
                        <div class="flex items-center justify-end gap-2 mt-2">
                            <span class="text-xs text-gray-500">${messageTime}</span>
                            <i class="fas fa-check-double text-blue-500 text-xs"></i>
                        </div>
                    </div>
                    <div class="w-8 h-8 rounded-full bg-[#80b5ec] flex items-center justify-center flex-shrink-0 shadow-sm">
                        <i class="fas fa-user text-white text-xs"></i>
                    </div>
                </div>
                ${renderResponses(msg)}
            `;
        } else {
            messageDiv.innerHTML = `
                <div class="flex justify-start items-start gap-2">
                    <div class="w-8 h-8 rounded-full bg-[#b6b2f1] flex items-center justify-center flex-shrink-0 shadow-sm">
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

    setTimeout(() => {
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }, 100);
}

// ============================================
// RENDER: Respuestas del admin
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
                        <div class="bg-[#d3f9e3] rounded-3xl rounded-tr-md px-4 py-3 max-w-md shadow-md">
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
                        <div class="w-8 h-8 rounded-full bg-[#72d298] flex items-center justify-center flex-shrink-0 shadow-sm">
                            <i class="fas fa-user-shield text-white text-xs"></i>
                        </div>
                    </div>
                `;
    }).join('')}
        </div>
    `;
}

// ============================================
// RENDER: Contenido multimedia
// ============================================
function renderMediaContent(msg) {
    if (!msg.cloudinary_url) return '';

    const url = msg.cloudinary_url;
    const type = msg.type || '';
    const mimeType = msg.mime_type || '';

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

    if (type === 'video' || mimeType.startsWith('video/')) {
        return `
            <div class="bg-gray-50 rounded-xl p-2">
                <video controls class="max-w-[220px] max-h-[180px] rounded-lg">
                    <source src="${url}" type="${mimeType}">
                </video>
            </div>
        `;
    }

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

function getFileInfo(type, mimeType) {
    if (type === 'document' || mimeType.includes('pdf')) {
        return { icon: 'fas fa-file-pdf', iconColor: 'text-red-600', bgColor: 'bg-red-100', label: 'PDF' };
    }
    if (mimeType.includes('word') || mimeType.includes('document')) {
        return { icon: 'fas fa-file-word', iconColor: 'text-blue-600', bgColor: 'bg-blue-100', label: 'Word' };
    }
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) {
        return { icon: 'fas fa-file-excel', iconColor: 'text-green-600', bgColor: 'bg-green-100', label: 'Excel' };
    }
    if (mimeType.includes('zip') || mimeType.includes('rar')) {
        return { icon: 'fas fa-file-archive', iconColor: 'text-yellow-600', bgColor: 'bg-yellow-100', label: 'Archivo' };
    }
    return { icon: 'fas fa-file', iconColor: 'text-gray-600', bgColor: 'bg-gray-100', label: 'Documento' };
}

// ============================================
// UPDATE: Header del chat y panel contacto
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
        roundedClass: "rounded-full"
    });
}

function updateContactPanel() {
    if (!currentConversation) return;

    const nameEl = document.getElementById("contactHeaderName");
    const avatarEl = document.getElementById("contactHeaderAvatar");
    const phoneEl = document.getElementById("contactPhone");

    const name = currentConversation.name || "Sin nombre";
    const phone = currentConversation.phone || "";

    if (nameEl) nameEl.textContent = name;
    if (phoneEl) phoneEl.textContent = phone;

    if (avatarEl) {
        const currentUrl = avatarEl.getAttribute("data-avatar-url") || "";
        const targetUrl = currentConversation.avatar_url || "";
        if (currentUrl !== targetUrl || !avatarEl.querySelector("img")) {
            renderAvatar(avatarEl, {
                avatar_url: currentConversation.avatar_url,
                name: name,
                roundedClass: "rounded-full"
            });
        }
    }
}

function updateConversationAvatar(waId, avatarUrl) {
    const avatarContainer = document.getElementById(`avatar-list-${waId}`);
    if (avatarContainer) {
        renderAvatar(avatarContainer, {
            avatar_url: avatarUrl,
            name: waId,
            roundedClass: "rounded-full"
        });
    }
}

// ============================================
// TOGGLE ORDEN DE MENSAJES
// ============================================
function toggleMessageOrder() {
    messagesOrderReversed = !messagesOrderReversed;

    const button = document.getElementById('toggleMessageOrder');
    const icon = button?.querySelector('i');

    if (messagesOrderReversed) {
        if (icon) icon.className = 'fas fa-arrow-up-short-wide text-purple-600';
        if (button) button.title = 'Orden invertido: más recientes arriba';
    } else {
        if (icon) icon.className = 'fas fa-arrow-down-short-wide text-gray-600 group-hover:text-purple-600';
        if (button) button.title = 'Orden WhatsApp: más recientes abajo';
    }

    renderMessages();
}

// ============================================
// SYSTEM BUBBLE
// ============================================
function showSystemBubble(text) {
    const chatContainer = document.getElementById("chatMessages");
    if (!chatContainer) return;

    const messagesDiv = chatContainer.querySelector('.space-y-4') || chatContainer;

    const bubble = document.createElement("div");
    bubble.className = "flex justify-center my-3";
    bubble.innerHTML = `
        <div class="bg-yellow-50 border border-yellow-200 text-yellow-800 text-xs px-4 py-2 rounded-full shadow-sm">
            ${text}
        </div>
    `;
    messagesDiv.appendChild(bubble);

    setTimeout(() => {
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }, 50);
}

// ============================================
// PANEL DERECHO (CONTACTO)
// ============================================
function showContactPanel() {
    const panel = document.getElementById("contactPanel");
    if (panel) {
        panel.classList.remove("hidden");
    }
}

function hideContactPanel() {
    const panel = document.getElementById("contactPanel");
    if (panel) {
        panel.classList.add("hidden");
    }
}

// Exponer globalmente
window.showContactPanel = showContactPanel;
window.hideContactPanel = hideContactPanel;
