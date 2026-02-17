// ============================================
// APP BASE – HEAVENSY ADMIN
// ============================================

const API_BASE_URL = 'https://heavensy-api-backend-v2.onrender.com';

// ============================================
// AUTH CHECK
// ============================================

// Verificar autenticación al cargar
function checkAuth() {
  const token = localStorage.getItem('token');
  const currentPage = window.location.pathname;
  
  // Si no hay token y no estamos en login, redirigir
  if (!token && !currentPage.includes('login.html')) {
    console.log('❌ No hay token, redirigiendo a login...');
    window.location.replace('login.html');
    return false;
  }
  
  return true;
}

// Ejecutar verificación al cargar la página
if (window.location.pathname.includes('index.html') || window.location.pathname.endsWith('/')) {
  checkAuth();
}

// Token helpers
function getToken() {
  return localStorage.getItem('token');
}

function getUserFromToken() {
  const token = getToken();
  if (!token) return null;

  try {
    const payload = token.split('.')[1];
    const decoded = JSON.parse(atob(payload));
    return decoded;
  } catch (e) {
    console.error("❌ Error decodificando JWT:", e);
    return null;
  }
}


// function updateSidebarCompanyTitle() {
//   const titleEl = document.getElementById("sidebarTitle");
//   if (!titleEl) return;

//   const user = getUserFromToken();
//   if (!user) return;

//   // Usar lo que viene directo en el JWT
//   const companyName = user.company_name || user.company_id || "Empresa";

//   titleEl.textContent = companyName;

//   // Ajuste visual (ya no es "NAVEGACIÓN")
//   titleEl.classList.remove("uppercase", "text-gray-500");
//   titleEl.classList.add("text-gray-700");
// }

async function loadSidebarCompanyName() {
  const res = await apiCall('/api/me/company/profile');
  if (!res.ok) return;

  const company = res.data;

  const textEl = document.getElementById('sidebarTitleText');
  const skelEl = document.getElementById('sidebarTitleSkeleton');

  if (textEl) {
    textEl.textContent = company.name || company.company_id;
    textEl.classList.remove('hidden');
  }
  if (skelEl) {
    skelEl.classList.add('hidden');
  }
}





// API helper GLOBAL
async function apiCall(endpoint, options = {}) {
  showLoader(options.loaderMessage);

  const token = localStorage.getItem('token');

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers
    });

    // 401 → sesión expirada
    if (res.status === 401) {
      console.log('❌ Token inválido o expirado, redirigiendo...');
      localStorage.clear();
      window.location.replace('login.html');
      return { ok: false };
    }

    const data = await res.json().catch(() => ({}));

    return {
      ok: res.ok,
      status: res.status,
      data
    };

  } catch (err) {
    console.error('API error:', err);
    showToast('Error de conexión con el servidor', 'error');
    return { ok: false };

  } finally {
    hideLoader();
  }
}


// UI helpers mínimos
function showAlert(msg, type = 'info') {
  alert(msg); // luego lo dejamos bonito
}

// ================================
// GLOBAL LOADER
// ================================

function showLoader(message = 'Cargando…') {
  const loader = document.getElementById('globalLoader');
  if (!loader) return;
  loader.querySelector('span').textContent = message;
  loader.classList.remove('hidden');
}

function hideLoader() {
  document.getElementById('globalLoader')?.classList.add('hidden');
}

// ================================
// TOASTS
// ================================

function showToast(message, type = 'info') {
  const colors = {
    success: 'bg-green-600',
    error: 'bg-red-600',
    info: 'bg-blue-600',
    warning: 'bg-yellow-500'
  };

  const toast = document.createElement('div');
  toast.className = `
    fixed bottom-6 right-6 z-50 text-white px-4 py-3 rounded-lg shadow-lg
    ${colors[type]} animate-fade-in
  `;
  toast.textContent = message;

  document.body.appendChild(toast);

  setTimeout(() => toast.remove(), 3000);
}

// ================================
// HTML ESCAPE
// ================================

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ================================
// DATE FORMATTING
// ================================

function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleString('es-CL', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// ================================
// LOGOUT
// ================================

function logout() {
  console.log('🔴 Cerrando sesión...');
  
  // Limpiar TODO el localStorage
  localStorage.clear();
  
  // También limpiar sessionStorage por si acaso
  sessionStorage.clear();
  
  // Mostrar toast brevemente
  showToast('Sesión cerrada', 'info');
  
  // Redirigir inmediatamente al login (usar replace para no guardar en historial)
  setTimeout(() => {
    window.location.replace('login.html');
  }, 300);
}

