// Heavensy Admin - Authentication Module

// Login function
async function login(email, password) {
    // If demo mode is enabled, skip backend call
    if (CONFIG.DEMO_MODE) {
        return loginDemoMode(email, password);
    }
    
    showLoading('Conectando con el backend...');
    
    try {
        // El backend usa "username" pero también puede aceptar "email"
        // Enviamos ambos para compatibilidad
        const loginData = {
            username: email,  // El backend espera "username"
            password: password
        };
        
        const url = getApiUrl(CONFIG.API_ENDPOINTS.LOGIN);
        console.log('🔐 Intentando login en:', url);
        console.log('📤 Datos enviados:', { username: loginData.username, password: '***' });
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(loginData)
        });
        
        console.log('📥 Response status:', response.status);
        console.log('📥 Response ok:', response.ok);
        
        const data = await response.json();
        console.log('📥 Response data:', data);
        
        if (response.ok) {
            // Save token and user info
            console.log('✅ Login exitoso');
            localStorage.setItem(CONFIG.STORAGE_KEYS.AUTH_TOKEN, data.access_token);
            if (data.refresh_token) {
                localStorage.setItem(CONFIG.STORAGE_KEYS.REFRESH_TOKEN, data.refresh_token);
            }
            if (data.user) {
                localStorage.setItem(CONFIG.STORAGE_KEYS.USER_INFO, JSON.stringify(data.user));
            }
            
            hideLoading();
            showSuccess('Sesión iniciada correctamente');
            
            // Redirect to dashboard
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 1000);
        } else {
            hideLoading();
            console.error('❌ Login fallido:', data);
            const errorMsg = data.error || data.message || 'Credenciales incorrectas';
            
            // Show more detailed error
            let detailedError = errorMsg;
            if (data.error) {
                detailedError += '<br><br><small>Error del servidor: ' + data.error + '</small>';
            }
            
            showError(detailedError);
        }
    } catch (error) {
        console.error('❌ Login error:', error);
        hideLoading();
        
        let errorMessage = '❌ Error al conectar con el backend. ';
        
        if (error.message.includes('timeout')) {
            errorMessage += 'El servidor tardó demasiado en responder. ';
        } else if (error.message.includes('Failed to fetch')) {
            errorMessage += 'No se puede conectar con el servidor. ';
        } else {
            errorMessage += error.message + ' ';
        }
        
        errorMessage += '<br><br><b>Soluciones:</b><br>';
        errorMessage += '1. Presiona el botón "Activar Backend" en el sidebar<br>';
        errorMessage += '2. Espera 30-60 segundos (Render free tier despierta)<br>';
        errorMessage += '3. Verifica la consola del navegador (F12) para más detalles<br>';
        errorMessage += '4. Intenta hacer login nuevamente<br>';
        errorMessage += '<br><small>URL: ' + CONFIG.BACKEND_URL + '/api/auth/login</small>';
        
        showError(errorMessage);
    }
}

// Demo mode login (when backend is not available)
function loginDemoMode(email, password) {
    console.log('Using demo mode login');
    
    showLoading('Iniciando sesión (Modo Demo)...');
    
    // Check demo credentials
    const validEmails = ['admin@heavensy.com', 'admin@lattice.com'];
    const validPasswords = ['Admin123!', 'admin123'];
    
    setTimeout(() => {
        if (validEmails.includes(email) && validPasswords.includes(password)) {
            // Create demo token and user
            const demoToken = 'demo_token_' + btoa(email + Date.now());
            const demoUser = {
                email: email,
                username: 'demo_admin',
                full_name: 'Admin Demo',
                first_name: 'Admin',
                last_name: 'Demo',
                company_id: 'HEAVENSY_001',
                role: 'ADMIN_ROL',
                is_demo: true
            };
            
            localStorage.setItem(CONFIG.STORAGE_KEYS.AUTH_TOKEN, demoToken);
            localStorage.setItem(CONFIG.STORAGE_KEYS.USER_INFO, JSON.stringify(demoUser));
            
            hideLoading();
            showSuccess('Sesión iniciada (Modo Demo)');
            
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 800);
            
            return true;
        } else {
            hideLoading();
            showError('Credenciales incorrectas. Usa: admin@heavensy.com / Admin123!');
            return false;
        }
    }, 500); // Small delay to show the loading
}

// Logout function
async function logout() {
    showLoading('Cerrando sesión...');
    
    try {
        const token = localStorage.getItem(CONFIG.STORAGE_KEYS.AUTH_TOKEN);
        if (token) {
            await fetch(getApiUrl(CONFIG.API_ENDPOINTS.LOGOUT), {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
        }
    } catch (error) {
        console.error('Logout error:', error);
    } finally {
        // Clear local storage
        localStorage.removeItem(CONFIG.STORAGE_KEYS.AUTH_TOKEN);
        localStorage.removeItem(CONFIG.STORAGE_KEYS.USER_INFO);
        localStorage.removeItem(CONFIG.STORAGE_KEYS.REFRESH_TOKEN);
        
        hideLoading();
        showSuccess('Sesión cerrada');
        
        // Redirect to login
        setTimeout(() => {
            window.location.href = 'auth.html';
        }, 1000);
    }
}

// Refresh token function
async function refreshToken() {
    const refreshToken = localStorage.getItem(CONFIG.STORAGE_KEYS.REFRESH_TOKEN);
    
    if (!refreshToken) {
        return false;
    }
    
    try {
        const response = await fetch(getApiUrl(CONFIG.API_ENDPOINTS.REFRESH), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem(CONFIG.STORAGE_KEYS.AUTH_TOKEN)}`
            },
            body: JSON.stringify({ refresh_token: refreshToken })
        });
        
        const data = await response.json();
        
        if (response.ok && data.token) {
            localStorage.setItem(CONFIG.STORAGE_KEYS.AUTH_TOKEN, data.token);
            return true;
        }
        
        return false;
    } catch (error) {
        console.error('Refresh token error:', error);
        return false;
    }
}

// Check authentication on page load
function checkAuth() {
    const token = localStorage.getItem(CONFIG.STORAGE_KEYS.AUTH_TOKEN);
    const userInfo = getUserInfo();
    
    // Update UI based on auth status
    const btnLogin = document.getElementById('btnLogin');
    const btnLogout = document.getElementById('btnLogout');
    const userName = document.getElementById('userName');
    
    if (token && userInfo) {
        if (btnLogin) btnLogin.classList.add('d-none');
        if (btnLogout) btnLogout.classList.remove('d-none');
        if (userName) {
            userName.textContent = userInfo.full_name || userInfo.email || 'Usuario';
        }
    } else {
        if (btnLogin) btnLogin.classList.remove('d-none');
        if (btnLogout) btnLogout.classList.add('d-none');
        if (userName) userName.textContent = 'No autenticado';
    }
}

// Require authentication for protected pages
function requireAuth() {
    if (!isAuthenticated()) {
        showError('Debe iniciar sesión para acceder a esta página');
        setTimeout(() => {
            window.location.href = 'auth.html';
        }, 2000);
        return false;
    }
    return true;
}

// Initialize auth on page load
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
});
