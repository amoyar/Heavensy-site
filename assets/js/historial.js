// ============================================
// HISTORIAL DE MENSAJES - JAVASCRIPT
// Integrado con el sistema SPA
// ============================================

console.log('✅ historial.js cargado');
const CLOUDINARY_CLOUD_NAME = 'dhkvvwjtv';

let historialCurrentMessages = [];
let historialCurrentCompanyId = null;

// Paginación
let historialCurrentPage = 1;
let historialItemsPerPage = 20;
let historialTotalMessages = 0;



function toggleFiltrosHistorial() {
  const panel = document.getElementById('historialFiltrosPanel');
  if (!panel) return;
  panel.classList.toggle('hidden');
}
function toggleNotasInternas(messageId) {
    const el = document.getElementById(`notas-${messageId}`);
    if (!el) return;
    el.classList.toggle('hidden');
}
// ============================================
// INICIALIZACIÓN - Llamada por el router
// ============================================
async function initHistorialPage() {
    console.log('🚀 Inicializando página de historial');

    // Verificar autenticación
    const token = getToken();
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    // Cargar empresas
    await cargarEmpresasHistorial();

    // Cargar usuarios cuando se seleccione una empresa
    const companySelect = document.getElementById('historialCompanyFilter');
    if (companySelect) {
        companySelect.addEventListener('change', handleHistorialCompanyChange);
    }

    console.log('✅ Página de historial inicializada');
}

// ============================================
// FUNCIONES DE CARGA
// ============================================

async function cargarEmpresasHistorial() {
    console.log('🔄 Cargando empresas para historial...');

    try {
        // Opción 1: Usar apiCall si existe
        if (typeof apiCall === 'function') {
            const response = await apiCall('/api/companies');

            if (response.ok && response.data && response.data.companies) {
                const companies = response.data.companies;
                poblarSelectEmpresas(companies);
                console.log(`✅ ${companies.length} empresas cargadas (apiCall)`);
                return;
            }
        }

        // Opción 2: Usar fetch directo como fallback
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

        poblarSelectEmpresas(companies);
        console.log(`✅ ${companies.length} empresas cargadas (fetch)`);

    } catch (error) {
        console.error('❌ Error cargando empresas:', error);
        const select = document.getElementById('historialCompanyFilter');
        if (select) {
            select.innerHTML = '<option value="">Error cargando empresas</option>';
        }
    }
}

function poblarSelectEmpresas(companies) {
    const select = document.getElementById('historialCompanyFilter');
    if (!select) {
        console.warn('⚠️ Select de empresas no encontrado');
        return;
    }

    select.innerHTML = '<option value="">Seleccionar empresa...</option>';

    companies.forEach(company => {
        const option = document.createElement('option');
        option.value = company.company_id;
        // Intentar diferentes formatos de nombre
        const companyName = company.name || company.company_name || company.company_id;
        option.textContent = `${companyName} (${company.company_id})`;
        select.appendChild(option);
    });
}

async function handleHistorialCompanyChange() {
    const companyId = document.getElementById('historialCompanyFilter').value;

    if (!companyId) {
        const userSelect = document.getElementById('historialUserFilter');
        if (userSelect) {
            userSelect.innerHTML = '<option value="">Todos los usuarios</option>';
        }
        return;
    }

    historialCurrentCompanyId = companyId;

    // Cargar usuarios de esta empresa
    await cargarUsuariosHistorial(companyId);
}

async function cargarUsuariosHistorial(companyId) {
    console.log('🔄 Cargando usuarios para company:', companyId);

    try {
        // En lugar de obtener conversaciones, obtener mensajes y extraer usuarios únicos
        const params = new URLSearchParams({
            company_id: companyId,
            limit: 200
        });

        const url = `${API_BASE_URL}/api/chat/messages/history?${params}`;

        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${getToken() || localStorage.getItem('token')}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) throw new Error('Error cargando usuarios');

        const data = await response.json();
        const messages = data.messages || [];

        // Extraer usuarios únicos de los mensajes
        const usersMap = new Map();
        messages.forEach(msg => {
            if (msg.user_id && !usersMap.has(msg.user_id)) {
                usersMap.set(msg.user_id, msg.profile_name || msg.user_id);
            }
        });

        const select = document.getElementById('historialUserFilter');
        if (!select) return;

        select.innerHTML = '<option value="">Todos los usuarios</option>';

        // Ordenar por nombre
        const sortedUsers = Array.from(usersMap.entries()).sort((a, b) =>
            a[1].localeCompare(b[1])
        );

        sortedUsers.forEach(([userId, userName]) => {
            const option = document.createElement('option');
            option.value = userId;
            option.textContent = `${userName} (${formatPhone(userId)})`;
            select.appendChild(option);
        });

        console.log(`✅ ${usersMap.size} usuarios disponibles`);

    } catch (error) {
        console.error('❌ Error cargando usuarios:', error);
    }
}

// ============================================
// CARGA DE HISTORIAL
// ============================================

