// ── NAV ──
function toggleHvNav() {
  var user = document.querySelector('.hv-nav-user');
  var dd = document.getElementById('hv-user-dropdown');
  var open = !dd.classList.contains('open');
  dd.classList.toggle('open', open);
  user.classList.toggle('open', open);
}
document.addEventListener('click', function(e) {
  if (!e.target.closest('.hv-nav-user-wrap')) {
    var dd = document.getElementById('hv-user-dropdown');
    if (dd) dd.classList.remove('open');
    var u = document.querySelector('.hv-nav-user');
    if (u) u.classList.remove('open');
  }
});

// Mostrar/ocultar link "Planes" y botón login según si hay sesión activa
(function initNavState() {
  var token = localStorage.getItem('token');
  var linkPlanes = document.getElementById('nav-link-planes');
  var btnLogin   = document.getElementById('nav-btn-login');
  var userWrap   = document.getElementById('nav-user-wrap');

  if (token) {
    if (linkPlanes) linkPlanes.style.display = 'none';
    if (btnLogin)   btnLogin.style.display   = 'none';
    if (userWrap)   userWrap.style.display    = '';
  } else {
    if (linkPlanes) linkPlanes.style.display = '';
    if (btnLogin)   btnLogin.style.display   = '';
    if (userWrap)   userWrap.style.display    = 'none';
  }
})();

// ── CALCULADORA ──
function toggleCalc() {
  var body = document.getElementById('calc-body');
  var chev = document.getElementById('calc-chevron');
  var btn  = document.getElementById('calc-toggle');
  var open = !body.classList.contains('open');
  body.classList.toggle('open', open);
  chev.style.transform = open ? 'rotate(180deg)' : 'rotate(0deg)';
  btn.style.borderRadius = open ? '14px 14px 0 0' : '14px';
  btn.classList.toggle('open', open);
  if (open) cRender();
}

var cPlan = 's';
var SEM     = 4.33;
var HRS_DIA = 6;
var DIAS    = 5;
var COM_VAL = 40000;

var CP = {
  b: { name:'Básico', cost:0, bg:'linear-gradient(135deg,#6870B0,#8B92C8)', tc:'#6870B0', cancel:0.25, comN:1, derivN:0, convH:0.09, hgMin:60 },
  p: { name:'Automate Pro', cost:70000, bg:'linear-gradient(135deg,#7C6FF7,#9D8FFA)', tc:'#7C6FF7', cancel:0.15, comN:3, derivN:7, convH:0.20, hgMin:25 },
  s: { name:'Secretar-IA Premium', cost:120000, bg:'linear-gradient(135deg,#7C6FF7,#4A9FD4)', tc:'#6683E7', cancel:0.05, comN:5, derivN:15, convH:0.28, hgMin:10 }
};

function cf(n){ return '$'+Math.round(n).toLocaleString('es-CL'); }

function cCalc(){
  var vh = +document.getElementById('c-vh').value;
  var hw = +document.getElementById('c-hw').value;
  var hd = +document.getElementById('c-hd').value;
  var hg = +document.getElementById('c-hg').value;
  var p  = CP[cPlan];

  var cap_sem    = hd * DIAS;
  var hwReal     = Math.min(hw, cap_sem);
  var ingrSin    = hwReal * SEM * (1-0.25) * vh;
  var hGestMes   = hg * hd * SEM;
  var costoGest  = hGestMes * vh;
  var ocupSin    = hwReal / cap_sem;
  var cuposVacSin= Math.round((1 - ocupSin) * cap_sem);
  var convSin    = 0.06;
  var consultasSin = (hwReal * SEM * (1-0.25)) / convSin;

  var bruto    = vh * hd * DIAS * SEM;
  var extraVis = cPlan === 'b' ? 6 * vh * (1 - 0.25) : 0;
  var neto     = cPlan === 'b' ? ingrSin + extraVis : bruto * (1 - p.cancel);
  var comTotal = p.comN  * COM_VAL * 0.50;
  var ingDeriv = p.derivN * COM_VAL * 0.15;
  var totalH   = neto + comTotal + ingDeriv;
  var ganancia = totalH - ingrSin;
  var ocupH      = 1 - p.cancel;
  var cuposVacH  = Math.round(p.cancel * cap_sem);
  var consultasH = (neto / vh) / p.convH;

  return { vh, hw:hwReal, hwOrig:hw, hd, hg, p, cap_sem, ocupSin, cuposVacSin, ingrSin, consultasSin, hGestMes, costoGest, bruto, neto, comTotal, ingDeriv, totalH, ganancia, ocupH, cuposVacH, consultasH };
}

