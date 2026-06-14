// ══════════════════════════════════════════════════════════════
//  CONFIG-RUBRO — Paso "Mi empresa" adaptativo por rubro (Fase 3.2)
//  Módulo independiente: construye en runtime la barra de contexto
//  (rubro + categorías, solo lectura), las pestañas Recursos/Cuentas
//  y la vista de recursos según business.recursos del catálogo.
//  configuracion.js queda intacto; si el sector no tiene catálogo
//  de recursos, esta capa no se activa y la página opera como antes.
// ══════════════════════════════════════════════════════════════
// ── BITÁCORA ──
// [v2026.06.14-4] config-rubro.js
// 2026-06-14 | Foto de recurso objeto: el editor (lápiz) ahora tiene campo para
//              subir foto (sube a Cloudinary vía ppUploadImage, guarda photo_url).
//              Antes no había forma de ponerle foto a una cabaña, por eso las
//              tarjetas mostraban el placeholder. El backend ya aceptaba photo_url.
// [v2026.06.14-3] config-rubro.js
// 2026-06-14 | Formato monetario en la tabla "Mis cabañas": los campos de tipo
//              price (o key precio/valor/monto) se muestran como $50.000 en vez
//              de 50000. Por tipo de campo, sirve para cualquier rubro objeto.
// [v2026.06.14-2] config-rubro.js
// 2026-06-14 | Hardcodeos que inducían a error: el paso 2 mostraba check-in/out
//              con value='15:00'/'12:00' aunque no hubiera dato guardado
//              (parecía guardado sin estarlo). Ahora value solo si hay dato
//              real; la sugerencia va como placeholder.
// [v2026.06.14-1] config-rubro.js
// 2026-06-14 | Activar/desactivar recurso: la Configuración pide
//              ?include_inactive=1 y muestra los inactivos atenuados (opacity
//              .5 + etiqueta "Inactiva") con el toggle desmarcado, para poder
//              reactivarlos. Antes desaparecían (el backend solo devolvía
//              activos). Quitado el botón basurero (solo desactivaba, confuso).
// [v2026.06.13-12] config-rubro.js
// 2026-06-13 | Fix arranque al refrescar: crInit solo corría una vez al cargar
//              el script; si el DOM del panel no estaba montado aún (típico al
//              refrescar en #configuracion), el guard lo abortaba y no reintentaba
//              — solo se activaba al cambiar de empresa. Ahora _crArranque
//              reintenta cada 500ms hasta que exista #perfil-iframe (máx ~10s).
// [v2026.06.13-11] config-rubro.js
// 2026-06-13 | Fix paso 5: el bloque "Contacto y publicación" se renderiza de
//              INMEDIATO (sin await), y los datos (whatsapp, slug) se cargan
//              después y rellenan. Antes, si /perfil-publico/estado fallaba o
//              colgaba, el bloque no aparecía. Separador visual añadido.
// [v2026.06.13-10] config-rubro.js
// 2026-06-13 | Bloque "Agregar miembro al equipo": OBJETO lo oculta (recursos
//              van a "Mis cabañas", usuarios a "Cuentas de acceso"). PERSONA lo
//              mantiene pero migra el <select> "Rol en el equipo" a chips
//              Heavensy. Por naturaleza, no por empresa.
// [v2026.06.13-9] config-rubro.js
// 2026-06-13 | Cuentas de acceso: para sectores objeto, ocultar las filas
//              data-recurso="si" (las cabañas/inmuebles son inventario, no
//              cuentas de login; viven en "Mis cabañas"). Observer del tbody
//              porque se renderiza async. Persona: sin cambios.
// [v2026.06.13-8] config-rubro.js
// 2026-06-13 | Editor de recurso (popup del lápiz, #user-edit-overlay): para
//              objeto oculta la pestaña Especialidad; el <select> nativo de Rol
//              pasa a chips Heavensy en todo rubro (reflejado al select oculto
//              para no romper el guardado original). MutationObserver de apertura.
// [v2026.06.13-7] config-rubro.js
// 2026-06-13 | Fase 3.3.4 — Paso 5 Edición del perfil: fix breadcrumb "Media de
//              —", + WhatsApp público (guarda en business_config) y botón "Ver
//              mi página" (heavensy.cl/p/<slug> desde /perfil-publico/estado).
//              Aplica a todos los rubros. Cierra los 5 pasos.
// [v2026.06.13-6] config-rubro.js
// 2026-06-13 | Campos number inyectados: sin negativos (min=0 por defecto; el
//              schema puede fijar min/max). Guard oninput además del atributo
//              min, por si el navegador permite tipear el signo.
// [v2026.06.13-5] config-rubro.js
// 2026-06-13 | Fix duplicado de Categoría: el motor ya no inyecta el campo
//              'categoria' (lo maneja _crEstadia con chips Heavensy). Breadcrumb
//              "Servicios de —" relabelado al nombre del paso del rubro.
// [v2026.06.13-4] config-rubro.js
// 2026-06-13 | Motor (paso 2): _crModularFormularios ahora INYECTA los campos
//              que el schema declara y el HTML no tiene (min_noches, capacidad,
//              incluye, noches) con inputs Heavensy, id=prefijo+key para que el
//              interceptor de apiCall los recoja. Se limpian en _crReset.
// [v2026.06.13-3] config-rubro.js
// 2026-06-13 | Cambio de empresa: se reemplaza el polling por suscripción al
//              evento global 'heavensy:company-changed' (emitido por layout.js).
//              _crReset() + reconstrucción. Solución limpia y compartida.
// [v2026.06.13-2] config-rubro.js
// 2026-06-13 | FIX cambio de empresa por selector: el módulo recuerda el
//              company_id con que se activó; si cambia (selector, sin
//              hashchange), _crReset() restaura los paneles originales y crInit
//              reconstruye con la nueva empresa. Vigilancia por intervalo de 1s.
// [v2026.06.13-1] config-rubro.js
// 2026-06-13 | Motor de formularios (P1, enfoque A): _crModularFormularios lee
//              business.formularios del sector y oculta/relabela los campos
//              reales de servicio (ses-) y programa (prog-) según el schema.
//              No toca la mecánica de guardado. Campos añadidos y override por
//              empresa: pasos siguientes.
// [v2026.06.12-9] config-rubro.js
// 2026-06-12 | Auditoría controles nativos: el <select> de categoría del
//              formulario de recursos (paso 1) tambien pasa a chips toggle-btn.
//              Ya no queda ningun control nativo en el modulo.
// [v2026.06.12-8] config-rubro.js
// 2026-06-12 | REGLA: nada de controles nativos (<select>/alert/confirm).
//              El selector de categoría del paso 4 pasa de <select> nativo a
//              chips toggle-btn (patrón Heavensy, selección única, re-clic =
//              sin categoría). El interceptor lee el hidden input igual.
// [v2026.06.12-7] config-rubro.js
// 2026-06-12 | Fase 3.3.3 (opción 1) — Paso 4: títulos por rubro
//              (business.pasos), selector de categoría inyectado en los
//              formularios de servicio y programa, e intercepción de apiCall
//              para anexar profession_key al POST/PUT (backend 2.2 lo valida).
//              No reescribe guardarSesion/guardarPrograma.
// [v2026.06.12-6] config-rubro.js
// 2026-06-12 | Fase 3.3.2 — Paso 3 Características (solo objeto): chips de
//              características del recinto (sugeridas del sector +
//              business.caracteristicas_recinto de la empresa) + "Cómo llegar"
//              (texto + link Maps). Reemplaza el molde de especialidades.
//              Guarda en business_config vía PUT /config. Persona: intacto.
// [v2026.06.12-5] config-rubro.js
// 2026-06-12 | Fase 3.3.1 — Paso 2 Disponibilidad por rubro: si el sector es
//              por_dia, el panel muestra check-in/check-out, mínimo de noches
//              y temporadas (guarda en business_config vía PUT /config; carga
//              de GET /api/me/company/config). El contenido por_hora original
//              queda oculto intacto; rubros por_hora no se tocan.
// [v2026.06.12-4] config-rubro.js
// 2026-06-12 | Fix definitivo de bordes: el padding de la página vive en el
//              wrapper .content (no en .step-panel). Lo nuevo (contexto,
//              pestañas, recursos) ahora va dentro de un div.content propio;
//              Cuentas de acceso conserva su .content original.
// [v2026.06.12-3] config-rubro.js
// 2026-06-12 | FIX colisión de páginas: guard que exige #perfil-iframe (solo
//              existe en Configuración) — el módulo ya no invade el wizard de
//              Empresas ni pisa sus labels. Idempotente (#cr-ctx). Re-init en
//              hashchange al volver a Configuración. Barra de contexto DENTRO
//              de #panel-0 (respeta el padding; fix "hasta los bordes").
// [v2026.06.12-2] config-rubro.js
// 2026-06-12 | Estilos movidos a configuracion.css (convención del proyecto:
//              CSS en archivo separado). Este módulo queda solo con lógica.
// [v2026.06.12-1] config-rubro.js
// 2026-06-12 | Fase 3.2 inicial: contexto solo-lectura, labels de pasos
//              desde business.pasos, pestañas Recursos/Cuentas de acceso,
//              CRUD de recursos (POST/PATCH /api/agenda/resources) con
//              categoría validada, campos dinámicos del catálogo,
//              características (objeto) y vínculo a usuario (persona).

