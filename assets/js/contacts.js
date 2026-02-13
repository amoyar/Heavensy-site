// ============================================
// CONTACTS.JS - Panel derecho (Tags & Notas)
// ============================================

console.log("📇 contacts.js cargado");

// Estado actual del contacto
let currentContactUserId = null;
let currentContactProfile = null;
let currentContactCompanyId = null;

// --------------------------------------------
// Helper fetch con auth
// --------------------------------------------
async function authFetch(url, options = {}) {
    const token = getToken();
    const headers = options.headers || {};

    headers["Authorization"] = `Bearer ${token}`;
    if (!(options.body instanceof FormData)) {
        headers["Content-Type"] = "application/json";
    }

    const resp = await fetch(url, {
        ...options,
        headers
    });

    if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`HTTP ${resp.status}: ${text}`);
    }

    return resp.json();
}

// --------------------------------------------
// Cargar perfil de contacto
// --------------------------------------------
async function loadContactProfile(userId, phone = null, profileName = null, companyId = null) {
    try {
        console.log("📇 Cargando contacto:", userId, companyId);

        currentContactUserId = userId;
        currentContactCompanyId = companyId;

        const params = new URLSearchParams();
        if (phone) params.append("phone", phone);
        if (profileName) params.append("profile_name", profileName);
        if (companyId) params.append("company_id", companyId);

        const url = `${API_BASE_URL}/api/contacts/${encodeURIComponent(userId)}?${params.toString()}`;

        const data = await authFetch(url, { method: "GET" });

        if (!data.success) {
            throw new Error(data.error || "No se pudo cargar contacto");
        }

        currentContactProfile = data.contact;
        console.log("✅ Contacto cargado:", currentContactProfile);

        renderContactPanel(currentContactProfile);

    } catch (err) {
        console.error("❌ Error cargando contacto:", err);
    }
}
// --------------------------------------------
// Render principal del panel
// --------------------------------------------
function renderContactPanel(contact) {
    renderTags(contact.tags || []);
    renderNotes(contact.notes || []);
}

// --------------------------------------------
// TAGS
// --------------------------------------------
function renderTags(tags) {
    const container = document.getElementById("contactTagsContainer");
    if (!container) return;

    container.innerHTML = "";

    if (!tags.length) {
        container.innerHTML = `<p class="text-xs text-gray-400">Sin tags</p>`;
        return;
    }

    tags.forEach(tag => {
        const span = document.createElement("span");

       span.className = "px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 max-w-full break-words";
        span.style.backgroundColor = tag.color || "#e9d5ff";
        span.style.color = "#1f2937"; // texto oscuro

        span.innerHTML = `
            ${escapeHtml(tag.label)}
            <button class="ml-1 font-bold" title="Quitar tag">×</button>
        `;

        span.querySelector("button").onclick = () => removeTag(tag.id);
        container.appendChild(span);
    });
}

async function addTag() {
    const input = document.getElementById("newTagInput");
    const colorInput = document.getElementById("newTagColor");
    if (!input || !colorInput) return;

    const label = input.value.trim();
    const color = colorInput.value; // ej: "#7c3aed"

    if (!label || !currentContactUserId) return;

    try {
        await authFetch(`${API_BASE_URL}/api/contacts/${encodeURIComponent(currentContactUserId)}/tags`, {
            method: "POST",
            body: JSON.stringify({ 
                label,
                color,
                company_id: currentContactCompanyId
            })
        });

        input.value = "";
        await loadContactProfile(currentContactUserId, null, null, currentContactCompanyId);
    } catch (err) {
        console.error("❌ Error agregando tag:", err);
        alert("No se pudo agregar el tag");
    }
}

async function removeTag(tagId) {
    if (!currentContactUserId) return;

    try {
        await authFetch(
            `${API_BASE_URL}/api/contacts/${encodeURIComponent(currentContactUserId)}/tags/${encodeURIComponent(tagId)}?company_id=${encodeURIComponent(currentContactCompanyId)}`,
            { method: "DELETE" }
        );

        await loadContactProfile(currentContactUserId, null, null, currentContactCompanyId);
    } catch (err) {
        console.error("❌ Error quitando tag:", err);
        alert("No se pudo quitar el tag");
    }
}

// --------------------------------------------
// NOTAS
// --------------------------------------------
function renderNotes(notes) {
    const container = document.getElementById("contactNotesContainer");
    if (!container) return;

    container.innerHTML = "";

    if (!notes.length) {
        container.innerHTML = `<p class="text-xs text-gray-400">Sin notas</p>`;
        return;
    }

    notes.forEach(note => {
        const div = document.createElement("div");
        div.className = "bg-white border border-gray-200 rounded-lg p-2 text-sm";

        const date = note.created_at ? new Date(note.created_at).toLocaleString() : "";

        div.innerHTML = `
            <div class="flex justify-between items-start gap-2">
                <div>
                    <p class="text-gray-800">${escapeHtml(note.text)}</p>
                    <p class="text-xs text-gray-400 mt-1">${escapeHtml(note.created_by || "")} · ${date}</p>
                </div>
                <button class="text-gray-400 hover:text-red-500" title="Eliminar nota">
                    <i class="fas fa-trash text-xs"></i>
                </button>
            </div>
        `;

        div.querySelector("button").onclick = () => deleteNote(note.id);
        container.appendChild(div);
    });
}

async function addNote() {
    const textarea = document.getElementById("newNoteInput");
    if (!textarea || !currentContactUserId) return;

    const text = textarea.value.trim();
    if (!text) return;

    try {
        await authFetch(`${API_BASE_URL}/api/contacts/${encodeURIComponent(currentContactUserId)}/notes`, {
            method: "POST",
            body: JSON.stringify({ 
                text,
                company_id: currentContactCompanyId
            })
        });

        textarea.value = "";
        await loadContactProfile(currentContactUserId, null, null, currentContactCompanyId);
    } catch (err) {
        console.error("❌ Error agregando nota:", err);
        alert("No se pudo agregar la nota");
    }
}

async function deleteNote(noteId) {
    if (!currentContactUserId) return;

    try {
        await authFetch(
            `${API_BASE_URL}/api/contacts/${encodeURIComponent(currentContactUserId)}/notes/${encodeURIComponent(noteId)}?company_id=${encodeURIComponent(currentContactCompanyId)}`,
            { method: "DELETE" }
        );

        await loadContactProfile(currentContactUserId, null, null, currentContactCompanyId);
    } catch (err) {
        console.error("❌ Error eliminando nota:", err);
        alert("No se pudo eliminar la nota");
    }
}

// --------------------------------------------
// Utils
// --------------------------------------------
function escapeHtml(text) {
    if (!text) return "";
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// --------------------------------------------
// Hook desde conversaciones.js
// Llama esto cuando cambie el usuario seleccionado userId phone = null, name = null
// --------------------------------------------
// window.onConversationSelectedForContacts = function (userId, phone = null, name = null) {
//     console.log("📇 Hook contacto desde conversaciones:", userId);
//     loadContactProfile(userId, phone, name);
// };

window.onConversationSelectedForContacts = function (userId, phone = null, name = null, companyId) {
    console.log("📇 Conversación seleccionada → cargar contacto:", userId, companyId);

    currentContactUserId = userId;
    currentContactCompanyId = companyId;

    loadContactProfile(userId, phone, name, companyId);
};