function cTabs(){
  document.getElementById('c-tabs').innerHTML=[
    {id:'b',l:'Básico — gratis'},{id:'p',l:'Automate Pro'},{id:'s',l:'Secretar-IA Premium'}
  ].map(function(t){
    var a=t.id===cPlan, pl=CP[t.id];
    return '<button onclick="cSetPlan(\''+t.id+'\')" style="padding:8px 18px;border-radius:9px;font-size:12px;font-weight:600;cursor:pointer;font-family:\'DM Sans\',sans-serif;border:1.5px solid '+(a?'transparent':'rgba(255,255,255,0.22)')+';background:'+(a?pl.bg:'rgba(255,255,255,0.1)')+';color:'+(a?'#fff':'rgba(255,255,255,0.75)')+(a?';box-shadow:0 4px 14px rgba(0,0,0,.25)':'')+';transition:all .15s;">'+t.l+'</button>';
  }).join('');
}

function cRender(){
  var vh = +document.getElementById('c-vh').value;
  document.getElementById('c-vh-o').textContent = cf(vh);
  document.getElementById('c-hw-o').textContent = document.getElementById('c-hw').value+' hrs';
  document.getElementById('c-hd-o').textContent = document.getElementById('c-hd').value+' hrs';
  document.getElementById('c-hg-o').textContent = document.getElementById('c-hg').value+' hrs/día';

  var d=cCalc(), p=d.p, c=p.tc, bg=p.bg;
  cTabs();

  var avisoHw = d.hwOrig > d.hw
    ? '<div style="background:rgba(245,166,35,0.22);border:1px solid rgba(245,166,35,0.45);border-radius:8px;padding:8px 12px;font-size:11px;color:#FFD580;margin-bottom:10px;">⚠ Declaras '+d.hwOrig+' hrs/sem pero tu jornada permite '+d.hw+' hrs máx.</div>'
    : '';

  document.getElementById('c-actual').innerHTML = avisoHw +
    '<div style="background:rgba(255,255,255,0.1);border-radius:12px;padding:14px 16px;"><div style="font-size:11px;font-weight:600;color:rgba(255,255,255,0.65);margin-bottom:5px;">Ingresos actuales / mes</div><div style="font-size:22px;font-weight:700;color:#fff;">'+cf(d.ingrSin)+'</div><div style="font-size:11px;color:rgba(255,255,255,0.45);margin-top:3px;">'+Math.round(d.hw*SEM*0.75)+' hrs efectivas · −25% cancelaciones</div></div>'+
    '<div style="background:rgba(170,165,90,0.28);border-radius:12px;padding:14px 16px;"><div style="font-size:11px;font-weight:600;color:rgba(255,255,255,0.75);margin-bottom:5px;">Agenda sin llenar</div><div style="font-size:22px;font-weight:700;color:#fff;">'+Math.round(d.ocupSin*100)+'% ocupada</div><div style="font-size:11px;color:rgba(255,255,255,0.6);margin-top:3px;">'+d.cuposVacSin+' cupos vacíos/sem de '+d.cap_sem+' posibles</div></div>'+
    '<div style="background:rgba(155,70,90,0.32);border-radius:12px;padding:14px 16px;"><div style="font-size:11px;font-weight:600;color:rgba(255,255,255,0.75);margin-bottom:5px;">Gestión de clientes roba tu jornada</div><div style="font-size:22px;font-weight:700;color:#fff;">'+Math.round(d.hGestMes)+' hrs/mes</div><div style="font-size:11px;color:rgba(255,255,255,0.6);margin-top:3px;">'+d.hg+' hr/día — pierdes '+cf(d.costoGest)+' al mes</div></div>'+
    '<div style="background:rgba(155,70,90,0.32);border-radius:12px;padding:14px 16px;"><div style="font-size:11px;font-weight:600;color:rgba(255,255,255,0.75);margin-bottom:5px;">Conversión: 6 de 100 pagan</div><div style="font-size:22px;font-weight:700;color:#fff;">'+Math.round(d.consultasSin)+' faltan</div><div style="font-size:11px;color:rgba(255,255,255,0.6);margin-top:3px;">faltan '+Math.round(d.hw*SEM*0.75)+' clientes/mes</div></div>';

  var alertBg, alertBorder, alertIconColor, alertTextColor, alertMsg;
  if(d.cuposVacSin === 0){
    alertBg='rgba(39,174,96,0.2)'; alertBorder='rgba(39,174,96,0.45)'; alertIconColor='#4ade80'; alertTextColor='#a7f3d0';
    alertMsg='Tu agenda ya está llena — '+p.name+' se encarga de las gestiones y seguimientos para que trabajes menos horas administrativas y brindes una mejor atención.';
  } else if(d.ocupSin >= 0.75){
    alertBg='rgba(245,166,35,0.18)'; alertBorder='rgba(245,166,35,0.4)'; alertIconColor='#FFD580'; alertTextColor='#FFD580';
    alertMsg='Tu agenda está al <strong>'+Math.round(d.ocupSin*100)+'%</strong> — bien aprovechada. Con '+p.name+' reduces cancelaciones y añades <strong>'+d.cuposVacH+' cupo'+(d.cuposVacH===1?'':'s')+' vacío'+(d.cuposVacH===1?'':'s')+' por semana</strong> más comisiones pasivas.';
  } else {
    alertBg='rgba(226,75,74,0.18)'; alertBorder='rgba(226,75,74,0.4)'; alertIconColor='#f87171'; alertTextColor='#fca5a5';
    alertMsg='Hoy tu agenda está al <strong>'+Math.round(d.ocupSin*100)+'%</strong> con <strong>'+d.cuposVacSin+' cupos vacíos/sem</strong>. Con '+p.name+' la IA llena tu jornada completa.';
  }
  document.getElementById('c-alert').innerHTML='<div style="background:'+alertBg+';border:1px solid '+alertBorder+';border-radius:8px;padding:10px 14px;display:flex;align-items:center;gap:10px;font-size:12px;"><div style="width:20px;height:20px;border-radius:50%;background:'+alertIconColor+'22;display:flex;align-items:center;justify-content:center;flex-shrink:0;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="'+alertIconColor+'" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg></div><span style="color:'+alertTextColor+';font-weight:500;">'+alertMsg+'</span></div>';

  var dc=document.getElementById('c-delta');
  dc.style.background='rgba(255,255,255,0.18)';
  dc.style.border='1px solid rgba(255,255,255,0.32)';
  dc.style.boxShadow='0 12px 32px rgba(10,20,80,0.45), inset 0 1px 0 rgba(255,255,255,0.35)';
  var deltaSubtitle = cPlan==='b' ? 'visibilidad en red + 1 comisión pasiva' : cPlan==='p' ? 'agenda llena + comisiones + derivaciones' : 'máximo potencial — agenda + red + comisiones';
  dc.innerHTML='<div><div style="font-size:11px;font-weight:700;color:rgba(255,255,255,0.7);text-transform:uppercase;letter-spacing:.08em;margin-bottom:3px;">Ganancia adicional mensual</div><div style="font-size:14px;font-weight:600;color:rgba(255,255,255,0.85);">con '+p.name+'</div><div style="font-size:11px;color:rgba(255,255,255,0.5);margin-top:3px;">'+deltaSubtitle+'</div></div><div style="font-size:clamp(22px,6vw,38px);font-weight:700;color:#fff;letter-spacing:-.5px;text-shadow:0 2px 12px rgba(0,0,0,0.25);white-space:nowrap;">'+cf(d.ganancia)+'</div>';

  var rowsSin=[['Ingresos brutos/mes',cf(d.hw*SEM*vh)+'  ('+d.hw+' hrs/sem × 4.33)',''],['Cancelaciones','−25%  →  '+cf(d.ingrSin),'#7D1E7B'],['Gestión/día',d.hg+' hr — pierdes '+cf(d.costoGest)+'/mes','#7D1E7B'],['Conversión','6 de 100 consultas → paciente','#7D1E7B'],['Comisiones','$0','#7D1E7B'],['Derivaciones','$0','#7D1E7B']];
  var rowsCon=[['Ingresos brutos/mes',cf(d.bruto)+'  (jornada completa)',''],['Cancelaciones','−'+Math.round(p.cancel*100)+'%  →  '+cf(d.neto),''],['Gestión residual',p.hgMin+' min/día  (informativo)',''],['Conversión',Math.round(p.convH*100)+' de 100  (informativo)',''],['Comisiones pasivas',p.comN+' × $40k × 50%  =  +'+cf(d.comTotal),''],['Derivaciones',p.derivN>0?p.derivN+' × $40k × 15%  =  +'+cf(d.ingDeriv):'$0','']];

  document.getElementById('c-compare').innerHTML=
    '<div style="background:rgba(255,255,255,0.1);border-radius:12px;padding:16px 18px;"><div style="font-size:14px;font-weight:700;color:rgba(255,255,255,0.65);margin-bottom:12px;">📅 Hoy — sin Heavensy</div><div style="font-size:28px;font-weight:700;color:#fff;line-height:1;margin-bottom:12px;">'+cf(d.ingrSin)+'</div>'+rowsSin.map(function(r){return '<div style="display:flex;justify-content:space-between;font-size:11.5px;padding:5px 0;border-bottom:0.5px solid rgba(255,255,255,0.1);gap:8px;"><span style="color:rgba(255,255,255,0.55);flex-shrink:0;">'+r[0]+'</span><span style="font-weight:500;'+(r[2]?'color:'+r[2]+';':'color:rgba(255,255,255,0.85);')+'text-align:right;">'+r[1]+'</span></div>';}).join('')+'</div>'+
    '<div style="background:'+bg+';border-radius:12px;padding:16px 18px;color:#fff;"><div style="font-size:14px;font-weight:700;color:rgba(255,255,255,.95);margin-bottom:12px;">✦ Con '+p.name+'</div><div style="font-size:28px;font-weight:700;color:#fff;line-height:1;margin-bottom:12px;">'+cf(d.totalH)+'</div>'+rowsCon.map(function(r){return '<div style="display:flex;justify-content:space-between;font-size:11.5px;padding:5px 0;border-bottom:0.5px solid rgba(255,255,255,.15);gap:8px;"><span style="opacity:.8;flex-shrink:0;">'+r[0]+'</span><span style="font-weight:500;text-align:right;">'+r[1]+'</span></div>';}).join('')+'</div>';

  var totalExtra = d.comTotal + d.ingDeriv;
  document.getElementById('c-passive').innerHTML='<div style="padding:16px 18px;background:rgba(39,174,96,0.28);border-radius:14px;border:1px solid rgba(74,222,128,0.35);box-shadow:0 8px 24px rgba(10,20,80,0.35),inset 0 1px 0 rgba(74,222,128,0.3);"><div style="text-align:center;margin-bottom:10px;"><div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#a7f3d0;margin-bottom:4px;">+ Ingresos adicionales Heavensy</div><div style="font-size:30px;font-weight:700;color:#4ade80;line-height:1;margin-bottom:6px;">'+cf(totalExtra)+' / mes</div></div>'+(p.comN>0?'<div class="calc-passive-grid" style="display:grid;gap:8px;margin-bottom:10px;"><div style="background:rgba(39,174,96,.18);border-radius:8px;padding:10px 12px;"><div style="font-size:10px;font-weight:700;color:#a7f3d0;margin-bottom:3px;">COMISIONES PASIVAS</div><div style="font-size:17px;font-weight:700;color:#4ade80;">'+cf(d.comTotal)+'/mes</div></div><div style="background:rgba(39,174,96,.18);border-radius:8px;padding:10px 12px;"><div style="font-size:10px;font-weight:700;color:#a7f3d0;margin-bottom:3px;">DERIVACIONES</div><div style="font-size:17px;font-weight:700;color:#4ade80;">'+(p.derivN>0?cf(d.ingDeriv):'$0')+'/mes</div></div></div>':'')+'</div>';

  var totalFinal = document.getElementById('c-total-final');
  if(totalFinal){
    totalFinal.innerHTML='<div class="calc-total-bar" style="display:flex;background:'+bg+';border-radius:12px;box-shadow:0 12px 32px rgba(10,20,80,0.45),inset 0 1px 0 rgba(255,255,255,0.25);border:1px solid rgba(255,255,255,0.2);"><div><div style="font-size:11px;font-weight:700;color:rgba(255,255,255,.7);text-transform:uppercase;letter-spacing:.08em;margin-bottom:3px;">Total mensual estimado</div><div style="font-size:20px;font-weight:700;color:rgba(255,255,255,.95);">con '+p.name+'</div></div><div style="font-size:38px;font-weight:700;color:#fff;letter-spacing:-.5px;">'+cf(d.totalH)+'</div></div>'+(cPlan==='s'?'<div style="text-align:center;padding:14px 24px 4px;font-size:15px;font-weight:600;font-style:italic;color:#fff;">✨ ¿Sabías que con este plan puedes tener más de una empresa y multiplicar esta cifra?</div>':'');
  }
  document.getElementById('c-nota').textContent='';
}

