// ============================================
// COMPANIES COMPLETE - HEAVENSY ADMIN
// ============================================

let companies = [];
let editingCompanyId = null;
let AVAILABLE_PLANS = [];

// Paginación
let currentPageCompanies = 1;
let itemsPerPageCompanies = 10;
let totalCompanies = 0;

// ============================================
// INIT
// ============================================

function initCompaniesPage() {
  console.log('✅ Página de empresas iniciada');
  fetchSubscriptionPlans();
  fetchCompanies();
  
  const form = document.getElementById('companyForm');
  if (form) {
    form.addEventListener('submit', handleSaveCompany);
  }
}

// ============================================
// FETCH SUBSCRIPTION PLANS
// ============================================

async function fetchSubscriptionPlans() {
  try {
    // IMPORTANTE: Sin barra final para evitar redirect en OPTIONS
    const res = await apiCall('/api/subscription-plans');

    if (res && res.ok && res.data) {
      // El backend retorna array directo en res.data
      AVAILABLE_PLANS = Array.isArray(res.data) ? res.data : [];
      console.log('✅ Planes de suscripción cargados:', AVAILABLE_PLANS.length);
    } else {
      console.warn('⚠️ No se pudieron cargar planes del API, usando valores por defecto');
      useFallbackPlans();
    }
  } catch (error) {
    console.warn('⚠️ Error al cargar planes, usando valores por defecto:', error);
    useFallbackPlans();
  }
}

function useFallbackPlans() {
  AVAILABLE_PLANS = [
    { plan_id: 'FREE', plan_name: 'Plan Gratuito', monthly_message_limit: 1000 },
    { plan_id: 'BASIC', plan_name: 'Plan Básico', monthly_message_limit: 5000 },
    { plan_id: 'PREMIUM', plan_name: 'Plan Premium', monthly_message_limit: 10000 },
    { plan_id: 'ENTERPRISE', plan_name: 'Plan Empresarial', monthly_message_limit: 50000 }
  ];
}

// ============================================
// FETCH COMPANIES
// ============================================

async function fetchCompanies() {
  const res = await apiCall('/api/companies', {
    loaderMessage: 'Cargando empresas...'
  });

  if (!res || !res.ok) {
    showToast('Error cargando empresas', 'error');
    return;
  }

  companies = res.data.companies || res.data || [];
  totalCompanies = companies.length;
  
  updateCompaniesStats();
  renderCompanies();
  renderCompaniesPagination();
}

// ============================================
// STATS
// ============================================

function updateCompaniesStats() {
  const total = companies.length;
  const active = companies.filter(c => c.status === 'A').length;
  const inactive = total - active;

  const totalEl = document.getElementById('totalCompanies');
  const activeEl = document.getElementById('activeCompanies');
  const inactiveEl = document.getElementById('inactiveCompanies');

  if (totalEl) totalEl.textContent = total;
  if (activeEl) activeEl.textContent = active;
  if (inactiveEl) inactiveEl.textContent = inactive;
}

// ============================================
// TOGGLE STATUS
// ============================================

async function toggleCompanyStatus(companyId, currentStatus) {
  const newStatus = currentStatus === 'A' ? 'I' : 'A';
  
  try {
    const res = await apiCall(`/api/companies/${companyId}`, {
      method: 'PUT',
      body: JSON.stringify({ status: newStatus }),
      loaderMessage: 'Actualizando estado...'
    });

    if (res && res.ok) {
      showToast(`Empresa ${newStatus === 'A' ? 'activada' : 'desactivada'} correctamente`, 'success');
      
      const company = companies.find(c => c.company_id === companyId);
      if (company) {
        company.status = newStatus;
      }
      
      updateCompaniesStats();
      renderCompanies();
    } else {
      showToast(res.data?.msg || 'Error al cambiar estado', 'error');
    }
  } catch (error) {
    console.error('Error:', error);
    showToast('Error de conexión', 'error');
  }
}

// ============================================
// DELETE COMPANY
// ============================================

