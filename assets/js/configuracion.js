// ══════════════════════════════════════
//  CONFIGURACIÓN — HEAVENSY
//  Extraído de configuracion.html
// ══════════════════════════════════════

// ── HELPERS: construir filas de programas y servicios ──
function _ppBuildProgRow(p, profileType) {
  const color = p.color || '#9497F4';
  const imgHTML = p.img && p.img.startsWith('http') ? `<img src="${p.img}" style="width:44px;height:44px;object-fit:cover;border-radius:8px;flex-shrink:0;margin-right:2px">` : '';
  const editFn = profileType === 'profesional' ? 'jmEditarPrograma' : 'editarPrograma';
  const row = document.createElement('div');
  row.className = 'svc-row'; row.style.background = color;
  row.innerHTML = `${imgHTML}<span class="svc-dot" style="background:${color}"></span><div style="flex:1"><div class="svc-name">${p.nombre||''}</div><div class="svc-meta">${p.meta||''}</div></div><span class="svc-price">${p.precio||''}</span><button class="btn-secondary btn-sm" style="margin-left:10px" onclick="${editFn}(this)"><i class="fas fa-pen"></i></button><button class="btn-icon" style="margin-left:2px;color:#ef4444" onclick="ppDeletePrograma(this)"><i class="fas fa-trash"></i></button>`;
  row.dataset.ppId = p.id || ''; row.dataset.ppType = profileType;
  row.dataset.desc = p.desc||''; row.dataset.tipo = p.tipo||''; row.dataset.precioTipo = p.precioTipo||'total';
  row.dataset.bgColor = p.bgColor||'#F7F8FC'; row.dataset.colorNavy = p.colorNavy||'#7E9DD6';
  row.dataset.colorText = p.colorText||'#333333'; row.dataset.colorTextLt = p.colorTextLt||'#6B7194';
  row.dataset.btnStart = p.btnStart||'#9497F4'; row.dataset.btnEnd = p.btnEnd||'#89B9F8';
  row.dataset.cardOpacity = p.cardOpacity ?? 0.72; row.dataset.tituloFont = p.tituloFont||'DM Sans'; row.dataset.tituloSize = p.tituloSize||'36';
  row.dataset.cancelacion = JSON.stringify(p.cancelacion||null); row.dataset.imgPosition = JSON.stringify(p.imgPosition||{x:50,y:50});
  row.dataset.modulos = JSON.stringify(p.modulos||[]); row.dataset.includes = JSON.stringify(p.includes||[]);
  row.dataset.requisitos = JSON.stringify(p.requisitos||[]); row.dataset.galeria = JSON.stringify(p.galeria||[]);
  row.dataset.galeriaOri = p.galeriaOri||'h'; row.dataset.testimonios = JSON.stringify(p.testimonios||[]);
  row.dataset.cupos = p.cupos||''; row.dataset.mostrarCupos = p.mostrarCupos?'1':'0';
  row.dataset.media = JSON.stringify(p.media||null);
  return row;
}

function _ppBuildSvcRow(s, profileType) {
  const color = s.color || '#9961FF';
  const editFn = profileType === 'profesional' ? 'jmEditarSesion' : 'editarSesion';
  const row = document.createElement('div');
  row.className = 'svc-row'; row.style.background = color;
  row.innerHTML = `<span class="svc-dot" style="background:${color}"></span><div style="flex:1"><div class="svc-name">${s.nombre||''}</div><div class="svc-meta">${s.meta||''}</div></div><span class="svc-price">${s.precio||''}</span><button class="btn-secondary btn-sm" style="margin-left:10px" onclick="${editFn}(this)"><i class="fas fa-pen"></i></button><button class="btn-icon" style="margin-left:2px;color:#ef4444" onclick="ppDeleteServicio(this)"><i class="fas fa-trash"></i></button>`;
  row.dataset.ppId = s.id || ''; row.dataset.ppType = profileType;
  row.dataset.cancelacion = JSON.stringify(s.cancelacion||null);
  return row;
}

// ── CARGA INICIAL DESDE SERVIDOR ──
function ppLoadFromServer() {
  if (typeof apiCall === 'undefined') return;
  // Config del perfil (colores, textos, posición portada)
  apiCall('/api/perfil-profesional/config').then(r=>r.json()).then(d=>{
    if(!d.success||!d.config) return;
    const c=d.config;
    const idMap={'--text-titulo':'ec-ttitulo','--titulo-bg':'ec-titulo','--text-lt':'ec-texto','--text-franja':'ec-franja','--navy':'ec-navy'};
    if(c.colores){
      localStorage.setItem('ep_colores_saved', '1');
      document.querySelectorAll('[oninput^="epColor"]').forEach(input=>{
        const m=input.getAttribute('oninput').match(/epColor\('([^']+)'/);
        if(m&&c.colores[m[1]]){input.value=c.colores[m[1]];const sp=document.getElementById(idMap[m[1]]);if(sp)sp.textContent=c.colores[m[1]];}
      });
      Object.entries(c.colores).forEach(([k,v])=>pmSend({type:'color_'+k,value:v}));
    }
    if(c.opacidad!==undefined){
      const el=document.querySelector('[oninput^="epOpacidad"]');if(el)el.value=c.opacidad;
      const sp=document.getElementById('ec-opacidad');if(sp)sp.textContent=c.opacidad+'%';
      pmSend({type:'opacidad',value:c.opacidad});
    }
    if(c.fondo_color){const el=document.getElementById('ep-fondo-color');if(el)el.value=c.fondo_color;pmSend({type:'fondo_color',value:c.fondo_color});}
    if(c.slogan){const el=document.getElementById('ep-slogan');if(el){el.value=c.slogan;const sp=document.getElementById('cnt-slogan');if(sp)sp.textContent=c.slogan.length+'/75';}pmSend({type:'texto_slogan',value:c.slogan});}
    if(c.frase){localStorage.setItem('ep_frase_saved','1');const el=document.getElementById('ep-frase');if(el){el.value=c.frase;const sp=document.getElementById('cnt-frase');if(sp)sp.textContent=c.frase.length+'/240';}pmSend({type:'texto_frase',value:c.frase});}
    if(c.direccion){const el=document.getElementById('ep-direccion');if(el){el.value=c.direccion;const sp=document.getElementById('cnt-dir');if(sp)sp.textContent=c.direccion.length+'/40';}pmSend({type:'texto_direccion',value:c.direccion});}
    if(c.nombre_empresa){const el=document.getElementById('empresa-nombre');if(el)el.value=c.nombre_empresa;pmSend({type:'nombre_empresa',value:c.nombre_empresa});}
    if(c.portada_position&&typeof _portadaImgPosition!=='undefined'){
      _portadaImgPosition=c.portada_position;
      localStorage.setItem('ep_portada_position',JSON.stringify(c.portada_position));
      const iframe=document.getElementById('perfil-iframe');
      if(iframe&&iframe.contentWindow)try{iframe.contentWindow.postMessage({type:'set_portada_position',x:c.portada_position.x,y:c.portada_position.y},'*');}catch(e){}
    }
    const PORTADA_DEFAULT = '../assets/img/dise%C3%B1o%20final%20portada%20para%20todos.png';
    const FONDO_DEFAULT   = '../assets/img/fondoperfilprofesional.jpg.jpeg';

    const portadaUrl = c.portada_url || PORTADA_DEFAULT;
    const fondoUrl   = c.fondo_url   || FONDO_DEFAULT;

    // Si hay URLs guardadas en el backend, marcarlas para que no se sobreescriban con el default
    if(c.portada_url) localStorage.setItem('ep_portada_saved', '1');
    if(c.fondo_url)   localStorage.setItem('ep_fondo_saved',   '1');
    if(c.foto_url)    localStorage.setItem('ep_foto_saved',    '1');

    pmSend({type:'portada', value: portadaUrl});
    if(c.foto_url) pmSend({type:'foto', value:c.foto_url});
    pmSend({type:'fondo',   value: fondoUrl});

    // Mostrar nombre en los labels del input file
    if(!c.portada_url){const n=document.getElementById('ep-portada-name');if(n)n.textContent='diseño final portada para todos.png';}
    if(!c.fondo_url)  {const n=document.getElementById('ep-fondo-name');  if(n)n.textContent='fondoperfilprofesional.jpg';}
  }).catch(()=>{});
  // Programas empresa
  apiCall('/api/perfil-profesional/programas?tipo=empresa').then(r=>r.json()).then(d=>{
    if(!d.success) return;
    const list=document.getElementById('prog-list'); if(!list) return;
    list.querySelectorAll('.svc-row').forEach(r=>r.remove());
    d.programas.forEach(p=>list.appendChild(_ppBuildProgRow(p,'empresa')));
    if(d.programas.length) syncProgramas();
  }).catch(()=>{});
  // Programas profesional
  apiCall('/api/perfil-profesional/programas?tipo=profesional').then(r=>r.json()).then(d=>{
    if(!d.success) return;
    const list=document.getElementById('jm-prog-list'); if(!list) return;
    list.querySelectorAll('.svc-row').forEach(r=>r.remove());
    d.programas.forEach(p=>list.appendChild(_ppBuildProgRow(p,'profesional')));
    if(d.programas.length) jmSyncProgramas();
  }).catch(()=>{});
  // Servicios empresa
  apiCall('/api/perfil-profesional/servicios?tipo=empresa').then(r=>r.json()).then(d=>{
    if(!d.success||!d.servicios.length) return;
    const list=document.getElementById('svc-list'); if(!list) return;
    list.querySelectorAll('.svc-row').forEach(r=>r.remove());
    d.servicios.forEach(s=>list.appendChild(_ppBuildSvcRow(s,'empresa')));
    syncServicios();
  }).catch(()=>{});
  // Servicios profesional
  apiCall('/api/perfil-profesional/servicios?tipo=profesional').then(r=>r.json()).then(d=>{
    if(!d.success||!d.servicios.length) return;
    const list=document.getElementById('jm-svc-list'); if(!list) return;
    list.querySelectorAll('.svc-row').forEach(r=>r.remove());
    d.servicios.forEach(s=>list.appendChild(_ppBuildSvcRow(s,'profesional')));
    jmSyncServicios();
  }).catch(()=>{});
}

// ── ELIMINAR PROGRAMA / SERVICIO ──
function ppDeletePrograma(btn) {
  const row=btn.closest('.svc-row'); const ppId=row.dataset.ppId;
  const isJm=!!row.closest('#jm-prog-list'); row.remove();
  isJm ? jmSyncProgramas() : syncProgramas();
  if(ppId) apiCall('/api/perfil-profesional/programas/'+ppId,{method:'DELETE'}).catch(()=>{});
}
function ppDeleteServicio(btn) {
  const row=btn.closest('.svc-row'); const ppId=row.dataset.ppId;
  const isJm=!!row.closest('#jm-svc-list'); row.remove();
  isJm ? jmSyncServicios() : syncServicios();
  if(ppId) apiCall('/api/perfil-profesional/servicios/'+ppId,{method:'DELETE'}).catch(()=>{});
}

// ── GUARDAR CONFIG DEL PERFIL (debounced) ──
var _ppConfigTimer = null;
function ppSaveConfig() {
  if(typeof apiCall==='undefined') return;
  if(_ppConfigTimer) clearTimeout(_ppConfigTimer);
  _ppConfigTimer = setTimeout(function() {
    const colores={};
    ['--text-titulo','--titulo-bg','--text-lt','--text-franja','--navy'].forEach(v=>{
      const val=localStorage.getItem('ep_color_'+v); if(val) colores[v]=val;
    });
    apiCall('/api/perfil-profesional/config',{
      method:'PATCH',
      body:JSON.stringify({
        colores,
        opacidad:    parseFloat(localStorage.getItem('ep_opacidad')||'55'),
        slogan:      localStorage.getItem('ep_texto_slogan')||'',
        frase:       localStorage.getItem('ep_texto_frase')||'',
        direccion:   localStorage.getItem('ep_texto_direccion')||'',
        nombre_empresa: localStorage.getItem('ep_nombre_empresa')||'',
        fondo_color: localStorage.getItem('ep_fondo_color')||'',
        portada_position: JSON.parse(localStorage.getItem('ep_portada_position')||'{"x":50,"y":50}'),
      })
    }).catch(()=>{});
  }, 800);
}

// ── STATE ──
let cfgCurrentStep = 0;
const cfgDoneSteps = new Set();
let cfgSelectedUser = '';
let editingSesionRow = null;
let editingProgRow   = null;
let jmEditingSesionRow = null;
let jmEditingProgRow   = null;
let jmProgImgData = '';
let progImgData   = '';
const jmData = {};

// ── STEPS ──
function goStep(n) {
  document.querySelectorAll('.step-panel').forEach((p,i) => p.classList.toggle('active', i===n));
  const nm4 = document.getElementById('detail-name-4');
  const nm1 = document.getElementById('detail-name-1');
  if(nm4 && nm1) nm4.textContent = nm1.textContent;
  document.querySelectorAll('.step').forEach((s,i) => {
    s.className = 'step' + (i===n?' active':cfgDoneSteps.has(i)?' done':'');
  });
  if(n > cfgCurrentStep) cfgDoneSteps.add(cfgCurrentStep);
  cfgCurrentStep = n;
  document.querySelectorAll('.step-line').forEach((l,i) => l.classList.toggle('done', cfgDoneSteps.has(i)));
  window.scrollTo(0,0);
}

function goToDetail(name) {
  cfgSelectedUser = name;
  ['detail-name-1','detail-name-2','detail-name-3'].forEach(id => {
    const el = document.getElementById(id);
    if(el) el.textContent = name;
  });
  goStep(1);
}

// ── EDIT OVERLAY ──
function toggleEdit(id) {
  const overlay = document.getElementById('user-edit-overlay');
  if(overlay) overlay.classList.toggle('open');
}

// Elimina IDs duplicados del contenido antiguo oculto
(function() {
  const old = document.getElementById('_old_jm_content_removed');
  if (old) old.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
})();

function toggleEditPanel(id) {
  const el = document.getElementById('editp-'+id);
  if(el) el.classList.toggle('open');
}

// ── FILTERS ──
function filterUsers() {
  const q   = document.getElementById('f-q')?.value.toLowerCase() || '';
  const rol = document.getElementById('f-rol')?.value.toLowerCase() || '';
  const est = document.getElementById('f-estado')?.value.toLowerCase() || '';
  const rec = document.getElementById('f-recurso')?.value.toLowerCase() || '';
  let count = 0;
  document.querySelectorAll('#users-tbody tr[data-name]').forEach(row => {
    const match =
      (!q   || row.dataset.name.includes(q) || row.dataset.email.includes(q)) &&
      (!rol || row.dataset.rol === rol) &&
      (!est || row.dataset.estado === est) &&
      (!rec || row.dataset.recurso === rec);
    row.style.display = match ? '' : 'none';
    if(match) count++;
  });
  const countEl = document.getElementById('user-count');
  if(countEl) countEl.textContent = count;
}

function clearFilters() {
  ['f-q','f-rol','f-estado','f-recurso'].forEach(id => {
    const el = document.getElementById(id);
    if(el) el.value = '';
  });
  filterUsers();
}

function toggleAddMember() {
  const panel = document.getElementById('add-member-panel');
  if (!panel) return;
  const open = panel.style.display === 'none' || !panel.style.display;
  panel.style.display = open ? 'block' : 'none';
  if (!open) {
    const inp = document.getElementById('add-q');
    if (inp) inp.value = '';
    const box = document.getElementById('db-suggestions');
    if (box) box.style.display = 'none';
    setProfSeleccionado(null);
  }
}

function recalcStats() {
  const rows = document.querySelectorAll('#users-tbody tr:not(.inline-edit-row)');
  let active = 0, total = 0;
  rows.forEach(row => {
    total++;
    if(row.querySelector('input[type=checkbox]')?.checked) active++;
  });
  const t = document.getElementById('stat-total');
  const a = document.getElementById('stat-active');
  const i = document.getElementById('stat-inactive');
  if(t) t.textContent = total;
  if(a) a.textContent = active;
  if(i) i.textContent = total - active;
}

// ── MEDIA ──
function showMTab(id, el) {
  document.querySelectorAll('.media-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.media-section').forEach(s => s.classList.remove('active'));
  if(el) el.classList.add('active');
  const s = document.getElementById('ms-' + id);
  if(s) s.classList.add('active');
}

function onAddVideo() {
  const url = document.getElementById('vid-url')?.value.trim();
  if(!url) return;
  const list = document.getElementById('videos-list');
  const row = document.createElement('div'); row.className = 'vid-card';
  const th = document.createElement('div'); th.className = 'vid-thumb'; th.textContent = '▶️';
  const inf = document.createElement('div'); inf.style.flex = '1';
  const t = document.createElement('div'); t.style.cssText = 'font-size:12px;font-weight:600;color:#374151'; t.textContent = 'Video';
  const u = document.createElement('div'); u.style.cssText = 'font-size:10px;color:#7D84C1;margin-top:2px'; u.textContent = url;
  inf.appendChild(t); inf.appendChild(u);
  const btn = document.createElement('button'); btn.className = 'btn-icon';
  btn.innerHTML = '<i class="fas fa-trash" style="color:#ef4444"></i>';
  btn.onclick = () => row.remove();
  row.appendChild(th); row.appendChild(inf); row.appendChild(btn);
  list.appendChild(row);
  document.getElementById('vid-url').value = '';
}

function onFotos(input) {
  const grid = document.getElementById('fotos-grid');
  const plus = grid.lastElementChild;
  Array.from(input.files).forEach(file => {
    if (!_epCheckSize(file, null)) return;
    const r = new FileReader();
    r.onload = e => {
      const d = document.createElement('div'); d.className = 'media-thumb';
      const img = document.createElement('img'); img.src = e.target.result;
      const ov = document.createElement('div'); ov.className = 'media-over';
      const b1 = document.createElement('button'); b1.className = 'mt-btn'; b1.innerHTML = '<i class="fas fa-star"></i>';
      const b2 = document.createElement('button'); b2.className = 'mt-btn'; b2.style.color = '#ef4444';
      b2.innerHTML = '<i class="fas fa-trash"></i>'; b2.onclick = () => d.remove();
      ov.appendChild(b1); ov.appendChild(b2);
      d.appendChild(img); d.appendChild(ov);
      grid.insertBefore(d, plus);
    };
    r.readAsDataURL(file);
  });
}

function onDocs(input) {
  const icons  = {pdf:'fas fa-file-pdf',doc:'fas fa-file-word',docx:'fas fa-file-word',xls:'fas fa-file-excel',xlsx:'fas fa-file-excel'};
  const colors = {pdf:'background:#fee2e2;color:#ef4444',doc:'background:#dbeafe;color:#2563eb',docx:'background:#dbeafe;color:#2563eb',xls:'background:#d1fae5;color:#059669',xlsx:'background:#d1fae5;color:#059669'};
  const list = document.getElementById('docs-list');
  Array.from(input.files).forEach(file => {
    const ext = file.name.split('.').pop().toLowerCase();
    const sz  = file.size < 1048576 ? Math.round(file.size/1024)+' KB' : (file.size/1048576).toFixed(1)+' MB';
    const row = document.createElement('div'); row.className = 'doc-row';
    const ico = document.createElement('div'); ico.className = 'doc-ico';
    ico.setAttribute('style', colors[ext]||'background:#EFF6FF;color:#7D84C1');
    ico.innerHTML = '<i class="'+(icons[ext]||'fas fa-file')+'"></i>';
    const inf = document.createElement('div'); inf.style.flex = '1';
    const nm  = document.createElement('div'); nm.className = 'doc-name'; nm.textContent = file.name;
    const mt  = document.createElement('div'); mt.className = 'doc-meta'; mt.textContent = ext.toUpperCase()+' · '+sz+' · Recién subido';
    inf.appendChild(nm); inf.appendChild(mt);
    const btn = document.createElement('button'); btn.className = 'btn-icon';
    btn.innerHTML = '<i class="fas fa-trash" style="color:#ef4444"></i>';
    btn.onclick = () => row.remove();
    row.appendChild(ico); row.appendChild(inf); row.appendChild(btn);
    list.appendChild(row);
  });
}

// ── POSTMESSAGE / PREVIEW ──
function pmSend(msg) {
  const iframe = document.getElementById('perfil-iframe');
  if(iframe && iframe.contentWindow) iframe.contentWindow.postMessage(msg, '*');
  const lupaFrame = document.getElementById('lupa-zoom-frame');
  if(lupaFrame && lupaFrame.contentWindow) lupaFrame.contentWindow.postMessage(msg, '*');
  try {
    const val = (msg.value !== null && typeof msg.value === 'object') ? JSON.stringify(msg.value) : msg.value;
    localStorage.setItem('ep_'+msg.type, val);
  } catch(err) {}
}

