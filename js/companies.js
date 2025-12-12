// Heavensy Admin - Companies Module

let companies = [];
let currentCompany = null;
let companyModal = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    if (!requireAuth()) return;
    
    companyModal = new bootstrap.Modal(document.getElementById('companyModal'));
    loadCompanies();
});

// Load all companies
async function loadCompanies() {
    showLoading('Cargando empresas...');
    
    try {
        const data = await apiCall(CONFIG.API_ENDPOINTS.COMPANIES);
        companies = data.companies || data || [];
        renderCompaniesTable();
        hideLoading();
    } catch (error) {
        hideLoading();
        showError('Error al cargar empresas: ' + error.message);
        renderEmptyTable();
    }
}

// Render companies table
function renderCompaniesTable() {
    const tbody = document.getElementById('companiesTableBody');
    if (!tbody) return;
    
    if (companies.length === 0) {
        renderEmptyTable();
        return;
    }
    
    tbody.innerHTML = '';
    
    companies.forEach(company => {
        const row = document.createElement('tr');
        row.className = 'fade-in';
        
        row.innerHTML = `
            <td><code>${company.company_id}</code></td>
            <td><strong>${company.name}</strong></td>
            <td><a href="mailto:${company.contact_email}">${company.contact_email}</a></td>
            <td>${formatPhone(company.contact_phone)}</td>
            <td><span class="badge bg-info">${company.bot_config?.bot_name || 'N/A'}</span></td>
            <td>
                ${company.active ? 
                    '<span class="badge bg-success">Activa</span>' : 
                    '<span class="badge bg-secondary">Inactiva</span>'}
            </td>
            <td>
                <div class="btn-group btn-group-sm" role="group">
                    <button class="btn btn-outline-primary" onclick="viewCompany('${company.company_id}')" title="Ver detalles">
                        <i class="bi bi-eye"></i>
                    </button>
                    <button class="btn btn-outline-warning" onclick="editCompany('${company.company_id}')" title="Editar">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-outline-danger" onclick="deleteCompany('${company.company_id}')" title="Desactivar">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </td>
        `;
        
        tbody.appendChild(row);
    });
}

