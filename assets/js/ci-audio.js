// ============================================
// CI-AUDIO.JS — Grabación de audio del Chat Interno
//
// Graba audio con MediaRecorder y lo inyecta en la cola de adjuntos
// (ci-attach.js) como un archivo más, reutilizando todo el upload.
//
// Flujo:
//   • Mantener presionado el botón mic → graba
//   • Soltar → detiene y agrega el audio a la cola de adjuntos
//   • El audio aparece en el preview como un adjunto normal
//   • Al enviar, se sube igual que cualquier archivo
//
// HTML requerido:
//   #ci-mic-btn   — botón micrófono
//   #ci-mic-icon  — ícono dentro del botón (cambia de color al grabar)
//
// API pública:
//   window.ciInitAudio()  — inicializa (idempotente)
// ============================================

(function () {
  'use strict';

  let _mediaRecorder = null;
  let _chunks = [];
  let _timer = null;
  let _stream = null;
  let _mimeType = '';
  let _extension = '';
  let _recording = false;
  let _inited = false;
  let _startTime = 0;

  const MAX_SECONDS = 120;
  const MIN_MS = 500;  // ignorar grabaciones accidentales (clicks cortos)

  // Elegir el mimeType soportado (mismos fallbacks que conversaciones)
  function _pickMimeType() {
    let mime = 'audio/ogg;codecs=opus';
    if (!MediaRecorder.isTypeSupported(mime)) mime = 'audio/mp4';
    if (!MediaRecorder.isTypeSupported(mime)) mime = 'audio/webm;codecs=opus';
    if (!MediaRecorder.isTypeSupported(mime)) mime = 'audio/webm';
    const ext = mime.includes('ogg') ? 'ogg'
              : mime.includes('mp4') ? 'mp4'
              : 'webm';
    return { mime, ext };
  }

  // mime "limpio" para el File/blob (sin ;codecs=...)
  function _baseMime(mime) {
    return mime.split(';')[0];
  }

  async function _startRecording() {
    if (_recording) return;
    try {
      _stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const picked = _pickMimeType();
      _mimeType  = picked.mime;
      _extension = picked.ext;

      _mediaRecorder = new MediaRecorder(_stream, { mimeType: _mimeType });
      _chunks = [];
      _recording = true;
      _startTime = Date.now();

      _mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) _chunks.push(e.data);
      };

      _mediaRecorder.onstop = () => {
        if (_stream) {
          _stream.getTracks().forEach(t => t.stop());
          _stream = null;
        }
        _recording = false;

        // Descartar grabaciones accidentales (click corto sin mantener)
        const elapsed = Date.now() - _startTime;
        if (elapsed < MIN_MS || !_chunks.length) {
          if (elapsed < MIN_MS && _chunks.length) {
            console.log('🎤 Grabación demasiado corta, descartada');
          }
          return;
        }

        const baseMime = _baseMime(_mimeType);
        const blob = new Blob(_chunks, { type: baseMime });

        // Nombre legible con timestamp
        const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const fileName = `audio_${ts}.${_extension}`;

        // Convertir blob → File para que la cola de adjuntos lo trate igual
        const file = new File([blob], fileName, { type: baseMime });

        // Inyectar en la cola de ci-attach
        if (typeof window.ciAttachAddFiles === 'function') {
          window.ciAttachAddFiles([file]);
        } else {
          console.warn('ci-audio: ciAttachAddFiles no disponible');
        }

        console.log(`🎤 Audio grabado: ${(blob.size / 1024).toFixed(1)} KB`);
      };

      _mediaRecorder.start();

      // UI: marcar grabando
      _setRecordingUI(true);

      // Tope de duración
      _timer = setTimeout(() => _stopRecording(), MAX_SECONDS * 1000);

    } catch (err) {
      console.error('❌ ci-audio: error accediendo al micrófono:', err);
      _recording = false;
      if (window.showToast) {
        window.showToast('No se pudo acceder al micrófono. Verifica los permisos.', 'error');
      } else if (window.ciConfirmar) {
        window.ciConfirmar({
          titulo:      'Micrófono no disponible',
          mensaje:     'No se pudo acceder al micrófono. Verifica los permisos del navegador.',
          confirmar:   'Entendido',
          peligro:     true,
          soloAceptar: true,
        });
      }
    }
  }

  function _stopRecording() {
    if (_timer) { clearTimeout(_timer); _timer = null; }
    if (_mediaRecorder && _mediaRecorder.state === 'recording') {
      _mediaRecorder.stop();
    }
    _setRecordingUI(false);
  }

  function _setRecordingUI(on) {
    const icon = document.getElementById('ci-mic-icon');
    const btn  = document.getElementById('ci-mic-btn');
    if (icon) {
      if (on) icon.classList.add('ci-mic-recording');
      else    icon.classList.remove('ci-mic-recording');
    }
    if (btn) {
      if (on) btn.classList.add('recording');
      else    btn.classList.remove('recording');
    }
  }

  function ciInitAudio() {
    if (_inited) return true;
    const btn = document.getElementById('ci-mic-btn');
    if (!btn) {
      console.warn('ci-audio: botón #ci-mic-btn no encontrado');
      return false;
    }

    // Mantener presionado para grabar (mouse y touch)
    btn.addEventListener('mousedown', (e) => { e.preventDefault(); _startRecording(); });
    btn.addEventListener('mouseup',   (e) => { e.preventDefault(); _stopRecording(); });
    btn.addEventListener('mouseleave', () => { if (_recording) _stopRecording(); });
    btn.addEventListener('touchstart', (e) => { e.preventDefault(); _startRecording(); }, { passive: false });
    btn.addEventListener('touchend',   (e) => { e.preventDefault(); _stopRecording(); }, { passive: false });

    _inited = true;
    console.log('✅ ci-audio.js inicializado');
    return true;
  }

  window.ciInitAudio = ciInitAudio;
})();