function ppUploadImage(file, modulo) {
  if(typeof apiCall === 'undefined' || !file) return Promise.resolve(null);
  const token = localStorage.getItem('token');
  const form = new FormData();
  form.append('file', file);
  form.append('modulo', modulo);
  return fetch((typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : '') + '/api/media/upload', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token },
    body: form
  }).then(r => r.json()).then(d => d.ok ? d.url : null).catch(() => null);
}

const _EP_MAX_MB = 3;
const _EP_MAX_BYTES = _EP_MAX_MB * 1024 * 1024;

function _epCheckSize(file, inputEl) {
  if (file.size > _EP_MAX_BYTES) {
    cfgToast(`La imagen supera el límite de ${_EP_MAX_MB} MB (${(file.size/1024/1024).toFixed(1)} MB)`);
    if (inputEl) inputEl.value = '';
    return false;
  }
  return true;
}

function epPortada(input) {
  if(!input.files[0]) return;
  const file = input.files[0];
  if(!_epCheckSize(file, input)) return;
  document.getElementById('ep-portada-name').textContent = file.name;
  const r = new FileReader();
  r.onload = e => pmSend({type:'portada', value:e.target.result});
  r.readAsDataURL(file);
  ppUploadImage(file, 'perfil_profesional').then(url => {
    if(url) apiCall('/api/perfil-profesional/config', {method:'PATCH', body:JSON.stringify({portada_url:url})}).catch(()=>{});
  });
}
function epFotoPerfil(input) {
  if(!input.files[0]) return;
  const file = input.files[0];
  if(!_epCheckSize(file, input)) return;
  document.getElementById('ep-foto-name').textContent = file.name;
  const r = new FileReader();
  r.onload = e => pmSend({type:'foto', value:e.target.result});
  r.readAsDataURL(file);
  ppUploadImage(file, 'perfil_profesional').then(url => {
    if(url) apiCall('/api/perfil-profesional/config', {method:'PATCH', body:JSON.stringify({foto_url:url})}).catch(()=>{});
  });
}
function epFondo(input) {
  if(!input.files[0]) return;
  const file = input.files[0];
  if(!_epCheckSize(file, input)) return;
  document.getElementById('ep-fondo-name').textContent = file.name;
  const r = new FileReader();
  r.onload = e => pmSend({type:'fondo', value:e.target.result});
  r.readAsDataURL(file);
  ppUploadImage(file, 'perfil_profesional').then(url => {
    if(url) apiCall('/api/perfil-profesional/config', {method:'PATCH', body:JSON.stringify({fondo_url:url})}).catch(()=>{});
  });
}
function epFondoColor(color) {
  pmSend({type:'fondo_color', value:color});
  const el = document.getElementById('ep-fondo-name');
  if(el) el.textContent = 'Seleccionar imagen…';
  ppSaveConfig();
}
function epColor(variable, value, el) {
  const idMap = {'--text-titulo':'ec-ttitulo','--titulo-bg':'ec-titulo','--text-lt':'ec-texto','--text-franja':'ec-franja','--navy':'ec-navy'};
  const span = document.getElementById(idMap[variable]);
  if(span) span.textContent = value;
  pmSend({type:'color_'+variable, value});
  ppSaveConfig();
}
function epTexto(key, value) { pmSend({type:'texto_'+key, value}); ppSaveConfig(); }
function epOpacidad(val) {
  document.getElementById('ec-opacidad').textContent = val+'%';
  pmSend({type:'opacidad', value:val});
  ppSaveConfig();
}

function syncHorario() {
  const v = id => document.getElementById(id)?.value || '';
  const h = {
    inicio:    v('disp-inicio'), fin:       v('disp-fin'),
    almDesde:  v('disp-alm-desde'), almHasta: v('disp-alm-hasta'),
    intervalo: v('disp-intervalo'), anticip:  v('disp-anticip'),
    cancelHrs: v('disp-cancel-hrs'), cancelPct: v('disp-cancel-pct')
  };
  pmSend({type:'horario', value:h});
  localStorage.setItem('ep_horario', JSON.stringify(h));
}

async function guardarEspecialidades(btn) {
  syncEspecialidades();
  if (typeof apiCall !== 'undefined' && _cfgFirstResourceId) {
    const specs = [...document.querySelectorAll('#spec-tags-container .spec-tag')]
      .map(t => { const c = t.cloneNode(true); c.querySelectorAll('.spec-x').forEach(x => x.remove()); return c.textContent.trim(); })
      .filter(Boolean);
    apiCall(`/api/agenda/resources/${_cfgFirstResourceId}`, {
      method: 'PATCH',
      body: JSON.stringify({ specialties: specs }),
    }).catch(() => {});
  }
  const orig = btn.innerHTML;
  btn.innerHTML = '<i class="fas fa-check" style="margin-right:6px"></i>Guardado';
  btn.disabled = true;
  setTimeout(() => { btn.innerHTML = orig; btn.disabled = false; toggleEditPanel('esp'); }, 1200);
}

async function guardarDisponibilidad(btn) {
  syncHorario();
  if (typeof apiCall !== 'undefined' && _cfgFirstResourceId) {
    const v = id => document.getElementById(id)?.value || '';
    const scheduleConfig = {
      start_time:        v('disp-inicio'),
      end_time:          v('disp-fin'),
      lunch_start:       v('disp-alm-desde'),
      lunch_end:         v('disp-alm-hasta'),
      slot_duration:     parseInt(v('disp-intervalo')) || 15,
      min_advance_hours: parseInt(v('disp-anticip')) || 2,
      cancel_hours:      parseInt(v('disp-cancel-hrs')) || 48,
      cancel_pct:        parseInt(v('disp-cancel-pct')) || 40,
    };
    const dayBtns = [...document.querySelectorAll('#editp-disp .toggle-group .toggle-btn')].slice(0, 7);
    const scheduleRules = dayBtns.map((b, i) => ({
      weekday:    i + 1,
      start_time: scheduleConfig.start_time,
      end_time:   scheduleConfig.end_time,
      active:     b.classList.contains('on'),
    }));
    apiCall(`/api/agenda/resources/${_cfgFirstResourceId}`, {
      method: 'PATCH',
      body: JSON.stringify({ schedule_config: scheduleConfig, schedule_rules: scheduleRules }),
    }).catch(() => {});
  }
  const orig = btn.innerHTML;
  btn.innerHTML = '<i class="fas fa-check" style="margin-right:6px"></i>Guardado';
  btn.disabled = true;
  setTimeout(() => { btn.innerHTML = orig; btn.disabled = false; toggleEditPanel('disp'); }, 1200);
}

// ── INF OFICIO ──
const infMedia = [];
function onInfOficio(input) {
  const grid = document.getElementById('inf-grid');
  const MAX  = 3;
  const files = [...input.files].slice(0, MAX - infMedia.length);
  files.forEach(file => {
    if(infMedia.length >= MAX) return;
    const isVideo = file.type.startsWith('video');
    const url = URL.createObjectURL(file);
    const idx = infMedia.length;
    infMedia.push({url, isVideo});
    const thumb = document.createElement('div'); thumb.className = 'media-thumb'; thumb.dataset.idx = idx;
    thumb.innerHTML = isVideo
      ? `<video src="${url}" style="width:100%;height:100%;object-fit:cover"></video>`
      : `<img src="${url}">`;
    thumb.innerHTML += `<div class="media-over"><button class="mt-btn" style="color:#ef4444" onclick="removeInf(this)"><i class="fas fa-trash"></i></button></div>`;
    grid.appendChild(thumb);
    const r = new FileReader();
    r.onload = e => {
      infMedia[idx].data = e.target.result;
      pmSend({type:'inf_oficio', value: infMedia.filter(m=>m.data).map(m=>({data:m.data,isVideo:m.isVideo}))});
    };
    r.readAsDataURL(file);
    updateInfCount();
  });
  input.value = '';
}
function removeInf(btn) {
  const thumb = btn.closest('.media-thumb');
  const idx   = parseInt(thumb.dataset.idx);
  infMedia[idx] = null;
  thumb.remove();
  document.querySelectorAll('#inf-grid .media-thumb').forEach((t,i) => t.dataset.idx = i);
  const clean = infMedia.filter(Boolean); infMedia.length = 0; clean.forEach(m => infMedia.push(m));
  pmSend({type:'inf_oficio', value: infMedia.filter(m=>m&&m.data).map(m=>({data:m.data,isVideo:m.isVideo}))});
  updateInfCount();
}
function updateInfCount() {
  const n = document.getElementById('inf-grid').querySelectorAll('.media-thumb').length;
  document.getElementById('inf-count').textContent = n+' / 3';
  const dz = document.getElementById('inf-dropzone');
  if(dz) dz.style.display = n >= 3 ? 'none' : '';
}
function onCardBusqueda(input) {
  const grid = document.getElementById('card-grid');
  if(grid.querySelectorAll('.media-thumb').length >= 1){ input.value=''; return; }
  const file = input.files[0]; if(!file) return;
  const isVideo = file.type.startsWith('video');
  const url = URL.createObjectURL(file);
  const thumb = document.createElement('div'); thumb.className = 'media-thumb';
  thumb.innerHTML = isVideo
    ? `<video src="${url}" style="width:100%;height:100%;object-fit:cover"></video>`
    : `<img src="${url}">`;
  thumb.innerHTML += `<div class="media-over"><button class="mt-btn" style="color:#ef4444" onclick="this.closest('.media-thumb').remove();updateCardCount()"><i class="fas fa-trash"></i></button></div>`;
  grid.appendChild(thumb);
  updateCardCount();
  input.value = '';
}
function updateCardCount() {
  const n = document.getElementById('card-grid').querySelectorAll('.media-thumb').length;
  document.getElementById('card-count').textContent = n+' / 1';
  const dz = document.getElementById('card-dropzone');
  if(dz) dz.style.display = n >= 1 ? 'none' : '';
}

// ── ACTUALIZAR PUBLICACIÓN ──
function cfgFinalizarConfiguracion() {
  var esNueva = !localStorage.getItem('empresa_publicada');
  localStorage.setItem('empresa_publicada', '1');
  if (esNueva) {
    var modal = document.getElementById('cfg-empresa-modal');
    if (modal) modal.style.display = 'flex';
  } else {
    cfgIrAlPerfil();
  }
}

function cfgIrAlPerfil() {
  loadPage('mipagina');
}

function actualizarPublicacion(btn) {
  // Primera vez → modal de empresa creada (no descarga)
  if (!localStorage.getItem('empresa_publicada')) {
    localStorage.setItem('empresa_publicada', '1');
    var modal = document.getElementById('cfg-empresa-modal');
    if (modal) modal.style.display = 'flex';
    return;
  }
  const orig = btn.innerHTML;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin" style="margin-right:6px"></i>Generando…';
  btn.disabled = true;
  setTimeout(() => {
    try {
      const iframe = document.getElementById('perfil-iframe');
      let html = '<!DOCTYPE html>\n' + iframe.contentDocument.documentElement.outerHTML;
      html = html.replace('var _EP_BAKED = false; /* EP_BAKED_FLAG */', 'var _EP_BAKED = true; /* EP_BAKED_FLAG */');
      const blob = new Blob([html], {type:'text/html; charset=utf-8'});
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'perfil_profesional.html';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
      btn.innerHTML = '<i class="fas fa-check" style="margin-right:6px"></i>¡Descargado!';
      btn.style.background = '#10b981';
    } catch(err) {
      btn.innerHTML = '<i class="fas fa-exclamation-triangle" style="margin-right:6px"></i>Error al generar';
      btn.style.background = '#ef4444';
    }
    setTimeout(() => { btn.innerHTML = orig; btn.style.background = ''; btn.disabled = false; }, 2500);
  }, 350);
}

// ── JM USER EDIT TABS ──
function jmFeedback(btn, cb) {
  const orig = btn.innerHTML;
  btn.innerHTML = '<i class="fas fa-check" style="margin-right:5px"></i>Guardado';
  btn.disabled = true;
  setTimeout(() => { btn.innerHTML = orig; btn.disabled = false; if(cb) cb(); }, 1200);
}

function jmEnviarProfCard() {
  const v = id => document.getElementById(id)?.value || '';
  const nombre = (v('jm-nombre') + ' ' + v('jm-apellido')).trim() || 'Juana Machuca';
  const tags = document.querySelectorAll('#jm-spec-tags-container .spec-tag');
  const especialidades = [...tags].map(t => t.childNodes[0].textContent.trim()).filter(Boolean).join(', ');
  const modos = [...document.querySelectorAll('#jm-panel-2 .toggle-btn.on')].map(b => b.textContent.trim());
  const frase = document.getElementById('jm-frase')?.value || '';
  const profCard = { id:'jm', nombre, specs:especialidades, desc:frase, modos, foto:jmData.foto||'', addr:v('jm-direccion') };
  pmSend({type:'equipo_prof', value:profCard});
}

function jmGuardarInfo(btn) { jmEnviarProfCard(); pmSend({type:'scroll_to',value:'#prof-card-jm'}); jmFeedback(btn); }
function jmGuardarFrase(btn) { jmEnviarProfCard(); if(jmData.foto) pmSend({type:'equipo_foto',value:jmData.foto}); pmSend({type:'scroll_to',value:'#prof-card-jm'}); jmFeedback(btn); }

function jmGuardarProfesional(btn) {
  const v = id => document.getElementById(id)?.value || '';
  const horario = { inicio:v('jm-disp-inicio'), fin:v('jm-disp-fin'), almDesde:v('jm-disp-alm-desde'), almHasta:v('jm-disp-alm-hasta'), intervalo:v('jm-disp-intervalo'), anticip:v('jm-disp-anticip'), cancelHrs:v('jm-disp-cancel-hrs'), cancelPct:v('jm-disp-cancel-pct') };
  pmSend({type:'horario', value:horario});
  const svcRows = document.querySelectorAll('#jm-svc-list .svc-row');
  if(svcRows.length) { const s=[...svcRows].map(r=>({nombre:r.querySelector('.svc-name')?.textContent.trim()||'',meta:r.querySelector('.svc-meta')?.textContent.trim()||'',precio:r.querySelector('.svc-price')?.textContent.trim()||''})); pmSend({type:'servicios',value:s}); }
  const progRows = document.querySelectorAll('#jm-prog-list .svc-row');
  if(progRows.length) { const p=[...progRows].map(r=>({nombre:r.querySelector('.svc-name')?.textContent.trim()||'',color:r.querySelector('.svc-dot')?.style.background||'',img:r.querySelector('img')?.src||''})); pmSend({type:'programas',value:p}); }
  jmEnviarProfCard();
  if(jmData.foto) pmSend({type:'equipo_foto',value:jmData.foto});
  pmSend({type:'scroll_to',value:'#prof-card-jm'});

  // Guardar en backend si hay recurso seleccionado
  if (_cfgCurrentResourceId) _cfgPatchCurrentResource();

  const orig = btn.innerHTML;
  btn.innerHTML = '<i class="fas fa-check" style="margin-right:6px"></i>¡Guardado!';
  btn.style.background = '#10b981'; btn.disabled = true;
  setTimeout(() => {
    btn.innerHTML = orig; btn.style.background = ''; btn.disabled = false;
    toggleEdit('jm');
    if (_cfgCurrentResourceId) { _cfgCurrentResourceId = null; cfgLoadFromBackend(); }
  }, 1200);
}

