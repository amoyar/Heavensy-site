// ══════════════════════════════════════════════════════════════
//  CONFIG-RUBRO — Paso "Mi empresa" adaptativo por rubro (Fase 3.2)
//  Módulo independiente: construye en runtime la barra de contexto
//  (rubro + categorías, solo lectura), las pestañas Recursos/Cuentas
//  y la vista de recursos según business.recursos del catálogo.
//  configuracion.js queda intacto; si el sector no tiene catálogo
//  de recursos, esta capa no se activa y la página opera como antes.
// ══════════════════════════════════════════════════════════════
// ── BITÁCORA ── (solo cambios recientes; histórico podado)
// [v2026.06.29-1] config-rubro.js
// 2026-06-29 | _crTogglePaso3: el deshabilitado del paso Especialidad delega el estilo a la
//   clase .step.disabled (vía _cfgPaintSteps) y usa el title nativo. Se quitó pointer-events:
//   none para que el tooltip/cursor se vean al hover; el bloqueo real lo dan removeAttribute
//   (onclick) + el guard de goStep.
// [v2026.06.24-1] config-rubro.js
// 2026-06-24 | _crRender: un PROFESIONAL_ROL ve en "Mi equipo" SOLO su propio recurso
//   (vinculado a su user_id del JWT); admin/secretaria ven todos. Stats y lista usan
//   _baseRec; _crRecursos global intacto. Medida momentánea (opción 2).
// [v2026.06.23-2] config-rubro.js
// 2026-06-23 | Especialidades PROPIAS: cada chip propio con lápiz (renombrar inline,
//   conserva la key → no recolga servicios) y ✕ (quitar; se persiste al Guardar y el
//   Tema 1 desactiva sus agenda_services). Estado _crEditingPropiaKey.
// [v2026.06.23-1] 2026-06-23 | Tema 1: al guardar el profesional (crGuardar), si se quitaron
//   especialidades se detectan y desactivan sus agenda_services (cfgConfirm +
//   _cfgDesactivarServicios de configuracion.js; originales en _crSpecsOrig). Solo
//   persona + edición; cancelar = no guarda. Base: editor "Mi empresa" adaptativo por rubro.

