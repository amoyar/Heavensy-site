// ============================================
// CI-EMOJI.JS — Bridge para conectar el emoji picker (emoji.js)
//               al input del Chat Interno (#ci-input).
//
// Requisitos:
//   • emoji.js cargado previamente (define window.initEmojiPicker)
//   • Botón con id "ci-emoji-btn" en el HTML del chat_interno
//   • Textarea con id "ci-input"
//
// Uso (desde chat_interno.js):
//   ciInitEmoji();   // se llama una vez al montar el módulo
// ============================================

(function () {
  'use strict';

  const BTN_ID   = 'ci-emoji-btn';
  const INPUT_ID = 'ci-input';

  function ciInitEmoji() {
    // emoji.js debe estar cargado primero
    if (typeof window.initEmojiPicker !== 'function') {
      console.warn('⚠️ ci-emoji.js: emoji.js no está cargado todavía');
      return false;
    }

    // El botón debe existir en el DOM (el módulo chat_interno está montado)
    const btn = document.getElementById(BTN_ID);
    if (!btn) {
      console.warn('⚠️ ci-emoji.js: botón #' + BTN_ID + ' no encontrado');
      return false;
    }

    // Inicializar el picker. Si ya estaba inicializado, initEmojiPicker
    // retorna false y no rompe nada (idempotente vía btn._emojiReady).
    return window.initEmojiPicker({ btnId: BTN_ID, inputId: INPUT_ID });
  }

  // Exponer para que chat_interno.js lo llame al montar el módulo
  window.ciInitEmoji = ciInitEmoji;
})();