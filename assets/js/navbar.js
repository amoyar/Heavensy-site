// ── HEAVENSY NAV — DROPDOWN USUARIO ──

function toggleUserMenu() {
  const user = document.querySelector('.hv-nav-user');
  const dd   = document.getElementById('user-dropdown');
  if (!user || !dd) return;
  const open = !dd.classList.contains('open');
  dd.classList.toggle('open', open);
  user.classList.toggle('open', open);
}

document.addEventListener('click', function(e) {
  if (!e.target.closest('.hv-nav-user-wrap')) {
    const dd   = document.getElementById('user-dropdown');
    const user = document.querySelector('.hv-nav-user');
    if (dd)   dd.classList.remove('open');
    if (user) user.classList.remove('open');
  }
});