function cSetPlan(pl){ cPlan=pl; cRender(); }

['c-vh','c-hw','c-hd','c-hg'].forEach(function(id){
  var el=document.getElementById(id);
  if(el) el.addEventListener('input',cRender);
});

// ── CHAT ──
(function() {
  const btn = document.getElementById('chatBubbleBtn');
  const panel = document.getElementById('chatPanel');
  const closeBtn = document.getElementById('chatCloseBtn');
  const input = document.getElementById('chatInput');
  const sendBtn = document.getElementById('chatSendBtn');
  const messagesEl = document.getElementById('chatMessages');
  const quickRepliesEl = document.getElementById('quickReplies');

  function toggleChat() {
    const isOpen = panel.classList.toggle('open');
    btn.classList.toggle('open', isOpen);
    if (isOpen) { setTimeout(() => input.focus(), 300); scrollToBottom(); }
  }

  window.toggleChat = toggleChat;
  btn.addEventListener('click', toggleChat);
  closeBtn.addEventListener('click', toggleChat);

  setTimeout(() => { if (!panel.classList.contains('open')) toggleChat(); }, 4000);

  function scrollToBottom() { messagesEl.scrollTop = messagesEl.scrollHeight; }
  function getTime() { return new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }); }

  let chatMsgs = JSON.parse(localStorage.getItem('hv_chat_msgs') || '[]');

  function addMessage(text, sender, skipSave) {
    const msg = document.createElement('div');
    msg.className = 'msg ' + sender;
    if (sender === 'bot') {
      msg.innerHTML = `<div class="msg-avatar">H</div><div><div class="msg-bubble">${text}</div><span class="msg-time">${getTime()}</span></div>`;
    } else {
      msg.innerHTML = `<div><div class="msg-bubble">${text}</div><span class="msg-time">${getTime()}</span></div>`;
    }
    messagesEl.appendChild(msg);
    scrollToBottom();
    if (!skipSave) { chatMsgs.push({ text, sender }); localStorage.setItem('hv_chat_msgs', JSON.stringify(chatMsgs)); }
  }

  (function loadSavedMsgs() {
    if (chatMsgs.length > 0) {
      messagesEl.innerHTML = '';
      chatMsgs.forEach(function(m) { addMessage(m.text, m.sender, true); });
      if (localStorage.getItem('hv_chat_qr_hidden') === '1') quickRepliesEl.style.display = 'none';
    }
  })();

  function showTyping() {
    const typing = document.createElement('div');
    typing.className = 'typing-indicator';
    typing.id = 'typingIndicator';
    typing.innerHTML = `<div class="msg-avatar" style="width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,#8E89E8,#5E75BE);display:flex;align-items:center;justify-content:center;font-size:.8rem;color:#fff;flex-shrink:0;">H</div><div class="typing-dots"><span></span><span></span><span></span></div>`;
    messagesEl.appendChild(typing);
    scrollToBottom();
  }

  function removeTyping() { const t = document.getElementById('typingIndicator'); if (t) t.remove(); }

  const responses = {
    'cómo funciona': '¡Genial pregunta! 🚀 Heavensy conecta emprendedores con herramientas de gestión. En 3 pasos: te registras, configuras tu perfil y empiezas a crecer.',
    'planes': '💎 Tenemos planes para cada etapa:\n• <strong>Básico</strong> — gratis\n• <strong>Automate Pro</strong> — para escalar\n• <strong>Secretar-IA Premium</strong> — solución completa',
    'precios': '💎 Tenemos planes para cada etapa:\n• <strong>Básico</strong> — gratis\n• <strong>Automate Pro</strong> — $70.000/mes\n• <strong>Secretar-IA Premium</strong> — $120.000/mes',
    'unirme': '¡Nos encantaría tenerte! 🎉 Haz clic en "Empezar gratis", completa tu perfil y empieza.',
    'default': '¡Gracias por tu mensaje! 😊 Un miembro de nuestro equipo te responderá muy pronto.'
  };

  function getBotResponse(text) {
    const lower = text.toLowerCase();
    for (const key of Object.keys(responses)) {
      if (key !== 'default' && lower.includes(key)) return responses[key];
    }
    return responses['default'];
  }

  function sendMessage(text) {
    if (!text.trim()) return;
    quickRepliesEl.style.display = 'none';
    localStorage.setItem('hv_chat_qr_hidden', '1');
    addMessage(text, 'user');
    input.value = '';
    sendBtn.disabled = true;
    showTyping();
    setTimeout(() => { removeTyping(); addMessage(getBotResponse(text), 'bot'); sendBtn.disabled = false; }, 1000 + Math.random() * 800);
  }

  sendBtn.addEventListener('click', () => sendMessage(input.value));
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendMessage(input.value); });
  input.addEventListener('input', () => { sendBtn.disabled = input.value.trim().length === 0; });
  sendBtn.disabled = true;

  window.sendQuickReply = function(el, text) { el.disabled = true; sendMessage(text); };
})();