function confirmDeleteCompany(companyId) {
  const company = companies.find(c => c.company_id === companyId);
  const companyName = company ? company.name || companyId : companyId;
  
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50';
  modal.innerHTML = `
    <div class="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4">
      <div class="p-6">
        <div class="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full mb-4">
          <i class="fas fa-exclamation-triangle text-red-600 text-2xl"></i>
        </div>
        <h3 class="text-xl font-bold text-gray-900 text-center mb-2">¿Eliminar Empresa?</h3>
        <p class="text-gray-600 text-center mb-2">
          Estás a punto de eliminar la empresa:
        </p>
        <p class="text-lg font-semibold text-gray-900 text-center mb-4">
          ${escapeHtml(companyName)}
        </p>
        <div class="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
          <div class="flex">
            <i class="fas fa-exclamation-circle text-yellow-400 mt-0.5 mr-3"></i>
            <div class="text-sm text-yellow-700">
              <p class="font-medium mb-1">¡Advertencia!</p>
              <p>Esta acción eliminará permanentemente la empresa y todos sus datos asociados de la base de datos. Esta operación no se puede deshacer.</p>
            </div>
          </div>
        </div>
      </div>
      <div class="flex gap-3 px-6 py-4 bg-gray-50 rounded-b-xl">
        <button
          onclick="this.closest('.fixed').remove()"
          class="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          Cancelar
        </button>
        <button
          onclick="deleteCompany('${companyId}'); this.closest('.fixed').remove();"
          class="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700"
        >
          Sí, eliminar
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
}

async function deleteCompany(companyId) {
  try {
    const res = await apiCall(`/api/companies/${companyId}`, {
      method: 'DELETE',
      loaderMessage: 'Eliminando empresa...'
    });

    if (res && res.ok) {
      showToast('Empresa eliminada correctamente', 'success');
      
      companies = companies.filter(c => c.company_id !== companyId);
      totalCompanies = companies.length;
      
      const totalPages = Math.ceil(totalCompanies / itemsPerPageCompanies);
      if (currentPageCompanies > totalPages && currentPageCompanies > 1) {
        currentPageCompanies--;
      }
      
      updateCompaniesStats();
      renderCompanies();
      renderCompaniesPagination();
    } else {
      showToast(res.data?.msg || 'Error al eliminar empresa', 'error');
    }
  } catch (error) {
    console.error('Error:', error);
    showToast('Error de conexión', 'error');
  }
}

// ============================================
// RENDER COMPANIES WITH PAGINATION
// ============================================

function renderCompanies() {
  const tbody = document.getElementById('companiesTable');
  if (!tbody) return;

  tbody.innerHTML = '';

  const startIndex = (currentPageCompanies - 1) * itemsPerPageCompanies;
  const endIndex = startIndex + itemsPerPageCompanies;
  const paginatedCompanies = companies.slice(startIndex, endIndex);

  const showingFrom = document.getElementById('showingFromCompanies');
  const showingTo = document.getElementById('showingToCompanies');
  const totalRecords = document.getElementById('totalRecordsCompanies');

  if (showingFrom) showingFrom.textContent = totalCompanies > 0 ? startIndex + 1 : 0;
  if (showingTo) showingTo.textContent = Math.min(endIndex, totalCompanies);
  if (totalRecords) totalRecords.textContent = totalCompanies;

  if (paginatedCompanies.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="px-6 py-12 text-center text-gray-500">
          <i class="fas fa-building text-4xl mb-3"></i>
          <p>No hay empresas registradas</p>
        </td>
      </tr>
    `;
    return;
  }

  paginatedCompanies.forEach(c => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-gray-50';

    const isActive = c.status === 'A';
    
    // Obtener nombre del plan
    const plan = AVAILABLE_PLANS.find(p => p.plan_id === c.plan_id);
    const planName = plan ? plan.plan_name : c.plan_id || '-';

    tr.innerHTML = `
      <td class="px-6 py-4 text-sm font-medium text-gray-900">${escapeHtml(c.company_id)}</td>
      <td class="px-6 py-4 text-sm text-gray-900">${escapeHtml(c.name || '')}</td>
      <td class="px-6 py-4 text-sm text-gray-700">${escapeHtml(c.contact_email || '')}</td>
      <td class="px-6 py-4 text-sm text-gray-700">${escapeHtml(c.contact_phone || '-')}</td>
      <td class="px-6 py-4 text-sm text-center text-gray-700">${escapeHtml(planName)}</td>
      <td class="px-6 py-4">
        <button
          onclick="toggleCompanyStatus('${c.company_id}', '${c.status}')"
          class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
            isActive ? 'bg-green-500' : 'bg-gray-300'
          }"
          title="${isActive ? 'Click para desactivar' : 'Click para activar'}"
        >
          <span class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            isActive ? 'translate-x-6' : 'translate-x-1'
          }"></span>
        </button>
        <span class="ml-2 text-sm font-medium ${
          isActive ? 'text-green-700' : 'text-gray-500'
        }">
          ${isActive ? 'Activa' : 'Inactiva'}
        </span>
      </td>
      <td class="px-6 py-4 text-right">
        <button 
          onclick="openCompanyModal('${c.company_id}')"
          class="text-blue-600 hover:text-blue-800 text-sm font-medium mr-3"
          title="Editar empresa"
        >
          <i class="fas fa-edit"></i>
        </button>
        <button 
          onclick="confirmDeleteCompany('${c.company_id}')"
          class="text-red-600 hover:text-red-800 text-sm font-medium"
          title="Eliminar empresa"
        >
          <i class="fas fa-trash"></i>
        </button>
      </td>
    `;

    tbody.appendChild(tr);
  });
}

