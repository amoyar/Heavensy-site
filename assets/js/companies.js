// ============================================
// COMPANIES.JS — Módulo de Empresas
// Heavensy Admin
// ============================================
// ── BITÁCORA ──
// [v2026.06.20-2] companies.js
// 2026-06-20 | Servicios: campo `unidad` (minutos/horas/días/noches). El form de
//              agregar trae un dropdown de unidad (default min) y el chip muestra
//              la unidad ("Cabaña · 2 noches"). Helper _secUniLabel; secSrvAdd
//              envía unidad; _normalizeSectores conserva sv.unidad.
// [v2026.06.20-1] companies.js
// 2026-06-20 | Fase C2: editor visual en acordeón dentro de Sectores→Categoría.
//              Al expandir una categoría se editan sus ESPECIALIDADES (Fase A) y
//              SERVICIOS-plantilla (Fase C1) con chips + alta/baja, sobre los
//              endpoints ya vivos. _normalizeSectores ahora CONSERVA
//              especialidades[] y servicios[] (antes los descartaba). Estado de
//              acordeón abierto en _secAccOpen (sobrevive al re-render). Nuevas:
//              _secRenderProfesiones, _secAccPanelHtml, secToggleAcc, secEspAdd/
//              Delete, secSrvAdd/Delete, _secRefrescar.
// [v2026.06.10-3] companies.js
// 2026-06-10 | Fix UX Paso 2: al navegar entre rubros ya no se pierde la selección
//              de categorías. Nueva memoria por sesión _catsPorRubro: al salir de
//              un rubro se recuerda su selección y al volver se restaura. Al editar,
//              la selección guardada de la empresa queda anclada a su rubro. El
//              payload sigue llevando solo las categorías del rubro activo.
// [v2026.06.10-2] companies.js
// 2026-06-10 | Paso 2 (Rubro): categorías ahora son SELECCIONABLES (multi, opcional).
//              Nuevo estado _selectedCats (profession_key[]) + wToggleCat. Se resetea
//              al cambiar de rubro. El payload guarda company.profesiones = _selectedCats.
//              Al editar, premarca las categorías de la empresa. Revisión las muestra.
//              Paso 4: eliminado el simulador mock (PROFESSION_PROMPT_TEMPLATES,
//              BOT_BASE_PREVIEW, BASE_COMUN_TEXT, MOCK_COMPANY_DATA, dropdown de
//              profesión única y vista previa del prompt). Se conserva la config real
//              del bot (nombre, estilo, saludo, identidad, llegada, conocimiento).
// [v2026.06.10-1] companies.js
// 2026-06-10 | Separación catálogo ↔ prompts: el CRUD de sectores/profesiones
//              apunta a /api/sectores/* (profesiones anidadas bajo su sector_key).
//              La pestaña Prompts conserva /api/ai-prompts/sector|profession para
//              el TEXTO, y ahora carga el content async (el árbol ya no lo trae):
//              promptsOpenSector y promptsEditProfession piden el content por GET.
//              promptsSaveNew encadena crear-profesión (catálogo) + guardar-prompt.
// 2026-06-09 | Fase 6.4: nueva pestaña "Sectores" (initSectoresTab) con CRUD de
//              profesiones por nombre (secProfAdd/Edit/Delete + prof-modal) y
//              edición de nombre/ícono del sector (secSaveSectorMeta).
//              promptsSaveSectorMeta acepta callback de refresco. La pestaña
//              Prompts queda intacta (su limpieza es el paso 6.5).
// 2026-06-09 | Eliminar profesión usa modal estilo Heavensy (prof-del-modal:
//              profCloseDelete/profConfirmDelete) en vez de confirm() nativo.
// 2026-06-09 | Fix: los modales de sector/profesión se reubican a <body>
//              (_hvyHoistModals en cpSwitchTab) para que no queden ocultos
//              dentro de un panel inactivo (display:none).
// 2026-06-09 | Fase 6.5: pestaña Prompts queda SOLO para texto. promptsOpenSector
//              muestra nombre/ícono en solo-lectura (se editan en Sectores), sin
//              botón "Agregar profesión"; las tarjetas del grid ya no llevan
//              acciones de eliminar/activar sector. Crear/editar/eliminar sectores
//              y profesiones vive en la pestaña Sectores.
// 2026-06-09 | Fase 6.3: wizard unificado con los sectores reales. Se eliminan
//              RUBRO_LABELS y RUBRO_TO_SECTOR; el Paso 2 se pinta desde el catálogo
//              (wRenderRubros) usando sector_key directo; _selectedRubro ES el
//              sector_key. Helpers _sectorName/_sectorIcon. Compatibilidad de
//              empresas legadas vía _RUBRO_LEGADO_A_SECTOR (solo edición/listado).
// 2026-06-09 | Aislamiento: tras CREAR una empresa, el superadmin queda en contexto
//              de ella (cpViewAsCompany) para que el wizard de usuarios sugiera esa
//              empresa al crear su primer usuario (y no Heavensy).
// 2026-06-09 | UI: "profesión/es" -> "categoría/s" en la pestaña Sectores (el término
//              sirve para todos los rubros). El preview del wizard (paso Rubro) ahora
//              muestra las categorías del sector como chips (lee de PROMPT_SECTORES).
// 2026-06-09 | Los chips de categoría usan la clase propia .tp-cat-chip (estilo con
//              degradado morado, punto y hover) en vez de .tp-label-chip.
// 2026-06-04 | MERGE de ramas: base del constructor de Prompts/Bot/Pagos
//              (pestaña Prompts, paso 4 Asistente IA, formas de pago, idiomas)
//              + rama multi-empresa (membresía, fix heavensy-mode, dropdowns
//              hvy, dropdown de planes del wizard, título vista empresa).
// 2026-06-04 | Fix raíz vista empresa: initCompaniesPage forzaba heavensy-mode
//              incondicionalmente (línea heredada); ahora condicionado a
//              IS_HEAVENSY. Era la causa de que los admins vieran filtros,
//              ojo y Catastro pese a la regla hvy-only.
// 2026-06-04 | Regla hvy-only global inyectada por JS en initCompaniesPage
//              (el <style> del fragmento HTML no llegaba vía el router).
// 2026-06-04 | Vista empresa: título "Empresa · nombre" (o "Mis empresas" si
//              administra varias); el ojo y Catastro quedan ocultos por la
//              regla hvy-only agregada en companies.html.
// 2026-06-04 | Filtros (empresas y usuarios) convertidos a dropdowns Heavensy
//              vía hvySelectifyAll (assets/js/hvy-select.js).
// 2026-06-04 | Módulo Empresas multi-empresa por membresía: cada admin ve y
//              administra TODAS sus empresas (el backend filtra por membresía).
//              Stats y acciones (editar/eliminar) operan sobre las propias.
// 2026-06-04 | La cadena de montaje del panel Roles también carga el plan de la
//              empresa (rolCargarMiPlan) para la franja y candados upsell.
// 2026-06-03 | Selector de plan del wizard como dropdown estilo Heavensy
//              (cpPlan*), poblado desde la BD; PLANES_LISTA hidratada de BD;
//              fix toggle 'active' con booleano forzado; encadena
//              rolHidratarModelo al montar la pestaña Roles.

console.log('✅ companies.js cargado');

// ── Estado ────────────────────────────────────
let _companies       = [];      // lista completa desde API
let _companiesFiltered = [];    // lista filtrada
let _editingCompanyId  = null;  // null = nueva empresa
let _currentStep       = 0;
let _selectedRubro     = 'salud';
let _selectedCats      = [];     // profession_key[] seleccionadas para la empresa (paso 2)
let _catsPorRubro      = {};     // memoria de selección por rubro durante la sesión del wizard
let _rubroConfig       = null;  // config del template seleccionado

// ── Helpers de sector (fuente única: PROMPT_SECTORES, cargado de la BD) ──
// Reemplazan a las viejas constantes RUBRO_LABELS / RUBRO_TO_SECTOR (Fase 6.3):
// ya no hay lista paralela ni traducción de rubros; se usa sector_key directo.
function _sectorObjByKey(key) {
  return (typeof PROMPT_SECTORES !== 'undefined')
    ? PROMPT_SECTORES.find(x => x.sector_key === key) : null;
}
function _sectorName(key) { const o = _sectorObjByKey(key); return o ? o.name : key; }
function _sectorIcon(key) { const o = _sectorObjByKey(key); return o ? o.icon : '🏢'; }

// Compatibilidad transitoria: empresas creadas antes de la unificación guardaron
// 'template' con nombre de rubro viejo. Se mapea a sector_key SOLO al editarlas.
const _RUBRO_LEGADO_A_SECTOR = { cabanas: 'alojamiento', cowork: 'espacios', educacion: 'academia' };
function _sectorKeyDeEmpresa(company, config) {
  const raw = (company && company.sector_key) || (config && config.template) || 'salud';
  return _RUBRO_LEGADO_A_SECTOR[raw] || raw;
}

// Pinta el grid del Paso 2 con los sectores reales del catálogo (sector_key directo).
async function wRenderRubros() {
  const grid = document.getElementById('rubro-grid');
  if (!grid) return;
  if ((typeof PROMPT_SECTORES === 'undefined' || !PROMPT_SECTORES.length) && typeof _loadSectores === 'function') {
    await _loadSectores();
  }
  grid.innerHTML = (PROMPT_SECTORES || []).map(sec => `
    <div class="rubro-card${sec.sector_key === _selectedRubro ? ' active' : ''}" data-key="${sec.sector_key}" onclick="selectRubro('${sec.sector_key}', this)">
      <div class="rubro-icon">${sec.icon}</div>
      <div class="rubro-name">${escapeHtml(sec.name)}</div>
      <div class="rubro-desc">${sec.profesiones.length} categoría${sec.profesiones.length === 1 ? '' : 's'}</div>
    </div>`).join('');
}

const AVAILABILITY_LABELS = {
  por_hora:              'Disponibilidad por hora (con almuerzo)',
  por_hora_sin_almuerzo: 'Disponibilidad por hora (sin pausa)',
  por_dia:               'Disponibilidad por días (check-in/out)',
  por_visita:            'Disponibilidad por visitas',
};

// ============================================
// CONSTRUCTOR DE PROMPT IA (Paso 4 — Bot)
// ⚠️ FRONTEND-FIRST: datos de ejemplo (mock).
//    Pendiente conectar a backend (ai_prompts + company_services).
// ============================================

// Extracto del prompt BASE (solo lectura). El real vive en MongoDB (db.ai_prompts type:'base').




let _botStyle = 'cercano';  // estilo de lenguaje del bot (se guarda por empresa)

function botSetStyle(style, btn) {
  _botStyle = style;
  const wrap = document.getElementById('w-bot-style');
  if (wrap) wrap.querySelectorAll('.pm-style-pill').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
}

// Activar / desactivar el asistente IA (reemplaza el checkbox "Bot activo")
let _botActive = false;

function _botRenderActivateBtn() {
  const btn = document.getElementById('w-bot-activate-btn');
  const txt = document.getElementById('w-bot-activate-text');
  if (btn) btn.classList.toggle('on', _botActive);
  if (txt) txt.textContent = _botActive ? 'Asistente IA activado' : 'Activar asistente IA';
}

function botToggleActive() {
  _botActive = !_botActive;
  _botRenderActivateBtn();
}

// Idiomas del bot (multi-selección)
function botToggleLang(btn) {
  if (btn) btn.classList.toggle('active');
}

// Formas de pago (Paso 1): activa/desactiva la card y muestra el campo de cuenta
function payToggle(method) {
  const chk  = document.getElementById('w-pay-' + method);
  const card = document.getElementById('pay-card-' + method);
  const body = document.getElementById('pay-body-' + method);
  const on = chk ? chk.checked : false;
  if (card) card.classList.toggle('selected', on);
  if (body) body.style.display = on ? 'block' : 'none';
}

// Llamado al entrar al Paso 4 (Bot)
function wRenderStep4Prompt() {
  // Estilo de lenguaje (pills) según lo guardado en la empresa
  const styleWrap = document.getElementById('w-bot-style');
  if (styleWrap) styleWrap.querySelectorAll('.pm-style-pill').forEach(b =>
    b.classList.toggle('active', b.dataset.style === _botStyle));

  _botRenderActivateBtn();
}












