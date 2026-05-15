// ── EMBUDOS KANBAN — HEAVENSY ──

var _embAPI     = 'https://heavensy-api-backend-v2.onrender.com';
var _embCompany = '';
var _embFunnels = [];
var _embContacts= [];
var _embDragging   = null; // { contactId, fromFunnelId }
var _embDraggingCol = null; // funnelId al reordenar columnas
var _embMoveCtx = null; // contacto para modal mover

// ── SELECCIÓN ──
var _embSelected = new Map(); // id → contact

function embToggleSelect(contactId, card) {
  var c = _embContacts.find(function(x){ return x.id === contactId; });
  if (!c) return;
  if (_embSelected.has(contactId)) {
    _embSelected.delete(contactId);
    card.classList.remove('selected');
    var chk = card.querySelector('.emb-card-check');
    if (chk) chk.remove();
  } else {
    _embSelected.set(contactId, c);
    card.classList.add('selected');
    var chk = document.createElement('div');
    chk.className = 'emb-card-check';
    chk.innerHTML = '<i class="fas fa-check"></i>';
    card.insertBefore(chk, card.firstChild);
  }
  _embUpdateSelectBar();
}
window.embToggleSelect = embToggleSelect;

function _embUpdateSelectBar() {
  var bar = document.getElementById('emb-select-bar');
  if (!bar) return;
  var n = _embSelected.size;
  if (n === 0) { bar.classList.remove('visible'); return; }
  bar.classList.add('visible');
  var countEl = document.getElementById('emb-select-count');
  var namesEl = document.getElementById('emb-select-names');
  if (countEl) countEl.textContent = n + ' seleccionado' + (n !== 1 ? 's' : '');
  if (namesEl) namesEl.textContent = [..._embSelected.values()].map(function(c){ return c.nombre; }).join(' · ');
}

function embLimpiarSeleccion() {
  _embSelected.clear();
  _embUpdateSelectBar();
  _embRenderBoard();
}
window.embLimpiarSeleccion = embLimpiarSeleccion;

function embEnviarASeleccionados() {
  if (!_embSelected.size) return;
  window._embMsgDestinatarios = [..._embSelected.keys()];
  var titleEl = document.getElementById('emb-msg-title');
  if (titleEl) titleEl.textContent = 'Mensaje a seleccionados';
  _embRenderDestinatarios([..._embSelected.values()]);
  _embActualizarContadorDest();
  // Reset canal y archivo
  _embMsgCanal = 'whatsapp';
  _embMsgFile  = null;
  document.querySelectorAll('.emb-canal-btn').forEach(function(b){ b.classList.remove('active'); });
  var waBtn = document.getElementById('emb-canal-wa');
  if (waBtn) waBtn.classList.add('active');
  var prev = document.getElementById('emb-attach-preview');
  if (prev) prev.style.display = 'none';
  var txt = document.getElementById('emb-msg-text');
  if (txt) txt.value = '';
  document.getElementById('emb-overlay-msg').classList.add('open');
}
window.embEnviarASeleccionados = embEnviarASeleccionados;

var _embCanalIcon = {
  whatsapp:  '<i class="fab fa-whatsapp"></i>',
  instagram: '<i class="fab fa-instagram"></i>',
  messenger: '<i class="fab fa-facebook-messenger"></i>',
  heavensy:  '<i class="fas fa-star"></i>'
};

var _embCanalLabel = {
  whatsapp: 'WhatsApp', instagram: 'Instagram',
  messenger: 'Messenger', heavensy: 'Heavensy'
};

// ── DEMO DATA ──
var _embDemo = {
  funnels: [
    { id:'f1', nombre:'Prospectos',           etapas:['Nuevo','Contactado','Interesado','Cerrado']      },
    { id:'f2', nombre:'Psicoterapia',         etapas:['Interesado','En proceso','Cerrado']              },
    { id:'f3', nombre:'Masaje terapéutico',   etapas:['Interesado','En proceso','Cerrado']              },
    { id:'f4', nombre:'Reiki',                etapas:['Interesado','En proceso','Cerrado']              },
    { id:'f5', nombre:'Curso de Hipnosis',    etapas:['Inscrito','En curso','Completado']               },
    { id:'f6', nombre:'Taller de Ventrílocuo',etapas:['Inscrito','En curso','Completado']               }
  ],
  contacts: [
    { id:'c1', nombre:'Josefina Araya',    pais:'Chile', region:'RM', ciudad:'La Reina',     canal:'heavensy',  unread:3,  last_msg: new Date(Date.now() - 1000*60*10).toISOString(),         funnel_ids:['f1','f2','f4'], etapas:{ f1:'Interesado', f2:'En proceso', f4:'Cerrado'    } },
    { id:'c2', nombre:'Roberto del Río',   pais:'Chile', region:'RM', ciudad:'La Reina',     canal:'instagram', unread:0,  last_msg: new Date(Date.now() - 1000*60*60*2).toISOString(),       funnel_ids:['f1','f3'],      etapas:{ f1:'En proceso', f3:'Interesado'                  } },
    { id:'c3', nombre:'Casa Merkaba',      pais:'Chile', region:'RM', ciudad:'Providencia',  canal:'messenger', unread:12, last_msg: new Date(Date.now() - 1000*60*60*26).toISOString(),      funnel_ids:['f2','f5'],      etapas:{ f2:'Interesado', f5:'En proceso'                  } },
    { id:'c4', nombre:'Sandra Paltas',     pais:'Chile', region:'RM', ciudad:'La Reina',     canal:'whatsapp',  unread:1,  last_msg: new Date(Date.now() - 1000*60*30).toISOString(),         funnel_ids:['f1','f3','f6'], etapas:{ f1:'Interesado', f3:'Cerrado',    f6:'En proceso' } },
    { id:'c5', nombre:'Marcela Fuentes',   pais:'Chile', region:'RM', ciudad:'Santiago',     canal:'whatsapp',  unread:0,  last_msg: new Date(Date.now() - 1000*60*60*24*3).toISOString(),   funnel_ids:['f2'],           etapas:{ f2:'En proceso'                                  } },
    { id:'c6', nombre:'Tomás Herrera',     pais:'Chile', region:'RM', ciudad:'Ñuñoa',        canal:'instagram', unread:5,  last_msg: new Date(Date.now() - 1000*60*60*24*1.5).toISOString(), funnel_ids:['f3','f4'],      etapas:{ f3:'Interesado', f4:'En proceso'                  } },
    { id:'c7', nombre:'Valentina Soto',    pais:'Chile', region:'V',  ciudad:'Viña del Mar', canal:'heavensy',  unread:0,  last_msg: new Date(Date.now() - 1000*60*60*24*10).toISOString(),  funnel_ids:['f5','f6'],      etapas:{ f5:'Cerrado',    f6:'Interesado'                  } },
    { id:'c8', nombre:'Felipe Castillo',   pais:'Chile', region:'RM', ciudad:'Maipú',        canal:'messenger', unread:2,  last_msg: new Date(Date.now() - 1000*60*5).toISOString(),          funnel_ids:['f1','f5'],      etapas:{ f1:'Interesado', f5:'En proceso'                  } },
    { id:'c9', nombre:'Carla Rojas',       pais:'Chile', region:'RM', ciudad:'Las Condes',   canal:'instagram', unread:0,  last_msg: new Date(Date.now() - 1000*60*60*24*6).toISOString(),   funnel_ids:['f4','f6'],      etapas:{ f4:'Cerrado',    f6:'Interesado'                  } }
  ]
};

