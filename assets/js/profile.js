// ============================================
// PROFILE PAGE - HEAVENSY ADMIN
// ============================================

function initProfilePage() {
  loadProfile();
  
  // Event listeners
  document.getElementById('profileForm').addEventListener('submit', updateProfile);
  document.getElementById('passwordForm').addEventListener('submit', changePassword);
}

/* Tabs */
function showTabProfile(tab) {
  const profileTab = document.getElementById('profileTab');
  const securityTab = document.getElementById('securityTab');
  const profileTabBtn = document.getElementById('profileTabBtn');
  const securityTabBtn = document.getElementById('securityTabBtn');

  // Contenido
  profileTab.classList.toggle('hidden', tab !== 'profile');
  securityTab.classList.toggle('hidden', tab !== 'security');

  // Estilos botones
  profileTabBtn.classList.toggle('border-blue-600', tab === 'profile');
  profileTabBtn.classList.toggle('text-blue-600', tab === 'profile');
  profileTabBtn.classList.toggle('border-transparent', tab !== 'profile');
  profileTabBtn.classList.toggle('text-gray-500', tab !== 'profile');

  securityTabBtn.classList.toggle('border-blue-600', tab === 'security');
  securityTabBtn.classList.toggle('text-blue-600', tab === 'security');
  securityTabBtn.classList.toggle('border-transparent', tab !== 'security');
  securityTabBtn.classList.toggle('text-gray-500', tab !== 'security');
}

/* Load profile */
async function loadProfile() {
  try {
    const res = await apiCall('/api/profile', {
      loaderMessage: 'Cargando perfil...'
    });
    
    if (!res.ok) {
      showToast('Error cargando perfil', 'error');
      return;
    }

    const u = res.data;
    document.getElementById('first_name').value = u.first_name || '';
    document.getElementById('last_name').value = u.last_name || '';
    document.getElementById('email').value = u.email || '';
    document.getElementById('phone').value = u.phone || '';
  } catch (error) {
    console.error('Error:', error);
    showToast('Error de conexión', 'error');
  }
}

/* Update profile */
async function updateProfile(e) {
  e.preventDefault();

  try {
    const res = await apiCall('/api/profile', {
      method: 'PUT',
      loaderMessage: 'Actualizando perfil...',
      body: JSON.stringify({
        first_name: document.getElementById('first_name').value,
        last_name: document.getElementById('last_name').value,
        email: document.getElementById('email').value,
        phone: document.getElementById('phone').value
      })
    });

    if (!res.ok) {
      showToast(res.data?.msg || 'Error actualizando perfil', 'error');
      return;
    }

    showToast('Perfil actualizado correctamente', 'success');
  } catch (error) {
    console.error('Error:', error);
    showToast('Error de conexión', 'error');
  }
}

/* Change password */
async function changePassword(e) {
  e.preventDefault();

  const currentPassword = document.getElementById('current_password').value;
  const newPassword = document.getElementById('new_password').value;
  const confirmPassword = document.getElementById('confirm_password').value;

  if (newPassword !== confirmPassword) {
    showToast('Las contraseñas no coinciden', 'warning');
    return;
  }

  try {
    const res = await apiCall('/api/profile/password', {
      method: 'PUT',
      loaderMessage: 'Cambiando contraseña...',
      body: JSON.stringify({
        current_password: currentPassword,
        new_password: newPassword
      })
    });

    if (!res.ok) {
      showToast(res.data?.msg || 'Error cambiando contraseña', 'error');
      return;
    }

    showToast('Contraseña actualizada correctamente', 'success');
    document.getElementById('passwordForm').reset();
  } catch (error) {
    console.error('Error:', error);
    showToast('Error de conexión', 'error');
  }
}