(function(){
'use strict';

let _crCompany = null;   // doc de la empresa (profesiones[], business_config)
let _crCompanyId = null;  // company_id con el que se activó el módulo
let _crSector  = null;   // doc del sector (business, profesiones[])
let _crRec     = null;   // atajo: _crSector.business.recursos
let _crRecursos = [];    // recursos de la empresa
let _crUsersById = {};   // usuarios de la empresa por _id (para email/username en tabla)
let _crCatFiltro = '';
let _crEditId  = null;   // recurso en edición (null = nuevo)
let _crTipoId  = null;   // resource_type_id por defecto (requerido por el POST)
let _crBusy    = false;  // anti-concurrencia: crInit en vuelo (evita doble montaje)
let _crDispRecId = null; // recurso activo en el panel Disponibilidad (objetos)
let _crDispCfgGlobal = {}; // config global de la empresa (fallback heredado por recurso)
let _crSpecsSel = [];      // especialidades marcadas del recurso en edición (Fase B): [{key,nombre,propia}]
let _crSpecsOrig = [];     // especialidades ORIGINALES al abrir el editor (Tema 1: detectar quitadas)
let _crEditingPropiaKey = null;   // key de la propia que se está renombrando inline (o null)

const $ = s => document.querySelector(s);

function _catKeys(){ return (_crCompany?.profesiones) || []; }
function _catName(k){
  const p = (_crSector?.profesiones || []).find(x => x.profession_key === k);
  return p ? (p.name || k) : k;
}
// ── Especialidades del catálogo (Fase B) ──────────────────────────────────
// Devuelve el array especialidades[] de UNA categoría (profession_key) del
// sector actual: [{key, nombre, active}]. Solo las activas.
function _crEspecialidadesDeCategoria(profKey){
  const p = (_crSector?.profesiones || []).find(x => x.profession_key === profKey);
  return ((p && p.especialidades) || []).filter(e => e && e.active !== false);
}
// Normaliza un texto a key (minúscula, sin tildes ni símbolos) — misma regla
// que el seed/backend, para que una especialidad propia matchee aunque se
// escriba distinto ("Inglés" y "ingles" → "ingles").
function _crSlug(texto){
  return (texto || '')
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}
// Normaliza specialties del recurso a array de objetos {key, nombre, propia}.
// Tolera el formato viejo (array de strings) por si quedara alguno, aunque la
// decisión fue "empezar limpio".
function _crNormSpecs(arr){
  return (arr || []).map(s => {
    if (typeof s === 'string') return { key: _crSlug(s), nombre: s, propia: true };
    return { key: s.key || _crSlug(s.nombre), nombre: s.nombre || s.key, propia: !!s.propia };
  });
}
function _esPersona(){ return (_crRec?.naturaleza || 'persona') === 'persona'; }
function _lbl(k, def){ return (_crRec?.labels || {})[k] || def; }

// ── Estilos del módulo (inyectados una vez) ──
// (estilos del módulo: en configuracion.css, sección CONFIG-RUBRO)

// ── Carga de contexto: empresa + sector del catálogo ──
async function _crCargar(){
  const cid = localStorage.getItem('company_id');
  if (!cid || typeof apiCall !== 'function') return false;
  const rc = await apiCall('/api/companies/' + cid).catch(() => null);
  _crCompany = rc?.data?.company || rc?.data || null;
  if (!_crCompany) return false;
  _crCompanyId = cid;
  const sectorKey = _crCompany.business_config?.template || _crCompany.sector || '';
  if (!sectorKey) return false;
  const rs = await apiCall('/api/sectores/' + sectorKey).catch(() => null);
  _crSector = rs?.data?.sector || rs?.data || null;
  _crRec = _crSector?.business?.recursos || null;
  // Default de pausa de almuerzo del sector (lo usa el toggle de almuerzo en
  // configuracion.js). has_lunch_break en resource_defaults. [16-06]
  window._cfgSectorLunchDefault = !!(_crSector?.business?.resource_defaults?.has_lunch_break);
  return !!_crRec;   // sin catálogo de recursos → no se activa la capa
}

// ── Barra de contexto (solo lectura) ──
function _crCtxBar(){
  if ($('#cr-ctx')) return;
  const icon = _crSector.icon || '🏢';
  const cats = _catKeys().map(k => `<span class="cr-cat">${_catName(k)}</span>`).join('') ||
               '<span style="color:#a8aed1">sin categorías asignadas</span>';
  const bar = document.createElement('div');
  bar.id = 'cr-ctx'; bar.className = 'cr-ctx';
  bar.innerHTML = `<b>${icon} ${_crSector.name || ''}</b>
    <span style="font-size:9.5px;font-weight:700;color:#7D84C1;text-transform:uppercase">Categorías:</span>
    ${cats}<span class="cr-lock"><i class="fas fa-lock"></i> Definidos al crear la empresa</span>`;
  const wrap = $('#cr-wrap');
  wrap.insertBefore(bar, wrap.firstChild);
}

// ── Labels de pasos desde business.pasos ──
function _crPasos(){
  const p = _crSector?.business?.pasos || {};
  if (!_crStepOrig){ _crStepOrig = {}; [2,3].forEach(i => { const el = document.querySelector('#step-'+i+' .step-label'); if (el) _crStepOrig[i] = el.textContent; }); }
  const map = { 2: p.especialidad, 3: p.servicios };
  Object.entries(map).forEach(([i, label]) => {
    if (!label) return;
    const el = document.querySelector('#step-' + i + ' .step-label');
    if (el) el.textContent = label;
  });

  // [20-06] Paso 3 (step-2 "Especialidad") deshabilitado para PERSONA: las
  // especialidades ya se editan en el paso 1 (panel de config-rubro). Para OBJETO
  // se deja habilitado porque ahí tiene contenido propio (características del
  // recinto + cómo llegar). No se elimina nada, solo se bloquea el acceso.
  _crTogglePaso3();
}

// Habilita/deshabilita el acceso al paso 3 (step-2) según naturaleza.
function _crTogglePaso3(){
  const step = document.getElementById('step-2');
  if (!step) return;
  const esObjeto = _crRec && _crRec.naturaleza === 'objeto';
  if (esObjeto){
    // Restaurar acceso (por si venía deshabilitado de otra empresa)
    if (step.dataset.crDisabled === '1'){
      step.dataset.crDisabled = '';
      if (step.dataset.crOnclick){ step.setAttribute('onclick', step.dataset.crOnclick); }
      step.title = '';
      if (typeof _cfgPaintSteps === 'function') _cfgPaintSteps(typeof cfgCurrentStep !== 'undefined' ? cfgCurrentStep : 0);
    }
  } else {
    // Persona: deshabilitar acceso. El estilo (atenuado + cursor not-allowed) lo aplica la
    // clase .step.disabled vía _cfgPaintSteps; aquí solo marcamos el flag, quitamos el onclick
    // (bloqueo real) y ponemos el texto del tooltip (title nativo). Ya NO usamos
    // pointer-events:none, para que el tooltip y el cursor se vean al hover.
    if (step.dataset.crDisabled !== '1'){
      step.dataset.crDisabled = '1';
      if (step.getAttribute('onclick')) step.dataset.crOnclick = step.getAttribute('onclick');
      step.removeAttribute('onclick');
      step.title = 'Se configura en el paso 1, por profesional.';
      if (typeof _cfgPaintSteps === 'function') _cfgPaintSteps(typeof cfgCurrentStep !== 'undefined' ? cfgCurrentStep : 0);
    }
  }
  _crInstalarGoStepGuard();
}

// Intercepta goStep una sola vez: si es persona y se pide el paso 2 (Especialidad,
// deshabilitado), redirige saltándolo — hacia adelante va al 3, hacia atrás al 1.
// Cubre todos los accesos (barra, botones Continuar/Volver) en un solo lugar.
function _crInstalarGoStepGuard(){
  if (window._crGoStepGuard) return;
  if (typeof window.goStep !== 'function') return;
  const orig = window.goStep;
  window._crGoStepOrig = orig;
  window.goStep = function(n){
    const esPersona = !(_crRec && _crRec.naturaleza === 'objeto');
    if (esPersona && n === 2){
      const actual = (typeof cfgCurrentStep !== 'undefined') ? cfgCurrentStep : 1;
      n = (actual >= 2) ? 1 : 3;   // venías de adelante → 1; de atrás → 3
    }
    return orig.call(this, n);
  };
  window._crGoStepGuard = true;
}

// ── Pestañas: mover lo existente a "Cuentas" y crear "Recursos" ──
function _crTabs(){
  const panel = $('#panel-0');
  if (!panel || $('#cr-tab-recursos')) return;
  const cuentas = document.createElement('div'); cuentas.id = 'cr-tab-cuentas';
  while (panel.firstChild) cuentas.appendChild(panel.firstChild);   // contenido actual intacto
  const recursos = document.createElement('div'); recursos.id = 'cr-tab-recursos';
  const tabs = document.createElement('div'); tabs.className = 'cr-tabs';
  tabs.innerHTML = `
    <button class="cr-tab on" id="cr-btn-rec">${_lbl('titulo', 'Recursos')}</button>
    <button class="cr-tab" id="cr-btn-cta">Cuentas de acceso</button>`;
  // Wrapper .content: el mismo sistema de padding de la página (v4) —
  // cuentas queda fuera porque conserva su .content original adentro.
  const wrap = document.createElement('div');
  wrap.className = 'content'; wrap.id = 'cr-wrap';
  wrap.appendChild(tabs); wrap.appendChild(recursos);
  panel.appendChild(wrap); panel.appendChild(cuentas);
  cuentas.style.display = 'none';
  $('#cr-btn-rec').onclick = () => _crVerTab(true);
  $('#cr-btn-cta').onclick = () => _crVerTab(false);
}
function _crVerTab(rec){
  $('#cr-tab-recursos').style.display = rec ? '' : 'none';
  $('#cr-tab-cuentas').style.display  = rec ? 'none' : '';
  $('#cr-btn-rec').classList.toggle('on', rec);
  $('#cr-btn-cta').classList.toggle('on', !rec);
  // Recarga de datos al cambiar de pestaña, para que los cambios hechos en una
  // (p.ej. marcar recurso) se reflejen en la otra sin tener que refrescar (F5). [16-06]
  if (rec) {
    if (typeof _crLoadRecursos === 'function') _crLoadRecursos();
  } else {
    if (typeof cfgLoadFromBackend === 'function') cfgLoadFromBackend();
  }
}

// ── Vista de recursos ──
async function _crLoadRecursos(){
  const r = await apiCall('/api/agenda/resources?include_inactive=1').catch(() => null);
  _crRecursos = r?.data?.resources || [];
  const t = await apiCall('/api/agenda/resource-types').catch(() => null);
  const _tipos = t?.data?.resource_types || t?.data?.types || [];
  // El resource_type correcto es el cuyo `activity` coincide con el
  // availability_mode del sector (los tipos nuevos usan activity=availability_mode).
  // Fallbacks: si no hay match, intenta por_hora; si tampoco, el primero. [16-06]
  const _modo = _crSector?.business?.availability_mode || 'por_hora';
  _crTipoId = (
    _tipos.find(x => x.activity === _modo) ||
    _tipos.find(x => x.activity === 'por_hora') ||
    _tipos[0] || {}
  )._id || null;
  // Mapa de usuarios por _id, para mostrar email/username reales del vinculado.
  if (_esPersona()){
    const users = await _crCargarUsuariosEmpresa();
    _crUsersById = {};
    users.forEach(u => { const id = u._id || u.id; if (id) _crUsersById[id] = u; });
  }
  _crRender();
}

function _crRender(){
  const cont = $('#cr-tab-recursos'); if (!cont) return;
  const esP = _esPersona();
  // Filtro por ROL (medida momentánea — opción 2): un PROFESIONAL_ROL ve en "Mi equipo"
  // SOLO su propio recurso (el vinculado a su user_id); admin/supervisor/operador/
  // asistente ven todos. Rol e identidad salen del JWT. Token ilegible -> no filtra. [24-06]
  let _baseRec = _crRecursos;
  try {
    const _tok    = JSON.parse(atob((localStorage.getItem('token') || '').split('.')[1]));
    const _roles  = _tok.roles || [];
    const _seeAll = ['ADMIN_ROL', 'SUPERVISOR_ROL', 'OPERADOR_ROL', 'ASISTENTE_ROL'];
    if (_roles.includes('PROFESIONAL_ROL') && !_roles.some(r => _seeAll.includes(r))) {
      const _myId = String(_tok.user_id || _tok.sub || '');
      _baseRec = (_crRecursos || []).filter(r => String(r.user_id || '') === _myId);
    }
  } catch (e) { /* token ilegible -> no filtra (comportamiento actual) */ }
  const filas = _baseRec.filter(r => !_crCatFiltro || r.profession_key === _crCatFiltro);
  const vinculados = _baseRec.filter(r => r.user_id).length;
  const cols = _crRec.columnas || ['Nombre','Categoría','Activo','Acciones'];

  cont.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:10px">
      <div><div style="font-size:15px;font-weight:800;color:#1e2a5e">${_lbl('titulo','Recursos')}</div>
        <div style="font-size:11px;color:#7D84C1">${_lbl('subtitulo','')}</div></div>
      <button class="btn-primary" onclick="crNuevo()"><i class="fas fa-plus" style="margin-right:6px"></i>${_lbl('btn_nuevo','Nuevo')}</button>
    </div>
    <div class="cr-stats">
      <div class="cr-stat"><div class="n">${_baseRec.length}</div><div class="l">Total ${(_lbl('plural','recursos')).toLowerCase()}</div></div>
      <div class="cr-stat"><div class="n" style="color:#10b981">${_baseRec.length}</div><div class="l">Activos</div></div>
      <div class="cr-stat"><div class="n" style="color:#9961FF">${esP ? vinculados : filas.length}</div><div class="l">${esP ? 'Con acceso al sistema' : _lbl('stat_extra','—')}</div></div>
    </div>
    <div id="cr-form-wrap"></div>
    <div class="card" style="background:#fff;border:.5px solid #C9D9FF;border-radius:12px;overflow:hidden">
      <div style="padding:8px 12px;display:flex;gap:6px;flex-wrap:wrap;align-items:center;border-bottom:.5px solid #f0f3fa">
        <span style="font-size:9.5px;font-weight:700;color:#7D84C1;text-transform:uppercase">Categoría:</span>
        <span class="cr-chip ${!_crCatFiltro?'on':''}" onclick="crFiltro('')">Todas</span>
        ${_catKeys().map(k => `<span class="cr-chip ${_crCatFiltro===k?'on':''}" onclick="crFiltro('${k}')">${_catName(k)}</span>`).join('')}
      </div>
      <div style="overflow-x:auto"><table class="cr-table">
        <thead><tr>${cols.map(c => `<th>${c}</th>`).join('')}</tr></thead>
        <tbody>${filas.map(_crFila).join('') || `<tr><td colspan="${cols.length}" style="color:#a8aed1;text-align:center;padding:18px">Sin ${(_lbl('plural','recursos')).toLowerCase()} aún</td></tr>`}</tbody>
      </table></div>
    </div>`;
}

function _crFila(r){
  const esP = _esPersona();
  const f = r.fields || {};
  const campos = (_crRec.campos || []);
  // Formatea el valor de una celda según el tipo/clave del campo: los de precio
  // se muestran como moneda chilena ($50.000). [14-06]
  const _fmtCelda = (campo) => {
    const val = f[campo?.key];
    if (val === undefined || val === null || val === '') return '—';
    const esPrecio = campo?.tipo === 'price' || /precio|valor|monto/i.test(campo?.key || '');
    if (esPrecio) {
      const n = Number(String(val).replace(/[^0-9.-]/g, ''));
      if (!isNaN(n)) return '$' + n.toLocaleString('es-CL');
    }
    return val;
  };
  // celdas intermedias según naturaleza (alineadas a las columnas sembradas)
  const u = r.user_id ? _crUsersById[r.user_id] : null;
  const emailReal = (r.email || u?.email || '').trim();
  const userReal  = (u?.username || '').trim();
  const medias = esP
    ? `<td>${emailReal || (r.user_id ? '<span class="cr-badge"><i class="fas fa-user-check"></i> Vinculado</span>' : '<span style="color:#ef4444;font-size:10.5px;font-weight:700">Sin usuario</span>')}</td>
       <td>${userReal ? userReal : (r.user_id ? '<span class="cr-badge">Vinculado</span>' : '<span style="color:#a8aed1">—</span>')}</td>`
    : `<td>${_fmtCelda(campos[0])}</td>
       <td>${(r.features || []).slice(0,3).join(' · ') || '—'}</td>
       <td style="font-weight:700">${_fmtCelda(campos[2])}</td>`;
  const inactiva = r.active === false;
  return `<tr style="${inactiva ? 'opacity:.5' : ''}">
    <td><div style="display:flex;align-items:center;gap:8px">
      <span style="width:26px;height:26px;border-radius:50%;background:${r.color||'#9961FF'};color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:10px;font-weight:700">${(r.name||'?').slice(0,2).toUpperCase()}</span>
      <span style="font-weight:600">${r.name||''}</span>${inactiva ? ' <span style="font-size:9.5px;font-weight:700;color:#ef4444;text-transform:uppercase">Inactiva</span>' : ''}</div></td>
    <td>${r.profession_key ? `<span class="cr-badge">${_catName(r.profession_key)}</span>` : '<span style="color:#a8aed1">—</span>'}</td>
    ${medias}
    <td><label class="switch"><input type="checkbox" ${r.active!==false?'checked':''} onchange="crToggle('${r._id}', this.checked)"><span class="slider"></span></label></td>
    <td style="white-space:nowrap">
      <button class="btn-icon" style="color:#5b8dee" onclick="crEditar('${r._id}')"><i class="fas fa-pen"></i></button>
    </td></tr>`;
}

// ── Formulario nuevo/editar ──
window.crNuevo = function(){ _crEditId = null; _crForm({}); };
window.crEditar = function(id){
  const r = _crRecursos.find(x => x._id === id); if (!r) return;
  _crEditId = id; _crForm(r);
};
function _crForm(r){
  const esP = _esPersona();
  const f = r.fields || {};
  const feats = r.features || [];
  const sug = _crRec.caracteristicas_sugeridas || [];
  const todas = [...new Set([...sug, ...feats])];
  // Estado de especialidades del recurso (Fase B): objetos {key, nombre, propia}.
  // _crSpecsSel = las que el recurso tiene marcadas; sobrevive a repintados al
  // cambiar de categoría, para no perder las propias ya agregadas.
  _crSpecsSel = _crNormSpecs(r.specialties);
  _crSpecsOrig = _crNormSpecs(r.specialties);   // Tema 1: copia separada para detectar quitadas
  // Modos de trabajo del recurso (para el molde persona). [20-06]
  const _crMods = (r.modalities || r.modalidades || []).map(m => String(m).toLowerCase());
  $('#cr-form-wrap').innerHTML = `
  <div class="cr-form">
    <div style="font-size:12px;font-weight:700;color:#7c3aed;margin-bottom:10px">
      <i class="fas fa-${_crEditId?'pen':'plus'}" style="margin-right:6px"></i>${_crEditId ? 'Editar' : _lbl('btn_nuevo','Nuevo')}</div>
    <div class="cr-grid">
      <div><label>${_lbl('lbl_nombre','Nombre')}</label><input id="cr-f-nombre" value="${(r.name||'').replace(/"/g,'&quot;')}"></div>
      <div><label>Categoría</label>
        <input type="hidden" id="cr-f-cat" value="${r.profession_key||''}">
        <div class="toggle-group" id="cr-f-cat-chips">
          ${_catKeys().map(k => `<span class="toggle-btn ${r.profession_key===k?'on':''}" data-k="${k}"
            onclick="crSelCat('cr-f-cat', this)">${_catName(k)}</span>`).join('')}
        </div></div>
      <div><label>Color en calendario</label><input id="cr-f-color" type="color" value="${r.color||'#9961FF'}" style="height:34px;padding:2px"></div>
    </div>
    <div class="cr-grid">
      ${(_crRec.campos||[]).map(c => `<div><label>${c.label}</label>
        <input id="cr-f-${c.key}" type="${c.tipo==='number'?'number':'text'}"${c.tipo==='number'?' min="0"':''} placeholder="${c.placeholder||''}" value="${f[c.key]!==undefined?String(f[c.key]).replace(/"/g,'&quot;'):''}"></div>`).join('')}
    </div>
    ${esP ? `
    <div class="cr-block-p">
      <div style="font-size:11.5px;font-weight:700;color:#5b4bbd;margin-bottom:4px"><i class="fas fa-user-check"></i> ¿Qué profesional?</div>
      <div style="font-size:10.5px;color:#7a6db0;margin-bottom:8px">Elige un usuario marcado como recurso. Será el profesional reservable.</div>
      <div id="cr-cand-list" style="display:flex;flex-direction:column;gap:6px"><div style="font-size:10.5px;color:#a8aed1">Cargando candidatos…</div></div>
      <input id="cr-f-user-q" placeholder="Buscar otro usuario marcado…" oninput="crBuscarUser(this.value)" style="max-width:320px;margin-top:8px">
      <div id="cr-user-sug" style="margin-top:6px"></div>
      <input type="hidden" id="cr-f-user-id" value="${r.user_id||''}">
    </div>
    <div class="cr-block-o">
      <div style="font-size:11.5px;font-weight:700;color:#d97706;margin-bottom:6px"><i class="fas fa-image"></i> Foto</div>
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">
        <div id="cr-f-foto-prev" style="width:64px;height:64px;border-radius:10px;background:#f0eefc center/cover no-repeat;${r.photo_url?`background-image:url('${r.photo_url}')`:''};display:flex;align-items:center;justify-content:center;color:#b9a8e8;flex-shrink:0">${r.photo_url?'':'<i class="fas fa-image"></i>'}</div>
        <div>
          <input type="hidden" id="cr-f-photo" value="${r.photo_url||''}">
          <button type="button" class="btn-secondary" onclick="document.getElementById('cr-f-foto-input').click()"><i class="fas fa-upload" style="margin-right:5px"></i>${r.photo_url?'Cambiar foto':'Subir foto'}</button>
          <input type="file" id="cr-f-foto-input" accept="image/*" style="display:none" onchange="crSubirFotoRecurso(this)">
          <div class="cr-sug">Se mostrará en la tarjeta de la página pública.</div>
        </div>
      </div>
      <div style="font-size:11.5px;font-weight:700;color:#d97706;margin-bottom:4px"><i class="fas fa-tags"></i> Especialidades</div>
      <div class="cr-sug">Del catálogo de la categoría — toca para marcar; agrega propias abajo.</div>
      <div id="cr-specs"></div>
      <div style="display:flex;gap:6px;margin-top:8px;max-width:300px">
        <input id="cr-f-spec-nueva" placeholder="Agregar especialidad propia…">
        <button class="btn-secondary" onclick="crAddSpecPropia()" type="button"><i class="fas fa-plus"></i></button>
      </div>
      <div class="cr-sug" style="margin-top:4px">Las propias se guardan solo en este profesional.</div>

      <div style="border-top:1px solid #ece9f7;margin:14px 0 12px"></div>
      <div style="font-size:11.5px;font-weight:700;color:#5b4bbd;margin-bottom:6px"><i class="fas fa-location-dot"></i> Modos de trabajo</div>
      <div class="toggle-group" id="cr-modos">
        <span class="toggle-btn ${_crMods.includes('presencial')?'on':''}" onclick="this.classList.toggle('on')">Presencial</span>
        <span class="toggle-btn ${_crMods.includes('online')?'on':''}" onclick="this.classList.toggle('on')">Online</span>
        <span class="toggle-btn ${_crMods.includes('domicilio')?'on':''}" onclick="this.classList.toggle('on')">A domicilio</span>
      </div>
    </div>` : `
    <div class="cr-block-o">
      <div style="font-size:11.5px;font-weight:700;color:#d97706;margin-bottom:6px"><i class="fas fa-image"></i> Foto</div>
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">
        <div id="cr-f-foto-prev" style="width:64px;height:64px;border-radius:10px;background:#f0eefc center/cover no-repeat;${r.photo_url?`background-image:url('${r.photo_url}')`:''};display:flex;align-items:center;justify-content:center;color:#b9a8e8;flex-shrink:0">${r.photo_url?'':'<i class="fas fa-image"></i>'}</div>
        <div>
          <input type="hidden" id="cr-f-photo" value="${r.photo_url||''}">
          <button type="button" class="btn-secondary" onclick="document.getElementById('cr-f-foto-input').click()"><i class="fas fa-upload" style="margin-right:5px"></i>${r.photo_url?'Cambiar foto':'Subir foto'}</button>
          <input type="file" id="cr-f-foto-input" accept="image/*" style="display:none" onchange="crSubirFotoRecurso(this)">
          <div class="cr-sug">Se mostrará en la tarjeta de la página pública.</div>
        </div>
      </div>
      <div style="font-size:11.5px;font-weight:700;color:#d97706;margin-bottom:4px"><i class="fas fa-tags"></i> ${_lbl('caracteristicas_titulo','Características')}</div>
      <div class="cr-sug">Toca para marcar las que aplican; agrega otras abajo.</div>
      <div id="cr-feats">${todas.map(t => `<span class="cr-fchip ${feats.includes(t)?'on':''}" onclick="this.classList.toggle('on')">${t}</span>`).join('')}</div>
      <div style="display:flex;gap:6px;margin-top:8px;max-width:300px">
        <input id="cr-f-feat-nueva" placeholder="Otra característica…">
        <button class="btn-secondary" onclick="crAddFeat()" type="button"><i class="fas fa-plus"></i></button>
      </div>
    </div>`}
    <div style="display:flex;gap:8px">
      <button class="btn-primary" onclick="crGuardar()"><i class="fas fa-check" style="margin-right:5px"></i>Guardar</button>
      <button class="btn-secondary" onclick="document.getElementById('cr-form-wrap').innerHTML=''">Cancelar</button>
    </div>
  </div>`;
  if (esP) { _crPintarCandidatos(r.user_id || ''); _crRenderSpecs(); }
}

// Pinta la lista de candidatos (usuarios marcados como recurso sin recurso aún)
// en el recuadro "¿Qué profesional?". Resalta el ya seleccionado (selUid).
async function _crPintarCandidatos(selUid){
  const cont = document.getElementById('cr-cand-list');
  if (!cont) return;
  const users = await _crCargarUsuariosEmpresa();
  const conRecurso = new Set(_crRecursos.map(x => x.user_id).filter(Boolean));
  const candidatos = users.filter(u => {
    const uid = u._id || u.id || u.user_id;
    // Mostrar los marcados sin recurso; y también el ya vinculado (al editar).
    return uid && u.is_resource && (!conRecurso.has(uid) || uid === selUid);
  });
  if (!candidatos.length){
    cont.innerHTML = '<div style="font-size:10.5px;color:#a8aed1">No hay profesionales marcados como recurso pendientes. Márcalos en "Cuentas de acceso".</div>';
    return;
  }
  cont.innerHTML = candidatos.map(u => {
    const uid = u._id || u.id || u.user_id;
    const nombre = _crNombreUser(u).replace(/'/g,'');
    const ini = (nombre.split(' ').map(w=>w[0]).join('') || '?').toUpperCase().slice(0,2);
    const sel = uid === selUid;
    return `<div class="cr-cand ${sel?'on':''}" data-uid="${uid}" onclick="crSelUser('${uid}','${nombre}')"
      style="display:flex;align-items:center;gap:10px;background:#fff;border:${sel?'2px solid #7c5cff':'0.5px solid #e3e0ef'};border-radius:8px;padding:8px 10px;cursor:pointer">
      <span style="width:30px;height:30px;border-radius:50%;background:${sel?'#7c5cff':'#cdbff5'};color:${sel?'#fff':'#4a3b9e'};display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:700">${ini}</span>
      <span style="flex:1"><span style="display:block;font-size:12.5px;font-weight:600">${nombre}</span><span style="display:block;font-size:10.5px;color:#7D84C1">${u.email||''}</span></span>
      ${sel?'<i class="fas fa-check" style="color:#7c5cff"></i>':''}
    </div>`;
  }).join('');
}

window.crSubirFotoRecurso = function(input){
  const file = input.files && input.files[0]; if(!file) return;
  if(typeof ppUploadImage !== 'function'){ if(typeof showToast==='function') showToast('No se pudo subir la imagen','error'); return; }
  const prev = document.getElementById('cr-f-foto-prev');
  if(prev) prev.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
  ppUploadImage(file, 'perfil_profesional_recurso').then(url => {
    if(url){
      const h = document.getElementById('cr-f-photo'); if(h) h.value = url;
      if(prev){ prev.style.backgroundImage = `url('${url}')`; prev.innerHTML = ''; }
    } else if(prev){ prev.innerHTML = '<i class="fas fa-image"></i>'; }
  });
  input.value = '';
};

window.crAddFeat = function(){
  const inp = $('#cr-f-feat-nueva'); const v = (inp.value||'').trim(); if (!v) return;
  $('#cr-feats').insertAdjacentHTML('beforeend', `<span class="cr-fchip on" onclick="this.classList.toggle('on')">${v}</span>`);
  inp.value = '';
};

// Recoge las características/especialidades a guardar: chips marcados (.on) MÁS
// lo que haya quedado escrito en "Otra…" sin presionar + (error de UX común).
// Evita duplicados.
function _crRecogerFeats(){
  const feats = [...document.querySelectorAll('#cr-feats .cr-fchip.on')].map(x => x.textContent.trim());
  const inp = document.getElementById('cr-f-feat-nueva');
  const pend = inp && inp.value ? inp.value.trim() : '';
  if (pend && !feats.includes(pend)) feats.push(pend);
  return feats;
}

// ── Especialidades (Fase B) ────────────────────────────────────────────────
// Pinta los chips del catálogo de la categoría SELECCIONADA en el form, más las
// especialidades propias del recurso. Marca (.on) las que el recurso tiene en
// _crSpecsSel. Se llama al abrir el form y cada vez que cambia la categoría.
function _crRenderSpecs(){
  const cont = document.getElementById('cr-specs');
  if (!cont) return;
  const catKey = (document.getElementById('cr-f-cat')?.value) || '';
  const catalogo = _crEspecialidadesDeCategoria(catKey);   // [{key,nombre,active}]
  const selByKey = {}; _crSpecsSel.forEach(s => { selByKey[s.key] = s; });

  // Chips del catálogo (marcados si están en la selección)
  const chipsCat = catalogo.map(e => {
    const on = selByKey[e.key] ? 'on' : '';
    return `<span class="cr-fchip ${on}" data-key="${e.key}" data-nombre="${(e.nombre||'').replace(/"/g,'&quot;')}" data-propia="0"
      onclick="crToggleSpec(this)">${e.nombre}</span>`;
  }).join('');

  // Chips de propias del recurso que NO están en el catálogo (se muestran aparte, marcadas).
  // Cada una con lápiz (renombrar inline, conserva la key) y ✕ (quitar). [v..]
  const keysCat = new Set(catalogo.map(e => e.key));
  const propias = _crSpecsSel.filter(s => s.propia && !keysCat.has(s.key));
  const _esc = t => (t || '').replace(/"/g, '&quot;');
  const chipsPropias = propias.map(s => {
    if (s.key === _crEditingPropiaKey){
      return `<span class="cr-fchip on" style="display:inline-flex;align-items:center;gap:4px">`
        + `<input class="cr-propia-input" value="${_esc(s.nombre)}" `
        + `style="border:none;background:transparent;font:inherit;color:inherit;width:120px;outline:none" `
        + `onkeydown="if(event.key==='Enter'){crCommitPropia(event,'${s.key}')}else if(event.key==='Escape'){crCancelPropia(event)}">`
        + `<i class="fas fa-check" title="Guardar" style="font-size:11px;color:#16a34a;cursor:pointer" onclick="crCommitPropia(event,'${s.key}')"></i>`
        + `</span>`;
    }
    return `<span class="cr-fchip on" data-key="${s.key}" data-nombre="${_esc(s.nombre)}" data-propia="1" style="display:inline-flex;align-items:center;gap:6px">`
      + `<span>${s.nombre}</span>`
      + `<i class="fas fa-star" style="font-size:9px;color:#d97706"></i>`
      + `<i class="fas fa-pen" title="Renombrar" style="font-size:10px;color:#fff;opacity:.9;cursor:pointer" onclick="crEditarPropia(event,'${s.key}')"></i>`
      + `<i class="fas fa-times" title="Quitar" style="font-size:13px;color:#ffd2dc;cursor:pointer" onclick="crEliminarPropia(event,'${s.key}')"></i>`
      + `</span>`;
  }).join('');

  cont.innerHTML = chipsCat + (chipsPropias ? `<div style="width:100%;font-size:10px;color:#a8aed1;margin:6px 0 2px">Propias:</div>` + chipsPropias : '')
    || '<div style="font-size:10.5px;color:#a8aed1">Esta categoría no tiene especialidades en el catálogo aún.</div>';
}

// Toggle de un chip de especialidad → actualiza _crSpecsSel (fuente de verdad).
window.crToggleSpec = function(el){
  const key = el.getAttribute('data-key');
  const nombre = el.getAttribute('data-nombre');
  const propia = el.getAttribute('data-propia') === '1';
  const i = _crSpecsSel.findIndex(s => s.key === key);
  if (i >= 0) { _crSpecsSel.splice(i, 1); el.classList.remove('on'); }
  else { _crSpecsSel.push({ key, nombre, propia }); el.classList.add('on'); }
};

// ── Gestión de especialidades PROPIAS (lápiz = renombrar inline / ✕ = quitar) ──
// Renombrar cambia solo el NOMBRE; la key se conserva, así los agenda_services que
// cuelgan de esa propia (padre = key) siguen enlazados sin recolgar nada.
window.crEditarPropia = function(ev, key){
  if (ev) ev.stopPropagation();
  _crEditingPropiaKey = key;
  _crRenderSpecs();
  const inp = document.querySelector('.cr-propia-input');
  if (inp){ inp.focus(); inp.select(); }
};
window.crCommitPropia = function(ev, key){
  if (ev) ev.stopPropagation();
  const inp = document.querySelector('.cr-propia-input');
  const nombre = (inp?.value || '').trim();
  const it = _crSpecsSel.find(s => s.key === key);
  if (it && nombre) it.nombre = nombre;   // key intacta
  _crEditingPropiaKey = null;
  _crRenderSpecs();
};
window.crCancelPropia = function(ev){
  if (ev) ev.stopPropagation();
  _crEditingPropiaKey = null;
  _crRenderSpecs();
};
window.crEliminarPropia = function(ev, key){
  if (ev) ev.stopPropagation();
  const i = _crSpecsSel.findIndex(s => s.key === key);
  if (i >= 0) _crSpecsSel.splice(i, 1);   // se persiste al Guardar; Tema 1 desactiva sus servicios
  if (_crEditingPropiaKey === key) _crEditingPropiaKey = null;
  _crRenderSpecs();
};

// Agregar una especialidad PROPIA (no está en el catálogo): se guarda solo en
// el recurso. Se le genera key normalizada para que la búsqueda IA matchee.
window.crAddSpecPropia = function(){
  const inp = document.getElementById('cr-f-spec-nueva');
  const v = (inp?.value || '').trim();
  if (!v) return;
  const key = _crSlug(v);
  if (!key) return;
  if (!_crSpecsSel.some(s => s.key === key)) {
    _crSpecsSel.push({ key, nombre: v, propia: true });
  }
  inp.value = '';
  _crRenderSpecs();
};

// Recoge las especialidades a guardar (array de objetos {key,nombre,propia}).
// Incluye lo que haya quedado escrito en "propia" sin presionar +.
function _crRecogerSpecs(){
  const inp = document.getElementById('cr-f-spec-nueva');
  const pend = inp && inp.value ? inp.value.trim() : '';
  if (pend) {
    const key = _crSlug(pend);
    if (key && !_crSpecsSel.some(s => s.key === key)) {
      _crSpecsSel.push({ key, nombre: pend, propia: true });
    }
  }
  return _crSpecsSel.map(s => ({ key: s.key, nombre: s.nombre, propia: !!s.propia }));
}

// Trae la lista de usuarios de la empresa SIN cachear: el estado is_resource
// puede cambiar en la misma sesión (toggle en Cuentas de acceso), así que se
// pide fresca en cada búsqueda para no mostrar datos viejos.
async function _crCargarUsuariosEmpresa(){
  const cid = _crCompanyId || localStorage.getItem('company_id');
  const r = await apiCall('/api/companies/' + cid + '/users').catch(() => null);
  return (r?.data?.users) || [];
}

// Compone el nombre visible del usuario: "Nombre Apellido", con fallbacks.
function _crNombreUser(u){
  const fn = (u.first_name || '').trim();
  const ln = (u.last_name || '').trim();
  const compuesto = [fn, ln].filter(Boolean).join(' ').trim();
  return compuesto || (u.full_name || '').trim() || u.username || u.email || '';
}

let _crUserTimer = null;
window.crBuscarUser = function(q){
  clearTimeout(_crUserTimer);
  if (!q || q.length < 2){ $('#cr-user-sug').innerHTML=''; return; }
  _crUserTimer = setTimeout(async () => {
    // Fuente: la lista de usuarios de la EMPRESA (trae is_resource por empresa,
    // a diferencia del search global). Solo los marcados como recurso que AÚN NO
    // tienen recurso creado (su user_id no está en _crRecursos).
    const users = await _crCargarUsuariosEmpresa();
    const conRecurso = new Set(_crRecursos.map(x => x.user_id).filter(Boolean));
    const ql = q.toLowerCase();
    const candidatos = users.filter(u => {
      const uid = u._id || u.id || u.user_id;
      if (!u.is_resource || !uid || conRecurso.has(uid)) return false;
      const nombre = _crNombreUser(u).toLowerCase();
      const email  = (u.email || '').toLowerCase();
      return nombre.includes(ql) || email.includes(ql);
    });
    $('#cr-user-sug').innerHTML = candidatos.slice(0,5).map(u => {
      const nm = _crNombreUser(u).replace(/'/g,'');
      return `<span class="cr-chip" onclick="crSelUser('${u._id||u.id}','${nm}')">${nm} ${u.email?('· '+u.email):''}</span>`;
    }).join(' ')
      || '<span style="font-size:10.5px;color:#a8aed1">Sin profesionales marcados como recurso pendientes</span>';
  }, 350);
};
window.crSelUser = function(id, nombre){
  $('#cr-f-user-id').value = id;
  // Autocompletar el nombre del especialista si está vacío (editable después)
  const nEl = $('#cr-f-nombre');
  if (nEl && !nEl.value.trim() && nombre) nEl.value = nombre;
  $('#cr-user-sug').innerHTML = '';
  const q = $('#cr-f-user-q'); if (q) q.value = '';
  // Re-resaltar la tarjeta elegida en la lista de candidatos
  _crPintarCandidatos(id);
};

window.crGuardar = async function(){
  const nombre = ($('#cr-f-nombre').value||'').trim();
  if (!nombre){ if (typeof showToast==='function') showToast('El nombre es obligatorio','error'); return; }
  const fields = {};
  (_crRec.campos||[]).forEach(c => {
    const el = $('#cr-f-'+c.key); if (!el) return;
    let v = el.value.trim(); if (v==='') return;
    if (c.tipo==='number' && !isNaN(Number(v))){
      v = Number(v);
      if (v < 0) v = 0;  // no se permiten negativos (ej. años de experiencia)
    }
    fields[c.key] = v;
  });
  const body = {
    name: nombre,
    color: $('#cr-f-color').value,
    profession_key: $('#cr-f-cat').value || null,
    fields,
  };
  if (_esPersona()){
    const uid = $('#cr-f-user-id')?.value; if (uid) body.user_id = uid;
    body.specialties = _crRecogerSpecs();   // [Fase B] especialidades del catálogo + propias
    // Modos de trabajo [20-06] (la experiencia ya se guarda como campo dinámico de arriba)
    const modMap = { 'Presencial':'presencial', 'Online':'online', 'A domicilio':'domicilio' };
    body.modalities = [...document.querySelectorAll('#cr-modos .toggle-btn.on')]
      .map(b => modMap[b.textContent.trim()] || b.textContent.trim().toLowerCase());
    const photo = $('#cr-f-photo')?.value; if (photo) body.photo_url = photo;
  } else {
    body.features = _crRecogerFeats();      // objeto: características
    const photo = $('#cr-f-photo')?.value; if (photo) body.photo_url = photo;  // [14-06]
  }
  // Tema 1: si se quitaron especialidades, avisar y (tras guardar) desactivar sus
  // servicios agendables. Solo persona + edición. Cancelar = no guardar nada.
  let _crAfect = [];
  if (_esPersona() && _crEditId && typeof window._cfgChequearEspecialidadesQuitadasEx === 'function'){
    _crAfect = await window._cfgChequearEspecialidadesQuitadasEx(_crEditId, _crSpecsOrig, body.specialties || []);
    if (_crAfect === null) return;   // canceló → no se guarda nada
  }
  let res;
  if (_crEditId){
    res = await apiCall('/api/agenda/resources/' + _crEditId, { method:'PATCH', body: JSON.stringify(body) }).catch(() => null);
  } else {
    body.resource_type_id = _crTipoId || 'default';
    body.slot_duration = 60;
    res = await apiCall('/api/agenda/resources', { method:'POST', body: JSON.stringify(body) }).catch(() => null);
  }
  if (res?.ok && res.data?.success !== false){
    if (typeof showToast==='function') showToast('Guardado ✅','success');
    // [Fase B] avisar a otros editores si se guardaron especialidades (persona)
    if (_esPersona() && body.specialties){
      const rid = _crEditId || res.data?._id || res.data?.id || res.data?.resource?._id;
      if (rid && typeof window.dispatchEvent === 'function'){
        try { window.dispatchEvent(new CustomEvent('hvy:specialties-updated',
          { detail: { resourceId: rid, specialties: body.specialties } })); } catch(_){}
      }
    }
    $('#cr-form-wrap').innerHTML = '';
    // Tema 1: soft-delete de los servicios de las especialidades quitadas.
    if (_crAfect && _crAfect.length && typeof window._cfgDesactivarServicios === 'function'){
      await window._cfgDesactivarServicios(_crEditId, _crAfect);
    }
    _crLoadRecursos();
  } else {
    const msg = res?.data?.error || 'No se pudo guardar';
    if (typeof showToast==='function') showToast(msg,'error');
  }
};

window.crToggle = async function(id, activo){
  await apiCall('/api/agenda/resources/' + id, { method:'PATCH', body: JSON.stringify({ active: !!activo }) }).catch(() => null);
  _crLoadRecursos();
};
window.crFiltro = function(k){ _crCatFiltro = k; _crRender(); };


// ── PASO 2: Disponibilidad por rubro (Fase 3.3.1) ──
// Panel de disponibilidad POR RECURSO para modos de objeto/visita.
//  - por_dia (alojamiento): check-in/out, mínimo de noches, temporadas.
//  - por_visita (propiedades): ventana de visitas, duración, máx/día, días.
// El selector de recurso y el andamiaje son comunes; cambia el form interno.
// por_hora / por_hora_sin_almuerzo usan el panel del HTML (no este).
async function _crDisponibilidad(){
  const modo = _crSector?.business?.availability_mode || 'por_hora';
  if (modo !== 'por_dia' && modo !== 'por_visita') return;
  const panel = document.getElementById('panel-1');
  if (!panel || document.getElementById('cr-disp')) return;

  // Ocultar el contenido por_hora original sin destruirlo
  const original = document.createElement('div');
  original.id = 'cr-disp-original'; original.style.display = 'none';
  while (panel.firstChild) original.appendChild(panel.firstChild);
  panel.appendChild(original);

  // Config global de la empresa: se usa como valor heredado si un recurso aún
  // no tiene su propia disponibilidad (Opción 2). [16-06]
  const rc = await apiCall('/api/me/company/config').catch(() => null);
  _crDispCfgGlobal = rc?.data?.config || {};

  const intro = modo === 'por_visita'
    ? 'El cliente agenda una hora para visitar. Configura la ventana y el tope diario de cada recurso.'
    : 'Reservas por día: el cliente elige fechas de llegada y salida. Configura cada recurso por separado.';

  const div = document.createElement('div');
  div.className = 'content'; div.id = 'cr-disp';
  div.innerHTML = `
    <div style="font-size:15px;font-weight:800;color:#1e2a5e;margin-bottom:2px">Disponibilidad${modo==='por_visita'?' para visitas':''}</div>
    <div style="font-size:11px;color:#7D84C1;margin-bottom:12px">${intro}</div>
    <div style="font-size:11px;font-weight:700;color:#7D84C1;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px"><i class="fas fa-cube" style="color:#9961FF;font-size:12px;margin-right:5px"></i>¿De qué recurso?</div>
    <div id="cr-disp-chips" class="toggle-group" style="flex-wrap:wrap;margin-bottom:14px"></div>
    <div id="cr-disp-form-wrap"></div>`;
  panel.appendChild(div);

  _crDispRenderChips();
  // Cargar el primer recurso por defecto
  if (_crRecursos.length) crDispSelect(_crRecursos[0]._id || _crRecursos[0].id);
  else document.getElementById('cr-disp-form-wrap').innerHTML = '<div style="font-size:11px;color:#a8aed1">No hay recursos creados aún. Créalos primero.</div>';
}

// Pinta los chips de recurso en el panel de disponibilidad de objetos.
function _crDispRenderChips(){
  const cont = document.getElementById('cr-disp-chips');
  if (!cont) return;
  cont.innerHTML = _crRecursos.map(r => {
    const id = r._id || r.id;
    const nombre = (r.name || '—').replace(/"/g, '&quot;');
    const on = id === _crDispRecId;
    return `<span class="toggle-btn ${on?'on':''}" onclick="crDispSelect('${id}')">${nombre}</span>`;
  }).join('');
}

// Selecciona un recurso y puebla el form con SU disponibilidad. Si el recurso no
// tiene config propia todavía, hereda la global de la empresa como valor inicial.
window.crDispSelect = function(resourceId){
  const r = _crRecursos.find(x => (x._id || x.id) === resourceId);
  if (!r) return;
  _crDispRecId = resourceId;
  _crDispRenderChips();
  const wrap = document.getElementById('cr-disp-form-wrap');
  if (!wrap) return;
  const g = _crDispCfgGlobal || {};
  const modo = _crSector?.business?.availability_mode || 'por_hora';

  if (modo === 'por_visita'){
    // Ventana de visitas + duración + tope diario, por recurso (Opción 2: hereda global).
    const rd = (_crSector?.business?.resource_defaults) || {};
    const desde   = r.checkin     !== undefined ? r.checkin     : (g.checkin || '10:00');
    const hasta   = r.checkout    !== undefined ? r.checkout    : (g.checkout || '18:00');
    const dur     = r.slot_duration !== undefined ? r.slot_duration : (g.slot_duration || rd.slot_duration || 30);
    const maxDia  = r.max_visits_per_day !== undefined ? r.max_visits_per_day : (g.max_visits_per_day || rd.max_visits_per_day || 2);
    const minAdv  = r.min_advance_hours !== undefined ? r.min_advance_hours : (rd.min_advance_hours || 2);
    const cancel  = r.cancel_hours !== undefined ? r.cancel_hours : (rd.cancel_hours || 24);
    const dias    = Array.isArray(r.dias_visita) ? r.dias_visita : (g.dias_visita || [1,2,3,4,5,6]);
    const DOW = [['Dom',0],['Lun',1],['Mar',2],['Mié',3],['Jue',4],['Vie',5],['Sáb',6]];
    wrap.innerHTML = `
      <div class="cr-form">
        <div class="cr-grid">
          <div><label>Visitas desde</label><input id="cr-v-desde" type="time" value="${desde}"></div>
          <div><label>Visitas hasta</label><input id="cr-v-hasta" type="time" value="${hasta}"></div>
          <div><label>Duración visita (min)</label><input id="cr-v-dur" type="number" min="5" value="${dur}"></div>
          <div><label>Máx. visitas por día</label><input id="cr-v-max" type="number" min="1" value="${maxDia}"></div>
        </div>
        <label style="margin-top:6px">Días que se puede visitar</label>
        <div id="cr-v-dias" class="toggle-group" style="flex-wrap:wrap;margin:4px 0 10px">
          ${DOW.map(([n,i]) => `<span class="toggle-btn ${dias.includes(i)?'on':''}" data-dow="${i}" onclick="this.classList.toggle('on')">${n}</span>`).join('')}
        </div>
        <div class="cr-grid">
          <div><label>Anticipación mínima (hrs)</label><input id="cr-v-anticip" type="number" min="0" value="${minAdv}"></div>
          <div><label>Cancelación (hrs)</label><input id="cr-v-cancel" type="number" min="0" value="${cancel}"></div>
        </div>
        <div style="margin-top:10px"><button class="btn-primary" onclick="crDispGuardar()"><i class="fas fa-check" style="margin-right:5px"></i>Guardar disponibilidad</button>
        <span id="cr-d-msg" style="font-size:11px;font-weight:700;margin-left:8px"></span></div>
      </div>`;
    return;
  }

  // modo por_dia (alojamiento): check-in/out, mínimo de noches, temporadas
  const checkin    = r.checkin    !== undefined ? r.checkin    : (g.checkin || '');
  const checkout   = r.checkout   !== undefined ? r.checkout   : (g.checkout || '');
  const minNoches  = r.min_noches !== undefined ? r.min_noches : (g.min_noches || '');
  const temporadas = Array.isArray(r.temporadas) ? r.temporadas : (g.temporadas || []);
  wrap.innerHTML = `
    <div class="cr-form">
      <div class="cr-grid">
        <div><label>Hora de check-in</label><input id="cr-d-checkin" type="time" value="${checkin}" placeholder="15:00"></div>
        <div><label>Hora de check-out</label><input id="cr-d-checkout" type="time" value="${checkout}" placeholder="12:00"></div>
        <div><label>Mínimo de noches</label><input id="cr-d-minn" type="number" min="1" value="${minNoches}" placeholder="1"></div>
      </div>
      <label style="margin-top:6px">Temporadas (opcional)</label>
      <div class="cr-sug">Define rangos con nombre (ej: Temporada alta, 15 dic – 28 feb).</div>
      <div id="cr-d-temps"></div>
      <button class="btn-secondary" type="button" onclick="crDispAddTemp()" style="margin:6px 0 10px"><i class="fas fa-plus" style="margin-right:5px"></i>Agregar temporada</button>
      <div><button class="btn-primary" onclick="crDispGuardar()"><i class="fas fa-check" style="margin-right:5px"></i>Guardar disponibilidad</button>
      <span id="cr-d-msg" style="font-size:11px;font-weight:700;margin-left:8px"></span></div>
    </div>`;
  temporadas.forEach(t => crDispAddTemp(t));
};

window.crDispAddTemp = function(t){
  t = t || {};
  document.getElementById('cr-d-temps').insertAdjacentHTML('beforeend', `
    <div class="cr-grid cr-d-temp" style="align-items:end">
      <div><label>Nombre</label><input class="t-nombre" value="${(t.nombre||'').replace(/"/g,'&quot;')}" placeholder="Temporada alta"></div>
      <div><label>Desde</label><input class="t-desde" type="date" value="${t.desde||''}"></div>
      <div><label>Hasta</label><input class="t-hasta" type="date" value="${t.hasta||''}"></div>
      <div><button class="btn-icon" type="button" style="color:#ef4444" onclick="this.closest('.cr-d-temp').remove()"><i class="fas fa-trash"></i></button></div>
    </div>`);
};

window.crDispGuardar = async function(){
  if (!_crDispRecId){ return; }
  const modo = _crSector?.business?.availability_mode || 'por_hora';
  let body;
  if (modo === 'por_visita'){
    const dias = [...document.querySelectorAll('#cr-v-dias .toggle-btn.on')].map(x => parseInt(x.dataset.dow, 10));
    body = {
      checkin:            document.getElementById('cr-v-desde').value,   // ventana inicio
      checkout:           document.getElementById('cr-v-hasta').value,   // ventana fin
      slot_duration:      parseInt(document.getElementById('cr-v-dur').value || '30', 10),
      max_visits_per_day: parseInt(document.getElementById('cr-v-max').value || '1', 10),
      dias_visita:        dias,
      booking_rules: {
        min_advance_hours: parseInt(document.getElementById('cr-v-anticip').value || '0', 10),
        cancel_hours:      parseInt(document.getElementById('cr-v-cancel').value || '0', 10),
      },
    };
  } else {
    const temporadas = [...document.querySelectorAll('.cr-d-temp')].map(r => ({
      nombre: r.querySelector('.t-nombre').value.trim(),
      desde:  r.querySelector('.t-desde').value,
      hasta:  r.querySelector('.t-hasta').value,
    })).filter(t => t.nombre || t.desde || t.hasta);
    body = {
      checkin:    document.getElementById('cr-d-checkin').value,
      checkout:   document.getElementById('cr-d-checkout').value,
      min_noches: parseInt(document.getElementById('cr-d-minn').value || '1', 10),
      temporadas,
    };
  }
  // Guardar POR RECURSO: PATCH al recurso (update_resource hace $set libre, así
  // que estos campos quedan en el documento del recurso). El endpoint solo acepta
  // PATCH; con PUT devolvía 405 Method Not Allowed. [16-06]
  const res = await apiCall('/api/agenda/resources/' + _crDispRecId, { method:'PATCH', body: JSON.stringify(body) }).catch(() => null);
  const msg = document.getElementById('cr-d-msg');
  if (res?.ok){
    msg.textContent = 'Guardado ✓'; msg.style.color = '#10b981';
    // Reflejar en el recurso en memoria para que el chip recargue su valor.
    const r = _crRecursos.find(x => (x._id || x.id) === _crDispRecId);
    if (r) Object.assign(r, body);
  } else { msg.textContent = (res?.data?.error) || 'Error al guardar'; msg.style.color = '#ef4444'; }
  setTimeout(() => msg.textContent = '', 3000);
};


// ── PASO 3: Características del recinto (Fase 3.3.2, solo naturaleza objeto) ──
// Reemplaza el bloque de especialidades/experiencia (molde persona) por:
// características del recinto (chips: sugeridas del sector + propias de la
// empresa) y "Cómo llegar" (texto + link Maps). Persona: intacto.
async function _crCaracteristicas(){
  if (!_crRec || _crRec.naturaleza !== 'objeto') return;
  const panel = document.getElementById('panel-2');
  if (!panel || document.getElementById('cr-carac')) return;

  const original = document.createElement('div');
  original.id = 'cr-carac-original'; original.style.display = 'none';
  while (panel.firstChild) original.appendChild(panel.firstChild);
  panel.appendChild(original);

  const rc = await apiCall('/api/me/company/config').catch(() => null);
  const cfg = rc?.data?.config || {};
  const sugeridas = _crSector?.business?.caracteristicas_recinto || [];
  const propias   = cfg.caracteristicas_recinto || [];
  const todas = [...new Set([...sugeridas, ...propias])];

  const div = document.createElement('div');
  div.className = 'content'; div.id = 'cr-carac';
  div.innerHTML = `
    <div style="font-size:15px;font-weight:800;color:#1e2a5e;margin-bottom:2px">Características del recinto</div>
    <div style="font-size:11px;color:#7D84C1;margin-bottom:12px">Lo que ofrece tu establecimiento en general (no de cada unidad).</div>
    <div class="cr-block-o">
      <div style="font-size:11.5px;font-weight:700;color:#d97706;margin-bottom:4px"><i class="fas fa-tags"></i> Servicios y comodidades</div>
      <div class="cr-sug">Toca para marcar las que aplican; agrega otras abajo.</div>
      <div id="cr-carac-chips">${todas.map(t => `<span class="cr-fchip ${propias.includes(t)?'on':''}" onclick="this.classList.toggle('on')">${t}</span>`).join('')}</div>
      <div style="display:flex;gap:6px;margin-top:8px;max-width:320px">
        <input id="cr-carac-nueva" placeholder="Otra característica…">
        <button class="btn-secondary" type="button" onclick="crCaracAdd()"><i class="fas fa-plus"></i></button>
      </div>
    </div>
    <div class="cr-form">
      <div style="font-size:11.5px;font-weight:700;color:#7c3aed;margin-bottom:6px"><i class="fas fa-map-marker-alt"></i> Cómo llegar</div>
      <div class="cr-grid">
        <div><label>Dirección / referencia</label><input id="cr-carac-dir" value="${(cfg.como_llegar||'').replace(/"/g,'&quot;')}" placeholder="Km 12 camino a Rari, sector el bajo"></div>
        <div><label>Link de Google Maps</label><input id="cr-carac-maps" value="${(cfg.maps_url||'').replace(/"/g,'&quot;')}" placeholder="https://maps.app.goo.gl/..."></div>
      </div>
      <div><button class="btn-primary" onclick="crCaracGuardar()"><i class="fas fa-check" style="margin-right:5px"></i>Guardar características</button>
      <span id="cr-carac-msg" style="font-size:11px;font-weight:700;margin-left:8px"></span></div>
    </div>`;
  panel.appendChild(div);
}

window.crSelCat = function(hiddenId, el){
  const ya = el.classList.contains('on');
  el.parentElement.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('on'));
  if (!ya){ el.classList.add('on'); document.getElementById(hiddenId).value = el.dataset.k; }
  else { document.getElementById(hiddenId).value = ''; }  // re-clic = Sin categoría
  // Al cambiar la categoría del recurso, repintar los chips de especialidad
  // (dependen de la categoría). Solo aplica al form del recurso (cr-f-cat). [Fase B]
  if (hiddenId === 'cr-f-cat' && typeof _crRenderSpecs === 'function') _crRenderSpecs();
};

window.crCaracAdd = function(){
  const inp = document.getElementById('cr-carac-nueva'); const v = (inp.value||'').trim(); if (!v) return;
  document.getElementById('cr-carac-chips').insertAdjacentHTML('beforeend',
    `<span class="cr-fchip on" onclick="this.classList.toggle('on')">${v}</span>`);
  inp.value = '';
};

window.crCaracGuardar = async function(){
  const body = {
    caracteristicas_recinto: [...document.querySelectorAll('#cr-carac-chips .cr-fchip.on')].map(x => x.textContent.trim()),
    como_llegar: document.getElementById('cr-carac-dir').value.trim(),
    maps_url:    document.getElementById('cr-carac-maps').value.trim(),
  };
  const cid = localStorage.getItem('company_id');
  const res = await apiCall('/api/companies/' + cid + '/config', { method:'PUT', body: JSON.stringify(body) }).catch(() => null);
  const msg = document.getElementById('cr-carac-msg');
  if (res?.ok){ msg.textContent = 'Guardado ✓'; msg.style.color = '#10b981'; }
  else { msg.textContent = (res?.data?.error) || 'Error'; msg.style.color = '#ef4444'; }
  setTimeout(() => msg.textContent = '', 3000);
};


// ── PASO 4: Tipos de estadía / Servicios + categoría (Fase 3.3.3, opción 1) ──
// No reescribe guardarSesion/guardarPrograma (lógica compleja existente).
// (a) Cambia los títulos visibles según business.pasos.
// (b) Inyecta un <select> de categoría en ambos formularios.
// (c) Intercepta apiCall para anexar profession_key al POST/PUT de
//     servicios y programas (el backend 2.2 ya lo valida).
function _crEstadia(){
  if (!_crRec || document.getElementById('cr-cat-prog')) return;
  const panel = document.getElementById('panel-3');
  if (!panel) return;

  // (a) Títulos por rubro
  const pasos = _crSector?.business?.pasos || {};
  panel.querySelectorAll('.card-title').forEach(el => {
    const t = el.textContent.trim();
    if (/servicios/i.test(t) && pasos.servicios) el.innerHTML = el.innerHTML.replace(/Servicios/i, pasos.servicios);
    if (/programas/i.test(t) && pasos.programas) el.innerHTML = el.innerHTML.replace(/Programas/i, pasos.programas);
  });
  // Breadcrumb "Servicios de —": para objeto el "de <nombre>" no aplica; usar
  // el label del paso a secas.
  const bc = panel.querySelector('.breadcrumb span');
  if (bc && pasos.servicios){
    bc.innerHTML = pasos.servicios;
  }

  // (b) Selector de categoría en cada formulario (solo si la empresa tiene categorías)
  const cats = _catKeys();
  if (!cats.length) return;

  // Selector de categoría con el patrón Heavensy (toggle-btn, selección única) —
  // NADA de <select> nativo. Un hidden input guarda el valor para el interceptor.
  function inyectar(anchorId, selId){
    const anchor = document.getElementById(anchorId);
    if (!anchor || document.getElementById(selId)) return;
    const grp = anchor.closest('.form-group') || anchor.parentElement;
    const wrap = document.createElement('div');
    wrap.className = 'form-group';
    wrap.innerHTML = `<label>Categoría</label>
      <input type="hidden" id="${selId}" value="">
      <div class="toggle-group" id="${selId}-chips">
        ${cats.map(k => `<span class="toggle-btn" data-k="${k}"
          onclick="crSelCat('${selId}', this)">${_catName(k)}</span>`).join('')}
      </div>`;
    grp.parentNode.insertBefore(wrap, grp.nextSibling);
  }
  // El form de servicio (ses-) se maneja a mano (agenda, con su propio selector de
  // profesional/categoría); ya NO se inyecta la categoría aquí.
  inyectar('prog-nombre', 'cr-cat-prog');

  // (c) Interceptar apiCall una sola vez
  if (!window._crApiWrapped && typeof window.apiCall === 'function'){
    const orig = window.apiCall;
    window.apiCall = function(url, opts){
      try{
        if (opts && opts.body && /\/api\/perfil-profesional\/(servicios|programas)/.test(url)
            && (opts.method === 'POST' || opts.method === 'PUT')){
          const esServicio = /servicios/.test(url);
          const sel = esServicio ? document.getElementById('cr-cat-ses')
                                 : document.getElementById('cr-cat-prog');
          const body = JSON.parse(opts.body);
          if (sel) body.profession_key = sel.value || null;
          // Recoger los campos INYECTADOS del schema (min_noches, capacidad, etc.)
          const prefijo = esServicio ? 'ses-' : 'prog-';
          const formKey = esServicio ? 'servicio' : 'programa';
          const campos = (_crSector?.business?.formularios || {})[formKey] || [];
          campos.forEach(c => {
            const el = document.getElementById(prefijo + c.key);
            if (el && el.dataset.crInjected === undefined && el.closest('[data-cr-injected]')){
              let v = el.value;
              if (v !== '' && c.tipo === 'number' && !isNaN(Number(v))) v = Number(v);
              if (v !== '') body[c.key] = v;
            }
          });
          opts = { ...opts, body: JSON.stringify(body) };
        }
      }catch(e){ /* no romper el apiCall original */ }
      return orig(url, opts);
    };
    window._crApiWrapped = true;
  }
}


// ── MOTOR DE FORMULARIOS (Fase P1, enfoque A) ──
// Lee business.formularios del sector y MODULA los formularios reales de
// Configuración: oculta campos no-visibles, reescribe labels. No reemplaza la
// mecánica de guardado existente. Los campos AÑADIDOS (min_noches, etc.) y el
// override por-empresa son pasos posteriores.
//
// Mapa: cada form del schema → prefijo de id real en el HTML.
const _CR_FORM_PREFIX = { programa: 'prog-' };  // 'servicio' (ses-) se maneja a mano (agenda), no por el motor declarativo


// Inyecta un campo del schema que el HTML no tiene. Devuelve el .form-group creado.
// El input lleva id = prefijo+key, así el interceptor de apiCall lo recoge igual
// que a los campos nativos. Marca data-cr-injected para poder limpiarlo en reset.
function _crInyectarCampo(prefijo, campo, anclaGrupo){
  const id = prefijo + campo.key;
  if (document.getElementById(id)) return null;  // ya existe
  const g = document.createElement('div');
  g.className = 'form-group';
  g.dataset.crInjected = '1';
  let control;
  if (campo.tipo === 'textarea'){
    control = `<textarea id="${id}" placeholder="${campo.placeholder||''}" rows="2" style="width:100%;border:1px solid #C9D9FF;border-radius:8px;padding:7px 10px;font-size:12px;resize:vertical"></textarea>`;
  } else {
    const t = (campo.tipo === 'number') ? 'number' : 'text';
    const val = (campo.default !== undefined && campo.default !== null) ? String(campo.default) : '';
    // Para números: sin negativos por defecto (min=0); el schema puede fijar min/max.
    let extra = '';
    if (campo.tipo === 'number'){
      const mn = (campo.min !== undefined) ? campo.min : 0;
      extra += ` min="${mn}"`;
      if (campo.max !== undefined) extra += ` max="${campo.max}"`;
      extra += ` oninput="if(this.value!=='' && Number(this.value)<${mn}) this.value=${mn}"`;
    }
    control = `<input type="${t}" id="${id}" placeholder="${campo.placeholder||''}" value="${val}"${extra}>`;
  }
  const req = campo.requerido ? ' *' : '';
  g.innerHTML = `<label>${campo.label}${req}</label>${control}`;
  // Insertar después del último grupo procesado, o al final del form si no hay ancla.
  if (anclaGrupo && anclaGrupo.parentNode){
    anclaGrupo.parentNode.insertBefore(g, anclaGrupo.nextSibling);
  } else {
    const cont = (prefijo === 'ses-') ? document.getElementById('form-sesion')
                                      : document.getElementById('form-programa');
    if (cont) cont.appendChild(g); else return null;
  }
  return g;
}

function _crModularFormularios(){
  const forms = _crSector?.business?.formularios;
  if (!forms) return;
  Object.entries(_CR_FORM_PREFIX).forEach(([formKey, prefijo]) => {
    const campos = forms[formKey];
    if (!Array.isArray(campos)) return;
    let ultimoGrupo = null;
    campos.forEach(campo => {
      const el = document.getElementById(prefijo + campo.key);
      if (!el){
        // 'categoria' la maneja _crEstadia (chips Heavensy): no inyectar aquí.
        if (campo.key === 'categoria') return;
        // El HTML no tiene este campo y el schema lo declara visible → INYECTAR.
        if (campo.visible !== false){
          const g = _crInyectarCampo(prefijo, campo, ultimoGrupo);
          if (g) ultimoGrupo = g;
        }
        return;
      }
      const grupo = el.closest('.form-group') || el.parentElement;
      ultimoGrupo = grupo;
      // (a) visibilidad
      if (campo.visible === false){ if (grupo) grupo.style.display = 'none'; return; }
      else if (grupo) grupo.style.display = '';
      // (b) label por rubro (sin tocar el input)
      if (campo.label && grupo){
        const lbl = grupo.querySelector('label');
        if (lbl){
          const req = /\*\s*$/.test(lbl.textContent) ? ' *' : '';
          lbl.textContent = campo.label + req;
        }
      }
    });
  });
}


// ── Reset del módulo (al cambiar de empresa) ──
// Borra lo inyectado y restaura los paneles originales que se ocultaron, para
// que crInit reconstruya desde cero con la nueva empresa.
function _crReset(){
  // Restaurar contenido movido a "Cuentas de acceso" de vuelta al panel-0
  const cuentas = document.getElementById('cr-tab-cuentas');
  const panel0 = document.getElementById('panel-0');
  if (cuentas && panel0){ while (cuentas.firstChild) panel0.appendChild(cuentas.firstChild); }
  // Restaurar paneles ocultados (disponibilidad, características)
  ['cr-disp-original','cr-carac-original'].forEach(id => {
    const orig = document.getElementById(id);
    if (orig){ const panel = orig.parentElement; while (orig.firstChild) panel.appendChild(orig.firstChild); orig.remove(); }
  });
  // Quitar campos inyectados en los formularios
  document.querySelectorAll('[data-cr-injected]').forEach(e => e.remove());
  // Quitar todo lo construido por el módulo
  ['cr-ctx','cr-wrap','cr-disp','cr-carac','cr-p5'].forEach(id => { const e = document.getElementById(id); if (e) e.remove(); });
  // Restaurar labels del stepper a su texto original guardado
  if (_crStepOrig){ Object.entries(_crStepOrig).forEach(([i,txt]) => { const el = document.querySelector('#step-'+i+' .step-label'); if (el) el.textContent = txt; }); }
  _crCompany = null; _crSector = null; _crRec = null; _crCompanyId = null;
  _crDispRecId = null; _crDispCfgGlobal = {};
}
let _crStepOrig = null;


// ── PASO 5: Edición del perfil — WhatsApp público + "Ver mi página" (3.3.4) ──
// Aplica a TODOS los rubros (persona y objeto). Arregla el breadcrump "Media de
// —" y agrega: input de WhatsApp público (guarda en business_config) y botón
// "Ver mi página" que abre heavensy.cl/p/<slug>.
function _crPerfilPaso5(){
  const panel = document.getElementById('panel-4');
  if (!panel || document.getElementById('cr-p5')) return;

  // (a) Fix breadcrumb "Media de —"
  const bc = panel.querySelector('.breadcrumb span');
  if (bc && /Media de/i.test(bc.textContent)) bc.innerHTML = 'Edición del perfil';

  // (b) Render INMEDIATO del bloque (sin esperar datos: así aparece siempre).
  const cont = panel.querySelector('.content') || panel;
  const div = document.createElement('div');
  div.id = 'cr-p5'; div.className = 'cr-form';
  div.style.cssText = 'margin-top:14px;border-top:1px solid #eef;padding-top:14px';
  div.innerHTML = `
    <div style="font-size:12px;font-weight:700;color:#7c3aed;margin-bottom:8px"><i class="fas fa-share-nodes"></i> Contacto y publicación</div>
    <div class="cr-grid">
      <div><label>WhatsApp público</label>
        <input id="cr-p5-wa" placeholder="+56 9 1234 5678">
        <div class="cr-sug">El botón "Hablemos" de tu página escribirá a este número.</div>
      </div>
      <div><label>Tu página pública</label>
        <div id="cr-p5-link"><div class="cr-sug">Cargando…</div></div>
      </div>
    </div>
    <div><button class="btn-primary" onclick="crP5Guardar()"><i class="fas fa-check" style="margin-right:5px"></i>Guardar contacto</button>
    <span id="cr-p5-msg" style="font-size:11px;font-weight:700;margin-left:8px"></span></div>`;
  cont.appendChild(div);

  // (c) Cargar datos DESPUÉS y rellenar (si fallan, el bloque ya está visible).
  apiCall('/api/me/company/config').then(r => {
    const wa = r?.data?.config?.whatsapp_publico || '';
    const inp = document.getElementById('cr-p5-wa');
    if (inp && wa) inp.value = wa;
  }).catch(() => {});

  apiCall('/api/perfil-publico/estado').then(r => {
    const slug = r?.data?.estado?.slug || '';
    const box = document.getElementById('cr-p5-link');
    if (!box) return;
    box.innerHTML = slug
      ? `<button class="btn-secondary" type="button" onclick="window.open('https://heavensy.cl/p/${slug}','_blank')"><i class="fas fa-external-link-alt" style="margin-right:6px"></i>Ver mi página</button>
         <div class="cr-sug">heavensy.cl/p/${slug}</div>`
      : `<div class="cr-sug">Publica tu perfil para obtener el enlace.</div>`;
  }).catch(() => {
    const box = document.getElementById('cr-p5-link');
    if (box) box.innerHTML = `<div class="cr-sug">—</div>`;
  });
}

window.crP5Guardar = async function(){
  const body = { whatsapp_publico: document.getElementById('cr-p5-wa').value.trim() };
  const cid = localStorage.getItem('company_id');
  const res = await apiCall('/api/companies/' + cid + '/config', { method:'PUT', body: JSON.stringify(body) }).catch(() => null);
  const msg = document.getElementById('cr-p5-msg');
  if (res?.ok){ msg.textContent = 'Guardado ✓'; msg.style.color = '#10b981'; }
  else { msg.textContent = (res?.data?.error) || 'Error'; msg.style.color = '#ef4444'; }
  setTimeout(() => msg.textContent = '', 3000);
};


// ── Editor de recurso (popup del lápiz) adaptado al rubro (3.3.4-fix) ──
// El modal #user-edit-overlay tiene pestañas y un <select> de rol hardcodeado
// (molde salud). Para objeto se ocultan las pestañas que no aplican
// (Especialidad); el <select> nativo de rol pasa a chips Heavensy en todo rubro.
// Se observa la apertura del modal (cambia de display).
function _crVigilarModalRecurso(){
  const ov = document.getElementById('user-edit-overlay');
  if (!ov || ov.dataset.crObs) return;
  ov.dataset.crObs = '1';
  const obs = new MutationObserver(() => {
    const visible = ov.style.display !== 'none' && ov.offsetParent !== null;
    if (visible) _crModularModalRecurso(ov);
  });
  obs.observe(ov, { attributes:true, attributeFilter:['style','class'] });
}

function _crModularModalRecurso(ov){
  if (ov.dataset.crDone === (_crCompanyId||'')) return;  // ya modulado para esta empresa
  ov.dataset.crDone = _crCompanyId || '';

  // (a) Ocultar pestañas que no aplican según naturaleza.
  // Para objeto: Especialidad (índice 2) no corresponde.
  if (_crRec && _crRec.naturaleza === 'objeto'){
    ov.querySelectorAll('.ue-tab').forEach(tab => {
      const oc = tab.getAttribute('onclick') || '';
      const txt = tab.textContent.trim().toLowerCase();
      if (/jmtab\(2/.test(oc) || /especialidad/.test(txt)) tab.style.display = 'none';
    });
  } else {
    ov.querySelectorAll('.ue-tab').forEach(tab => tab.style.display = '');
  }

  // (b) <select> de rol nativo → chips Heavensy (en TODO rubro, regla anti-nativos).
  const sel = ov.querySelector('select');
  if (sel && !sel.dataset.crReplaced){
    const grupo = sel.closest('.form-group');
    if (grupo && /rol/i.test(grupo.querySelector('label')?.textContent || '')){
      sel.dataset.crReplaced = '1';
      const roles = [...sel.options].map(o => o.textContent.trim());
      const actual = sel.options[sel.selectedIndex]?.textContent.trim() || roles[0];
      sel.style.display = 'none';
      const chips = document.createElement('div');
      chips.className = 'toggle-group'; chips.dataset.crRoleChips = '1';
      chips.innerHTML = roles.map(r =>
        `<span class="toggle-btn ${r===actual?'on':''}" onclick="crModalSelRol(this)">${r}</span>`).join('');
      grupo.appendChild(chips);
    }
  }
}

window.crModalSelRol = function(el){
  el.parentElement.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('on'));
  el.classList.add('on');
  // reflejar en el <select> oculto para que el guardado original lo lea
  const sel = el.closest('.form-group').querySelector('select');
  if (sel){ [...sel.options].forEach((o,i) => { if (o.textContent.trim() === el.textContent.trim()) sel.selectedIndex = i; }); }
};


// ── Cuentas de acceso: solo usuarios con login (3.3.4-fix) ──
// Para sectores OBJETO, una cabaña/inmueble es inventario (recurso), NO una
// cuenta de acceso. Se ocultan las filas data-recurso="si"; viven en "Mis
// cabañas". Persona conserva ambos (un profesional es usuario y recurso).
function _crFiltrarCuentas(){
  if (!_crRec || _crRec.naturaleza !== 'objeto') return;
  const tbody = document.getElementById('users-tbody');
  if (!tbody) return;
  const aplicar = () => {
    tbody.querySelectorAll('tr[data-recurso="si"]').forEach(tr => { tr.style.display = 'none'; });
    // Actualizar el contador "Lista de usuarios N" si existe
    const visibles = tbody.querySelectorAll('tr[data-name]:not([style*="display: none"])').length;
    const cnt = document.getElementById('users-count') || document.querySelector('.cr-cuentas-count');
    if (cnt) cnt.textContent = visibles;
  };
  aplicar();
  if (!tbody.dataset.crFiltObs){
    tbody.dataset.crFiltObs = '1';
    new MutationObserver(aplicar).observe(tbody, { childList:true });
  }
}


// ── Bloque "Agregar miembro al equipo" según naturaleza (3.3.4-fix) ──
// OBJETO: ocultar (recursos→"Mis cabañas", usuarios→"Cuentas de acceso"; este
//   bloque de persona no aplica). PERSONA: mantener, pero el <select> nativo de
//   "Rol en el equipo" pasa a chips Heavensy (regla anti-nativos).
function _crBloqueMiembro(){
  const btn = document.querySelector('[onclick*="toggleAddMember"]');
  const panel = document.getElementById('add-member-panel');
  const esObjeto = _crRec && _crRec.naturaleza === 'objeto';

  // Botón "Agregar miembro al equipo": el primero (no el de dentro del panel)
  const botones = [...document.querySelectorAll('[onclick*="toggleAddMember"]')];
  const btnPrincipal = botones.find(b => /Agregar miembro/i.test(b.textContent));

  if (esObjeto){
    if (btnPrincipal) btnPrincipal.style.display = 'none';
    if (panel) panel.style.display = 'none';
    return;
  } else {
    if (btnPrincipal) btnPrincipal.style.display = '';
  }

  // PERSONA: el rol del bloque "Agregar miembro" se gestiona ahora con chips
  // poblados desde BD por configuracion.js (cfgLoadRolesEquipo). El #add-rol pasó
  // de <select> a <input type="hidden"> (configuracion.html 15-06), por lo que la
  // antigua migración select→chips de aquí quedó obsoleta y además crasheaba
  // ([...input.options] no es iterable), cortando crInit antes de pintar la tabla
  // de "Mi equipo". Se elimina esa migración; el manejo de rol vive en configuracion.js.
}

// ── Arranque ──
// Oculta el contenido de #panel-0 mientras config-rubro monta, para que no se
// vea la "Lista de usuarios" cruda durante el ~1s que tardan las 2 llamadas de
// _crCargar (empresa + sector). Se revela ya reorganizado ("Mi equipo"). Usa
// visibility (no display) para no provocar saltos de layout. Idempotente.
function _crOcultarPanel(){
  const p = document.getElementById('panel-0');
  if (p) p.style.visibility = 'hidden';
}
function _crRevelarPanel(){
  const p = document.getElementById('panel-0');
  if (p) p.style.visibility = '';
}

window.crInit = async function(){
  // Guard de página: SOLO en Configuración (perfil-iframe es único de esa
  // página). Evita la colisión de IDs con el wizard de Empresas (v3).
  if (!document.getElementById('perfil-iframe')) return;
  // Anti-concurrencia: crInit es async (await _crCargar hace 2 llamadas API).
  // Sin este guard, un segundo disparo entra durante el await y monta dos veces.
  if (_crBusy) return;
  // Si ya está activo para la MISMA empresa, no hay nada que montar ni ocultar.
  const cidActual = localStorage.getItem('company_id');
  if (document.getElementById('cr-ctx') && cidActual === _crCompanyId) return;
  _crBusy = true;
  // Ocultar el panel ANTES del await para que no se vea la lista de usuarios
  // cruda mientras carga. Se revela en el finally, ya reorganizado.
  _crOcultarPanel();
  try{
    if (document.getElementById('cr-ctx')){
      _crReset();   // cambió de empresa: reconstruir desde cero
    }
    if (!await _crCargar()) return;   // sin catálogo → página como siempre (se revela en finally)
    _crTabs(); _crCtxBar(); _crPasos();
    // Cargar los recursos de la empresa ACTUAL antes de pintar la disponibilidad.
    // Antes _crLoadRecursos iba al final, así que _crDisponibilidad pintaba los chips
    // con _crRecursos de la empresa ANTERIOR (al cambiar de empresa se veían recursos
    // de otra empresa, ej. profesionales de Diente Sano en Cabañas Lovichu). [16-06]
    await _crLoadRecursos();
    _crDisponibilidad();
    _crCaracteristicas();
    _crEstadia();
    _crModularFormularios();
    _crPerfilPaso5();
    _crVigilarModalRecurso();
    _crFiltrarCuentas();
    _crBloqueMiembro();
  }catch(e){ console.warn('config-rubro no activado:', e); }
  finally{ _crBusy = false; _crRevelarPanel(); }
};
// Arranque resiliente: al cargar/refrescar la página estando en #configuracion,
// el DOM del panel puede no estar montado todavía cuando el loader inyecta este
// script. Reintentar hasta que aparezca #perfil-iframe (o agotar intentos), así
// el módulo se inicializa sin depender de un cambio de empresa.
(function _crArranque(){
  let intentos = 0;
  const t = setInterval(function(){
    intentos++;
    if (document.getElementById('cr-ctx')){ clearInterval(t); return; }  // ya activo
    if (document.getElementById('perfil-iframe')){ clearInterval(t); window.crInit(); return; }
    if (intentos >= 20) clearInterval(t);  // ~10s máx, no insistir para siempre
  }, 500);
})();
crInit();
window.addEventListener('hashchange', function(){
  if (/configuracion/.test(location.hash||'')) setTimeout(window.crInit, 450);
});
// Cambio de empresa por el selector global (layout.js emite el evento).
// Solución limpia: reaccionar al evento en vez de hacer polling.
window.addEventListener('heavensy:company-changed', function(){
  const estabaActivo = !!document.getElementById('cr-ctx');
  if (estabaActivo) _crReset();
  // Reconstruir si estábamos en Configuración (activo) o si el hash lo indica.
  if (estabaActivo || /configuracion/.test(location.hash||'')) setTimeout(window.crInit, 300);
});

// ── Sincronización de especialidades (Fase B) ─────────────────────────────
// Si otro editor guarda specialties del recurso que tengo abierto en el form,
// actualizo mis chips sin recargar.
window.addEventListener('hvy:specialties-updated', function(ev){
  const { resourceId, specialties } = ev.detail || {};
  if (!resourceId || _crEditId !== resourceId) return;       // solo si es el recurso abierto
  if (!document.getElementById('cr-specs')) return;          // y si el panel está visible
  _crSpecsSel = _crNormSpecs(specialties);
  if (typeof _crRenderSpecs === 'function') _crRenderSpecs();
});
})();