(function(){
'use strict';

let _crCompany = null;   // doc de la empresa (profesiones[], business_config)
let _crCompanyId = null;  // company_id con el que se activó el módulo
let _crSector  = null;   // doc del sector (business, profesiones[])
let _crRec     = null;   // atajo: _crSector.business.recursos
let _crRecursos = [];    // recursos de la empresa
let _crCatFiltro = '';
let _crEditId  = null;   // recurso en edición (null = nuevo)
let _crTipoId  = null;   // resource_type_id por defecto (requerido por el POST)

const $ = s => document.querySelector(s);

function _catKeys(){ return (_crCompany?.profesiones) || []; }
function _catName(k){
  const p = (_crSector?.profesiones || []).find(x => x.profession_key === k);
  return p ? (p.name || k) : k;
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
}

// ── Vista de recursos ──
async function _crLoadRecursos(){
  const r = await apiCall('/api/agenda/resources?include_inactive=1').catch(() => null);
  _crRecursos = r?.data?.resources || [];
  const t = await apiCall('/api/agenda/resource-types').catch(() => null);
  _crTipoId = (t?.data?.resource_types || t?.data?.types || [])[0]?._id || null;
  _crRender();
}

function _crRender(){
  const cont = $('#cr-tab-recursos'); if (!cont) return;
  const esP = _esPersona();
  const filas = _crRecursos.filter(r => !_crCatFiltro || r.profession_key === _crCatFiltro);
  const vinculados = _crRecursos.filter(r => r.user_id).length;
  const cols = _crRec.columnas || ['Nombre','Categoría','Activo','Acciones'];

  cont.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:10px">
      <div><div style="font-size:15px;font-weight:800;color:#1e2a5e">${_lbl('titulo','Recursos')}</div>
        <div style="font-size:11px;color:#7D84C1">${_lbl('subtitulo','')}</div></div>
      <button class="btn-primary" onclick="crNuevo()"><i class="fas fa-plus" style="margin-right:6px"></i>${_lbl('btn_nuevo','Nuevo')}</button>
    </div>
    <div class="cr-stats">
      <div class="cr-stat"><div class="n">${_crRecursos.length}</div><div class="l">Total ${(_lbl('plural','recursos')).toLowerCase()}</div></div>
      <div class="cr-stat"><div class="n" style="color:#10b981">${_crRecursos.length}</div><div class="l">Activos</div></div>
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
  const medias = esP
    ? `<td>${r.email || (r.user_id ? '<span class="cr-badge"><i class="fas fa-user-check"></i> Vinculado</span>' : '<span style="color:#ef4444;font-size:10.5px;font-weight:700">Sin usuario</span>')}</td>
       <td>${r.user_id ? '<span class="cr-badge">Vinculado</span>' : '<span style="color:#a8aed1">—</span>'}</td>`
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
        <input id="cr-f-${c.key}" type="${c.tipo==='number'?'number':'text'}" placeholder="${c.placeholder||''}" value="${f[c.key]!==undefined?String(f[c.key]).replace(/"/g,'&quot;'):''}"></div>`).join('')}
    </div>
    ${esP ? `
    <div class="cr-block-p">
      <div style="font-size:11.5px;font-weight:700;color:#059669;margin-bottom:6px"><i class="fas fa-user-check"></i> Vincular a un usuario del sistema</div>
      <div style="font-size:10.5px;color:#5b6a96;margin-bottom:6px">Le permite iniciar sesión y ver su agenda. Busca por nombre o email:</div>
      <input id="cr-f-user-q" placeholder="Buscar usuario… (opcional)" oninput="crBuscarUser(this.value)" style="max-width:320px">
      <div id="cr-user-sug" style="margin-top:6px"></div>
      <input type="hidden" id="cr-f-user-id" value="${r.user_id||''}">
      <div id="cr-user-sel" style="font-size:11px;color:#059669;font-weight:700;margin-top:4px">${r.user_id?'✓ Usuario vinculado':''}</div>
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

let _crUserTimer = null;
window.crBuscarUser = function(q){
  clearTimeout(_crUserTimer);
  if (!q || q.length < 2){ $('#cr-user-sug').innerHTML=''; return; }
  _crUserTimer = setTimeout(async () => {
    const r = await apiCall('/api/users/search?q=' + encodeURIComponent(q)).catch(() => null);
    const users = r?.data?.users || r?.data?.results || [];
    $('#cr-user-sug').innerHTML = users.slice(0,5).map(u =>
      `<span class="cr-chip" onclick="crSelUser('${u._id||u.id}','${(u.name||u.username||'').replace(/'/g,'')}')">${u.name||u.username} ${u.email?('· '+u.email):''}</span>`).join(' ') || '<span style="font-size:10.5px;color:#a8aed1">Sin resultados</span>';
  }, 350);
};
window.crSelUser = function(id, nombre){
  $('#cr-f-user-id').value = id;
  $('#cr-user-sel').textContent = '✓ Vinculado a: ' + nombre;
  $('#cr-user-sug').innerHTML = '';
};

window.crGuardar = async function(){
  const nombre = ($('#cr-f-nombre').value||'').trim();
  if (!nombre){ if (typeof showToast==='function') showToast('El nombre es obligatorio','error'); return; }
  const fields = {};
  (_crRec.campos||[]).forEach(c => {
    const el = $('#cr-f-'+c.key); if (!el) return;
    let v = el.value.trim(); if (v==='') return;
    if (c.tipo==='number' && !isNaN(Number(v))) v = Number(v);
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
  } else {
    body.features = [...document.querySelectorAll('#cr-feats .cr-fchip.on')].map(x => x.textContent.trim());
    const photo = $('#cr-f-photo')?.value; if (photo) body.photo_url = photo;  // [14-06]
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
    $('#cr-form-wrap').innerHTML = '';
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
// Si el sector opera por_dia (alojamiento), el panel 2 muestra check-in/out,
// mínimo de noches y temporadas; lo original queda oculto (intacto en DOM).
// Si es por_hora, no se toca nada.
async function _crDisponibilidad(){
  if ((_crSector?.business?.availability_mode || 'por_hora') !== 'por_dia') return;
  const panel = document.getElementById('panel-1');
  if (!panel || document.getElementById('cr-disp')) return;

  // Ocultar el contenido por_hora original sin destruirlo
  const original = document.createElement('div');
  original.id = 'cr-disp-original'; original.style.display = 'none';
  while (panel.firstChild) original.appendChild(panel.firstChild);
  panel.appendChild(original);

  const rc = await apiCall('/api/me/company/config').catch(() => null);
  const cfg = rc?.data?.config || {};
  const temporadas = cfg.temporadas || [];

  const div = document.createElement('div');
  div.className = 'content'; div.id = 'cr-disp';
  div.innerHTML = `
    <div style="font-size:15px;font-weight:800;color:#1e2a5e;margin-bottom:2px">Disponibilidad</div>
    <div style="font-size:11px;color:#7D84C1;margin-bottom:12px">Reservas por día: el cliente elige fechas de llegada y salida.</div>
    <div class="cr-form">
      <div class="cr-grid">
        <div><label>Hora de check-in</label><input id="cr-d-checkin" type="time" value="${cfg.checkin||''}" placeholder="15:00"></div>
        <div><label>Hora de check-out</label><input id="cr-d-checkout" type="time" value="${cfg.checkout||''}" placeholder="12:00"></div>
        <div><label>Mínimo de noches</label><input id="cr-d-minn" type="number" min="1" value="${cfg.min_noches||''}" placeholder="1"></div>
      </div>
      <label style="margin-top:6px">Temporadas (opcional)</label>
      <div class="cr-sug">Define rangos con nombre (ej: Temporada alta, 15 dic – 28 feb).</div>
      <div id="cr-d-temps"></div>
      <button class="btn-secondary" type="button" onclick="crDispAddTemp()" style="margin:6px 0 10px"><i class="fas fa-plus" style="margin-right:5px"></i>Agregar temporada</button>
      <div><button class="btn-primary" onclick="crDispGuardar()"><i class="fas fa-check" style="margin-right:5px"></i>Guardar disponibilidad</button>
      <span id="cr-d-msg" style="font-size:11px;font-weight:700;margin-left:8px"></span></div>
    </div>`;
  panel.appendChild(div);
  temporadas.forEach(t => crDispAddTemp(t));
}

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
  const temporadas = [...document.querySelectorAll('.cr-d-temp')].map(r => ({
    nombre: r.querySelector('.t-nombre').value.trim(),
    desde:  r.querySelector('.t-desde').value,
    hasta:  r.querySelector('.t-hasta').value,
  })).filter(t => t.nombre || t.desde || t.hasta);
  const body = {
    checkin:    document.getElementById('cr-d-checkin').value,
    checkout:   document.getElementById('cr-d-checkout').value,
    min_noches: parseInt(document.getElementById('cr-d-minn').value || '1', 10),
    temporadas,
  };
  const cid = localStorage.getItem('company_id');
  const res = await apiCall('/api/companies/' + cid + '/config', { method:'PUT', body: JSON.stringify(body) }).catch(() => null);
  const msg = document.getElementById('cr-d-msg');
  if (res?.ok){ msg.textContent = 'Guardado ✓'; msg.style.color = '#10b981'; }
  else { msg.textContent = (res?.data?.error) || 'Error al guardar'; msg.style.color = '#ef4444'; }
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
  if (!_crRec || document.getElementById('cr-cat-ses')) return;
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
  inyectar('ses-nombre', 'cr-cat-ses');
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
const _CR_FORM_PREFIX = { servicio: 'ses-', programa: 'prog-' };


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

  // PERSONA: migrar el <select id="add-rol"> a chips Heavensy
  const sel = document.getElementById('add-rol');
  if (sel && !sel.dataset.crReplaced){
    sel.dataset.crReplaced = '1';
    const roles = [...sel.options].map(o => o.textContent.trim());
    const actual = sel.options[sel.selectedIndex]?.textContent.trim() || roles[0];
    sel.style.display = 'none';
    const chips = document.createElement('div');
    chips.className = 'toggle-group'; chips.dataset.crRoleChips = '1'; chips.style.marginTop = '5px';
    chips.innerHTML = roles.map(r =>
      `<span class="toggle-btn ${r===actual?'on':''}" onclick="crMiembroSelRol(this)">${r}</span>`).join('');
    sel.parentElement.appendChild(chips);
  }
}

window.crMiembroSelRol = function(el){
  el.parentElement.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('on'));
  el.classList.add('on');
  const sel = document.getElementById('add-rol');
  if (sel){ [...sel.options].forEach((o,i) => { if (o.textContent.trim() === el.textContent.trim()) sel.selectedIndex = i; }); }
};

// ── Arranque ──
window.crInit = async function(){
  try{
    // Guard de página: SOLO en Configuración (perfil-iframe es único de esa
    // página). Evita la colisión de IDs con el wizard de Empresas (v3).
    if (!document.getElementById('perfil-iframe')) return;
    const cidActual = localStorage.getItem('company_id');
    if (document.getElementById('cr-ctx')){
      if (cidActual === _crCompanyId) return;  // misma empresa: ya activo
      _crReset();                              // cambió de empresa: reconstruir
    }
    if (!await _crCargar()) return;   // sin catálogo → página como siempre
    _crTabs(); _crCtxBar(); _crPasos();
    _crDisponibilidad();
    _crCaracteristicas();
    _crEstadia();
    _crModularFormularios();
    _crPerfilPaso5();
    _crVigilarModalRecurso();
    _crFiltrarCuentas();
    _crBloqueMiembro();
    _crLoadRecursos();
  }catch(e){ console.warn('config-rubro no activado:', e); }
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
})();