// ── INIT ──
function initEmbudosPage() {
  try {
    _embCompany = localStorage.getItem('company_id') || '';
    if (!_embCompany) {
      var cfg = JSON.parse(localStorage.getItem('company_config') || '{}');
      _embCompany = cfg.company_id || '';
    }
  } catch(e) {}
  _embLoad();
}

function _embLoad() {
  if (!_embCompany) { _embLoadDemo(); return; }

  Promise.all([
    _embFetch('/api/funnels/' + _embCompany),
    _embFetch('/api/funnels/' + _embCompany + '/contacts').catch(function(){ return null; })
  ])
  .then(function(results) {
    var funnelData   = results[0];
    var contactsData = results[1];

    if (!funnelData || (!funnelData.funnels && !funnelData.data)) {
      _embLoadDemo(); return;
    }

    // Mapear funnels — guardar stages completos para lookup de labels
    var rawFunnels = funnelData.funnels || funnelData.data || [];
    _embFunnels = rawFunnels.map(function(f) {
      var stages = Array.isArray(f.stages) && f.stages.length && typeof f.stages[0] === 'object'
        ? f.stages : [];
      return {
        id:     f._id || f.id,
        nombre: f.name || f.nombre || f.title || '—',
        color:  f.color || '#9961FF',
        stages: stages,
        etapas: stages.length
          ? stages.map(function(s) { return s.label; })
          : ['Interesado', 'En proceso', 'Cerrado']
      };
    });

    if (!_embFunnels.length) { _embLoadDemo(); return; }

    // Mapear contactos desde /contacts — ya vienen con funnels[]
    var rawContacts = (contactsData && contactsData.contacts) ? contactsData.contacts : [];
    _embContacts = rawContacts.map(function(c) {
      var funnel_ids = [];
      var etapas     = {};  // { funnel_id: stage_label }  para mostrar
      var stage_ids  = {};  // { funnel_id: stage_id }     para llamadas API

      (c.funnels || []).forEach(function(entry) {
        var fid = entry.funnel_id;
        var sid = entry.stage_id;
        funnel_ids.push(fid);
        stage_ids[fid] = sid;
        // Resolver label a partir de las stages del embudo
        var f = _embFunnels.find(function(x) { return x.id === fid; });
        var label = sid;
        if (f) {
          var stg = (f.stages || []).find(function(s) { return s.id === sid; });
          if (stg) label = stg.label;
        }
        etapas[fid] = label;
      });

      var av = c.avatar;
      return {
        id:         c.user_id,
        nombre:     c.profile_name || c.user_id || '—',
        telefono:   c.user_id || '',
        canal:      'whatsapp',
        is_vip:     c.status === 'vip',
        foto_url:   av ? (av.secure_url || av.url || null) : null,
        unread:     c.unread_count || 0,
        last_msg:   c.last_message_at || null,
        funnel_ids: funnel_ids,
        etapas:     etapas,
        stage_ids:  stage_ids
      };
    });

    _embRenderBoard();
    _embPopulateEmbudoSelect();
  })
  .catch(function() { _embLoadDemo(); });
}

function _embLoadDemo() {
  _embFunnels  = _embDemo.funnels;
  _embContacts = _embDemo.contacts;
  _embRenderBoard();
  _embPopulateEmbudoSelect();
}

// Actualizar unread en tiempo real si hay evento de nueva conversación
document.addEventListener('heavensy:unread_update', function(e) {
  var detail = e.detail || {};
  var c = _embContacts.find(function(x){ return x.id === detail.contact_id || x.telefono === detail.phone; });
  if (!c) return;
  c.unread    = detail.unread_count || 0;
  c.last_msg  = detail.timestamp   || c.last_msg;
  _embRenderBoard();
});

