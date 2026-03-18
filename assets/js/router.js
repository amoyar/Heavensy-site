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
    const fullscreenPages = ['conversaciones'];
    if (fullscreenPages.includes(page)) {
      appEl.style.padding        = '0';
      appEl.style.overflow       = 'hidden';
      appEl.style.height         = 'calc(100vh - 40px)';
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

    // 3️⃣ Scroll arriba
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

// Inicializar
window.addEventListener('hashchange', handleRoute);
document.addEventListener('DOMContentLoaded', handleRoute);