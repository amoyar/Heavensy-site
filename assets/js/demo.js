// ── NAV STATE ──
(function() {
  var token      = localStorage.getItem('token');
  var linkPlanes = document.getElementById('nav-link-planes');
  var btnLogin   = document.getElementById('nav-btn-login');
  if (token) {
    if (linkPlanes) linkPlanes.style.display = 'none';
    if (btnLogin)   btnLogin.style.display   = 'none';
  } else {
    if (linkPlanes) linkPlanes.style.display = '';
    if (btnLogin)   btnLogin.style.display   = '';
  }
})();

// ── DATOS ──
const raw = localStorage.getItem('hv_demo');
const D = raw ? JSON.parse(raw) : {
  nombre:'Tu empresa', rubro:'Salud y bienestar', servicio:'Consulta de 45 minutos',
  lenguaje:'cercano', canales:'whatsapp', profesion:''
};

// ── CHAT SCRIPTS por lenguaje ──
const CHATS = {
  formal:[
    {side:'cliente', text:'Buenas tardes. Quisiera información sobre sus servicios.', time:'14:02'},
    {side:'bot', text:'Buenas tardes. Es un placer atenderle. Soy el asistente virtual de **'+D.nombre+'**.\n\nOfrecemos '+D.servicio+'. ¿Le gustaría agendar una cita?', time:'14:02'},
    {side:'cliente', text:'Sí, me interesa. ¿Cuáles son los horarios disponibles?', time:'14:03'},
    {side:'bot', text:'Tenemos disponibilidad de lunes a viernes de 09:00 a 18:00 hrs. ¿Tiene alguna preferencia de día?', time:'14:03'},
    {side:'cliente', text:'El próximo miércoles estaría bien.', time:'14:04'},
    {side:'bot', text:'Perfecto. He registrado su solicitud para el miércoles. En breve le confirmaremos el horario exacto. ¿Hay algo más en que pueda ayudarle?', time:'14:04'},
  ],
  cercano:[
    {side:'cliente', text:'Hola! 👋 quería preguntar por sus servicios', time:'11:15'},
    {side:'bot', text:'¡Hola! Qué bueno que escribiste 😊 Soy el asistente de **'+D.nombre+'**.\n\nTe cuento que ofrecemos '+D.servicio+'. ¿Te animas a sacar una hora?', time:'11:15'},
    {side:'cliente', text:'Sí! ¿cuánto cuesta?', time:'11:16'},
    {side:'bot', text:'¡Genial! El valor te lo confirma directamente nuestro equipo según lo que necesites. ¿Te parece si te agendo una consulta rápida para contarte todo? 🙌', time:'11:16'},
    {side:'cliente', text:'Dale, el viernes me queda bien', time:'11:17'},
    {side:'bot', text:'¡Anotado para el viernes! 🗓️ Te vamos a escribir para confirmar la hora exacta. ¡Nos vemos pronto! ✨', time:'11:17'},
  ],
  tecnico:[
    {side:'cliente', text:'Necesito información técnica sobre el servicio.', time:'09:30'},
    {side:'bot', text:'Sistema de atención de **'+D.nombre+'** activo.\n\nServicio disponible: '+D.servicio+'.\n\nEspecificaciones y condiciones disponibles bajo solicitud. ¿Requiere ficha técnica?', time:'09:30'},
    {side:'cliente', text:'Sí, y también quiero saber tiempos de entrega.', time:'09:31'},
    {side:'bot', text:'Tiempos de respuesta: 24-48 hrs para consultas estándar. Para casos prioritarios, gestión en menos de 4 hrs. ¿Procedo a agendar evaluación inicial?', time:'09:31'},
    {side:'cliente', text:'Sí, para el lunes.', time:'09:32'},
    {side:'bot', text:'Registro generado: Lunes — evaluación inicial. Confirmación vía email en los próximos 30 minutos. ¿Algún otro requerimiento?', time:'09:32'},
  ]
};