// ── Selector de emojis para el mensaje de bienvenida ──
const GREET_EMOJIS = ['👋','😊','🙂','😃','✨','🎉','💜','💙','🤝','📅','💬','☀️','🌟','🙌','👍','❤️','🥳','😉','🌸','🔥','✅','📲','🕐','🎈'];

function greetToggleEmoji(e) {
  if (e) e.stopPropagation();
  const pop = document.getElementById('greet-emoji-pop');
  if (!pop) return;
  if (pop.style.display === 'none' || !pop.style.display) {
    if (!pop.dataset.rendered) {
      pop.innerHTML = GREET_EMOJIS.map(em => `<span class="greet-emoji" onclick="greetPickEmoji('${em}')">${em}</span>`).join('');
      pop.dataset.rendered = '1';
    }
    pop.style.display = 'grid';
    _greetPositionPop();
    setTimeout(() => document.addEventListener('click', _greetEmojiOutside), 0);
  } else {
    greetCloseEmoji();
  }
}

function _greetPositionPop() {
  const pop = document.getElementById('greet-emoji-pop');
  const btn = document.getElementById('greet-emoji-btn');
  if (!pop || !btn) return;
  const r = btn.getBoundingClientRect();
  const w = 300;
  let left = r.left;
  if (left + w > window.innerWidth - 12) left = window.innerWidth - w - 12;
  if (left < 12) left = 12;
  pop.style.left = left + 'px';
  pop.style.top  = (r.bottom + 6) + 'px';
}

function _greetEmojiOutside(ev) {
  const pop = document.getElementById('greet-emoji-pop');
  const wrap = pop && pop.closest('.greet-emoji-wrap');
  if (wrap && !wrap.contains(ev.target)) greetCloseEmoji();
}

function greetCloseEmoji() {
  const pop = document.getElementById('greet-emoji-pop');
  if (pop) pop.style.display = 'none';
  document.removeEventListener('click', _greetEmojiOutside);
}

function greetPickEmoji(em) {
  const ta = document.getElementById('w-greeting_message');
  if (ta) {
    const start = ta.selectionStart != null ? ta.selectionStart : ta.value.length;
    const end   = ta.selectionEnd   != null ? ta.selectionEnd   : ta.value.length;
    ta.value = ta.value.slice(0, start) + em + ta.value.slice(end);
    ta.focus();
    const pos = start + em.length;
    try { ta.setSelectionRange(pos, pos); } catch (e) {}
  }
  greetCloseEmoji();
}

// ============================================
// INICIALIZACIÓN
// ============================================

let _cpUsersInited = false;
let _cpRolesInited  = false;
let _cpViewMode     = 'heavensy'; // 'heavensy' | 'usuario'

async function initCompaniesPage() {
  // Regla global del modo Heavensy: oculta hvy-only / btn-icon-hvy fuera del
  // sidebar (ojo, Catastro, barra de filtros) cuando NO se está en vista Heavensy.
  // Inyectada por JS para no depender de que el router preserve <style> del HTML.
  if (!document.getElementById('hvy-mode-rules')) {
    const st = document.createElement('style');
    st.id = 'hvy-mode-rules';
    st.textContent = 'body:not(.heavensy-mode) .hvy-only,' +
                     'body:not(.heavensy-mode) .btn-icon-hvy{display:none !important;}';
    document.head.appendChild(st);
  }

  // Filtros como dropdowns estilo Heavensy (el select oculto sigue siendo la fuente)
  if (typeof hvySelectifyAll === 'function') {
    hvySelectifyAll(['f-plan', 'f-status', 'f-template', 'u-f-role', 'u-f-status']);
  }

  _cpUsersInited = false;
  _cpRolesInited  = false;
  // El modo Heavensy SOLO para el equipo Heavensy. Antes se forzaba
  // incondicionalmente (herencia de cuando el módulo era solo de Heavensy)
  // y dejaba a los admins de empresa viendo el panel completo.
  _cpViewMode = window.IS_HEAVENSY ? 'heavensy' : 'usuario';
  if (window.IS_HEAVENSY) {
    document.body.classList.add('heavensy-mode');
  } else {
    document.body.classList.remove('heavensy-mode');
  }

  if (window.IS_HEAVENSY) {
    const titleEl = document.querySelector('.companies-title');
    if (titleEl) titleEl.textContent = 'Empresa Heavensy';
    const uTitleEl = document.querySelector('.u-list-title');
    if (uTitleEl) uTitleEl.textContent = 'Usuarios Heavensy';
  }

  _cpUpdateViewBtn();
  await cpHidratarPlanes();
  await fetchCompanies();
  window.addEventListener('hashchange', _cpRestoreMode, { once: true });
}

// Carga los planes desde la BD, actualiza PLANES_LISTA y puebla el
// dropdown estilo Heavensy del wizard (w-plan-drop).


function cpViewAsCompany(companyId) {
  _cpViewMode = 'usuario';
  document.body.classList.remove('heavensy-mode');
  _companiesFiltered = _companies.filter(c => c.company_id === companyId);
  renderCompanies();
  window._cpOverrideCompanyId = companyId;
  _cpUsersInited = false;
  // Actualizar títulos con nombre de la empresa
  const company = _companies.find(c => c.company_id === companyId);
  const companyName = company?.name || companyId;
  const titleEl = document.querySelector('.companies-title');
  if (titleEl) titleEl.textContent = 'Empresa · ' + companyName;
  const uTitleEl = document.querySelector('.u-list-title');
  if (uTitleEl) uTitleEl.textContent = 'Usuarios · ' + companyName;
  _cpUpdateViewBtn();
}

function _cpRestoreMode() {
  if (window.IS_HEAVENSY) {
    document.body.classList.add('heavensy-mode');
  } else {
    document.body.classList.remove('heavensy-mode');
  }
}

function cpToggleView() {
  const isHeavensy = document.body.classList.contains('heavensy-mode');
  if (isHeavensy) {
    _cpViewMode = 'usuario';
    document.body.classList.remove('heavensy-mode');
    // Mostrar solo empresa propia (HEAVENSY_001)
    try {
      const token = localStorage.getItem('token');
      const p = JSON.parse(atob(token.split('.')[1]));
      const userCompanyId = p.company_id || '';
      _companiesFiltered = _companies.filter(c => c.company_id === userCompanyId);
      window._cpOverrideCompanyId = userCompanyId;
    } catch(e) { _companiesFiltered = []; }
    renderCompanies();
    _cpUsersInited = false;
  } else {
    _cpViewMode = 'heavensy';
    document.body.classList.add('heavensy-mode');
    // Restaurar todas las empresas y usuarios de HEAVENSY_001
    _companiesFiltered = [..._companies];
    window._cpOverrideCompanyId = null;
    renderCompanies();
    _cpUsersInited = false;
    const titleEl = document.querySelector('.companies-title');
    if (titleEl) titleEl.textContent = window.IS_HEAVENSY ? 'Empresa Heavensy' : 'Empresas';
    const uTitleEl = document.querySelector('.u-list-title');
    if (uTitleEl) uTitleEl.textContent = window.IS_HEAVENSY ? 'Usuarios Heavensy' : 'Usuarios';
  }
  _cpUpdateViewBtn();
}

function _cpUpdateViewBtn() {
  if (typeof navUpdateEye === 'function') navUpdateEye();
}

// Reubica los modales de sector/profesión a <body> para que no queden atrapados
// dentro de un panel con display:none (si no, el modal "aparece" en otra pestaña).
function _hvyHoistModals() {
  ['sector-modal', 'sector-del-modal', 'prof-modal', 'prof-del-modal'].forEach(function (id) {
    const el = document.getElementById(id);
    if (el && el.parentElement !== document.body) document.body.appendChild(el);
  });
}

