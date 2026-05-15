const API_BASE_URL = 'https://heavensy-api-backend-v2.onrender.com';

        function togglePassword() {
            const input = document.getElementById('password');
            const icon  = document.getElementById('pwIcon');
            const show  = input.type === 'password';
            input.type  = show ? 'text' : 'password';
            icon.className = show ? 'fas fa-eye-slash' : 'fas fa-eye';
        }

        document.getElementById('loginForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('username').value.trim();
            const password = document.getElementById('password').value;
            const btn      = document.getElementById('loginBtn');
            const errBox   = document.getElementById('errorMsg');
            const errText  = document.getElementById('errorText');

            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>Verificando...</span>';
            errBox.classList.remove('show');

            try {
                const res  = await fetch(`${API_BASE_URL}/api/auth/login`, {
                    method:  'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body:    JSON.stringify({ username, password })
                });
                const data = await res.json();
                if (res.ok && data.access_token) {
                    localStorage.setItem('token', data.access_token);
                    btn.classList.add('success');
                    btn.innerHTML = '<i class="fas fa-check"></i><span>Accediendo...</span>';
                    setTimeout(() => { window.location.href = '../index.html#dashboard'; }, 600);
                } else {
                    throw new Error(data.error || 'Credenciales incorrectas');
                }
            } catch (err) {
                errText.textContent = err.message;
                errBox.classList.add('show');
                btn.disabled = false;
                btn.innerHTML = '<span>Iniciar sesión</span>';
            }
        });

        if (localStorage.getItem('token')) {
            window.location.href = '../index.html#dashboard';
        }

        function openForgotModal() {
            document.getElementById('forgotModal').style.display = 'flex';
            document.getElementById('forgotEmail').value = '';
            document.getElementById('forgotError').style.display = 'none';
            document.getElementById('forgotSuccess').style.display = 'none';
        }

        function closeForgotModal() {
            document.getElementById('forgotModal').style.display = 'none';
        }

        async function sendForgot() {
            const email = document.getElementById('forgotEmail').value.trim();
            const btn   = document.getElementById('forgotBtn');
            const err   = document.getElementById('forgotError');
            const ok    = document.getElementById('forgotSuccess');

            err.style.display = 'none';
            ok.style.display  = 'none';

            if (!email) {
                document.getElementById('forgotErrorText').textContent = 'Ingresa tu email';
                err.style.display = 'flex'; return;
            }

            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>Enviando...</span>';

            try {
                const res  = await fetch(`${API_BASE_URL}/api/auth/forgot-password`, {
                    method:  'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body:    JSON.stringify({ email })
                });
                const data = await res.json();

                if (data.ok) {
                    document.getElementById('forgotSuccessText').textContent =
                        'Instrucciones enviadas. Revisa tu email y WhatsApp.';
                    ok.style.display = 'flex';
                    btn.innerHTML = '<i class="fas fa-check"></i><span>¡Enviado!</span>';
                    setTimeout(closeForgotModal, 3000);
                } else {
                    throw new Error(data.error || 'Error al enviar');
                }
            } catch(e) {
                document.getElementById('forgotErrorText').textContent = e.message;
                err.style.display = 'flex';
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-paper-plane"></i><span>Enviar instrucciones</span>';
            }
        }

        // Cerrar modal al click fuera
        document.getElementById('forgotModal').addEventListener('click', function(e) {
            if (e.target === this) closeForgotModal();
        });