const TOPICS_BY_RUBRO = {
  'Salud y bienestar':['Agendar hora','Precios y valores','Horarios disponibles'],
  'Belleza':['Servicios disponibles','Precio de atención','Disponibilidad'],
  'Educación':['Inscripciones','Horarios de clases','Costos del curso'],
  'Asesoría':['Consulta inicial','Tarifas','Disponibilidad'],
  default:['Información general','Precios','Agendar cita']
};

function getTopics(){ return TOPICS_BY_RUBRO[D.rubro] || TOPICS_BY_RUBRO.default; }

// ── RENDER SLIDE 1 ──
function renderChat(){
  const initials = D.nombre.split(' ').slice(0,2).map(w=>w[0]?.toUpperCase()||'').join('') || 'H';
  document.getElementById('ph-avatar').textContent = initials;
  document.getElementById('ph-name').textContent = D.nombre;
  document.getElementById('info-nombre').textContent = D.nombre;
  document.getElementById('info-rubro').textContent = D.rubro;
  document.getElementById('info-servicio').textContent = D.servicio;
  const lenMap = {formal:'Formal',cercano:'Cercano',tecnico:'Técnico'};
  document.getElementById('info-lenguaje').innerHTML = '<i class="fas fa-comment"></i> ' + (lenMap[D.lenguaje]||D.lenguaje);
  document.getElementById('info-canales').textContent = D.canales.split(',').join(' · ');

  const chatMsgs = CHATS[D.lenguaje] || CHATS.cercano;
  const body = document.getElementById('phone-body');
  chatMsgs.forEach(m => {
    const div = document.createElement('div');
    div.className = 'msg ' + m.side;
    div.innerHTML = m.text.replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>').replace(/\n/g,'<br>') + '<div class="msg-time">'+m.time+'</div>';
    body.appendChild(div);
  });
  body.scrollTop = body.scrollHeight;
}

// ── RENDER SLIDE 2 ──
function renderPlatform(){
  const convs = [
    {name:'María González', preview:'¿Qué horarios tienen?', time:'14:04', badge:2, color:'linear-gradient(135deg,#f97316,#fb923c)', active:true},
    {name:'Carlos Muñoz', preview:'Gracias! Confirmo mañana', time:'13:45', badge:0, color:'linear-gradient(135deg,#8E84FA,#89B9F8)', active:false},
    {name:'Ana Torres', preview:'Perfecto, nos vemos el lu…', time:'12:30', badge:0, color:'linear-gradient(135deg,#4ade80,#22d3ee)', active:false},
    {name:'Luis Pérez', preview:'¿Tienen disponibilidad?', time:'11:10', badge:1, color:'linear-gradient(135deg,#f472b6,#fb7185)', active:false},
  ];
  const list = document.getElementById('conv-list');
  convs.forEach(c=>{
    const div = document.createElement('div');
    div.className = 'conv-item' + (c.active?' active':'');
    div.innerHTML = `<div class="conv-avatar" style="background:${c.color}">${c.name[0]}</div>
      <div class="conv-info"><div class="conv-name">${c.name}</div><div class="conv-preview">${c.preview}</div></div>
      <div class="conv-meta"><div class="conv-time">${c.time}</div>${c.badge?`<div class="conv-badge">${c.badge}</div>`:''}</div>`;
    list.appendChild(div);
  });
  const platMsgs = CHATS[D.lenguaje] || CHATS.cercano;
  const body = document.getElementById('platform-body');
  platMsgs.forEach(m=>{
    const div = document.createElement('div');
    div.className = 'plat-msg ' + m.side;
    if(m.side==='bot') div.innerHTML = `<div class="ia-tag">✦ IA Heavensy</div><div>${m.text.replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>').replace(/\n/g,'<br>')}</div><div class="plat-msg-time">${m.time}</div>`;
    else div.innerHTML = m.text + `<div class="plat-msg-time">${m.time}</div>`;
    body.appendChild(div);
  });
  body.scrollTop = body.scrollHeight;
}

