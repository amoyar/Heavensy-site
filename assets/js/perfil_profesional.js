// ── MODO PREVIEW (solo desde configuración con ?cfg=1) ──
(function() {
  if (window.self === window.top) return;
  var isCfg = new URLSearchParams(window.location.search).get('cfg') === '1';
  if (!isCfg) return;
  document.documentElement.classList.add('in-preview');
  document.addEventListener('click', function(e) {
    var a = e.target.closest('a');
    if (a) { e.preventDefault(); e.stopPropagation(); }
  }, true);
  document.addEventListener('submit', function(e) { e.preventDefault(); }, true);
})();

// ── API PÚBLICA ──
const _PP_API_BASE = 'https://heavensy-api-backend-v2.onrender.com';
let _ppResourceId = '';
let _ppServices = [];

async function _ppFetch(path, params) {
  try {
    const url = new URL(_PP_API_BASE + path);
    if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    const token = localStorage.getItem('token');
    const headers = token ? { 'Authorization': 'Bearer ' + token } : {};
    const r = await fetch(url.toString(), { headers });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

const horasData = {
  'Psicoterapia':   ['10:00','11:00','12:30','15:00','16:00'],
  'Hipnosis Clínica':['10:30','13:00','14:30','17:00']
};
let diaSeleccionado = null;
let chipSeleccionado = 'Psicoterapia';

function selDia(el){
  document.querySelectorAll('.cal-day').forEach(d=>d.classList.remove('selected'));
  el.classList.add('selected');
  diaSeleccionado = el.dataset.date || el.textContent;
  document.getElementById('chips-wrap').style.display='block';
  mostrarHoras();
}
function selChip(el, nombre){
  document.querySelectorAll('.booking-chip').forEach(c=>c.classList.remove('activo'));
  el.classList.add('activo');
  chipSeleccionado = nombre;
  mostrarHoras();
}
function selHora(el){
  document.querySelectorAll('.hora-chip').forEach(h=>h.classList.remove('activo'));
  el.classList.add('activo');
  document.getElementById('btn-agendar').style.display='block';
}
async function mostrarHoras(){
  if(!diaSeleccionado) return;
  const grid = document.getElementById('horas-grid');
  const wrap = document.getElementById('horas-wrap');
  if(!grid || !wrap) return;
  if(_ppResourceId){
    const chip = document.querySelector('.booking-chip.activo');
    const svcId = chip?.dataset.svcId || '';
    if(!svcId){ grid.innerHTML='<span style="font-size:12px;color:var(--text-lt)">Selecciona un servicio</span>'; wrap.style.display='block'; return; }
    grid.innerHTML='<span style="font-size:12px;color:var(--text-lt)"><i class="fas fa-spinner fa-spin" style="margin-right:6px"></i>Cargando horas...</span>';
    wrap.style.display='block';
    document.getElementById('btn-agendar').style.display='none';
    const data = await _ppFetch(`/api/agenda/availability/${_ppResourceId}/${svcId}`, { date: diaSeleccionado });
    if(data?.slots?.length){
      grid.innerHTML = data.slots.map(s=>`<div class="hora-chip" onclick="selHora(this)">${s.start}</div>`).join('');
    } else {
      grid.innerHTML='<span style="font-size:12px;color:var(--text-lt)">Sin horas disponibles para este día</span>';
    }
  } else {
    const horas = horasData[chipSeleccionado] || [];
    grid.innerHTML = horas.map(h=>`<div class="hora-chip" onclick="selHora(this)">${h}</div>`).join('');
    wrap.style.display='block';
    document.getElementById('btn-agendar').style.display='none';
  }
}

function _ppBuildBookingChips(){
  const wrap = document.querySelector('.booking-chips');
  if(!wrap || !_ppServices.length) return;
  wrap.innerHTML = _ppServices.map((s,i)=>{
    const name = s.nombre || s.name || '';
    const id   = s._id   || s.id  || '';
    return `<div class="booking-chip${i===0?' activo':''}" onclick="selChip(this,'${name.replace(/'/g,"\\'")}');" data-svc-id="${id}">${name}</div>`;
  }).join('');
  chipSeleccionado = _ppServices[0]?.nombre || _ppServices[0]?.name || '';
}

let _ppCalYear=0, _ppCalMonth=0;
function _ppRenderCalendar(year, month){
  _ppCalYear=year; _ppCalMonth=month;
  const MN=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const monthEl=document.querySelector('.cal-month');
  if(monthEl) monthEl.textContent=`${MN[month]} ${year}`;
  const daysInMonth=new Date(year,month+1,0).getDate();
  const firstDay=new Date(year,month,1).getDay();
  const today=new Date();
  const todayStr=`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  const grid=document.querySelector('.cal-grid');
  if(!grid) return;
  const headers=[...grid.querySelectorAll('.cal-day-name')];
  grid.innerHTML='';
  headers.forEach(h=>grid.appendChild(h));
  const offset=(firstDay===0)?6:firstDay-1;
  for(let i=0;i<offset;i++){ const e=document.createElement('div');e.className='cal-day empty';grid.appendChild(e); }
  for(let d=1;d<=daysInMonth;d++){
    const dateStr=`${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const el=document.createElement('div');
    el.className='cal-day';
    el.textContent=d;
    el.dataset.date=dateStr;
    if(dateStr===todayStr) el.classList.add('today');
    if(new Date(dateStr)<new Date(todayStr)){ el.style.opacity='.35'; el.style.cursor='default'; }
    else { el.classList.add('has-slot'); el.onclick=function(){selDia(this);}; }
    grid.appendChild(el);
  }
  const btns=document.querySelectorAll('.cal-nav button');
  if(btns[0]) btns[0].onclick=()=>{ const dt=new Date(year,month-1,1); _ppRenderCalendar(dt.getFullYear(),dt.getMonth()); };
  if(btns[1]) btns[1].onclick=()=>{ const dt=new Date(year,month+1,1); _ppRenderCalendar(dt.getFullYear(),dt.getMonth()); };
}

async function initPerfilPublico(){
  const urlParams=new URLSearchParams(window.location.search);
  const resourceId=urlParams.get('resource_id');
  if(!resourceId || document.documentElement.classList.contains('in-preview')) return;
  _ppResourceId=resourceId;

  // Resource data (nombre, foto, specs, modos, etc.)
  const resData = await _ppFetch(`/api/agenda/resources/${resourceId}`);
  const r = resData?.resource || resData || {};
  if(r.name||r.full_name){ const el=document.getElementById('profile-name'); if(el) el.textContent=r.name||r.full_name; }
  if(r.photo_url||r.avatar_url){ const p=document.querySelector('.profile-photo'); if(p) p.src=r.photo_url||r.avatar_url; }
  if((r.specialties||r.especialidades)?.length){ const el=document.querySelector('.profile-specs'); if(el) el.textContent=(r.specialties||r.especialidades).join(' · '); }
  if(r.description||r.slogan){ const el=document.querySelector('.profile-desc'); if(el) el.textContent=r.description||r.slogan; }
  if(r.modalities||r.modalidades) renderModos(r.modalities||r.modalidades);
  if(r.location||r.address){ const el=document.querySelector('.profile-addr'); if(el){ const svg=el.querySelector('svg'); el.textContent=r.location||r.address; if(svg)el.prepend(svg); el.style.display=''; } }
  if(r.portada_url){ const h=document.querySelector('.hero'); if(h) h.style.backgroundImage=`url('${r.portada_url}')`; }

  // Perfil config (colores, slogan, frase, portada, fondo, foto)
  const cfgData = await _ppFetch('/api/perfil-profesional/config', { resource_id: resourceId });
  if(cfgData?.success && cfgData.config){
    const c=cfgData.config;
    const R=document.documentElement;
    if(c.colores) Object.entries(c.colores).forEach(([k,v])=>R.style.setProperty(k,v));
    if(c.portada_url){ const h=document.querySelector('.hero'); if(h) h.style.backgroundImage=`url('${c.portada_url}')`; }
    if(c.foto_url){ const p=document.querySelector('.profile-photo'); if(p) p.src=c.foto_url; }
    if(c.fondo_url){ document.body.style.backgroundImage=`url('${c.fondo_url}')`; document.body.style.backgroundSize='cover'; }
    if(c.fondo_color){ document.body.style.backgroundImage='none'; document.body.style.backgroundColor=c.fondo_color; }
    if(c.slogan){ const el=document.querySelector('.hero-banner span'); if(el) el.textContent=c.slogan; }
    if(c.frase){ const el=document.querySelector('.profile-desc'); if(el) el.textContent=c.frase; }
    if(c.direccion){ const el=document.querySelector('.profile-addr'); if(el){ const svg=el.querySelector('svg'); el.textContent=c.direccion; if(svg)el.prepend(svg); el.style.display=''; } }
    if(c.nombre_empresa){ const el=document.getElementById('profile-name'); if(el) el.textContent=c.nombre_empresa; }
    if(c.especialidades){ const el=document.querySelector('.profile-specs'); if(el) el.textContent=c.especialidades; }
    if(c.opacidad!==undefined){ const v=(c.opacidad/100).toFixed(2); document.querySelectorAll('.profile-top-glass,.service-card,.comment-card,.agenda-card,.sidebar-hablemos,.prof-card').forEach(el=>{ el.style.cssText+=`;background:rgba(255,255,255,${v}) !important`; }); }
    if(c.inf_oficio?.length) renderInfOficio(c.inf_oficio);
    if(c.equipo_prof) renderProfCard(c.equipo_prof);
  }

  // Servicios del resource
  const svcsData = await _ppFetch(`/api/agenda/resources/${resourceId}/services`);
  const rawSvcs = svcsData?.services || svcsData?.servicios || [];
  if(rawSvcs.length){
    _ppServices = rawSvcs;
    renderServicios(rawSvcs.map(s=>({
      nombre: s.nombre||s.name||'',
      meta: [s.duration||s.duracion, s.description||s.descripcion].filter(Boolean).join(' · ')||'—',
      precio: (s.price||s.precio) ? `$${Number(s.price||s.precio).toLocaleString('es-CL')}` : 'Consultar'
    })));
    _ppBuildBookingChips();
  }

  // Programas (via company_id si está disponible)
  const companyId = cfgData?.config?.company_id || r.company_id || '';
  if(companyId){
    const progsData = await _ppFetch('/api/perfil-profesional/programas', { company_id: companyId, tipo: 'empresa' });
    if(progsData?.success && progsData.programas?.length){
      renderProgramas(progsData.programas.map(p=>({ nombre:p.nombre, tipo:p.tipo, img:p.imagen_url||p.img, color:p.color })));
    }
  }

  // Comentarios
  const commData = await _ppFetch('/api/perfil-profesional/comentarios', companyId ? { company_id: companyId } : { resource_id: resourceId });
  if(commData?.success && commData.comentarios?.length){
    const list=document.getElementById('comments-list');
    if(list) list.innerHTML=commData.comentarios.map(c=>`
      <div class="comment-card">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
          <div style="width:34px;height:34px;border-radius:50%;background:var(--blue-5,#EFF6FF);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;color:var(--navy,#355BB6)">${(c.nombre||'?')[0].toUpperCase()}</div>
          <div>
            <div style="font-size:13px;font-weight:600;color:var(--text)">${c.nombre||'Anónimo'}</div>
            <div style="font-size:12px;color:#f59e0b">${'★'.repeat(c.rating||5)}</div>
          </div>
        </div>
        <div style="font-size:13px;color:var(--text-lt);line-height:1.5">${c.texto||c.comentario||''}</div>
      </div>`).join('');
  }

  // Calendario real
  const now=new Date();
  _ppRenderCalendar(now.getFullYear(), now.getMonth());
}

// Auto-iniciar cuando NO es preview
(function(){
  if(!document.documentElement.classList.contains('in-preview')){
    initPerfilPublico();
  }
})();

function renderInfOficio(items){
  const row = document.getElementById('photos-row');
  if(!row) return;
  row.innerHTML = items.map(item => item.isVideo
    ? `<div class="photo-thumb is-video" onclick="abrirVideo('${item.data}')">
        <video src="${item.data}" muted playsinline preload="metadata" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:12px"></video>
        <div class="play" style="position:relative;z-index:2"><svg width="14" height="14" viewBox="0 0 24 24" fill="var(--text-franja)"><polygon points="5 3 19 12 5 21 5 3"/></svg></div>
       </div>`
    : `<div class="photo-thumb">
        <img src="${item.data}" style="width:100%;height:100%;object-fit:cover;position:absolute;inset:0;border-radius:12px">
       </div>`
  ).join('');
}
function renderHorario(h){
  const el = id => document.getElementById(id);
  if(el('hor-rango'))      el('hor-rango').textContent      = `${h.inicio} a ${h.fin} hrs`;
  if(el('hor-almuerzo'))   el('hor-almuerzo').textContent   = `Almuerzo: ${h.almDesde} – ${h.almHasta}`;
  if(el('hor-intervalo'))  el('hor-intervalo').textContent  = `Intervalo: ${h.intervalo} min · Anticip.: ${h.anticip} hrs`;
  if(el('hor-cancelacion'))el('hor-cancelacion').textContent= `Cancelación: ${h.cancelHrs} hrs · ${h.cancelPct}% tardía`;
  // Mostrar el bloque solo cuando hay datos reales
  const block = document.getElementById('horario-block');
  if(block && h.inicio) block.style.display = '';
}
function renderServicios(servicios){
  const container = document.querySelector('.services-list');
  if(!container) return;
  container.innerHTML = servicios.map(s => `
    <div class="service-card" data-svc-name="${s.nombre.toLowerCase()}">
      <div class="service-header">
        <span class="service-name">${s.nombre}</span>
        <span class="service-dur">${s.meta.split('·')[0].trim()}</span>
      </div>
      <div class="service-desc">${s.meta.split('·')[1]?.trim() || ''}</div>
      <div class="service-footer">
        <span class="service-price">${s.precio}</span>
        <button class="btn-tomar">Tomar hora</button>
      </div>
    </div>`).join('');
  const search = document.getElementById('svc-search');
  if(search){
    search.style.display = servicios.length > 4 ? 'block' : 'none';
    search.value = '';
  }
}
function filtrarServicios(q){
  const term = q.toLowerCase().trim();
  document.querySelectorAll('.services-list .service-card').forEach(card => {
    card.style.display = (!term || card.dataset.svcName.includes(term)) ? '' : 'none';
  });
}

function renderModos(modos){
  const row = document.getElementById('modos-row');
  if(!row) return;
  const iconos = {Presencial:'<i class="fas fa-map-marker-alt"></i>', Online:'<i class="fas fa-video"></i>', 'A domicilio':'<i class="fas fa-home"></i>'};
  row.innerHTML = modos.map(m => `<span class="modo-chip">${iconos[m] || '<i class="fas fa-circle"></i>'} ${m}</span>`).join('');
}
function renderProgramas(programas){
  const row = document.querySelector('.cursos-row');
  if(!row) return;
  // Limpiar carrusel previo
  if(row._cursosRaf){ cancelAnimationFrame(row._cursosRaf); row._cursosRaf=null; }
  if(row._cursosMouseEnter) row.removeEventListener('mouseenter', row._cursosMouseEnter);
  if(row._cursosMouseLeave) row.removeEventListener('mouseleave', row._cursosMouseLeave);
  if(row._cursosTouchStart) row.removeEventListener('touchstart', row._cursosTouchStart);
  if(row._cursosTouchEnd)   row.removeEventListener('touchend',   row._cursosTouchEnd);
  row.innerHTML = '';
  row.classList.remove('cursos-carousel-mode');
  if(!programas || programas.length === 0) return;

  const cardHTML = (p, i) => `<a class="curso-thumb" href="programa_detalle.html?idx=${i}" target="_top" style="background:${p.color||'var(--blue-5)'};text-decoration:none;cursor:pointer;">${p.img?`<img src="${p.img}">`:''}${p.tipo?`<div class="curso-tipo-badge">${p.tipo}</div>`:''}<div class="curso-label">${p.nombre}</div></a>`;

  if(programas.length < 3){
    row.innerHTML = programas.map(cardHTML).join('');
    return;
  }

  // ── Modo carrusel continuo (3+ programas) ──
  const N = programas.length;
  row.classList.add('cursos-carousel-mode');
  const track = document.createElement('div');
  track.className = 'cursos-carousel-track';
  track.innerHTML = [...programas, ...programas].map((p, i) => cardHTML(p, i % N)).join('');
  row.appendChild(track);

  var slotW = 0, totalW = 0, pos = 0, paused = false, lastTime = null;

  function calcDims(){
    const cards = track.querySelectorAll('.curso-thumb');
    if(cards.length >= 2){
      const r0 = cards[0].getBoundingClientRect();
      const r1 = cards[1].getBoundingClientRect();
      slotW = r1.left - r0.left;
      totalW = N * slotW;
      row.style.setProperty('--cursos-card-w', (slotW - 11.2) + 'px');
    }
  }

  function tick(ts){
    if(slotW === 0) calcDims();
    if(!paused && slotW > 0){
      if(lastTime !== null) pos += (slotW / 5000) * (ts - lastTime);
      lastTime = ts;
    } else { lastTime = null; }
    if(pos >= totalW) pos -= totalW;
    track.style.transform = 'translateX(-' + pos + 'px)';
    row._cursosRaf = requestAnimationFrame(tick);
  }

  row._cursosMouseEnter = function(){ paused = true; };
  row._cursosMouseLeave = function(){ paused = false; lastTime = null; };
  row._cursosTouchStart = function(){ paused = true; };
  row._cursosTouchEnd   = function(){ paused = false; lastTime = null; };
  row.addEventListener('mouseenter', row._cursosMouseEnter);
  row.addEventListener('mouseleave', row._cursosMouseLeave);
  row.addEventListener('touchstart', row._cursosTouchStart, {passive:true});
  row.addEventListener('touchend',   row._cursosTouchEnd);

  row._cursosRaf = requestAnimationFrame(tick);
}

function abrirVideo(src){
  const overlay = document.getElementById('video-modal');
  const vid = document.getElementById('modal-video');
  vid.src = src;
  overlay.classList.add('open');
  vid.play();
}
function renderProfCard(p){
  const carousel = document.getElementById('prof-carousel');
  const wrap     = document.getElementById('prof-carousel-wrap');
  if(!carousel) return;

  // Sin datos o vacío → ocultar carrusel
  if(!p || (!p.nombre && !p.foto)) {
    carousel.innerHTML = '';
    if(wrap) wrap.style.display = 'none';
    return;
  }

  const iconos = {Presencial:'<i class="fas fa-map-marker-alt"></i>', Online:'<i class="fas fa-video"></i>', 'A domicilio':'<i class="fas fa-home"></i>'};
  const modosHTML = (p.modos && p.modos.length)
    ? p.modos.map(m=>`<span class="prof-card-modo">${iconos[m]||'<i class="fas fa-circle"></i>'} ${m}</span>`).join('')
    : '';

  carousel.innerHTML = `
    <div class="prof-card" id="prof-card-jm">
      ${p.foto ? `<img class="prof-card-photo" id="prof-jm-foto" src="${p.foto}" alt="${p.nombre||''}">` : ''}
      <div class="prof-card-name"  id="prof-jm-nombre">${p.nombre||''}</div>
      <div class="prof-card-specs" id="prof-jm-specs">${p.specs||''}</div>
      <div class="prof-card-desc"  id="prof-jm-desc">${p.desc||''}</div>
      ${modosHTML ? `<div class="prof-card-modos" id="prof-jm-modos">${modosHTML}</div>` : ''}
      ${p.addr ? `<div class="prof-card-addr" id="prof-jm-addr"><i class="fas fa-map-pin"></i> ${p.addr}</div>` : ''}
    </div>`;

  if(wrap) wrap.style.display = '';
}
function scrollProf(dir){
  const c = document.getElementById('prof-carousel');
  if(c) c.scrollBy({left: dir * 250, behavior:'smooth'});
}
function cerrarVideo(){
  const overlay = document.getElementById('video-modal');
  const vid = document.getElementById('modal-video');
  vid.pause();
  vid.src = '';
  overlay.classList.remove('open');
}

window.addEventListener('message', function(e){
  const {type, value} = e.data || {};
  if(!type) return;
  try{
    const stored = (value !== null && typeof value === 'object') ? JSON.stringify(value) : value;
    localStorage.setItem('ep_'+type, stored);
  }catch(err){}
  const R = document.documentElement;
  if(type === 'portada'){ const h=document.querySelector('.hero'); if(h){ h.style.backgroundImage=`url('${value}')`;try{const p=JSON.parse(localStorage.getItem('ep_portada_position')||'{"x":50,"y":50}');h.style.backgroundPosition=p.x+'% '+p.y+'%';}catch(e){} } }
  else if(type === 'foto'){ const p=document.querySelector('.profile-photo'); if(p) p.src=value; }
  else if(type === 'fondo'){ document.body.style.backgroundImage=`url('${value}')`; document.body.style.backgroundSize='cover'; document.body.style.backgroundColor=''; }
  else if(type === 'fondo_color'){ document.body.style.backgroundImage='none'; document.body.style.backgroundColor=value; }
  else if(type.startsWith('color_')){ R.style.setProperty(type.replace('color_',''), value); }
  else if(type === 'opacidad'){ const op=(value/100).toFixed(2); document.querySelectorAll('.profile-top-glass,.service-card,.comment-card,.agenda-card,.sidebar-hablemos,.prof-card').forEach(el=>{ el.style.cssText+=`;background:rgba(255,255,255,${op}) !important`; }); }
  else if(type === 'especialidades'){ const el=document.querySelector('.profile-specs'); if(el) el.textContent=value; }
  else if(type === 'servicios'){ renderServicios(value); }
  else if(type === 'modos'){ renderModos(value); }
  else if(type === 'programas'){ renderProgramas(value); }
  else if(type === 'horario'){ renderHorario(value); }
  else if(type === 'inf_oficio'){ renderInfOficio(value); }
  else if(type === 'texto_slogan'){ const el=document.querySelector('.hero-banner span'); if(el) el.textContent=value; }
  else if(type === 'texto_frase'){ const el=document.querySelector('.profile-desc'); if(el) el.textContent=value; }
  else if(type === 'texto_direccion'){ const el=document.querySelector('.profile-addr'); if(el){ const svg=el.querySelector('svg'); el.textContent=value; if(svg) el.prepend(svg); el.style.display = value ? '' : 'none'; } }
  else if(type === 'nombre_empresa'){ const el=document.getElementById('profile-name'); if(el) el.textContent=value; }
  else if(type === 'equipo_prof'){ renderProfCard(value); }
});

(function(){
  const R = document.documentElement;
  function safeJ(key){ const raw=localStorage.getItem(key); if(!raw) return null; try{ return JSON.parse(raw); }catch(e){ localStorage.removeItem(key); return null; } }

  ['--text-titulo','--titulo-bg','--text-lt','--text-franja','--navy'].forEach(v => {
    const val = localStorage.getItem('ep_color_'+v);
    if(val) R.style.setProperty(v, val);
  });

  const portada = localStorage.getItem('ep_portada');
  if(portada){ const h=document.querySelector('.hero'); if(h){ h.style.backgroundImage=`url('${portada}')`;try{const p=JSON.parse(localStorage.getItem('ep_portada_position')||'{"x":50,"y":50}');h.style.backgroundPosition=p.x+'% '+p.y+'%';}catch(e){} } }
  const foto = localStorage.getItem('ep_foto');
  if(foto){ const p=document.querySelector('.profile-photo'); if(p) p.src=foto; }
  const fondo = localStorage.getItem('ep_fondo');
  if(fondo){ document.body.style.backgroundImage=`url('${fondo}')`; document.body.style.backgroundSize='cover'; }
  const fondoColor = localStorage.getItem('ep_fondo_color');
  if(fondoColor){ document.body.style.backgroundImage='none'; document.body.style.backgroundColor=fondoColor; }

  const hor = safeJ('ep_horario');   if(hor)  renderHorario(hor);
  const svcs = safeJ('ep_servicios'); if(svcs) renderServicios(svcs);
  const progs = safeJ('ep_programas'); if(progs) renderProgramas(progs);
  const modos = safeJ('ep_modos');   if(modos) renderModos(modos);
  const profCard = safeJ('ep_equipo_prof'); if(profCard) renderProfCard(profCard);

  const espec = localStorage.getItem('ep_especialidades');
  if(espec){ const el=document.querySelector('.profile-specs'); if(el) el.textContent=espec; }
  const slogan = localStorage.getItem('ep_texto_slogan');
  if(slogan){ const el=document.querySelector('.hero-banner span'); if(el) el.textContent=slogan; }
  const frase = localStorage.getItem('ep_texto_frase');
  if(frase){ const el=document.querySelector('.profile-desc'); if(el) el.textContent=frase; }
  const dir = localStorage.getItem('ep_texto_direccion');
  if(dir){ const el=document.querySelector('.profile-addr'); if(el){ const svg=el.querySelector('svg'); el.textContent=dir; if(svg) el.prepend(svg); el.style.display = ''; } }
  const nomEmp = localStorage.getItem('ep_nombre_empresa');
  if(nomEmp){ const el=document.getElementById('profile-name'); if(el) el.textContent=nomEmp; }

  const op = localStorage.getItem('ep_opacidad');
  if(op){ const v=(op/100).toFixed(2); document.querySelectorAll('.profile-top-glass,.service-card,.comment-card,.agenda-card,.sidebar-hablemos,.prof-card').forEach(el=>{ el.style.cssText+=`;background:rgba(255,255,255,${v}) !important`; }); }
})();

// ── HERO DRAG PORTADA (solo en modo preview) ──
(function() {
  if (!document.documentElement.classList.contains('in-preview')) return;
  var hero = document.querySelector('.hero');
  if (!hero) return;

  var isDragging = false, startX = 0, startY = 0, posX = 50, posY = 50;
  try { var _sp = JSON.parse(localStorage.getItem('ep_portada_position')||'{"x":50,"y":50}'); posX=_sp.x; posY=_sp.y; } catch(e) {}

  var hint = document.createElement('div');
  hint.className = 'hero-drag-hint';
  hint.innerHTML = '<i class="fas fa-arrows-alt" style="margin-right:5px;font-size:10px"></i>Arrastra para ajustar';
  hint.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,.65);color:#fff;font-size:15px;font-weight:700;padding:12px 22px;border-radius:12px;pointer-events:none;font-family:"DM Sans",sans-serif;backdrop-filter:blur(6px);white-space:nowrap;display:none;letter-spacing:.3px';
  hero.appendChild(hint);

  function hasImage() { return hero.style.backgroundImage && hero.style.backgroundImage.includes('url('); }
  function showHint() { if (hasImage()) hint.style.display = ''; }

  function startDrag(x, y) {
    if (!hasImage()) return;
    isDragging = true; startX = x; startY = y;
    hero.style.cursor = 'grabbing';
    if (hint.parentNode) hint.parentNode.removeChild(hint);
  }
  function moveDrag(x, y) {
    if (!isDragging) return;
    var dx = (x - startX) / hero.offsetWidth  * 100;
    var dy = (y - startY) / hero.offsetHeight * 100;
    startX = x; startY = y;
    posX = Math.max(0, Math.min(100, posX - dx));
    posY = Math.max(0, Math.min(100, posY - dy));
    hero.style.backgroundPosition = posX + '% ' + posY + '%';
    try { window.parent.postMessage({ type: 'hero_position', x: posX, y: posY }, '*'); } catch(e) {}
  }
  function endDrag() { isDragging = false; if (hasImage()) hero.style.cursor = 'grab'; }

  hero.addEventListener('mousedown', function(e) { startDrag(e.clientX, e.clientY); e.preventDefault(); });
  document.addEventListener('mousemove', function(e) { moveDrag(e.clientX, e.clientY); });
  document.addEventListener('mouseup', endDrag);
  hero.addEventListener('touchstart', function(e) { startDrag(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
  document.addEventListener('touchmove', function(e) { if (isDragging) moveDrag(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
  document.addEventListener('touchend', endDrag);

  function checkAndShowHint() { if (hasImage()) { hero.style.cursor = 'grab'; showHint(); } }
  setTimeout(checkAndShowHint, 700);
  new MutationObserver(function() { setTimeout(checkAndShowHint, 200); })
    .observe(hero, { attributes: true, attributeFilter: ['style'] });
})();
