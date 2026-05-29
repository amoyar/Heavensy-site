// ============================================
// CI-AUDIO-PLAYER.JS — Reproductor de audio custom del Chat Interno
//
// Reemplaza el <audio controls> nativo (feo y distinto en cada navegador)
// por un reproductor con estilo WhatsApp: play/pausa, barra arrastrable, tiempo.
//
// Usa delegación de eventos sobre el feed, así funciona con mensajes que
// llegan dinámicamente (no necesita re-inicializar por cada audio nuevo).
//
// Estructura HTML que controla (generada en chat_interno.js):
//   .ci-audio-player[data-audio-state]
//     audio.ci-audio-engine        ← motor real (oculto)
//     button.ci-audio-play         ← botón play/pausa
//     .ci-audio-body
//       .ci-audio-track            ← barra (click y drag)
//         .ci-audio-track-fill     ← progreso
//         .ci-audio-track-handle   ← perilla
//       .ci-audio-time
//         .ci-audio-current        ← tiempo actual
//         .ci-audio-duration       ← duración total
//
// API pública:
//   window.ciInitAudioPlayer()  — inicializa (idempotente)
// ============================================

(function () {
  'use strict';

  let _dragging = null;   // .ci-audio-player que se está arrastrando

  function _fmt(secs) {
    if (!secs || !isFinite(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  function _setState(player, state) {
    player.dataset.audioState = state;
    const icon = player.querySelector('.ci-audio-play i');
    if (icon) {
      icon.className = state === 'playing' ? 'fas fa-pause' : 'fas fa-play';
    }
    const btn = player.querySelector('.ci-audio-play');
    if (btn) btn.setAttribute('aria-label', state === 'playing' ? 'Pausar' : 'Reproducir');
  }

  function _updateProgress(player) {
    const audio = player.querySelector('.ci-audio-engine');
    const fill  = player.querySelector('.ci-audio-track-fill');
    const handle = player.querySelector('.ci-audio-track-handle');
    const cur   = player.querySelector('.ci-audio-current');
    if (!audio || !audio.duration || !isFinite(audio.duration)) return;

    const pct = (audio.currentTime / audio.duration) * 100;
    if (fill)   fill.style.width = pct + '%';
    if (handle) handle.style.left = pct + '%';
    if (cur)    cur.textContent = _fmt(audio.currentTime);
  }

  function _togglePlay(player) {
    const audio = player.querySelector('.ci-audio-engine');
    if (!audio) return;

    if (audio.paused) {
      // Pausar cualquier otro audio que esté sonando (un solo audio a la vez)
      document.querySelectorAll('.ci-audio-engine').forEach(a => {
        if (a !== audio && !a.paused) {
          a.pause();
          const otherPlayer = a.closest('.ci-audio-player');
          if (otherPlayer) _setState(otherPlayer, 'paused');
        }
      });
      audio.play().then(() => {
        _setState(player, 'playing');
      }).catch(err => {
        console.error('ci-audio-player: no se pudo reproducir:', err);
        if (window.showToast) window.showToast('No se pudo reproducir el audio', 'error');
      });
    } else {
      audio.pause();
      _setState(player, 'paused');
    }
  }

  // Calcula el tiempo según la posición X del mouse/touch sobre la barra
  function _seekToClientX(player, clientX) {
    const audio = player.querySelector('.ci-audio-engine');
    const track = player.querySelector('.ci-audio-track');
    if (!audio || !track || !audio.duration || !isFinite(audio.duration)) return;

    const rect = track.getBoundingClientRect();
    let ratio = (clientX - rect.left) / rect.width;
    ratio = Math.max(0, Math.min(1, ratio));
    audio.currentTime = ratio * audio.duration;
    _updateProgress(player);
  }

  function ciInitAudioPlayer() {
    const feed = document.getElementById('ci-feed');
    if (!feed) {
      console.warn('ci-audio-player: #ci-feed no encontrado');
      return false;
    }
    // Guard por elemento: si este nodo feed ya tiene los listeners, no duplicar.
    // (Si el SPA recreara el feed, el nuevo nodo no tendría la marca y se re-inicializa.)
    if (feed.dataset.audioPlayerInit === '1') return true;
    feed.dataset.audioPlayerInit = '1';

    // ── Click en play/pausa ──
    feed.addEventListener('click', (e) => {
      const playBtn = e.target.closest('.ci-audio-play');
      if (playBtn) {
        e.preventDefault();
        const player = playBtn.closest('.ci-audio-player');
        if (player) _togglePlay(player);
        return;
      }
      // Click directo en la barra (seek)
      const track = e.target.closest('.ci-audio-track');
      if (track && !_dragging) {
        const player = track.closest('.ci-audio-player');
        if (player) _seekToClientX(player, e.clientX);
      }
    });

    // ── Eventos de los <audio> (delegados con captura) ──
    feed.addEventListener('timeupdate', (e) => {
      const audio = e.target;
      if (!audio.classList || !audio.classList.contains('ci-audio-engine')) return;
      const player = audio.closest('.ci-audio-player');
      if (player && _dragging !== player) _updateProgress(player);
    }, true);

    feed.addEventListener('loadedmetadata', (e) => {
      const audio = e.target;
      if (!audio.classList || !audio.classList.contains('ci-audio-engine')) return;
      const player = audio.closest('.ci-audio-player');
      if (!player) return;
      const durEl = player.querySelector('.ci-audio-duration');
      if (durEl && audio.duration && isFinite(audio.duration)) {
        durEl.textContent = _fmt(audio.duration);
      }
    }, true);

    feed.addEventListener('ended', (e) => {
      const audio = e.target;
      if (!audio.classList || !audio.classList.contains('ci-audio-engine')) return;
      const player = audio.closest('.ci-audio-player');
      if (!player) return;
      _setState(player, 'paused');
      audio.currentTime = 0;
      _updateProgress(player);
    }, true);

    // ── Drag de la perilla / barra ──
    feed.addEventListener('mousedown', (e) => {
      const track = e.target.closest('.ci-audio-track');
      if (!track) return;
      e.preventDefault();
      _dragging = track.closest('.ci-audio-player');
      _seekToClientX(_dragging, e.clientX);
    });

    // Touch (móvil)
    feed.addEventListener('touchstart', (e) => {
      const track = e.target.closest('.ci-audio-track');
      if (!track) return;
      _dragging = track.closest('.ci-audio-player');
      _seekToClientX(_dragging, e.touches[0].clientX);
    }, { passive: true });

    feed.addEventListener('touchmove', (e) => {
      if (_dragging && e.touches[0]) _seekToClientX(_dragging, e.touches[0].clientX);
    }, { passive: true });

    feed.addEventListener('touchend', () => {
      _dragging = null;
    });

    console.log('✅ ci-audio-player.js inicializado');
    return true;
  }

  // Listeners globales de drag — se registran UNA vez al cargar el script
  // (document nunca se recrea, así que no van dentro del init para no duplicarse)
  document.addEventListener('mousemove', (e) => {
    if (_dragging) _seekToClientX(_dragging, e.clientX);
  });
  document.addEventListener('mouseup', () => {
    _dragging = null;
  });

  window.ciInitAudioPlayer = ciInitAudioPlayer;
})();