// ============================================
// CI-REPLY.JS — Citar/Responder mensajes (estilo WhatsApp)
//
// API pública:
//   window.ciInitReply()       — inicializa (idempotente)
//   window.ciSetReply(msg)     — activa cita (msg = mensaje a responder)
//   window.ciClearReply()      — limpia la cita pendiente
//   window.ciGetReplyTo()      — retorna el objeto reply_to actual o null
//   window.ciJumpToMessage(id) — scroll al mensaje + highlight
//
// HTML requerido:
//   #ci-reply-banner   — banner arriba del input (oculto por defecto)
//   #ci-reply-content  — contenido (nombre + preview)
//   #ci-reply-cancel   — botón X
// ============================================

(function () {
  'use strict';

  let _replyTo = null;
  let _inited  = false;

  // Helper de escape (no asumir que está global)
  function _esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function _previewFromMsg(rt) {
    if (!rt) return '';
    if (rt.text && rt.text.trim()) return rt.text.trim();
    const t = rt.attachment_type;
    if (t === 'image') return '📷 Foto';
    if (t === 'video') return '🎥 Video';
    if (t === 'audio') return '🎵 Audio';
    if (t) return '📎 Archivo';
    return '';
  }

  function ciSetReply(msg) {
    if (!msg || !msg.message_id) {
      console.warn('ci-reply: mensaje sin message_id, no se puede citar');
      return;
    }
    _replyTo = {
      message_id:      msg.message_id,
      from_id:         msg.from_id,
      from_name:       msg.from_name,
      text:            (msg.text || '').slice(0, 200),
      attachment_type: msg.attachment ? msg.attachment.type : null,
      attachment_url:  msg.attachment ? msg.attachment.url : null,
    };
    _renderBanner();

    // Foco al input
    const input = document.getElementById('ci-input');
    if (input) input.focus();
  }

  function ciClearReply() {
    _replyTo = null;
    _renderBanner();
  }

  function ciGetReplyTo() {
    return _replyTo;
  }

  function _renderBanner() {
    const banner  = document.getElementById('ci-reply-banner');
    const content = document.getElementById('ci-reply-content');
    if (!banner || !content) return;

    if (!_replyTo) {
      banner.style.display = 'none';
      content.innerHTML = '';
      return;
    }

    const name    = _esc(_replyTo.from_name || 'Usuario');
    const preview = _esc(_previewFromMsg(_replyTo));
    const thumb   = (_replyTo.attachment_type === 'image' && _replyTo.attachment_url)
      ? `<img class="ci-reply-thumb" src="${_esc(_replyTo.attachment_url)}" alt="" />`
      : '';
    content.innerHTML = `
      <div class="ci-reply-texts">
        <div class="ci-reply-name">${name}</div>
        <div class="ci-reply-preview">${preview}</div>
      </div>
      ${thumb}
    `;
    banner.style.display = 'flex';
  }

  function ciJumpToMessage(messageId) {
    if (!messageId) return;
    const el = document.querySelector(`.ci-msg[data-message-id="${messageId}"]`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('ci-msg-highlight');
    setTimeout(() => el.classList.remove('ci-msg-highlight'), 2000);
  }

  function ciInitReply() {
    if (_inited) return true;
    const cancelBtn = document.getElementById('ci-reply-cancel');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', e => {
        e.preventDefault();
        ciClearReply();
      });
    }
    _inited = true;
    console.log('✅ ci-reply.js inicializado');
    return true;
  }

  window.ciInitReply     = ciInitReply;
  window.ciSetReply      = ciSetReply;
  window.ciClearReply    = ciClearReply;
  window.ciGetReplyTo    = ciGetReplyTo;
  window.ciJumpToMessage = ciJumpToMessage;
})();