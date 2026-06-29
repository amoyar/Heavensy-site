// ── BITÁCORA ──
// [v2026.06.29-1] layout.js
// 2026-06-29 | Fix sidebar móvil (hamburguesa): applyMobileLayout ponía el sidebar en
//              top:0 / height:100vh, así el navbar (z-index 1000) tapaba sus primeros
//              54px y se perdía el nombre/selector de empresa. Ahora arranca en top:54px
//              con height:calc(100dvh - 54px), bajo el navbar.
// [v2026.06.16-2] layout.js
// 2026-06-16 | showToast: posición movida a arriba-centro (top:20px, centrado) con
//              z-index máximo. Antes en esquina inferior derecha, donde el panel de
//              edición la tapaba (el toast se creaba pero no se veía).
// [v2026.06.16-1] layout.js
// 2026-06-16 | Se define window.showToast GLOBAL (notificación lateral auto-ocultable,
//              color de marca). layout.js carga temprano, así queda disponible para
//              todos los módulos (companies, config-rubro, users, configuracion) que
//              llamaban a showToast sin tenerlo definido → ahora los avisos de
//              guardado (éxito/error) aparecen en toda la app. Auto-protegido.
// [v2026.06.13-1] layout.js
// 2026-06-13 | _switchSidebarCompany emite el evento global
//              'heavensy:company-changed' (detail: companyId, companyName) tras
//              refrescar la config de empresa. Los módulos se suscriben en vez
//              de depender del if/else explícito (que queda como respaldo).
//              Solución escalable: agregar un módulo ya no requiere tocar layout.
// [v2026.06.10-1] layout.js
// 2026-06-10 | Selector de empresas: pinta desde caché y SIEMPRE refresca desde
//              /api/auth/my-companies (lista dinámica: empresas nuevas, o todas
//              si es Heavensy). Guard anti doble-binding en el dropdown.
// 2026-06-04 | _switchSidebarCompany re-ejecuta initHeavensyMode tras cambiar
//              el token: los elementos hvy-only (Empresas, Mensajes) aparecen
//              o desaparecen según la empresa activa, sin recargar.