function embToggleFiltros() {
  var panel = document.getElementById('emb-filter-panel');
  var btn   = document.getElementById('emb-filter-btn');
  if (!panel) return;
  panel.classList.toggle('open');
  if (btn) btn.classList.toggle('active', panel.classList.contains('open'));
}
window.embToggleFiltros = embToggleFiltros;

// Cerrar panel al click fuera
document.addEventListener('click', function(e) {
  if (!e.target.closest('.emb-filter-wrap')) {
    var panel = document.getElementById('emb-filter-panel');
    var btn   = document.getElementById('emb-filter-btn');
    if (panel) panel.classList.remove('open');
    if (btn)   btn.classList.remove('active');
  }
});

function _embPopulateEmbudoSelect() {
  var sel = document.getElementById('emb-filter-embudo');
  if (!sel) return;
  sel.innerHTML = '<option value="">Todos los embudos</option>' +
    _embFunnels.map(function(f){
      return '<option value="' + f.id + '">' + f.nombre + '</option>';
    }).join('');
}

var _embFilterVip = false;

function embToggleVip() {
  _embFilterVip = !_embFilterVip;
  var btn = document.getElementById('emb-filter-vip');
  if (btn) btn.classList.toggle('active', _embFilterVip);
  embFiltrar();
}
window.embToggleVip = embToggleVip;

function embFiltrar() {
  var q      = (document.getElementById('emb-search-input')?.value || '').toLowerCase().trim();
  var fId    = document.getElementById('emb-filter-embudo')?.value || '';
  var etapa  = document.getElementById('emb-filter-etapa')?.value || '';
  var active = q || fId || etapa || _embFilterVip;

  // Punto indicador de filtros activos
  var dot = document.getElementById('emb-filter-dot');
  if (dot) dot.style.display = (fId || etapa) ? '' : 'none';

  // Filtrar cards visibles
  document.querySelectorAll('.emb-card').forEach(function(card) {
    var cId    = card.dataset.contactId;
    var cFId   = card.dataset.funnelId;
    var c      = _embContacts.find(function(x){ return x.id === cId; });
    if (!c) { card.style.display = 'none'; return; }

    var matchQ   = !q || (c.nombre||'').toLowerCase().includes(q) || (c.telefono||'').toLowerCase().includes(q);
    var matchF   = !fId || cFId === fId;
    var matchE   = !etapa || ((c.etapas && c.etapas[cFId]) === etapa);
    var matchVip = !_embFilterVip || !!c.is_vip;

    card.style.display = (matchQ && matchF && matchE && matchVip) ? '' : 'none';
  });

  // Mostrar vacío por columna si no hay cards visibles
  document.querySelectorAll('.emb-col').forEach(function(col) {
    var list   = col.querySelector('.emb-col-list');
    if (!list) return;
    var visible = Array.from(list.querySelectorAll('.emb-card')).filter(function(c){ return c.style.display !== 'none'; });
    var empty  = list.querySelector('.emb-empty-filter');
    if (visible.length === 0 && active) {
      if (!empty) {
        var div = document.createElement('div');
        div.className = 'emb-empty emb-empty-filter';
        div.innerHTML = '<i class="fas fa-search"></i>Sin resultados';
        list.appendChild(div);
      }
    } else if (empty) {
      empty.remove();
    }
  });
}
window.embFiltrar = embFiltrar;

function embLimpiarFiltros() {
  var inp  = document.getElementById('emb-search-input');
  var selF = document.getElementById('emb-filter-embudo');
  var selE = document.getElementById('emb-filter-etapa');
  var vipBtn = document.getElementById('emb-filter-vip');
  if (inp)    inp.value  = '';
  if (selF)   selF.value = '';
  if (selE)   selE.value = '';
  _embFilterVip = false;
  if (vipBtn) vipBtn.classList.remove('active');
  embFiltrar();
}
window.embLimpiarFiltros = embLimpiarFiltros;

