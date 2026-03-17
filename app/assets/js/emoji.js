// ============================================
// EMOJI.JS — Picker profesional para Heavensy
// Datos cargados desde /api/emojis/all (MongoDB)
// ============================================

console.log("😊 emoji.js cargado");

// ─── Cache en memoria (se llena una sola vez por sesión) ──────────────────────
// { icon: "😊", key: "faces", label: "Caras", order: 1, emojis: [...] }
let _categories   = null;   // array de categorías
let _keywords     = null;   // { "😀": ["cara","feliz",...], ... }
let _loadPromise  = null;   // evita peticiones duplicadas simultáneas

// ─── Auth ─────────────────────────────────────────────────────────────────────
function _authHeaders() {
  const token =
    localStorage.getItem("token") ||
    sessionStorage.getItem("token") ||
    window._jwtToken || "";
  return {
    "Content-Type": "application/json",
    ...(token ? { "Authorization": `Bearer ${token}` } : {})
  };
}

// ─── Carga de datos desde API ─────────────────────────────────────────────────
async function loadEmojiData() {
  if (_categories && _keywords) return true;        // ya en cache
  if (_loadPromise) return _loadPromise;             // petición en vuelo

  _loadPromise = (async () => {
    try {
      const res = await fetch(`${API_BASE_URL || ""}/api/emojis/all`, { headers: _authHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      _categories = data.categories || [];
      _keywords   = data.keywords   || {};
      console.log(`✅ Emoji data cargada: ${_categories.length} categorías`);
      return true;
    } catch (err) {
      console.error("❌ Error cargando emoji data:", err);
      _loadPromise = null;   // permitir reintento
      return false;
    }
  })();

  return _loadPromise;
}

// ─── Búsqueda (client-side sobre cache) ──────────────────────────────────────
function searchEmojis(query) {
  if (!_keywords) return [];

  const q = query.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  if (!q) return [];

  const scores = {};

  Object.entries(_keywords).forEach(([emoji, kwList]) => {
    kwList.forEach(kw => {
      const kwNorm = kw.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      if (kwNorm === q)              scores[emoji] = (scores[emoji] || 0) + 10;
      else if (kwNorm.startsWith(q)) scores[emoji] = (scores[emoji] || 0) + 5;
      else if (kwNorm.includes(q))   scores[emoji] = (scores[emoji] || 0) + 2;
    });
  });

  return Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .map(([emoji]) => emoji);
}

// ─── Estado ───────────────────────────────────────────────────────────────────
const PICKER_ID  = "_emojiPicker";
const RECENT_KEY = "_ep_recent";
const RECENT_MAX = 24;

let pickerEl       = null;
let activeCategory = null;   // se setea al cargar (primera categoría de la API)
let searchTimeout  = null;
let isSearching    = false;
let recentEmojis   = [];

function loadRecents() {
  try { recentEmojis = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"); } catch { recentEmojis = []; }
}
function addRecent(emoji) {
  recentEmojis = [emoji, ...recentEmojis.filter(e => e !== emoji)].slice(0, RECENT_MAX);
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(recentEmojis)); } catch {}
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
function injectStyles() {
  if (document.getElementById("_epStyles")) return;
  const s = document.createElement("style");
  s.id = "_epStyles";
  s.textContent = `
    @keyframes _epIn  { from{opacity:0;transform:translateY(10px) scale(.96)} to{opacity:1;transform:translateY(0) scale(1)} }
    @keyframes _epOut { from{opacity:1;transform:translateY(0) scale(1)} to{opacity:0;transform:translateY(6px) scale(.97)} }
    @keyframes _epPop { 0%{transform:scale(1)} 40%{transform:scale(1.4)} 70%{transform:scale(.9)} 100%{transform:scale(1)} }
    @keyframes _epSpin { to { transform: rotate(360deg) } }

    #${PICKER_ID} {
      position:fixed;width:338px;height:408px;
      background:rgba(255,255,255,0.97);
      backdrop-filter:blur(24px) saturate(200%);
      -webkit-backdrop-filter:blur(24px) saturate(200%);
      border:1px solid rgba(139,92,246,.14);
      border-radius:18px;
      box-shadow:0 0 0 1px rgba(139,92,246,.06),0 4px 16px rgba(109,40,217,.08),0 20px 60px rgba(88,28,135,.12);
      z-index:99999;display:none;flex-direction:column;
      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
      overflow:hidden;
    }
    #${PICKER_ID}.ep-open  { display:flex; animation:_epIn  .2s cubic-bezier(.34,1.4,.64,1) both }
    #${PICKER_ID}.ep-close { animation:_epOut .13s ease forwards }

    #_epHeader {
      padding:11px 11px 8px;border-bottom:1px solid rgba(0,0,0,.05);flex-shrink:0;
      background:linear-gradient(to bottom,rgba(245,243,255,.7),transparent);
    }
    #_epHeaderRow { position:relative; }
    #_epSearchIco {
      position:absolute;left:10px;top:50%;transform:translateY(-50%);
      font-size:12px;opacity:.4;pointer-events:none;line-height:1;
    }
    #_epSearch {
      width:100%;padding:7.5px 10px 7.5px 30px;box-sizing:border-box;
      background:rgba(243,244,246,.7);border:1.5px solid transparent;
      border-radius:10px;font-size:13px;color:#1f2937;outline:none;
      transition:border-color .18s,background .18s,box-shadow .18s;line-height:1.4;
    }
    #_epSearch:focus { background:#fff;border-color:rgba(139,92,246,.4);box-shadow:0 0 0 3px rgba(139,92,246,.08); }
    #_epSearch::placeholder { color:#b0b8c8;font-size:12.5px; }
    #_epSearch:disabled { opacity:.5;cursor:not-allowed; }

    #_epCatBar {
      display:flex;gap:1px;padding:5px 9px;overflow-x:auto;
      scrollbar-width:none;flex-shrink:0;border-bottom:1px solid rgba(0,0,0,.05);
      min-height:38px;
    }
    #_epCatBar::-webkit-scrollbar { display:none }
    ._epCat {
      background:none;border:none;font-size:17px;cursor:pointer;
      padding:5px 6px;border-radius:9px;flex-shrink:0;line-height:1;
      transition:background .14s,transform .14s;position:relative;
    }
    ._epCat:hover { background:rgba(139,92,246,.09);transform:scale(1.12); }
    ._epCat.on { background:rgba(139,92,246,.11); }
    ._epCat.on::after {
      content:'';position:absolute;bottom:2px;left:50%;transform:translateX(-50%);
      width:13px;height:2.5px;background:#7c3aed;border-radius:2px;
    }

    ._epLabel {
      width:100%;padding:5px 10px 2px;font-size:10px;font-weight:700;
      color:#8b5cf6;letter-spacing:.1em;text-transform:uppercase;line-height:1;
    }
    ._epDivider {
      width:calc(100% - 20px);margin:3px 10px;height:1px;
      background:linear-gradient(to right,rgba(139,92,246,.15),transparent);
    }

    #_epGrid {
      flex:1;overflow-y:auto;padding:4px 7px 8px;
      display:flex;flex-wrap:wrap;gap:0;align-content:flex-start;
      scrollbar-width:thin;scrollbar-color:rgba(139,92,246,.2) transparent;
    }
    #_epGrid::-webkit-scrollbar { width:4px }
    #_epGrid::-webkit-scrollbar-thumb { background:rgba(139,92,246,.2);border-radius:4px }
    #_epGrid::-webkit-scrollbar-track { background:transparent }

    ._epE {
      background:none;border:none;font-size:21px;cursor:pointer;
      padding:0;border-radius:9px;line-height:1;
      width:36px;height:36px;display:flex;align-items:center;justify-content:center;
      transition:background .12s,transform .12s;flex-shrink:0;
    }
    ._epE:hover { background:rgba(139,92,246,.10);transform:scale(1.22); }
    ._epE:active { transform:scale(.9); }
    ._epE.pop { animation:_epPop .25s ease; }

    /* Estado: cargando */
    #_epLoading {
      display:none;flex:1;flex-direction:column;
      align-items:center;justify-content:center;gap:10px;
      color:#a78bfa;font-size:12.5px;
    }
    #_epSpinner {
      width:22px;height:22px;
      border:2.5px solid rgba(139,92,246,.2);
      border-top-color:#7c3aed;
      border-radius:50%;
      animation:_epSpin .7s linear infinite;
    }

    /* Estado: error */
    #_epError {
      display:none;flex:1;flex-direction:column;
      align-items:center;justify-content:center;
      gap:8px;color:#f87171;font-size:12.5px;padding:20px;text-align:center;
    }
    #_epErrorRetry {
      padding:5px 14px;
      background:rgba(139,92,246,.1);border:1px solid rgba(139,92,246,.2);
      border-radius:8px;color:#7c3aed;font-size:12px;cursor:pointer;
      transition:background .15s;
    }
    #_epErrorRetry:hover { background:rgba(139,92,246,.18); }

    /* Estado: sin resultados */
    #_epEmpty {
      display:none;flex:1;flex-direction:column;
      align-items:center;justify-content:center;
      gap:7px;color:#c0c8d8;font-size:13px;
    }
    #_epEmpty .ico { font-size:30px;opacity:.4; }

    #_epFooter {
      padding:4px 12px 6px;font-size:10px;color:#d1d5db;letter-spacing:.04em;
      text-align:center;border-top:1px solid rgba(0,0,0,.04);flex-shrink:0;
    }
    #_epFooter b { color:#c4b5fd;font-weight:600; }

    ._epE.match { background:rgba(139,92,246,.06); }
  `;
  document.head.appendChild(s);
}

// ─── Helpers de estado visual ─────────────────────────────────────────────────
function _showState(state) {
  // state: "loading" | "error" | "grid" | "empty"
  const grid    = document.getElementById("_epGrid");
  const loading = document.getElementById("_epLoading");
  const error   = document.getElementById("_epError");
  const empty   = document.getElementById("_epEmpty");
  if (!grid) return;

  grid.style.display    = state === "grid"    ? "flex" : "none";
  loading.style.display = state === "loading" ? "flex" : "none";
  error.style.display   = state === "error"   ? "flex" : "none";
  empty.style.display   = state === "empty"   ? "flex" : "none";
}

// ─── Build picker ──────────────────────────────────────────────────────────────
function buildPicker() {
  injectStyles();
  loadRecents();

  const div = document.createElement("div");
  div.id = PICKER_ID;
  div.innerHTML = `
    <div id="_epHeader">
      <div id="_epHeaderRow">
        <span id="_epSearchIco">🔍</span>
        <input id="_epSearch" type="text" placeholder="Buscar emoji…"
               autocomplete="off" spellcheck="false" disabled>
      </div>
    </div>
    <div id="_epCatBar"></div>
    <div id="_epGrid"></div>
    <div id="_epLoading"><div id="_epSpinner"></div><span>Cargando emojis…</span></div>
    <div id="_epError">
      <span style="font-size:24px">⚠️</span>
      <span>No se pudo cargar los emojis</span>
      <button id="_epErrorRetry">Reintentar</button>
    </div>
    <div id="_epEmpty">
      <div class="ico">🔍</div>
      <div>Sin resultados para "<span id="_epEmptyQ"></span>"</div>
    </div>
    <div id="_epFooter"><b>Heavensy</b> &copy; ${new Date().getFullYear()}</div>
  `;
  document.body.appendChild(div);

  // Reintento
  div.querySelector("#_epErrorRetry").addEventListener("click", e => {
    e.stopPropagation();
    _categories  = null;
    _keywords    = null;
    _loadPromise = null;
    _initContent();
  });

  // Búsqueda con debounce (sobre cache en memoria)
  const searchEl = div.querySelector("#_epSearch");
  searchEl.addEventListener("input", e => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      const q = e.target.value.trim();
      isSearching = !!q;
      if (!q) { renderCat(activeCategory); return; }

      const results = searchEmojis(q);
      const emptyQ  = document.getElementById("_epEmptyQ");
      if (emptyQ) emptyQ.textContent = q;
      if (!results.length) { _showState("empty"); return; }
      renderGrid(results, `Resultados: "${q}"`, false);
    }, 150);
  });
  searchEl.addEventListener("keydown", e => { if (e.key === "Escape") closePicker(); });

  div.addEventListener("mousedown", e => e.stopPropagation());
  return div;
}

