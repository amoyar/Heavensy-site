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
  } catch (e) {
    console.error('❌ Error cargando layout', e);
  }
}

function initUserMenu() {
  const btn  = document.getElementById('userMenuBtn');
  const menu = document.getElementById('userMenu');
  if (!btn || !menu) return;
  btn.addEventListener('click', e => { e.stopPropagation(); menu.classList.toggle('hidden'); });
  document.addEventListener('click', e => {
    if (!menu.contains(e.target) && !btn.contains(e.target)) menu.classList.add('hidden');
  });
}

function loadTopbarUsername() {
  try {
    const userData = JSON.parse(localStorage.getItem('user') || '{}');
    const el = document.getElementById('topbarUsername');
    if (el) el.textContent = userData.username || userData.email || 'Usuario';
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
  document.getElementById('userMenu')?.classList.add('hidden');
}

function closeProfileModal()  { document.getElementById('profileModal')?.classList.add('hidden'); }
function openSecurityModal()  {
  document.getElementById('securityModal')?.classList.remove('hidden');
  document.getElementById('userMenu')?.classList.add('hidden');
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

// ================================
// SIDEBAR — SELECTOR DE EMPRESA
// ================================
function loadSidebarCompanyName() {
  try {
    const token = localStorage.getItem('token');
    if (!token) return;
    const payload      = JSON.parse(atob(token.split('.')[1]));
    const companyId    = payload.company_id;
    const companyName  = payload.company_name || companyId;

    const skeleton  = document.getElementById('sidebarTitleSkeleton');
    const label     = document.getElementById('sidebarCompanyLabel');
    const btn       = document.getElementById('sidebarCompanyBtn');
    const btnLabel  = document.getElementById('sidebarCompanyBtnLabel');

    if (skeleton) skeleton.style.display = 'none';

    // Obtener empresas del usuario
    let userCompanies = [];
    try {
      const stored = localStorage.getItem('hs_user_companies');
      if (stored) userCompanies = JSON.parse(stored);
    } catch {}

    if (userCompanies.length > 1) {
      // Ya tenemos empresas → mostrar dropdown
      if (btnLabel) btnLabel.textContent = companyName;
      if (btn) { btn.classList.remove('hidden'); btn.style.display = 'flex'; }
      _initSidebarCompanyDropdown(userCompanies, companyId);
    } else if (userCompanies.length === 1) {
      // Una empresa → solo nombre
      if (label) { label.textContent = companyName; label.classList.remove('hidden'); label.style.display = 'block'; }
    } else {
      // Sin datos en localStorage → cargar desde API
      apiCall('/api/auth/my-companies').then(function(res) {
        if (res.ok && res.data && res.data.companies) {
          userCompanies = res.data.companies;
          localStorage.setItem('hs_user_companies', JSON.stringify(userCompanies));
        }
        if (userCompanies.length > 1) {
          if (btnLabel) btnLabel.textContent = companyName;
          if (btn) { btn.classList.remove('hidden'); btn.style.display = 'flex'; }
          _initSidebarCompanyDropdown(userCompanies, companyId);
        } else {
          if (label) { label.textContent = companyName; label.classList.remove('hidden'); label.style.display = 'block'; }
        }
      }).catch(function() {
        if (label) { label.textContent = companyName; label.classList.remove('hidden'); label.style.display = 'block'; }
      });
    }
  } catch(e) {
    console.error('loadSidebarCompanyName error:', e);
  }
}

function _initSidebarCompanyDropdown(companies, currentCompanyId) {
  const btn      = document.getElementById('sidebarCompanyBtn');
  const dropdown = document.getElementById('sidebarCompanyDropdown');
  const list     = document.getElementById('sidebarCompanyList');
  const chevron  = document.getElementById('sidebarCompanyChevron');
  if (!btn || !dropdown || !list) return;

  // Construir lista
  list.innerHTML = '';
  companies.forEach(c => {
    const name    = c.company_name || c.company_id;
    const active  = c.company_id === currentCompanyId;
    const item    = document.createElement('button');
    item.type     = 'button';
    item.style.cssText = `width:100%;text-align:left;padding:9px 14px;font-size:.82rem;
      font-weight:${active ? '700' : '400'};color:${active ? '#7D84C1' : '#374151'};
      background:${active ? '#eff4fe' : '#fff'};border:none;cursor:pointer;
      border-left:${active ? '3px solid #7D84C1' : '3px solid transparent'};`;
    item.textContent = name;
    item.addEventListener('mouseenter', () => { if (!active) item.style.background = '#f5f7ff'; });
    item.addEventListener('mouseleave', () => { if (!active) item.style.background = '#fff'; });
    item.addEventListener('click', () => _switchSidebarCompany(c.company_id, name));
    list.appendChild(item);
  });

  // Toggle dropdown
  btn.addEventListener('click', e => {
    e.stopPropagation();
    const open = dropdown.style.display === 'block';
    dropdown.style.display = open ? 'none' : 'block';
    chevron.style.transform = open ? '' : 'rotate(180deg)';
  });

  // Cerrar al hacer click fuera
  document.addEventListener('click', e => {
    if (!btn.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.style.display = 'none';
      chevron.style.transform = '';
    }
  });
}

async function _switchSidebarCompany(companyId, companyName) {
  try {
    const res = await apiCall('/api/auth/switch-company', {
      method: 'POST',
      body: JSON.stringify({ company_id: companyId })
    });
    if (!res.ok || !res.data.access_token) throw new Error('Error al cambiar empresa');

    // Actualizar token y recargar
    localStorage.setItem('token', res.data.access_token);
    // Actualizar label
    const btnLabel = document.getElementById('sidebarCompanyBtnLabel');
    if (btnLabel) btnLabel.textContent = companyName;
    const dropdown = document.getElementById('sidebarCompanyDropdown');
    const chevron  = document.getElementById('sidebarCompanyChevron');
    if (dropdown) dropdown.style.display = 'none';
    if (chevron)  chevron.style.transform = '';

    // Recargar módulos sin salto visual
    const page = location.hash.replace('#', '') || 'dashboard';
    if (page === 'conversaciones' && typeof cargarEmpresasYConversaciones === 'function') {
      cargarEmpresasYConversaciones();
    } else if (page === 'seguimiento' && typeof segInit === 'function') {
      segInit();
    } else if (typeof loadPage === 'function') {
      loadPage(page);
    } else {
      // Último recurso: soft reload sin parpadeo
      window.dispatchEvent(new Event('hashchange'));
    }
  } catch(e) {
    console.error('Error cambiando empresa:', e);
  }
}