async function buscarHistorial() {
    const companyId = document.getElementById('historialCompanyFilter').value;
    const userId = document.getElementById('historialUserFilter').value;
    const senderType = document.getElementById('historialTypeFilter').value;
    const limit = parseInt(document.getElementById('historialLimitFilter').value);

    if (!companyId) {
        alert('Por favor selecciona una empresa');
        return;
    }

    console.log('🔍 Buscando historial:', { companyId, userId, senderType, limit });

    // Reset paginación
    historialCurrentPage = 1;

    const container = document.getElementById('historialMessagesContainer');
    if (!container) return;

    container.innerHTML = '<div class="text-center py-8"><i class="fas fa-spinner fa-spin text-3xl text-blue-600"></i><p class="mt-2">Cargando mensajes...</p></div>';

    try {
        // Construir URL
        const params = new URLSearchParams({
            company_id: companyId,
            limit: limit
        });

        if (userId) params.append('user_id', userId);
        if (senderType) params.append('sender_type', senderType);

        const url = `${API_BASE_URL}/api/chat/messages/history?${params}`;
        console.log('📍 URL:', url);

        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${getToken() || localStorage.getItem('token')}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Error ${response.status}: ${error}`);
        }

        const data = await response.json();
        const messages = data.messages || [];

        console.log(`✅ ${messages.length} mensajes obtenidos`);

        historialCurrentMessages = messages;
        historialTotalMessages = messages.length;

        actualizarEstadisticasHistorial(messages);
        mostrarMensajesHistorialPaginado();
        renderizarPaginacionHistorial();

    } catch (error) {
        console.error('❌ Error cargando historial:', error);
        container.innerHTML = `
            <div class="text-center text-red-600 py-8">
                <i class="fas fa-exclamation-circle text-3xl mb-2"></i>
                <p>Error al cargar mensajes</p>
                <p class="text-sm mt-2">${error.message}</p>
            </div>
        `;
    }
}


// ================================
// 🆕 CLOUDINARY THUMBNAILS (WSP STYLE)
// ================================
// function getCloudinaryThumbnail({ url, type }) {
//     if (!url) return null;

//     // PDF → imagen (página 1)
//     if (type === 'document' && url.endsWith('.pdf')) {
//         console.log('✅ document, pdf cargado');
//         return url
//             .replace('/raw/upload/', '/image/upload/')
//             .replace('/upload/', '/upload/pg_1,w_300,q_auto,f_auto/')
//             .replace('.pdf', '.jpg');
//     }

//     // Video → frame inicial
//     if (type === 'video') {
//         console.log('✅ video cargado');
//         return url.replace(
//             '/video/upload/',
//             '/video/upload/so_0,w_300,q_auto,f_jpg/'
//         );
//     }

//     // Imagen optimizada
//     if (type === 'image') {
//         return url.replace(
//             '/upload/',
//             '/upload/w_300,q_auto,f_auto/'
//         );
//     }

//     return null;
// }
function getCloudinaryThumbnail({ type, cloudinaryUrl, cloudinaryId, mimeType }) {

    // 📄 PDF → usar cloudinary_url versionada
    if (type === 'document' && cloudinaryUrl) {
        return cloudinaryUrl.replace(
            '/image/upload/',
            '/image/upload/pg_1,w_300,q_auto,f_auto/'
        );
    }

    // 🖼️ Imagen
    if (type === 'image' && cloudinaryId) {
        const ext = mimeType?.split('/')[1] || 'jpg';
        return `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/w_300,q_auto,f_auto/${cloudinaryId}.${ext}`;
    }

    // 🎥 Video
    if (type === 'video' && cloudinaryId) {
        return `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/video/upload/so_0,w_300,q_auto,f_jpg/${cloudinaryId}`;
    }

    return null;
}

// ============================================
// DISPLAY DE MENSAJES
// ============================================

function mostrarMensajesHistorialPaginado() {
    const container = document.getElementById('historialMessagesContainer');
    if (!container) return;

    if (historialCurrentMessages.length === 0) {
        container.innerHTML = `
            <div class="text-center text-gray-500 py-12">
                <i class="fas fa-inbox text-4xl mb-4"></i>
                <p>No se encontraron mensajes con los filtros seleccionados</p>
            </div>
        `;
        return;
    }

    // Calcular rango de mensajes para la página actual
    const startIndex = (historialCurrentPage - 1) * historialItemsPerPage;
    const endIndex = Math.min(startIndex + historialItemsPerPage, historialCurrentMessages.length);
    const mensajesPagina = historialCurrentMessages.slice(startIndex, endIndex);

    container.innerHTML = '';

    mensajesPagina.forEach((msg, index) => {
        const messageDiv = document.createElement('div');

       messageDiv.className = 'rounded-lg border border-green-100 bg-sky-50 p-4 mb-4';



        const isUser = msg.sender_type === 'user' || msg.role === 'user';
        const icon = isUser ? 'fa-user' : 'fa-robot';
        const iconColor = isUser ? 'text-blue-600' : 'text-green-600';
        const label = isUser ? 'Usuario' : 'Asistente';

        const displayName = isUser
            ? `${msg.profile_name || 'Usuario'} (${formatPhone(msg.user_id)})`
            : msg.bot_name || 'Asistente';

        const timestamp = formatTimestamp(msg.timestamp);

        // Badges de tipo y fuente
        const typeBadge = getBadgeTipo(msg.type);
        const sourceBadge = getBadgeFuente(msg.source);



        // ================================
        // 🖼️ MANEJO DE MEDIA (PREVIEW TIPO WSP)
        // ================================
        console.log('MSG REVIEW DEBUG:', msg.message_id, msg.review);

        let mediaContent = '';

        if (msg.cloudinary_url) {
            const fileInfo = obtenerInfoArchivo(msg.cloudinary_url, msg.type, msg.mime_type);
            // 📄 PDF con preview real
            if (msg.type === 'document' && msg.mime_type === 'application/pdf') {
                const previewUrl = getCloudinaryThumbnail({
                    type: 'document',
                    cloudinaryUrl: msg.cloudinary_url
                });

                mediaContent = `
                    <div class="mt-2">
                        <img 
                            src="${previewUrl}"
                            class="w-40 h-40 object-cover rounded-lg border cursor-pointer hover:shadow-md transition"
                            loading="lazy"
                            onclick='abrirModalArchivo(${JSON.stringify({
                    url: msg.cloudinary_url,
                    type: "document",
                    mime_type: msg.mime_type,
                    nombre: displayName,
                    timestamp: timestamp
                })})'
                        />
                        <p class="text-xs text-gray-500 mt-1 flex items-center gap-1">
                            <i class="fas fa-file-pdf text-red-500"></i> Documento PDF
                        </p>
                    </div>
                `;
            }

            // 🎥 Video con thumbnail
            else if (msg.type === 'video') {
                const previewUrl = getCloudinaryThumbnail({
                    type: 'video',
                    cloudinaryId: msg.cloudinary_id
                });

                mediaContent = `
                    <div class="mt-2 relative w-40 h-40 cursor-pointer"
                        onclick='abrirModalArchivo(${JSON.stringify({
                    url: msg.cloudinary_url,
                    type: "video",
                    mime_type: msg.mime_type,
                    nombre: displayName,
                    timestamp: timestamp
                })})'>
                        
                        <img 
                            src="${previewUrl}"
                            class="w-full h-full object-cover rounded-lg border"
                        />
                        
                        <div class="absolute inset-0 flex items-center justify-center">
                            <div class="bg-black bg-opacity-60 rounded-full p-3">
                                <i class="fas fa-play text-white text-xl"></i>
                            </div>
                        </div>
                    </div>
                `;
            }

            // 🖼️ Imagen (más chica)
            else if (msg.type === 'image') {
                const previewUrl = getCloudinaryThumbnail({
                    type: 'image',
                    cloudinaryId: msg.cloudinary_id,
                    mimeType: msg.mime_type   // 👈 IMPORTANTE
                });

                mediaContent = `
                    <div class="mt-2">
                        <img 
                            src="${previewUrl}"
                            class="w-40 h-40 object-cover rounded-lg border cursor-pointer hover:shadow-md transition"
                            loading="lazy"
                            onclick='abrirModalArchivo(${JSON.stringify({
                    url: msg.cloudinary_url,
                    type: "image",
                    mime_type: msg.mime_type,
                    nombre: displayName,
                    timestamp: timestamp
                })})'
                        />
                    </div>
                `;
            }
            else {
                // Otros archivos: mostrar tarjeta
                mediaContent = `
                    <div class="mt-2">
                        <div 
                            class="inline-flex items-center px-4 py-3 bg-white border-2 border-gray-300 rounded-lg hover:border-blue-500 hover:shadow-md cursor-pointer transition group"
                            onclick='abrirModalArchivo(${JSON.stringify({
                    url: msg.cloudinary_url,
                    type: msg.type,
                    mime_type: msg.mime_type,
                    nombre: displayName,
                    timestamp: timestamp
                })})'
                        >
                            <div class="flex items-center space-x-3">
                                <div class="flex-shrink-0 w-12 h-12 flex items-center justify-center rounded ${fileInfo.bgColor}">
                                    <i class="${fileInfo.icon} ${fileInfo.iconColor} text-xl"></i>
                                </div>
                                <div class="flex-1 min-w-0">
                                    <p class="text-sm font-medium text-gray-900 group-hover:text-blue-600">
                                        ${fileInfo.label}
                                    </p>
                                    <p class="text-xs text-gray-500">
                                        Click para ver
                                    </p>
                                </div>
                                <i class="fas fa-external-link-alt text-gray-400 group-hover:text-blue-600"></i>
                            </div>
                        </div>
                    </div>
                `;
            }
        }

        //const isChecked = !!msg.review?.checked;

        // Normalizar fecha si viene desde Mongo como { $date: ... }
        const checkedAt = msg.review?.checked_at?.$date || msg.review?.checked_at || null;
        const isChecked = msg.review && msg.review.checked === true;

messageDiv.innerHTML = `
<div class="flex flex-col items-start gap-2">
  <div class="w-full">

    <!-- Header -->
    <div class="flex items-center space-x-2 mb-2 flex-wrap">
      <i class="fas ${icon} ${iconColor}"></i>
      <span class="text-xs text-gray-500">${label}</span>
      <span class="font-semibold text-gray-900">${displayName}</span>
      <span class="text-xs text-gray-400">${timestamp}</span>
      ${sourceBadge}
      ${typeBadge}
    </div>

    ${mediaContent || ''}

    ${msg.message_id ? `<p class="text-xs text-gray-400 mt-1">ID: ${msg.message_id.substring(0, 20)}...</p>` : ''}