// ── RENDER SLIDE 3 ──
function renderTracking(){
  const topics = getTopics();
  const pcts = [72, 48, 31];
  const tDiv = document.getElementById('tracking-topics');
  topics.forEach((t,i)=>{
    tDiv.innerHTML += `<div class="conv-stat-row">
      <div><div class="conv-stat-name">${t}</div><div class="conv-stat-bar"><div class="conv-stat-bar-fill" style="width:${pcts[i]}%"></div></div></div>
      <div class="conv-stat-val">${pcts[i]}%</div></div>`;
  });
  const timeline = [
    {dot:'ok', text:'IA respondió a María González', time:'hace 2 min'},
    {dot:'ok', text:'Nueva consulta de Carlos Muñoz', time:'hace 18 min'},
    {dot:'pending', text:'Seguimiento pendiente — Ana Torres', time:'hace 1 hr'},
    {dot:'wait', text:'Sin respuesta — Luis Pérez', time:'hace 2 hrs'},
  ];
  const tl = document.getElementById('tracking-timeline');
  timeline.forEach(t=>{
    tl.innerHTML += `<div class="timeline-item"><div class="timeline-dot ${t.dot}"></div>
      <div><div class="timeline-text">${t.text}</div><div class="timeline-time">${t.time}</div></div></div>`;
  });
  document.getElementById('demo-title').textContent = 'Demo para ' + D.nombre;
}

// ── CARRUSEL ──
let current = 0;
const total = 3;

function moverSlide(dir){
  if(dir === 1 && current === total - 1){ finDemo(); return; }
  irSlide(current + dir);
}

function finDemo(){
  const overlay = document.getElementById('fin-overlay');
  overlay.style.display = 'flex';
  setTimeout(() => {
    document.getElementById('fin-circle').style.transform = 'scale(1)';
    document.getElementById('fin-texto').style.opacity = '1';
  }, 50);
  setTimeout(() => { window.location.href = 'agendar_integracion.html'; }, 2200);
}

function irSlide(idx){
  current = Math.max(0, Math.min(total-1, idx));
  const w = document.querySelector('.carousel-clip').offsetWidth;
  document.querySelectorAll('.slide').forEach(s => { s.style.minWidth = w + 'px'; s.style.maxWidth = w + 'px'; });
  document.getElementById('carousel-slides').style.transform = `translateX(-${current * w}px)`;
  document.querySelectorAll('.dot').forEach((d,i)=>d.classList.toggle('active', i===current));
  document.getElementById('btn-prev').disabled = current === 0;
  document.getElementById('btn-next').disabled = false;
}

window.addEventListener('resize', ()=>irSlide(current));
window.addEventListener('load', ()=>irSlide(0));

// ── SWIPE TOUCH ──
(function(){
  const track = document.getElementById('carousel-slides');
  let x0=null;
  track.addEventListener('touchstart',e=>{x0=e.touches[0].clientX;},{passive:true});
  track.addEventListener('touchend',e=>{
    if(x0===null) return;
    const dx = e.changedTouches[0].clientX - x0;
    if(Math.abs(dx)>40) moverSlide(dx<0?1:-1);
    x0=null;
  },{passive:true});
})();