function jmTab(n, el) {
  document.querySelectorAll('#user-edit-overlay .ue-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('#user-edit-overlay .ue-panel').forEach(p => p.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('jm-panel-'+n)?.classList.add('active');
}

function jmGuardarDisponibilidad(btn) {
  const v = id => document.getElementById(id)?.value || '';
  const h = { inicio:v('jm-disp-inicio'), fin:v('jm-disp-fin'), almDesde:v('jm-disp-alm-desde'), almHasta:v('jm-disp-alm-hasta'), intervalo:v('jm-disp-intervalo'), anticip:v('jm-disp-anticip'), cancelHrs:v('jm-disp-cancel-hrs'), cancelPct:v('jm-disp-cancel-pct') };
  pmSend({type:'horario',value:h}); jmEnviarProfCard(); pmSend({type:'scroll_to',value:'#horario-block'}); jmFeedback(btn);
}

function jmAddSpec() {
  const input = document.getElementById('jm-esp-input');
  const val = input?.value.trim(); if(!val) return;
  const container = document.getElementById('jm-spec-tags-container');
  const tag = document.createElement('span'); tag.className = 'spec-tag';
  tag.innerHTML = val + ' <span class="spec-x" onclick="jmRemoveSpec(this)">✕</span>';
  container.appendChild(tag);
  if(input) input.value = '';
}
function jmRemoveSpec(el) { el.closest('.spec-tag').remove(); }

function jmGuardarEspecialidades(btn) { jmEnviarProfCard(); pmSend({type:'scroll_to',value:'#prof-card-jm'}); jmFeedback(btn); }

function jmSyncServicios() {
  const rows = document.querySelectorAll('#jm-svc-list .svc-row');
  jmData.servicios = [...rows].map(row => ({ nombre:row.querySelector('.svc-name')?.textContent.trim()||'', meta:row.querySelector('.svc-meta')?.textContent.trim()||'', precio:row.querySelector('.svc-price')?.textContent.trim()||'', cancelacion:JSON.parse(row.dataset.cancelacion||'null') }));
}
function jmSyncProgramas() {
  const rows = document.querySelectorAll('#jm-prog-list .svc-row');
  const _jmNombre = ((document.getElementById('jm-nombre')?.value||'')+' '+(document.getElementById('jm-apellido')?.value||'')).trim()||'Juana Machuca';
  const _jmCreador = { tipo:'profesional', nombre:_jmNombre, foto:jmData.foto||'', experiencia:document.getElementById('jm-esp-exp')?.value||'', especialidad:[...document.querySelectorAll('#jm-spec-tags-container .spec-tag')].map(t=>t.textContent.trim()).filter(Boolean).join(', ') };
  jmData.programas = [...rows].map(row => ({ nombre:row.querySelector('.svc-name')?.textContent.trim()||'', tipo:row.dataset.tipo||'', color:row.querySelector('.svc-dot')?.style.background||'', bgColor:row.dataset.bgColor||'#F7F8FC', colorNavy:row.dataset.colorNavy||'#7E9DD6', colorText:row.dataset.colorText||'#333333', colorTextLt:row.dataset.colorTextLt||'#6B7194', cardOpacity:parseFloat(row.dataset.cardOpacity||'0.72'), tituloFont:row.dataset.tituloFont||'DM Sans', tituloSize:row.dataset.tituloSize||'36', cancelacion:JSON.parse(row.dataset.cancelacion||'null'), img:row.querySelector('img')?.src||'', meta:row.querySelector('.svc-meta')?.textContent.trim()||'', precio:row.querySelector('.svc-price')?.textContent.trim()||'', precioTipo:row.dataset.precioTipo||'total', desc:row.dataset.desc||'', modulos:JSON.parse(row.dataset.modulos||'[]'), includes:JSON.parse(row.dataset.includes||'[]'), requisitos:JSON.parse(row.dataset.requisitos||'[]'), galeria:JSON.parse(row.dataset.galeria||'[]'), galeriaOri:row.dataset.galeriaOri||'h', testimonios:JSON.parse(row.dataset.testimonios||'[]'), cupos:row.dataset.cupos||'', mostrarCupos:row.dataset.mostrarCupos==='1', media:JSON.parse(row.dataset.media||'null'), creador:_jmCreador }));
}

function jmToggleForm(id) {
  document.getElementById(id)?.classList.toggle('open');
  if(id==='jm-form-sesion') { jmEditingSesionRow=null; const ci=document.getElementById('jm-ses-color'); if(ci) ci.oninput=null; }
  if(id==='jm-form-programa') { jmEditingProgRow=null; const ci=document.getElementById('jm-prog-color'); if(ci) ci.oninput=null; }
}

function jmEditarSesion(btn) {
  const row=btn.closest('.svc-row');
  const nombre=row.querySelector('.svc-name').textContent.trim();
  const meta=row.querySelector('.svc-meta').textContent.trim();
  const precio=row.querySelector('.svc-price').textContent.trim();
  const color=row.style.background||row.querySelector('.svc-dot').style.background;
  const partes=meta.split('·').map(s=>s.trim());
  document.getElementById('jm-ses-nombre').value=nombre;
  document.getElementById('jm-ses-duracion').value=partes[0]?.replace('min','').trim()||'';
  document.getElementById('jm-ses-precio').value=precio;
  document.getElementById('jm-ses-mod').value=partes[1]||'';
  const ci=document.getElementById('jm-ses-color'); ci.value=rgbToHex(color); ci.oninput=()=>{row.style.background=ci.value;};
  document.querySelectorAll('#jm-form-sesion .toggle-group .toggle-btn').forEach(b=>b.classList.toggle('on',(partes[1]||'').includes(b.textContent)));
  loadCancelacion('jm-ses', JSON.parse(row.dataset.cancelacion||'null'));
  document.getElementById('jm-form-sesion-title').innerHTML='<i class="fas fa-pen" style="margin-right:6px"></i>Editar sesión';
  document.getElementById('jm-btn-guardar-sesion').innerHTML='<i class="fas fa-check" style="margin-right:5px"></i>Guardar';
  jmEditingSesionRow=row;
  document.getElementById('jm-form-sesion')?.classList.add('open');
}

function jmGuardarSesion() {
  const nombre=document.getElementById('jm-ses-nombre').value.trim();
  const duracion=document.getElementById('jm-ses-duracion').value.trim();
  const precio=document.getElementById('jm-ses-precio').value.trim();
  const mod=document.getElementById('jm-ses-mod').value.trim();
  const cancelacion=readCancelacion('jm-ses');
  const invalids=[['jm-ses-nombre',!nombre],['jm-ses-duracion',!duracion],['jm-ses-precio',!precio]];
  let hasError=false;
  invalids.forEach(([id,bad])=>{const el=document.getElementById(id);el.style.borderColor=bad?'#ef4444':'';if(bad) hasError=true;});
  const _jmSesModGroup=document.getElementById('jm-ses-mod')?.closest('.form-group')?.querySelector('.toggle-group');
  if(!mod){hasError=true;if(_jmSesModGroup)_jmSesModGroup.style.outline='2px solid #ef4444';}else{if(_jmSesModGroup)_jmSesModGroup.style.outline='';}
  const _jmSesCW=document.getElementById('jm-ses-cancel-wrap');
  if(!cancelacion.total&&!cancelacion.parcial){hasError=true;if(_jmSesCW)_jmSesCW.style.outline='2px solid #ef4444';}else{if(_jmSesCW)_jmSesCW.style.outline='';}
  if(hasError) return;
  const color=document.getElementById('jm-ses-color').value;
  const desc=document.getElementById('jm-ses-desc').value.trim();
  const meta=duracion?duracion+' min'+(mod?' · '+mod:''):(mod||'');
  const _jmSvcPayload={profile_type:'profesional',nombre,duracion,precio,mod,desc,color,cancelacion,meta};
  const _jmSvcEditId=jmEditingSesionRow?.dataset?.ppId;
  if(jmEditingSesionRow){
    jmEditingSesionRow.querySelector('.svc-name').textContent=nombre;
    jmEditingSesionRow.querySelector('.svc-meta').textContent=meta;
    jmEditingSesionRow.querySelector('.svc-price').textContent=precio;
    jmEditingSesionRow.style.background=color; jmEditingSesionRow.dataset.cancelacion=JSON.stringify(cancelacion); jmEditingSesionRow=null;
  } else {
    const list=document.getElementById('jm-svc-list');
    const row=document.createElement('div'); row.className='svc-row'; row.style.background=color;
    row.innerHTML=`<span class="svc-dot" style="background:${color}"></span><div style="flex:1"><div class="svc-name">${nombre}</div><div class="svc-meta">${meta}</div>${desc?`<div style="font-size:11px;color:#7D84C1;margin-top:2px">${desc}</div>`:''}</div><span class="svc-price">${precio}</span><button class="btn-secondary btn-sm" style="margin-left:10px" onclick="jmEditarSesion(this)"><i class="fas fa-pen"></i></button><button class="btn-icon" style="margin-left:2px;color:#ef4444" onclick="ppDeleteServicio(this)"><i class="fas fa-trash"></i></button>`;
    row.dataset.cancelacion=JSON.stringify(cancelacion); list.appendChild(row);
    if(typeof apiCall!=='undefined')apiCall('/api/perfil-profesional/servicios',{method:'POST',body:JSON.stringify(_jmSvcPayload)}).then(r=>r.json()).then(d=>{if(d.success&&d.servicio)row.dataset.ppId=d.servicio.id;}).catch(()=>{});
  }
  if(_jmSvcEditId&&typeof apiCall!=='undefined')apiCall('/api/perfil-profesional/servicios/'+_jmSvcEditId,{method:'PUT',body:JSON.stringify(_jmSvcPayload)}).catch(()=>{});
  jmSyncServicios();
  pmSend({type:'servicios',value:[...document.querySelectorAll('#jm-svc-list .svc-row')].map(r=>({nombre:r.querySelector('.svc-name')?.textContent.trim()||'',meta:r.querySelector('.svc-meta')?.textContent.trim()||'',precio:r.querySelector('.svc-price')?.textContent.trim()||'',cancelacion:JSON.parse(r.dataset.cancelacion||'null')}))});
  document.getElementById('jm-form-sesion')?.classList.remove('open');
  document.getElementById('jm-form-sesion-title').innerHTML='<i class="fas fa-clock" style="margin-right:6px"></i>Crea tu servicio';
  document.getElementById('jm-btn-guardar-sesion').innerHTML='<i class="fas fa-check" style="margin-right:5px"></i>Guardar';
  ['jm-ses-nombre','jm-ses-duracion','jm-ses-precio','jm-ses-desc'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('jm-ses-mod').value='';
  document.querySelectorAll('#jm-form-sesion .toggle-btn').forEach(b=>b.classList.remove('on'));
  resetCancelacion('jm-ses');
}

function jmCancelarSesion() {
  jmEditingSesionRow=null;
  const ci=document.getElementById('jm-ses-color'); if(ci) ci.oninput=null;
  document.getElementById('jm-form-sesion')?.classList.remove('open');
  document.getElementById('jm-form-sesion-title').innerHTML='<i class="fas fa-clock" style="margin-right:6px"></i>Crea tu servicio';
  document.getElementById('jm-btn-guardar-sesion').innerHTML='<i class="fas fa-check" style="margin-right:5px"></i>Guardar';
}

function jmPrevProgImg(input) {
  if(!input.files[0]) return;
  const file = input.files[0];
  if(!_epCheckSize(file, input)) return;
  const nameEl = document.getElementById('jm-prog-img-name');
  const r = new FileReader();
  r.onload = e => {
    jmProgImgData = e.target.result;
    document.getElementById('jm-prog-img-thumb').src = e.target.result;
    document.getElementById('jm-prog-img-preview').style.display = 'block';
    if(nameEl) nameEl.textContent = file.name + ' — subiendo…';
  };
  r.readAsDataURL(file);
  ppUploadImage(file, 'perfil_profesional_programas').then(url => {
    if(!url) { if(nameEl) nameEl.textContent = file.name; return; }
    jmProgImgData = url;
    document.getElementById('jm-prog-img-thumb').src = url;
    if(nameEl) nameEl.textContent = file.name + ' ✓';
  });
}
function jmClearProgImg() {
  jmProgImgData='';
  document.getElementById('jm-prog-img-preview').style.display='none';
  document.getElementById('jm-prog-img-name').textContent='Seleccionar imagen…';
  document.getElementById('jm-prog-img-input').value='';
}

function jmEditarPrograma(btn) {
  const row=btn.closest('.svc-row');
  const nombre=row.querySelector('.svc-name').textContent.trim();
  const meta=row.querySelector('.svc-meta').textContent.trim();
  const precio=row.querySelector('.svc-price').textContent.trim();
  const color=row.style.background||row.querySelector('.svc-dot').style.background;
  const partes=meta.split('·').map(s=>s.trim());
  const durMatch=meta.match(/de\s+(\d+)\s+min/);
  const _freqMap={'Diaria':'diaria','Lun-Vie':'lunes_viernes','Fin de semana':'fines_semana','1 vez/sem':'1_semana','2 veces/sem':'2_semana','3 veces/sem':'3_semana','Quincenal':'quincenal','Mensual':'mensual'};
  const freqParte=partes.find(p=>_freqMap[p])||'';
  document.getElementById('jm-prog-nombre').value=nombre;
  document.getElementById('jm-prog-precio').value=precio;
  setProgTipo('jm-prog', row.dataset.tipo || '');
  setPrecioTipo('jm-prog', row.dataset.precioTipo || 'total');
  document.getElementById('jm-prog-encuentros').value=partes[0]?.replace(/encuentros.*/,'').trim()||'';
  document.getElementById('jm-prog-duracion').value=durMatch?durMatch[1]:'';
  const jmFreqEl=document.getElementById('jm-prog-frecuencia'); if(jmFreqEl) jmFreqEl.value=_freqMap[freqParte]||'';
  filtrarFrecuencias('jm-prog-duracion-unidad','jm-prog-frecuencia','jm-prog-duracion','jm-prog-encuentros');
  document.getElementById('jm-prog-mod').value=partes[partes.length-1]||'';
  const jmDescEl=document.getElementById('jm-prog-desc'); if(jmDescEl) jmDescEl.value=row.dataset.desc||'';
  loadModulos('jm-prog', JSON.parse(row.dataset.modulos||'[]'));
  loadIncludes('jm-prog', JSON.parse(row.dataset.includes||'[]'));
  loadRequisitos('jm-prog', JSON.parse(row.dataset.requisitos||'[]'));
  loadGaleria('jm-prog', JSON.parse(row.dataset.galeria||'[]'), row.dataset.galeriaOri||'h');
  loadTestimonios('jm-prog', JSON.parse(row.dataset.testimonios||'[]'));
  const jmCuposEl=document.getElementById('jm-prog-cupos'); if(jmCuposEl) jmCuposEl.value=row.dataset.cupos||'';
  const jmMCEl=document.getElementById('jm-prog-mostrar-cupos'); if(jmMCEl) jmMCEl.checked=row.dataset.mostrarCupos==='1';
  syncCuposBtn('jm-prog-mostrar-cupos','jm-prog-mostrar-cupos-btn');
  const pci=document.getElementById('jm-prog-color'); pci.value=rgbToHex(color); pci.oninput=()=>{row.style.background=pci.value;};
  const jmBgColorEl=document.getElementById('jm-prog-bg-color'); if(jmBgColorEl) jmBgColorEl.value=row.dataset.bgColor||'#F7F8FC';
  const jmCnEl=document.getElementById('jm-prog-color-navy');   if(jmCnEl) jmCnEl.value=row.dataset.colorNavy||'#7E9DD6';
  const jmCtEl=document.getElementById('jm-prog-color-text');   if(jmCtEl) jmCtEl.value=row.dataset.colorText||'#333333';
  const jmCtlEl=document.getElementById('jm-prog-color-text-lt'); if(jmCtlEl) jmCtlEl.value=row.dataset.colorTextLt||'#6B7194';
  const jmCoEl=document.getElementById('jm-prog-card-opacity'); if(jmCoEl){jmCoEl.value=Math.round(parseFloat(row.dataset.cardOpacity||'0.72')*100);document.getElementById('jm-prog-card-opacity-val').textContent=jmCoEl.value+'%';}
  const jmTfEl=document.getElementById('jm-prog-titulo-font'); if(jmTfEl) jmTfEl.value=row.dataset.tituloFont||'DM Sans';
  const jmTsEl=document.getElementById('jm-prog-titulo-size'); if(jmTsEl){jmTsEl.value=row.dataset.tituloSize||'36';document.getElementById('jm-prog-titulo-size-val').textContent=(row.dataset.tituloSize||'36')+'px';}
  loadCancelacion('jm-prog', JSON.parse(row.dataset.cancelacion||'null'));
  const jmImgEl=row.querySelector('img');
  if(jmImgEl&&jmImgEl.src){jmProgImgData=jmImgEl.src;document.getElementById('jm-prog-img-thumb').src=jmImgEl.src;document.getElementById('jm-prog-img-preview').style.display='block';document.getElementById('jm-prog-img-name').textContent='Imagen cargada'+(jmImgEl.src.startsWith('http')?' ✓':'');}
  document.querySelectorAll('#jm-form-programa .toggle-group .toggle-btn').forEach(b=>b.classList.toggle('on',(partes[1]||'').includes(b.textContent)));
  document.getElementById('jm-form-programa-title').innerHTML='<i class="fas fa-pen" style="margin-right:6px"></i>Editar programa';
  document.getElementById('jm-btn-guardar-programa').innerHTML='<i class="fas fa-check" style="margin-right:5px"></i>Guardar';
  jmEditingProgRow=row;
  document.getElementById('jm-form-programa')?.classList.add('open');
  openProgPreview('jm-prog');
}

// ── FRECUENCIAS VÁLIDAS POR UNIDAD + VALOR ──
function getFreqValidas(unidad, durVal, encuentros) {
  const todas = ['diaria','lunes_viernes','fines_semana','1_semana','2_semana','3_semana','quincenal','mensual'];
  const n  = parseInt(durVal)    || 0;
  const nc = parseInt(encuentros) || 0;

  // ── Convertir todo a "días equivalentes" para reglas uniformes ──
  let diasEquiv = 0;
  if (unidad === 'min') diasEquiv = 0;           // < 1 día siempre
  else if (unidad === 'hr') diasEquiv = n >= 24 ? Math.floor(n / 24) : 0;
  else if (unidad === 'dia') diasEquiv = n;
  else if (unidad === 'sem') diasEquiv = n * 7;
  else if (unidad === 'mes') diasEquiv = n * 30;

  // ── Filtro por duración (en días equivalentes) ──
  // La sesión debe caber en el hueco entre sesiones
  // Diaria/Lun-Vie/FinSem: hueco = 1 día → sesión debe ser < 1 día
  // 3 veces/sem: hueco ≈ 2 días
  // 2 veces/sem: hueco ≈ 3 días
  // Por semana: hueco = 7 días
  // Quincenal: hueco = 14 días
  // Mensual: hueco = 30 días
  let porDuracion;
  if (diasEquiv === 0) {
    porDuracion = todas; // minutos u horas < 24 → todo válido
  } else if (diasEquiv === 1) {
    porDuracion = ['3_semana','2_semana','1_semana','quincenal','mensual'];
  } else if (diasEquiv === 2) {
    porDuracion = ['2_semana','1_semana','quincenal','mensual'];
  } else if (diasEquiv <= 6) {
    porDuracion = ['1_semana','quincenal','mensual'];
  } else if (diasEquiv <= 13) {
    porDuracion = ['quincenal','mensual'];
  } else if (diasEquiv <= 29) {
    porDuracion = ['mensual'];
  } else {
    porDuracion = [];
  }

  // ── Filtro por número de encuentros ──
  // lunes_viernes (5x/sem) requiere nc ≥ 5
  // 3_semana (3x/sem) requiere nc ≥ 3
  let porEncuentros;
  if (nc <= 0 || nc === 1) {
    porEncuentros = [];
  } else {
    porEncuentros = todas.filter(f => {
      if (f === 'lunes_viernes' && nc < 5) return false;
      if (f === '3_semana'      && nc < 3) return false;
      return true;
    });
  }

  // Intersección de ambos filtros
  return porDuracion.filter(f => porEncuentros.includes(f));
}

function filtrarFrecuencias(unidadSelectId, frecSelectId, valorInputId, encuentrosInputId) {
  const unidad     = document.getElementById(unidadSelectId)?.value || 'min';
  const durVal     = valorInputId     ? (document.getElementById(valorInputId)?.value     || 0) : 0;
  const encuentros = encuentrosInputId ? (document.getElementById(encuentrosInputId)?.value || 0) : 0;
  const freqSel    = document.getElementById(frecSelectId);
  if (!freqSel) return;
  const validas = getFreqValidas(unidad, durVal, encuentros);
  const actual  = freqSel.value;
  Array.from(freqSel.options).forEach(opt => {
    if (opt.value === '') return;
    opt.disabled = !validas.includes(opt.value);
    opt.style.display = opt.disabled ? 'none' : '';
  });
  if (actual && !validas.includes(actual)) freqSel.value = '';
  const aviso = document.getElementById(frecSelectId + '-aviso');
  if (aviso) aviso.style.display = validas.length === 0 ? '' : 'none';
}

function initFrecuenciaListeners() {
  const jmDurU   = document.getElementById('jm-prog-duracion-unidad');
  const jmDurN   = document.getElementById('jm-prog-duracion');
  const jmEncN   = document.getElementById('jm-prog-encuentros');
  const progDurU = document.getElementById('prog-duracion-unidad');
  const progDurN = document.getElementById('prog-duracion');
  const progEncN = document.getElementById('prog-encuentros');

  const jmFilt   = () => filtrarFrecuencias('jm-prog-duracion-unidad',  'jm-prog-frecuencia',  'jm-prog-duracion',  'jm-prog-encuentros');
  const progFilt = () => filtrarFrecuencias('prog-duracion-unidad',     'prog-frecuencia',     'prog-duracion',     'prog-encuentros');

  if (jmDurU)  jmDurU.addEventListener('change', jmFilt);
  if (jmDurN)  jmDurN.addEventListener('input',  jmFilt);
  if (jmEncN)  jmEncN.addEventListener('input',  jmFilt);
  if (progDurU) progDurU.addEventListener('change', progFilt);
  if (progDurN) progDurN.addEventListener('input',  progFilt);
  if (progEncN) progEncN.addEventListener('input',  progFilt);
}

function jmGuardarPrograma() {
  const nombre=document.getElementById('jm-prog-nombre').value.trim();
  const encuentros=document.getElementById('jm-prog-encuentros').value.trim();
  const durProg=document.getElementById('jm-prog-duracion').value.trim();
  const durProgUnidad=document.getElementById('jm-prog-duracion-unidad')?.value||'min';
  const frecuencia=document.getElementById('jm-prog-frecuencia')?.value||'';
  const precio=document.getElementById('jm-prog-precio').value.trim();
  const jmPrecioTipo=getPrecioTipo('jm-prog');
  const jmProgTipo=getProgTipo('jm-prog');
  const mod=document.getElementById('jm-prog-mod').value.trim();
  const jmDesc=document.getElementById('jm-prog-desc')?.value.trim()||'';
  const jmModulos=readModulos('jm-prog');
  const jmIncludes=readIncludes('jm-prog');
  const jmRequisitos=readRequisitos('jm-prog');
  const jmGaleria=readGaleria('jm-prog');
  const jmGaleriaOri=readGaleriaOri('jm-prog');
  const jmTestimonios=readTestimonios('jm-prog');
  const jmCupos=document.getElementById('jm-prog-cupos')?.value.trim()||'';
  const jmMostrarCupos=document.getElementById('jm-prog-mostrar-cupos')?.checked?'1':'0';
  const jmMediaTipoImg = document.getElementById('jm-prog-media-tab-img')?.classList.contains('on');
  const jmMedia = jmMediaTipoImg
    ? (jmProgMediaData ? { tipo:'imagen', src:jmProgMediaData } : null)
    : (jmProgVideoURL ? { tipo:'video_file', src:jmProgVideoURL } : null);
  const jmCancelacion=readCancelacion('jm-prog');
  const _jmLabels={'jm-prog-nombre':'Nombre del programa','jm-prog-encuentros':'N° de encuentros','jm-prog-duracion':'Duración','jm-prog-precio':'Precio','jm-prog-cupos':'Cupos'};
  const invalids=[['jm-prog-nombre',!nombre],['jm-prog-encuentros',!encuentros],['jm-prog-precio',!precio],['jm-prog-cupos',!jmCupos]];
  let hasError=false; const jmFaltantes=[];
  invalids.forEach(([id,bad])=>{const el=document.getElementById(id);if(el){el.style.borderColor=bad?'#ef4444':'';if(bad){hasError=true;jmFaltantes.push(_jmLabels[id]);}}});
  const _jmDurWrap=document.getElementById('jm-prog-duracion-wrap');
  if(_jmDurWrap) _jmDurWrap.style.borderColor=!durProg?'#ef4444':'';
  if(!durProg){hasError=true;jmFaltantes.push(_jmLabels['jm-prog-duracion']);}
  const _jmModGroup=document.getElementById('jm-prog-mod')?.closest('.form-group')?.querySelector('.toggle-group');
  if(!mod){hasError=true;jmFaltantes.push('Modalidad');if(_jmModGroup)_jmModGroup.style.outline='2px solid #ef4444';}
  else{if(_jmModGroup)_jmModGroup.style.outline='';}
  const _jmProgCW=document.getElementById('jm-prog-cancel-wrap');
  if(!jmCancelacion.total&&!jmCancelacion.parcial){hasError=true;jmFaltantes.push('Política de cancelación');if(_jmProgCW)_jmProgCW.style.outline='2px solid #ef4444';}else{if(_jmProgCW)_jmProgCW.style.outline='';}
  if(hasError){cfgToast('Completa los campos: '+jmFaltantes.join(', '),'#ef4444');return;}
  const color=document.getElementById('jm-prog-color').value;
  const jmBgColor=document.getElementById('jm-prog-bg-color')?.value||'#F7F8FC';
  const jmColorNavy=document.getElementById('jm-prog-color-navy')?.value||'#7E9DD6';
  const jmColorText=document.getElementById('jm-prog-color-text')?.value||'#333333';
  const jmColorTextLt=document.getElementById('jm-prog-color-text-lt')?.value||'#6B7194';
  const jmCardOpacity=parseFloat(document.getElementById('jm-prog-card-opacity')?.value||'72')/100;
  const jmTituloFont=document.getElementById('jm-prog-titulo-font')?.value||'DM Sans';
  const jmTituloSize=document.getElementById('jm-prog-titulo-size')?.value||'36';
  const _freqLabels={'diaria':'Diaria','lunes_viernes':'Lun-Vie','fines_semana':'Fin de semana','1_semana':'1 vez/sem','2_semana':'2 veces/sem','3_semana':'3 veces/sem','quincenal':'Quincenal','mensual':'Mensual'};
  const _uLbls={'min':'min','hr':'hr','dia':'día(s)','sem':'sem','mes':'mes(es)'};
  const freqLabel=frecuencia?_freqLabels[frecuencia]||frecuencia:'';
  const durProgStr=durProg?(durProg+' '+(_uLbls[durProgUnidad]||durProgUnidad)):'';
  const meta=encuentros?encuentros+' encuentros'+(durProgStr?' de '+durProgStr:'')+(freqLabel?' · '+freqLabel:'')+(mod?' · '+mod:''):(mod||'');
  const _jmProgPayload={profile_type:'profesional',nombre,tipo:jmProgTipo,desc:jmDesc,precio,precioTipo:jmPrecioTipo,mod,encuentros,duracion:durProg,duracion_unidad:durProgUnidad,frecuencia,cupos:jmCupos,mostrarCupos:jmMostrarCupos==='1',color,bgColor:jmBgColor,colorNavy:jmColorNavy,colorText:jmColorText,colorTextLt:jmColorTextLt,cardOpacity:jmCardOpacity,tituloFont:jmTituloFont,tituloSize:jmTituloSize,cancelacion:jmCancelacion,modulos:jmModulos,includes:jmIncludes,requisitos:jmRequisitos,galeria:jmGaleria,galeriaOri:jmGaleriaOri,media:jmMedia,meta};
  const _jmProgEditId=jmEditingProgRow?.dataset?.ppId;
  if(jmEditingProgRow){
    jmEditingProgRow.querySelector('.svc-name').textContent=nombre;
    jmEditingProgRow.querySelector('.svc-meta').textContent=meta;
    jmEditingProgRow.querySelector('.svc-price').textContent=precio;
    jmEditingProgRow.style.background=color; jmEditingProgRow.dataset.desc=jmDesc; jmEditingProgRow.dataset.tipo=jmProgTipo; jmEditingProgRow.dataset.precioTipo=jmPrecioTipo; jmEditingProgRow.dataset.bgColor=jmBgColor; jmEditingProgRow.dataset.colorNavy=jmColorNavy; jmEditingProgRow.dataset.colorText=jmColorText; jmEditingProgRow.dataset.colorTextLt=jmColorTextLt; jmEditingProgRow.dataset.cardOpacity=jmCardOpacity; jmEditingProgRow.dataset.tituloFont=jmTituloFont; jmEditingProgRow.dataset.tituloSize=jmTituloSize; jmEditingProgRow.dataset.cancelacion=JSON.stringify(jmCancelacion); jmEditingProgRow.dataset.modulos=JSON.stringify(jmModulos); jmEditingProgRow.dataset.includes=JSON.stringify(jmIncludes); jmEditingProgRow.dataset.requisitos=JSON.stringify(jmRequisitos); jmEditingProgRow.dataset.galeria=JSON.stringify(jmGaleria); jmEditingProgRow.dataset.galeriaOri=jmGaleriaOri; jmEditingProgRow.dataset.testimonios=JSON.stringify(jmTestimonios); jmEditingProgRow.dataset.cupos=jmCupos; jmEditingProgRow.dataset.mostrarCupos=jmMostrarCupos; jmEditingProgRow.dataset.media=JSON.stringify(jmMedia||null); jmEditingProgRow=null;
  } else {
    const list=document.getElementById('jm-prog-list');
    const row=document.createElement('div'); row.className='svc-row'; row.style.background=color;
    row.innerHTML=`${jmProgImgData?`<img src="${jmProgImgData}" style="width:40px;height:40px;border-radius:6px;object-fit:cover;flex-shrink:0">`:''}<span class="svc-dot" style="background:${color}"></span><div style="flex:1"><div class="svc-name">${nombre}</div><div class="svc-meta">${meta}</div></div><span class="svc-price">${precio}</span><button class="btn-secondary btn-sm" style="margin-left:10px" onclick="jmEditarPrograma(this)"><i class="fas fa-pen"></i></button><button class="btn-icon" style="margin-left:2px;color:#ef4444" onclick="ppDeletePrograma(this)"><i class="fas fa-trash"></i></button>`;
    row.dataset.desc=jmDesc; row.dataset.tipo=jmProgTipo; row.dataset.precioTipo=jmPrecioTipo; row.dataset.bgColor=jmBgColor; row.dataset.colorNavy=jmColorNavy; row.dataset.colorText=jmColorText; row.dataset.colorTextLt=jmColorTextLt; row.dataset.cardOpacity=jmCardOpacity; row.dataset.tituloFont=jmTituloFont; row.dataset.tituloSize=jmTituloSize; row.dataset.cancelacion=JSON.stringify(jmCancelacion); row.dataset.modulos=JSON.stringify(jmModulos); row.dataset.includes=JSON.stringify(jmIncludes); row.dataset.requisitos=JSON.stringify(jmRequisitos); row.dataset.galeria=JSON.stringify(jmGaleria); row.dataset.galeriaOri=jmGaleriaOri; row.dataset.testimonios=JSON.stringify(jmTestimonios); row.dataset.cupos=jmCupos; row.dataset.mostrarCupos=jmMostrarCupos; row.dataset.media=JSON.stringify(jmMedia||null); list.appendChild(row);
    if(typeof apiCall!=='undefined')apiCall('/api/perfil-profesional/programas',{method:'POST',body:JSON.stringify(_jmProgPayload)}).then(r=>r.json()).then(d=>{if(d.success&&d.programa)row.dataset.ppId=d.programa.id;}).catch(()=>{});
  }
  if(_jmProgEditId&&typeof apiCall!=='undefined')apiCall('/api/perfil-profesional/programas/'+_jmProgEditId,{method:'PUT',body:JSON.stringify(_jmProgPayload)}).catch(()=>{});
  jmSyncProgramas();
  pmSend({type:'programas',value:jmData.programas});
  document.getElementById('jm-form-programa')?.classList.remove('open');
  document.getElementById('jm-form-programa-title').innerHTML='<i class="fas fa-layer-group" style="margin-right:6px"></i>Nuevo programa';
  document.getElementById('jm-btn-guardar-programa').innerHTML='<i class="fas fa-check" style="margin-right:5px"></i>Guardar programa';
  closeProgPreview();
  ['jm-prog-nombre','jm-prog-encuentros','jm-prog-duracion','jm-prog-precio','jm-prog-desc','jm-prog-frecuencia'].forEach(id=>{const el=document.getElementById(id);if(el) el.value='';});
  const jmdu=document.getElementById('jm-prog-duracion-unidad'); if(jmdu) jmdu.value='min';;
  document.getElementById('jm-prog-mod').value='';
  document.querySelectorAll('#jm-form-programa .toggle-btn').forEach(b=>b.classList.remove('on'));
  setPrecioTipo('jm-prog','total');
  resetProgTipo('jm-prog');
  resetCancelacion('jm-prog');
  jmClearProgImg();
}

function jmCancelarPrograma() {
  jmEditingProgRow=null;
  document.getElementById('jm-form-programa')?.classList.remove('open');
  document.getElementById('jm-form-programa-title').innerHTML='<i class="fas fa-layer-group" style="margin-right:6px"></i>Nuevo programa';
  document.getElementById('jm-btn-guardar-programa').innerHTML='<i class="fas fa-check" style="margin-right:5px"></i>Guardar programa';
  closeProgPreview();
}

function jmFotoPerfil(input) {
  if(!input.files[0]) return;
  const file = input.files[0];
  if(!_epCheckSize(file, input)) return;
  document.getElementById('jm-foto-perfil-name').textContent=file.name;
  const r=new FileReader();
  r.onload=e=>{jmData.foto=e.target.result;document.getElementById('jm-foto-thumb').src=e.target.result;document.getElementById('jm-foto-preview').style.display='block';pmSend({type:'equipo_foto',value:e.target.result});};
  r.readAsDataURL(file);
}

function jmPreviewSesColor(val) { if(jmEditingSesionRow) jmEditingSesionRow.style.background=val; }
function jmPreviewProgColor(val) { if(jmEditingProgRow) jmEditingProgRow.style.background=val; }

// ── SERVICIOS (Step 4) ──
// ── PREVIEW DE PROGRAMA ──
var _previewDebounce = null;
var _previewUpdateTimers = {};
var _formListenersInited = {};
var _currentPreviewPrefix = '';
var _heroImgPosition = {};
var _portadaImgPosition = {x:50, y:50};

// Escuchar posición de arrastre del hero desde el iframe
window.addEventListener('message', function(e) {
  if (!e.data || e.data.type !== 'hero_position') return;
  if (_currentPreviewPrefix) {
    _heroImgPosition[_currentPreviewPrefix] = { x: e.data.x, y: e.data.y };
  } else {
    _portadaImgPosition = { x: e.data.x, y: e.data.y };
    localStorage.setItem('ep_portada_position', JSON.stringify(_portadaImgPosition));
    ppSaveConfig();
  }
});

function schedulePreviewUpdate(prefix) {
  var iframe = document.getElementById('perfil-iframe');
  if (!iframe || !iframe.src.includes('programa_detalle')) return;
  if (_previewUpdateTimers[prefix]) clearTimeout(_previewUpdateTimers[prefix]);
  _previewUpdateTimers[prefix] = setTimeout(function() { openProgPreview(prefix); }, 150);
}

function ensureFormListeners(formId, prefix) {
  if (_formListenersInited[formId]) return;
  _formListenersInited[formId] = true;
  var form = document.getElementById(formId);
  if (!form) return;
  var update = function(e) {
    // Los pickers de color ya usan postMessage instantáneo; el reload ocurre
    // 500ms después de que el usuario suelta el cursor, lo cual es correcto.
    schedulePreviewUpdate(prefix);
  };
  form.addEventListener('input',  update);
  form.addEventListener('change', update);
  form.addEventListener('click',  function() { schedulePreviewUpdate(prefix); });
}

function openProgPreview(prefix) {
  _currentPreviewPrefix = prefix;
  var formId = prefix === 'prog' ? 'form-programa' : 'jm-form-programa';
  ensureFormListeners(formId, prefix);
  var imgData = prefix === 'prog' ? (typeof progImgData !== 'undefined' ? progImgData : '') : (typeof jmProgImgData !== 'undefined' ? jmProgImgData : '');
  var _enc  = document.getElementById(prefix+'-encuentros')?.value.trim()||'';
  var _dur  = document.getElementById(prefix+'-duracion')?.value.trim()||'';
  var _dun  = document.getElementById(prefix+'-duracion-unidad')?.value||'min';
  var _frec = document.getElementById(prefix+'-frecuencia')?.value||'';
  var _mod  = document.getElementById(prefix+'-mod')?.value.trim()||'';
  var _fMap = {'diaria':'Diaria','lunes_viernes':'Lun-Vie','fines_semana':'Fin de semana','1_semana':'1 vez/sem','2_semana':'2 veces/sem','3_semana':'3 veces/sem','quincenal':'Quincenal','mensual':'Mensual'};
  var _uMap = {'min':'min','hr':'hr','dia':'día(s)','sem':'sem','mes':'mes(es)'};
  var _durStr  = _dur ? (_dur+' '+(_uMap[_dun]||_dun)) : '';
  var _frecLbl = _frec ? (_fMap[_frec]||_frec) : '';
  var _meta = _enc ? (_enc+' encuentros'+(_durStr?' de '+_durStr:'')+(_frecLbl?' · '+_frecLbl:'')+(_mod?' · '+_mod:'')) : (_mod||'');
  var prog = {
    nombre:      document.getElementById(prefix+'-nombre')?.value.trim() || 'Vista previa',
    tipo:        getProgTipo(prefix),
    desc:        document.getElementById(prefix+'-desc')?.value.trim() || '',
    precio:      document.getElementById(prefix+'-precio')?.value.trim() || '',
    precioTipo:  getPrecioTipo(prefix),
    meta:        _meta,
    color:       document.getElementById(prefix+'-color')?.value || '#10b981',
    bgColor:     document.getElementById(prefix+'-bg-color')?.value || '#F7F8FC',
    colorNavy:   document.getElementById(prefix+'-color-navy')?.value || '#7E9DD6',
    colorText:   document.getElementById(prefix+'-color-text')?.value || '#333333',
    colorTextLt: document.getElementById(prefix+'-color-text-lt')?.value || '#6B7194',
    btnStart:    document.getElementById(prefix+'-color-btn-start')?.value || '#9497F4',
    btnEnd:      document.getElementById(prefix+'-color-btn-end')?.value   || '#89B9F8',
    cardOpacity: parseFloat(document.getElementById(prefix+'-card-opacity')?.value||'72') / 100,
    tituloFont:  document.getElementById(prefix+'-titulo-font')?.value     || 'DM Sans',
    tituloSize:  document.getElementById(prefix+'-titulo-size')?.value     || '36',
    img:         imgData,
    imgPosition: _heroImgPosition[prefix] || {x:50, y:50},
    modulos:     readModulos(prefix),
    includes:    readIncludes(prefix),
    requisitos:  readRequisitos(prefix),
    galeria:     readGaleria(prefix),
    galeriaOri:  readGaleriaOri(prefix),
    media:       (function() {
      var isImg = document.getElementById(prefix+'-media-tab-img')?.classList.contains('on');
      var mData = prefix === 'prog' ? progMediaData : jmProgMediaData;
      var vURL  = prefix === 'prog' ? progVideoURL  : jmProgVideoURL;
      if (isImg)  return mData ? { tipo:'imagen',     src:mData } : null;
      return vURL ? { tipo:'video_file', src:vURL }  : null;
    })(),
    cupos:       document.getElementById(prefix+'-cupos')?.value || '',
    mostrarCupos: document.getElementById(prefix+'-mostrar-cupos')?.checked || false,
    creador: {
      tipo: 'empresa',
      nombre:       document.getElementById('empresa-nombre')?.value || 'Mi empresa',
      foto:         localStorage.getItem('ep_foto') || '',
      experiencia:  document.getElementById('esp-exp')?.value || '',
      especialidad: [...document.querySelectorAll('#sum-esp-chips .spec-tag')].map(function(t){return t.textContent.trim();}).filter(Boolean).join(', ')
    }
  };
  localStorage.setItem('ep_prog_preview', JSON.stringify(prog));
  var iframe = document.getElementById('perfil-iframe');
  if (!iframe) return;
  if (iframe.src && iframe.src.includes('programa_detalle')) {
    // Iframe ya cargado — actualizar DOM sin reload
    try { iframe.contentWindow.postMessage({ type: 'prog_update', prog: prog }, '*'); } catch(err) {}
  } else {
    // Primera vez — cargar la página
    iframe.src = './pages/programa_detalle.html?preview=1';
    setTimeout(scaleIframe, 600);
  }
}

function sendDescPreview(prefix, value) {
  var iframe = document.getElementById('perfil-iframe');
  if (!iframe || !iframe.src.includes('programa_detalle')) return;
  try { iframe.contentWindow.postMessage({ type: 'prog_desc', desc: value }, '*'); } catch(e) {}
}

function sendColorPreview(prefix) {
  var iframe = document.getElementById('perfil-iframe');
  if (!iframe || !iframe.src.includes('programa_detalle')) return;
  try {
    iframe.contentWindow.postMessage({
      type:        'prog_colors',
      bgColor:     document.getElementById(prefix+'-bg-color')?.value,
      colorNavy:   document.getElementById(prefix+'-color-navy')?.value,
      colorText:   document.getElementById(prefix+'-color-text')?.value,
      colorTextLt: document.getElementById(prefix+'-color-text-lt')?.value,
      cardOpacity: parseFloat(document.getElementById(prefix+'-card-opacity')?.value||'72') / 100,
      btnStart:    document.getElementById(prefix+'-color-btn-start')?.value || '#9497F4',
      btnEnd:      document.getElementById(prefix+'-color-btn-end')?.value   || '#89B9F8',
      tituloFont:  document.getElementById(prefix+'-titulo-font')?.value     || 'DM Sans',
      tituloSize:  document.getElementById(prefix+'-titulo-size')?.value     || '36'
    }, '*');
  } catch(err) {}
}

function updateProgPreview(prefix) {
  var iframe = document.getElementById('perfil-iframe');
  if (!iframe || !iframe.src.includes('programa_detalle')) return;
  if (_previewDebounce) clearTimeout(_previewDebounce);
  _previewDebounce = setTimeout(function() { openProgPreview(prefix); }, 400);
}

function closeProgPreview() {
  _currentPreviewPrefix = '';
  localStorage.removeItem('ep_prog_preview');
  var iframe = document.getElementById('perfil-iframe');
  if (iframe) {
    iframe.src = './pages/perfil_profesional.html';
    setTimeout(scaleIframe, 400);
  }
}

function toggleForm(id) {
  var el = document.getElementById(id);
  if (!el) return;
  var isOpening = !el.classList.contains('open');
  el.classList.toggle('open');
  if (id === 'form-programa') {
    if (isOpening) openProgPreview('prog'); else closeProgPreview();
  } else if (id === 'jm-form-programa') {
    if (isOpening) openProgPreview('jm-prog'); else closeProgPreview();
  }
}

function editarSesion(btn) {
  const row=btn.closest('.svc-row');
  const nombre=row.querySelector('.svc-name').textContent.trim();
  const meta=row.querySelector('.svc-meta').textContent.trim();
  const precio=row.querySelector('.svc-price').textContent.trim();
  const color=row.querySelector('.svc-dot').style.background;
  const partes=meta.split('·').map(s=>s.trim());
  document.getElementById('ses-nombre').value=nombre;
  document.getElementById('ses-duracion').value=partes[0]?.replace('min','').trim()||'';
  document.getElementById('ses-precio').value=precio;
  document.getElementById('ses-mod').value=partes[1]||'';
  document.getElementById('ses-color').value=rgbToHex(color);
  document.querySelectorAll('#form-sesion .toggle-group .toggle-btn').forEach(b=>b.classList.toggle('on',(partes[1]||'').includes(b.textContent)));
  loadCancelacion('ses', JSON.parse(row.dataset.cancelacion||'null'));
  document.getElementById('form-sesion-title').innerHTML='<i class="fas fa-pen" style="margin-right:6px"></i>Editar sesión';
  document.getElementById('btn-guardar-sesion').innerHTML='<i class="fas fa-check" style="margin-right:5px"></i>Guardar';
  editingSesionRow=row;
  const panel=document.getElementById('form-sesion');
  if(!panel?.classList.contains('open')) panel?.classList.add('open');
  panel?.scrollIntoView({behavior:'smooth',block:'nearest'});
}

function cancelarSesion() {
  editingSesionRow=null;
  document.getElementById('form-sesion-title').innerHTML='<i class="fas fa-clock" style="margin-right:6px"></i>Crea tu servicio';
  document.getElementById('btn-guardar-sesion').innerHTML='<i class="fas fa-check" style="margin-right:5px"></i>Guardar';
  toggleForm('form-sesion');
}

function editarPrograma(btn) {
  const row=btn.closest('.svc-row');
  const nombre=row.querySelector('.svc-name').textContent.trim();
  const meta=row.querySelector('.svc-meta').textContent.trim();
  const precio=row.querySelector('.svc-price').textContent.trim();
  const color=row.querySelector('.svc-dot').style.background;
  const encMatch=meta.match(/(\d+)\s*encuentros?\s*de\s*(\d+)/i);
  const encuentros=encMatch?encMatch[1]:'';
  const duracion=encMatch?encMatch[2]:'';
  const _fMap={'Diaria':'diaria','Lun-Vie':'lunes_viernes','Fin de semana':'fines_semana','1 vez/sem':'1_semana','2 veces/sem':'2_semana','3 veces/sem':'3_semana','Quincenal':'quincenal','Mensual':'mensual'};
  const metaPartes=meta.split('·').map(s=>s.trim());
  const freqParte2=metaPartes.find(p=>_fMap[p])||'';
  const mod=metaPartes[metaPartes.length-1]||'';
  document.getElementById('prog-nombre').value=nombre;
  document.getElementById('prog-precio').value=precio;
  setProgTipo('prog', row.dataset.tipo || '');
  setPrecioTipo('prog', row.dataset.precioTipo || 'total');
  document.getElementById('prog-encuentros').value=encuentros;
  document.getElementById('prog-duracion').value=duracion;
  const progFreqEl=document.getElementById('prog-frecuencia'); if(progFreqEl) progFreqEl.value=_fMap[freqParte2]||'';
  filtrarFrecuencias('prog-duracion-unidad','prog-frecuencia','prog-duracion','prog-encuentros');
  document.getElementById('prog-mod').value=mod;
  document.getElementById('prog-desc').value=row.dataset.desc||'';
  loadModulos('prog', JSON.parse(row.dataset.modulos||'[]'));
  loadIncludes('prog', JSON.parse(row.dataset.includes||'[]'));
  loadRequisitos('prog', JSON.parse(row.dataset.requisitos||'[]'));
  loadGaleria('prog', JSON.parse(row.dataset.galeria||'[]'), row.dataset.galeriaOri||'h');
  loadTestimonios('prog', JSON.parse(row.dataset.testimonios||'[]'));
  const cuposEl=document.getElementById('prog-cupos'); if(cuposEl) cuposEl.value=row.dataset.cupos||'';
  const mcEl=document.getElementById('prog-mostrar-cupos'); if(mcEl) mcEl.checked=row.dataset.mostrarCupos==='1';
  syncCuposBtn('prog-mostrar-cupos','prog-mostrar-cupos-btn');
  document.getElementById('prog-color').value=rgbToHex(color);
  const bgColorEl=document.getElementById('prog-bg-color'); if(bgColorEl) bgColorEl.value=row.dataset.bgColor||'#F7F8FC';
  const cnEl=document.getElementById('prog-color-navy');   if(cnEl) cnEl.value=row.dataset.colorNavy||'#7E9DD6';
  const ctEl=document.getElementById('prog-color-text');   if(ctEl) ctEl.value=row.dataset.colorText||'#333333';
  const ctlEl=document.getElementById('prog-color-text-lt'); if(ctlEl) ctlEl.value=row.dataset.colorTextLt||'#6B7194';
  const cbsEl=document.getElementById('prog-color-btn-start'); if(cbsEl) cbsEl.value=row.dataset.btnStart||'#9497F4';
  const cbeEl=document.getElementById('prog-color-btn-end');   if(cbeEl) cbeEl.value=row.dataset.btnEnd||'#89B9F8';
  const coEl=document.getElementById('prog-card-opacity'); if(coEl){coEl.value=Math.round((parseFloat(row.dataset.cardOpacity||'0.72'))*100);document.getElementById('prog-card-opacity-val').textContent=coEl.value+'%';}
  const tfEl=document.getElementById('prog-titulo-font'); if(tfEl) tfEl.value=row.dataset.tituloFont||'DM Sans';
  const tsEl=document.getElementById('prog-titulo-size'); if(tsEl){tsEl.value=row.dataset.tituloSize||'36';document.getElementById('prog-titulo-size-val').textContent=(row.dataset.tituloSize||'36')+'px';}
  loadCancelacion('prog', JSON.parse(row.dataset.cancelacion||'null'));
  _heroImgPosition['prog']=JSON.parse(row.dataset.imgPosition||'{"x":50,"y":50}');
  const imgEl=row.querySelector('img');
  if(imgEl&&imgEl.src&&!imgEl.src.startsWith('data:')){progImgData=imgEl.src;document.getElementById('prog-img-thumb').src=progImgData;document.getElementById('prog-img-preview').style.display='block';document.getElementById('prog-img-name').textContent='Imagen cargada ✓';}
  else if(imgEl&&imgEl.src){progImgData=imgEl.src;document.getElementById('prog-img-thumb').src=progImgData;document.getElementById('prog-img-preview').style.display='block';document.getElementById('prog-img-name').textContent='Imagen cargada';}
  document.getElementById('form-programa-title').innerHTML='<i class="fas fa-pen" style="margin-right:6px"></i>Editar programa';
  document.getElementById('btn-guardar-programa').innerHTML='<i class="fas fa-check" style="margin-right:5px"></i>Guardar';
  editingProgRow=row;
  const panel=document.getElementById('form-programa');
  if(!panel?.classList.contains('open')) panel?.classList.add('open');
  openProgPreview('prog');
  panel?.scrollIntoView({behavior:'smooth',block:'nearest'});
}

function cancelarPrograma() {
  editingProgRow=null;
  document.getElementById('form-programa-title').innerHTML='<i class="fas fa-layer-group" style="margin-right:6px"></i>Nuevo programa';
  document.getElementById('btn-guardar-programa').innerHTML='<i class="fas fa-check" style="margin-right:5px"></i>Guardar programa';
  resetProgTipo('prog');
  closeProgPreview();
  toggleForm('form-programa');
}

function rgbToHex(rgb) {
  if(!rgb) return '#9961FF';
  if(rgb.startsWith('#')) return rgb;
  const m=rgb.match(/\d+/g);
  if(!m||m.length<3) return '#9961FF';
  return '#'+m.slice(0,3).map(n=>parseInt(n).toString(16).padStart(2,'0')).join('');
}

// ── MEDIA PROMOCIONAL ──
var progMediaData = '';
var jmProgMediaData = '';
var progVideoURL = '';
var jmProgVideoURL = '';

function prevProgVideo(input, prefix) {
  var file = input.files[0];
  if (!file) return;
  var errId     = prefix + '-video-error';
  var nameId    = prefix + '-video-name';
  var thumbId   = prefix + '-video-thumb';
  var previewId = prefix + '-video-preview';
  var errEl = document.getElementById(errId);
  if (file.size > 30 * 1024 * 1024) {
    if (errEl) errEl.style.display = '';
    input.value = '';
    return;
  }
  if (errEl) errEl.style.display = 'none';
  var url = URL.createObjectURL(file);
  if (prefix === 'prog') progVideoURL = url; else jmProgVideoURL = url;
  var nameEl  = document.getElementById(nameId);
  var thumbEl = document.getElementById(thumbId);
  var prevEl  = document.getElementById(previewId);
  if (nameEl)  nameEl.textContent = file.name;
  if (thumbEl) thumbEl.src = url;
  if (prevEl)  prevEl.style.display = '';
  schedulePreviewUpdate(prefix);
}

function clearProgVideo(prefix) {
  if (prefix === 'prog') progVideoURL = ''; else jmProgVideoURL = '';
  var nameEl  = document.getElementById(prefix + '-video-name');
  var prevEl  = document.getElementById(prefix + '-video-preview');
  var inputEl = document.getElementById(prefix + '-video-input');
  if (nameEl)  nameEl.textContent = 'Seleccionar video… (máx. 50MB)';
  if (prevEl)  prevEl.style.display = 'none';
  if (inputEl) inputEl.value = '';
  schedulePreviewUpdate(prefix);
}

function progMediaTab(tipo) {
  const isImg = tipo === 'img';
  document.getElementById('prog-media-tab-img').classList.toggle('on', isImg);
  document.getElementById('prog-media-tab-vid').classList.toggle('on', !isImg);
  document.getElementById('prog-media-img-wrap').style.display = isImg ? '' : 'none';
  document.getElementById('prog-media-vid-wrap').style.display = isImg ? 'none' : '';
}
function jmProgMediaTab(tipo) {
  const isImg = tipo === 'img';
  document.getElementById('jm-prog-media-tab-img').classList.toggle('on', isImg);
  document.getElementById('jm-prog-media-tab-vid').classList.toggle('on', !isImg);
  document.getElementById('jm-prog-media-img-wrap').style.display = isImg ? '' : 'none';
  document.getElementById('jm-prog-media-vid-wrap').style.display = isImg ? 'none' : '';
}
function prevProgMediaImg(input) {
  if (!input.files[0]) return;
  if (!_epCheckSize(input.files[0], input)) return;
  const r = new FileReader();
  r.onload = e => {
    progMediaData = e.target.result;
    document.getElementById('prog-media-img-thumb').src = progMediaData;
    document.getElementById('prog-media-img-preview').style.display = 'block';
    document.getElementById('prog-media-img-name').textContent = input.files[0].name;
  };
  r.readAsDataURL(input.files[0]);
}
function jmPrevProgMediaImg(input) {
  if (!input.files[0]) return;
  if (!_epCheckSize(input.files[0], input)) return;
  const r = new FileReader();
  r.onload = e => {
    jmProgMediaData = e.target.result;
    document.getElementById('jm-prog-media-img-thumb').src = jmProgMediaData;
    document.getElementById('jm-prog-media-img-preview').style.display = 'block';
    document.getElementById('jm-prog-media-img-name').textContent = input.files[0].name;
  };
  r.readAsDataURL(input.files[0]);
}
function clearProgMedia() {
  progMediaData = '';
  document.getElementById('prog-media-img-preview').style.display = 'none';
  document.getElementById('prog-media-img-name').textContent = 'Seleccionar imagen promocional…';
  document.getElementById('prog-media-img-input').value = '';
}
function jmClearProgMedia() {
  jmProgMediaData = '';
  document.getElementById('jm-prog-media-img-preview').style.display = 'none';
  document.getElementById('jm-prog-media-img-name').textContent = 'Seleccionar imagen promocional…';
  document.getElementById('jm-prog-media-img-input').value = '';
}

function cfgToast(msg, color) {
  color = color || '#10b981';
  const t = document.getElementById('cfg-toast');
  if (!t) return;
  t.style.background = color;
  document.getElementById('cfg-toast-msg').textContent = msg;
  t.style.opacity = '1';
  t.style.transform = 'translateX(-50%) translateY(0)';
  clearTimeout(cfgToast._timer);
  cfgToast._timer = setTimeout(() => {
    t.style.opacity = '0';
    t.style.transform = 'translateX(-50%) translateY(80px)';
  }, 3500);
}

// ── TESTIMONIOS ──
var TEST_MAX = 6;

function addTestimonio(prefix, data) {
  const list = document.getElementById(prefix + '-testimonios-list');
  if (!list) return;
  if (list.children.length >= TEST_MAX) { cfgToast('Máximo ' + TEST_MAX + ' testimonios', '#f59e0b'); return; }
  data = data || {};
  const id = prefix + '-test-' + Date.now();
  const row = document.createElement('div');
  row.className = 'test-row';
  row.innerHTML = `
    <div class="test-row-top">
      <div class="test-avatar-wrap">
        <div class="test-avatar-circle" id="${id}-av" onclick="document.getElementById('${id}-file').click()">
          ${data.foto ? `<img src="${data.foto}">` : '<i class="fas fa-user"></i>'}
        </div>
        <div class="test-avatar-edit"><i class="fas fa-camera"></i></div>
        <input type="file" id="${id}-file" accept="image/*" style="display:none" onchange="testSetFoto('${id}',this)">
      </div>
      <div class="test-fields">
        <input type="text" class="include-custom-input test-name" placeholder="Nombre del participante" value="${data.nombre||''}">
        <div class="test-stars">
          ${[1,2,3,4,5].map(n=>`<span class="test-star${(data.estrellas||5)>=n?' on':''}" data-val="${n}" onclick="testSetStars(this)">★</span>`).join('')}
        </div>
      </div>
      <button type="button" class="modulo-del" onclick="this.closest('.test-row').remove()"><i class="fas fa-times"></i></button>
    </div>
    <div class="test-comment-wrap">
      <textarea class="test-comment" maxlength="200" placeholder="Comentario (máx. 200 caracteres)">${data.comentario||''}</textarea>
      <span class="test-comment-counter">${(data.comentario||'').length}/200</span>
    </div>`;
  row.querySelector('.test-comment').addEventListener('input', function() {
    row.querySelector('.test-comment-counter').textContent = this.value.length + '/200';
  });
  list.appendChild(row);
}

function testSetStars(el) {
  const val = parseInt(el.dataset.val);
  el.closest('.test-stars').querySelectorAll('.test-star').forEach(s => s.classList.toggle('on', parseInt(s.dataset.val) <= val));
}

function testSetFoto(id, input) {
  if (!input.files[0]) return;
  if (!_epCheckSize(input.files[0], input)) return;
  const r = new FileReader();
  r.onload = e => {
    const av = document.getElementById(id + '-av');
    if (av) av.innerHTML = `<img src="${e.target.result}">`;
  };
  r.readAsDataURL(input.files[0]);
}

function readTestimonios(prefix) {
  return [...document.querySelectorAll('#' + prefix + '-testimonios-list .test-row')].map(row => ({
    nombre:    row.querySelector('.test-name')?.value.trim() || '',
    estrellas: row.querySelectorAll('.test-star.on').length || 5,
    comentario:row.querySelector('.test-comment')?.value.trim() || '',
    foto:      row.querySelector('.test-avatar-circle img')?.src || ''
  })).filter(t => t.nombre || t.comentario);
}

function loadTestimonios(prefix, items) {
  const list = document.getElementById(prefix + '-testimonios-list');
  if (!list) return;
  list.innerHTML = '';
  (items || []).forEach(t => addTestimonio(prefix, t));
}

// ── GALERÍA ──
var _galeriaData = { 'prog': [], 'jm-prog': [] };
var GALERIA_MAX = 5;

function addGaleriaImgs(prefix, input) {
  const files = Array.from(input.files);
  const current = _galeriaData[prefix] || [];
  const remaining = GALERIA_MAX - current.length;
  if (remaining <= 0) { cfgToast('Máximo ' + GALERIA_MAX + ' imágenes por programa', '#f59e0b'); input.value=''; return; }
  const toRead = files.slice(0, remaining).filter(f => {
    if (f.size > _EP_MAX_BYTES) { cfgToast(`"${f.name}" supera ${_EP_MAX_MB} MB y fue omitida`, '#f59e0b'); return false; }
    return true;
  });
  if (files.length > remaining) cfgToast('Solo se agregaron ' + remaining + ' imagen(es). Límite: ' + GALERIA_MAX, '#f59e0b');
  toRead.forEach(file => {
    const r = new FileReader();
    r.onload = e => {
      _galeriaData[prefix].push(e.target.result);
      renderGaleriaThumbs(prefix);
    };
    r.readAsDataURL(file);
  });
  input.value = '';
}

function renderGaleriaThumbs(prefix) {
  const wrap  = document.getElementById(prefix + '-galeria-thumbs');
  const label = document.getElementById(prefix + '-galeria-label');
  if (!wrap) return;
  const imgs = _galeriaData[prefix] || [];
  wrap.innerHTML = imgs.map((src, i) =>
    `<div class="galeria-thumb">
      <img src="${src}">
      <button type="button" class="galeria-thumb-del" onclick="removeGaleriaImg('${prefix}',${i})">✕</button>
    </div>`
  ).join('');
  if (label) label.classList.toggle('hidden', imgs.length >= GALERIA_MAX);
}

function removeGaleriaImg(prefix, idx) {
  _galeriaData[prefix].splice(idx, 1);
  renderGaleriaThumbs(prefix);
}

function readGaleria(prefix) { return _galeriaData[prefix] || []; }

function readGaleriaOri(prefix) {
  return document.getElementById(prefix + '-galeria-ori-v')?.classList.contains('on') ? 'v' : 'h';
}

function setGaleriaOri(prefix, ori) {
  document.getElementById(prefix + '-galeria-ori-h')?.classList.toggle('on', ori === 'h');
  document.getElementById(prefix + '-galeria-ori-v')?.classList.toggle('on', ori === 'v');
}

function loadGaleria(prefix, imgs, ori) {
  _galeriaData[prefix] = imgs || [];
  renderGaleriaThumbs(prefix);
  setGaleriaOri(prefix, ori || 'h');
}

// ── QUÉ INCLUYE ──
function toggleIncludeChip(el) { el.classList.toggle('on'); }

function addCustomInclude(prefix) {
  const wrap = document.getElementById(prefix + '-includes-custom');
  if (!wrap) return;
  // Si ya hay un input pendiente, solo hace foco
  const existing = wrap.querySelector('.include-custom-input');
  if (existing) { existing.focus(); return; }
  const row = document.createElement('div');
  row.className = 'include-custom-row';
  row.innerHTML =
    '<input type="text" class="include-custom-input" placeholder="Ej: Guía de práctica en PDF">' +
    '<button type="button" class="btn-secondary btn-sm" style="white-space:nowrap" onclick="confirmCustomInclude(\'' + prefix + '\')">' +
      '<i class="fas fa-plus"></i> Agregar' +
    '</button>' +
    '<button type="button" class="modulo-del" onclick="this.closest(\'.include-custom-row\').remove()" title="Cancelar"><i class="fas fa-times"></i></button>';
  const input = row.querySelector('.include-custom-input');
  input.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') { e.preventDefault(); confirmCustomInclude(prefix); }
  });
  wrap.appendChild(row);
  input.focus();
}