function cpSwitchTab(tab, btn) {
  _hvyHoistModals();
  document.querySelectorAll('.cp-main-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('#companiesRoot .cp-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('cp-panel-' + tab).classList.add('active');

  if (tab === 'usuarios' && !_cpUsersInited) {
    _cpUsersInited = true;
    if (typeof initUsersPage === 'function') initUsersPage();
  }
  if (tab === 'roles' && !_cpRolesInited) {
    _cpRolesInited = true;
    try {
      const token = localStorage.getItem('token');
      if (token) {
        const p = JSON.parse(atob(token.split('.')[1]));
        window.rolCurrentUser = { id: p.user_id || p.sub, company_id: p.company_id, role: p.role };
      }
    } catch(e) {}
    if (typeof rolCargarPlanConfig === 'function') {
      // Hidratar módulos/planes desde la BD ANTES de cargar config y roles.
      const _hidratar = (typeof rolHidratarModelo === 'function')
        ? rolHidratarModelo()
        : Promise.resolve();
      const _miPlan = (typeof rolCargarMiPlan === 'function')
        ? rolCargarMiPlan()
        : Promise.resolve();
      Promise.all([_hidratar, _miPlan]).then(() => rolCargarPlanConfig()).then(() => {
        if (typeof rolCargarRoles === 'function') rolCargarRoles();
      });
    }
  }
  if (tab === 'catastro') {
    if (typeof rolRenderCatalogo === 'function') rolRenderCatalogo();
  }
  if (tab === 'prompts') {
    if (typeof initPromptsTab === 'function') initPromptsTab();
  }
  if (tab === 'sectores') {
    if (typeof initSectoresTab === 'function') initSectoresTab();
  }
}

// ============================================
// PESTAÑA SECTORES (solo equipo Heavensy)
// CRUD de sectores + CRUD de profesiones (nombre).
// El texto del prompt se edita en la pestaña Prompts.
// ============================================

// Refresca el grid de la pestaña activa (Sectores o Prompts) tras crear/eliminar un sector.
function _refreshActiveSectorTab() {
  const secPanel = document.getElementById('cp-panel-sectores');
  if (secPanel && secPanel.classList.contains('active')) {
    if (typeof initSectoresTab === 'function') initSectoresTab();
  } else {
    if (typeof initPromptsTab === 'function') initPromptsTab();
  }
}

async function initSectoresTab() {
  const grid   = document.getElementById('sectores-grid');
  const detail = document.getElementById('sectores-detail');
  if (!grid) return;
  if (detail) { detail.style.display = 'none'; detail.innerHTML = ''; }
  await _loadSectores();
  grid.style.display = '';
  grid.innerHTML = PROMPT_SECTORES.map(s => `
    <div class="sector-card${s.active === false ? ' sector-off' : ''}" onclick="secOpenSector('${s.sector_key}')">
      <div class="sector-card-actions" onclick="event.stopPropagation()">
        <button class="sector-check${s.active !== false ? ' on' : ''}" title="Activar / desactivar sector" onclick="sectorToggleEnabled('${s.sector_key}', this)">
          <i class="fas fa-check"></i>
        </button>
        <button class="sector-del" title="Eliminar sector" onclick="sectorAskDelete('${s.sector_key}')"><i class="fas fa-times"></i></button>
      </div>
      <div class="sector-ico">${s.icon}</div>
      <div class="sector-name">${escapeHtml(s.name)}</div>
      <div class="sector-count">${s.profesiones.length} profesiones</div>
    </div>`).join('');
}

function secOpenSector(key) {
  const s = PROMPT_SECTORES.find(x => x.sector_key === key);
  if (!s) return;
  _secCurrentSector = key;   // recordar para re-render del acordeón
  const grid   = document.getElementById('sectores-grid');
  const detail = document.getElementById('sectores-detail');
  if (grid) grid.style.display = 'none';
  if (!detail) return;
  detail.style.display = 'block';
  detail.innerHTML = `
    <button class="prompts-back" onclick="initSectoresTab()"><i class="fas fa-arrow-left"></i> Volver a sectores</button>

    <div class="sector-meta-edit" style="display:flex;gap:10px;align-items:center;margin:10px 0 16px;flex-wrap:wrap;position:relative">
      <button type="button" class="sector-meta-ico" onclick="promptsToggleSectorIcon(event)" title="Cambiar ícono"
        style="width:46px;height:46px;border:1px solid #e3e1f3;border-radius:12px;background:#fff;font-size:22px;cursor:pointer;line-height:1">${s.icon}</button>
      <input id="sector-meta-name" type="text" value="${escapeHtml(s.name)}" placeholder="Nombre del sector"
        style="flex:1;min-width:180px;padding:11px 13px;border:1px solid #e3e1f3;border-radius:12px;font-size:14px;font-weight:700;color:#2b3556">
      <button class="btn-primary" onclick="secSaveSectorMeta('${s.sector_key}')"><i class="fas fa-save"></i> Guardar nombre / ícono</button>
      <div id="sector-meta-emojis" style="display:none;position:absolute;top:52px;left:0;z-index:30;background:#fff;border:1px solid #e3e1f3;border-radius:12px;box-shadow:0 8px 28px rgba(40,30,80,.16);padding:10px;grid-template-columns:repeat(8,1fr);gap:4px;max-width:330px"></div>
    </div>

    <div class="prompts-detail-head">
      <h2 style="font-size:1.05rem;font-weight:800;color:#2b3556;margin:0">Categorías de ${escapeHtml(s.name)}</h2>
      <button class="btn-primary prompts-add-btn" onclick="secProfAdd('${s.sector_key}')">
        <i class="fas fa-plus"></i> Agregar categoría
      </button>
    </div>

    ${s.profesiones.length ? _secRenderProfesiones(s)
      : '<p style="font-size:13px;color:#9096b0;padding:6px 2px">Aún no hay profesiones. Agrega la primera.</p>'}

    <div style="margin-top:14px;padding-top:12px;border-top:1px solid #eef0f4;font-size:12px;color:#9096b0">
      <i class="fas fa-circle-info"></i> El texto del prompt (base del sector y de cada profesión) se edita en la pestaña <b>Prompts</b>.
    </div>`;
}

// ════════════════════════════════════════════════════════════
// ACORDEÓN de categoría: especialidades + servicios (Fase C2)
// Editor visual sobre los endpoints ya vivos:
//   especialidades → Fase A   ·   servicios → Fase C1
// El estado abierto se guarda en _secAccOpen (profession_key) para
// que sobreviva al re-render que hacemos tras cada alta/baja.
// ════════════════════════════════════════════════════════════
let _secCurrentSector = null;          // sector_key abierto (para re-render)
let _secAccOpen       = new Set();     // profession_key con acordeón abierto

function secToggleAcc(profKey) {
  if (_secAccOpen.has(profKey)) _secAccOpen.delete(profKey);
  else _secAccOpen.add(profKey);
  if (_secCurrentSector) secOpenSector(_secCurrentSector);
}

// Re-carga el catálogo y re-pinta el sector dejando el acordeón abierto.
async function _secRefrescar(sectorKey, profKey) {
  if (profKey) _secAccOpen.add(profKey);
  await _loadSectores();
  secOpenSector(sectorKey);
}

// HTML de todas las categorías del sector (fila + panel de acordeón).
function _secRenderProfesiones(s) {
  return s.profesiones.map((p, i) => {
    const abierto = _secAccOpen.has(p.profession_key);
    const chevron = abierto ? 'down' : 'right';
    return `
      <div class="prof-row sec-prof-row${abierto ? ' open' : ''}">
        <button class="sec-acc-tog" title="Ver especialidades y servicios"
          onclick="secToggleAcc('${p.profession_key}')"><i class="fas fa-chevron-${chevron}"></i></button>
        <i class="fas fa-user" style="color:#8e84fa"></i>
        <span class="pname" style="cursor:pointer" onclick="secToggleAcc('${p.profession_key}')">${escapeHtml(p.name)}</span>
        <span style="display:flex;gap:8px;margin-left:auto">
          <button class="btn-secondary pedit" onclick="secProfEdit('${s.sector_key}', ${i})"><i class="fas fa-pen"></i> Editar nombre</button>
          <button class="btn-secondary pedit" style="color:#ef4444" onclick="secProfDelete('${s.sector_key}', ${i})"><i class="fas fa-trash"></i></button>
        </span>
      </div>
      ${abierto ? _secAccPanelHtml(s.sector_key, p) : ''}`;
  }).join('');
}

// Etiqueta corta de la unidad para el chip ("minutos"->"min", etc.).
function _secUniLabel(u) {
  return ({ minutos: 'min', horas: 'h', dias: 'días', noches: 'noches' })[u] || 'min';
}

// Panel interno del acordeón: bloque Especialidades + bloque Servicios.
function _secAccPanelHtml(sectorKey, p) {
  const pk  = p.profession_key;
  const esp = p.especialidades || [];
  const srv = p.servicios || [];

  const espChips = esp.length ? esp.map(e => `
    <span class="sec-chip">${escapeHtml(e.nombre)}
      <button class="sec-chip-x" title="Quitar"
        onclick="secEspDelete('${sectorKey}','${pk}','${e.key}')">✕</button>
    </span>`).join('') : '<span class="sec-empty">Sin especialidades aún.</span>';

  const srvChips = srv.length ? srv.map(sv => `
    <span class="sec-chip sec-chip-srv">${escapeHtml(sv.nombre)}${sv.duracion ? ` · ${sv.duracion} ${_secUniLabel(sv.unidad)}` : ''}
      <button class="sec-chip-x" title="Quitar"
        onclick="secSrvDelete('${sectorKey}','${pk}','${sv.key}')">✕</button>
    </span>`).join('') : '<span class="sec-empty">Sin servicios aún.</span>';

  return `
    <div class="sec-acc-panel">
      <div class="sec-acc-sub">
        <div class="sec-acc-h"><i class="fas fa-star" style="color:#9961FF"></i> Especialidades</div>
        <div class="sec-chips">${espChips}</div>
        <div class="sec-add">
          <input type="text" id="esp-add-${pk}" placeholder="Nueva especialidad"
            onkeydown="if(event.key==='Enter')secEspAdd('${sectorKey}','${pk}')">
          <button class="btn-primary btn-sm" onclick="secEspAdd('${sectorKey}','${pk}')"><i class="fas fa-plus"></i> Agregar</button>
        </div>
      </div>

      <div class="sec-acc-sub">
        <div class="sec-acc-h"><i class="fas fa-briefcase" style="color:#9961FF"></i> Servicios
          <span class="sec-hint">la duración es sugerida — cada empresa puede ajustarla</span>
        </div>
        <div class="sec-chips">${srvChips}</div>
        <div class="sec-add">
          <input type="text" id="srv-add-nom-${pk}" placeholder="Nuevo servicio">
          <input type="number" id="srv-add-dur-${pk}" min="1" placeholder="cant." class="sec-add-dur"
            onkeydown="if(event.key==='Enter')secSrvAdd('${sectorKey}','${pk}')">
          <select id="srv-add-uni-${pk}" class="sec-add-uni" title="Unidad de la duración">
            <option value="minutos">min</option>
            <option value="horas">horas</option>
            <option value="dias">días</option>
            <option value="noches">noches</option>
          </select>
          <button class="btn-primary btn-sm" onclick="secSrvAdd('${sectorKey}','${pk}')"><i class="fas fa-plus"></i> Agregar</button>
        </div>
      </div>
    </div>`;
}

// ── CRUD especialidades (catálogo de la categoría) ──
async function secEspAdd(sectorKey, profKey) {
  const inp = document.getElementById(`esp-add-${profKey}`);
  const nombre = inp ? inp.value.trim() : '';
  if (!nombre) { if (inp) inp.focus(); return; }
  const res = await apiCall(`/api/sectores/${sectorKey}/profesiones/${profKey}/especialidades`, {
    method: 'POST', body: JSON.stringify({ nombre })
  });
  if (res.ok && res.data && res.data.ok) {
    await _secRefrescar(sectorKey, profKey);
    if (typeof showToast === 'function') showToast('Especialidad agregada', 'success');
  } else {
    alert((res.data && res.data.error) || 'No se pudo agregar la especialidad');
  }
}

async function secEspDelete(sectorKey, profKey, espKey) {
  const res = await apiCall(`/api/sectores/${sectorKey}/profesiones/${profKey}/especialidades/${espKey}`, {
    method: 'DELETE'
  });
  if (res.ok && res.data && res.data.ok) {
    await _secRefrescar(sectorKey, profKey);
  } else {
    alert((res.data && res.data.error) || 'No se pudo eliminar la especialidad');
  }
}

// ── CRUD servicios-plantilla (catálogo de la categoría) ──
async function secSrvAdd(sectorKey, profKey) {
  const inN = document.getElementById(`srv-add-nom-${profKey}`);
  const inD = document.getElementById(`srv-add-dur-${profKey}`);
  const inU = document.getElementById(`srv-add-uni-${profKey}`);
  const nombre  = inN ? inN.value.trim() : '';
  const durRaw  = inD ? inD.value.trim() : '';
  const unidad  = inU ? inU.value : 'minutos';
  if (!nombre) { if (inN) inN.focus(); return; }
  const body = { nombre };
  if (durRaw !== '') { body.duracion = durRaw; body.unidad = unidad; }   // el backend valida
  const res = await apiCall(`/api/sectores/${sectorKey}/profesiones/${profKey}/servicios`, {
    method: 'POST', body: JSON.stringify(body)
  });
  if (res.ok && res.data && res.data.ok) {
    await _secRefrescar(sectorKey, profKey);
    if (typeof showToast === 'function') showToast('Servicio agregado', 'success');
  } else {
    alert((res.data && res.data.error) || 'No se pudo agregar el servicio');
  }
}

async function secSrvDelete(sectorKey, profKey, srvKey) {
  const res = await apiCall(`/api/sectores/${sectorKey}/profesiones/${profKey}/servicios/${srvKey}`, {
    method: 'DELETE'
  });
  if (res.ok && res.data && res.data.ok) {
    await _secRefrescar(sectorKey, profKey);
  } else {
    alert((res.data && res.data.error) || 'No se pudo eliminar el servicio');
  }
}

// ── CRUD de profesiones (solo nombre) ──
let _secProfSectorKey = null;   // sector en el que se opera
let _secProfEditKey   = null;   // profession_key en edición (null = creando)

function secProfAdd(sectorKey) {
  _secProfSectorKey = sectorKey;
  _secProfEditKey = null;
  const t = document.getElementById('prof-modal-title');
  if (t) t.textContent = 'Nueva categoría';
  const inp = document.getElementById('prof-modal-name');
  if (inp) inp.value = '';
  const m = document.getElementById('prof-modal');
  if (m) m.style.display = 'flex';
  if (inp) setTimeout(() => inp.focus(), 50);
}

function secProfEdit(sectorKey, idx) {
  const s = PROMPT_SECTORES.find(x => x.sector_key === sectorKey);
  const prof = s && s.profesiones[idx];
  if (!prof) return;
  _secProfSectorKey = sectorKey;
  _secProfEditKey = prof.profession_key;
  const t = document.getElementById('prof-modal-title');
  if (t) t.textContent = 'Editar categoría';
  const inp = document.getElementById('prof-modal-name');
  if (inp) inp.value = prof.name;
  const m = document.getElementById('prof-modal');
  if (m) m.style.display = 'flex';
  if (inp) setTimeout(() => { inp.focus(); inp.select(); }, 50);
}

function profCloseModal() {
  const m = document.getElementById('prof-modal');
  if (m) m.style.display = 'none';
  _secProfSectorKey = null;
  _secProfEditKey = null;
}

async function profSaveModal() {
  const inp = document.getElementById('prof-modal-name');
  const name = inp ? inp.value.trim() : '';
  if (!name) { alert('Escribe el nombre de la categoría'); return; }

  let res;
  if (_secProfEditKey) {
    // Editar nombre de profesión existente (catálogo)
    res = await apiCall(`/api/sectores/${_secProfSectorKey}/profesiones/${_secProfEditKey}`, {
      method: 'PUT', body: JSON.stringify({ name })
    });
  } else {
    // Crear profesión nueva en el catálogo (el prompt se edita luego en Prompts)
    res = await apiCall(`/api/sectores/${_secProfSectorKey}/profesiones`, {
      method: 'POST', body: JSON.stringify({ name })
    });
  }

  if (res.ok && res.data && res.data.ok) {
    const sectorKey = _secProfSectorKey;
    profCloseModal();
    await initSectoresTab();
    secOpenSector(sectorKey);
    if (typeof showToast === 'function') showToast('Categoría guardada', 'success');
  } else {
    const err = (res.data && res.data.error) || 'No se pudo guardar la categoría';
    alert(err);
  }
}

// ── Eliminar profesión (modal estilo Heavensy) ──
let _profToDeleteKey    = null;   // profession_key a eliminar
let _profToDeleteSector = null;   // sector al que pertenece (para refrescar)

function secProfDelete(sectorKey, idx) {
  const s = PROMPT_SECTORES.find(x => x.sector_key === sectorKey);
  const prof = s && s.profesiones[idx];
  if (!prof) return;
  _profToDeleteKey = prof.profession_key;
  _profToDeleteSector = sectorKey;
  const nameEl = document.getElementById('prof-del-name');
  if (nameEl) nameEl.textContent = prof.name;
  const m = document.getElementById('prof-del-modal');
  if (m) m.style.display = 'flex';
}

function profCloseDelete() {
  const m = document.getElementById('prof-del-modal');
  if (m) m.style.display = 'none';
  _profToDeleteKey = null;
  _profToDeleteSector = null;
}

async function profConfirmDelete() {
  if (!_profToDeleteKey) return;
  const profKey   = _profToDeleteKey;
  const sectorKey = _profToDeleteSector;
  const res = await apiCall(`/api/sectores/${sectorKey}/profesiones/${profKey}`, { method: 'DELETE' });
  profCloseDelete();
  if (res.ok && res.data && res.data.ok) {
    await initSectoresTab();
    if (sectorKey) secOpenSector(sectorKey);
    if (typeof showToast === 'function') showToast('Categoría eliminada', 'success');
  } else {
    const err = (res.data && res.data.error) || 'No se pudo eliminar la categoría';
    if (typeof showToast === 'function') showToast(err, 'error'); else alert(err);
  }
}

// ============================================
// PESTAÑA PROMPTS (solo equipo Heavensy)
// ⚠️ FRONTEND-FIRST: catálogo editable; pendiente conectar a db.ai_prompts
// ============================================

// Catálogo de sectores/oficios — se carga desde el backend (GET /api/sectores).
// Normalizado con alias (key/label/base) para compatibilidad con el wizard paso 4.
let PROMPT_SECTORES = [];

function _normalizeSectores(arbol) {
  return (arbol || []).map(s => ({
    sector_key: s.sector_key,
    key:        s.sector_key,            // alias wizard
    name:       s.name || s.sector_key,
    label:      s.name || s.sector_key,  // alias wizard
    icon:       s.icon || '\u{1F3F7}\uFE0F',
    content:    s.content || '',
    base:       s.content || '',         // alias wizard (capa sector)
    active:     s.active !== false,
    enabled:    s.active !== false,      // alias UI
    profesiones: (s.profesiones || []).map(p => ({
      profession_key: p.profession_key,
      name:    p.name || p.profession_key,
      content: p.content || '',
      active:  p.active !== false,
      // Catálogo anidado de la categoría (Fase A especialidades + Fase C1 servicios).
      // Antes se descartaba aquí; el editor visual (acordeón) los necesita.
      especialidades: (p.especialidades || []).map(e => ({
        key:    e.key,
        nombre: e.nombre || e.key,
        active: e.active !== false,
      })),
      servicios: (p.servicios || []).map(sv => ({
        key:      sv.key,
        nombre:   sv.nombre || sv.key,
        duracion: (sv.duracion === undefined ? null : sv.duracion),
        unidad:   sv.unidad || 'minutos',
        active:   sv.active !== false,
      })),
    })),
  }));
}

async function _loadSectores() {
  const res = await apiCall('/api/sectores');
  if (res.ok && res.data && res.data.ok) {
    PROMPT_SECTORES = _normalizeSectores(res.data.sectores);
  } else {
    PROMPT_SECTORES = [];
    if (typeof showToast === 'function') showToast('No se pudieron cargar los prompts', 'error');
  }
  return PROMPT_SECTORES;
}

// Plantilla BASE común — punto de partida para la base de cada sector.
// (Espejo de webhook/ai_prompts/base_COMUN_v1.txt. TODO backend: leer/guardar en ai_prompts.)

async function initPromptsTab() {
  const grid   = document.getElementById('prompts-sectores');
  const detail = document.getElementById('prompts-detail');
  if (!grid) return;
  if (detail) { detail.style.display = 'none'; detail.innerHTML = ''; }
  await _loadSectores();
  // Encabezado del catálogo de sectores
  const titleText = document.getElementById('prompts-title-text');
  if (titleText) titleText.textContent = 'Prompts';
  const descEl = document.getElementById('prompts-desc');
  if (descEl) descEl.style.display = '';
  const addSecBtn = document.getElementById('prompts-add-sector-btn');
  if (addSecBtn) addSecBtn.style.display = '';
  grid.style.display = '';
  grid.innerHTML = PROMPT_SECTORES.map(s => `
    <div class="sector-card${s.active === false ? ' sector-off' : ''}" onclick="promptsOpenSector('${s.sector_key}')">
      <div class="sector-ico">${s.icon}</div>
      <div class="sector-name">${escapeHtml(s.name)}</div>
      <div class="sector-count">${s.profesiones.length} profesiones</div>
    </div>`).join('');
}

async function sectorToggleEnabled(key, btn) {
  const s = PROMPT_SECTORES.find(x => x.sector_key === key);
  if (!s) return;
  const nuevo = !(s.active !== false);
  const res = await apiCall(`/api/sectores/${key}`, { method: 'PUT', body: JSON.stringify({ active: nuevo }) });
  if (!(res.ok && res.data && res.data.ok)) {
    if (typeof showToast === 'function') showToast('No se pudo actualizar el sector', 'error');
    return;
  }
  s.active = nuevo;
  btn.classList.toggle('on', s.active);
  const card = btn.closest('.sector-card');
  if (card) card.classList.toggle('sector-off', !s.active);
  if (typeof showToast === 'function')
    showToast(`Sector "${s.name}" ${s.active ? 'activado' : 'desactivado'}`, 'success');
}

// ── Eliminar sector (con confirmación) ──
let _sectorToDelete = null;

function sectorAskDelete(key) {
  const s = PROMPT_SECTORES.find(x => x.sector_key === key);
  if (!s) return;
  _sectorToDelete = key;
  const nameEl = document.getElementById('sector-del-name');
  if (nameEl) nameEl.textContent = s.name;
  const m = document.getElementById('sector-del-modal');
  if (m) m.style.display = 'flex';
}

function sectorCloseDelete() {
  const m = document.getElementById('sector-del-modal');
  if (m) m.style.display = 'none';
  _sectorToDelete = null;
}

async function sectorConfirmDelete() {
  if (!_sectorToDelete) return;
  const key = _sectorToDelete;
  const res = await apiCall(`/api/sectores/${key}`, { method: 'DELETE' });
  if (res.ok && res.data && res.data.ok) {
    if (typeof showToast === 'function') showToast('Sector eliminado', 'success');
  } else {
    const err = (res.data && res.data.error) || 'No se pudo eliminar el sector';
    if (typeof showToast === 'function') showToast(err, 'error');
  }
  sectorCloseDelete();
  _refreshActiveSectorTab();
}

// ── Modal: Agregar sector ──
function promptsAddSector() {
  const nombreEl = document.getElementById('sm-nombre');
  const iconoEl  = document.getElementById('sm-icono');
  const dispEl   = document.getElementById('sm-icono-display');
  if (nombreEl) nombreEl.value = '';
  if (iconoEl)  iconoEl.value = '';
  if (dispEl)   dispEl.textContent = '🏷️';   // emoji por defecto
  sectorCloseEmoji();
  const m = document.getElementById('sector-modal');
  if (m) m.style.display = 'flex';
  setTimeout(() => nombreEl && nombreEl.focus(), 50);
}

function sectorCloseModal() {
  sectorCloseEmoji();
  const m = document.getElementById('sector-modal');
  if (m) m.style.display = 'none';
}

// ── Mini selector de emojis ──
const SECTOR_EMOJIS = [
  '🩺','💊','🦷','🧠','💆','💅','✂️','💇','🧖','🧘','💪','🏋️','⚽','🏊','🏕️','🏨',
  '🛏️','🏠','🏢','💼','📚','✏️','🎓','🎵','🎸','🎨','📸','🎥','🐾','🐶','🚗','🔧',
  '🛠️','⚖️','📋','🍽️','☕','🍷','🍰','🧭','✈️','🎉','💻','📱','🌿','🌸','⭐','🔑'
];

function sectorToggleEmoji(e) {
  if (e) e.stopPropagation();
  const pop = document.getElementById('sm-emoji-pop');
  if (!pop) return;
  if (pop.style.display === 'none' || !pop.style.display) {
    if (!pop.dataset.rendered) {
      pop.innerHTML = SECTOR_EMOJIS.map(em =>
        `<span class="sm-emoji" onclick="sectorPickEmoji('${em}')">${em}</span>`).join('');
      pop.dataset.rendered = '1';
    }
    pop.style.display = 'grid';
    _sectorPositionEmojiPop();
    setTimeout(() => document.addEventListener('click', _sectorEmojiOutside), 0);
  } else {
    sectorCloseEmoji();
  }
}

function _sectorPositionEmojiPop() {
  const pop = document.getElementById('sm-emoji-pop');
  const sel = document.querySelector('#sector-modal .sm-emoji-select');
  if (!pop || !sel) return;
  const r = sel.getBoundingClientRect();
  const w = 330;
  let left = r.left;
  if (left + w > window.innerWidth - 12) left = window.innerWidth - w - 12;
  if (left < 12) left = 12;
  pop.style.left = left + 'px';
  pop.style.top  = (r.bottom + 6) + 'px';
}

function _sectorEmojiOutside(ev) {
  const pop = document.getElementById('sm-emoji-pop');
  const wrap = pop && pop.closest('.sm-emoji-wrap');
  if (wrap && !wrap.contains(ev.target)) sectorCloseEmoji();
}

function sectorCloseEmoji() {
  const pop = document.getElementById('sm-emoji-pop');
  if (pop) pop.style.display = 'none';
  document.removeEventListener('click', _sectorEmojiOutside);
}

function sectorPickEmoji(em) {
  const inp  = document.getElementById('sm-icono');
  const disp = document.getElementById('sm-icono-display');
  if (inp)  inp.value = em;
  if (disp) disp.textContent = em;
  sectorCloseEmoji();
}

function _slugify(s) {
  // Quita acentos (NFD) y normaliza a un slug simple (id interno del sector)
  return (s || '').toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

async function sectorSaveNew() {
  const nombre = document.getElementById('sm-nombre')?.value?.trim();
  const icono  = document.getElementById('sm-icono')?.value?.trim() || '🏷️';
  if (!nombre) { alert('Escribe el nombre del sector'); return; }
  const res = await apiCall('/api/sectores', { method: 'POST', body: JSON.stringify({ name: nombre, icon: icono }) });
  if (res.ok && res.data && res.data.ok) {
    sectorCloseModal();
    _refreshActiveSectorTab();
    if (typeof showToast === 'function') showToast(`Sector "${nombre}" agregado`, 'success');
  } else {
    const err = (res.data && res.data.error) || 'No se pudo crear el sector';
    alert(err);
  }
}

function promptsOpenSector(key) {
  const s = PROMPT_SECTORES.find(x => x.sector_key === key);
  if (!s) return;
  const grid   = document.getElementById('prompts-sectores');
  const detail = document.getElementById('prompts-detail');
  if (grid) grid.style.display = 'none';

  // Encabezado dinámico: "Prompts de <Sector>", sin descripción ni botón de sector
  const titleText = document.getElementById('prompts-title-text');
  if (titleText) titleText.textContent = 'Prompts de ' + s.name;
  const descEl = document.getElementById('prompts-desc');
  if (descEl) descEl.style.display = 'none';
  const addSecBtn = document.getElementById('prompts-add-sector-btn');
  if (addSecBtn) addSecBtn.style.display = 'none';

  if (!detail) return;
  detail.style.display = 'block';
  detail.innerHTML = `
    <button class="prompts-back" onclick="initPromptsTab()"><i class="fas fa-arrow-left"></i> Volver a sectores</button>

    <div class="sector-meta-edit" style="display:flex;gap:10px;align-items:center;margin:10px 0 16px;flex-wrap:wrap">
      <div style="width:46px;height:46px;border:1px solid #e3e1f3;border-radius:12px;background:#fff;font-size:22px;display:flex;align-items:center;justify-content:center">${s.icon}</div>
      <div style="font-size:15px;font-weight:800;color:#2b3556">${escapeHtml(s.name)}</div>
      <span style="font-size:11.5px;color:#9096b0;margin-left:auto"><i class="fas fa-circle-info"></i> El nombre, ícono y las profesiones se administran en la pestaña <b>Sectores</b>.</span>
    </div>

    <details class="sector-base">
      <summary><i class="fas fa-shield-halved"></i> Conocimiento del sector — aplica a todas las profesiones de ${escapeHtml(s.name)} <span class="sector-base-tag">editable</span></summary>
      <div class="sector-base-body">
        <p class="sector-base-hint">Capa de sector (rubro). Lo que está aquí NO se repite en el prompt de cada profesión ni en la base universal.</p>
        <textarea id="sector-base-ta" class="prompt-editor-ta" style="min-height:260px" placeholder="Cargando…"></textarea>
        <div class="sector-base-actions">
          <button class="btn-primary" onclick="promptsSaveBase('${s.sector_key}')"><i class="fas fa-save"></i> Guardar conocimiento del sector</button>
        </div>
      </div>
    </details>

    <div class="prompts-detail-head">
      <h2 style="font-size:1.05rem;font-weight:800;color:#2b3556;margin:0">Profesiones</h2>
    </div>

    ${s.profesiones.map((p, i) => `
      <div class="prof-row">
        <i class="fas fa-user" style="color:#8e84fa"></i>
        <span class="pname">${escapeHtml(p.name)}</span>
        <button class="btn-secondary pedit" onclick="promptsEditProfession('${s.sector_key}', ${i})">
          <i class="fas fa-pen"></i> Editar prompt
        </button>
      </div>`).join('')}`;

  // El árbol del catálogo ya no trae el texto del prompt; se carga aparte (ai_prompts).
  apiCall(`/api/ai-prompts/sector/${key}`).then(res => {
    const ta = document.getElementById('sector-base-ta');
    if (!ta) return;  // el usuario pudo navegar a otra vista
    const content = (res.ok && res.data && res.data.ok && res.data.prompt) ? (res.data.prompt.content || '') : '';
    ta.value = content;
    const s2 = PROMPT_SECTORES.find(x => x.sector_key === key);
    if (s2) { s2.content = content; s2.base = content; }
  });
}

function promptsToggleSectorIcon(e) {
  if (e) e.stopPropagation();
  const g = document.getElementById('sector-meta-emojis');
  if (!g) return;
  if (!g.dataset.rendered) {
    const lista = (typeof SECTOR_EMOJIS !== 'undefined') ? SECTOR_EMOJIS : [];
    g.innerHTML = lista.map(em => `<span class="sm-emoji" onclick="promptsPickSectorIcon('${em}')">${em}</span>`).join('');
    g.dataset.rendered = '1';
  }
  g.style.display = (g.style.display === 'none' || !g.style.display) ? 'grid' : 'none';
}

function promptsPickSectorIcon(em) {
  const btn = document.querySelector('.sector-meta-ico');
  if (btn) btn.textContent = em;
  const g = document.getElementById('sector-meta-emojis');
  if (g) g.style.display = 'none';
}

async function promptsSaveSectorMeta(key, onSaved) {
  const nameEl = document.getElementById('sector-meta-name');
  const icoEl  = document.querySelector('.sector-meta-ico');
  const name = nameEl ? nameEl.value.trim() : '';
  const icon = icoEl ? icoEl.textContent.trim() : '';
  if (!name) { alert('El nombre del sector no puede estar vacío'); return; }
  const res = await apiCall(`/api/sectores/${key}`, { method: 'PUT', body: JSON.stringify({ name, icon }) });
  if (res.ok && res.data && res.data.ok) {
    const s = PROMPT_SECTORES.find(x => x.sector_key === key);
    if (s) { s.name = name; s.label = name; s.icon = icon; }
    if (typeof showToast === 'function') showToast('Sector actualizado', 'success');
    if (typeof onSaved === 'function') {
      onSaved();
    } else {
      const t = document.getElementById('prompts-title-text');
      if (t) t.textContent = 'Prompts de ' + name;
    }
  } else {
    if (typeof showToast === 'function') showToast('No se pudo actualizar el sector', 'error');
  }
}

// Guardar nombre/ícono desde la pestaña Sectores (refresca el detalle del sector)
function secSaveSectorMeta(key) {
  promptsSaveSectorMeta(key, function () { secOpenSector(key); });
}

async function promptsSaveBase(key) {
  const s = PROMPT_SECTORES.find(x => x.sector_key === key);
  const ta = document.getElementById('sector-base-ta');
  if (!s || !ta) return;
  const res = await apiCall(`/api/ai-prompts/sector/${key}`, { method: 'PUT', body: JSON.stringify({ content: ta.value }) });
  if (res.ok && res.data && res.data.ok) {
    s.content = ta.value; s.base = ta.value;
    if (typeof showToast === 'function') showToast(`Conocimiento de "${s.name}" guardado`, 'success');
  } else {
    if (typeof showToast === 'function') showToast('No se pudo guardar', 'error');
  }
}

function _starterPrompt(prof) {
  return `Eres el asistente de un/a ${prof}. Informa, resuelve dudas y guía al cliente hasta agendar/comprar.

CONOCIMIENTO DEL RUBRO
• (qué hace, terminología en simple, qué problemas resuelve)

PREGUNTAS PARA ENTENDER LA NECESIDAD
• (1 a 3 preguntas para identificar qué necesita el cliente)

DUDAS FRECUENTES
• (preguntas típicas del rubro y cómo responderlas)

OBJECIONES TÍPICAS
• (objeciones reales y cómo manejarlas, enfocando valor/resultado)

EMERGENCIAS ESPECÍFICAS
• (situaciones de urgencia del oficio y cómo actuar o derivar)

LÍMITES DEL OFICIO
• (qué NO hace y cuándo derivar o escalar)

TÁCTICAS DE VENTA
• (cuándo y cómo invitar a agendar; complementa el marco común de la base)`;
}

function promptsEditProfession(sectorKey, idx) {
  const s = PROMPT_SECTORES.find(x => x.sector_key === sectorKey);
  const prof = s && s.profesiones[idx];
  if (!prof) return;
  const detail = document.getElementById('prompts-detail');
  if (!detail) return;
  detail.innerHTML = `
    <button class="prompts-back" onclick="promptsOpenSector('${sectorKey}')"><i class="fas fa-arrow-left"></i> Volver a ${escapeHtml(s.name)}</button>
    <h2 style="font-size:1.05rem;font-weight:800;color:#2b3556;margin:2px 0 10px">${s.icon} ${escapeHtml(prof.name)}</h2>
    <div class="prompt-warn"><i class="fas fa-triangle-exclamation"></i> Plantilla global: afecta a <b>todas las empresas</b> con esta profesión.</div>
    <textarea id="prompt-prof-editor" class="prompt-editor-ta" placeholder="Cargando…"></textarea>
    <div style="margin-top:10px;display:flex;gap:10px;align-items:center">
      <button class="btn-primary" onclick="promptsSaveProfession('${sectorKey}', ${idx})"><i class="fas fa-save"></i> Guardar plantilla</button>
    </div>`;

  // El texto del prompt vive en ai_prompts; el árbol del catálogo ya no lo trae.
  apiCall(`/api/ai-prompts/profession/${prof.profession_key}`).then(res => {
    const ta = document.getElementById('prompt-prof-editor');
    if (!ta) return;  // el usuario pudo navegar a otra vista
    const guardado = (res.ok && res.data && res.data.ok && res.data.prompt) ? (res.data.prompt.content || '') : '';
    const contenido = guardado || _starterPrompt(prof.name);
    ta.value = contenido;
    prof.content = guardado;  // refleja lo realmente guardado (vacío si aún no hay)
  });
}

async function promptsSaveProfession(sectorKey, idx) {
  const s = PROMPT_SECTORES.find(x => x.sector_key === sectorKey);
  const prof = s && s.profesiones[idx];
  const ta = document.getElementById('prompt-prof-editor');
  if (!prof || !ta) return;
  const res = await apiCall(`/api/ai-prompts/profession/${prof.profession_key}`, { method: 'PUT', body: JSON.stringify({ content: ta.value }) });
  if (res.ok && res.data && res.data.ok) {
    prof.content = ta.value;
    if (typeof showToast === 'function') showToast(`Plantilla de "${prof.name}" guardada`, 'success');
  } else {
    if (typeof showToast === 'function') showToast('No se pudo guardar la plantilla', 'error');
  }
}

// ── Modal: Agregar profesión (creador automático de prompt) ──
let _promptsCurrentSector = null;
let _pmLastGen = '';

// Genera SOLO el prompt del oficio (capa de profesión).
// No incluye base (seguridad/agenda/moderación) ni datos de empresa → no duplica.
function _generateProfessionPrompt(oficio) {
  return `# Prompt de profesión: ${oficio}
# Capa de profesión — complementa la base. NO incluye seguridad, agenda ni moderación
# (eso vive en la base), ni datos de la empresa (esos se leen de Configuración).

Eres el asistente de un/a ${oficio}. Informa, resuelve dudas y guía al cliente hasta agendar/comprar.

CONOCIMIENTO DEL RUBRO
• Explica en simple qué hace un/a ${oficio} y qué problemas resuelve.

PREGUNTAS PARA ENTENDER LA NECESIDAD
• Haz 1-3 preguntas para identificar qué necesita el cliente y orientarlo al servicio correcto.

DUDAS FRECUENTES
• Responde las preguntas típicas del rubro (modalidad, duración, requisitos, etc.).

OBJECIONES TÍPICAS
• "Está caro" → destaca el valor y el resultado, sin presionar.
• "Lo pienso" → ofrece resolver dudas y agendar sin compromiso.

EMERGENCIAS ESPECÍFICAS
• Situaciones de urgencia propias del oficio y cómo actuar o derivar.

LÍMITES DEL OFICIO
• Indica qué NO hace un/a ${oficio} y cuándo derivar o escalar.

TÁCTICAS DE VENTA
• Cuándo y cómo invitar a agendar (complementa el marco de venta común de la base).`;
}

function promptsAddProfession(sectorKey) {
  _promptsCurrentSector = sectorKey;
  _pmLastGen = '';
  const oficioEl = document.getElementById('pm-oficio');
  const promptEl = document.getElementById('pm-prompt');
  if (oficioEl) oficioEl.value = '';
  if (promptEl) promptEl.value = '';
  const m = document.getElementById('prompts-modal');
  if (m) m.style.display = 'flex';
  setTimeout(() => oficioEl && oficioEl.focus(), 50);
}

function promptsCloseModal() {
  const m = document.getElementById('prompts-modal');
  if (m) m.style.display = 'none';
}

// Auto-genera mientras se escribe el oficio (sin pisar ediciones manuales)
function promptsGenerate() {
  const oficio = document.getElementById('pm-oficio')?.value?.trim();
  const ta = document.getElementById('pm-prompt');
  if (!ta) return;
  if (!oficio) { if (ta.value === _pmLastGen) ta.value = ''; _pmLastGen = ''; return; }
  if (ta.value && ta.value !== _pmLastGen) return; // el usuario editó: no sobrescribir
  const gen = _generateProfessionPrompt(oficio);
  ta.value = gen;
  _pmLastGen = gen;
}

function _pmSetGenLoading(loading) {
  const btn = document.getElementById('pm-gen-btn');
  const ta  = document.getElementById('pm-prompt');
  if (btn) {
    btn.disabled = loading;
    btn.innerHTML = loading
      ? '<i class="fas fa-spinner fa-spin"></i> Generando con IA…'
      : '<i class="fas fa-wand-magic-sparkles"></i> Crear prompt automáticamente';
  }
  if (ta) ta.placeholder = loading ? 'Generando con IA…' : '';
}

// Botón: genera el prompt con IA real (Claude). Si falla, usa una plantilla local.
async function promptsRegenerate() {
  const oficio = document.getElementById('pm-oficio')?.value?.trim();
  const ta = document.getElementById('pm-prompt');
  if (!ta) return;
  if (!oficio) { alert('Escribe primero el oficio / profesión'); return; }

  _pmSetGenLoading(true);
  ta.value = '';
  try {
    const res = await apiCall('/api/prompts/generate-profession', {
      method: 'POST',
      body: JSON.stringify({ oficio, sector: _promptsCurrentSector })
    });
    if (res && res.ok && res.data && res.data.prompt) {
      ta.value = res.data.prompt;        // ← contenido inteligente de Claude
      _pmLastGen = ta.value;
    } else {
      ta.value = _generateProfessionPrompt(oficio);   // respaldo
      _pmLastGen = ta.value;
      const msg = (res && res.data && res.data.error) || 'No se pudo generar con IA';
      if (typeof showToast === 'function') showToast(msg + ' — se usó una plantilla base', 'warning');
    }
  } catch (e) {
    ta.value = _generateProfessionPrompt(oficio);     // respaldo
    _pmLastGen = ta.value;
    if (typeof showToast === 'function') showToast('Error de conexión — se usó una plantilla base', 'warning');
  } finally {
    _pmSetGenLoading(false);
  }
}

async function promptsSaveNew() {
  const oficio = document.getElementById('pm-oficio')?.value?.trim();
  const prompt = document.getElementById('pm-prompt')?.value?.trim();
  if (!oficio) { alert('Escribe el nombre del oficio / profesión'); return; }
  const s = PROMPT_SECTORES.find(x => x.sector_key === _promptsCurrentSector);
  if (!s) return;
  // 1) Crear la profesión en el catálogo (devuelve el profession_key generado)
  const res = await apiCall(`/api/sectores/${s.sector_key}/profesiones`, {
    method: 'POST',
    body: JSON.stringify({ name: oficio })
  });
  if (res.ok && res.data && res.data.ok) {
    // 2) Si se escribió prompt, guardarlo como texto de la capa profesión (ai_prompts)
    const pk = res.data.profession_key;
    if (pk && prompt) {
      await apiCall(`/api/ai-prompts/profession/${pk}`, {
        method: 'PUT',
        body: JSON.stringify({ content: prompt, sector_key: s.sector_key, name: oficio })
      });
    }
    promptsCloseModal();
    await initPromptsTab();
    promptsOpenSector(s.sector_key);
    if (typeof showToast === 'function') showToast(`Profesión "${oficio}" agregada`, 'success');
  } else {
    const err = (res.data && res.data.error) || 'No se pudo crear la profesión';
    alert(err);
  }
}

// ============================================
// LISTADO
// ============================================

async function fetchCompanies() {
  const tbody   = document.getElementById('companies-tbody');
  const loading = document.getElementById('companies-loading');
  const empty   = document.getElementById('companies-empty');

  if (loading) loading.style.display = 'flex';
  if (empty)   empty.style.display   = 'none';
  if (tbody)   tbody.innerHTML       = '';

  const res = await apiCall('/api/companies', { loaderMessage: 'Cargando empresas...' });

  if (loading) loading.style.display = 'none';

  if (!res.ok) {
    showToast('Error cargando empresas', 'error');
    return;
  }

  _companies         = res.data.companies || [];
  _companiesFiltered = [..._companies];
  renderCompanies();
  updateStats();

  // Vista empresa: título personalizado (igual que "ver como empresa")
  if (!window.IS_HEAVENSY) {
    const titleEl = document.querySelector('.companies-title');
    if (titleEl) {
      titleEl.textContent = _companies.length === 1
        ? 'Empresa · ' + (_companies[0].name || _companies[0].company_id)
        : 'Mis empresas';
    }
  }
}


function renderCompanies() {
  const tbody = document.getElementById('companies-tbody');
  const empty = document.getElementById('companies-empty');
  if (!tbody) return;

  tbody.innerHTML = '';

  if (_companiesFiltered.length === 0) {
    if (empty) empty.style.display = 'flex';
    return;
  }
  if (empty) empty.style.display = 'none';

  _companiesFiltered.forEach(company => {
    const tr = document.createElement('tr');
    const isActive    = company.active !== false;
    const _rawRubro   = company.sector_key || company.business_config?.template || 'salud';
    const rubro       = _RUBRO_LEGADO_A_SECTOR[_rawRubro] || _rawRubro;
    const rubroInfo   = { icon: _sectorIcon(rubro), name: _sectorName(rubro) };
    const hasWa       = !!(company.whatsapp_config?.phone_number_id || company.phone_number_id);
    const plan        = company.plan_id || '—';

    tr.innerHTML = `
      <td>
        <div class="company-name-cell">${escapeHtml(company.name || company.company_id)}</div>
        <div class="company-id-cell">${escapeHtml(company.company_id)}</div>
      </td>
      <td>
        <span class="badge-rubro">${rubroInfo.icon} ${rubroInfo.name}</span>
      </td>
      <td><span class="badge-plan">${escapeHtml(plan)}</span></td>
      <td>
        <span class="wa-indicator ${hasWa ? 'ok' : 'miss'}">
          <i class="fab fa-whatsapp"></i>
          ${hasWa ? 'Configurado' : 'Sin config'}
        </span>
      </td>
      <td>
        <label class="switch">
          <input type="checkbox" ${isActive ? 'checked' : ''}
            onchange="toggleCompanyStatus('${company.company_id}', ${isActive}, this)" />
          <span class="slider"></span>
        </label>
      </td>
      <td>
        <button class="btn-icon btn-icon-hvy" title="Ver como empresa" onclick="cpViewAsCompany('${company.company_id}')">
          <i class="fas fa-eye"></i>
        </button>
        <button class="btn-icon" title="Editar" onclick="openWizard('${company.company_id}')">
          <i class="fas fa-pen"></i>
        </button>
        <button class="btn-icon danger" title="Eliminar" onclick="confirmDeleteCompany('${company.company_id}')">
          <i class="fas fa-trash"></i>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Valor inicial; se reemplaza con los planes de la BD (GET /api/system-roles/plans)
// en cpHidratarPlanes(), llamada desde initCompaniesPage().
let PLANES_LISTA = [
  { id: 'gratis',          label: 'Gratis'              },
  { id: 'automate',        label: 'Automate Pro'        },
  { id: 'secretaria',      label: 'Secretar IA Premium' },
  { id: 'enterprise',      label: 'Enterprise'          },
  { id: 'enterprise_full', label: 'Enterprise Full'     },
];

async function cpHidratarPlanes() {
  try {
    const res = await apiCall('/api/system-roles/plans');
    // apiCall envuelve el JSON del backend en .data → el dato está en res.data.data.plans
    const plans = res?.data?.data?.plans;
    if (Array.isArray(plans) && plans.length) {
      PLANES_LISTA = plans.map(p => ({ id: p.plan_id, label: p.label }));
    } else {
      console.error('No se pudieron cargar los planes desde la BD');
    }
  } catch (e) {
    console.error('Error cargando planes desde la BD:', e);
  }

  // Poblar el dropdown con PLANES_LISTA (de BD o el valor inicial)
  const drop = document.getElementById('w-plan-drop');
  if (drop) {
    drop.innerHTML = PLANES_LISTA.map(p =>
      `<div class="exc-custom-option" data-value="${p.id}" onclick="cpPlanSelect('${p.id}')">${p.label}</div>`
    ).join('');
  }
}

// ── Dropdown de plan estilo Heavensy (autocontenido en este módulo) ──

function cpPlanToggleDrop(ev) {
  if (ev) ev.stopPropagation();
  const drop    = document.getElementById('w-plan-drop');
  const trigger = document.getElementById('w-plan-trigger');
  if (!drop || !trigger) return;
  const isOpen = drop.classList.contains('open');
  cpPlanCloseDrop();
  if (!isOpen) {
    const rect = trigger.getBoundingClientRect();
    drop.style.left  = rect.left + 'px';
    drop.style.top   = (rect.bottom + 4) + 'px';
    drop.style.width = rect.width + 'px';
    drop.classList.add('open');
    trigger.classList.add('open');
    const reposition = () => {
      if (!drop.classList.contains('open')) {
        window.removeEventListener('scroll', reposition, true);
        window.removeEventListener('resize', reposition);
        return;
      }
      const r = trigger.getBoundingClientRect();
      drop.style.left  = r.left + 'px';
      drop.style.top   = (r.bottom + 4) + 'px';
      drop.style.width = r.width + 'px';
    };
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
  }
}

function cpPlanCloseDrop() {
  const drop    = document.getElementById('w-plan-drop');
  const trigger = document.getElementById('w-plan-trigger');
  if (drop)    drop.classList.remove('open');
  if (trigger) trigger.classList.remove('open');
}

// Selecciona un plan: actualiza el hidden (compatible con get/set), el label y el activo

function cpPlanSelect(planId) {
  cpPlanSetValue(planId);
  cpPlanCloseDrop();
}

// Setea el valor del plan (usado también al cargar una empresa para editar)

function cpPlanSetValue(planId) {
  const hidden = document.getElementById('w-plan_id');
  const label  = document.getElementById('w-plan-label');
  const drop   = document.getElementById('w-plan-drop');
  const plan   = PLANES_LISTA.find(p => p.id === planId);

  if (hidden) hidden.value = plan ? plan.id : '';
  if (label) {
    if (plan) {
      label.textContent = plan.label;
      label.style.color = '#383838';
    } else {
      label.textContent = 'Seleccionar plan';
      label.style.color = '#9BA3C0';
    }
  }
  if (drop) {
    drop.querySelectorAll('.exc-custom-option').forEach(o =>
      o.classList.toggle('active', !!(plan && o.dataset.value === plan.id))
    );
  }
}

// Cerrar el dropdown al hacer click fuera
document.addEventListener('click', (e) => {
  const wrap = e.target.closest && e.target.closest('.exc-custom-select-wrap');
  if (!wrap) cpPlanCloseDrop();
});


function updateStats() {
  const total = _companies.length;
  const el    = id => document.getElementById(id);
  if (el('st-total')) el('st-total').textContent = total;

  const bar = el('st-plans-bar');
  if (!bar) return;

  // Contar empresas por plan_id
  const counts = {};
  _companies.forEach(c => {
    const pid = (c.plan_id || '').toLowerCase();
    counts[pid] = (counts[pid] || 0) + 1;
  });

  // Limpiar cards anteriores
  bar.querySelectorAll('.stat-plan').forEach(s => s.remove());

  // Una card fija por cada plan conocido
  PLANES_LISTA.forEach(({ id, label }) => {
    const div = document.createElement('div');
    div.className = 'stat stat-plan';
    div.innerHTML =
      '<div class="stat-label">' + label + '</div>' +
      '<div class="stat-val">' + (counts[id] || 0) + '</div>';
    bar.appendChild(div);
  });
}

// ── Filtros ───────────────────────────────────

function filterCompanies() {
  const search   = (document.getElementById('f-search')?.value   || '').toLowerCase();
  const plan     = (document.getElementById('f-plan')?.value     || '');
  const status   = (document.getElementById('f-status')?.value   || '');
  const template = (document.getElementById('f-template')?.value || '');

  _companiesFiltered = _companies.filter(c => {
    const matchSearch = !search ||
      c.company_id?.toLowerCase().includes(search) ||
      c.name?.toLowerCase().includes(search) ||
      c.contact_email?.toLowerCase().includes(search);

    const matchPlan   = !plan   || c.plan_id === plan;
    const matchStatus = !status ||
      (status === 'active'   && c.active !== false) ||
      (status === 'inactive' && c.active === false);
    const matchTemplate = !template || c.business_config?.template === template;

    return matchSearch && matchPlan && matchStatus && matchTemplate;
  });

  renderCompanies();
}

function clearCompanyFilters() {
  ['f-search','f-plan','f-status','f-template'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  _companiesFiltered = [..._companies];
  renderCompanies();
}

// ── Toggle activo ─────────────────────────────

async function toggleCompanyStatus(companyId, currentActive, checkbox) {
  const newActive = !currentActive;
  const res = await apiCall(`/api/companies/${companyId}`, {
    method: 'PUT',
    body: JSON.stringify({ active: newActive }),
  });

  if (res.ok) {
    const company = _companies.find(c => c.company_id === companyId);
    if (company) company.active = newActive;
    updateStats();
    showToast(`Empresa ${newActive ? 'activada' : 'desactivada'}`, 'success');
  } else {
    checkbox.checked = currentActive; // revertir
    showToast('Error actualizando empresa', 'error');
  }
}

// ── Eliminar ──────────────────────────────────

function confirmDeleteCompany(companyId) {
  const company = _companies.find(c => c.company_id === companyId);
  const name    = company?.name || companyId;

  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40';
  modal.innerHTML = `
    <div style="background:#fff;border-radius:12px;padding:24px;max-width:380px;width:100%;margin:0 16px">
      <div style="font-size:14px;font-weight:700;color:#3b4a6b;margin-bottom:8px">
        ¿Desactivar empresa?
      </div>
      <div style="font-size:12px;color:#6b7280;margin-bottom:20px">
        La empresa <strong>${escapeHtml(name)}</strong> quedará inactiva. Esta acción es reversible.
      </div>
      <div style="display:flex;gap:10px;justify-content:flex-end">
        <button onclick="this.closest('.fixed').remove()"
          style="padding:7px 16px;border:1px solid #e5e7eb;border-radius:7px;font-size:12px;cursor:pointer;background:#fff">
          Cancelar
        </button>
        <button onclick="deleteCompany('${companyId}');this.closest('.fixed').remove()"
          style="padding:7px 16px;border:none;border-radius:7px;font-size:12px;cursor:pointer;background:#ef4444;color:#fff;font-weight:600">
          Desactivar
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

async function deleteCompany(companyId) {
  const res = await apiCall(`/api/companies/${companyId}`, { method: 'DELETE' });
  if (res.ok) {
    showToast('Empresa desactivada', 'success');
    await fetchCompanies();
  } else {
    showToast('Error desactivando empresa', 'error');
  }
}

// ============================================
// WIZARD
// ============================================

async function openWizard(companyId = null) {
  // Asegurar que el dropdown de plan tenga opciones (por si el init no las pobló)
  const planDrop = document.getElementById('w-plan-drop');
  if (planDrop && planDrop.children.length === 0) {
    await cpHidratarPlanes();
  }
  // Resetear selección de plan (en edición, loadCompanyIntoWizard la setea después)
  cpPlanSetValue('');

  _editingCompanyId = companyId;
  _currentStep      = 0;
  _selectedRubro    = 'salud';
  _selectedCats     = [];
  _catsPorRubro     = {};
  _rubroConfig      = null;

  // Limpiar formulario
  clearWizardForm();

  // Título
  const titleEl = document.getElementById('wizard-title');
  if (titleEl) titleEl.textContent = companyId ? 'Editar empresa' : 'Nueva empresa';

  const saveBtnText = document.getElementById('save-btn-text');
  if (saveBtnText) saveBtnText.textContent = companyId ? 'Guardar cambios' : 'Crear empresa';

  // Si edición: cargar datos
  if (companyId) {
    await loadCompanyIntoWizard(companyId);
  } else {
    // Nueva empresa: pintar sectores reales y cargar el template de salud por defecto
    await wRenderRubros();
    await loadRubroTemplate('salud');
  }

  // Mostrar vista wizard
  showView('view-wizard');
  wGoStep(0);
}

function closeWizard() {
  showView('view-list');
  _editingCompanyId = null;
}

function showView(viewId) {
  document.querySelectorAll('#cp-panel-empresas .view').forEach(v => v.classList.remove('active'));
  const view = document.getElementById(viewId);
  if (view) view.classList.add('active');
}

// ── Cargar empresa en wizard ──────────────────

async function loadCompanyIntoWizard(companyId) {
  const [resCompany, resConfig] = await Promise.all([
    apiCall(`/api/companies/${companyId}`),
    apiCall(`/api/companies/${companyId}/config`),
  ]);

  if (!resCompany.ok) {
    showToast('Error cargando empresa', 'error');
    return;
  }

  const company = resCompany.data.company;
  const config  = resConfig.ok ? resConfig.data.config : null;

  // Paso 1: Datos básicos
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
  const setChk = (id, val) => { const el = document.getElementById(id); if (el) el.checked = !!val; };

  set('w-company_id',       company.company_id);
  set('w-name',             company.name);
  set('w-legal_name',       company.legal_name);
  set('w-rut',              company.rut);
  set('w-description',      company.description);
  set('w-contact_email',    company.contact_email);
  set('w-contact_phone',    company.contact_phone);
  set('w-address',          company.address);
  set('w-website',          company.website);
  cpPlanSetValue(company.plan_id);
  setChk('w-active',        company.active !== false);

  // Paso 2: Sector (preferir sector_key; normalizar rubro legado si la empresa es vieja)
  _selectedRubro = _sectorKeyDeEmpresa(company, config);
  _selectedCats  = Array.isArray(company.profesiones) ? company.profesiones.slice() : [];
  _catsPorRubro  = { [_selectedRubro]: _selectedCats.slice() };  // ancla la selección guardada a su rubro
  await wRenderRubros();   // pinta las tarjetas y marca activa _selectedRubro
  await loadRubroTemplate(_selectedRubro);  // renderTemplatePreview pinta las categorías (marca _selectedCats)

  // Paso 3: WhatsApp
  const wa = company.whatsapp_config || {};
  set('w-phone_number_id',  company.phone_number_id || wa.phone_number_id);
  set('w-wa_webhook_url',   wa.webhook_url);
  set('w-wa_access_token',  ''); // no mostrar token por seguridad
  set('w-wa_verify_token',  '');

  // Paso 4: Bot
  const bot = company.bot_config || {};
  set('w-bot_name',          bot.name || company.bot_name);
  set('w-max_messages',      bot.max_messages || company.max_messages);
  set('w-greeting_message',  bot.greeting_message || company.greeting_message);
  _botActive = bot.active !== false;
  _botRenderActivateBtn();

  // Paso 4: personalización de la capa empresa
  _botStyle = bot.style || 'cercano';
  set('w-bot_company_prompt',        bot.company_prompt || '');
  set('w-bot_instrucciones_llegar',  bot.instrucciones_llegar || '');
  set('w-bot_conocimiento',          bot.base_conocimiento || '');

  // Formas de pago (3 métodos, mismos 5 campos)
  const _pm = company.payment_methods || [];
  ['transferencia', 'plataforma', 'paypal'].forEach(m => {
    const f   = _pm.find(x => x && x.type === m);
    const chk = document.getElementById('w-pay-' + m);
    if (chk) chk.checked = !!f;
    set('w-pay-' + m + '-banco',   f ? (f.banco || '') : '');
    set('w-pay-' + m + '-tipo',    f ? (f.tipo_cuenta || '') : '');
    set('w-pay-' + m + '-rut',     f ? (f.rut || '') : '');
    set('w-pay-' + m + '-numero',  f ? (f.numero || '') : '');
    set('w-pay-' + m + '-titular', f ? (f.titular || '') : '');
    if (typeof payToggle === 'function') payToggle(m);
  });

  // Idiomas
  const _langs = (company.languages && company.languages.length) ? company.languages : ['Español'];
  document.querySelectorAll('#w-bot-langs .pm-style-pill').forEach(b =>
    b.classList.toggle('active', _langs.includes(b.dataset.lang)));

  // Deshabilitar company_id en edición
  const cidEl = document.getElementById('w-company_id');
  if (cidEl) { cidEl.disabled = true; cidEl.style.background = '#f9fafb'; }
}

function clearWizardForm() {
  const fields = ['w-company_id','w-name','w-legal_name','w-rut','w-description',
    'w-contact_email','w-contact_phone','w-address','w-website',
    'w-phone_number_id','w-wa_webhook_url','w-wa_access_token','w-wa_verify_token',
    'w-bot_name','w-max_messages','w-greeting_message',
    'w-bot_company_prompt','w-bot_instrucciones_llegar','w-bot_conocimiento'];

  fields.forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.value = ''; el.disabled = false; el.style.background = ''; }
  });

  // Reset personalización
  _selectedCats      = [];
  _catsPorRubro     = {};
  _botStyle          = 'cercano';

  // Reset formas de pago (3 métodos, mismos campos)
  ['transferencia', 'plataforma', 'paypal'].forEach(m => {
    const chk  = document.getElementById('w-pay-' + m);
    const card = document.getElementById('pay-card-' + m);
    const body = document.getElementById('pay-body-' + m);
    if (chk)  chk.checked = false;
    if (card) card.classList.remove('selected');
    if (body) body.style.display = 'none';
    ['banco', 'tipo', 'rut', 'numero', 'titular'].forEach(fld => {
      const el = document.getElementById('w-pay-' + m + '-' + fld); if (el) el.value = '';
    });
  });
  // Reset idiomas (Español por defecto)
  document.querySelectorAll('#w-bot-langs .pm-style-pill').forEach(b =>
    b.classList.toggle('active', b.dataset.lang === 'Español'));

  const wActive = document.getElementById('w-active');
  if (wActive) wActive.checked = true;
  _botActive = false;
  _botRenderActivateBtn();

  // Reset rubro
  document.querySelectorAll('.rubro-card').forEach(card => {
    card.classList.toggle('active', card.dataset.key === 'salud');
  });
  _selectedRubro = 'salud';
  _selectedCats  = [];
  _catsPorRubro  = {};

  // Limpiar error
  const errEl = document.getElementById('wizard-error');
  if (errEl) errEl.style.display = 'none';
}

// ── Navegación de pasos ───────────────────────

function wGoStep(step) {
  _currentStep = step;

  // Actualizar step indicators
  document.querySelectorAll('.step').forEach((el, i) => {
    el.classList.remove('active', 'done');
    if (i < step)  el.classList.add('done');
    if (i === step) el.classList.add('active');
  });

  // Mostrar panel correcto
  document.querySelectorAll('.wizard-panel').forEach((el, i) => {
    el.classList.toggle('active', i === step);
  });

  // Al llegar al Bot: render del constructor de prompt
  if (step === 3) wRenderStep4Prompt();
  // Al llegar a revisión: construir el resumen
  if (step === 4) buildReview();
}

function wNext(currentStep) {
  // Validar paso actual
  if (!validateStep(currentStep)) return;
  wGoStep(currentStep + 1);
}

function validateStep(step) {
  const errEl = document.getElementById('wizard-error');
  if (errEl) errEl.style.display = 'none';

  if (step === 0) {
    const cid   = document.getElementById('w-company_id')?.value?.trim();
    const name  = document.getElementById('w-name')?.value?.trim();
    const email = document.getElementById('w-contact_email')?.value?.trim();

    if (!_editingCompanyId && !cid) {
      showWizardError('El ID de empresa es requerido');
      return false;
    }
    if (!name) {
      showWizardError('El nombre comercial es requerido');
      return false;
    }
    if (!email || !email.includes('@')) {
      showWizardError('El email de contacto es requerido y debe ser válido');
      return false;
    }
  }
  return true;
}

function showWizardError(msg) {
  const errEl = document.getElementById('wizard-error');
  if (!errEl) return;
  errEl.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${escapeHtml(msg)}`;
  errEl.style.display = 'flex';
}

// ── Rubro ─────────────────────────────────────

async function selectRubro(key, card) {
  if (key !== _selectedRubro) {
    // Recordar la selección del rubro que dejamos y restaurar la del nuevo (si la hubo)
    _catsPorRubro[_selectedRubro] = _selectedCats.slice();
    _selectedCats = (_catsPorRubro[key] || []).slice();
  }
  _selectedRubro = key;
  document.querySelectorAll('.rubro-card').forEach(c => c.classList.remove('active'));
  card.classList.add('active');
  await loadRubroTemplate(key);
}

async function loadRubroTemplate(key) {
  const res = await apiCall(`/api/companies/templates/${key}`);
  if (!res.ok) return;

  _rubroConfig = res.data.config;
  renderTemplatePreview(_rubroConfig);
}

function renderTemplatePreview(config) {
  if (!config) return;

  const badgeEl   = document.getElementById('tp-badge');
  const modeEl    = document.getElementById('tp-mode');
  const labelsEl  = document.getElementById('tp-labels');
  const modulesEl = document.getElementById('tp-modules');

  if (badgeEl) {
    const l = config.labels || {};
    badgeEl.textContent = `${l.recurso || '—'} · ${l.servicio || '—'}`;
  }
  if (modeEl) {
    modeEl.textContent = AVAILABILITY_LABELS[config.availability_mode] || config.availability_mode;
  }
  if (labelsEl) {
    const l = config.labels || {};
    const items = [
      ['Recurso', l.recurso], ['Servicio', l.servicio],
      ['Sección', l.seccion_lateral], ['Tab agenda', l.tab_agenda],
    ];
    labelsEl.innerHTML = items.map(([k, v]) =>
      `<div class="tp-label-chip">${k}: <span>${escapeHtml(v || '—')}</span></div>`
    ).join('');
  }
  if (modulesEl) {
    const m = config.modules || {};
    const mods = ['agenda','calendario','especialidad','servicios','inventario','pagos'];
    modulesEl.innerHTML = mods.map(mod =>
      `<span class="tp-module ${m[mod] ? 'on' : 'off'}">
        <i class="fas fa-${m[mod] ? 'check' : 'times'}"></i> ${mod}
      </span>`
    ).join('');
  }
  // Categorías del sector (catálogo) — seleccionables (multi). Alimentan company.profesiones[]
  const catsEl   = document.getElementById('tp-cats');
  const catsWrap = document.getElementById('tp-cats-block');
  if (catsEl) {
    const sector = (typeof PROMPT_SECTORES !== 'undefined')
      ? PROMPT_SECTORES.find(s => s.sector_key === _selectedRubro) : null;
    const profs = (sector && sector.profesiones) ? sector.profesiones : [];
    if (profs.length) {
      catsEl.innerHTML = profs.map(p => {
        const on = _selectedCats.includes(p.profession_key);
        return `<span class="tp-cat-chip${on ? ' active' : ''}" role="button" tabindex="0"
          onclick="wToggleCat('${p.profession_key}', this)">${escapeHtml(p.name)}</span>`;
      }).join('');
      if (catsWrap) catsWrap.style.display = '';
    } else {
      catsEl.innerHTML = '';
      if (catsWrap) catsWrap.style.display = 'none';
    }
  }
}

// Alterna una categoría (profession_key) en la selección de la empresa.
function wToggleCat(key, el) {
  const i = _selectedCats.indexOf(key);
  if (i >= 0) { _selectedCats.splice(i, 1); if (el) el.classList.remove('active'); }
  else        { _selectedCats.push(key);    if (el) el.classList.add('active'); }
}

// ── Revisión ──────────────────────────────────

function buildReview() {
  const container = document.getElementById('review-content');
  if (!container) return;

  const get    = id => document.getElementById(id)?.value || '';
  const getChk = id => document.getElementById(id)?.checked;
  const rubro  = { icon: _sectorIcon(_selectedRubro), name: _sectorName(_selectedRubro) };

  container.innerHTML = `
    <div class="review-section">
      <div class="review-section-title"><i class="fas fa-building"></i> Datos básicos</div>
      <div class="review-grid">
        <div class="review-row">
          <span class="review-label">ID Empresa</span>
          <span class="review-val ${!get('w-company_id') ? 'empty' : ''}">${escapeHtml(get('w-company_id')) || '(sin ID)'}</span>
        </div>
        <div class="review-row">
          <span class="review-label">Nombre</span>
          <span class="review-val">${escapeHtml(get('w-name')) || '—'}</span>
        </div>
        <div class="review-row">
          <span class="review-label">Email</span>
          <span class="review-val">${escapeHtml(get('w-contact_email')) || '—'}</span>
        </div>
        <div class="review-row">
          <span class="review-label">Plan</span>
          <span class="review-val">${escapeHtml(get('w-plan_id')) || '—'}</span>
        </div>
        <div class="review-row">
          <span class="review-label">Estado</span>
          <span class="review-val">${getChk('w-active') ? '✅ Activa' : '⏸ Inactiva'}</span>
        </div>
      </div>
    </div>

    <div class="review-section">
      <div class="review-section-title"><i class="fas fa-th-large"></i> Rubro</div>
      <div class="review-val">${rubro.icon} ${rubro.name}</div>
      ${_rubroConfig ? `
        <div style="margin-top:8px;font-size:11px;color:#7D84C1">
          ${_rubroConfig.labels?.recurso || '—'} · ${_rubroConfig.labels?.servicio || '—'} ·
          ${AVAILABILITY_LABELS[_rubroConfig.availability_mode] || _rubroConfig.availability_mode}
        </div>` : ''}
      ${(() => {
        const sector = (typeof PROMPT_SECTORES !== 'undefined')
          ? PROMPT_SECTORES.find(s => s.sector_key === _selectedRubro) : null;
        const nombres = (sector && sector.profesiones)
          ? sector.profesiones.filter(p => _selectedCats.includes(p.profession_key)).map(p => p.name)
          : [];
        return `<div style="margin-top:8px"><span class="review-label">Categorías</span>
          <span class="review-val ${nombres.length ? '' : 'empty'}">${nombres.length ? escapeHtml(nombres.join(', ')) : 'Ninguna (se definirán luego)'}</span></div>`;
      })()}
    </div>

    <div class="review-section">
      <div class="review-section-title"><i class="fab fa-whatsapp"></i> WhatsApp</div>
      <div class="review-grid">
        <div class="review-row">
          <span class="review-label">Phone Number ID</span>
          <span class="review-val ${!get('w-phone_number_id') ? 'empty' : ''}">${escapeHtml(get('w-phone_number_id')) || 'Sin configurar'}</span>
        </div>
        <div class="review-row">
          <span class="review-label">Access Token</span>
          <span class="review-val ${!get('w-wa_access_token') ? 'empty' : ''}">${get('w-wa_access_token') ? '••••••••' : 'Sin configurar'}</span>
        </div>
      </div>
    </div>

    <div class="review-section">
      <div class="review-section-title"><i class="fas fa-wand-magic-sparkles"></i> Asistente IA</div>
      <div class="review-grid">
        <div class="review-row">
          <span class="review-label">Nombre</span>
          <span class="review-val">${escapeHtml(get('w-bot_name')) || '—'}</span>
        </div>
        <div class="review-row">
          <span class="review-label">Estado</span>
          <span class="review-val">${_botActive ? '✅ Activo' : '⏸ Inactivo'}</span>
        </div>
      </div>
    </div>
  `;
}

// ── Guardar ───────────────────────────────────

async function saveCompany() {
  const saveBtn = document.getElementById('save-btn');
  if (saveBtn) { saveBtn.disabled = true; }

  const errEl = document.getElementById('wizard-error');
  if (errEl) errEl.style.display = 'none';

  try {
    const get    = id => document.getElementById(id)?.value?.trim() || null;
    const getChk = id => document.getElementById(id)?.checked ?? true;

    // Formas de pago (Paso 1) e idiomas (Paso 4)
    const payment_methods = [];
    ['transferencia', 'plataforma', 'paypal'].forEach(m => {
      if (document.getElementById('w-pay-' + m)?.checked) {
        payment_methods.push({
          type:        m,
          banco:       get('w-pay-' + m + '-banco'),
          tipo_cuenta: get('w-pay-' + m + '-tipo'),
          rut:         get('w-pay-' + m + '-rut'),
          numero:      get('w-pay-' + m + '-numero'),
          titular:     get('w-pay-' + m + '-titular'),
        });
      }
    });
    const languages = Array.from(document.querySelectorAll('#w-bot-langs .pm-style-pill.active')).map(b => b.dataset.lang);

    // Sector y categorías seleccionadas (Paso 2) → contrato v2 (lo que el webhook lee para armar las capas)
    const _sectorKey   = _selectedRubro;
    const _profesiones = Array.from(new Set(_selectedCats));  // profession_key[], sin duplicados

    // Construir payload empresa
    const companyData = {
      name:          get('w-name'),
      legal_name:    get('w-legal_name'),
      rut:           get('w-rut'),
      description:   get('w-description'),
      contact_email: get('w-contact_email'),
      contact_phone: get('w-contact_phone'),
      address:       get('w-address'),
      website:       get('w-website'),
      plan_id:       get('w-plan_id'),
      active:        getChk('w-active'),
      sector_key:      _sectorKey,
      profesiones:     _profesiones,
      payment_methods: payment_methods,
      languages:       languages,
      phone_number_id: get('w-phone_number_id'),
      whatsapp_config: {
        phone_number_id: get('w-phone_number_id'),
        webhook_url:     get('w-wa_webhook_url'),
        ...(get('w-wa_access_token') ? { access_token: get('w-wa_access_token') } : {}),
        ...(get('w-wa_verify_token') ? { verify_token: get('w-wa_verify_token') } : {}),
      },
      bot_config: {
        name:             get('w-bot_name'),
        max_messages:     parseInt(get('w-max_messages')) || 150,
        greeting_message: get('w-greeting_message'),
        active:           _botActive,
        // Personalización de la capa empresa (el resto de capas se edita en la pestaña Prompts)
        company_prompt:       get('w-bot_company_prompt'),
        instrucciones_llegar: get('w-bot_instrucciones_llegar'),
        base_conocimiento:    get('w-bot_conocimiento'),
        style:                _botStyle,   // estilo de lenguaje del bot (por empresa)
      },
    };

    let companyId = _editingCompanyId;

    if (_editingCompanyId) {
      // ── EDITAR ──
      const res = await apiCall(`/api/companies/${_editingCompanyId}`, {
        method: 'PUT',
        body:   JSON.stringify(companyData),
      });
      if (!res.ok) {
        showWizardError(res.data?.error || 'Error actualizando empresa');
        return;
      }
    } else {
      // ── CREAR ──
      companyData.company_id = get('w-company_id');
      const res = await apiCall('/api/companies', {
        method: 'POST',
        body:   JSON.stringify(companyData),
      });
      if (!res.ok) {
        showWizardError(res.data?.error || 'Error creando empresa');
        return;
      }
      companyId = res.data.company_id;
    }

    // ── Guardar business_config ──
    if (_rubroConfig && companyId) {
      const configPayload = {
        template:          _selectedRubro,
        labels:            _rubroConfig.labels,
        modules:           _rubroConfig.modules,
        resource_defaults: _rubroConfig.resource_defaults,
        availability_mode: _rubroConfig.availability_mode,
      };
      await apiCall(`/api/companies/${companyId}/config`, {
        method: 'PUT',
        body:   JSON.stringify(configPayload),
      });
    }

    // Si fue CREACIÓN (no edición), recordamos la empresa nueva para dejar al
    // superadmin "en contexto" de ella (así el wizard de usuarios la sugiere).
    const _creadaCompanyId = _editingCompanyId ? null : companyId;

    showToast(
      _editingCompanyId ? 'Empresa actualizada ✅' : 'Empresa creada ✅',
      'success'
    );
    closeWizard();
    await fetchCompanies();

    // Aislamiento: tras crear una empresa, el superadmin queda en contexto de ella
    // para no equivocarse al crear su primer usuario.
    if (_creadaCompanyId && window.IS_HEAVENSY && typeof cpViewAsCompany === 'function') {
      cpViewAsCompany(_creadaCompanyId);
    }

  } catch (err) {
    showWizardError('Error inesperado: ' + err.message);
  } finally {
    if (saveBtn) saveBtn.disabled = false;
  }
}

// ============================================
// EXPONER GLOBALMENTE
// ============================================

window.initCompaniesPage    = initCompaniesPage;
window.cpSwitchTab          = cpSwitchTab;
window.cpToggleView         = cpToggleView;
window.cpViewAsCompany      = cpViewAsCompany;
window.openWizard           = openWizard;
window.closeWizard          = closeWizard;
window.wGoStep              = wGoStep;
window.wNext                = wNext;
window.selectRubro          = selectRubro;
window.wToggleCat           = wToggleCat;
window.saveCompany          = saveCompany;
window.filterCompanies      = filterCompanies;
window.clearCompanyFilters  = clearCompanyFilters;
window.toggleCompanyStatus  = toggleCompanyStatus;
window.confirmDeleteCompany = confirmDeleteCompany;
window.deleteCompany        = deleteCompany;