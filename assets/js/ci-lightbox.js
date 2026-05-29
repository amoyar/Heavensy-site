// ============================================
// CI-LIGHTBOX.JS — Visor a pantalla completa
//
// Maneja:
//   • Imágenes: lightbox propio con navegación entre las del chat (← →)
//   • PDFs:     modal con iframe + descarga
//
// API pública:
//   window.ciLightbox.openImage(url, opts)
//   window.ciLightbox.openPdf(url, name)
//
// Para navegación entre imágenes del feed se buscan dinámicamente todas
// las imágenes con class "ci-msg-img" cuando se abre una.
// ============================================

(function () {
  'use strict';

  let _overlay = null;
  let _current = null;   // 'image' | 'pdf'
  let _images  = [];     // urls cuando navegamos
  let _idx     = 0;

  function _ensureOverlay() {
    if (_overlay) return _overlay;
    _overlay = document.createElement('div');
    _overlay.className = 'ci-lightbox';
    _overlay.style.display = 'none';
    _overlay.innerHTML = `
      <button class="ci-lb-close" id="ci-lb-close" title="Cerrar (Esc)" type="button">
        <i class="fas fa-times"></i>
      </button>
      <button class="ci-lb-download" id="ci-lb-download" title="Descargar" type="button">
        <i class="fas fa-download"></i>
      </button>
      <button class="ci-lb-nav ci-lb-prev" id="ci-lb-prev" title="Anterior" type="button">
        <i class="fas fa-chevron-left"></i>
      </button>
      <button class="ci-lb-nav ci-lb-next" id="ci-lb-next" title="Siguiente" type="button">
        <i class="fas fa-chevron-right"></i>
      </button>
      <div class="ci-lb-content" id="ci-lb-content"></div>
    `;
    document.body.appendChild(_overlay);

    // Listeners
    document.getElementById('ci-lb-close').addEventListener('click', _close);
    _overlay.addEventListener('click', e => {
      if (e.target === _overlay) _close();
    });
    document.getElementById('ci-lb-prev').addEventListener('click', _prev);
    document.getElementById('ci-lb-next').addEventListener('click', _next);
    document.getElementById('ci-lb-download').addEventListener('click', _download);

    document.addEventListener('keydown', e => {
      if (_overlay.style.display === 'none') return;
      if (e.key === 'Escape') _close();
      else if (e.key === 'ArrowLeft')  _prev();
      else if (e.key === 'ArrowRight') _next();
    });

    return _overlay;
  }

  function _renderImage() {
    const content = document.getElementById('ci-lb-content');
    content.innerHTML = `<img class="ci-lb-img" src="${_images[_idx]}" alt="" />`;
    document.getElementById('ci-lb-prev').style.display = _images.length > 1 ? '' : 'none';
    document.getElementById('ci-lb-next').style.display = _images.length > 1 ? '' : 'none';
  }

  function _renderPdf(url, name) {
    const content = document.getElementById('ci-lb-content');
    content.innerHTML = `<iframe class="ci-lb-pdf" src="${url}" title="${name || 'PDF'}"></iframe>`;
    document.getElementById('ci-lb-prev').style.display = 'none';
    document.getElementById('ci-lb-next').style.display = 'none';
  }

  function _open() {
    _ensureOverlay();
    _overlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }

  function _close() {
    if (!_overlay) return;
    _overlay.style.display = 'none';
    document.body.style.overflow = '';
    const content = document.getElementById('ci-lb-content');
    if (content) content.innerHTML = '';  // liberar memoria
    _current = null;
    _images = [];
    _idx = 0;
  }

  function _prev() {
    if (_current !== 'image' || _images.length < 2) return;
    _idx = (_idx - 1 + _images.length) % _images.length;
    _renderImage();
  }

  function _next() {
    if (_current !== 'image' || _images.length < 2) return;
    _idx = (_idx + 1) % _images.length;
    _renderImage();
  }

  function _download() {
    const url = _current === 'image' ? _images[_idx] :
                (_overlay.querySelector('iframe')?.src || null);
    if (!url) return;

    // Forzar descarga vía anchor con download
    const a = document.createElement('a');
    a.href = url;
    a.download = '';
    a.target  = '_blank';
    a.rel     = 'noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function openImage(url, opts) {
    _ensureOverlay();
    _current = 'image';

    // Recolectar todas las imágenes visibles del feed para navegación
    const all = Array.from(document.querySelectorAll('.ci-msg-img'))
      .map(el => el.getAttribute('data-full') || el.src)
      .filter(Boolean);

    if (all.length) {
      _images = all;
      _idx    = Math.max(0, all.indexOf(url));
      if (_idx === -1) { _images = [url]; _idx = 0; }
    } else {
      _images = [url];
      _idx    = 0;
    }

    _open();
    _renderImage();
  }

  function openPdf(url, name) {
    _ensureOverlay();
    _current = 'pdf';
    _images = [];
    _idx = 0;
    _open();
    _renderPdf(url, name || 'documento.pdf');
  }

  // API pública
  window.ciLightbox = { openImage, openPdf };
})();