function confirmCustomInclude(prefix) {
  const wrap  = document.getElementById(prefix + '-includes-custom');
  const chips = document.getElementById(prefix + '-includes-chips');
  if (!wrap || !chips) return;
  const input = wrap.querySelector('.include-custom-input');
  const texto = input ? input.value.trim() : '';
  if (!texto) { if (input) input.focus(); return; }

  // Crear chip activo en la grilla
  const chip = document.createElement('div');
  chip.className = 'include-chip on include-chip-custom';
  chip.dataset.icono  = 'fa-check';
  chip.dataset.texto  = texto;
  chip.innerHTML =
    '<i class="fas fa-check"></i> ' + texto +
    '<span class="include-chip-del" onclick="this.closest(\'.include-chip\').remove()" title="Eliminar" ' +
      'style="margin-left:6px;cursor:pointer;opacity:.7;font-size:10px">✕</span>';
  chip.addEventListener('click', function(e) {
    if (!e.target.classList.contains('include-chip-del')) chip.classList.toggle('on');
  });
  chips.appendChild(chip);

  // Limpiar fila temporal
  wrap.querySelector('.include-custom-row')?.remove();
}

function readIncludes(prefix) {
  const chips = document.querySelectorAll('#' + prefix + '-includes-chips .include-chip.on');
  const items = [];
  chips.forEach(c => items.push({ icono: c.dataset.icono, texto: c.dataset.texto }));
  return items;
}