${isUser ? `
  <!-- 💬 BURBUJA MENSAJE USUARIO -->
<div class="mt-3 space-y-2"> 
<div class="flex justify-start"> 
<div class="bg-blue-100 border border-blue-300 rounded-lg p-2 text-sm max-w-[70%] shadow-sm">
 <p class="text-gray-800 whitespace-pre-wrap text-left">${escapeHtml(msg.text || msg.content || '')}</p> 
 <p class="text-xs text-gray-600 mt-1 text-left"> ${timestamp} 
 </p> 
 </div> 
 </div> 
 </div>

  <!-- 📨 RESPUESTAS HUMANAS -->
  ${Array.isArray(msg.responses) && msg.responses.length > 0 ? `
    <div class="mt-3 space-y-2">
      ${msg.responses.map(resp => `
        <div class="flex justify-end">
          <div class="bg-emerald-100 border border-emerald-300 rounded-lg p-2 text-sm max-w-[50%] shadow-sm">
            <p class="text-gray-800 whitespace-pre-wrap">${escapeHtml(resp.text || '')}</p>
            <p class="text-xs text-gray-600 mt-1 text-right">
              Enviado por <strong>${escapeHtml(resp.sent_by?.name || '—')}</strong>
              ${resp.sent_at ? `· ${formatTimestamp(resp.sent_at)}` : ''}
            </p>
          </div>
        </div>
      `).join('')}
    </div>
  ` : ''}

  <!-- 🔽 PANEL INTERNO -->
 <div class="mt-3 border-t pt-2 bg-yellow-50/60 rounded px-2 pb-2">
    <!-- Botón toggle -->
    <button
        type="button"
        class="text-xs text-blue-600 hover:underline mb-2"
        onclick="toggleNotasInternas('${msg.message_id}')"
    >
        📝 Notas internas (mostrar / ocultar)
    </button>

      <!-- Contenido colapsable -->
    <div id="notas-${msg.message_id}" class="hidden">

    <!-- Observaciones -->
    <div class="mb-2">
      <label class="text-xs text-gray-600 block mb-1">
        📝 Observaciones internas (no se envían al usuario)
      </label>

      <textarea
        class="w-full text-sm border rounded p-2 resize-none"
        rows="2"
        placeholder="Agregar observación interna..."
        oninput="guardarObservacionMensaje('${msg.message_id}', this.value)"
      >${msg.review?.observation || ''}</textarea>
        </div>
    </div> 
    <!-- fin notas-${msg.message_id} -->
    
    <!-- Estado + acciones -->
    
    <div class="flex items-center justify-between mt-2">

      <div class="text-xs text-gray-600 flex items-center gap-2">
        ${isChecked ? `
          <span class="inline-flex items-center gap-1 text-green-700 font-medium">
            ✔ Revisado
          </span>
          <span>
            por <strong>${msg.review?.checked_by?.name || '—'}</strong>
            ${checkedAt ? `· ${formatTimestamp(checkedAt)}` : ''}
          </span>
        ` : `
          <span class="text-gray-400 text-sm">No revisado</span>
        `}
      </div>

      <div class="flex items-center gap-2">
        <button
          onclick="abrirModalResponder('${msg.message_id}')"
          class="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition">
          Responder
        </button>

        <label class="flex items-center gap-2 text-sm cursor-pointer">
          <input 
            type="checkbox"
            class="form-checkbox h-5 w-5 text-green-600"
            ${isChecked ? 'checked' : ''}
            onchange="toggleMensajeRevisado('${msg.message_id}', this.checked)"
          />
          <span>Revisado</span>
        </label>
      </div>

    </div>
  </div>
` : `
  <!-- 🤖 BURBUJA MENSAJE ASISTENTE -->
    <div class="mt-3 space-y-2"> 
        <div class="flex justify-start"> 
            <div class="bg-emerald-50 border border-emerald-300 rounded-lg p-2 text-sm max-w-[70%] shadow-sm">
                <p class="text-gray-800 whitespace-pre-wrap text-left">${escapeHtml(msg.text || msg.content || '')}</p> 
                <p class="text-xs text-gray-600 mt-1 text-left"> ${timestamp} </p> 
            </div> 
        </div> 
    </div>

`}   

  </div>
