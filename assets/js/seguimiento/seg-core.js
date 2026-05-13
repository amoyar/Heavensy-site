/* ═══════════════════════════════════════════════════════
   SEGUIMIENTO — seg-core.js
   SEG state global, segInit, segInitCompanyDropdown, segCargarEmpresas. Punto de entrada del módulo.
═══════════════════════════════════════════════════════ */

/* ─────────────────────────────────────────
   ESTADO GLOBAL
───────────────────────────────────────── */
var SEG = {
  companyId:            null,
  companyNombre:        null,
  clienteId:            null,
  registroId:           null,
  citaId:               null,
  citaStatus:           null,
  template:             null,
  labels:               {},
  contexto:             null,
  hayEntidades:         [],
  hayTodas:             [],
  hayUnsaved:           false,
  tl_visible:           true,
  _toastTimer:          null,
  etiquetasDisponibles: [],
  etiquetasActivas:     [],
  _etiquetaFiltro:      [],
  _slashQuery:          '',
  _cal: { anio: null, mes: null, fechaSel: null },
  _tp:  { hora: null, min: null }
};

/* ─────────────────────────────────────────
   INIT
───────────────────────────────────────── */
function segInit() {
  // Leer empresa activa desde el JWT
  try {
    var token = localStorage.getItem('token');
    if (!token) return;
    var payload = JSON.parse(atob(token.split('.')[1]));
    var companyId   = payload.company_id;
    var companyName = payload.company_name || companyId;
    if (!companyId) return;

    // Mostrar nombre en la etiqueta
    var label = document.getElementById('segCompanyDropdownLabel');
    if (label) label.textContent = companyName;

    // Sincronizar select oculto (compatibilidad con segSetCompany)
    var sel = document.getElementById('segCompanyFilter');
    if (sel) {
      sel.innerHTML = '<option value="' + companyId + '" selected>' + companyName + '</option>';
      sel.value = companyId;
    }

    // Cargar datos de seguimiento directamente
    segSetCompany(companyId, companyName);

    window.onCompanyChange = function(id, nom) {
      segSetCompany(id, nom);
    };
  } catch(e) {
    console.error('segInit error:', e);
  }
}

/* Dropdown idéntico al de conversaciones */
function segInitCompanyDropdown() {
  var btn   = document.getElementById('segCompanyDropdownBtn');
  var list  = document.getElementById('segCompanyDropdownList');
  var items = document.getElementById('segCompanyDropdownItems');
  var label = document.getElementById('segCompanyDropdownLabel');
  var icon  = document.getElementById('segCompanyDropdownIcon');
  var sel   = document.getElementById('segCompanyFilter');
  if (!btn || !sel) return;

  function buildItems() {
    items.innerHTML = '';
    Array.from(sel.options).forEach(function(opt) {
      var div = document.createElement('div');
      div.textContent = opt.text;
      div.dataset.value = opt.value;
      div.style.cssText = 'padding:7px 12px;font-size:13px;cursor:pointer;color:' + (opt.value ? '#374151' : '#9ca3af') + ';';
      div.addEventListener('mouseover', function() { this.style.background = '#EFF6FF'; });
      div.addEventListener('mouseout',  function() {
        this.style.background = sel.value === this.dataset.value ? '#EFF6FF' : '';
      });
      div.addEventListener('click', function() {
        sel.value = this.dataset.value;
        label.textContent = this.textContent;
        label.style.color = this.dataset.value ? '#374151' : '#9ca3af';
        list.style.opacity = '0';
        list.style.transform = 'translateY(-4px)';
        setTimeout(function() { list.style.display = 'none'; }, 180);
        icon.style.transform = '';
        highlightSelected();
        if (sel.value) segSetCompany(sel.value, this.textContent);
      });
      items.appendChild(div);
    });
    highlightSelected();
  }

  function highlightSelected() {
    Array.from(items.children).forEach(function(d) {
      var active = d.dataset.value === sel.value && sel.value !== '';
      d.style.background  = active ? '#EFF6FF' : '';
      d.style.color       = active ? '#7D84C1' : (d.dataset.value ? '#374151' : '#9ca3af');
      d.style.fontWeight  = active ? '600' : '400';
      d.style.borderLeft  = active ? '2px solid #7D84C1' : '';
      d.style.paddingLeft = active ? '10px' : '12px';
    });
  }

  btn.addEventListener('click', function(e) {
    e.stopPropagation();
    var open = list.style.display === 'block' && list.style.opacity !== '0';
    if (open) {
      list.style.opacity = '0';
      list.style.transform = 'translateY(-4px)';
      setTimeout(function() { list.style.display = 'none'; }, 180);
    } else {
      list.style.display = 'block';
      list.style.opacity = '0';
      list.style.transform = 'translateY(-4px)';
      list.style.transition = 'opacity 0.18s ease, transform 0.18s ease';
      requestAnimationFrame(function() {
        requestAnimationFrame(function() {
          list.style.opacity = '1';
          list.style.transform = 'translateY(0)';
        });
      });
    }
    icon.style.transform = open ? '' : 'rotate(180deg)';
  });

  document.addEventListener('click', function(e) {
    var wrap = document.getElementById('segCompanyDropdownWrap');
    if (wrap && !wrap.contains(e.target)) {
      list.style.opacity = '0';
      list.style.transform = 'translateY(-4px)';
      setTimeout(function() { list.style.display = 'none'; }, 180);
      icon.style.transform = '';
    }
  });

  // MutationObserver — igual que conversaciones
  new MutationObserver(function() {
    buildItems();
    label.textContent = 'Seleccione una empresa';
    label.style.color = '#9ca3af';
  }).observe(sel, { childList: true });

  // Si ya hay opciones (recarga), construir inmediatamente
  if (sel.options.length > 1) {
    buildItems();
    var cur = sel.options[sel.selectedIndex];
    label.textContent = (cur && cur.value) ? cur.text : 'Seleccione una empresa';
    label.style.color = (cur && cur.value) ? '#374151' : '#9ca3af';
  }
}

