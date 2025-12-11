// Heavensy Admin - Webhook Testing Module

async function testHealthCheck() {
    const responseDiv = document.getElementById('healthCheckResponse');
    responseDiv.classList.remove('d-none');
    responseDiv.innerHTML = '<div class="spinner-border spinner-border-sm me-2"></div>Verificando...';
    
    try {
        const response = await fetch(getWebhookUrl('/health'));
        const data = await response.json();
        
        responseDiv.innerHTML = `
            <div class="alert alert-success">
                <h6><i class="bi bi-check-circle"></i> Webhook funcionando correctamente</h6>
                <pre class="mb-0">${JSON.stringify(data, null, 2)}</pre>
            </div>
        `;
    } catch (error) {
        responseDiv.innerHTML = `
            <div class="alert alert-danger">
                <h6><i class="bi bi-x-circle"></i> Error</h6>
                <p class="mb-0">${error.message}</p>
            </div>
        `;
    }
}

async function testWebhookVerification() {
    const verifyToken = document.getElementById('verifyToken').value;
    const responseDiv = document.getElementById('webhookVerifyResponse');
    responseDiv.classList.remove('d-none');
    responseDiv.innerHTML = '<div class="spinner-border spinner-border-sm me-2"></div>Verificando...';
    
    try {
        const url = `${getWebhookUrl('/webhook/message')}?hub.mode=subscribe&hub.verify_token=${verifyToken}&hub.challenge=test_challenge_123`;
        const response = await fetch(url);
        const data = await response.text();
        
        if (response.ok) {
            responseDiv.innerHTML = `
                <div class="alert alert-success">
                    <h6><i class="bi bi-check-circle"></i> Verificación exitosa</h6>
                    <p class="mb-0">Challenge recibido: <code>${data}</code></p>
                </div>
            `;
        } else {
            responseDiv.innerHTML = `
                <div class="alert alert-danger">
                    <h6><i class="bi bi-x-circle"></i> Verificación fallida</h6>
                    <p class="mb-0">Respuesta: ${data}</p>
                </div>
            `;
        }
    } catch (error) {
        responseDiv.innerHTML = `
            <div class="alert alert-danger">
                <h6><i class="bi bi-x-circle"></i> Error</h6>
                <p class="mb-0">${error.message}</p>
            </div>
        `;
    }
}

async function simulateWhatsAppMessage() {
    const responseDiv = document.getElementById('simulateResponse');
    responseDiv.classList.remove('d-none');
    responseDiv.innerHTML = '<div class="spinner-border spinner-border-sm me-2"></div>Enviando mensaje...';
    
    const fromPhone = document.getElementById('fromPhone').value;
    const fromName = document.getElementById('fromName').value;
    const messageText = document.getElementById('messageText').value;
    const phoneNumberId = document.getElementById('phoneNumberId').value;
    const messageType = document.getElementById('messageType').value;
    
    const webhookPayload = {
        object: "whatsapp_business_account",
        entry: [{
            id: "WHATSAPP_BUSINESS_ACCOUNT_ID",
            changes: [{
                value: {
                    messaging_product: "whatsapp",
                    metadata: {
                        display_phone_number: "56912345678",
                        phone_number_id: phoneNumberId
                    },
                    contacts: [{
                        profile: { name: fromName },
                        wa_id: fromPhone
                    }],
                    messages: [{
                        from: fromPhone,
                        id: `wamid.test_${Date.now()}`,
                        timestamp: Math.floor(Date.now() / 1000).toString(),
                        text: { body: messageText },
                        type: messageType
                    }]
                },
                field: "messages"
            }]
        }]
    };
    
    try {
        const response = await fetch(getWebhookUrl('/webhook/message'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(webhookPayload)
        });
        
        const data = await response.json();
        
        if (response.ok) {
            responseDiv.innerHTML = `
                <div class="alert alert-success">
                    <h6><i class="bi bi-check-circle"></i> Mensaje enviado correctamente</h6>
                    <p class="mb-2"><strong>Respuesta del webhook:</strong></p>
                    <pre class="mb-0">${JSON.stringify(data, null, 2)}</pre>
                </div>
            `;
        } else {
            responseDiv.innerHTML = `
                <div class="alert alert-warning">
                    <h6><i class="bi bi-exclamation-triangle"></i> Respuesta del servidor</h6>
                    <pre class="mb-0">${JSON.stringify(data, null, 2)}</pre>
                </div>
            `;
        }
    } catch (error) {
        responseDiv.innerHTML = `
            <div class="alert alert-danger">
                <h6><i class="bi bi-x-circle"></i> Error al enviar mensaje</h6>
                <p class="mb-0">${error.message}</p>
            </div>
        `;
    }
}