// ── CHAT INTERACTIVO ──
const RESPUESTAS = {
  formal:{
    precio:  'El valor de nuestros servicios varía según la modalidad de atención. Le recomendamos contactarnos directamente para recibir una cotización personalizada.',
    horario: 'Nuestros horarios de atención son de lunes a viernes, de 09:00 a 18:00 hrs. ¿Tiene alguna preferencia?',
    agendar: 'Con gusto le agendo una sesión. ¿Tiene disponibilidad esta semana o prefiere la próxima?',
    gracias: 'Ha sido un placer atenderle. Quedamos a su disposición para cualquier consulta adicional.',
    hola:    'Buenas. Es un placer atenderle. Soy el asistente virtual de '+D.nombre+'. ¿En qué puedo ayudarle?',
    default: 'Gracias por su mensaje. Un especialista de '+D.nombre+' le responderá a la brevedad.'
  },
  cercano:{
    precio:  '¡Buena pregunta! El valor depende de lo que necesites. Te puedo conectar con alguien del equipo para darte un precio exacto 😊',
    horario: '¡Tenemos harta disponibilidad! Atendemos lunes a viernes de 9 a 18 hrs. ¿Qué día te acomoda más?',
    agendar: '¡Con mucho gusto! ¿Prefieres esta semana o la siguiente? 📅',
    gracias: '¡De nada! Fue un placer ayudarte ✨ Cualquier cosa, aquí estamos.',
    hola:    '¡Hola! 👋 Qué bueno que escribiste. Soy el asistente de '+D.nombre+'. ¿En qué te puedo ayudar?',
    default: '¡Gracias por escribir! Te voy a pasar con alguien del equipo de '+D.nombre+' para darte la mejor ayuda 🙌'
  },
  tecnico:{
    precio:  'Tarifas disponibles por modalidad de servicio. Solicite cotización formal indicando requerimientos específicos.',
    horario: 'Ventana de atención: L-V 09:00-18:00. Soporte prioritario disponible según plan contratado.',
    agendar: 'Iniciando proceso de agendamiento. Indique fecha preferida y tipo de sesión requerida.',
    gracias: 'Confirmado. Registro actualizado. Sistema disponible 24/7 para consultas adicionales.',
    hola:    'Sistema de atención de '+D.nombre+' activo. Identificación de requerimiento en curso.',
    default: 'Solicitud recibida. Procesando respuesta. Un agente especializado tomará el caso en los próximos minutos.'
  }
};

function getNow(){
  const d = new Date();
  return d.getHours().toString().padStart(2,'0')+':'+d.getMinutes().toString().padStart(2,'0');
}

function getIARespuesta(texto){
  const t = texto.toLowerCase();
  const R = RESPUESTAS[D.lenguaje] || RESPUESTAS.cercano;
  if(/precio|costo|valor|cuánto|cuanto/.test(t)) return R.precio;
  if(/horario|hora|cuando|cuándo|disponib/.test(t)) return R.horario;
  if(/agendar|reservar|cita|sesión|sesion/.test(t)) return R.agendar;
  if(/gracias|genial|perfecto|ok|dale/.test(t)) return R.gracias;
  if(/hola|buenas|buen|hey/.test(t)) return R.hola;
  return R.default;
}

function addMsg(text, side){
  const body = document.getElementById('phone-body');
  const div = document.createElement('div');
  div.className = 'msg ' + side;
  div.innerHTML = text.replace(/\n/g,'<br>') + '<div class="msg-time">'+getNow()+'</div>';
  body.appendChild(div);
  body.scrollTop = body.scrollHeight;
}

function showTyping(){
  const body = document.getElementById('phone-body');
  const div = document.createElement('div');
  div.className = 'typing-bubble';
  div.id = 'typing-indicator';
  div.innerHTML = '<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>';
  body.appendChild(div);
  body.scrollTop = body.scrollHeight;
}

function hideTyping(){
  const t = document.getElementById('typing-indicator');
  if(t) t.remove();
}

function enviarMensaje(){
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if(!text) return;
  addMsg(text, 'cliente');
  input.value = '';
  document.getElementById('chat-send-icon').className = 'fas fa-microphone';
  setTimeout(()=>{
    showTyping();
    setTimeout(()=>{
      hideTyping();
      addMsg(getIARespuesta(text), 'bot');
    }, 1200 + Math.random()*600);
  }, 400);
}

// ── INIT ──
renderChat();
renderPlatform();
renderTracking();
