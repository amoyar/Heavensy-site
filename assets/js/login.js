// ============================================
// LOGIN PAGE — HEAVENSY
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  setupLogin();
  setupForgotModal();
  checkExistingSession();
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

  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;

  const btn = document.getElementById('loginBtn');
  const errBox = document.getElementById('errorMsg');
  const errText = document.getElementById('errorText');

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
    errText.textContent = err.message;
    errBox.classList.add('show');

    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-arrow-right-to-bracket"></i><span>Iniciar sesión</span>';
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