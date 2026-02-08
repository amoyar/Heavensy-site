// ============================================
// MENSAJES - WEBHOOK TESTING
// ============================================

const WEBHOOK_BASE_URL = 'https://heavensy-api-webhook-v2.onrender.com';
const GRAPH_API_BASE = 'https://graph.facebook.com/v21.0';

let messagesSentCount = 0;
let messageHistory = [];

// ============================================
// INIT
// ============================================

function initMensajesPage() {
  console.log('✅ Página de mensajes iniciada');
  
  // Cargar configuración guardada
  loadSavedConfig();
  
  // Verificar estado del webhook
  testWebhookHealth();
  
  // Cargar historial desde localStorage
  loadMessageHistory();
}

// ============================================
// CONFIGURACIÓN
// ============================================

function loadSavedConfig() {
  const phoneId = localStorage.getItem('whatsapp_phone_id');
  const token = localStorage.getItem('whatsapp_token');
  const verifyToken = localStorage.getItem('whatsapp_verify_token');
  
  if (phoneId) document.getElementById('phoneNumberId').value = phoneId;
  if (token) document.getElementById('accessToken').value = token;
  if (verifyToken) document.getElementById('verifyToken').value = verifyToken;
}

function saveConfig() {
  const phoneId = document.getElementById('phoneNumberId').value;
  const token = document.getElementById('accessToken').value;
  const verifyToken = document.getElementById('verifyToken').value;
  
  if (phoneId) localStorage.setItem('whatsapp_phone_id', phoneId);
  if (token) localStorage.setItem('whatsapp_token', token);
  if (verifyToken) localStorage.setItem('whatsapp_verify_token', verifyToken);
}

function toggleTokenVisibility(inputId) {
  const input = document.getElementById(inputId);
  const icon = input.nextElementSibling.querySelector('i');
  
  if (input.type === 'password') {
    input.type = 'text';
    icon.classList.remove('fa-eye');
    icon.classList.add('fa-eye-slash');
  } else {
    input.type = 'password';
    icon.classList.remove('fa-eye-slash');
    icon.classList.add('fa-eye');
  }
}

// ============================================
// WEBHOOK HEALTH CHECK
// ============================================

async function testWebhookHealth() {
  const statusEl = document.getElementById('webhookStatus');
  
  try {
    statusEl.textContent = 'Verificando...';
    statusEl.className = 'text-2xl font-bold text-yellow-600';
    
    const response = await fetch(WEBHOOK_BASE_URL, {
      method: 'GET'
    });
    
    if (response.ok) {
      const data = await response.json();
      statusEl.textContent = '🟢 En línea';
      statusEl.className = 'text-2xl font-bold text-green-600';
      showToast('Webhook en línea correctamente', 'success');
    } else {
      throw new Error('Webhook no responde');
    }
  } catch (error) {
    console.error('Error verificando webhook:', error);
    statusEl.textContent = '🔴 Fuera de línea';
    statusEl.className = 'text-2xl font-bold text-red-600';
    showToast('Error conectando con el webhook', 'error');
  }
}

// ============================================
// ENVIAR MENSAJE DE PRUEBA
// ============================================

async function sendTestMessage() {
  // Validar campos
  const phoneId = document.getElementById('phoneNumberId').value.trim();
  const token = document.getElementById('accessToken').value.trim();
  const toNumber = document.getElementById('destinationNumber').value.trim();
  const messageText = document.getElementById('messageText').value.trim();
  
  if (!phoneId) {
    showToast('Phone Number ID es requerido', 'warning');
    return;
  }
  
  if (!token) {
    showToast('Access Token es requerido', 'warning');
    return;
  }
  
  if (!toNumber) {
    showToast('Número de destino es requerido', 'warning');
    return;
  }
  
  if (!messageText) {
    showToast('El mensaje no puede estar vacío', 'warning');
    return;
  }
  
  // Validar formato de número
  if (!toNumber.startsWith('+')) {
    showToast('El número debe incluir el código de país (ej: +56912345678)', 'warning');
    return;
  }
  
  // Guardar configuración
  saveConfig();
  
  try {
    showLoader('Enviando mensaje a WhatsApp...');
    
    // Construir URL de la Graph API
    const url = `${GRAPH_API_BASE}/${phoneId}/messages`;
    
    // Preparar payload
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: toNumber,
      type: 'text',
      text: {
        body: messageText
      }
    };
    
    // Enviar mensaje
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    const data = await response.json();
    
    if (response.ok) {
      // Éxito
      messagesSentCount++;
      document.getElementById('messagesSent').textContent = messagesSentCount;
      document.getElementById('lastResponse').textContent = new Date().toLocaleTimeString('es-CL');
      
      // Agregar al historial
      addToHistory({
        type: 'sent',
        to: toNumber,
        message: messageText,
        timestamp: new Date(),
        success: true,
        messageId: data.messages?.[0]?.id
      });
      
      showToast('✅ Mensaje enviado correctamente', 'success');
      
      // Limpiar campos
      document.getElementById('destinationNumber').value = '';
      document.getElementById('messageText').value = '';
      
    } else {
      // Error
      throw new Error(data.error?.message || 'Error enviando mensaje');
    }
    
  } catch (error) {
    console.error('Error:', error);
    
    // Agregar al historial como error
    addToHistory({
      type: 'sent',
      to: toNumber,
      message: messageText,
      timestamp: new Date(),
      success: false,
      error: error.message
    });
    
    showToast(`Error: ${error.message}`, 'error');
    
  } finally {
    hideLoader();
  }
}

// ============================================
// TEST IA REPLY
// ============================================

