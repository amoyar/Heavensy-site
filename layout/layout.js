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

    // Inicializar toggle del sidebar
    initSidebarToggle();

    // 👇👇👇 AÑADE ESTO AQUÍ 👇👇👇
    if (typeof loadSidebarCompanyName === 'function') {
      loadSidebarCompanyName();
    }

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

// ================================
// TOGGLE SIDEBAR
// ================================
function initSidebarToggle() {
  const sidebar = document.getElementById('appSidebar');
  const toggleBtn = document.getElementById('toggleSidebarBtn');

  if (!sidebar || !toggleBtn) {
    console.warn('Sidebar o botón toggle no encontrados');
    return;
  }

  toggleBtn.addEventListener('click', () => {
    const isCollapsed = sidebar.classList.contains('w-16');

    if (isCollapsed) {
      // Expandir
      sidebar.classList.remove('w-16');
      sidebar.classList.add('w-48');
      document.querySelectorAll('.sidebar-text').forEach(el => el.classList.remove('hidden'));
    } else {
      // Colapsar
      sidebar.classList.remove('w-48');
      sidebar.classList.add('w-16');
      document.querySelectorAll('.sidebar-text').forEach(el => el.classList.add('hidden'));
    }
  });
}


document.addEventListener('DOMContentLoaded', loadLayout);