function _embFetch(path, opts) {
  var token = localStorage.getItem('token');
  var h = { 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = 'Bearer ' + token;
  return fetch(_embAPI + path, Object.assign({ headers: h }, opts || {}))
    .then(function(r) { if (!r.ok) throw new Error(r.status); return r.json(); });
}

// ── RENDER ──
function _embRenderBoard() {
  var board = document.getElementById('emb-board');
  if (!board) return;
  board.innerHTML = '';
  _embFunnels.forEach(function(f) {
    board.appendChild(_embMakeCol(f));
  });
}

function _embMakeCol(funnel) {
  var contacts = _embContacts.filter(function(c) {
    return c.funnel_ids && c.funnel_ids.indexOf(funnel.id) !== -1;
  }).sort(function(a, b) {
    return new Date(b.last_msg || 0) - new Date(a.last_msg || 0);
  });

  var col = document.createElement('div');
  col.className = 'emb-col';
  col.dataset.funnelId  = funnel.id;
  col.setAttribute('data-funnel-id', funnel.id);

  // Header
  var head = document.createElement('div');
  head.className = 'emb-col-head';
  head.draggable = true;
  head.style.cursor = 'grab';
  head.innerHTML =
    '<span class="emb-col-name">' + funnel.nombre + '</span>' +
    '<span class="emb-col-badge" id="emb-badge-' + funnel.id + '">' + contacts.length + '</span>' +
    '<button class="emb-col-msg" title="Enviar mensaje a todos" onclick="embAbrirMensajeGrupal(\'' + funnel.id + '\')"><i class="fas fa-paper-plane"></i></button>';

  // Drag columna
  head.addEventListener('dragstart', function(e) {
    e.stopPropagation();
    _embDraggingCol = funnel.id;
    col.style.opacity = '0.5';
    e.dataTransfer.effectAllowed = 'move';
  });
  head.addEventListener('dragend', function() {
    col.style.opacity = '';
    _embDraggingCol = null;
    document.querySelectorAll('.emb-col').forEach(function(c){ c.classList.remove('col-drag-over'); });
  });
  col.addEventListener('dragover', function(e) {
    if (!_embDraggingCol || _embDraggingCol === funnel.id) return;
    e.preventDefault();
    e.stopPropagation();
    document.querySelectorAll('.emb-col').forEach(function(c){ c.classList.remove('col-drag-over'); });
    col.classList.add('col-drag-over');
  });
  col.addEventListener('dragleave', function(e) {
    if (!col.contains(e.relatedTarget)) col.classList.remove('col-drag-over');
  });
  col.addEventListener('drop', function(e) {
    if (!_embDraggingCol || _embDraggingCol === funnel.id) return;
    e.preventDefault();
    e.stopPropagation();
    col.classList.remove('col-drag-over');
    var fromIdx = _embFunnels.findIndex(function(f){ return f.id === _embDraggingCol; });
    var toIdx   = _embFunnels.findIndex(function(f){ return f.id === funnel.id; });
    if (fromIdx === -1 || toIdx === -1) return;
    var moved = _embFunnels.splice(fromIdx, 1)[0];
    _embFunnels.splice(toIdx, 0, moved);
    _embRenderBoard();
  });

  col.appendChild(head);

  // Lista
  var list = document.createElement('div');
  list.className = 'emb-col-list';
  list.dataset.funnelId = funnel.id;

  if (contacts.length === 0) {
    list.innerHTML = '<div class="emb-empty"><i class="fas fa-inbox"></i>Sin contactos</div>';
  } else {
    contacts.forEach(function(c) { list.appendChild(_embMakeCard(c, funnel.id)); });
  }

  // Drag-over en la lista
  list.addEventListener('dragover', function(e) {
    e.preventDefault();
    col.classList.add('drag-over');
    // Placeholder visual
    var ph = document.getElementById('emb-ph');
    if (!ph) {
      ph = document.createElement('div');
      ph.id = 'emb-ph';
      ph.className = 'emb-card drag-placeholder';
      ph.style.height = '70px';
    }
    var after = _embDragAfter(list, e.clientY);
    if (after) { list.insertBefore(ph, after); }
    else { list.appendChild(ph); }
  });
  list.addEventListener('dragleave', function(e) {
    if (!col.contains(e.relatedTarget)) col.classList.remove('drag-over');
  });
  list.addEventListener('drop', function(e) {
    e.preventDefault();
    col.classList.remove('drag-over');
    var ph = document.getElementById('emb-ph');
    if (ph) ph.remove();
    if (!_embDragging) return;
    _embMoverContacto(_embDragging.contactId, funnel.id);
  });

  col.appendChild(list);
  return col;
}

function _embMakeCard(contact, funnelId) {
  var canal  = (contact.canal || 'heavensy').toLowerCase();
  var ini    = (contact.nombre||'?').split(' ').map(function(w){return w[0];}).join('').toUpperCase().slice(0,2);
  var foto   = contact.foto_url ? '<img src="' + contact.foto_url + '" onerror="this.style.display=\'none\'">' : '';
  var loc    = [contact.pais, contact.region, contact.ciudad].filter(Boolean).join(', ');
  var etapa  = (contact.etapas && funnelId && contact.etapas[funnelId]) || contact.etapa || '';

  var card = document.createElement('div');
  card.className = 'emb-card';
  card.draggable = true;
  card.dataset.contactId = contact.id;
  card.dataset.funnelId  = funnelId || '';

  var unread = contact.unread || 0;
  var timeStr = (typeof formatTimestamp === 'function') ? formatTimestamp(contact.last_msg) : '';

  card.innerHTML =
    (unread > 0 ? '<div class="emb-unread-badge">' + unread + '</div>' : '') +
    '<button class="emb-card-move" title="Gestionar embudos" onclick="embAbrirMove(event,\'' + contact.id + '\')"><i class="fas fa-arrows-alt-h"></i></button>' +
    '<div class="emb-card-top">' +
      '<div class="emb-avatar">' +
        foto + (foto ? '' : ini) +
        '<span class="emb-canal-dot ' + canal + '">' + (_embCanalIcon[canal]||'') + '</span>' +
      '</div>' +
      '<div class="emb-card-info">' +
        '<div class="emb-card-name">' + (contact.nombre||'—') + '</div>' +
        '<div class="emb-card-loc">' + loc + '</div>' +
      '</div>' +
    '</div>' +
    '<div class="emb-card-bottom">' +
      (etapa ? '<span class="emb-tag emb-tag-stage">' + etapa + '</span>' : '<span></span>') +
      (timeStr ? '<span class="emb-card-time">' + timeStr + '</span>' : '') +
    '</div>';

  // Click → seleccionar (no cuando arrastra)
  var _wasDragged = false;
  card.addEventListener('dragstart', function(e) {
    _wasDragged = true;
    _embDragging = { contactId: contact.id, fromFunnelId: funnelId };
    card.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  });
  card.addEventListener('dragend', function() {
    card.classList.remove('dragging');
    _embDragging = null;
    setTimeout(function(){ _wasDragged = false; }, 100);
    var ph = document.getElementById('emb-ph');
    if (ph) ph.remove();
    document.querySelectorAll('.emb-col').forEach(function(c){ c.classList.remove('drag-over'); });
  });
  card.addEventListener('click', function(e) {
    if (_wasDragged) return;
    if (e.target.closest('.emb-card-move')) return;
    embToggleSelect(contact.id, card);
  });

  return card;
}

// Calcular inserción al hacer drag
function _embDragAfter(container, y) {
  var cards = Array.from(container.querySelectorAll('.emb-card:not(.dragging):not(.drag-placeholder)'));
  return cards.reduce(function(closest, card) {
    var box = card.getBoundingClientRect();
    var offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) {
      return { offset: offset, element: card };
    }
    return closest;
  }, { offset: -Infinity }).element;
}

