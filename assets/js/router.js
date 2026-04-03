// ============================================
// ROUTER – HEAVENSY ADMIN
// ============================================

async function loadPage(page) {
  try {
    // 1️⃣ Cargar HTML
    const res = await fetch(`./pages/${page}.html`);
    if (!res.ok) throw new Error('No se pudo cargar la página');

    const html = await res.text();
    const appEl = document.getElementById('app');
    appEl.innerHTML = html;

    // Ajustar main según página
    const fullscreenPages = ['conversaciones', 'seguimiento'];
    if (fullscreenPages.includes(page)) {
      appEl.style.padding        = '0';
      appEl.style.overflow       = 'hidden';
      appEl.style.height         = 'calc(100dvh - 40px)';
      appEl.style.display        = 'flex';
      appEl.style.flexDirection  = 'column';
    } else {
      appEl.style.padding        = '0.5rem';
      appEl.style.overflow       = 'auto';
      appEl.style.height         = '';
      appEl.style.display        = '';
      appEl.style.flexDirection  = '';
    }

    // 2️⃣ Llamar init<Page>Page si existe
    const initFnName =
      'init' + page.charAt(0).toUpperCase() + page.slice(1) + 'Page';

    const initFn = window[initFnName];

    if (typeof initFn === 'function') {
      initFn();
    }

    // 3️⃣ Setup mobile si aplica
    if (page === 'conversaciones') {
      setupMobileConversaciones();
    }
    if (page === 'seguimiento') {
      setupMobileSeguimiento();
    }

    // 4️⃣ Scroll arriba
    document.getElementById('app').scrollTop = 0;

  } catch (e) {
    console.error(e);
    document.getElementById('app').innerHTML =
      `<p class="text-red-500">Error cargando la página</p>`;
  }
}

// Navegación por hash (#users, #companies)
function handleRoute() {
  const page = location.hash.replace('#', '') || 'dashboard';
  loadPage(page);
}

// ============================================
// MOBILE CONVERSACIONES — Una columna a la vez
// ============================================
function setupMobileConversaciones() {
  const isMobile = () => window.innerWidth < 768;

  const wrapper  = document.getElementById('convWrapper');
  const chatHeader = document.getElementById('chatHeader');
  if (!wrapper || !chatHeader) return;

  // Observar cuando chatHeader se hace visible → conversación seleccionada
  const observer = new MutationObserver(() => {
    if (isMobile() && !chatHeader.classList.contains('hidden')) {
      wrapper.classList.add('mobile-chat-active');
    }
  });
  observer.observe(chatHeader, { attributes: true, attributeFilter: ['class'] });

  // Botón ‹ → volver a la lista en mobile
  document.getElementById('btnToggleLeft')?.addEventListener('click', () => {
    if (isMobile()) {
      wrapper.classList.remove('mobile-chat-active', 'mobile-contact-open');
    }
  });

  // Botón › → abrir/cerrar panel contacto en mobile
  document.getElementById('btnToggleRight')?.addEventListener('click', () => {
    if (isMobile()) {
      wrapper.classList.toggle('mobile-contact-open');
    }
  });

  // Overlay oscuro → cerrar panel contacto
  document.getElementById('mobileContactOverlay')?.addEventListener('click', () => {
    wrapper.classList.remove('mobile-contact-open');
  });

  // btnCloseContactPanel → cerrar panel contacto en mobile
  document.getElementById('btnCloseContactPanel')?.addEventListener('click', () => {
    if (isMobile()) wrapper.classList.remove('mobile-contact-open');
  });

  // Al rotar/redimensionar: limpiar clases mobile si pasa a desktop
  window.addEventListener('resize', () => {
    if (!isMobile()) {
      wrapper.classList.remove('mobile-chat-active', 'mobile-contact-open');
    }
  });
}

// ============================================
// MOBILE SEGUIMIENTO — Paneles colapsables
// ============================================
function setupMobileSeguimiento() {
  // Al rotar de móvil a desktop — restaurar paneles abiertos
  window.addEventListener('resize', () => {
    const isMobile = window.innerWidth < 768;
    if (!isMobile) {
      const lp     = document.querySelector('.seg-left-panel');
      const rp     = document.querySelector('.seg-col-side');
      const btnExp = document.getElementById('seg-btn-expand-left');
      const iconL  = document.getElementById('seg-icon-collapse-left');
      const iconR  = document.getElementById('seg-icon-toggle-right');
      if (lp)     { lp.classList.remove('panel-hidden'); }
      if (rp)     { rp.classList.remove('panel-hidden'); }
      if (btnExp) { btnExp.classList.add('seg-hidden'); }
      if (iconL)  { iconL.className = 'fas fa-chevron-left'; }
      if (iconR)  { iconR.className = 'fas fa-chevron-right'; }
      SEG_LEFT_OPEN  = true;
      SEG_RIGHT_OPEN = true;
    }
  });
}

// Inicializar
window.addEventListener('hashchange', handleRoute);
document.addEventListener('DOMContentLoaded', handleRoute);