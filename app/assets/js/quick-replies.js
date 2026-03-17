// ============================================
// QUICK-REPLIES.JS — Respuestas rápidas
// ============================================

console.log("⚡ quick-replies.js cargado");
// ================= CONFIG ATAJOS =================
const SAVE_QR_SHORTCUT = {
  ctrl: true,
  shift: true,
  key: "S"   // Cambia aquí si quieres otro (ej: "D", "Q", etc)
};
// ===============================================
const qrState = {
  all: [],
  filtered: [],
  categories: [],
  isOpen: false,
  lastQuery: "",
  editingId: null, // null = crear, string = editar
  _lastCompanyId: null,
  activeCategory: null // null = "Todas"
};

// --------------------------------------------
// Helpers
// --------------------------------------------
function getCurrentCompanyId() {
  if (window.conversacionesAPI && window.conversacionesAPI.getState) {
    return window.conversacionesAPI.getState().currentCompanyId;
  }
  return null;
}

function getMessageInput() {
  return document.getElementById("messageInput");
}

function qs(id) {
  return document.getElementById(id);
}

function apiHeaders() {
  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${getToken()}`
  };
}

// --------------------------------------------
// UI
// --------------------------------------------
function getUI() {
  return {
    panel: qs("quickRepliesPanel"),
    btn: qs("quickRepliesBtn"),
    closeBtn: qs("qrCloseBtn"),
    search: qs("qrSearchInput"),
    categories: qs("qrCategories"),
    list: qs("qrList"),

    newBtn: qs("qrNewBtn"),
    formWrapper: qs("qrFormWrapper"),

    formShortcut: qs("qrFormShortcut"),
    formText: qs("qrFormText"),
    formCategory: qs("qrFormCategory"),
    formSaveBtn: qs("qrFormSaveBtn"),
    formCancelBtn: qs("qrFormCancelBtn"),
    formModeLabel: qs("qrFormModeLabel")
  };
}

// --------------------------------------------
// Panel
// --------------------------------------------
function openPanel() {
  const { panel, search } = getUI();
  if (!panel) return;
  panel.classList.remove("hidden");
  qrState.isOpen = true;
  if (search) search.focus();
  render();
}

function closePanel() {
  const { panel } = getUI();
  if (!panel) return;
  panel.classList.add("hidden");
  qrState.isOpen = false;
}

function togglePanel() {
  const { panel } = getUI();
  if (!panel) return;

  if (panel.classList.contains("hidden") && !getCurrentCompanyId()) {
    showToast("Selecciona una empresa para usar las respuestas rápidas", "info");
    return;
  }

  if (panel.classList.contains("hidden")) openPanel();
  else closePanel();
}

// --------------------------------------------
// Atajos
// --------------------------------------------
let _shortcutsInitialized = false;

function setupShortcuts() {
  if (_shortcutsInitialized) return;
  _shortcutsInitialized = true;

  const input = getMessageInput();

  // Detectar "/" para abrir panel
  if (input) {
    input.addEventListener("input", (event) => {
      const val = event.target.value || "";
      if (val.startsWith("/")) {
        const q = val.slice(1);
        filter(q);
        if (!qrState.isOpen) openPanel();
      }
    });
  }

    document.addEventListener("keydown", async (event) => {

    // ESC cierra panel
    if (event.key === "Escape" && qrState.isOpen) {
      closePanel();
    }

    // Ctrl + / abre/cierra
    if (event.ctrlKey && event.key === "/") {
      event.preventDefault();
      togglePanel();
    }

    // Ctrl + Shift + S guarda quick reply
    if (
      event.ctrlKey &&
      event.shiftKey &&
      event.key.toUpperCase() === "S"
    ) {
      event.preventDefault();
      await saveCurrentInputAsQuickReply();
    }

  });
}

// --------------------------------------------
// Backend
// --------------------------------------------
async function loadQuickReplies() {
  const companyId = getCurrentCompanyId();
  if (!companyId) return;

  try {
    const res = await fetch(`${API_BASE_URL}/api/quick-replies?company_id=${companyId}`, {
      headers: apiHeaders()
    });

    if (!res.ok) {
      console.warn("⚠️ No se pudieron cargar quick replies");
      return;
    }

    const data = await res.json();
    qrState.all = data.quick_replies || [];
    qrState.filtered = [...qrState.all];
    buildCategories();
    render();

    console.log("⚡ Quick replies cargadas:", qrState.all.length);
  } catch (err) {
    console.error("❌ Error cargando quick replies:", err);
  }
}

async function createQuickReply(payload) {
  const res = await fetch(`${API_BASE_URL}/api/quick-replies`, {
    method: "POST",
    headers: apiHeaders(),
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error("Error creando quick reply");
  return res.json();
}

async function updateQuickReply(qrId, payload) {
  const res = await fetch(`${API_BASE_URL}/api/quick-replies/${qrId}`, {
    method: "PUT",
    headers: apiHeaders(),
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error("Error actualizando quick reply");
  return res.json();
}

async function deleteQuickReply(qrId, companyId) {
  const res = await fetch(`${API_BASE_URL}/api/quick-replies/${qrId}?company_id=${companyId}`, {
    method: "DELETE",
    headers: apiHeaders()
  });
  if (!res.ok) throw new Error("Error eliminando quick reply");
  return res.json();
}

// --------------------------------------------
// Categorías
// --------------------------------------------
function buildCategories() {
  const set = new Set();
  qrState.all.forEach(qr => {
    if (qr.category) set.add(qr.category);
  });
  qrState.categories = Array.from(set);
}

function renderCategories() {
  const { categories } = getUI();
  if (!categories) return;

  categories.innerHTML = "";

  const ACTIVE   = "px-2 py-0.5 rounded-full text-[11px] bg-purple-600 text-white font-semibold shadow-sm transition";
  const INACTIVE = "px-2 py-0.5 rounded-full text-[11px] bg-gray-100 text-gray-600 hover:bg-purple-100 hover:text-purple-700 transition";

  const allBtn = document.createElement("button");
  allBtn.className = qrState.activeCategory === null ? ACTIVE : INACTIVE;
  allBtn.textContent = "Todas";
  allBtn.onclick = () => {
    qrState.activeCategory = null;
    filter("");
    const { search } = getUI();
    if (search) search.value = "";
  };
  categories.appendChild(allBtn);

  qrState.categories.forEach(cat => {
    const btn = document.createElement("button");
    btn.className = qrState.activeCategory === cat ? ACTIVE : INACTIVE;
    btn.textContent = cat;
    btn.onclick = () => filterByCategory(cat);
    categories.appendChild(btn);
  });

  // Sincronizar datalist del formulario con categorías existentes
  const datalist = document.getElementById("qrCategoryList");
  if (datalist) {
    datalist.innerHTML = "";
    qrState.categories.forEach(cat => {
      const opt = document.createElement("option");
      opt.value = cat;
      datalist.appendChild(opt);
    });
  }
}

// --------------------------------------------
// Filtros
// --------------------------------------------
function filter(query) {
  const q = (query || "").toLowerCase().trim();

  if (!q) {
    qrState.activeCategory = null;
    qrState.filtered = [...qrState.all];
  } else {
    qrState.filtered = qrState.all.filter(qr =>
      (qr.shortcut && qr.shortcut.toLowerCase().includes(q)) ||
      (qr.text && qr.text.toLowerCase().includes(q)) ||
      (qr.category && qr.category.toLowerCase().includes(q))
    );
  }
  renderList();
}

function filterByCategory(category) {
  qrState.activeCategory = category;
  qrState.filtered = qrState.all.filter(qr => qr.category === category);
  renderCategories();
  renderList();
}

// --------------------------------------------
// Render
// --------------------------------------------
function render() {
  renderCategories();
  renderList();
}

function renderList() {
  const { list } = getUI();
  if (!list) return;

  list.innerHTML = "";

  if (!qrState.filtered.length) {
    list.innerHTML = `<div class="text-sm text-gray-400 text-center py-6">Sin resultados</div>`;
    return;
  }

  qrState.filtered.forEach(qr => {
    const item = document.createElement("div");
    item.className = "bg-white border border-gray-200 rounded-xl p-2 hover:bg-gray-50 transition-all flex flex-col gap-1";

    item.innerHTML = `
      <div class="flex items-center justify-between">
        <span class="text-xs font-mono text-purple-600">${qr.shortcut || ""}</span>
        <div class="flex items-center gap-2">
          <span class="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">${qr.category || ""}</span>
          <button class="text-xs text-blue-500 hover:underline" data-edit>✏️</button>
          <button class="text-xs text-red-500 hover:underline" data-del>🗑️</button>
        </div>
      </div>
      <div class="text-sm text-gray-800 leading-snug">${escapeHtml(qr.text || "")}</div>
    `;

    // Insertar en input
    item.addEventListener("click", (e) => {
      if (e.target && (e.target.dataset.edit || e.target.dataset.del)) return;
      insertIntoInput(qr.text || "");
    });

    // Editar
    item.querySelector("[data-edit]").addEventListener("click", (e) => {
      e.stopPropagation();
      fillFormForEdit(qr);
    });

    // Eliminar
    item.querySelector("[data-del]").addEventListener("click", async (e) => {
      e.stopPropagation();
      // if (!confirm("¿Eliminar esta respuesta rápida?")) return;
      const ok = await showConfirm("¿Eliminar esta respuesta rápida?");
      if (!ok) return;
      try {
        const companyId = getCurrentCompanyId();
        await deleteQuickReply(qr.id, companyId);
        qrState.all = qrState.all.filter(x => x.id !== qr.id);
        filter("");
      } catch (err) {
        alert("Error eliminando");
        console.error(err);
      }
    });

    list.appendChild(item);
  });
}

// --------------------------------------------
// Insertar en input
// --------------------------------------------
function insertIntoInput(text) {
  const input = getMessageInput();
  if (!input) return;

  input.focus();

  const current = input.value || "";

  // Si ya hay texto, agregamos con espacio
  if (current.trim().length > 0) {
    input.value = current.replace(/\s*$/, "") + " " + text;
  } else {
    input.value = text;
  }

  input.dispatchEvent(new Event("input", { bubbles: true }));
}

async function saveCurrentInputAsQuickReply() {
  const input = getMessageInput();
  if (!input) return;

  const text = (input.value || "").trim();
  if (!text) {
    alert("No hay texto para guardar como respuesta rápida.");
    return;
  }

  const companyId = getCurrentCompanyId();
  if (!companyId) {
    alert("No hay empresa seleccionada.");
    return;
  }

  // Pedimos un shortcut simple (puedes mejorar UI después)
  let shortcut = prompt("Atajo para esta respuesta (ej: /hola, /pago, /bye):", "/");
  if (!shortcut) return;

  let category = prompt("Categoría:", "General") || "General";

  const payload = {
    company_id: companyId,
    shortcut: shortcut.trim(),
    text: text,
    category: category.trim() || "General"
  };

  try {
    await createQuickReply(payload);
    await loadQuickReplies();   // 🔥 Esto es lo que garantiza el APPEND real desde backend
    console.log("✅ Guardada como quick reply:", payload.shortcut);
  } catch (err) {
    alert("Error guardando respuesta rápida");
    console.error(err);
  }
}

// --------------------------------------------
// Formulario
// --------------------------------------------
function fillFormForEdit(qr) {
  const { formShortcut, formText, formCategory, formModeLabel } = getUI();

  if (!formShortcut || !formText) {
    console.warn("Campos del formulario no encontrados");
    return;
  }

  qrState.editingId = qr.id;

  formShortcut.value = qr.shortcut || "";
  formText.value = qr.text || "";
  if (formCategory) formCategory.value = qr.category || "";
  if (formModeLabel) formModeLabel.textContent = "Modo: Editar ✏️";

  const { formWrapper } = getUI();
  if (formWrapper) formWrapper.classList.remove("hidden");
  formShortcut.scrollIntoView({ behavior: "smooth", block: "nearest" });
  formShortcut.focus();
}

function openForm() {
  // getElementById directo para máxima fiabilidad
  const fw = document.getElementById("qrFormWrapper");
  if (fw) fw.classList.remove("hidden");

  qrState.editingId = null;
  const fs_ = document.getElementById("qrFormShortcut");
  const ft  = document.getElementById("qrFormText");
  const fc  = document.getElementById("qrFormCategory");
  const fl  = document.getElementById("qrFormModeLabel");
  if (fs_) { fs_.value = ""; fs_.focus(); }
  if (ft)  ft.value = "";
  if (fc)  fc.value = "";
  if (fl)  fl.textContent = "Modo: Crear";
}

function clearForm() {
  const { formShortcut, formText, formCategory, formModeLabel } = getUI();

  qrState.editingId = null;

  if (formShortcut) formShortcut.value = "";
  if (formText) formText.value = "";
  if (formCategory) formCategory.value = "";
  if (formModeLabel) formModeLabel.textContent = "Modo: Crear";

  // getElementById directo para evitar problemas de timing
  var fw = document.getElementById("qrFormWrapper");
  if (fw) fw.classList.add("hidden");

  console.log("🧹 Formulario cerrado");
}

async function onSaveForm() {
  const { formShortcut, formText, formCategory } = getUI();

  const companyId = getCurrentCompanyId();
  const payload = {
    company_id: companyId,
    shortcut: formShortcut.value.trim(),
    text: formText.value.trim(),
    category: formCategory.value.trim() || "General"
  };

  if (!payload.shortcut || !payload.text) {
    // alert("Faltan campos obligatorios");
    showToast("Completa todos los campos obligatorios", "error");
    return;
  }

  try {
    if (qrState.editingId) {
      await updateQuickReply(qrState.editingId, payload);
      showToast("Respuesta rápida actualizada", "success");
    } else {
      await createQuickReply(payload);
      showToast("Respuesta rápida guardada", "success");
    }

    qrState._lastCompanyId = null;
    await loadQuickReplies();
    clearForm();
  } catch (err) {
    // alert("Error guardando");
    showToast("Error guardando la respuesta rápida", "error");

    console.error(err);
  }
}

// --------------------------------------------
// Utils
// --------------------------------------------
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// --------------------------------------------
// Init
// --------------------------------------------
function initQuickReplies() {

  setupShortcuts();

  if (!window._qrDelegationInitialized) {
    window._qrDelegationInitialized = true;
    document.addEventListener("click", (e) => {
      if      (e.target.closest("#quickRepliesBtn"))  togglePanel();
      else if (e.target.closest("#qrCloseBtn"))       closePanel();
      else if (e.target.closest("#qrNewBtn"))         openForm();
      else if (e.target.closest("#qrFormSaveBtn"))    { e.preventDefault(); onSaveForm(); }
      else if (e.target.closest("#qrFormCancelBtn"))  { e.preventDefault(); clearForm(); }
    });
    document.addEventListener("input", (e) => {
      if (e.target.id === "qrSearchInput") filter(e.target.value || "");
    });
  }

  setInterval(() => {
    const companyId = getCurrentCompanyId();
    if (companyId && qrState._lastCompanyId !== companyId) {
      qrState._lastCompanyId = companyId;
      loadQuickReplies();
    }
  }, 1500);

  console.log("✅ Quick Replies UI inicializada");
}

function showToast(message, type = "info") {
  const container = document.getElementById("qrToastContainer");
  if (!container) return;

  const toast = document.createElement("div");

  const colors = {
    success: "bg-green-500",
    error: "bg-red-500",
    info: "bg-blue-500"
  };

  toast.className =
    `${colors[type] || colors.info} text-white text-sm px-4 py-3 rounded-xl shadow-lg transition-all opacity-0 translate-y-2`;

  toast.textContent = message;

  container.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.remove("opacity-0", "translate-y-2");
  });

  setTimeout(() => {
    toast.classList.add("opacity-0", "translate-y-2");
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function showConfirm(message) {
  return new Promise((resolve) => {
    const modal = document.getElementById("qrConfirmModal");
    const msg = document.getElementById("qrConfirmMessage");
    const btnCancel = document.getElementById("qrConfirmCancel");
    const btnAccept = document.getElementById("qrConfirmAccept");

    if (!modal) return resolve(false);

    msg.textContent = message;
    modal.classList.remove("hidden");

    const cleanup = () => {
      modal.classList.add("hidden");
      btnCancel.removeEventListener("click", onCancel);
      btnAccept.removeEventListener("click", onAccept);
    };

    const onCancel = () => {
      cleanup();
      resolve(false);
    };

    const onAccept = () => {
      cleanup();
      resolve(true);
    };

    btnCancel.addEventListener("click", onCancel);
    btnAccept.addEventListener("click", onAccept);
  });
}

function reinitQuickReplies() {
  qrState.isOpen = false;
  qrState._lastCompanyId = null;
  clearForm();
  const panelNow = qs("quickRepliesPanel");
  if (panelNow) panelNow.classList.add("hidden");
  const observer = new MutationObserver(() => {
    const panel = qs("quickRepliesPanel");
    if (panel && !panel.classList.contains("hidden")) {
      panel.classList.add("hidden");
      qrState.isOpen = false;
    }
  });
  observer.observe(document.getElementById("app") || document.body, { childList: true, subtree: true });
  setTimeout(() => observer.disconnect(), 3000);
  console.log("🔄 Quick Replies re-inicializado (SPA)");
}
window.reinitQuickReplies = reinitQuickReplies;

// ============================================
// FORMATO WHATSAPP — toolbar del formulario
// ============================================

// Envuelve el texto seleccionado en el textarea con el marcador dado
function qrFormatWrap(marker) {
  const ta = document.getElementById("qrFormText");
  if (!ta) return;
  const start = ta.selectionStart;
  const end   = ta.selectionEnd;
  const sel   = ta.value.substring(start, end);
  const replacement = sel.length > 0
    ? marker + sel + marker          // envolver selección
    : marker + marker;               // sin selección: poner marcadores vacíos
  ta.value = ta.value.substring(0, start) + replacement + ta.value.substring(end);
  // Dejar cursor entre marcadores si no había selección
  const newPos = sel.length > 0 ? start + replacement.length : start + marker.length;
  ta.setSelectionRange(newPos, newPos);
  ta.focus();
}

// Inserta un salto de línea real en la posición del cursor
function qrFormatInsertNewline() {
  const ta = document.getElementById("qrFormText");
  if (!ta) return;
  const pos = ta.selectionStart;
  ta.value = ta.value.substring(0, pos) + "\n" + ta.value.substring(pos);
  ta.setSelectionRange(pos + 1, pos + 1);
  ta.focus();
}

// Limpia marcadores WA del texto (para plataformas sin formato)
function qrStripWAFormat(text) {
  return (text || "")
    .replace(/\*([^*]+)\*/g, "$1")   // *negrita*
    .replace(/_([^_]+)_/g, "$1")     // _cursiva_
    .replace(/~([^~]+)~/g, "$1");    // ~tachado~
}

window.qrFormatWrap         = qrFormatWrap;
window.qrFormatInsertNewline = qrFormatInsertNewline;
window.qrStripWAFormat      = qrStripWAFormat;

// ============================================
window.openForm   = openForm;
window.clearForm  = clearForm;
window.onSaveForm = onSaveForm;

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(initQuickReplies, 1000);
});