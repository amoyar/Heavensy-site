// ============================================
// LOGIN PAGE — HEAVENSY
// ============================================

// ===============================
// PROTECCIÓN CONTRA FUERZA BRUTA
// ===============================

const MAX_ATTEMPTS    = 5;
const LOCKOUT_MS      = 5 * 60 * 1000;
const ATTEMPTS_KEY    = 'hs_login_attempts';
const LOCKOUT_KEY     = 'hs_login_lockout';

let _lockoutTimer    = null;
let _loginInProgress = false;
let _tempToken       = null; // Token temporal mientras se selecciona empresa

function _getAttempts()    { return parseInt(localStorage.getItem(ATTEMPTS_KEY) || '0', 10); }
function _getLockoutUntil(){ return parseInt(localStorage.getItem(LOCKOUT_KEY)  || '0', 10); }

function _isLockedOut() {
  const until = _getLockoutUntil();
  if (!until) return false;
  if (Date.now() < until) return true;
  localStorage.removeItem(LOCKOUT_KEY);
  localStorage.removeItem(ATTEMPTS_KEY);
  return false;
}

function _remainingSeconds() { return Math.ceil((_getLockoutUntil() - Date.now()) / 1000); }

function _recordFailedAttempt() {
  const attempts = _getAttempts() + 1;
  localStorage.setItem(ATTEMPTS_KEY, attempts);
  if (attempts >= MAX_ATTEMPTS) localStorage.setItem(LOCKOUT_KEY, Date.now() + LOCKOUT_MS);
  return attempts;
}

function _clearAttempts() {
  localStorage.removeItem(ATTEMPTS_KEY);
  localStorage.removeItem(LOCKOUT_KEY);
}

function _startLockoutCountdown() {
  const btn     = document.getElementById('loginBtn');
  const errBox  = document.getElementById('errorMsg');
  const errText = document.getElementById('errorText');
  if (_lockoutTimer) clearInterval(_lockoutTimer);
  const update = () => {
    if (!_isLockedOut()) {
      clearInterval(_lockoutTimer); _lockoutTimer = null;
      errBox.classList.remove('show');
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-arrow-right-to-bracket"></i><span>Iniciar sesión</span>';
      return;
    }
    const s = _remainingSeconds(), m = Math.floor(s / 60), ss = String(s % 60).padStart(2, '0');
    errText.textContent = `Demasiados intentos fallidos. Intenta de nuevo en ${m}:${ss}.`;
    errBox.classList.add('show');
    btn.disabled = true;
    btn.innerHTML = `<i class="fas fa-lock"></i><span>Bloqueado (${m}:${ss})</span>`;
  };
  update();
  _lockoutTimer = setInterval(update, 1000);
}

// ============================================

document.addEventListener('DOMContentLoaded', () => {
  setupLogin();
  setupForgotModal();
  checkExistingSession();
  if (_isLockedOut()) _startLockoutCountdown();
});

// ===============================
// PASO 1 — LOGIN
// ===============================

function setupLogin() {
  const form = document.getElementById('loginForm');
  if (!form) return;
  form.addEventListener('submit', handleLogin);
}

async function handleLogin(e) {
  e.preventDefault();
  if (_loginInProgress) return;
  if (_isLockedOut()) { _startLockoutCountdown(); return; }

  const btn     = document.getElementById('loginBtn');
  const errBox  = document.getElementById('errorMsg');
  const errText = document.getElementById('errorText');
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;

  _loginInProgress = true;
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>Verificando...</span>';
  errBox.classList.remove('show');

  try {
    const res = await apiCall('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
      skipAuth: true
    });

    if (!res.ok || !res.data.access_token) throw new Error(res.data?.error || 'Credenciales incorrectas');

    _clearAttempts();
    _loginInProgress = false;

    const { access_token, user } = res.data;

    // Guardar empresas del usuario para el selector en la barra lateral
    localStorage.setItem('hs_user_companies', JSON.stringify(user?.all_companies || []));

    // Entrar directamente a la empresa primaria
    _finishLogin(access_token);

  } catch (err) {
    _loginInProgress = false;
    const attempts = _recordFailedAttempt();
    if (_isLockedOut()) {
      _startLockoutCountdown();
    } else {
      const remaining = MAX_ATTEMPTS - attempts;
      const suffix = remaining === 1 ? ` (${remaining} intento restante)` : ` (${remaining} intentos restantes)`;
      errText.textContent = err.message + suffix;
      errBox.classList.add('show');
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-arrow-right-to-bracket"></i><span>Iniciar sesión</span>';
    }
  }
}

