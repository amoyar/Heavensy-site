// ============================================================
// SERVICIOS.JS — Panel de servicios del contacto (3 niveles)
// Depende de: API_BASE_URL, getToken() (de conversaciones.js)
// ============================================================

const serviciosState = {
  companyId: null,
  waId: null,
  contactServices: [],   // nivel 3: servicios asignados al contacto
  companyServices: [],   // nivel 2: servicios disponibles en la empresa
  expanded: {},          // { company_service_id: bool }
};

// ── Helpers ──────────────────────────────────────────────────

function svcHeaders() {
  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${getToken()}`
  };
}

function fmtSlotDate(isoStr) {
  if (!isoStr) return "—";
  const d = new Date(isoStr);
  const days   = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];
  const months = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}

// ── API ──────────────────────────────────────────────────────

async function svcGet(url) {
  const r = await fetch(`${API_BASE_URL}${url}`, { headers: svcHeaders() });
  return r.ok ? r.json() : [];
}

async function svcPost(url, body) {
  const r = await fetch(`${API_BASE_URL}${url}`, {
    method: "POST", headers: svcHeaders(), body: JSON.stringify(body)
  });
  return r.json();
}

async function svcDelete(url) {
  await fetch(`${API_BASE_URL}${url}`, { method: "DELETE", headers: svcHeaders() });
}

// ── Carga de datos ────────────────────────────────────────────

async function loadServicesForContact(companyId, waId) {
  serviciosState.companyId = companyId;
  serviciosState.waId      = waId;

  const [contactServices, companyServices] = await Promise.all([
    svcGet(`/api/contact-services/contact/${companyId}/${waId}`),
    serviciosState.companyServices.length > 0
      ? Promise.resolve(serviciosState.companyServices)
      : svcGet(`/api/contact-services/company/${companyId}`)
  ]);

  serviciosState.contactServices = contactServices;
  serviciosState.companyServices = companyServices;

  renderServicesPanel();
}

// ── Render ────────────────────────────────────────────────────

function renderServicesPanel() {
  const container = document.getElementById("contactServicesContainer");
  if (!container) return;

  const { contactServices, companyServices, companyId, waId } = serviciosState;

  if (!companyId || !waId) {
    container.innerHTML = `<p class="text-xs text-gray-400 px-1">Selecciona un contacto.</p>`;
    return;
  }

  let html = "";

  // ── Servicios asignados al contacto ──────────────────────
  if (contactServices.length === 0) {
    html += `<p class="text-sm text-gray-400 px-1 mb-2">Sin servicios asignados.</p>`;
  } else {
    contactServices.forEach(svc => {
      const isOpen = !!serviciosState.expanded[svc.company_service_id];
      const slots  = svc.slots || [];
      const color  = svc.color || "#7c3aed";
      const csId   = svc.company_service_id;

      html += `
      <div class="mb-1 rounded-lg border border-gray-100 overflow-hidden">
        <div class="flex items-center justify-between px-2 py-1.5 cursor-pointer hover:bg-gray-50 transition"
             onclick="svcToggleExpand('${csId}')">
          <div class="flex items-center gap-1.5">
            <div class="w-2 h-2 rounded-full flex-shrink-0" style="background:${color}"></div>
            <span class="text-xs font-semibold text-gray-800">${svc.name}</span>
            ${slots.length > 0 ? `<span class="text-[10px] bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded-full font-semibold">${slots.length}</span>` : ""}
          </div>
          <div class="flex items-center gap-1">
            <button onclick="event.stopPropagation(); svcOpenAddSlot('${csId}')"
              class="text-xs text-gray-400 hover:text-purple-600 p-0.5 rounded transition" title="Agregar cupo">
              <i class="fas fa-plus"></i>
            </button>
            <button onclick="event.stopPropagation(); svcRemoveService('${csId}')"
              class="text-xs text-gray-400 hover:text-red-500 p-0.5 rounded transition" title="Quitar servicio">
              <i class="fas fa-times"></i>
            </button>
            <i class="fas fa-chevron-${isOpen ? "up" : "down"} text-[10px] text-gray-300"></i>
          </div>
        </div>

        ${isOpen ? `
        <div class="px-2 pb-2 bg-gray-50 space-y-1">
          ${slots.length === 0
            ? `<p class="text-xs text-gray-400 py-1">Sin cupos registrados.</p>`
            : slots.map(slot => `
              <div class="flex items-center justify-between bg-white border border-gray-100 rounded px-2 py-1.5 text-xs">
                <div>
                  <span class="font-medium text-purple-700">${fmtSlotDate(slot.datetime)}</span>
                  ${slot.provider ? `<span class="text-gray-400 ml-1">· ${slot.provider}</span>` : ""}
                  ${slot.duration_minutes ? `<span class="text-gray-400 ml-1">· ${slot.duration_minutes}min</span>` : ""}
                </div>
                <button onclick="svcDeleteSlotUI('${csId}','${slot.id}')"
                  class="text-gray-300 hover:text-red-400 transition ml-1">
                  <i class="fas fa-trash text-[10px]"></i>
                </button>
              </div>`).join("")
          }
          <div id="svcSlotForm_${csId}" class="hidden mt-1 space-y-1">
            <input type="datetime-local" id="svcSlotDatetime_${csId}"
              class="w-full text-xs border border-gray-200 rounded px-1.5 py-1 focus:outline-none focus:border-purple-400"/>
            <input type="text" id="svcSlotProvider_${csId}" placeholder="Profesional (opcional)"
              class="w-full text-xs border border-gray-200 rounded px-1.5 py-1 focus:outline-none focus:border-purple-400"/>
            <input type="number" id="svcSlotDuration_${csId}" placeholder="Duración (min)" value="60"
              class="w-full text-xs border border-gray-200 rounded px-1.5 py-1 focus:outline-none focus:border-purple-400"/>
            <div class="flex gap-1">
              <button onclick="svcSaveSlot('${csId}')"
                class="flex-1 text-xs bg-purple-600 text-white rounded px-2 py-1 hover:bg-purple-700 transition">Guardar</button>
              <button onclick="document.getElementById('svcSlotForm_${csId}').classList.add('hidden')"
                class="text-xs text-gray-400 px-2 py-1 border border-gray-200 rounded hover:bg-gray-100 transition">Cancelar</button>
            </div>
          </div>
        </div>` : ""}
      </div>`;
    });
  }

  // ── Selector para asignar más servicios ──────────────────
  const assignedIds = contactServices.map(s => s.company_service_id);
  const available   = companyServices.filter(cs => !assignedIds.includes(cs._id));

  html += `<div class="mt-2 pt-2 border-t border-gray-100">`;

  if (available.length > 0) {
    html += `
    <div class="flex gap-1">
      <select id="svcCompanySelect"
        class="flex-1 text-xs border border-gray-200 rounded px-1.5 py-1 focus:outline-none focus:border-purple-400">
        <option value="">+ Asignar servicio...</option>
        ${available.map(cs => {
          const name = cs.name_override || cs._name || cs.effective_name || "";
          const area = cs._area || "";
          return `<option value="${cs._id}">${name}${area ? " · " + area : ""}</option>`;
        }).join("")}
      </select>
      <button onclick="svcAssignFromSelect()"
        class="text-xs bg-purple-600 text-white rounded px-2 py-1 hover:bg-purple-700 transition">OK</button>
    </div>`;
  } else {
    html += `<p class="text-xs text-gray-400">Todos los servicios de la empresa ya asignados.</p>`;
  }

  html += `</div>`;

  container.innerHTML = html;
}


// ── Acciones ──────────────────────────────────────────────────

function svcToggleExpand(csId) {
  serviciosState.expanded[csId] = !serviciosState.expanded[csId];
  renderServicesPanel();
}

function svcOpenAddSlot(csId) {
  serviciosState.expanded[csId] = true;
  renderServicesPanel();
  setTimeout(() => {
    const f = document.getElementById(`svcSlotForm_${csId}`);
    if (f) f.classList.remove("hidden");
  }, 50);
}

async function svcSaveSlot(csId) {
  const datetime = document.getElementById(`svcSlotDatetime_${csId}`)?.value;
  const provider = document.getElementById(`svcSlotProvider_${csId}`)?.value;
  const duration = document.getElementById(`svcSlotDuration_${csId}`)?.value;
  if (!datetime) { alert("Selecciona fecha y hora."); return; }

  const { companyId, waId } = serviciosState;
  await svcPost(`/api/contact-services/contact/${companyId}/${waId}/${csId}/slots`, {
    datetime, provider, duration_minutes: parseInt(duration) || 60
  });
  await loadServicesForContact(companyId, waId);
  serviciosState.expanded[csId] = true;
}

async function svcDeleteSlotUI(csId, slotId) {
  const { companyId, waId } = serviciosState;
  await svcDelete(`/api/contact-services/contact/${companyId}/${waId}/${csId}/slots/${slotId}`);
  await loadServicesForContact(companyId, waId);
  serviciosState.expanded[csId] = true;
}

async function svcRemoveService(csId) {
  if (!confirm("¿Quitar este servicio del contacto?")) return;
  const { companyId, waId } = serviciosState;
  await svcDelete(`/api/contact-services/contact/${companyId}/${waId}/${csId}`);
  await loadServicesForContact(companyId, waId);
}

async function svcAssignFromSelect() {
  const sel = document.getElementById("svcCompanySelect");
  if (!sel?.value) return;
  const { companyId, waId } = serviciosState;
  await svcPost(`/api/contact-services/contact/${companyId}/${waId}`, {
    company_service_id: sel.value
  });
  await loadServicesForContact(companyId, waId);
}

// ── Exports ───────────────────────────────────────────────────
window.loadServicesForContact  = loadServicesForContact;
window.svcToggleExpand         = svcToggleExpand;
window.svcOpenAddSlot          = svcOpenAddSlot;
window.svcSaveSlot             = svcSaveSlot;
window.svcDeleteSlotUI         = svcDeleteSlotUI;
window.svcRemoveService        = svcRemoveService;
window.svcAssignFromSelect     = svcAssignFromSelect;

// ── Conectar con selectConversation de conv-messages.js ───────
// conv-messages.js llama a window.onConversationSelectedForContacts
// cuando se selecciona una conversación. Lo encadenamos aquí.
const _prevHook = window.onConversationSelectedForContacts;
window.onConversationSelectedForContacts = function(waId, phone, name, companyId) {
  if (typeof _prevHook === "function") _prevHook(waId, phone, name, companyId);
  if (serviciosState.companyId !== companyId) {
    serviciosState.companyServices = [];
  }
  loadServicesForContact(companyId, waId);

  // Cargar agenda en el bloque del HTML (hermano de SERVICIOS)
  if (typeof loadAgenda === "function") {
    // Abrir la sección si está colapsada
    const section = document.getElementById("contactAgendaSection");
    if (section && section.classList.contains("hidden")) {
      // Dejar colapsada, se cargará al abrir
    }
    loadAgenda(companyId, waId);
  }
};

// Abrir/cerrar sección agenda — disparar carga lazy
const _origToggle = window.toggleRightSection;
if (typeof _origToggle === "function") {
  window.toggleRightSection = function(sectionId) {
    _origToggle(sectionId);
    if (sectionId === "contactAgendaSection") {
      const section = document.getElementById("contactAgendaSection");
      if (section && !section.classList.contains("hidden")) {
        if (typeof loadAgenda === "function") {
          loadAgenda(serviciosState.companyId, serviciosState.waId);
        }
      }
    }
  };
}