// ── MOVER CONTACTO ──
function _embMoverContacto(contactId, toFunnelId) {
  var c = _embContacts.find(function(x){ return x.id === contactId; });
  if (!c) return;
  if (!c.funnel_ids) c.funnel_ids = [];
  // Si ya está en ese embudo, no hacer nada
  if (c.funnel_ids.indexOf(toFunnelId) !== -1) return;
  // Quitar del embudo origen del drag y agregar al destino
  var fromFunnelId = _embDragging ? _embDragging.fromFunnelId : null;
  if (fromFunnelId && fromFunnelId !== 'f1') {
    c.funnel_ids = c.funnel_ids.filter(function(fid){ return fid !== fromFunnelId; });
    if (c.etapas) delete c.etapas[fromFunnelId];
  }
  c.funnel_ids.push(toFunnelId);
  if (!c.etapas) c.etapas = {};
  if (!c.etapas[toFunnelId]) c.etapas[toFunnelId] = 'Interesado';
  _embRenderBoard();

  // API
  if (_embCompany) {
    _embFetch('/api/funnels/' + _embCompany + '/contact/' + contactId + '/assign', {
      method: 'POST', body: JSON.stringify({ funnel_id: toFunnelId })
    }).catch(function(){});
  }
}

// ── MODAL MOVER (clic en botón) ──
function embAbrirMove(e, contactId) {
  e.stopPropagation();
  var c = _embContacts.find(function(x){ return x.id === contactId; });
  if (!c) return;
  _embMoveCtx = c;

  var title = document.getElementById('emb-move-title');
  if (title) title.textContent = 'Mover: ' + c.nombre;

  var list = document.getElementById('emb-move-list');
  if (list) {
    list.innerHTML = _embFunnels.map(function(f) {
      var isCurrent = c.funnel_ids && c.funnel_ids.indexOf(f.id) !== -1;
      return '<div class="emb-move-row" style="' + (isCurrent ? 'opacity:.4;pointer-events:none' : '') + '" onclick="embMoverDesdeModal(\'' + c.id + '\',\'' + f.id + '\')">' +
        '<i class="fas ' + (isCurrent ? 'fa-check-circle' : 'fa-plus-circle') + '"></i>' +
        '<span>' + f.nombre + (isCurrent ? ' (ya asignado)' : '') + '</span>' +
      '</div>';
    }).join('');
  }

  document.getElementById('emb-overlay-move').classList.add('open');
}
function embMoverDesdeModal(contactId, funnelId) {
  var c = _embContacts.find(function(x){ return x.id === contactId; });
  if (!c) return;
  if (!c.funnel_ids) c.funnel_ids = [];
  if (c.funnel_ids.indexOf(funnelId) === -1) {
    c.funnel_ids.push(funnelId);
    if (!c.etapas) c.etapas = {};
    if (!c.etapas[funnelId]) c.etapas[funnelId] = 'Interesado';
  }
  _embRenderBoard();
  embCerrarMove();
  if (_embCompany) {
    _embFetch('/api/funnels/' + _embCompany + '/contact/' + contactId + '/assign', {
      method: 'POST', body: JSON.stringify({ funnel_id: funnelId })
    }).catch(function(){});
  }
}
function embCerrarMove() {
  var el = document.getElementById('emb-overlay-move');
  if (el) el.classList.remove('open');
  _embMoveCtx = null;
}

// ── MODAL ASIGNAR (desde botón + de columna) ──
function embAbrirAsignar(funnelId) {
  // Abrir un prompt simple por ahora (se puede mejorar con selector de contactos)
  var nombre = prompt('Nombre del contacto a añadir a este embudo:');
  if (!nombre || !nombre.trim()) return;
  var id = 'c_' + Date.now();
  var canales = ['whatsapp','instagram','messenger','heavensy'];
  var canal = canales[Math.floor(Math.random() * canales.length)];
  _embContacts.push({
    id: id, nombre: nombre.trim(),
    pais: 'Chile', region: 'RM', ciudad: '',
    servicio: '', canal: canal,
    funnel_id: funnelId, etapa: 'Nuevo'
  });
  _embRenderBoard();
}

// ── MODAL MENSAJE GRUPAL ──
var _embMsgFunnelId = null;
var _embMsgCanal    = 'whatsapp';
var _embMsgFile     = null;

var _embCanalLimits = { whatsapp: 16, email: 25, heavensy: 25 }; // MB