async function testAIReply() {
  const messageText = document.getElementById('messageText').value.trim();
  
  if (!messageText) {
    showToast('Escribe un mensaje para probar la IA', 'warning');
    return;
  }
  
  try {
    showLoader('Consultando IA...');
    
    const response = await fetch(`${WEBHOOK_BASE_URL}/api/ia/reply`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: messageText,
        user_id: 'admin_test'
      })
    });
    
    const data = await response.json();
    
    if (response.ok && data.reply) {
      // Mostrar respuesta de la IA
      showToast('✅ IA respondió correctamente', 'success');
      
      // Agregar al historial
      addToHistory({
        type: 'ai_test',
        message: messageText,
        reply: data.reply,
        timestamp: new Date(),
        success: true
      });
      
      // Mostrar modal con la respuesta
      showAIReplyModal(messageText, data.reply);
      
    } else {
      throw new Error(data.error || 'Error en respuesta de IA');
    }
    
  } catch (error) {
    console.error('Error:', error);
    showToast(`Error: ${error.message}`, 'error');
    
  } finally {
    hideLoader();
  }
}

function showAIReplyModal(userMessage, aiReply) {
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50';
  modal.innerHTML = `
    <div class="bg-white rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
      <div class="p-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-xl font-bold text-gray-900 flex items-center gap-2">
            <i class="fas fa-robot text-purple-600"></i>
            Respuesta de la IA
          </h3>
          <button onclick="this.closest('.fixed').remove()" class="text-gray-400 hover:text-gray-600">
            <i class="fas fa-times"></i>
          </button>
        </div>
        
        <div class="space-y-4">
          <div class="bg-blue-50 rounded-lg p-4">
            <p class="text-xs text-blue-600 font-semibold mb-2">Tu mensaje:</p>
            <p class="text-gray-800">${escapeHtml(userMessage)}</p>
          </div>
          
          <div class="bg-purple-50 rounded-lg p-4">
            <p class="text-xs text-purple-600 font-semibold mb-2">Respuesta de Claude:</p>
            <p class="text-gray-800 whitespace-pre-wrap">${escapeHtml(aiReply)}</p>
          </div>
        </div>
        
        <div class="mt-6 flex justify-end">
          <button 
            onclick="this.closest('.fixed').remove()"
            class="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
}

// ============================================
// HISTORIAL DE MENSAJES
// ============================================

function addToHistory(entry) {
  messageHistory.unshift(entry);
  
  // Limitar a 50 mensajes
  if (messageHistory.length > 50) {
    messageHistory = messageHistory.slice(0, 50);
  }
  
  // Guardar en localStorage
  localStorage.setItem('message_history', JSON.stringify(messageHistory));
  
  // Renderizar
  renderMessageHistory();
}

function loadMessageHistory() {
  const saved = localStorage.getItem('message_history');
  if (saved) {
    try {
      messageHistory = JSON.parse(saved);
      messagesSentCount = messageHistory.filter(m => m.type === 'sent' && m.success).length;
      document.getElementById('messagesSent').textContent = messagesSentCount;
      renderMessageHistory();
    } catch (e) {
      console.error('Error cargando historial:', e);
    }
  }
}

function renderMessageHistory() {
  const container = document.getElementById('messageHistory');
  
  if (messageHistory.length === 0) {
    container.innerHTML = `
      <div class="text-center text-gray-500 py-8">
        <i class="fas fa-inbox text-4xl mb-3"></i>
        <p>No hay mensajes enviados aún</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = messageHistory.map(entry => {
    const time = new Date(entry.timestamp).toLocaleString('es-CL');
    
    if (entry.type === 'sent') {
      return `
        <div class="border rounded-lg p-4 ${entry.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}">
          <div class="flex items-start justify-between mb-2">
            <div class="flex items-center gap-2">
              <i class="fas fa-${entry.success ? 'check-circle text-green-600' : 'times-circle text-red-600'}"></i>
              <span class="font-semibold text-sm">${entry.success ? 'Enviado' : 'Error'}</span>
            </div>
            <span class="text-xs text-gray-500">${time}</span>
          </div>
          <p class="text-sm text-gray-600 mb-1"><strong>Para:</strong> ${escapeHtml(entry.to)}</p>
          <p class="text-sm text-gray-800">${escapeHtml(entry.message)}</p>
          ${entry.error ? `<p class="text-xs text-red-600 mt-2">Error: ${escapeHtml(entry.error)}</p>` : ''}
          ${entry.messageId ? `<p class="text-xs text-gray-500 mt-2">ID: ${escapeHtml(entry.messageId)}</p>` : ''}
        </div>
      `;
    } else if (entry.type === 'ai_test') {
      return `
        <div class="border rounded-lg p-4 bg-purple-50 border-purple-200">
          <div class="flex items-start justify-between mb-2">
            <div class="flex items-center gap-2">
              <i class="fas fa-robot text-purple-600"></i>
              <span class="font-semibold text-sm">Test IA</span>
            </div>
            <span class="text-xs text-gray-500">${time}</span>
          </div>
          <p class="text-sm text-gray-600 mb-1"><strong>Pregunta:</strong> ${escapeHtml(entry.message)}</p>
          <p class="text-sm text-gray-800"><strong>Respuesta:</strong> ${escapeHtml(entry.reply).substring(0, 100)}${entry.reply.length > 100 ? '...' : ''}</p>
        </div>
      `;
    }
  }).join('');
}

function clearMessageHistory() {
  if (confirm('¿Estás seguro de que quieres limpiar el historial de mensajes?')) {
    messageHistory = [];
    messagesSentCount = 0;
    localStorage.removeItem('message_history');
    document.getElementById('messagesSent').textContent = '0';
    renderMessageHistory();
    showToast('Historial limpiado', 'info');
  }
}