// ─── Inicializar contenido (llama a la API si hace falta) ─────────────────────
async function _initContent() {
  _showState("loading");

  const ok = await loadEmojiData();
  if (!ok) { _showState("error"); return; }

  // Setear categoría activa con la primera de la API
  if (!activeCategory && _categories.length) {
    activeCategory = _categories[0].key;
  }

  // Poblar barra de categorías
  const bar = document.getElementById("_epCatBar");
  if (bar) {
    bar.innerHTML = "";
    _categories.forEach(cat => {
      const btn = document.createElement("button");
      btn.className = "_epCat" + (cat.key === activeCategory ? " on" : "");
      btn.textContent = cat.icon;
      btn.title = cat.label;
      btn.addEventListener("click", e => {
        e.stopPropagation();
        const s = document.getElementById("_epSearch");
        if (s) { s.value = ""; }
        isSearching    = false;
        activeCategory = cat.key;
        bar.querySelectorAll("._epCat").forEach(b => b.classList.remove("on"));
        btn.classList.add("on");
        renderCat(cat.key);
      });
      bar.appendChild(btn);
    });
  }

  // Habilitar buscador
  const searchEl = document.getElementById("_epSearch");
  if (searchEl) { searchEl.disabled = false; searchEl.focus(); }

  renderCat(activeCategory);
}