</div>
`;


        container.appendChild(messageDiv);
    });

    // Actualizar contador
    const countEl = document.getElementById('historialMessageCount');
    if (countEl) {
        countEl.textContent = `(${startIndex + 1}-${endIndex} de ${historialTotalMessages})`;
    }
}

// Función para obtener información del archivo según tipo/extensión
function obtenerInfoArchivo(url, type, mimeType) {
    // Determinar tipo por extensión si no hay mime_type
    const ext = url.split('.').pop().toLowerCase().split('?')[0];

    const tiposArchivo = {
        // Imágenes
        'image': { icon: 'fas fa-image', bgColor: 'bg-purple-100', iconColor: 'text-purple-600', label: 'Imagen' },

        // PDFs
        'pdf': { icon: 'fas fa-file-pdf', bgColor: 'bg-red-100', iconColor: 'text-red-600', label: 'Documento PDF' },

        // Word
        'doc': { icon: 'fas fa-file-word', bgColor: 'bg-blue-100', iconColor: 'text-blue-600', label: 'Documento Word' },
        'docx': { icon: 'fas fa-file-word', bgColor: 'bg-blue-100', iconColor: 'text-blue-600', label: 'Documento Word' },

        // Excel
        'xls': { icon: 'fas fa-file-excel', bgColor: 'bg-green-100', iconColor: 'text-green-600', label: 'Hoja de cálculo' },
        'xlsx': { icon: 'fas fa-file-excel', bgColor: 'bg-green-100', iconColor: 'text-green-600', label: 'Hoja de cálculo' },
        'csv': { icon: 'fas fa-file-csv', bgColor: 'bg-green-100', iconColor: 'text-green-600', label: 'Archivo CSV' },

        // PowerPoint
        'ppt': { icon: 'fas fa-file-powerpoint', bgColor: 'bg-orange-100', iconColor: 'text-orange-600', label: 'Presentación' },
        'pptx': { icon: 'fas fa-file-powerpoint', bgColor: 'bg-orange-100', iconColor: 'text-orange-600', label: 'Presentación' },

        // Videos
        'video': { icon: 'fas fa-file-video', bgColor: 'bg-red-100', iconColor: 'text-red-600', label: 'Video' },
        'mp4': { icon: 'fas fa-file-video', bgColor: 'bg-red-100', iconColor: 'text-red-600', label: 'Video' },
        'avi': { icon: 'fas fa-file-video', bgColor: 'bg-red-100', iconColor: 'text-red-600', label: 'Video' },
        'mov': { icon: 'fas fa-file-video', bgColor: 'bg-red-100', iconColor: 'text-red-600', label: 'Video' },

        // Audio
        'audio': { icon: 'fas fa-file-audio', bgColor: 'bg-indigo-100', iconColor: 'text-indigo-600', label: 'Audio' },
        'mp3': { icon: 'fas fa-file-audio', bgColor: 'bg-indigo-100', iconColor: 'text-indigo-600', label: 'Audio' },
        'wav': { icon: 'fas fa-file-audio', bgColor: 'bg-indigo-100', iconColor: 'text-indigo-600', label: 'Audio' },
        'ogg': { icon: 'fas fa-file-audio', bgColor: 'bg-indigo-100', iconColor: 'text-indigo-600', label: 'Audio' },

        // Otros
        'txt': { icon: 'fas fa-file-alt', bgColor: 'bg-gray-100', iconColor: 'text-gray-600', label: 'Archivo de texto' },
        'zip': { icon: 'fas fa-file-archive', bgColor: 'bg-yellow-100', iconColor: 'text-yellow-600', label: 'Archivo comprimido' },
        'rar': { icon: 'fas fa-file-archive', bgColor: 'bg-yellow-100', iconColor: 'text-yellow-600', label: 'Archivo comprimido' }
    };

    // Buscar por tipo primero
    if (type && tiposArchivo[type]) {
        return tiposArchivo[type];
    }

    // Buscar por extensión
    if (ext && tiposArchivo[ext]) {
        return tiposArchivo[ext];
    }

    // Default
    return { icon: 'fas fa-file', bgColor: 'bg-gray-100', iconColor: 'text-gray-600', label: 'Archivo adjunto' };
}

// Función para obtener badge de tipo de mensaje
function getBadgeTipo(type) {
    if (!type) return '';

    const tipos = {
        'text': { icon: 'fa-align-left', color: 'bg-gray-100 text-gray-700', label: 'Texto' },
        'image': { icon: 'fa-image', color: 'bg-purple-100 text-purple-700', label: 'Imagen' },
        'video': { icon: 'fa-video', color: 'bg-red-100 text-red-700', label: 'Video' },
        'audio': { icon: 'fa-microphone', color: 'bg-blue-100 text-blue-700', label: 'Audio' },
        'document': { icon: 'fa-file', color: 'bg-yellow-100 text-yellow-700', label: 'Documento' },
        'location': { icon: 'fa-map-marker-alt', color: 'bg-green-100 text-green-700', label: 'Ubicación' },
        'sticker': { icon: 'fa-smile', color: 'bg-pink-100 text-pink-700', label: 'Sticker' }
    };

    const config = tipos[type] || { icon: 'fa-question', color: 'bg-gray-100 text-gray-700', label: type };

    return `
        <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${config.color}">
            <i class="fas ${config.icon} mr-1"></i>
            ${config.label}
        </span>
    `;
}

// Función para obtener badge de fuente
function getBadgeFuente(source) {
    if (!source) return '';

    const fuentes = {
        'whatsapp': { icon: 'fa-whatsapp', color: 'bg-green-100 text-green-700', label: 'WhatsApp' },
        'facebook': { icon: 'fa-facebook', color: 'bg-blue-100 text-blue-700', label: 'Facebook' },
        'instagram': { icon: 'fa-instagram', color: 'bg-pink-100 text-pink-700', label: 'Instagram' },
        'messenger': { icon: 'fa-facebook-messenger', color: 'bg-blue-100 text-blue-700', label: 'Messenger' },
        'telegram': { icon: 'fa-telegram', color: 'bg-sky-100 text-sky-700', label: 'Telegram' },
        'web': { icon: 'fa-globe', color: 'bg-indigo-100 text-indigo-700', label: 'Web' },
        'api': { icon: 'fa-code', color: 'bg-gray-100 text-gray-700', label: 'API' }
    };

    const config = fuentes[source.toLowerCase()] || { icon: 'fa-question', color: 'bg-gray-100 text-gray-700', label: source };

    return `
        <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${config.color}">
            <i class="fab ${config.icon} mr-1"></i>
            ${config.label}
        </span>
    `;
}

// ============================================
// PAGINACIÓN
// ============================================

function renderizarPaginacionHistorial() {
    const container = document.getElementById('historialPaginationControls');
    if (!container) return;

    const totalPages = Math.ceil(historialTotalMessages / historialItemsPerPage);

    if (totalPages <= 1) {
        container.innerHTML = '';
        return;
    }

    let html = `
        <div class="flex items-center justify-between">
            <div class="flex items-center space-x-2">
                <span class="text-sm text-gray-600">Mostrar:</span>
                <select onchange="cambiarItemsPorPaginaHistorial(this.value)" class="px-2 py-1 border rounded text-sm">
                    <option value="10" ${historialItemsPerPage === 10 ? 'selected' : ''}>10</option>
                    <option value="20" ${historialItemsPerPage === 20 ? 'selected' : ''}>20</option>
                    <option value="50" ${historialItemsPerPage === 50 ? 'selected' : ''}>50</option>
                    <option value="100" ${historialItemsPerPage === 100 ? 'selected' : ''}>100</option>
                </select>
                <span class="text-sm text-gray-600">por página</span>
            </div>
            
            <div class="flex items-center space-x-1">
    `;

    // Botón Anterior
    html += `
        <button 
            onclick="cambiarPaginaHistorial(${historialCurrentPage - 1})"
            ${historialCurrentPage === 1 ? 'disabled' : ''}
            class="px-3 py-1 rounded border ${historialCurrentPage === 1
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
            : 'bg-white text-gray-700 hover:bg-gray-50'
        }"
        >
            <i class="fas fa-chevron-left"></i>
        </button>
    `;

    // Números de página
    const maxVisible = 5;
    let startPage = Math.max(1, historialCurrentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);

    if (endPage - startPage < maxVisible - 1) {
        startPage = Math.max(1, endPage - maxVisible + 1);
    }

    if (startPage > 1) {
        html += `
            <button onclick="cambiarPaginaHistorial(1)" class="px-3 py-1 rounded border bg-white text-gray-700 hover:bg-gray-50">1</button>
        `;
        if (startPage > 2) {
            html += `<span class="px-2 text-gray-400">...</span>`;
        }
    }

    for (let i = startPage; i <= endPage; i++) {
        html += `
            <button 
                onclick="cambiarPaginaHistorial(${i})"
                class="px-3 py-1 rounded border ${i === historialCurrentPage
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }"
            >
                ${i}
            </button>
        `;
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            html += `<span class="px-2 text-gray-400">...</span>`;
        }
        html += `
            <button onclick="cambiarPaginaHistorial(${totalPages})" class="px-3 py-1 rounded border bg-white text-gray-700 hover:bg-gray-50">${totalPages}</button>
        `;
    }

    // Botón Siguiente
    html += `
        <button 
            onclick="cambiarPaginaHistorial(${historialCurrentPage + 1})"
            ${historialCurrentPage === totalPages ? 'disabled' : ''}
            class="px-3 py-1 rounded border ${historialCurrentPage === totalPages
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
            : 'bg-white text-gray-700 hover:bg-gray-50'
        }"
        >
            <i class="fas fa-chevron-right"></i>
        </button>
    `;

    html += `
            </div>
        </div>
    `;

    container.innerHTML = html;
}

function cambiarPaginaHistorial(page) {
    const totalPages = Math.ceil(historialTotalMessages / historialItemsPerPage);

    if (page < 1 || page > totalPages) return;

    historialCurrentPage = page;
    mostrarMensajesHistorialPaginado();
    renderizarPaginacionHistorial();

    // Scroll al inicio de los mensajes
    document.getElementById('historialMessagesContainer')?.scrollIntoView({ behavior: 'smooth' });
}

function cambiarItemsPorPaginaHistorial(items) {
    historialItemsPerPage = parseInt(items);
    historialCurrentPage = 1;
    mostrarMensajesHistorialPaginado();
    renderizarPaginacionHistorial();
}

// ============================================
// ESTADÍSTICAS
// ============================================

function actualizarEstadisticasHistorial(messages) {
    const total = messages.length;
    const userMsgs = messages.filter(m => m.sender_type === 'user' || m.role === 'user').length;
    const assistantMsgs = messages.filter(m => m.sender_type === 'assistant' || m.role === 'assistant').length;

    // Contar conversaciones únicas
    const uniqueUsers = new Set(messages.map(m => m.user_id)).size;

    const totalEl = document.getElementById('historialTotalMessages');
    const userEl = document.getElementById('historialUserMessages');
    const assistantEl = document.getElementById('historialAssistantMessages');
    const convsEl = document.getElementById('historialTotalConversations');

    if (totalEl) totalEl.textContent = total;
    if (userEl) userEl.textContent = userMsgs;
    if (assistantEl) assistantEl.textContent = assistantMsgs;
    if (convsEl) convsEl.textContent = uniqueUsers;
}

// ============================================
// UTILIDADES
// ============================================

function limpiarFiltrosHistorial() {
    const userSelect = document.getElementById('historialUserFilter');
    const typeSelect = document.getElementById('historialTypeFilter');
    const limitSelect = document.getElementById('historialLimitFilter');

    if (userSelect) userSelect.value = '';
    if (typeSelect) typeSelect.value = '';
    if (limitSelect) limitSelect.value = '100';

    const container = document.getElementById('historialMessagesContainer');
    if (container) {
        container.innerHTML = `
            <div class="text-center text-gray-500 py-12">
                <i class="fas fa-search text-4xl mb-4"></i>
                <p class="text-lg font-medium">Selecciona los filtros y presiona "Buscar"</p>
                <p class="text-sm mt-2">Podrás ver y exportar el historial de mensajes</p>
            </div>
        `;
    }

    // Reset stats
    const totalEl = document.getElementById('historialTotalMessages');
    const userEl = document.getElementById('historialUserMessages');
    const assistantEl = document.getElementById('historialAssistantMessages');
    const convsEl = document.getElementById('historialTotalConversations');
    const countEl = document.getElementById('historialMessageCount');

    if (totalEl) totalEl.textContent = '0';
    if (userEl) userEl.textContent = '0';
    if (assistantEl) assistantEl.textContent = '0';
    if (convsEl) convsEl.textContent = '0';
    if (countEl) countEl.textContent = '(0 cargados)';
}

function exportarHistorial() {
    if (historialCurrentMessages.length === 0) {
        alert('No hay mensajes para exportar');
        return;
    }

    // Crear CSV
    let csv = 'Fecha,Hora,Tipo,Usuario,Teléfono,Mensaje\n';

    historialCurrentMessages.forEach(msg => {
        const date = new Date(msg.timestamp);
        const dateStr = date.toLocaleDateString('es-CL');
        const timeStr = date.toLocaleTimeString('es-CL');
        const type = msg.sender_type === 'user' || msg.role === 'user' ? 'Usuario' : 'Asistente';
        const name = msg.profile_name || 'N/A';
        const phone = msg.user_id || 'N/A';
        const text = (msg.text || msg.content || '').replace(/"/g, '""');

        csv += `"${dateStr}","${timeStr}","${type}","${name}","${phone}","${text}"\n`;
    });

    // Descargar
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `historial_${historialCurrentCompanyId}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();

    console.log('✅ CSV exportado');
}