// ===============================
// PASO 2 — SELECTOR DE EMPRESA
// ===============================

function _showCompanySelector(companies, user) {
  // Ocultar paso 1
  document.getElementById('stepCredentials').style.display = 'none';

  // Construir lista de empresas
  const list = document.getElementById('companyList');
  list.innerHTML = '';

  companies.forEach(c => {
    const roles  = (c.roles || []).join(', ') || 'Sin rol';
    const isPrimary = c.is_primary ? '<span class="company-badge">Principal</span>' : '';
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'company-item';
    item.dataset.companyId = c.company_id;
    item.innerHTML = `
      <div class="company-item-icon"><i class="fas fa-building"></i></div>
      <div class="company-item-info">
        <span class="company-item-name">${c.company_name || c.company_id} ${isPrimary}</span>
        <span class="company-item-role">${roles}</span>
      </div>
      <i class="fas fa-chevron-right company-item-arrow"></i>
    `;
    item.addEventListener('click', () => _selectCompany(c.company_id, item));
    list.appendChild(item);
  });

  // Mostrar paso 2
  document.getElementById('stepCompany').style.display = 'block';

  // Nombre del usuario
  const nameEl = document.getElementById('companySelectorUser');
  if (nameEl) nameEl.textContent = user?.first_name ? `Hola, ${user.first_name}` : 'Selecciona tu empresa';
}

async function _selectCompany(companyId, itemEl) {
  // Deshabilitar todos los items mientras carga
  document.querySelectorAll('.company-item').forEach(b => b.disabled = true);
  itemEl.innerHTML = itemEl.innerHTML.replace('fa-chevron-right', 'fa-spinner fa-spin');

  try {
    // Guardar token temporal para que apiCall lo pueda usar
    localStorage.setItem('token', _tempToken);

    const res = await apiCall('/api/auth/switch-company', {
      method: 'POST',
      body: JSON.stringify({ company_id: companyId }),
    });

    if (!res.ok || !res.data.access_token) throw new Error('No se pudo seleccionar la empresa');

    _finishLogin(res.data.access_token);

  } catch (err) {
    // Limpiar token temporal si falló
    localStorage.removeItem('token');
    document.querySelectorAll('.company-item').forEach(b => b.disabled = false);
    itemEl.innerHTML = itemEl.innerHTML.replace('fa-spinner fa-spin', 'fa-chevron-right');
    const errEl = document.getElementById('companyError');
    if (errEl) { errEl.textContent = err.message; errEl.style.display = 'block'; }
  }
}

function _backToLogin() {
  _tempToken = null;
  document.getElementById('stepCompany').style.display = 'none';
  document.getElementById('stepCredentials').style.display = 'block';
  document.getElementById('password').value = '';
}

// ===============================
// FINALIZAR LOGIN
// ===============================

async function _finishLogin(token) {
  localStorage.setItem('token', token);

  const btn = document.getElementById('loginBtn');
  if (btn) {
    btn.classList.add('success');
    btn.innerHTML = '<i class="fas fa-check"></i><span>Accediendo...</span>';
  }

  await refreshCompanyConfig();
  setTimeout(() => { window.location.href = 'index.html#dashboard'; }, 600);
}

// ===============================
// SESSION CHECK
// ===============================

function checkExistingSession() {
  const token = localStorage.getItem('token');
  if (!token) return;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (Date.now() < payload.exp * 1000) {
      window.location.href = 'index.html#dashboard';
    } else {
      localStorage.removeItem('token');
    }
  } catch { localStorage.removeItem('token'); }
}

// ===============================
// UI
// ===============================

function togglePassword() {
  const input = document.getElementById('password');
  const icon  = document.getElementById('pwIcon');
  const show  = input.type === 'password';
  input.type  = show ? 'text' : 'password';
  icon.className = show ? 'fas fa-eye-slash' : 'fas fa-eye';
}

// ===============================
// FORGOT PASSWORD
// ===============================

function setupForgotModal() {
  document.getElementById('forgotModal')?.addEventListener('click', function(e) {
    if (e.target === this) closeForgotModal();
  });
}

function openForgotModal()  { document.getElementById('forgotModal').style.display = 'flex'; }
function closeForgotModal() { document.getElementById('forgotModal').style.display = 'none'; }

async function sendForgot() {
  const email = document.getElementById('forgotEmail').value.trim();
  const res   = await apiCall('/api/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
    skipAuth: true
  });
  if (res.ok && res.data.ok) alert('Instrucciones enviadas');
  else alert(res.data?.error || 'Error');
}