// Render empty table
function renderEmptyTable() {
    const tbody = document.getElementById('companiesTableBody');
    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center text-muted py-4">
                    <i class="bi bi-building fs-1 d-block mb-2"></i>
                    No hay empresas registradas
                </td>
            </tr>
        `;
    }
}

// Show create modal
function showCreateModal() {
    currentCompany = null;
    document.getElementById('modalTitle').innerHTML = '<i class="bi bi-building"></i> Nueva Empresa';
    document.getElementById('companyForm').reset();
    document.getElementById('company_id').disabled = false;
    companyModal.show();
}

// View company details
async function viewCompany(companyId) {
    showLoading('Cargando detalles...');
    
    try {
        const data = await apiCall(CONFIG.API_ENDPOINTS.COMPANY_BY_ID(companyId));
        hideLoading();
        showCompanyDetails(data);
    } catch (error) {
        hideLoading();
        showError('Error al cargar empresa: ' + error.message);
    }
}

// Show company details
function showCompanyDetails(data) {
    const company = data.company || data;
    const companyName = company.name || company.company_name || company.company_id;
    
    container.innerHTML = `
        <div class="card shadow-sm mb-4">
            <div class="card-header bg-heavensy text-white">
                <h5 class="mb-0"><i class="bi bi-building"></i> Detalles de ${companyName}</h5>
            </div>
            <div class="card-body">
                <div class="row">
                    <div class="col-md-6">
                        <h6>Información General</h6>
                        <table class="table table-sm">
                            <tr>
                                <th>Company ID:</th>
                                <td><code>${company.company_id}</code></td>
                            </tr>
                            <tr>
                                <th>Nombre:</th>
                                <td>${companyName}</td>
                            </tr>
                            <tr>
                                <th>Descripción:</th>
                                <td>${company.description || 'N/A'}</td>
                            </tr>
                            <tr>
                                <th>Email:</th>
                                <td>${company.contact_email ? `<a href="mailto:${company.contact_email}">${company.contact_email}</a>` : 'N/A'}</td>
                            </tr>
                            <tr>
                                <th>Teléfono:</th>
                                <td>${company.contact_phone ? formatPhone(company.contact_phone) : 'N/A'}</td>
                            </tr>
                            <tr>
                                <th>Dirección:</th>
                                <td>${company.address || 'N/A'}</td>
                            </tr>
                            <tr>
                                <th>Sitio Web:</th>
                                <td>${company.website ? `<a href="${company.website}" target="_blank">${company.website}</a>` : 'N/A'}</td>
                            </tr>
                            <tr>
                                <th>Estado:</th>
                                <td>${company.active ? '<span class="badge bg-success">Activa</span>' : '<span class="badge bg-secondary">Inactiva</span>'}</td>
                            </tr>
                        </table>
                    </div>
                    <div class="col-md-6">
                        <h6><i class="bi bi-whatsapp"></i> WhatsApp Config</h6>
                        <table class="table table-sm">
                            <tr>
                                <th>Phone Number ID:</th>
                                <td><code>${company.whatsapp_config?.phone_number_id || 'N/A'}</code></td>
                            </tr>
                            <tr>
                                <th>Webhook URL:</th>
                                <td><small>${company.whatsapp_config?.webhook_url || 'N/A'}</small></td>
                            </tr>
                        </table>
                        
                        <h6 class="mt-3"><i class="bi bi-robot"></i> Bot Config</h6>
                        <table class="table table-sm">
                            <tr>
                                <th>Nombre del Bot:</th>
                                <td><span class="badge bg-info">${company.bot_config?.bot_name || 'N/A'}</span></td>
                            </tr>
                            <tr>
                                <th>Mensaje de Saludo:</th>
                                <td><small>${company.bot_config?.greeting_message || 'N/A'}</small></td>
                            </tr>
                            <tr>
                                <th>Archivo de Prompt:</th>
                                <td><code>${company.bot_config?.system_prompt_file || 'N/A'}</code></td>
                            </tr>
                            <tr>
                                <th>Máx. Mensajes:</th>
                                <td>${company.bot_config?.max_messages || 'N/A'}</td>
                            </tr>
                        </table>
                    </div>
                </div>
                <div class="mt-3">
                    <button class="btn btn-warning" onclick="editCompany('${company.company_id}')">
                        <i class="bi bi-pencil"></i> Editar
                    </button>
                    <button class="btn btn-secondary" onclick="document.getElementById('responseContainer').innerHTML = ''">
                        <i class="bi bi-x"></i> Cerrar
                    </button>
                </div>
            </div>
        </div>
    `;
    
    // Scroll to details
    container.scrollIntoView({ behavior: 'smooth' });
}

// Edit company
async function editCompany(companyId) {
    showLoading('Cargando datos...');
    
    try {
        const data = await apiCall(CONFIG.API_ENDPOINTS.COMPANY_BY_ID(companyId));
        const company = data.company || data;
        currentCompany = company;
        hideLoading();
        
        // Fill form
        document.getElementById('modalTitle').innerHTML = '<i class="bi bi-pencil"></i> Editar Empresa';
        document.getElementById('company_id').value = company.company_id;
        document.getElementById('company_id').disabled = true;
        document.getElementById('name').value = company.name || company.company_name || '';
        document.getElementById('description').value = company.description || '';
        document.getElementById('contact_email').value = company.contact_email || '';
        document.getElementById('contact_phone').value = company.contact_phone || '';
        document.getElementById('address').value = data.address || '';
        document.getElementById('website').value = data.website || '';
        
        // WhatsApp config
        document.getElementById('phone_number_id').value = data.whatsapp_config?.phone_number_id || '';
        document.getElementById('access_token').value = data.whatsapp_config?.access_token || '';
        document.getElementById('webhook_url').value = data.whatsapp_config?.webhook_url || '';
        document.getElementById('verify_token').value = data.whatsapp_config?.verify_token || '';
        
        // Bot config
        document.getElementById('bot_name').value = data.bot_config?.bot_name || '';
        document.getElementById('greeting_message').value = data.bot_config?.greeting_message || '';
        document.getElementById('system_prompt_file').value = data.bot_config?.system_prompt_file || '';
        document.getElementById('max_messages').value = data.bot_config?.max_messages || 100;
        document.getElementById('active').checked = data.active;
        
        companyModal.show();
    } catch (error) {
        hideLoading();
        showError('Error al cargar empresa: ' + error.message);
    }
}

// Save company (create or update)
async function saveCompany() {
    const form = document.getElementById('companyForm');
    
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }
    
    const companyData = {
        company_id: document.getElementById('company_id').value,
        name: document.getElementById('name').value,
        description: document.getElementById('description').value,
        contact_email: document.getElementById('contact_email').value,
        contact_phone: document.getElementById('contact_phone').value,
        address: document.getElementById('address').value,
        website: document.getElementById('website').value,
        whatsapp_config: {
            phone_number_id: document.getElementById('phone_number_id').value,
            access_token: document.getElementById('access_token').value,
            webhook_url: document.getElementById('webhook_url').value,
            verify_token: document.getElementById('verify_token').value
        },
        bot_config: {
            bot_name: document.getElementById('bot_name').value,
            greeting_message: document.getElementById('greeting_message').value,
            system_prompt_file: document.getElementById('system_prompt_file').value,
            max_messages: parseInt(document.getElementById('max_messages').value)
        },
        active: document.getElementById('active').checked
    };
    
    const isEdit = currentCompany !== null;
    const endpoint = isEdit ? 
        CONFIG.API_ENDPOINTS.COMPANY_BY_ID(companyData.company_id) : 
        CONFIG.API_ENDPOINTS.COMPANIES;
    const method = isEdit ? 'PUT' : 'POST';
    
    showLoading(isEdit ? 'Actualizando empresa...' : 'Creando empresa...');
    
    try {
        await apiCall(endpoint, {
            method: method,
            body: JSON.stringify(companyData)
        });
        
        hideLoading();
        companyModal.hide();
        showSuccess(isEdit ? 'Empresa actualizada correctamente' : 'Empresa creada correctamente');
        loadCompanies();
    } catch (error) {
        hideLoading();
        showError('Error al guardar empresa: ' + error.message);
    }
}

// Delete (deactivate) company
async function deleteCompany(companyId) {
    if (!confirm('¿Está seguro de que desea desactivar esta empresa?')) {
        return;
    }
    
    showLoading('Desactivando empresa...');
    
    try {
        await apiCall(CONFIG.API_ENDPOINTS.COMPANY_BY_ID(companyId), {
            method: 'DELETE'
        });
        
        hideLoading();
        showSuccess('Empresa desactivada correctamente');
        loadCompanies();
    } catch (error) {
        hideLoading();
        showError('Error al desactivar empresa: ' + error.message);
    }
}
