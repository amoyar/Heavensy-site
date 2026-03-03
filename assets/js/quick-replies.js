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
  _lastCompanyId: null
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

  const allBtn = document.createElement("button");
  allBtn.className = "px-2 py-0.5 rounded-full text-[11px] bg-purple-100 text-purple-700 font-semibold";
  allBtn.textContent = "Todas";
  allBtn.onclick = () => {
    filter("");
    const { search } = getUI();
    if (search) search.value = "";
  };
  categories.appendChild(allBtn);

  qrState.categories.forEach(cat => {
    const btn = document.createElement("button");
    btn.className = "px-2 py-0.5 rounded-full text-[11px] bg-gray-100 text-gray-600 hover:bg-purple-100 hover:text-purple-700 transition";
    btn.textContent = cat;
    btn.onclick = () => filterByCategory(cat);
    categories.appendChild(btn);
  });
}

// --------------------------------------------
// Filtros
// --------------------------------------------
function filter(query) {
  const q = (query || "").toLowerCase().trim();

  if (!q) {
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
  qrState.filtered = qrState.all.filter(qr => qr.category === category);
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

  qrState.editingId = qr.id;

  formShortcut.value = qr.shortcut || "";
  formText.value = qr.text || "";
  formCategory.value = qr.category || "";

  if (formModeLabel) formModeLabel.textContent = "Modo: Editar";

  formText.focus();
}

function clearForm() {
  const { formShortcut, formText, formCategory, formModeLabel } = getUI();

  qrState.editingId = null;

  if (formShortcut) formShortcut.value = "";
  if (formText) formText.value = "";
  if (formCategory) formCategory.value = "";

  if (formModeLabel) {
    formModeLabel.textContent = "Modo: Crear";
  }

  console.log("🧹 Formulario limpiado y modo edición cancelado");
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
    } else {
      await createQuickReply(payload);
      showToast("Respuesta rápida guardada", "success");   // 👈 AQUÍ VA
    }

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
  const { btn, closeBtn, search, formSaveBtn, formCancelBtn } = getUI();

  // Siempre registrar shortcuts (solo se ejecuta 1 vez gracias al flag)
  setupShortcuts();

  if (!btn) {
    console.warn("❌ No existe #quickRepliesBtn");
    return;
  }

  btn.addEventListener("click", togglePanel);
  if (closeBtn) closeBtn.addEventListener("click", closePanel);

  if (search) {
    search.addEventListener("input", (e) => {
      filter(e.target.value || "");
    });
  }

  if (formSaveBtn) {
    formSaveBtn.addEventListener("click", (e) => {
      e.preventDefault();
      onSaveForm();
    });
  }

  if (formCancelBtn) {
    formCancelBtn.addEventListener("click", (e) => {
      e.preventDefault();
      clearForm();
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
    info: "bg-gray-800"
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

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(initQuickReplies, 1000);
});