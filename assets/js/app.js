// ============================================
// APP BASE – HEAVENSY ADMIN
// ============================================
// ── BITÁCORA ──
// 2026-06-04 | initHeavensyMode también REMUEVE el modo si la empresa del token
//              ya no es Heavensy (necesario al cambiar de empresa sin recargar).
// 2026-06-03 | Logout también desconecta el socket del monitor si existe
//              (la logout() duplicada de monitor.js fue eliminada: pisaba esta).
// 2026-06-03 | Fix logout: redirección inmediata (sin ventana de 300ms) y flag
//              _loggingOut para que un refresh en vuelo no reviva la sesión.

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
// HEAVENSY MODE (funciones internas HVY)
// ============================================

function initHeavensyMode() {
  try {
    const token = localStorage.getItem('token');
    if (!token) return;
    const payload = JSON.parse(atob(token.split('.')[1]));
    window.IS_HEAVENSY = (payload.company_id === 'HEAVENSY_001');
    const btn = document.getElementById('nav-view-toggle');
    if (window.IS_HEAVENSY) {
      document.body.classList.add('heavensy-mode');
      if (btn) btn.style.display = 'inline-flex';
    } else {
      // Importante al cambiar de empresa sin recargar: salir del modo Heavensy
      document.body.classList.remove('heavensy-mode');
      if (btn) btn.style.display = 'none';
    }
  } catch {}
}
initHeavensyMode();

function navUpdateEye() {
  const btn = document.getElementById('nav-view-toggle');
  if (!btn) return;
  const isHeavensy = document.body.classList.contains('heavensy-mode');
  btn.style.color = isHeavensy ? 'rgba(255,255,255,0.75)' : '#c4b5fd';
  btn.title = isHeavensy ? 'Vista: Heavensy' : 'Vista: Usuario';
}

function navToggleView() {
  // Delegar a cpToggleView si estamos en companies
  if (typeof cpToggleView === 'function' && document.getElementById('companiesRoot')) {
    cpToggleView();
    navUpdateEye();
    return;
  }
  // Toggle global puro
  const isHeavensy = document.body.classList.contains('heavensy-mode');
  if (isHeavensy) {
    document.body.classList.remove('heavensy-mode');
  } else {
    document.body.classList.add('heavensy-mode');
  }
  navUpdateEye();
}
window.navToggleView  = navToggleView;
window.navUpdateEye   = navUpdateEye;

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

// Promesa compartida del refresh en curso: si varias peticiones reciben 401
// a la vez, solo se hace UN refresh y las demás esperan su resultado.
let _refreshPromise = null;

// true mientras se cierra sesión: bloquea que un refresh en vuelo la reviva
let _loggingOut = false;

async function _tryRefreshToken() {
  if (_loggingOut) return false;
  // Si ya hay un refresh en curso, reutilizar esa promesa (evita refrescos múltiples)
  if (_refreshPromise) return _refreshPromise;

  _refreshPromise = (async () => {
    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) return false;
    try {
      // company_id actual para mantener la empresa seleccionada al refrescar
      let companyId = null;
      try {
        const t = localStorage.getItem('token');
        if (t) companyId = JSON.parse(atob(t.split('.')[1])).company_id;
      } catch {}

      const res = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${refreshToken}`,
        },
        body: JSON.stringify(companyId ? { company_id: companyId } : {}),
      });

      if (!res.ok) return false;
      const data = await res.json();
      if (data && data.access_token) {
        if (_loggingOut) return false; // no revivir la sesión durante el logout
        localStorage.setItem('token', data.access_token);
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      // Liberar el lock al terminar (éxito o fallo), lo libera solo quien lo creó
      _refreshPromise = null;
    }
  })();

  return _refreshPromise;
}

async function apiCall(endpoint, options = {}) {
  const doFetch = (tok) => {
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };
    if (tok && !options.skipAuth) {
      headers.Authorization = `Bearer ${tok}`;
    }
    return fetch(`${API_BASE_URL}${endpoint}`, { ...options, headers });
  };

  try {
    let res = await doFetch(localStorage.getItem('token'));

    // 401 → intentar refrescar la sesión UNA vez y reintentar la petición.
    // Excepciones: peticiones sin auth, y los propios endpoints de auth
    // (evita bucles si el refresh o el login devuelven 401).
    const isAuthEndpoint = endpoint.includes('/api/auth/refresh')
                        || endpoint.includes('/api/auth/login');
    if (res.status === 401 && !options.skipAuth && !options._retried && !isAuthEndpoint) {
      const refreshed = await _tryRefreshToken();
      if (refreshed) {
        // Reintentar la petición original con el token nuevo
        res = await doFetch(localStorage.getItem('token'));
      } else {
        // No se pudo refrescar (refresh token expirado/ausente) → al login
        localStorage.clear();
        window.location.replace('login.html');
        return { ok: false };
      }
    }

    // Si tras el reintento sigue 401, sesión definitivamente inválida
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
  _loggingOut = true;
  // Desconectar sockets si existen (ej: monitor), sin reventar si no están
  try { if (typeof socket !== 'undefined' && socket && socket.disconnect) socket.disconnect(); } catch {}
  window._companyConfig = null;
  localStorage.clear();
  sessionStorage.clear();
  // Redirección INMEDIATA: sin ventana de tiempo para que un apiCall interfiera
  window.location.replace('pages/portada.html');
}