function embAbrirMensajeGrupal(funnelId) {
  _embMsgFunnelId = funnelId;
  var funnel = _embFunnels.find(function(f){ return f.id === funnelId; });

  // Solo los contactos visibles en esa columna (respeta filtros activos)
  var col = document.querySelector('.emb-col[data-funnel-id="' + funnelId + '"]');
  var visibleIds = col
    ? Array.from(col.querySelectorAll('.emb-card:not([style*="display: none"]):not([style*="display:none"])')).map(function(c){ return c.dataset.contactId; })
    : [];
  var contacts = visibleIds.length
    ? _embContacts.filter(function(c){ return visibleIds.indexOf(c.id) !== -1; })
    : _embContacts.filter(function(c){ return c.funnel_ids && c.funnel_ids.indexOf(funnelId) !== -1; });

  var titleEl = document.getElementById('emb-msg-title');
  if (titleEl) titleEl.textContent = 'Mensaje — ' + (funnel ? funnel.nombre : '');

  // Construir lista mutable de destinatarios
  window._embMsgDestinatarios = contacts.map(function(c){ return c.id; });

  _embRenderDestinatarios(contacts);

  var txt = document.getElementById('emb-msg-text');
  if (txt) txt.value = '';
  _embActualizarContadorDest();

  // Reset archivo
  _embMsgFile = null;
  var fileInput = document.getElementById('emb-msg-file');
  if (fileInput) fileInput.value = '';
  var prev = document.getElementById('emb-attach-preview');
  if (prev) prev.style.display = 'none';
  var err = document.getElementById('emb-attach-error');
  if (err) err.style.display = 'none';

  // Reset canal
  _embMsgCanal = 'whatsapp';
  document.querySelectorAll('.emb-canal-btn').forEach(function(b){ b.classList.remove('active'); });
  var waBtn = document.getElementById('emb-canal-wa');
  if (waBtn) waBtn.classList.add('active');
  var asuntoWrap = document.getElementById('emb-msg-asunto-wrap');
  if (asuntoWrap) asuntoWrap.style.display = 'none';

  document.getElementById('emb-overlay-msg').classList.add('open');
}

function _embRenderDestinatarios(contacts) {
  var recip = document.getElementById('emb-msg-recipients');
  if (!recip) return;
  var ids = window._embMsgDestinatarios || [];
  var visibles = contacts.filter(function(c){ return ids.indexOf(c.id) !== -1; });
  recip.innerHTML = visibles.map(function(c) {
    var canal = (c.canal || 'heavensy').toLowerCase();
    return '<span class="emb-dest-chip" data-id="' + c.id + '">' +
      _embCanalIcon[canal] + ' ' + c.nombre +
      '<button onclick="event.stopPropagation();embQuitarDestinatario(\'' + c.id + '\')" class="emb-dest-x">&times;</button>' +
    '</span>';
  }).join('');
}

function embQuitarDestinatario(contactId) {
  window._embMsgDestinatarios = (window._embMsgDestinatarios || []).filter(function(id){ return id !== contactId; });
  var allContacts = _embContacts.filter(function(c){ return c.funnel_ids && c.funnel_ids.indexOf(_embMsgFunnelId) !== -1; });
  _embRenderDestinatarios(allContacts);
  _embActualizarContadorDest();
}
window.embQuitarDestinatario = embQuitarDestinatario;

function _embActualizarContadorDest() {
  var fb = document.getElementById('emb-msg-feedback');
  var n = (window._embMsgDestinatarios || []).length;
  if (fb) fb.textContent = n + ' destinatario' + (n === 1 ? '' : 's');
}

function embSelCanal(canal, btn) {
  _embMsgCanal = canal;
  document.querySelectorAll('.emb-canal-btn').forEach(function(b){ b.classList.remove('active'); });
  btn.classList.add('active');
  var asuntoWrap = document.getElementById('emb-msg-asunto-wrap');
  if (asuntoWrap) asuntoWrap.style.display = canal === 'email' ? 'block' : 'none';
  var txt = document.getElementById('emb-msg-text');
  if (txt) {
    var ph = { whatsapp: 'Escribe el mensaje de WhatsApp…', email: 'Escribe el cuerpo del correo…', heavensy: 'Escribe el mensaje de Heavensy…' };
    txt.placeholder = ph[canal] || 'Escribe el mensaje…';
  }
  // Actualizar límite visible
  var limitEl = document.getElementById('emb-attach-limit');
  if (limitEl) limitEl.textContent = '(máx. ' + (_embCanalLimits[canal] || 16) + ' MB)';
  // Revalidar archivo si hay uno seleccionado
  if (_embMsgFile) embSeleccionarArchivo(null, _embMsgFile);
}

function embCerrarMensaje() {
  document.getElementById('emb-overlay-msg').classList.remove('open');
  _embMsgFunnelId = null;
}

function embEnviarMensajeGrupal() {
  var txt = document.getElementById('emb-msg-text');
  var msg = txt ? txt.value.trim() : '';
  if (!msg) { alert('Escribe un mensaje antes de enviar.'); return; }

  var ids = window._embMsgDestinatarios || [];
  var contacts = _embContacts.filter(function(c){ return ids.indexOf(c.id) !== -1; });
  if (!contacts.length) { alert('No hay destinatarios seleccionados.'); return; }
  var fb = document.getElementById('emb-msg-feedback');
  if (fb) fb.textContent = 'Enviando a ' + contacts.length + ' contactos…';

  var asunto = '';
  if (_embMsgCanal === 'email') {
    var asuntoEl = document.getElementById('emb-msg-asunto');
    asunto = asuntoEl ? asuntoEl.value.trim() : '';
  }

  var promises = contacts.map(function(c) {
    if (_embMsgFile) {
      var fd = new FormData();
      fd.append('user_id', c.id);
      fd.append('message', msg);
      fd.append('channel', _embMsgCanal);
      if (asunto) fd.append('subject', asunto);
      fd.append('file', _embMsgFile);
      var token = localStorage.getItem('token');
      var headers = {};
      if (token) headers['Authorization'] = 'Bearer ' + token;
      return fetch(_embAPI + '/api/messaging/send', { method:'POST', headers: headers, body: fd }).catch(function(){});
    }
    var payload = { user_id: c.id, message: msg, channel: _embMsgCanal };
    if (asunto) payload.subject = asunto;
    return _embFetch('/api/messaging/send', {
      method: 'POST', body: JSON.stringify(payload)
    }).catch(function(){});
  });

  Promise.all(promises).then(function() {
    if (fb) { fb.style.color = '#16a34a'; fb.textContent = '✓ Mensaje enviado a ' + contacts.length + ' contactos'; }
    setTimeout(embCerrarMensaje, 1800);
  });
}

