// ============================================
// MENSAJES — Tab controller
// ============================================

let _msgMonitorInited = false;

function initMensajesPage() {
  _msgMonitorInited = false;
}

function msgSwitchTab(tab, btn) {
  document.querySelectorAll('.msg-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('.msg-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('msg-panel-' + tab).classList.add('active');

  if (tab === 'monitor' && !_msgMonitorInited) {
    _msgMonitorInited = true;
    if (typeof initMonitorPage === 'function') initMonitorPage();
  }
}

window.initMensajesPage = initMensajesPage;
window.msgSwitchTab     = msgSwitchTab;
