// ============================================
// APP BASE – HEAVENSY ADMIN
// ============================================

const API_BASE_URL = 'https://heavensy-api-backend-v2.onrender.com';

// ============================================
// AUTH CHECK
// ============================================

function checkAuth() {
  const token = localStorage.getItem('token');
  const currentPage = window.location.pathname;
  
  if (!token && !currentPage.includes('login.html')) {
    console.log('❌ No hay token, redirigiendo a login...');
    window.location.replace('login.html');
    return false;
  }
  
  return true;
}

if (window.location.pathname.includes('index.html') || window.location.pathname.endsWith('/')) {
  checkAuth();
}

// ============================================
// COMPANY CONFIG
// ============================================

function loadCompanyConfig() {
  try {
    const raw = localStorage.getItem('company_config');
    if (!raw) {
      window._companyConfig = null;
      return null;
    }
    const config = JSON.parse(raw);
    window._companyConfig = config;
    return config;
  } catch {
    window._companyConfig = null;
    return null;
  }
}

async function refreshCompanyConfig() {
  try {
    const res = await apiCall('/api/me/company/config');
    if (res.ok && res.data?.config) {
      localStorage.setItem('company_config', JSON.stringify(res.data.config));
      localStorage.setItem('company_id', res.data.company_id);
      window._companyConfig = res.data.config;
      return res.data.config;
    }
  } catch {}
  return null;
}

loadCompanyConfig();

// ============================================
// API CALL (🔥 CLAVE)
// ============================================

async function apiCall(endpoint, options = {}) {
  const token = localStorage.getItem('token');

  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (token && !options.skipAuth) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers
    });

    if (res.status === 401) {
      localStorage.clear();
      window.location.replace('login.html');
      return { ok: false };
    }

    let data = {};
    try {
      data = await res.json();
    } catch {}

    return {
      ok: res.ok,
      status: res.status,
      data
    };

  } catch (err) {
    console.error('API error:', err);
    return { ok: false };
  }
}

// ============================================
// TOKEN HELPERS
// ============================================

function getToken() {
  return localStorage.getItem('token');
}

function getUserFromToken() {
  const token = getToken();
  if (!token) return null;
  try {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}

// ============================================
// COMPANY CONFIG HELPERS
// ============================================

function getCompanyLabel(key, fallback = null) {
  const labels = window._companyConfig?.labels || {};
  return labels[key] || fallback || key;
}

function isModuleEnabled(module) {
  const modules = window._companyConfig?.modules || {};
  return modules[module] !== false;
}

function getResourceDefaults() {
  return window._companyConfig?.resource_defaults || {};
}

// ============================================
// SIDEBAR
// ============================================

async function loadSidebarCompanyName() {
  const res = await apiCall('/api/me/company/profile');
  if (!res.ok) return;
  const company = res.data;
  const textEl = document.getElementById('sidebarTitleText');
  const skelEl = document.getElementById('sidebarTitleSkeleton');
  if (textEl) { textEl.textContent = company.name || company.company_id; textEl.classList.remove('hidden'); }
  if (skelEl) skelEl.classList.add('hidden');
}

// ============================================
// LOADER
// ============================================

function showLoader(message = 'Cargando…') {
  const loader = document.getElementById('globalLoader');
  if (!loader) return;
  const span = loader.querySelector('span');
  if (span) span.textContent = message;
  loader.classList.remove('hidden');
}

function hideLoader() {
  document.getElementById('globalLoader')?.classList.add('hidden');
}

// ============================================
// TOASTS
// ============================================

function showToast(message, type = 'info') {
  const colors = { success:'bg-green-600', error:'bg-red-600', info:'bg-blue-600', warning:'bg-yellow-500' };
  const toast = document.createElement('div');
  toast.className = `fixed bottom-6 right-6 z-50 text-white px-4 py-3 rounded-lg shadow-lg ${colors[type] || colors.info}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// ============================================
// UTILS
// ============================================

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(dateString) {
  if (!dateString) return '';
  return new Date(dateString).toLocaleString('es-CL', {
    year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit'
  });
}

function showAlert(msg, type = 'info') { alert(msg); }

// ============================================
// LOGOUT
// ============================================

function logout() {
  window._companyConfig = null;
  localStorage.clear();
  sessionStorage.clear();
  showToast('Sesión cerrada', 'info');
  setTimeout(() => window.location.replace('login.html'), 300);
}