function segGetUserCompanies() {
  // Superadmin usa la API completa
  try {
    var token = localStorage.getItem('token');
    if (token) {
      var payload = JSON.parse(atob(token.split('.')[1]));
      var roles = payload.roles || [];
      if (roles.indexOf('SUPERADMIN_ROL') !== -1 || roles.indexOf('superadmin') !== -1) return null;
    }
  } catch(e) {}
  // Usuario normal — usa empresas guardadas al hacer login
  try {
    var stored = localStorage.getItem('hs_user_companies');
    if (stored) return JSON.parse(stored);
  } catch(e) {}
  return null;
}

function segCargarEmpresas(defaultId) {
  // Solo poblar el select oculto — igual que poblarSelectorEmpresas en conversaciones
  // El MutationObserver en segInitCompanyDropdown se encarga del resto

  function _populate(companies) {
    var sel = document.getElementById('segCompanyFilter');
    if (!sel) return;

    sel.innerHTML = '<option value="">Seleccione una empresa</option>';
    companies.forEach(function(c) {
      var opt = document.createElement('option');
      opt.value = c.company_id;
      opt.textContent = c.name || c.company_name || c.company_id;
      sel.appendChild(opt);
    });

    // Auto-seleccionar solo si hay una empresa
    if (companies.length === 1) {
      var c = companies[0];
      sel.value = c.company_id;
      var label = document.getElementById('segCompanyDropdownLabel');
      if (label) { label.textContent = c.name || c.company_name || c.company_id; label.style.color = '#374151'; }
      segSetCompany(c.company_id, c.name || c.company_name || c.company_id);
    }
  }

  // Usar empresas del usuario si están disponibles (no superadmin)
  var userCompanies = segGetUserCompanies();
  if (userCompanies) {
    _populate(userCompanies);
    return;
  }

  // Fallback: API completa (superadmin o sesión antigua)
  apiCall('/api/companies').then(function(res) {
    var companies = (res.ok && res.data && res.data.companies) ? res.data.companies : [];
    _populate(companies);
  }).catch(function() {
    var label = document.getElementById('segCompanyDropdownLabel');
    if (label) label.textContent = 'Error al cargar empresas';
  });
}