// ============================================
// PAGINATION
// ============================================

function renderCompaniesPagination() {
  const container = document.getElementById('paginationControlsCompanies');
  if (!container) return;

  const totalPages = Math.ceil(totalCompanies / itemsPerPageCompanies);
  
  let html = '';

  html += `
    <div class="flex items-center gap-2">
      <span class="text-sm text-gray-600">Mostrar:</span>
      <select 
        onchange="changeItemsPerPageCompanies(this.value)" 
        class="border rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500"
      >
        <option value="5" ${itemsPerPageCompanies === 5 ? 'selected' : ''}>5</option>
        <option value="10" ${itemsPerPageCompanies === 10 ? 'selected' : ''}>10</option>
        <option value="20" ${itemsPerPageCompanies === 20 ? 'selected' : ''}>20</option>
        <option value="50" ${itemsPerPageCompanies === 50 ? 'selected' : ''}>50</option>
      </select>
    </div>
  `;

  if (totalPages <= 1) {
    container.innerHTML = html;
    return;
  }

  html += '<div class="flex gap-2">';

  html += `
    <button 
      onclick="changePageCompanies(${currentPageCompanies - 1})"
      ${currentPageCompanies === 1 ? 'disabled' : ''}
      class="px-3 py-1 rounded border ${
        currentPageCompanies === 1
          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
          : 'bg-white text-gray-700 hover:bg-gray-50'
      }"
    >
      <i class="fas fa-chevron-left"></i>
    </button>
  `;

  const maxVisible = 5;
  let startPage = Math.max(1, currentPageCompanies - Math.floor(maxVisible / 2));
  let endPage = Math.min(totalPages, startPage + maxVisible - 1);

  if (endPage - startPage < maxVisible - 1) {
    startPage = Math.max(1, endPage - maxVisible + 1);
  }

  if (startPage > 1) {
    html += `
      <button onclick="changePageCompanies(1)" class="px-3 py-1 rounded border bg-white text-gray-700 hover:bg-gray-50">1</button>
    `;
    if (startPage > 2) {
      html += `<span class="px-2 text-gray-400">...</span>`;
    }
  }

  for (let i = startPage; i <= endPage; i++) {
    html += `
      <button 
        onclick="changePageCompanies(${i})"
        class="px-3 py-1 rounded border ${
          i === currentPageCompanies
            ? 'bg-blue-600 text-white'
            : 'bg-white text-gray-700 hover:bg-gray-50'
        }"
      >
        ${i}
      </button>
    `;
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) {
      html += `<span class="px-2 text-gray-400">...</span>`;
    }
    html += `
      <button onclick="changePageCompanies(${totalPages})" class="px-3 py-1 rounded border bg-white text-gray-700 hover:bg-gray-50">${totalPages}</button>
    `;
  }

  html += `
    <button 
      onclick="changePageCompanies(${currentPageCompanies + 1})"
      ${currentPageCompanies === totalPages ? 'disabled' : ''}
      class="px-3 py-1 rounded border ${
        currentPageCompanies === totalPages
          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
          : 'bg-white text-gray-700 hover:bg-gray-50'
      }"
    >
      <i class="fas fa-chevron-right"></i>
    </button>
  `;

  html += '</div>';

  container.innerHTML = html;
}

function changePageCompanies(page) {
  const totalPages = Math.ceil(totalCompanies / itemsPerPageCompanies);
  
  if (page < 1 || page > totalPages) return;
  
  currentPageCompanies = page;
  renderCompanies();
  renderCompaniesPagination();
}

function changeItemsPerPageCompanies(value) {
  itemsPerPageCompanies = parseInt(value);
  currentPageCompanies = 1;
  renderCompanies();
  renderCompaniesPagination();
}

// ============================================
// MODAL
// ============================================

