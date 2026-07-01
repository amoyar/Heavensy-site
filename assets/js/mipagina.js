// ── BITÁCORA ──
// [v2026.07.01-1] mipagina.js
// 2026-07-01 | Panel "Mi página": initMipaginaPage() resuelve el slug de la empresa
//              (GET /api/perfil-publico/estado) y le pone al iframe #mipagina-iframe
//              el src ./pages/perfil_profesional.html?empresa=<slug>, para que muestre
//              la PÁGINA PÚBLICA REAL publicada. Antes el iframe cargaba
//              ./pages/perfil_profesional.html SIN slug → initPerfilEmpresa no encontraba
//              empresa y el panel quedaba "sin datos" (contenido base). El router
//              (loadPage) llama a initMipaginaPage automáticamente tras inyectar el HTML.
//              No necesita detección de entorno: perfil_profesional.js tiene el backend
//              fijo (_PP_API_BASE), así que en local también muestra lo publicado en prod.

function initMipaginaPage() {
  const iframe = document.getElementById('mipagina-iframe');
  if (!iframe) return;

  // Pinta la página pública real en el iframe
  const pintar = (slug) => {
    iframe.style.display = '';
    iframe.src = './pages/perfil_profesional.html?empresa=' + encodeURIComponent(slug);
  };

  // Muestra un aviso amable en lugar de un iframe vacío
  const sinPagina = (titulo) => {
    const wrap = iframe.closest('.mipagina-frame-wrap') || iframe.parentElement;
    if (!wrap) return;
    iframe.style.display = 'none';
    let aviso = wrap.querySelector('.mipagina-aviso');
    if (!aviso) {
      aviso = document.createElement('div');
      aviso.className = 'mipagina-aviso';
      aviso.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;' +
        'height:100%;gap:10px;color:#7D84C1;font-family:"Poppins",sans-serif;text-align:center;padding:24px';
      wrap.appendChild(aviso);
    }
    aviso.innerHTML =
      '<i class="fas fa-globe" style="font-size:34px;color:#c4b5fd"></i>' +
      '<div style="font-size:14px;font-weight:600;color:#4b5bb0">' + titulo + '</div>' +
      '<div style="font-size:12px">Publica tu página desde Configuración → paso Media.</div>';
  };

  if (typeof apiCall === 'undefined') { sinPagina('No se pudo cargar tu página'); return; }

  apiCall('/api/perfil-publico/estado').then(res => {
    const est  = (res && res.data && res.data.estado) || {};
    const slug = est.slug || '';
    if (!slug) { sinPagina('Aún no tienes una página publicada'); return; }
    // Solo bloqueamos si el backend dice explícitamente que NO está publicada.
    if (est.is_published === false) { sinPagina('Aún no has publicado tu página'); return; }
    pintar(slug);
  }).catch(() => { sinPagina('No se pudo cargar tu página'); });
}