function loadIncludes(prefix, items) {
  const chipsWrap = document.getElementById(prefix + '-includes-chips');
  const customWrap = document.getElementById(prefix + '-includes-custom');
  if (!chipsWrap) return;
  // Resetear predefinidos y eliminar custom guardados anteriores
  chipsWrap.querySelectorAll('.include-chip').forEach(c => c.classList.remove('on'));
  chipsWrap.querySelectorAll('.include-chip-custom').forEach(c => c.remove());
  if (customWrap) customWrap.innerHTML = '';
  (items || []).forEach(function(item) {
    const predefined = chipsWrap.querySelector('[data-texto="' + item.texto + '"]:not(.include-chip-custom)');
    if (predefined) {
      predefined.classList.add('on');
    } else {
      // Recrear como custom chip activo
      const chip = document.createElement('div');
      chip.className = 'include-chip on include-chip-custom';
      chip.dataset.icono = item.icono || 'fa-check';
      chip.dataset.texto = item.texto;
      chip.innerHTML = '<i class="fas fa-check"></i> ' + item.texto +
        '<span class="include-chip-del" onclick="this.closest(\'.include-chip\').remove()" ' +
        'style="margin-left:6px;cursor:pointer;opacity:.7;font-size:10px">✕</span>';
      chip.addEventListener('click', function(e) {
        if (!e.target.classList.contains('include-chip-del')) chip.classList.toggle('on');
      });
      chipsWrap.appendChild(chip);
    }
  });
}