function openCompanyModal(companyId = null) {
  editingCompanyId = companyId;

  const modal = document.getElementById('companyModal');
  const form = document.getElementById('companyForm');
  const title = document.getElementById('companyModalTitle');

  if (!modal || !form) return;

  modal.classList.remove('hidden');
  form.reset();
  
  // Renderizar opciones de planes (con fallback si no hay)
  renderPlanOptions();

  if (companyId) {
    title.textContent = 'Editar empresa';

    const company = companies.find(c => c.company_id === companyId);
    if (company) {
      // Campos básicos
      document.getElementById('company_id').value = company.company_id || '';
      document.getElementById('company_id').disabled = true;
      document.getElementById('name').value = company.name || '';
      document.getElementById('legal_name').value = company.legal_name || '';
      document.getElementById('rut').value = company.rut || '';
      document.getElementById('description').value = company.description || '';
      
      // Contacto
      document.getElementById('contact_email').value = company.contact_email || '';
      document.getElementById('contact_phone').value = company.contact_phone || '';
      document.getElementById('address').value = company.address || '';
      document.getElementById('website').value = company.website || '';
      
      // Plan
      document.getElementById('plan_id').value = company.plan_id || '';
      
      // WhatsApp Config
      document.getElementById('phone_number_id').value = company.phone_number_id || '';
      if (company.whatsapp_config) {
        document.getElementById('wa_phone_number_id').value = company.whatsapp_config.phone_number_id || '';
        document.getElementById('wa_access_token').value = company.whatsapp_config.access_token || '';
        document.getElementById('wa_verify_token').value = company.whatsapp_config.verify_token || '';
        document.getElementById('wa_webhook_url').value = company.whatsapp_config.webhook_url || '';
      }
      
      // Bot Config
      if (company.bot_config) {
        document.getElementById('bot_name').value = company.bot_config.bot_name || '';
        document.getElementById('greeting_message').value = company.bot_config.greeting_message || '';
        document.getElementById('max_messages').value = company.bot_config.max_messages || '';
        document.getElementById('bot_active').checked = company.bot_config.active !== false;
      }
      
      // Status
      document.getElementById('company_status').checked = company.status === 'A';
      
      // Fechas (solo lectura)
      if (company.created_at) {
        document.getElementById('created_at').value = formatDate(company.created_at);
      }
      if (company.updated_at) {
        document.getElementById('updated_at').value = formatDate(company.updated_at);
      }
    }
  } else {
    title.textContent = 'Nueva empresa';
    document.getElementById('company_id').disabled = false;
    document.getElementById('created_at').value = '';
    document.getElementById('updated_at').value = '';
  }
}

function renderPlanOptions() {
  const select = document.getElementById('plan_id');
  if (!select) return;
  
  select.innerHTML = '<option value="">Seleccionar plan</option>';
  
  if (AVAILABLE_PLANS.length === 0) {
    // Si no hay planes, usar fallback
    useFallbackPlans();
  }
  
  AVAILABLE_PLANS.forEach(plan => {
    const option = document.createElement('option');
    option.value = plan.plan_id;
    const limit = plan.monthly_message_limit || 0;
    option.textContent = `${plan.plan_name} (${limit.toLocaleString()} msgs/mes)`;
    select.appendChild(option);
  });
}

function closeCompanyModal() {
  const modal = document.getElementById('companyModal');
  if (modal) {
    modal.classList.add('hidden');
  }
  editingCompanyId = null;
}

// ============================================
// SAVE COMPANY
// ============================================

async function handleSaveCompany(e) {
  e.preventDefault();

  const companyData = {
    company_id: document.getElementById('company_id').value,
    name: document.getElementById('name').value,
    legal_name: document.getElementById('legal_name').value,
    rut: document.getElementById('rut').value,
    description: document.getElementById('description').value,
    contact_email: document.getElementById('contact_email').value,
    contact_phone: document.getElementById('contact_phone').value,
    address: document.getElementById('address').value,
    website: document.getElementById('website').value,
    phone_number_id: document.getElementById('phone_number_id').value,
    plan_id: document.getElementById('plan_id').value,
    whatsapp_config: {
      phone_number_id: document.getElementById('wa_phone_number_id').value,
      access_token: document.getElementById('wa_access_token').value,
      verify_token: document.getElementById('wa_verify_token').value,
      webhook_url: document.getElementById('wa_webhook_url').value
    },
    bot_config: {
      bot_name: document.getElementById('bot_name').value,
      greeting_message: document.getElementById('greeting_message').value,
      max_messages: parseInt(document.getElementById('max_messages').value) || 0,
      active: document.getElementById('bot_active').checked
    },
    status: document.getElementById('company_status').checked ? 'A' : 'I'
  };

  try {
    let res;
    if (editingCompanyId) {
      res = await apiCall(`/api/companies/${editingCompanyId}`, {
        method: 'PUT',
        body: JSON.stringify(companyData),
        loaderMessage: 'Actualizando empresa...'
      });
    } else {
      res = await apiCall('/api/companies', {
        method: 'POST',
        body: JSON.stringify(companyData),
        loaderMessage: 'Creando empresa...'
      });
    }

    if (res && res.ok) {
      showToast(editingCompanyId ? 'Empresa actualizada' : 'Empresa creada', 'success');
      closeCompanyModal();
      fetchCompanies();
    } else {
      showToast(res.data?.msg || 'Error al guardar empresa', 'error');
    }
  } catch (error) {
    console.error('Error:', error);
    showToast('Error de conexión', 'error');
  }
}