// ── ADJUNTAR ARCHIVO ──
function embSeleccionarArchivo(input, fileOverride) {
  var file = fileOverride || (input && input.files && input.files[0]);
  if (!file) return;
  var limitMB = _embCanalLimits[_embMsgCanal] || 16;
  var sizeMB  = file.size / (1024 * 1024);
  var errEl   = document.getElementById('emb-attach-error');
  var prev    = document.getElementById('emb-attach-preview');

  if (sizeMB > limitMB) {
    _embMsgFile = null;
    if (input) input.value = '';
    if (prev) prev.style.display = 'none';
    if (errEl) {
      errEl.textContent = 'El archivo supera el límite de ' + limitMB + ' MB para ' + (_embMsgCanal === 'whatsapp' ? 'WhatsApp' : _embMsgCanal === 'email' ? 'correo' : 'Heavensy') + '.';
      errEl.style.display = 'block';
    }
    return;
  }

  _embMsgFile = file;
  if (errEl) errEl.style.display = 'none';

  var nameEl = document.getElementById('emb-attach-name');
  var sizeEl = document.getElementById('emb-attach-size');
  if (nameEl) nameEl.textContent = file.name;
  if (sizeEl) sizeEl.textContent = sizeMB < 1 ? Math.round(sizeMB * 1024) + ' KB' : sizeMB.toFixed(1) + ' MB';
  if (prev) prev.style.display = 'flex';
}
window.embSeleccionarArchivo = embSeleccionarArchivo;

function embQuitarArchivo() {
  _embMsgFile = null;
  var input = document.getElementById('emb-msg-file');
  if (input) input.value = '';
  var prev = document.getElementById('emb-attach-preview');
  if (prev) prev.style.display = 'none';
  var err = document.getElementById('emb-attach-error');
  if (err) err.style.display = 'none';
}
window.embQuitarArchivo = embQuitarArchivo;

// ── MODAL EDITAR EMBUDOS ──
function embAbrirEditar() {
  var list = document.getElementById('emb-edit-list');
  if (list) {
    list.innerHTML = _embFunnels.map(function(f) {
      var n = _embContacts.filter(function(c){ return c.funnel_ids && c.funnel_ids.indexOf(f.id) !== -1; }).length;
      return '<div class="emb-edit-row" data-fid="' + f.id + '">' +
        '<div class="emb-edit-row-icon"><i class="fas fa-briefcase"></i></div>' +
        '<span class="emb-edit-row-name">' + f.nombre + '</span>' +
        '<span class="emb-edit-row-n">' + n + ' contactos</span>' +
        '<button class="emb-edit-row-edit" title="Renombrar" onclick="event.stopPropagation();embRenombrar(\'' + f.id + '\')"><i class="fas fa-pencil-alt"></i></button>' +
        '<button class="emb-edit-row-del" onclick="event.stopPropagation();embEliminarFunnel(\'' + f.id + '\')"><i class="fas fa-trash-alt"></i></button>' +
      '</div>';
    }).join('') || '<div style="font-size:12px;color:rgba(56,56,56,.4);padding:12px 0">No hay embudos</div>';
  }
  document.getElementById('emb-overlay-edit').classList.add('open');
}
function embCerrarEditar() {
  document.getElementById('emb-overlay-edit').classList.remove('open');
}
function embNuevoEmbudo() {
  var nombre = prompt('Nombre del nuevo embudo:');
  if (!nombre || !nombre.trim()) return;
  var colors = ['#9961FF','#5b8dee','#2ECC71','#D4AA3A','#E07060','#4A9FD4'];
  var color  = colors[_embFunnels.length % colors.length];
  var id = 'f_' + Date.now();
  _embFunnels.push({ id: id, nombre: nombre.trim(), color: color });
  embCerrarEditar();
  _embRenderBoard();
  embAbrirEditar();
  if (_embCompany) {
    _embFetch('/api/funnels/' + _embCompany, {
      method: 'POST', body: JSON.stringify({ name: nombre.trim() })
    }).catch(function(){});
  }
}
function embAbrirNuevoEmbudo() {
  var input = document.getElementById('emb-nuevo-nombre');
  var err   = document.getElementById('emb-nuevo-error');
  if (input) { input.value = ''; input.style.borderColor = 'rgba(0,0,0,0.12)'; }
  if (err)   err.style.display = 'none';
  document.getElementById('emb-overlay-nuevo').classList.add('open');
  setTimeout(function(){ if (input) input.focus(); }, 100);
}
function embCerrarNuevo() {
  document.getElementById('emb-overlay-nuevo').classList.remove('open');
}
function embGuardarNuevo() {
  var input  = document.getElementById('emb-nuevo-nombre');
  var err    = document.getElementById('emb-nuevo-error');
  var nombre = input ? input.value.trim() : '';
  if (!nombre) {
    if (err) { err.textContent = 'Escribe un nombre para el embudo.'; err.style.display = 'block'; }
    if (input) input.focus();
    return;
  }
  var colors = ['#9961FF','#5b8dee','#2ECC71','#D4AA3A','#E07060','#4A9FD4'];
  var color  = colors[_embFunnels.length % colors.length];
  var id     = 'f_' + Date.now();
  _embFunnels.push({ id: id, nombre: nombre, color: color });
  _embRenderBoard();
  _embPopulateEmbudoSelect();
  embCerrarNuevo();
  if (_embCompany) {
    _embFetch('/api/funnels/' + _embCompany, {
      method: 'POST', body: JSON.stringify({ name: nombre })
    }).catch(function(){});
  }
}
window.embCerrarNuevo  = embCerrarNuevo;
window.embGuardarNuevo = embGuardarNuevo;
function embRenombrar(funnelId) {
  var row = document.querySelector('.emb-edit-row[data-fid="' + funnelId + '"]');
  if (!row) return;
  var nameEl = row.querySelector('.emb-edit-row-name');
  if (!nameEl || nameEl.querySelector('input')) return; // ya está editando

  var currentName = nameEl.textContent.trim();
  nameEl.innerHTML =
    '<input type="text" value="' + currentName + '" ' +
    'style="border:1.5px solid #9961FF;border-radius:6px;padding:3px 8px;font-size:13px;font-family:\'DM Sans\',sans-serif;color:#383838;outline:none;width:140px" ' +
    'onclick="event.stopPropagation()" ' +
    'onkeydown="if(event.key===\'Enter\')embGuardarNombre(\'' + funnelId + '\');if(event.key===\'Escape\')embCancelarNombre(\'' + funnelId + '\',\'' + currentName + '\')" ' +
    'autofocus>' +
    '<button onclick="event.stopPropagation();embGuardarNombre(\'' + funnelId + '\')" style="margin-left:6px;background:#9961FF;border:none;border-radius:6px;padding:3px 8px;color:#fff;font-size:11px;font-weight:600;cursor:pointer">Guardar</button>';

  var input = nameEl.querySelector('input');
  if (input) { input.focus(); input.select(); }
}
window.embRenombrar = embRenombrar;