function formatPhone(phone) {
    if (!phone) return '';
    // Formato: +56 9 9874 5476
    if (phone.startsWith('56') && phone.length === 11) {
        return `+${phone.substring(0, 2)} ${phone.substring(2, 3)} ${phone.substring(3, 7)} ${phone.substring(7)}`;
    }
    return phone;
}

function formatTimestamp(timestamp) {
    if (!timestamp) return '';

    try {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) return 'Ahora';
        if (diffMins < 60) return `Hace ${diffMins}m`;

        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `Hace ${diffHours}h`;

        const diffDays = Math.floor(diffHours / 24);
        if (diffDays < 7) return `Hace ${diffDays}d`;

        return date.toLocaleDateString('es-CL', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (e) {
        return timestamp;
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================
// MODAL DE ARCHIVOS
// ============================================

function abrirModalArchivo(fileData) {
    const { url, type, mime_type, nombre, timestamp } = fileData;

    // Crear modal si no existe
    let modal = document.getElementById('fileModal');

    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'fileModal';
        modal.className = 'fixed inset-0 z-50 hidden items-center justify-center bg-black bg-opacity-75 p-4';
        modal.innerHTML = `
            <div class="relative w-full max-w-6xl max-h-screen flex flex-col bg-white rounded-lg overflow-hidden">
                <button 
                    onclick="cerrarModalArchivo()" 
                    class="absolute top-4 right-4 z-10 text-gray-600 hover:text-gray-900 bg-white hover:bg-gray-100 rounded-full w-10 h-10 flex items-center justify-center transition shadow-lg"
                >
                    <i class="fas fa-times text-xl"></i>
                </button>
                
                <!-- Header -->
                <div class="p-4 border-b bg-gray-50 flex-shrink-0">
                    <p class="font-semibold text-gray-900" id="modalFileName"></p>
                    <p class="text-sm text-gray-500" id="modalFileTime"></p>
                </div>
                
                <!-- Content -->
                <div class="flex-1 overflow-auto bg-gray-100" id="modalFileContent" style="min-height: 400px;">
                    <!-- Contenido dinámico -->
                </div>
                
                <!-- Footer -->
                <div class="p-4 border-t bg-gray-50 flex justify-between items-center flex-shrink-0">
                    <a 
                        id="modalFileDownload" 
                        href="" 
                        download 
                        class="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                    >
                        <i class="fas fa-download mr-2"></i> Descargar
                    </a>
                    <a 
                        id="modalFileOpen" 
                        href="" 
                        target="_blank"
                        class="inline-flex items-center px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition"
                    >
                        <i class="fas fa-external-link-alt mr-2"></i> Abrir en nueva pestaña
                    </a>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        // Cerrar con ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
                cerrarModalArchivo();
            }
        });

        // Cerrar al hacer click fuera
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                cerrarModalArchivo();
            }
        });
    }

    // Actualizar header y footer
    document.getElementById('modalFileName').textContent = nombre;
    document.getElementById('modalFileTime').textContent = timestamp;
    document.getElementById('modalFileDownload').href = url;
    document.getElementById('modalFileOpen').href = url;

    // Generar contenido según tipo de archivo
    const contentDiv = document.getElementById('modalFileContent');
    contentDiv.innerHTML = generarVistaPrevia(url, type, mime_type);

    // Mostrar modal
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function generarVistaPrevia(url, type, mimeType) {
    const ext = url.split('.').pop().toLowerCase().split('?')[0];

    // IMÁGENES
    if (type === 'image' || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext)) {
        return `
            <div class="flex items-center justify-center p-4 h-full">
                <img 
                    src="${url}" 
                    alt="Imagen" 
                    class="max-w-full max-h-full object-contain"
                    style="max-height: calc(100vh - 250px);"
                />
            </div>
        `;
    }

    // PDFs
    if (type === 'document' && ext === 'pdf' || ext === 'pdf') {
        return `
            <iframe 
                src="${url}" 
                class="w-full h-full" 
                style="min-height: 600px;"
                frameborder="0"
            ></iframe>
        `;
    }

    // VIDEOS
    if (type === 'video' || ['mp4', 'webm', 'ogg', 'mov'].includes(ext)) {
        return `
            <div class="flex items-center justify-center p-4 h-full bg-black">
                <video 
                    controls 
                    class="max-w-full max-h-full"
                    style="max-height: calc(100vh - 250px);"
                >
                    <source src="${url}" type="video/${ext}">
                    Tu navegador no soporta la reproducción de video.
                </video>
            </div>
        `;
    }

    // AUDIO
    if (type === 'audio' || ['mp3', 'wav', 'ogg', 'm4a'].includes(ext)) {
        return `
            <div class="flex flex-col items-center justify-center p-8 h-full">
                <div class="mb-4">
                    <i class="fas fa-volume-up text-6xl text-blue-600"></i>
                </div>
                <audio controls class="w-full max-w-md">
                    <source src="${url}" type="audio/${ext}">
                    Tu navegador no soporta la reproducción de audio.
                </audio>
            </div>
        `;
    }

    // DOCUMENTOS DE OFFICE (Word, Excel, PowerPoint)
    if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext)) {
        // Usar Office Online Viewer de Microsoft
        const viewerUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`;
        return `
            <iframe 
                src="${viewerUrl}" 
                class="w-full h-full" 
                style="min-height: 600px;"
                frameborder="0"
            ></iframe>
        `;
    }

    // TEXTO PLANO
    if (ext === 'txt') {
        // Cargar y mostrar contenido de texto
        return `
            <div class="p-8">
                <pre class="bg-white p-4 rounded border text-sm" id="textContent">Cargando...</pre>
            </div>
            <script>
                fetch('${url}')
                    .then(r => r.text())
                    .then(text => {
                        document.getElementById('textContent').textContent = text;
                    })
                    .catch(err => {
                        document.getElementById('textContent').textContent = 'Error al cargar el archivo';
                    });
            </script>
        `;
    }

    // OTROS ARCHIVOS - No se puede previsualizar
    const fileInfo = obtenerInfoArchivo(url, type, mimeType);
    return `
        <div class="flex flex-col items-center justify-center p-12 h-full text-center">
            <div class="w-24 h-24 flex items-center justify-center rounded-full ${fileInfo.bgColor} mb-4">
                <i class="${fileInfo.icon} ${fileInfo.iconColor} text-4xl"></i>
            </div>
            <p class="text-lg font-semibold text-gray-900 mb-2">${fileInfo.label}</p>
            <p class="text-sm text-gray-500 mb-6">
                No se puede previsualizar este tipo de archivo en el navegador
            </p>
            <a 
                href="${url}" 
                download 
                class="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
                <i class="fas fa-download mr-2"></i> Descargar archivo
            </a>
        </div>
    `;
}

function cerrarModalArchivo() {
    const modal = document.getElementById('fileModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');

        // Limpiar contenido para liberar recursos
        const contentDiv = document.getElementById('modalFileContent');
        if (contentDiv) {
            contentDiv.innerHTML = '';
        }
    }
}

// Modal respuesta al usuario


function abrirModalResponder(messageId) {
    modalResponderMessageId = messageId;

    const modal = document.getElementById("modalResponder");
    if (!modal) {
        console.error("❌ No existe modalResponder en el DOM");
        return;
    }

    // Limpia campos
    const txt = document.getElementById("modalResponderTexto");
    const file = document.getElementById("modalResponderArchivo");
    if (txt) txt.value = "";
    if (file) file.value = "";

    modal.classList.remove("hidden");
    modal.classList.add("flex");
}


function cerrarModalResponder() {
    const modal = document.getElementById("modalResponder");
    if (!modal) return;

    modal.classList.add("hidden");
    modal.classList.remove("flex");

    modalResponderMessageId = null;
}


const autosaveTimers = {};

function guardarObservacionMensaje(messageId, value) {
    // Debounce: espera 600ms desde la última tecla
    if (autosaveTimers[messageId]) {
        clearTimeout(autosaveTimers[messageId]);
    }

    autosaveTimers[messageId] = setTimeout(async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/api/chat/messages/${messageId}/observation`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${getToken()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ observation: value })
            });

            if (!res.ok) throw new Error('Error guardando observación');

            const data = await res.json();
            console.log('💾 Observación guardada', data);

            // Actualizar en memoria
            const msg = historialCurrentMessages.find(m => m.message_id === messageId);
            if (msg && data.review) {
                msg.review = data.review;
            }

        } catch (err) {
            console.error('❌ Error guardando observación', err);
        }
    }, 600);
}




async function toggleMensajeRevisado(messageId, checked) {
    try {
        const res = await fetch(`${API_BASE_URL}/api/chat/messages/${messageId}/review`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${getToken()}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ checked })
        });

        if (!res.ok) throw new Error('Error actualizando estado');

        const data = await res.json();
        console.log('✅ Estado revisado actualizado', data);

        // ✅ Usar el review REAL devuelto por backend
        const msg = historialCurrentMessages.find(m => m.message_id === messageId);
        if (msg && data.review) {
            msg.review = data.review;
        }

        // ✅ Re-render sin pantallazo
        mostrarMensajesHistorialPaginado();

    } catch (err) {
        console.error('❌ Error marcando revisado', err);
        alert('Error actualizando estado de revisión');
    }
}



let modalResponderMessageId = null;

async function enviarRespuestaModal() {
    if (!modalResponderMessageId) {
        alert("No hay mensaje seleccionado");
        return;
    }

    const texto = document.getElementById("modalResponderTexto").value.trim();
    const archivoInput = document.getElementById("modalResponderArchivo");
    const archivo = archivoInput.files[0] || null;

    if (!texto && !archivo) {
        alert("Escribe un mensaje o adjunta un archivo");
        return;
    }

    try {
        const formData = new FormData();
        formData.append("text", texto);
        if (archivo) {
            formData.append("file", archivo);
        }

        const res = await fetch(
            `${API_BASE_URL}/api/chat/messages/${modalResponderMessageId}/reply`,
            {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${getToken()}`
                    // ❗ No pongas Content-Type con FormData
                },
                body: formData
            }
        );

        if (!res.ok) {
            const errText = await res.text();
            throw new Error(errText || "Error enviando respuesta");
        }

        const data = await res.json();
        console.log("✅ Respuesta enviada", data);

        cerrarModalResponder();
        await buscarHistorial();  

    } catch (err) {
        console.error("❌ Error enviando respuesta", err);
        alert("Error enviando la respuesta");
    }
}
