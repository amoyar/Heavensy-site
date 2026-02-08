async function loadLayout() {
  console.log('🔵 Cargando layout...');

  try {
    const navbarRes = await fetch('./layout/navbar.html');
    const sidebarRes = await fetch('./layout/sidebar.html');

    console.log('Navbar status:', navbarRes.status);
    console.log('Sidebar status:', sidebarRes.status);

    if (!navbarRes.ok || !sidebarRes.ok) {
      throw new Error('Layout no encontrado');
    }

    document.getElementById('navbar').innerHTML = await navbarRes.text();
    document.getElementById('sidebar').innerHTML = await sidebarRes.text();

    console.log('✅ Layout cargado');
    
    // Inicializar menú de usuario
    initUserMenu();
    
    // Cargar nombre de usuario
    loadTopbarUsername();

  } catch (e) {
    console.error('❌ Error cargando layout', e);
  }
}

// Inicializar menú desplegable de usuario
function initUserMenu() {
  const userMenuBtn = document.getElementById('userMenuBtn');
  const userMenu = document.getElementById('userMenu');
  
  if (!userMenuBtn || !userMenu) return;
  
  // Toggle menú al hacer click
  userMenuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    userMenu.classList.toggle('hidden');
  });
  
  // Cerrar menú al hacer click fuera
  document.addEventListener('click', (e) => {
    if (!userMenu.contains(e.target) && !userMenuBtn.contains(e.target)) {
      userMenu.classList.add('hidden');
    }
  });
}

// Cargar nombre de usuario en el topbar
function loadTopbarUsername() {
  const user = localStorage.getItem('user');
  if (user) {
    try {
      const userData = JSON.parse(user);
      const usernameElement = document.getElementById('topbarUsername');
      if (usernameElement) {
        usernameElement.textContent = userData.username || userData.email || 'Usuario';
      }
    } catch (e) {
      console.error('Error parsing user data:', e);
    }
  }
}

// Funciones para abrir modales (placeholder)
function openProfileModal() {
  window.location.hash = '#profile';
}

function openSecurityModal() {
  window.location.hash = '#profile';
  setTimeout(() => {
    if (typeof showTabProfile === 'function') {
      showTabProfile('security');
    }
  }, 100);
}

document.addEventListener('DOMContentLoaded', loadLayout);
