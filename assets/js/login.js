// ============================================
// LOGIN PAGE — HEAVENSY
// ============================================

// ===============================
// PROTECCIÓN CONTRA FUERZA BRUTA
// ===============================

const MAX_ATTEMPTS    = 5;
const LOCKOUT_MS      = 5 * 60 * 1000; // 5 minutos
const ATTEMPTS_KEY    = 'hs_login_attempts';
const LOCKOUT_KEY     = 'hs_login_lockout';

let _lockoutTimer = null;
let _loginInProgress = false;

function _getAttempts() {
  return parseInt(localStorage.getItem(ATTEMPTS_KEY) || '0', 10);
}

function _getLockoutUntil() {
  return parseInt(localStorage.getItem(LOCKOUT_KEY) || '0', 10);
}

function _isLockedOut() {
  const until = _getLockoutUntil();
  if (!until) return false;
  if (Date.now() < until) return true;
  // Expiró — limpiar
  localStorage.removeItem(LOCKOUT_KEY);
  localStorage.removeItem(ATTEMPTS_KEY);
  return false;
}

function _remainingSeconds() {
  return Math.ceil((_getLockoutUntil() - Date.now()) / 1000);
}

function _recordFailedAttempt() {
  const attempts = _getAttempts() + 1;
  localStorage.setItem(ATTEMPTS_KEY, attempts);
  if (attempts >= MAX_ATTEMPTS) {
    localStorage.setItem(LOCKOUT_KEY, Date.now() + LOCKOUT_MS);
  }
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
      clearInterval(_lockoutTimer);
      _lockoutTimer = null;
      errBox.classList.remove('show');
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-arrow-right-to-bracket"></i><span>Iniciar sesión</span>';
      return;
    }
    const s = _remainingSeconds();
    const m = Math.floor(s / 60);
    const ss = String(s % 60).padStart(2, '0');
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
  // Si al cargar ya hay lockout activo, activar countdown
  if (_isLockedOut()) _startLockoutCountdown();
});

// ===============================
// LOGIN (USANDO apiCall 🔥)
// ===============================

function setupLogin() {
  const form = document.getElementById('loginForm');
  if (!form) return;

  form.addEventListener('submit', handleLogin);
}

async function handleLogin(e) {
  e.preventDefault();

  const btn     = document.getElementById('loginBtn');
  const errBox  = document.getElementById('errorMsg');
  const errText = document.getElementById('errorText');

  // Evitar envíos concurrentes (p.ej. Enter mientras ya se procesa)
  if (_loginInProgress) return;

  // Verificar lockout antes de cualquier acción
  if (_isLockedOut()) {
    _startLockoutCountdown();
    return;
  }

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

    if (res.ok && res.data.access_token) {
      _clearAttempts(); // Login exitoso — resetear contador
      _loginInProgress = false;
      localStorage.setItem('token', res.data.access_token);

      btn.classList.add('success');
      btn.innerHTML = '<i class="fas fa-check"></i><span>Accediendo...</span>';

      await refreshCompanyConfig();

      setTimeout(() => {
        window.location.href = 'index.html#dashboard';
      }, 600);

    } else {
      throw new Error(res.data?.error || 'Credenciales incorrectas');
    }

  } catch (err) {
    _loginInProgress = false;
    const attempts = _recordFailedAttempt();

    if (_isLockedOut()) {
      _startLockoutCountdown();
    } else {
      const remaining = MAX_ATTEMPTS - attempts;
      const suffix = remaining === 1
        ? ` (${remaining} intento restante)`
        : ` (${remaining} intentos restantes)`;
      errText.textContent = err.message + suffix;
      errBox.classList.add('show');
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-arrow-right-to-bracket"></i><span>Iniciar sesión</span>';
    }
  }
}

// ===============================
// SESSION CHECK
// ===============================

function checkExistingSession() {
  const token = localStorage.getItem('token');
  if (!token) return;

  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const exp = payload.exp * 1000;

    if (Date.now() < exp) {
      window.location.href = 'index.html#dashboard';
    } else {
      localStorage.removeItem('token');
    }
  } catch {
    localStorage.removeItem('token');
  }
}

// ===============================
// UI
// ===============================

function togglePassword() {
  const input = document.getElementById('password');
  const icon  = document.getElementById('pwIcon');

  const show = input.type === 'password';
  input.type = show ? 'text' : 'password';
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

function openForgotModal() {
  document.getElementById('forgotModal').style.display = 'flex';
}

function closeForgotModal() {
  document.getElementById('forgotModal').style.display = 'none';
}

async function sendForgot() {
  const email = document.getElementById('forgotEmail').value.trim();

  const res = await apiCall('/api/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
    skipAuth: true
  });

  if (res.ok && res.data.ok) {
    alert('Instrucciones enviadas');
  } else {
    alert(res.data?.error || 'Error');
  }
}