// ─── Render ───────────────────────────────────────────────────────────────────
function renderCat(catKey) {
  const cat = _categories?.find(c => c.key === catKey);
  if (!cat) return;
  renderGrid(cat.emojis, cat.label, !isSearching && recentEmojis.length > 0);
}

function renderGrid(emojis, label, showRecent) {
  const grid = document.getElementById("_epGrid");
  if (!grid) return;
  grid.innerHTML = "";

  if (!emojis?.length) { _showState("empty"); return; }
  _showState("grid");

  if (showRecent && recentEmojis.length) {
    addLabel(grid, "⏱ Recientes");
    recentEmojis.forEach(e => grid.appendChild(mkBtn(e)));
    const d = document.createElement("div"); d.className = "_epDivider"; grid.appendChild(d);
  }

  if (label) addLabel(grid, label);
  emojis.forEach(e => grid.appendChild(mkBtn(e)));
}

function addLabel(parent, text) {
  const l = document.createElement("div"); l.className = "_epLabel"; l.textContent = text;
  parent.appendChild(l);
}

function mkBtn(emoji) {
  const btn = document.createElement("button");
  btn.className = "_epE";
  btn.textContent = emoji;
  // Tooltip: primera keyword del cache, o el propio emoji como fallback
  btn.title = _keywords?.[emoji]?.[0] || emoji;
  btn.addEventListener("click", e => {
    e.stopPropagation();
    btn.classList.remove("pop"); void btn.offsetWidth; btn.classList.add("pop");
    insertEmoji(emoji); addRecent(emoji);
  });
  return btn;
}