// ── REQUISITOS ──
function addRequisito(prefix, valor) {
  const list = document.getElementById(prefix + '-requisitos-list');
  if (!list) return;
  const row = document.createElement('div');
  row.className = 'include-custom-row';
  row.innerHTML =
    '<input type="text" class="include-custom-input" maxlength="150" placeholder="Ej: Conocimientos básicos de costura" value="' + (valor||'') + '">' +
    '<button type="button" class="modulo-del" onclick="this.closest(\'.include-custom-row\').remove()" title="Eliminar"><i class="fas fa-times"></i></button>';
  list.appendChild(row);
  if (!valor) row.querySelector('input').focus();
}
function readRequisitos(prefix) {
  return [...document.querySelectorAll('#' + prefix + '-requisitos-list .include-custom-input')]
    .map(i => i.value.trim()).filter(Boolean);
}
function loadRequisitos(prefix, items) {
  const list = document.getElementById(prefix + '-requisitos-list');
  if (!list) return;
  list.innerHTML = '';
  (items || []).forEach(v => addRequisito(prefix, v));
}

// ── MÓDULOS ──
function addModulo(prefix, titulo, desc) {
  const list = document.getElementById(prefix + '-modulos-list');
  if (!list) return;
  const idx  = list.children.length + 1;
  const row  = document.createElement('div');
  row.className = 'modulo-row';
  row.innerHTML = `
    <div class="modulo-header">
      <span class="modulo-num">${idx}</span>
      <input type="text" class="modulo-titulo" placeholder="Título del módulo" value="${titulo||''}">
      <button type="button" class="modulo-del" onclick="removeModulo(this)" title="Eliminar"><i class="fas fa-times"></i></button>
    </div>
    <div class="modulo-desc-wrap">
      <textarea class="modulo-desc" maxlength="150" placeholder="Descripción breve (opcional, máx. 150 caracteres)">${desc||''}</textarea>
      <span class="modulo-counter">${(desc||'').length}/150</span>
    </div>`;
  row.querySelector('.modulo-desc').addEventListener('input', function() {
    row.querySelector('.modulo-counter').textContent = this.value.length + '/150';
  });
  list.appendChild(row);
  renumModulos(list);
}

function removeModulo(btn) {
  const list = btn.closest('[id$="-modulos-list"]');
  btn.closest('.modulo-row').remove();
  if (list) renumModulos(list);
}

function renumModulos(list) {
  list.querySelectorAll('.modulo-num').forEach((n, i) => { n.textContent = i + 1; });
}

function readModulos(prefix) {
  const list = document.getElementById(prefix + '-modulos-list');
  if (!list) return [];
  return [...list.querySelectorAll('.modulo-row')].map(row => ({
    titulo: row.querySelector('.modulo-titulo')?.value.trim() || '',
    desc:   row.querySelector('.modulo-desc')?.value.trim()   || ''
  })).filter(m => m.titulo);
}

function loadModulos(prefix, modulos) {
  const list = document.getElementById(prefix + '-modulos-list');
  if (!list) return;
  list.innerHTML = '';
  (modulos || []).forEach(m => addModulo(prefix, m.titulo, m.desc));
}

function toggleCuposBtn(checkboxId, btnId) {
  const cb  = document.getElementById(checkboxId);
  const btn = document.getElementById(btnId);
  if (!cb || !btn) return;
  cb.checked = !cb.checked;
  btn.classList.toggle('on', cb.checked);
}
function syncCuposBtn(checkboxId, btnId) {
  const cb  = document.getElementById(checkboxId);
  const btn = document.getElementById(btnId);
  if (cb && btn) btn.classList.toggle('on', cb.checked);
}

// ── TIPO DE PROGRAMA ──
function setProgTipo(prefix, tipo) {
  var t  = tipo || 'programa';
  var tl = t.toLowerCase();
  // Activar chip
  document.querySelectorAll('#' + prefix + '-tipo-chips .tipo-chip').forEach(function(c) {
    c.classList.toggle('on', c.dataset.val === tipo);
  });
  var hidden = document.getElementById(prefix + '-tipo');
  if (hidden) hidden.value = tipo;
  // Helper para actualizar label preservando el <span> de "(opcional)"
  function setLbl(id, text) {
    var el = document.getElementById(id);
    if (!el) return;
    var span = el.querySelector('span');
    el.textContent = text + ' ';
    if (span) el.appendChild(span);
  }
  var pfx = prefix === 'prog' ? 'prog' : 'jm-prog';
  setLbl(pfx + '-lbl-nombre',  'Nombre del ' + tl);
  setLbl(pfx + '-lbl-modulos', 'Módulos del ' + tl);
  setLbl(pfx + '-lbl-imagen',  'Imagen del '  + tl);
  setLbl(pfx + '-lbl-galeria', 'Imágenes de tu ' + tl);
  setLbl(pfx + '-lbl-color',   'Color del '   + tl);
  setLbl(pfx + '-lbl-fondo',   'Fondo del '   + tl);
  var colorLbl = document.getElementById(pfx + '-color-label');
  if (colorLbl) colorLbl.textContent = 'Color del ' + tl;
  var inputNombre = document.getElementById(pfx + '-nombre');
  if (inputNombre) inputNombre.placeholder = 'Nombre del ' + tl;
  // Título y botón (solo si no está en modo edición)
  var titleId = prefix === 'prog' ? 'form-programa-title'   : 'jm-form-programa-title';
  var btnId   = prefix === 'prog' ? 'btn-guardar-programa'  : 'jm-btn-guardar-programa';
  var titleEl = document.getElementById(titleId);
  var btnEl   = document.getElementById(btnId);
  if (titleEl && !titleEl.innerHTML.includes('fa-pen')) {
    titleEl.innerHTML = '<i class="fas fa-layer-group" style="margin-right:6px"></i>Nuevo ' + tl;
  } else if (titleEl && titleEl.innerHTML.includes('fa-pen')) {
    titleEl.innerHTML = '<i class="fas fa-pen" style="margin-right:6px"></i>Editar ' + tl;
  }
  if (btnEl) btnEl.innerHTML = '<i class="fas fa-check" style="margin-right:5px"></i>Guardar ' + tl;
}

function addCustomTipo(prefix) {
  var input = document.getElementById(prefix + '-tipo-custom');
  var val   = input ? input.value.trim() : '';
  if (!val) return;
  var container = document.getElementById(prefix + '-tipo-chips');
  if (!container) return;
  // Evitar duplicados
  var exists = [...container.querySelectorAll('.tipo-chip')].some(function(c) {
    return c.dataset.val.toLowerCase() === val.toLowerCase();
  });
  if (!exists) {
    var chip = document.createElement('div');
    chip.className = 'tipo-chip';
    chip.dataset.val = val;
    chip.textContent = val;
    chip.onclick = function() { setProgTipo(prefix, val); };
    container.appendChild(chip);
  }
  setProgTipo(prefix, val);
  if (input) input.value = '';
}

function getProgTipo(prefix) {
  var el = document.getElementById(prefix + '-tipo');
  return el ? el.value : '';
}

function resetProgTipo(prefix) {
  document.querySelectorAll('#' + prefix + '-tipo-chips .tipo-chip').forEach(function(c) {
    c.classList.remove('on');
  });
  var hidden = document.getElementById(prefix + '-tipo');
  if (hidden) hidden.value = '';
  function setLbl(id, text) {
    var el = document.getElementById(id);
    if (!el) return;
    var span = el.querySelector('span');
    el.textContent = text + ' ';
    if (span) el.appendChild(span);
  }
  var pfx = prefix === 'prog' ? 'prog' : 'jm-prog';
  setLbl(pfx + '-lbl-nombre',  'Nombre del programa');
  setLbl(pfx + '-lbl-modulos', 'Módulos del programa');
  setLbl(pfx + '-lbl-imagen',  'Imagen del programa');
  setLbl(pfx + '-lbl-galeria', 'Galería de imágenes');
  setLbl(pfx + '-lbl-color',   'Color identificador');
  setLbl(pfx + '-lbl-fondo',   'Color de fondo de página');
  var colorLbl = document.getElementById(pfx + '-color-label');
  if (colorLbl) colorLbl.textContent = 'Color del programa';
  var inputNombre = document.getElementById(pfx + '-nombre');
  if (inputNombre) inputNombre.placeholder = 'Nombre del programa';
  var titleId = prefix === 'prog' ? 'form-programa-title'  : 'jm-form-programa-title';
  var btnId   = prefix === 'prog' ? 'btn-guardar-programa' : 'jm-btn-guardar-programa';
  var titleEl = document.getElementById(titleId);
  var btnEl   = document.getElementById(btnId);
  if (titleEl) titleEl.innerHTML = '<i class="fas fa-layer-group" style="margin-right:6px"></i>Nuevo programa';
  if (btnEl)   btnEl.innerHTML   = '<i class="fas fa-check" style="margin-right:5px"></i>Guardar programa';
}

function setPrecioTipo(prefix, tipo) {
  const btnTotal   = document.getElementById(prefix+'-precio-tipo-total');
  const btnMensual = document.getElementById(prefix+'-precio-tipo-mensual');
  if(btnTotal)   btnTotal.classList.toggle('on',   tipo==='total');
  if(btnMensual) btnMensual.classList.toggle('on', tipo==='mensual');
}
function getPrecioTipo(prefix) {
  const btnMensual = document.getElementById(prefix+'-precio-tipo-mensual');
  return (btnMensual && btnMensual.classList.contains('on')) ? 'mensual' : 'total';
}

function toggleCancelOption(prefix, tipo) {
  const btn=document.getElementById(prefix+'-cancel-'+tipo+'-btn');
  const det=document.getElementById(prefix+'-cancel-'+tipo+'-detail');
  if(!btn||!det) return;
  const isOn=btn.classList.toggle('on');
  det.style.display=isOn?'flex':'none';
  const wrap=document.getElementById(prefix+'-cancel-wrap');
  if(wrap) wrap.style.outline='';
}
function readCancelacion(prefix) {
  const totalOn=document.getElementById(prefix+'-cancel-total-btn')?.classList.contains('on');
  const parcialOn=document.getElementById(prefix+'-cancel-parcial-btn')?.classList.contains('on');
  return {
    total: totalOn?{tiempo:document.getElementById(prefix+'-cancel-total-tiempo')?.value||'',unidad:document.getElementById(prefix+'-cancel-total-unidad')?.value||'hrs'}:null,
    parcial: parcialOn?{tiempo:document.getElementById(prefix+'-cancel-parcial-tiempo')?.value||'',unidad:document.getElementById(prefix+'-cancel-parcial-unidad')?.value||'hrs',valor:document.getElementById(prefix+'-cancel-parcial-valor')?.value||'',tipo:'pct'}:null
  };
}
function loadCancelacion(prefix, data) {
  resetCancelacion(prefix);
  if(!data) return;
  if(data.total){const btn=document.getElementById(prefix+'-cancel-total-btn');const det=document.getElementById(prefix+'-cancel-total-detail');if(btn)btn.classList.add('on');if(det)det.style.display='flex';const t=document.getElementById(prefix+'-cancel-total-tiempo');if(t)t.value=data.total.tiempo||'';const u=document.getElementById(prefix+'-cancel-total-unidad');if(u)u.value=data.total.unidad||'hrs';}
  if(data.parcial){const btn=document.getElementById(prefix+'-cancel-parcial-btn');const det=document.getElementById(prefix+'-cancel-parcial-detail');if(btn)btn.classList.add('on');if(det)det.style.display='flex';const t=document.getElementById(prefix+'-cancel-parcial-tiempo');if(t)t.value=data.parcial.tiempo||'';const u=document.getElementById(prefix+'-cancel-parcial-unidad');if(u)u.value=data.parcial.unidad||'hrs';const v=document.getElementById(prefix+'-cancel-parcial-valor');if(v)v.value=data.parcial.valor||'';}
}
function resetCancelacion(prefix) {
  ['total','parcial'].forEach(t=>{const btn=document.getElementById(prefix+'-cancel-'+t+'-btn');const det=document.getElementById(prefix+'-cancel-'+t+'-detail');if(btn)btn.classList.remove('on');if(det)det.style.display='none';});
  ['total-tiempo','parcial-tiempo','parcial-valor'].forEach(f=>{const el=document.getElementById(prefix+'-cancel-'+f);if(el)el.value='';});
  const wrap=document.getElementById(prefix+'-cancel-wrap'); if(wrap) wrap.style.outline='';
}

function toggleMod(btn, hiddenId) {
  const group=btn.closest('.toggle-group');
  const isExclusive=hiddenId.includes('tipo');
  if(isExclusive){ group.querySelectorAll('.toggle-btn').forEach(b=>b.classList.remove('on')); btn.classList.add('on'); }
  else { btn.classList.toggle('on'); }
  const selected=[...group.querySelectorAll('.toggle-btn.on')].map(b=>b.textContent).join(' / ');
  document.getElementById(hiddenId).value=selected;
  if(selected) group.style.outline='';
}

function previewProgBgColor(val, formId) {
  const panel = document.getElementById(formId);
  if(panel) panel.style.background = val;
}

function previewSesColor(val) { if(editingSesionRow) editingSesionRow.style.background=val; }
function previewProgColor(val) { if(editingProgRow) editingProgRow.style.background=val; }