function embGuardarNombre(funnelId) {
  var row = document.querySelector('.emb-edit-row[data-fid="' + funnelId + '"]');
  if (!row) return;
  var input = row.querySelector('.emb-edit-row-name input');
  if (!input) return;
  var nuevo = input.value.trim();
  if (!nuevo) return;
  var f = _embFunnels.find(function(x){ return x.id === funnelId; });
  if (f) f.nombre = nuevo;
  _embRenderBoard();
  embAbrirEditar();
  if (_embCompany) {
    _embFetch('/api/funnels/' + _embCompany + '/' + funnelId, {
      method: 'PUT', body: JSON.stringify({ name: nuevo })
    }).catch(function(){});
  }
}
window.embGuardarNombre = embGuardarNombre;

function embCancelarNombre(funnelId, original) {
  var row = document.querySelector('.emb-edit-row[data-fid="' + funnelId + '"]');
  if (!row) return;
  var nameEl = row.querySelector('.emb-edit-row-name');
  if (nameEl) nameEl.textContent = original;
}
window.embCancelarNombre = embCancelarNombre;

function embEliminarFunnel(funnelId) {
  if (!window.confirm('¿Eliminar este embudo? Los contactos quedarán sin embudo.')) return;
  _embFunnels  = _embFunnels.filter(function(f){ return f.id !== funnelId; });
  _embContacts.forEach(function(c){
    if (c.funnel_ids) c.funnel_ids = c.funnel_ids.filter(function(fid){ return fid !== funnelId; });
    if (c.etapas) delete c.etapas[funnelId];
  });
  _embRenderBoard();
  embAbrirEditar();
  if (_embCompany) {
    _embFetch('/api/funnels/' + _embCompany + '/' + funnelId, { method:'DELETE' }).catch(function(){});
  }
}
window.embEliminarFunnel = embEliminarFunnel;

function embAgregarEtapa(funnelId) {
  var input = document.getElementById('emb-etapa-input-' + funnelId);
  var nombre = input ? input.value.trim() : '';
  if (!nombre) return;
  var f = _embFunnels.find(function(x){ return x.id === funnelId; });
  if (!f) return;
  if (!f.etapas) f.etapas = [];
  if (f.etapas.indexOf(nombre) !== -1) return;
  f.etapas.push(nombre);
  embAbrirEditar();
}
window.embAgregarEtapa = embAgregarEtapa;

function embEliminarEtapa(funnelId, idx) {
  var f = _embFunnels.find(function(x){ return x.id === funnelId; });
  if (!f || !f.etapas) return;
  f.etapas.splice(idx, 1);
  embAbrirEditar();
}
window.embEliminarEtapa = embEliminarEtapa;

window.embAbrirEditar        = embAbrirEditar;
window.embCerrarEditar       = embCerrarEditar;
window.embNuevoEmbudo        = embNuevoEmbudo;
window.embAbrirNuevoEmbudo   = embAbrirNuevoEmbudo;
window.embAbrirMensajeGrupal = embAbrirMensajeGrupal;
window.embCerrarMensaje      = embCerrarMensaje;
window.embEnviarMensajeGrupal= embEnviarMensajeGrupal;
window.embSelCanal           = embSelCanal;
window.embAbrirMove          = embAbrirMove;
window.embCerrarMove         = embCerrarMove;
window.embMoverDesdeModal    = embMoverDesdeModal;
