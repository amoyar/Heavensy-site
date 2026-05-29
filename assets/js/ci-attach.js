// ============================================
// CI-ATTACH.JS — Adjuntos del Chat Interno
//
// Responsabilidades:
//   • Botón clip → file picker (múltiples archivos)
//   • Drag & drop sobre el área del chat
//   • Validación cliente (10MB, tipos)
//   • Cola de adjuntos pendientes con preview
//   • Subida al backend al confirmar envío
//   • API pública para chat_interno.js:
//       window.ciAttachHasPending()   → boolean
//       window.ciAttachUploadAll()    → Promise<Array<attachment>>
//       window.ciAttachClear()        → void
//
// Requisitos en el HTML:
//   #ci-attach-btn      — botón clip
//   #ci-attach-input    — input file (display:none)
//   #ci-attach-preview  — contenedor donde se muestran los adjuntos pendientes
//   #ci-feed            — área del chat (para drag & drop)
// ============================================

(function () {
  'use strict';

  const MAX_BYTES = 10 * 1024 * 1024;
  const ALLOWED_PREFIXES = ['image/', 'video/', 'audio/'];
  const ALLOWED_EXTRAS = new Set([
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain', 'text/csv',
    'application/zip', 'application/x-zip-compressed',
    'application/x-rar-compressed',
  ]);

  // Cola en memoria: [{ id, file, name, size, mime, type, previewUrl }]
  let _queue = [];
  let _nextId = 1;
  let _inited = false;

  // ── Helpers ───────────────────────────────────────────────────────────────
  function _categorize(mime) {
    if (mime.startsWith('image/')) return 'image';
    if (mime.startsWith('video/')) return 'video';
    if (mime.startsWith('audio/')) return 'audio';
    return 'document';
  }

  function _isAllowed(mime) {
    return ALLOWED_PREFIXES.some(p => mime.startsWith(p)) || ALLOWED_EXTRAS.has(mime);
  }

  function _formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  }

  function _iconForType(type, mime) {
    if (type === 'image') return 'fa-image';
    if (type === 'video') return 'fa-film';
    if (type === 'audio') return 'fa-music';
    if (mime && mime.includes('pdf')) return 'fa-file-pdf';
    if (mime && (mime.includes('word') || mime.includes('msword'))) return 'fa-file-word';
    if (mime && (mime.includes('sheet') || mime.includes('excel'))) return 'fa-file-excel';
    if (mime && (mime.includes('presentation') || mime.includes('powerpoint'))) return 'fa-file-powerpoint';
    if (mime && (mime.includes('zip') || mime.includes('rar'))) return 'fa-file-archive';
    return 'fa-file';
  }

  // ── Queue management ─────────────────────────────────────────────────────
  function _addFiles(fileList) {
    const errors = [];
    Array.from(fileList).forEach(file => {
      const mime = (file.type || 'application/octet-stream').toLowerCase();
      if (!_isAllowed(mime)) {
        errors.push(`${file.name}: tipo no permitido`);
        return;
      }
      if (file.size > MAX_BYTES) {
        errors.push(`${file.name}: excede 10 MB`);
        return;
      }
      if (file.size === 0) {
        errors.push(`${file.name}: archivo vacío`);
        return;
      }

      const type = _categorize(mime);
      const item = {
        id:        _nextId++,
        file:      file,
        name:      file.name,
        size:      file.size,
        mime:      mime,
        type:      type,
        previewUrl: type === 'image' ? URL.createObjectURL(file) : null,
      };
      _queue.push(item);
    });

    _renderPreview();

    if (errors.length) {
      // Mostrar errores agrupados (no usar alert: ruidoso para múltiples)
      const msg = 'Algunos archivos no se pudieron adjuntar:\n\n' + errors.join('\n');
      console.warn(msg);
      if (window.ciConfirmar) {
        // Reusar el modal custom como aviso (un solo botón)
        window.ciConfirmar({
          titulo:      'Archivos rechazados',
          mensaje:     errors.join(' · '),
          confirmar:   'Entendido',
          peligro:     true,
          soloAceptar: true,
        });
      } else {
        alert(msg);
      }
    }
  }

  function _removeFromQueue(id) {
    const idx = _queue.findIndex(it => it.id === id);
    if (idx === -1) return;
    const item = _queue[idx];
    if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    _queue.splice(idx, 1);
    _renderPreview();
  }

  function _clearQueue() {
    _queue.forEach(it => { if (it.previewUrl) URL.revokeObjectURL(it.previewUrl); });
    _queue = [];
    _renderPreview();
  }

  // ── Render preview ───────────────────────────────────────────────────────
  function _renderPreview() {
    const wrap = document.getElementById('ci-attach-preview');
    if (!wrap) return;

    if (!_queue.length) {
      wrap.innerHTML = '';
      wrap.style.display = 'none';
      return;
    }

    wrap.style.display = 'flex';
    wrap.innerHTML = _queue.map(it => {
      const safeName = (it.name || '').replace(/"/g, '&quot;');
      const icon     = _iconForType(it.type, it.mime);
      const sizeStr  = _formatSize(it.size);
      const thumb    = it.previewUrl
        ? `<img src="${it.previewUrl}" alt="" />`
        : `<div class="ci-attach-thumb-icon"><i class="fas ${icon}"></i></div>`;
      return `
        <div class="ci-attach-item" data-id="${it.id}">
          <div class="ci-attach-thumb">${thumb}</div>
          <div class="ci-attach-info">
            <div class="ci-attach-name" title="${safeName}">${safeName}</div>
            <div class="ci-attach-size">${sizeStr}</div>
          </div>
          <button class="ci-attach-remove" data-id="${it.id}" title="Quitar" type="button">
            <i class="fas fa-times"></i>
          </button>
        </div>
      `;
    }).join('');

    // Listeners de remove
    wrap.querySelectorAll('.ci-attach-remove').forEach(btn => {
      btn.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
        const id = parseInt(btn.dataset.id, 10);
        _removeFromQueue(id);
      });
    });
  }

  // ── Upload ───────────────────────────────────────────────────────────────
  async function _uploadAll() {
    if (!_queue.length) return [];

    // Tomar config: el caller debe pasarla via window.ciAttachConfig
    // (chat_interno la setea al iniciar). Si no existe, fallback a globales.
    const cfg = window.ciAttachConfig || {};
    const apiBase   = cfg.apiBase   || window.API_BASE_URL || '';
    const companyId = cfg.companyId || (window.ciCurrentUser && window.ciCurrentUser.company_id);
    const token     = cfg.token     || localStorage.getItem('token');

    if (!companyId) {
      console.error('ci-attach: company_id no disponible');
      return [];
    }

    const fd = new FormData();
    _queue.forEach(it => fd.append('file', it.file, it.name));

    const url = `${apiBase}/api/internal-chat/${companyId}/upload`;

    let r, res;
    try {
      r = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token },
        body: fd,
      });
    } catch (e) {
      console.error('ci-attach: error de red al subir:', e);
      if (window.showToast) window.showToast('Error de conexión al subir archivos', 'error');
      return [];
    }

    // 401 → sesión expirada (mismo comportamiento que apiCall en app.js)
    if (r.status === 401) {
      console.log('❌ ci-attach: token inválido o expirado, redirigiendo...');
      localStorage.clear();
      window.location.replace('../login.html');
      return [];
    }

    try {
      res = await r.json();
    } catch (e) {
      console.error('ci-attach: respuesta no-JSON:', e);
      return [];
    }

    if (!res || !res.ok) {
      console.error('ci-attach: respuesta inválida:', res);
      if (window.showToast) window.showToast('No se pudieron subir los archivos', 'error');
      return [];
    }

    if (res.errors && res.errors.length) {
      console.warn('ci-attach: errores parciales:', res.errors);
    }

    return res.uploaded || [];
  }

  // ── Drag & drop ──────────────────────────────────────────────────────────
  function _initDragAndDrop() {
    const zone = document.getElementById('ci-feed-wrapper') || document.getElementById('ci-feed');
    if (!zone || zone._ciDndReady) return;
    zone._ciDndReady = true;

    let depth = 0;

    zone.addEventListener('dragenter', e => {
      if (!e.dataTransfer || !e.dataTransfer.types || !e.dataTransfer.types.includes('Files')) return;
      e.preventDefault();
      depth++;
      zone.classList.add('ci-dnd-active');
    });

    zone.addEventListener('dragover', e => {
      if (!e.dataTransfer || !e.dataTransfer.types || !e.dataTransfer.types.includes('Files')) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    });

    zone.addEventListener('dragleave', e => {
      if (!e.dataTransfer || !e.dataTransfer.types || !e.dataTransfer.types.includes('Files')) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) zone.classList.remove('ci-dnd-active');
    });

    zone.addEventListener('drop', e => {
      if (!e.dataTransfer || !e.dataTransfer.files || !e.dataTransfer.files.length) return;
      e.preventDefault();
      depth = 0;
      zone.classList.remove('ci-dnd-active');
      _addFiles(e.dataTransfer.files);
    });
  }

  // ── Init ─────────────────────────────────────────────────────────────────
  function ciInitAttach() {
    if (_inited) {
      _initDragAndDrop();  // por si el DOM se rehizo
      return true;
    }

    const btn   = document.getElementById('ci-attach-btn');
    const input = document.getElementById('ci-attach-input');
    if (!btn || !input) {
      console.warn('ci-attach: botón o input no encontrado');
      return false;
    }

    btn.addEventListener('click', e => {
      e.preventDefault();
      input.click();
    });

    input.addEventListener('change', e => {
      if (e.target.files && e.target.files.length) {
        _addFiles(e.target.files);
      }
      // Reset para poder seleccionar el mismo archivo otra vez si lo quitan
      e.target.value = '';
    });

    _initDragAndDrop();

    _inited = true;
    console.log('✅ ci-attach.js inicializado');
    return true;
  }

  // ── API pública ─────────────────────────────────────────────────────────
  window.ciInitAttach     = ciInitAttach;
  window.ciAttachHasPending = () => _queue.length > 0;
  window.ciAttachUploadAll  = _uploadAll;
  window.ciAttachClear      = _clearQueue;
  // Permite agregar archivos/blobs desde otros módulos (ej: ci-audio.js)
  window.ciAttachAddFiles   = (fileList) => _addFiles(fileList);
})();