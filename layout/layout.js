async function loadLayout() {
  console.log('🔵 Cargando layout...');
  try {
    const navbarRes  = await fetch('./layout/navbar.html');
    const sidebarRes = await fetch('./layout/sidebar.html');
    console.log('Navbar status:', navbarRes.status);
    console.log('Sidebar status:', sidebarRes.status);
    if (!navbarRes.ok || !sidebarRes.ok) throw new Error('Layout no encontrado');
    document.getElementById('navbar').innerHTML  = await navbarRes.text();
    document.getElementById('sidebar').innerHTML = await sidebarRes.text();
    console.log('✅ Layout cargado');
    initUserMenu();
    loadTopbarUsername();
    initSidebarToggle();
    initSidebarActive();
    if (typeof loadSidebarCompanyName === 'function') loadSidebarCompanyName();
    _navUpdateEmpresaLink();
  } catch (e) {
    console.error('❌ Error cargando layout', e);
  }
}

function initUserMenu() {
  // Manejado por navbar.js (toggleUserMenu)
}

function loadTopbarUsername() {
  try {
    const userData = JSON.parse(localStorage.getItem('user') || '{}');
    const name = userData.username || userData.email || 'Usuario';
    const el = document.getElementById('nav-username');
    if (el) el.textContent = name;
    const av = document.getElementById('nav-avatar');
    if (av) av.textContent = name.charAt(0).toUpperCase();
  } catch(e) {}
}

function openProfileModal() {
  document.getElementById('profileModal')?.classList.remove('hidden');
  const token = localStorage.getItem('token');
  if (token) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const fn = payload.full_name || '';
      document.getElementById('profileFirstName').value = fn.split(' ')[0] || '';
      document.getElementById('profileLastName').value  = fn.split(' ').slice(1).join(' ') || '';
      document.getElementById('profileEmail').value     = payload.email || '';
      document.getElementById('profileUsername').value  = payload.username || '';
    } catch(e) {}
  }
  document.getElementById('user-dropdown')?.classList.remove('open');
  document.querySelector('.hv-nav-user')?.classList.remove('open');
}

function closeProfileModal()  { document.getElementById('profileModal')?.classList.add('hidden'); }
function openSecurityModal()  {
  document.getElementById('securityModal')?.classList.remove('hidden');
  document.getElementById('user-dropdown')?.classList.remove('open');
  document.querySelector('.hv-nav-user')?.classList.remove('open');
}
function closeSecurityModal() { document.getElementById('securityModal')?.classList.add('hidden'); }

// ================================
// TOGGLE SIDEBAR — RESPONSIVE
// ================================
function initSidebarToggle() {
  const sidebar   = document.getElementById('appSidebar');
  const toggleBtn = document.getElementById('toggleSidebarBtn');
  const overlay   = document.getElementById('sidebarOverlay');

  if (!sidebar || !toggleBtn) { console.warn('Sidebar o botón toggle no encontrados'); return; }

  const isMobile = () => window.innerWidth < 1024;
  let sidebarOpen = false;

  function openSidebar() {
    sidebarOpen = true;
    if (isMobile()) {
      sidebar.style.transform = 'translateX(0)';
      if (overlay) { overlay.style.display = 'block'; }
    } else {
      sidebar.style.width = '11rem'; // w-44
      sidebar.style.transform = '';
      document.querySelectorAll('.sidebar-text').forEach(el => el.style.display = '');
    }
  }

  function closeSidebar() {
    sidebarOpen = false;
    if (isMobile()) {
      sidebar.style.transform = 'translateX(-100%)';
      if (overlay) { overlay.style.display = 'none'; }
    } else {
      sidebar.style.width = '4rem'; // w-16
      document.querySelectorAll('.sidebar-text').forEach(el => el.style.display = 'none');
    }
  }

  function applyMobileLayout() {
    sidebar.style.position   = 'fixed';
    sidebar.style.top        = '0';
    sidebar.style.left       = '0';
    sidebar.style.height     = '100vh';
    sidebar.style.zIndex     = '40';
    sidebar.style.width      = '200px';
    sidebar.style.boxShadow  = '4px 0 20px rgba(0,0,0,.18)';
    sidebar.style.transition = 'transform 0.3s ease';
    document.querySelectorAll('.sidebar-text').forEach(el => el.style.display = '');
    if (!sidebarOpen) { sidebar.style.transform = 'translateX(-100%)'; }
    if (overlay) overlay.style.display = sidebarOpen ? 'block' : 'none';
  }

  function applyDesktopLayout() {
    sidebar.style.position   = 'relative';
    sidebar.style.top        = '';
    sidebar.style.left       = '';
    sidebar.style.height     = '';
    sidebar.style.zIndex     = '';
    sidebar.style.boxShadow  = '';
    sidebar.style.transform  = '';
    sidebar.style.transition = 'width 0.3s ease';
    sidebar.style.width      = sidebarOpen ? '11rem' : '4rem';
    document.querySelectorAll('.sidebar-text').forEach(el => {
      el.style.display = sidebarOpen ? '' : 'none';
    });
    if (overlay) overlay.style.display = 'none';
  }

  function handleResize() {
    if (isMobile()) { applyMobileLayout(); }
    else            { applyDesktopLayout(); }
  }

  toggleBtn.addEventListener('click', () => {
    sidebarOpen ? closeSidebar() : openSidebar();
  });

  // Cerrar con overlay
  if (overlay) overlay.addEventListener('click', closeSidebar);

  // Cerrar al navegar en mobile
  document.addEventListener('click', e => {
    if (isMobile() && sidebarOpen && e.target.closest('#appSidebar a')) {
      closeSidebar();
    }
  });

  // Estado inicial — siempre cerrado
  sidebarOpen = false;
  handleResize();
  window.addEventListener('resize', handleResize);
}

document.addEventListener('DOMContentLoaded', loadLayout);

function _navUpdateEmpresaLink() {
  const label = document.getElementById('nav-empresa-label');
  if (!label) return;
  const hasEmpresa = !!localStorage.getItem('company_id') ||
                     !!localStorage.getItem('company_config') ||
                     !!localStorage.getItem('empresa_publicada');
  label.textContent = hasEmpresa ? 'Mi empresa' : 'Crear mi empresa';
}

function _navEmpresaClick() {
  toggleUserMenu();
  // Tiene empresa si tiene company_id, company_config o empresa_publicada
  const hasEmpresa = !!localStorage.getItem('company_id') ||
                     !!localStorage.getItem('company_config') ||
                     !!localStorage.getItem('empresa_publicada');
  if (hasEmpresa) {
    loadPage('dashboard');
  } else {
    loadPage('configuracion');
  }
}

// ================================
// SIDEBAR ACTIVE STATE
// ================================
function initSidebarActive() {
  function updateActive() {
    const page = location.hash.replace('#', '') || 'dashboard';
    document.querySelectorAll('.sidebar-link').forEach(function(link) {
      const href = link.getAttribute('href').replace('#', '');
      link.classList.toggle('active', href === page);
    });
  }
  updateActive();
  window.addEventListener('hashchange', updateActive);
}