// ── TOAST GLOBAL (notificación lateral que se auto-oculta) ──
// Definido aquí porque layout.js carga temprano: queda disponible para TODOS los
// módulos (companies, config-rubro, users, configuracion, etc.) que ya llamaban a
// showToast pero no lo tenían definido. Auto-protegido: no pisa si ya existe. [16-06]
if (typeof window.showToast !== 'function') {
  window.showToast = function (msg, type = 'success') {
    const color = type === 'success' ? '#9961FF' : type === 'error' ? '#ef4444' : '#f59e0b';
    const icon  = type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-times-circle' : 'fa-exclamation-circle';
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;top:20px;left:50%;transform:translate(-50%,-20px);z-index:2147483647;background:#fff;border-left:4px solid ' + color +
      ';border-radius:10px;padding:11px 16px;box-shadow:0 4px 20px rgba(0,0,0,.14);font-size:12.5px;font-weight:600;color:#383838;' +
      'display:flex;align-items:center;gap:8px;max-width:340px;opacity:0;transition:opacity .25s ease,transform .25s ease;';
    el.innerHTML = '<i class="fas ' + icon + '" style="color:' + color + '"></i> ' + msg;
    document.body.appendChild(el);
    requestAnimationFrame(() => { el.style.opacity = '1'; el.style.transform = 'translate(-50%,0)'; });
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translate(-50%,-20px)';
      setTimeout(() => el.remove(), 300);
    }, 3000);
  };
}

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
    // Mostrar ojo de vista si es Super Admin Heavensy
    if (window.IS_HEAVENSY) {
      const btn = document.getElementById('nav-view-toggle');
      if (btn) btn.style.display = 'inline-flex';
    }
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
    const token = localStorage.getItem('token');
    if (!token) return;
    const payload = JSON.parse(atob(token.split('.')[1]));
    const fullName = payload.full_name || payload.username || payload.email || 'Usuario';
    const initials = fullName.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();

    // Nombre en navbar
    const nameEl = document.getElementById('nav-username');
    if (nameEl) nameEl.textContent = fullName.split(' ')[0];

    // Avatar con iniciales
    const avatarEl = document.getElementById('nav-avatar');
    if (avatarEl) avatarEl.textContent = initials;

    // Compatibilidad con id anterior
    const topbarEl = document.getElementById('topbarUsername');
    if (topbarEl) topbarEl.textContent = fullName;
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
    sidebar.style.top        = '54px';                  // bajo el navbar (no lo tapa)
    sidebar.style.left       = '0';
    sidebar.style.height     = 'calc(100dvh - 54px)';   // resto de la pantalla
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

    // Obtener empresas del usuario: pintar al tiro desde caché (sin parpadeo)
    // y SIEMPRE refrescar desde la API (la lista puede cambiar: empresas nuevas,
    // o todas las del sistema si el usuario es Heavensy).
    let userCompanies = [];
    try {
      const stored = localStorage.getItem('hs_user_companies');
      if (stored) userCompanies = JSON.parse(stored);
    } catch {}

    const pintar = (companies) => {
      if (companies.length > 1) {
        if (btnLabel) btnLabel.textContent = companyName;
        if (btn) { btn.classList.remove('hidden'); btn.style.display = 'flex'; }
        if (label) { label.style.display = 'none'; }
        _initSidebarCompanyDropdown(companies, companyId);
      } else {
        if (btn) btn.style.display = 'none';
        if (label) { label.textContent = companyName; label.classList.remove('hidden'); label.style.display = 'block'; }
      }
    };

    if (userCompanies.length) pintar(userCompanies);

    apiCall('/api/auth/my-companies').then(function(res) {
      if (res.ok && res.data && res.data.companies) {
        userCompanies = res.data.companies;
        localStorage.setItem('hs_user_companies', JSON.stringify(userCompanies));
      }
      pintar(userCompanies);
    }).catch(function() {
      if (!userCompanies.length) pintar([]);
    });
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

  // Construir lista (se reconstruye en cada llamada; los listeners de los
  // items son nuevos porque los nodos son nuevos)
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

  // Toggle dropdown (bind una sola vez, aunque la lista se reconstruya)
  if (!btn.dataset.ddBound) {
    btn.dataset.ddBound = '1';
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
    // Recalcular modo Heavensy con la nueva empresa (muestra/oculta hvy-only)
    if (typeof initHeavensyMode === 'function') initHeavensyMode();
    if (typeof navUpdateEye === 'function') navUpdateEye();
    // Actualizar label
    const btnLabel = document.getElementById('sidebarCompanyBtnLabel');
    if (btnLabel) btnLabel.textContent = companyName;
    const dropdown = document.getElementById('sidebarCompanyDropdown');
    const chevron  = document.getElementById('sidebarCompanyChevron');
    if (dropdown) dropdown.style.display = 'none';
    if (chevron)  chevron.style.transform = '';

    // Refrescar la config de empresa cacheada ANTES de avisar a los módulos
    if (typeof refreshCompanyConfig === 'function') { try { await refreshCompanyConfig(); } catch {} }

    // ── EVENTO GLOBAL DE CAMBIO DE EMPRESA ──
    // Cualquier módulo puede suscribirse con:
    //   window.addEventListener('heavensy:company-changed', e => { ... e.detail.companyId ... })
    // y reaccionar sin que layout.js tenga que conocerlo. Patrón abierto y escalable.
    window.dispatchEvent(new CustomEvent('heavensy:company-changed', {
      detail: { companyId: companyId, companyName: companyName }
    }));

    // Recargar módulos sin salto visual (enrutador explícito: respaldo para los
    // módulos que aún no migran al evento; se irá vaciando con el tiempo)
    const page = location.hash.replace('#', '') || 'dashboard';
    if (page === 'conversaciones' && typeof cargarEmpresasYConversaciones === 'function') {
      cargarEmpresasYConversaciones();
    } else if (page === 'seguimiento' && typeof segInit === 'function') {
      segInit();
    } else if (page === 'chat_interno') {
      // Recarga explícita del chat con la nueva empresa (resetea + recarga todo)
      if (typeof ciReloadForCompanySwitch === 'function') {
        ciReloadForCompanySwitch();
      } else if (typeof initChat_internoPage === 'function') {
        initChat_internoPage();
      }
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