function guardarSesion() {
  const nombre=document.getElementById('ses-nombre').value.trim();
  const duracion=document.getElementById('ses-duracion').value.trim();
  const precio=document.getElementById('ses-precio').value.trim();
  const mod=document.getElementById('ses-mod').value.trim();
  const cancelacion=readCancelacion('ses');
  const invalids=[['ses-nombre',!nombre],['ses-duracion',!duracion],['ses-precio',!precio]];
  let hasError=false;
  invalids.forEach(([id,bad])=>{const el=document.getElementById(id);el.style.borderColor=bad?'#ef4444':'';if(bad) hasError=true;});
  const _sesModGroup=document.getElementById('ses-mod')?.closest('.form-group')?.querySelector('.toggle-group');
  if(!mod){hasError=true;if(_sesModGroup)_sesModGroup.style.outline='2px solid #ef4444';}else{if(_sesModGroup)_sesModGroup.style.outline='';}
  const _sesCW=document.getElementById('ses-cancel-wrap');
  if(!cancelacion.total&&!cancelacion.parcial){hasError=true;if(_sesCW)_sesCW.style.outline='2px solid #ef4444';}else{if(_sesCW)_sesCW.style.outline='';}
  if(hasError) return;
  const color=document.getElementById('ses-color').value;
  const meta=`${duracion} min · ${mod}`;
  const innerHTML=`<span class="svc-dot" style="background:${color}"></span><div style="flex:1"><div class="svc-name">${nombre}</div><div class="svc-meta">${meta}</div></div><span class="svc-price">${precio}</span><button class="btn-secondary btn-sm" style="margin-left:10px" onclick="editarSesion(this)"><i class="fas fa-pen"></i></button><button class="btn-icon" style="margin-left:2px;color:#ef4444" onclick="ppDeleteServicio(this)"><i class="fas fa-trash"></i></button>`;
  const _ppSvcPayload={profile_type:'empresa',nombre,duracion,precio,mod,desc:document.getElementById('ses-desc')?.value.trim()||'',color,cancelacion,meta};
  const _ppSvcEditId=editingSesionRow?.dataset?.ppId;
  if(editingSesionRow){editingSesionRow.innerHTML=innerHTML;editingSesionRow.style.background=color;editingSesionRow.dataset.cancelacion=JSON.stringify(cancelacion);editingSesionRow=null;}
  else{const row=document.createElement('div');row.className='svc-row';row.style.background=color;row.innerHTML=innerHTML;row.dataset.cancelacion=JSON.stringify(cancelacion);document.getElementById('svc-list').appendChild(row);if(typeof apiCall!=='undefined')apiCall('/api/perfil-profesional/servicios',{method:'POST',body:JSON.stringify(_ppSvcPayload)}).then(r=>r.json()).then(d=>{if(d.success&&d.servicio)row.dataset.ppId=d.servicio.id;}).catch(()=>{});}
  if(_ppSvcEditId&&typeof apiCall!=='undefined')apiCall('/api/perfil-profesional/servicios/'+_ppSvcEditId,{method:'PUT',body:JSON.stringify(_ppSvcPayload)}).catch(()=>{});
  ['ses-nombre','ses-duracion','ses-precio','ses-desc'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('ses-mod').value='';
  document.querySelectorAll('#form-sesion .toggle-btn').forEach(b=>b.classList.remove('on'));
  resetCancelacion('ses');
  document.getElementById('form-sesion-title').innerHTML='<i class="fas fa-clock" style="margin-right:6px"></i>Crea tu servicio';
  document.getElementById('btn-guardar-sesion').innerHTML='<i class="fas fa-check" style="margin-right:5px"></i>Guardar';
  toggleForm('form-sesion');
  syncServicios();
}

function prevProgImg(input) {
  if(!input.files[0]) return;
  const file = input.files[0];
  if(!_epCheckSize(file, input)) return;
  const nameEl = document.getElementById('prog-img-name');
  const reader = new FileReader();
  reader.onload = e => {
    progImgData = e.target.result;
    document.getElementById('prog-img-thumb').src = progImgData;
    document.getElementById('prog-img-preview').style.display = 'block';
    if(nameEl) nameEl.textContent = file.name + ' — subiendo…';
  };
  reader.readAsDataURL(file);
  ppUploadImage(file, 'perfil_profesional_programas').then(url => {
    if(!url) { if(nameEl) nameEl.textContent = file.name; return; }
    progImgData = url;
    document.getElementById('prog-img-thumb').src = url;
    if(nameEl) nameEl.textContent = file.name + ' ✓';
  });
}
function clearProgImg() {
  progImgData='';
  document.getElementById('prog-img-input').value='';
  document.getElementById('prog-img-name').textContent='Seleccionar imagen…';
  document.getElementById('prog-img-preview').style.display='none';
  document.getElementById('prog-img-thumb').src='';
}

function guardarPrograma() {
  const nombre=document.getElementById('prog-nombre').value.trim();
  const encuentros=document.getElementById('prog-encuentros').value.trim();
  const duracion=document.getElementById('prog-duracion').value.trim();
  const durUnidad=document.getElementById('prog-duracion-unidad')?.value||'min';
  const frecuencia=document.getElementById('prog-frecuencia')?.value||'';
  const precio=document.getElementById('prog-precio').value.trim();
  const precioTipo=getPrecioTipo('prog');
  const progTipo=getProgTipo('prog');
  const mod=document.getElementById('prog-mod').value.trim();
  const desc=document.getElementById('prog-desc')?.value.trim()||'';
  const modulos=readModulos('prog');
  const includes=readIncludes('prog');
  const requisitos=readRequisitos('prog');
  const galeria=readGaleria('prog');
  const galeriaOri=readGaleriaOri('prog');
  const testimonios=readTestimonios('prog');
  const cupos=document.getElementById('prog-cupos')?.value.trim()||'';
  const mostrarCupos=document.getElementById('prog-mostrar-cupos')?.checked?'1':'0';
  const mediaTipoImg = document.getElementById('prog-media-tab-img')?.classList.contains('on');
  const media = mediaTipoImg
    ? (progMediaData ? { tipo:'imagen', src:progMediaData } : null)
    : (progVideoURL ? { tipo:'video_file', src:progVideoURL } : null);
  const color=document.getElementById('prog-color').value;
  const bgColor=document.getElementById('prog-bg-color')?.value||'#F7F8FC';
  const colorNavy=document.getElementById('prog-color-navy')?.value||'#7E9DD6';
  const colorText=document.getElementById('prog-color-text')?.value||'#333333';
  const colorTextLt=document.getElementById('prog-color-text-lt')?.value||'#6B7194';
  const btnStart=document.getElementById('prog-color-btn-start')?.value||'#9497F4';
  const btnEnd=document.getElementById('prog-color-btn-end')?.value||'#89B9F8';
  const cardOpacity=parseFloat(document.getElementById('prog-card-opacity')?.value||'72')/100;
  const tituloFont=document.getElementById('prog-titulo-font')?.value||'DM Sans';
  const tituloSize=document.getElementById('prog-titulo-size')?.value||'36';
  const imgPosition=_heroImgPosition['prog']||{x:50,y:50};
  const cancelacion=readCancelacion('prog');
  const _labels={'prog-nombre':'Nombre del programa','prog-encuentros':'N° de encuentros','prog-duracion':'Duración','prog-precio':'Precio','prog-cupos':'Cupos'};
  const invalids=[['prog-nombre',!nombre],['prog-encuentros',!encuentros],['prog-precio',!precio],['prog-cupos',!cupos]];
  let hasError=false; const faltantes=[];
  invalids.forEach(([id,bad])=>{const el=document.getElementById(id);if(el){el.style.borderColor=bad?'#ef4444':'';if(bad){hasError=true;faltantes.push(_labels[id]);}}});
  const _durWrap=document.getElementById('prog-duracion-wrap');
  if(_durWrap) _durWrap.style.borderColor=!duracion?'#ef4444':'';
  if(!duracion){hasError=true;faltantes.push(_labels['prog-duracion']);}
  const _modGroup=document.getElementById('prog-mod')?.closest('.form-group')?.querySelector('.toggle-group');
  if(!mod){hasError=true;faltantes.push('Modalidad');if(_modGroup)_modGroup.style.outline='2px solid #ef4444';}
  else{if(_modGroup)_modGroup.style.outline='';}
  const _progCW=document.getElementById('prog-cancel-wrap');
  if(!cancelacion.total&&!cancelacion.parcial){hasError=true;faltantes.push('Política de cancelación');if(_progCW)_progCW.style.outline='2px solid #ef4444';}else{if(_progCW)_progCW.style.outline='';}
  if(hasError){cfgToast('Completa los campos: '+faltantes.join(', '),'#ef4444');return;}
  const _fLabels={'diaria':'Diaria','lunes_viernes':'Lun-Vie','fines_semana':'Fin de semana','1_semana':'1 vez/sem','2_semana':'2 veces/sem','3_semana':'3 veces/sem','quincenal':'Quincenal','mensual':'Mensual'};
  const _uLabels={'min':'min','hr':'hr','dia':'día(s)','sem':'sem','mes':'mes(es)'};
  const fLabel=frecuencia?_fLabels[frecuencia]||frecuencia:'';
  const durStr=duracion?(duracion+' '+(_uLabels[durUnidad]||durUnidad)):'';
  const meta=`${encuentros} encuentros de ${durStr}${fLabel?' · '+fLabel:''} · ${mod}`;
  const imgHTML=progImgData?`<img src="${progImgData}" style="width:44px;height:44px;object-fit:cover;border-radius:8px;flex-shrink:0;margin-right:2px">`:'';
  const innerHTML=`${imgHTML}<span class="svc-dot" style="background:${color}"></span><div style="flex:1"><div class="svc-name">${nombre}</div><div class="svc-meta">${meta}</div></div><span class="svc-price">${precio}</span><button class="btn-secondary btn-sm" style="margin-left:10px" onclick="editarPrograma(this)"><i class="fas fa-pen"></i></button><button class="btn-icon" style="margin-left:2px;color:#ef4444" onclick="ppDeletePrograma(this)"><i class="fas fa-trash"></i></button>`;
  const _ppPayload={profile_type:'empresa',nombre,tipo:progTipo,desc,precio,precioTipo,mod,encuentros,duracion,duracion_unidad:durUnidad,frecuencia,cupos,mostrarCupos:mostrarCupos==='1',color,bgColor,colorNavy,colorText,colorTextLt,btnStart,btnEnd,cardOpacity,tituloFont,tituloSize,cancelacion,imgPosition,modulos,includes,requisitos,galeria,galeriaOri,media,meta};
  const _ppEditId=editingProgRow?.dataset?.ppId;
  if(editingProgRow){editingProgRow.innerHTML=innerHTML;editingProgRow.style.background=color;editingProgRow.dataset.desc=desc;editingProgRow.dataset.tipo=progTipo;editingProgRow.dataset.precioTipo=precioTipo;editingProgRow.dataset.bgColor=bgColor;editingProgRow.dataset.colorNavy=colorNavy;editingProgRow.dataset.colorText=colorText;editingProgRow.dataset.colorTextLt=colorTextLt;editingProgRow.dataset.btnStart=btnStart;editingProgRow.dataset.btnEnd=btnEnd;editingProgRow.dataset.cardOpacity=cardOpacity;editingProgRow.dataset.tituloFont=tituloFont;editingProgRow.dataset.tituloSize=tituloSize;editingProgRow.dataset.cancelacion=JSON.stringify(cancelacion);editingProgRow.dataset.imgPosition=JSON.stringify(imgPosition);editingProgRow.dataset.modulos=JSON.stringify(modulos);editingProgRow.dataset.includes=JSON.stringify(includes);editingProgRow.dataset.requisitos=JSON.stringify(requisitos);editingProgRow.dataset.galeria=JSON.stringify(galeria);editingProgRow.dataset.galeriaOri=galeriaOri;editingProgRow.dataset.testimonios=JSON.stringify(testimonios);editingProgRow.dataset.cupos=cupos;editingProgRow.dataset.mostrarCupos=mostrarCupos;editingProgRow.dataset.media=JSON.stringify(media||null);editingProgRow=null;}
  else{const row=document.createElement('div');row.className='svc-row';row.style.background=color;row.innerHTML=innerHTML;row.dataset.desc=desc;row.dataset.tipo=progTipo;row.dataset.precioTipo=precioTipo;row.dataset.bgColor=bgColor;row.dataset.colorNavy=colorNavy;row.dataset.colorText=colorText;row.dataset.colorTextLt=colorTextLt;row.dataset.btnStart=btnStart;row.dataset.btnEnd=btnEnd;row.dataset.cardOpacity=cardOpacity;row.dataset.tituloFont=tituloFont;row.dataset.tituloSize=tituloSize;row.dataset.cancelacion=JSON.stringify(cancelacion);row.dataset.imgPosition=JSON.stringify(imgPosition);row.dataset.modulos=JSON.stringify(modulos);row.dataset.includes=JSON.stringify(includes);row.dataset.requisitos=JSON.stringify(requisitos);row.dataset.galeria=JSON.stringify(galeria);row.dataset.galeriaOri=galeriaOri;row.dataset.testimonios=JSON.stringify(testimonios);row.dataset.cupos=cupos;row.dataset.mostrarCupos=mostrarCupos;row.dataset.media=JSON.stringify(media||null);document.getElementById('prog-list').appendChild(row);if(typeof apiCall!=='undefined')apiCall('/api/perfil-profesional/programas',{method:'POST',body:JSON.stringify(_ppPayload)}).then(r=>r.json()).then(d=>{if(d.success&&d.programa)row.dataset.ppId=d.programa.id;}).catch(()=>{});}
  if(_ppEditId&&typeof apiCall!=='undefined')apiCall('/api/perfil-profesional/programas/'+_ppEditId,{method:'PUT',body:JSON.stringify(_ppPayload)}).catch(()=>{});
  ['prog-nombre','prog-encuentros','prog-duracion','prog-precio','prog-frecuencia'].forEach(id=>{const el=document.getElementById(id);if(el) el.value='';});
  const pdu=document.getElementById('prog-duracion-unidad'); if(pdu) pdu.value='min';
  document.getElementById('prog-desc').value='';
  document.getElementById('prog-mod').value='';
  document.querySelectorAll('#form-programa .toggle-btn').forEach(b=>b.classList.remove('on'));
  setPrecioTipo('prog','total');
  resetProgTipo('prog');
  document.getElementById('form-programa-title').innerHTML='<i class="fas fa-layer-group" style="margin-right:6px"></i>Nuevo programa';
  document.getElementById('btn-guardar-programa').innerHTML='<i class="fas fa-check" style="margin-right:5px"></i>Guardar programa';
  resetCancelacion('prog'); clearProgImg(); resetProgTipo('prog'); closeProgPreview(); toggleForm('form-programa'); syncProgramas();
}

function syncProgramas() {
  const rows=document.querySelectorAll('#prog-list .svc-row');
  const _empNombre = document.getElementById('empresa-nombre')?.value||'Mi empresa';
  const _empFoto = localStorage.getItem('ep_foto') || '';
  const _empCreador = { tipo:'empresa', nombre:_empNombre, foto:_empFoto, experiencia:document.getElementById('esp-exp')?.value||'', especialidad:[...document.querySelectorAll('#sum-esp-chips .spec-tag')].map(t=>t.textContent.trim()).filter(Boolean).join(', ') };
  const programas=[...rows].map(row=>({nombre:row.querySelector('.svc-name')?.textContent.trim()||'',tipo:row.dataset.tipo||'',color:row.querySelector('.svc-dot')?.style.background||'',bgColor:row.dataset.bgColor||'#F7F8FC',colorNavy:row.dataset.colorNavy||'#7E9DD6',colorText:row.dataset.colorText||'#333333',colorTextLt:row.dataset.colorTextLt||'#6B7194',btnStart:row.dataset.btnStart||'#9497F4',btnEnd:row.dataset.btnEnd||'#89B9F8',cardOpacity:parseFloat(row.dataset.cardOpacity||'0.72'),tituloFont:row.dataset.tituloFont||'DM Sans',tituloSize:row.dataset.tituloSize||'36',cancelacion:JSON.parse(row.dataset.cancelacion||'null'),imgPosition:JSON.parse(row.dataset.imgPosition||'{"x":50,"y":50}'),img:row.querySelector('img')?.src||'',meta:row.querySelector('.svc-meta')?.textContent.trim()||'',precio:row.querySelector('.svc-price')?.textContent.trim()||'',precioTipo:row.dataset.precioTipo||'total',desc:row.dataset.desc||'',modulos:JSON.parse(row.dataset.modulos||'[]'),includes:JSON.parse(row.dataset.includes||'[]'),requisitos:JSON.parse(row.dataset.requisitos||'[]'),galeria:JSON.parse(row.dataset.galeria||'[]'),galeriaOri:row.dataset.galeriaOri||'h',testimonios:JSON.parse(row.dataset.testimonios||'[]'),cupos:row.dataset.cupos||'',mostrarCupos:row.dataset.mostrarCupos==='1',media:JSON.parse(row.dataset.media||'null'),creador:_empCreador}));
  pmSend({type:'programas',value:programas});
  localStorage.setItem('ep_programas',JSON.stringify(programas));
}

function syncServicios() {
  const rows=document.querySelectorAll('#svc-list .svc-row');
  const servicios=[...rows].map(row=>({nombre:row.querySelector('.svc-name')?.textContent.trim()||'',meta:row.querySelector('.svc-meta')?.textContent.trim()||'',precio:row.querySelector('.svc-price')?.textContent.trim()||'',cancelacion:JSON.parse(row.dataset.cancelacion||'null')}));
  pmSend({type:'servicios',value:servicios});
  localStorage.setItem('ep_servicios',JSON.stringify(servicios));
}

function syncEspecialidades() {
  const container=document.getElementById('spec-tags-container');
  const tags=[...container.querySelectorAll('.spec-tag')].map(tag=>{const c=tag.cloneNode(true);c.querySelectorAll('.spec-x').forEach(x=>x.remove());return c.textContent.trim();}).filter(t=>t.length>0);
  pmSend({type:'especialidades',value:tags.join(', ')});
  localStorage.setItem('ep_especialidades',tags.join(', '));
  const sumChips=document.getElementById('sum-esp-chips');
  if(sumChips) sumChips.innerHTML=tags.map(t=>`<span class="spec-tag">${t}</span>`).join('');
  const exp=document.getElementById('esp-exp')?.value||'0';
  const sumExp=document.getElementById('sum-exp');
  if(sumExp) sumExp.innerHTML=`<i class="fas fa-star" style="margin-right:4px;color:#f59e0b"></i>${exp} año${exp==1?'':'s'} de experiencia`;
  const todosLosModos=[...document.querySelectorAll('#editp-esp .toggle-group .toggle-btn')].map(b=>({nombre:b.textContent.trim(),activo:b.classList.contains('on')}));
  const sumModos=document.getElementById('sum-modos-trabajo');
  if(sumModos) sumModos.innerHTML=todosLosModos.map(m=>`<div style="font-size:12px;color:${m.activo?'#10b981':'#9ca3af'}"><i class="fas fa-${m.activo?'check':'times'}" style="margin-right:4px"></i>${m.nombre}</div>`).join('');
  const modosActivos=todosLosModos.filter(m=>m.activo).map(m=>m.nombre);
  pmSend({type:'modos',value:modosActivos});
  localStorage.setItem('ep_modos',JSON.stringify(modosActivos));
}

function removeSpec(el) { el.closest('.spec-tag').remove(); }
function addSpec() {
  const input=document.querySelector('#editp-esp input[placeholder]');
  const val=input?input.value.trim():'';
  if(!val) return;
  const container=document.getElementById('spec-tags-container');
  const span=document.createElement('span'); span.className='spec-tag';
  span.innerHTML=`${val} <span class="spec-x" onclick="removeSpec(this)">✕</span>`;
  container.appendChild(span);
  if(input) input.value='';
}

// ── PREVIEW IFRAME ──
function togglePreview() {
  const panel=document.getElementById('cfg-preview-panel')||document.getElementById('preview-panel');
  const btn=document.getElementById('preview-toggle-btn');
  const icon=document.getElementById('preview-toggle-icon');
  const backdrop=document.getElementById('preview-backdrop');
  const isMobile=window.innerWidth<=768;
  const panelW=Math.min(window.innerWidth*0.85,360);
  const collapsed=panel.classList.toggle('preview-collapsed');
  if(collapsed){
    if(btn) btn.style.right='0px';
    if(icon) icon.className='fas fa-chevron-left';
    if(isMobile&&backdrop) backdrop.classList.remove('open');
  } else {
    if(btn) btn.style.right=panelW+'px';
    if(icon) icon.className='fas fa-chevron-right';
    if(isMobile&&backdrop) backdrop.classList.add('open');
    setTimeout(scaleIframe,320);
  }
}

function scaleIframe() {
  const iframe=document.getElementById('perfil-iframe');
  if(!iframe) return;
  const wrap=iframe.parentElement;
  const scale=wrap.offsetWidth/1200;
  let contentH=2000;
  try{contentH=iframe.contentDocument.documentElement.scrollHeight||contentH;}catch(e){}
  iframe.style.width='1200px';
  iframe.style.height=contentH+'px';
  iframe.style.transform=`scale(${scale})`;
  iframe.style.marginBottom=`-${Math.round(contentH*(1-scale))}px`;
  const trigger=document.getElementById('lupa-trigger');
  if(trigger) trigger.style.top=Math.round(420*scale)+'px';
}

let profesionalSeleccionado = null;

async function buscarProfesional(query) {
  const box = document.getElementById('db-suggestions');
  if (!query || query.length < 2) { box.style.display = 'none'; setProfSeleccionado(null); return; }
  if (typeof apiCall === 'undefined') return;
  try {
    const res = await apiCall(`/api/users/search?q=${encodeURIComponent(query)}&limit=8`);
    if (!res.ok || !res.data?.users?.length) { box.style.display = 'none'; return; }
    box.innerHTML = res.data.users.map(u => {
      const nombre = u.full_name || [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username || u.email || '';
      const i1 = (nombre[0] || '?').toUpperCase();
      const i2 = (nombre.split(' ')[1]?.[0] || '').toUpperCase();
      const encoded = JSON.stringify(u).replace(/"/g, '&quot;');
      return `<div onclick="seleccionarProfesional(${encoded})" style="padding:10px 14px;cursor:pointer;display:flex;align-items:center;gap:10px;border-bottom:0.5px solid #f0f2ff;transition:background .15s" onmouseover="this.style.background='#f5f3ff'" onmouseout="this.style.background=''"><div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#9961FF,#5b8dee);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff;flex-shrink:0">${i1}${i2}</div><div><div style="font-size:12px;font-weight:600;color:#3b4a6b">${nombre}</div><div style="font-size:11px;color:#7D84C1">${u.email||''}</div></div></div>`;
    }).join('');
    box.style.display = 'block';
  } catch(e) { box.style.display = 'none'; }
}

function seleccionarProfesional(p) {
  const nombre = p.full_name || [p.first_name, p.last_name].filter(Boolean).join(' ') || p.username || p.email || '';
  const inp = document.getElementById('add-q');
  if (inp) inp.value = nombre;
  document.getElementById('db-suggestions').style.display = 'none';
  setProfSeleccionado(p);
}

function setProfSeleccionado(p) {
  profesionalSeleccionado=p;
  const btn=document.getElementById('btn-agregar-equipo');
  if(!btn) return;
  if(p){btn.disabled=false;btn.style.opacity='1';btn.style.cursor='pointer';}
  else{btn.disabled=true;btn.style.opacity='0.5';btn.style.cursor='not-allowed';}
}

async function agregarAlEquipo() {
  if (!profesionalSeleccionado) return;
  const p = profesionalSeleccionado;
  const rol = document.getElementById('add-rol')?.value || p.role || p.rol || 'terapeuta';
  const recurso = 'si';
  const rolLabel = rol ? (rol.charAt(0).toUpperCase() + rol.slice(1)) : 'Terapeuta';
  const recursoLabel = recurso === 'no' ? 'No' : 'Sí';
  const recursoClass = recurso === 'no' ? 'b-inactive' : 'b-active';
  const nombre = p.full_name || [p.first_name, p.last_name].filter(Boolean).join(' ') || p.username || p.email || '';
  const email = p.email || '';
  const initials = nombre.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '??';
  const username = p.username || email;
  const userId = p._id || p.id;

  const row = `<tr data-name="${nombre.toLowerCase()}" data-email="${email}" data-rol="${rol}" data-estado="activo" data-recurso="${recurso}">
    <td><div class="user-cell"><div class="avatar">${initials}</div><div><div style="font-weight:600;font-size:12px">${nombre}</div><div style="font-size:10px;color:#7D84C1">${username}</div></div></div></td>
    <td>${email}</td>
    <td><span class="badge b-resource">${rolLabel}</span></td>
    <td><span class="badge ${recursoClass}">${recursoLabel}</span></td>
    <td>Heavensy</td>
    <td><label class="switch"><input type="checkbox" checked onchange="recalcStats()"><span class="slider"></span></label></td>
    <td style="white-space:nowrap"><button class="btn-icon" title="Editar" style="color:#5b8dee"><i class="fas fa-pen"></i></button><button class="btn-icon" title="Eliminar" style="color:#9ca3af" onclick="cfgDeleteUser('${userId||username}',this.closest('tr'))"><i class="fas fa-trash"></i></button></td>
  </tr>`;
  document.getElementById('users-tbody').insertAdjacentHTML('beforeend', row);
  recalcStats(); setProfSeleccionado(null);
  const addQ = document.getElementById('add-q');
  if (addQ) addQ.value = '';
  toggleAddMember();

  if (userId && typeof apiCall !== 'undefined') {
    const companyId = localStorage.getItem('company_id');
    apiCall(`/api/companies/${companyId}/users/${userId}`, {
      method: 'POST',
      body: JSON.stringify({ roles: [rol.toUpperCase() + '_ROL'] }),
    }).catch(() => {});
  }
}

// Cerrar sugerencias al hacer clic fuera
document.addEventListener('click', function(e) {
  if(!e.target.closest('#f-q')&&!e.target.closest('#db-suggestions')){
    const box=document.getElementById('db-suggestions');
    if(box) box.style.display='none';
  }
});

// ── INIT PAGE (llamado por el router del SPA) ──
function initConfiguracionPage() {
  cfgCurrentStep = 0;
  cfgDoneSteps.clear();

  // Asegurar paso 0 activo
  document.querySelectorAll('.step-panel').forEach((p,i) => p.classList.toggle('active', i===0));
  document.querySelectorAll('.step').forEach((s,i) => s.className='step'+(i===0?' active':''));
  document.querySelectorAll('.step-line').forEach(l => l.classList.remove('done'));

  // Limpiar caché de datos dinámicos para que no persistan de sesiones anteriores
  ['ep_programas','ep_servicios','ep_horario','ep_modos','ep_especialidades','ep_equipo_prof','ep_inf_oficio'].forEach(k => localStorage.removeItem(k));

  // Setear defaults ANTES de que el iframe cargue (si no hay config guardada del servidor)
  const PORTADA_DEFAULT = '../assets/img/dise%C3%B1o%20final%20portada%20para%20todos.png';
  const FONDO_DEFAULT   = '../assets/img/fondoperfilprofesional.jpg.jpeg';
  const FOTO_DEFAULT = '../assets/img/foto%20perfil%20por%20defecto%20empresa.jpeg';
  if (!localStorage.getItem('ep_portada_saved')) localStorage.setItem('ep_portada', PORTADA_DEFAULT);
  if (!localStorage.getItem('ep_fondo_saved'))   localStorage.setItem('ep_fondo',   FONDO_DEFAULT);
  if (!localStorage.getItem('ep_foto_saved'))    localStorage.setItem('ep_foto',    FOTO_DEFAULT);

  // Colores por defecto
  const _colorDefaults = {
    '--text-titulo': '#333333',
    '--titulo-bg':   '#5362c7',
    '--text-lt':     '#ffffff',
    '--text-franja': '#ffffff',
    '--navy':        '#172838',
  };
  Object.entries(_colorDefaults).forEach(([k, v]) => {
    if (!localStorage.getItem('ep_colores_saved')) localStorage.setItem('ep_color_' + k, v);
  });
  if (!localStorage.getItem('ep_colores_saved')) localStorage.setItem('ep_opacidad', '45');

  // Frase por defecto
  const FRASE_DEFAULT = 'Bendecido sea tu camino, y que toda bendición que se te dé rebose también para los demás';
  if (!localStorage.getItem('ep_frase_saved')) {
    localStorage.setItem('ep_texto_frase', FRASE_DEFAULT);
  }

  // Nombre por defecto
  if (!localStorage.getItem('ep_nombre_empresa')) {
    localStorage.setItem('ep_nombre_empresa', 'Nombre de tu negocio');
  }

  // Iniciar iframe de preview
  const iframe = document.getElementById('perfil-iframe');
  if(iframe) {
    iframe.addEventListener('load', () => {
      scaleIframe();
      setTimeout(() => { syncServicios(); syncProgramas(); syncEspecialidades(); }, 150);
      // Aplicar config visual (colores + imágenes)
      setTimeout(() => ppLoadFromServer(), 200);
    });
    window.addEventListener('resize', scaleIframe);
    requestAnimationFrame(scaleIframe);
  }

  // Preview toggle btn posición mobile
  if(window.innerWidth<=768) {
    const btn=document.getElementById('preview-toggle-btn');
    if(btn) btn.style.right=Math.min(window.innerWidth*0.85,360)+'px';
  }

  // Precargar frase por defecto en el textarea si no hay guardada
  if (!localStorage.getItem('ep_frase_saved')) {
    const fraseEl = document.getElementById('ep-frase');
    const FRASE_DEFAULT = 'Bendecido sea tu camino, y que toda bendición que se te dé rebose también para los demás';
    if (fraseEl && !fraseEl.value) {
      fraseEl.value = FRASE_DEFAULT;
      const cnt = document.getElementById('cnt-frase');
      if (cnt) cnt.textContent = FRASE_DEFAULT.length + '/240';
    }
  }

  // Cargar datos desde el backend
  cfgLoadFromBackend();

  // Listeners de coherencia duración-frecuencia
  initFrecuenciaListeners();
}

// ══════════════════════════════════════
//  CARGA DESDE BACKEND
// ══════════════════════════════════════
async function cfgLoadFromBackend() {
  try {
    // 1. Nombre de empresa
    const profileRes = await apiCall('/api/me/company/profile');
    if (profileRes.ok && profileRes.data) {
      const nombre = profileRes.data.name || profileRes.data.company_id || '';
      const el = document.getElementById('empresa-nombre');
      if (el && nombre) { el.value = nombre; pmSend({type:'nombre_empresa', value:nombre}); }
    }

    // 2. Usuarios del sistema + recursos de agenda → tabla de equipo
    const companyId = localStorage.getItem('company_id');
    const [usersRes, resourcesRes] = await Promise.all([
      companyId ? apiCall(`/api/companies/${companyId}/users`) : Promise.resolve({ ok: false }),
      apiCall('/api/agenda/resources')
    ]);

    const systemUsers  = (usersRes.ok && usersRes.data?.users)     ? usersRes.data.users         : [];
    const resources    = (resourcesRes.ok && resourcesRes.data?.resources) ? resourcesRes.data.resources : [];

    if (systemUsers.length || resources.length) {
      cfgPopulateUsersTable(systemUsers, resources);
    }

    // 3. Recursos → horario + especialidades + servicios (primer recurso)
    if (resources.length) {
      const resource = resources[0];
      _cfgFirstResourceId = resource._id || resource.id || null;
      cfgPopulateSchedule(resource);
      cfgPopulateSpecialties(resource);

      const svcRes = await apiCall(`/api/agenda/resources/${resource._id}/services`);
      if (svcRes.ok && svcRes.data?.services?.length) {
        cfgPopulateServices(svcRes.data.services);
      }
    }
  } catch(e) {
    console.warn('[Configuración] Error cargando desde backend', e);
  }
}

function cfgPopulateUsersTable(systemUsers = [], resources = []) {
  const tbody = document.getElementById('users-tbody');
  const countEl = document.getElementById('user-count');
  if (!tbody) return;

  // Construir filas desde usuarios del sistema
  const userRows = systemUsers.map(u => {
    const nombre = u.full_name || u.username || u.email || '—';
    const initials = nombre.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
    const email = u.email || '—';
    const rol = u.role || u.rol || 'usuario';
    const rolLabel = rol.charAt(0).toUpperCase() + rol.slice(1);
    const esRecurso = u.is_resource ? 'Sí' : 'No';
    const recursoClass = u.is_resource ? 'b-active' : 'b-inactive';
    const activo = u.is_active !== false;
    return `<tr data-name="${nombre.toLowerCase()}" data-email="${email}" data-rol="${rol}" data-estado="${activo?'activo':'inactivo'}" data-recurso="${u.is_resource?'si':'no'}">
      <td><div class="user-cell"><div class="avatar">${initials}</div><div><div style="font-weight:600;font-size:12px">${nombre}</div><div style="font-size:10px;color:#7D84C1">${u.username||''}</div></div></div></td>
      <td>${email}</td>
      <td><span class="badge b-resource">${rolLabel}</span></td>
      <td><span class="badge ${recursoClass}">${esRecurso}</span></td>
      <td>${u.company_name || 'Heavensy'}</td>
      <td><label class="switch"><input type="checkbox" ${activo?'checked':''} onchange="recalcStats()"><span class="slider"></span></label></td>
      <td style="white-space:nowrap"><button class="btn-icon" title="Editar" style="color:#5b8dee"><i class="fas fa-pen"></i></button><button class="btn-icon" title="Eliminar" style="color:#9ca3af" onclick="cfgDeleteUser('${u.username||u.email}',this.closest('tr'))"><i class="fas fa-trash"></i></button></td>
    </tr>`;
  });

  // Construir filas desde recursos (profesionales sin cuenta de sistema)
  const userIds = new Set(systemUsers.map(u => u.user_id || u._id).filter(Boolean));
  const filteredResources = resources.filter(r => !r.user_id || !userIds.has(r.user_id));

  // Guardar datos en mapa global para acceso desde onclick
  filteredResources.forEach(r => { _cfgResourceMap[r._id] = r; });

  const resourceRows = filteredResources.map(r => {
      const nombre = r.name || r.full_name || '—';
      const initials = nombre.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
      const specs = (r.specialties || r.especialidades || []).slice(0, 1).join('') || 'Profesional';
      return `<tr data-name="${nombre.toLowerCase()}" data-email="" data-rol="terapeuta" data-estado="activo" data-recurso="si">
        <td><div class="user-cell"><div class="avatar">${initials}</div><div><div style="font-weight:600;font-size:12px">${nombre}</div><div style="font-size:10px;color:#7D84C1">${specs}</div></div></div></td>
        <td>—</td>
        <td><span class="badge b-resource">Recurso</span></td>
        <td><span class="badge b-active">Sí</span></td>
        <td>Heavensy</td>
        <td><label class="switch"><input type="checkbox" checked onchange="recalcStats()"><span class="slider"></span></label></td>
        <td style="white-space:nowrap"><button class="btn-icon" title="Editar" style="color:#5b8dee" onclick="cfgOpenResourceEdit('${r._id}')"><i class="fas fa-pen"></i></button><button class="btn-icon" title="Eliminar" style="color:#9ca3af" onclick="cfgDeleteUser('${r._id}',this.closest('tr'))"><i class="fas fa-trash"></i></button></td>
      </tr>`;
    });

  tbody.innerHTML = [...userRows, ...resourceRows].join('');
  const total = userRows.length + resourceRows.length;
  if (countEl) countEl.textContent = total;
  recalcStats();
}

function cfgPopulateSchedule(resource) {
  const rules = resource.schedule_config || resource.schedule_rules || resource.scheduleRules || {};
  const set = (id, val) => { const el=document.getElementById(id); if(el && val!==undefined) el.value=val; };

  set('disp-inicio',      rules.start_time    || rules.startTime    || '09:00');
  set('disp-fin',         rules.end_time      || rules.endTime      || '18:00');
  set('disp-alm-desde',   rules.lunch_start   || rules.lunchStart   || '13:00');
  set('disp-alm-hasta',   rules.lunch_end     || rules.lunchEnd     || '14:00');
  set('disp-intervalo',   rules.slot_duration || rules.slotDuration || 15);
  set('disp-anticip',     rules.min_advance_hours || rules.minAdvanceHours || 2);
  set('disp-cancel-hrs',  rules.cancel_hours  || rules.cancelHours  || 48);
  set('disp-cancel-pct',  rules.cancel_pct    || rules.cancelPct    || 40);

  // Sincronizar al perfil
  syncHorario();
}

function cfgPopulateSpecialties(resource) {
  const specs = resource.specialties || resource.especialidades || [];
  if (!specs.length) return;

  const container = document.getElementById('spec-tags-container');
  if (!container) return;
  container.innerHTML = specs.map(s =>
    `<span class="spec-tag">${s} <span class="spec-x" onclick="removeSpec(this)">✕</span></span>`
  ).join('');

  syncEspecialidades();
}

// ── DELETE USER CONFIRM MODAL ──
let _cfgConfirmResolve = null;

function cfgConfirm(title, msg) {
  document.getElementById('cfg-confirm-title').textContent = title || '¿Eliminar miembro?';
  document.getElementById('cfg-confirm-msg').textContent = msg || 'Esta acción no se puede deshacer.';
  document.getElementById('cfg-confirm-overlay').classList.add('open');
  return new Promise(resolve => { _cfgConfirmResolve = resolve; });
}

function cfgConfirmAccept() {
  document.getElementById('cfg-confirm-overlay').classList.remove('open');
  if(_cfgConfirmResolve) { _cfgConfirmResolve(true); _cfgConfirmResolve = null; }
}

function cfgConfirmReject() {
  document.getElementById('cfg-confirm-overlay').classList.remove('open');
  if(_cfgConfirmResolve) { _cfgConfirmResolve(false); _cfgConfirmResolve = null; }
}

async function cfgDeleteUser(username, rowEl) {
  const nombre = rowEl?.querySelector('[style*="font-weight:600"]')?.textContent?.trim() || username;
  const ok = await cfgConfirm(
    '¿Eliminar miembro?',
    `Se eliminará a "${nombre}" del equipo. Esta acción no se puede deshacer.`
  );
  if(!ok) return;

  // Eliminación optimista: quitar la fila de inmediato
  const parent = rowEl.parentElement;
  const next = rowEl.nextSibling;
  rowEl.remove();
  recalcStats();

  try {
    const companyId = localStorage.getItem('company_id');
    await apiCall(`/api/companies/${companyId}/users/${username}`, { method: 'DELETE' });
  } catch(e) {
    // Revertir silenciosamente si el backend falla
    if(parent) parent.insertBefore(rowEl, next);
    recalcStats();
  }
}

function cfgPopulateServices(services) {
  const list = document.getElementById('svc-list');
  if (!list) return;

  const colors = ['#9961FF','#0ea5e9','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4'];
  list.innerHTML = services.map((s, i) => {
    const color = s.color || colors[i % colors.length];
    const precio = s.price ? `$${Number(s.price).toLocaleString('es-CL')} CLP` : '';
    const meta = `${s.duration || 0} min${s.modality ? ' · ' + s.modality : ''}`;
    return `<div class="svc-row" style="background:${color}">
      <span class="svc-dot" style="background:${color}"></span>
      <div style="flex:1">
        <div class="svc-name">${s.name}</div>
        <div class="svc-meta">${meta}</div>
      </div>
      <span class="svc-price">${precio}</span>
      <button class="btn-secondary btn-sm" style="margin-left:10px" onclick="editarSesion(this)"><i class="fas fa-pen"></i></button>
      <button class="btn-icon" style="margin-left:2px;color:#ef4444" onclick="this.closest('.svc-row').remove();syncServicios()"><i class="fas fa-trash"></i></button>
    </div>`;
  }).join('');

  syncServicios();
}

// ══════════════════════════════════════
//  EDITOR DE RECURSO — usa overlay existente #user-edit-overlay
// ══════════════════════════════════════

const _cfgResourceMap = {};
let _cfgCurrentResourceId = null;
let _cfgFirstResourceId   = null;

function cfgOpenResourceEdit(resourceId) {
  const r = _cfgResourceMap[resourceId];
  if (!r) return;

  _cfgCurrentResourceId = resourceId;

  // ── Info: nombre / apellido ──
  const nameParts = (r.name || '').trim().split(' ');
  const apellido  = nameParts.length > 1 ? nameParts.pop() : '';
  const nombre    = nameParts.join(' ');
  const jmNombre  = document.getElementById('jm-nombre');
  const jmApellido = document.getElementById('jm-apellido');
  if (jmNombre)   jmNombre.value   = nombre;
  if (jmApellido) jmApellido.value = apellido;

  // ── Ubicación ──
  const jmDir = document.getElementById('jm-direccion');
  if (jmDir) jmDir.value = r.location || r.address || '';

  // ── Descripción / slogan ──
  const jmFrase = document.getElementById('jm-frase');
  if (jmFrase) {
    jmFrase.value = r.slogan || r.description || '';
    const cnt = document.getElementById('jm-cnt-frase');
    if (cnt) cnt.textContent = jmFrase.value.length + '/240';
  }

  // ── Especialidades ──
  const container = document.getElementById('jm-spec-tags-container');
  if (container) {
    const specs = r.specialties || r.especialidades || [];
    container.innerHTML = specs.map(s =>
      `<span class="spec-tag">${s} <span class="spec-x" onclick="jmRemoveSpec(this)">✕</span></span>`
    ).join('');
  }

  // ── Modalidades (toggle buttons en panel 2) ──
  const mods = r.modalities || r.modalidades || [];
  const modMap = { presencial: 'Presencial', online: 'Online', domicilio: 'A domicilio' };
  document.querySelectorAll('#jm-panel-2 .toggle-btn').forEach(btn => {
    const txt = btn.textContent.trim();
    const on  = mods.some(m => modMap[m] === txt);
    btn.classList.toggle('on', on);
  });

  // ── Disponibilidad (si tiene reglas de horario) ──
  const rules = r.schedule_rules || r.scheduleRules || {};
  const setJm = (id, val) => { const el = document.getElementById(id); if (el && val !== undefined) el.value = val; };
  setJm('jm-disp-inicio',      rules.start_time    || '09:00');
  setJm('jm-disp-fin',         rules.end_time      || '18:00');
  setJm('jm-disp-alm-desde',   rules.lunch_start   || '13:00');
  setJm('jm-disp-alm-hasta',   rules.lunch_end     || '14:00');
  setJm('jm-disp-intervalo',   rules.slot_duration || 15);
  setJm('jm-disp-anticip',     rules.min_advance_hours || 2);
  setJm('jm-disp-cancel-hrs',  rules.cancel_hours  || 48);
  setJm('jm-disp-cancel-pct',  rules.cancel_pct    || 40);

  // ── Foto de perfil ──
  if (r.photo_url || r.avatar_url) {
    const url = r.photo_url || r.avatar_url;
    jmData.foto = url;
    const thumb   = document.getElementById('jm-foto-thumb');
    const preview = document.getElementById('jm-foto-preview');
    const nameEl  = document.getElementById('jm-foto-perfil-name');
    if (thumb)   thumb.src = url;
    if (preview) preview.style.display = 'block';
    if (nameEl)  nameEl.textContent = 'Foto cargada';
  }

  // Abrir overlay y posicionarse en tab 0
  toggleEdit('jm');
  const firstTab = document.querySelector('#user-edit-overlay .ue-tab');
  if (firstTab) jmTab(0, firstTab);
}

// Guarda el recurso en el backend — se llama desde jmGuardarProfesional
async function _cfgPatchCurrentResource() {
  const id = _cfgCurrentResourceId;
  if (!id) return;

  const nombre   = document.getElementById('jm-nombre')?.value.trim()   || '';
  const apellido = document.getElementById('jm-apellido')?.value.trim() || '';
  const fullName = [nombre, apellido].filter(Boolean).join(' ');

  const specs = [...document.querySelectorAll('#jm-spec-tags-container .spec-tag')]
    .map(t => { const c = t.cloneNode(true); c.querySelectorAll('.spec-x').forEach(x => x.remove()); return c.textContent.trim(); })
    .filter(Boolean);

  const modLabels = { 'Presencial': 'presencial', 'Online': 'online', 'A domicilio': 'domicilio' };
  const mods = [...document.querySelectorAll('#jm-panel-2 .toggle-btn.on')]
    .map(b => modLabels[b.textContent.trim()] || b.textContent.trim().toLowerCase())
    .filter(Boolean);

  const payload = {
    name:        fullName,
    slogan:      document.getElementById('jm-frase')?.value.trim() || '',
    specialties: specs,
    location:    document.getElementById('jm-direccion')?.value.trim() || '',
    modalities:  mods,
    ...(jmData.foto ? { photo_url: jmData.foto } : {}),
  };

  try {
    const res = await apiCall(`/api/agenda/resources/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
    if (res.ok) Object.assign(_cfgResourceMap[id], payload);
  } catch(e) {
    console.warn('[cfg] Error guardando recurso en backend', e);
  }
}

// ── LUPA GLASS ──
(function initLupaGlass() {
  const trigger = document.getElementById('lupa-trigger');
  const glass   = document.getElementById('lupa-glass');
  const zf      = document.getElementById('lupa-zoom-frame');
  if (!trigger || !glass || !zf) { setTimeout(initLupaGlass, 400); return; }

  const R    = 100;   // radio del círculo en px
  const ZOOM = 2.5;   // multiplicador de zoom vs preview

  let holding   = false;
  let holdTimer = null;

  function getScale() {
    const wrap = document.querySelector('.preview-scale-wrap');
    return wrap ? wrap.offsetWidth / 1200 : 1;
  }

  function moveLupa(clientX, clientY) {
    const s1   = getScale();
    const s2   = s1 * ZOOM;
    const wrap = document.querySelector('.preview-scale-wrap');
    const rect = wrap.getBoundingClientRect();
    // Coordenadas en el contenido (1200px layout)
    const cx = (clientX - rect.left) / s1;
    const cy = (clientY - rect.top)  / s1;
    // Un solo transform: primero traslada para centrar el punto, luego escala
    // translate hace que (cx,cy) quede en (0,0), luego scale lo amplía,
    // y el offset de R lo maneja la posición fija del glass
    zf.style.transform = `scale(${s2}) translate(${R/s2 - cx}px, ${R/s2 - cy}px)`;

    glass.style.left = (clientX - R) + 'px';
    glass.style.top  = (clientY - R) + 'px';
  }

  function startHold(clientX, clientY) {
    holdTimer = setTimeout(() => {
      holding = true;
      glass.style.display = 'block';
      trigger.style.cursor = 'none';
      moveLupa(clientX, clientY);
    }, 300);
  }

  function endHold() {
    clearTimeout(holdTimer);
    holdTimer = null;
    if (holding) {
      holding = false;
      glass.style.display = 'none';
      trigger.style.cursor = 'zoom-in';
    }
  }

  // Mouse
  trigger.addEventListener('mousedown', e => { startHold(e.clientX, e.clientY); });
  document.addEventListener('mouseup', endHold);
  document.addEventListener('mousemove', e => { if (holding) moveLupa(e.clientX, e.clientY); });

  // Touch
  trigger.addEventListener('touchstart', e => {
    const t = e.touches[0];
    startHold(t.clientX, t.clientY);
    e.preventDefault();
  }, { passive: false });
  document.addEventListener('touchend', endHold);
  trigger.addEventListener('touchmove', e => {
    if (holding) {
      moveLupa(e.touches[0].clientX, e.touches[0].clientY);
      e.preventDefault();
    } else {
      clearTimeout(holdTimer);
      holdTimer = null;
    }
  }, { passive: false });

  // Actualizar altura del zoom-frame al cargar
  zf.addEventListener('load', () => {
    try {
      const h = zf.contentDocument.documentElement.scrollHeight;
      if (h > 100) zf.style.height = h + 'px';
    } catch(e) {}
  });
})();