function insertEmoji(emoji) {
  const inp = document.getElementById("messageInput");
  if (!inp) return;
  const s = typeof inp.selectionStart === "number" ? inp.selectionStart : inp.value.length;
  const e = typeof inp.selectionEnd   === "number" ? inp.selectionEnd   : inp.value.length;
  inp.value = inp.value.slice(0, s) + emoji + inp.value.slice(e);
  inp.selectionStart = inp.selectionEnd = s + emoji.length;
  inp.focus();
  inp.dispatchEvent(new Event("input", { bubbles: true }));
}

// ─── Abrir / Cerrar ───────────────────────────────────────────────────────────
function openPicker(anchor) {
  if (!pickerEl) pickerEl = buildPicker();
  pickerEl.classList.remove("ep-close");
  pickerEl.style.display = "flex";
  void pickerEl.offsetWidth;
  pickerEl.classList.add("ep-open");

  // Posicionamiento
  const r = anchor.getBoundingClientRect(), W = 338, H = 408;
  let top  = r.top - H - 10;
  let left = r.left;
  if (top  < 8)                         top  = r.bottom + 10;
  if (left + W > window.innerWidth - 8) left = window.innerWidth - W - 8;
  if (left < 8)                         left = 8;
  pickerEl.style.top  = top  + "px";
  pickerEl.style.left = left + "px";

  loadRecents();

  if (!_categories) {
    // Primera apertura: cargar desde API
    _initContent();
  } else {
    // Ya en cache: mostrar directo
    setTimeout(() => {
      const s = document.getElementById("_epSearch");
      if (s) { s.value = ""; s.focus(); }
      isSearching = false;
      renderCat(activeCategory);
    }, 20);
  }
}

function closePicker() {
  if (!pickerEl || pickerEl.style.display === "none") return;
  pickerEl.classList.remove("ep-open");
  pickerEl.classList.add("ep-close");
  setTimeout(() => {
    if (pickerEl) { pickerEl.style.display = "none"; pickerEl.classList.remove("ep-close"); }
  }, 130);
}

function togglePicker(btn) {
  (!pickerEl || pickerEl.style.display === "none") ? openPicker(btn) : closePicker();
}

document.addEventListener("mousedown", () => closePicker());
document.addEventListener("keydown", e => { if (e.key === "Escape") closePicker(); });

// ─── Init con MutationObserver ────────────────────────────────────────────────
function initEmojiPicker() {
  const btn = document.getElementById("emojiBtn");
  if (!btn || btn._emojiReady) return false;
  btn._emojiReady = true;
  btn.addEventListener("click", e => { e.preventDefault(); e.stopPropagation(); togglePicker(btn); });
  console.log("✅ Emoji picker Pro (API mode) inicializado");
  return true;
}

document.addEventListener("DOMContentLoaded", () => { initEmojiPicker(); });
new MutationObserver(() => {
  const b = document.getElementById("emojiBtn");
  if (b && !b._emojiReady) initEmojiPicker();
}).observe(document.body, { childList: true, subtree: true });