// ============================================
// CONNECTION-STATUS.JS
// Indicador de conexión Backend + WhatsApp Webhook
// ============================================

console.log("🔌 connection-status.js cargado");

const CONNECTION_CHECK_INTERVAL = 30000; // 30 segundos
const WEBHOOK_URL = "https://heavensy-api-webhook-v2.onrender.com";

let connectionCheckTimer = null;

// Estados posibles
const STATUS = {
    CONNECTING: { dot: "bg-yellow-400 animate-pulse", text: "Conectando...", color: "text-yellow-700" },
    CONNECTED:  { dot: "bg-green-500", text: "Conectado", color: "text-green-700" },
    PARTIAL:    { dot: "bg-yellow-500", text: "Parcial", color: "text-yellow-700" },
    DISCONNECTED: { dot: "bg-red-500", text: "Desconectado", color: "text-red-600" }
};

/**
 * Actualiza el indicador visual en el navbar
 */
function setConnectionStatus(status) {
    const dot  = document.getElementById("connectionDot");
    const text = document.getElementById("connectionText");
    const container = document.getElementById("connectionStatus");

    if (!dot || !text) return;

    // Colores del checkmark SVG según estado
    const colors = {
        "Conectando...": { stroke:"#facc15", shadow:"rgba(250,204,21,0.7)" },
        "Conectado":     { stroke:"#4ADE80", shadow:"rgba(74,222,128,0.7)" },
        "Parcial":       { stroke:"#fb923c", shadow:"rgba(251,146,60,0.7)" },
        "Desconectado":  { stroke:"#f87171", shadow:"rgba(248,113,113,0.7)" },
    };
    const c = colors[status.text] || colors["Conectando..."];
    dot.setAttribute("stroke", c.stroke);
    dot.style.filter = `drop-shadow(0 0 5px ${c.shadow})`;

    // El texto siempre dice "IA"
    text.textContent = "IA";
    text.style.color = "rgba(255,255,255,0.82)";

    // Tooltip con estado real
    if (container) {
        const titles = {
            "Conectando...": "Verificando conexión con los servicios...",
            "Conectado":     "Backend y WhatsApp conectados correctamente",
            "Parcial":       "Backend conectado, WhatsApp webhook no responde",
            "Desconectado":  "No se pudo conectar con los servicios"
        };
        container.title = titles[status.text] || "";
    }
}

/**
 * Verifica la conexión con backend y webhook
 */
async function checkConnection() {
    let backendOk = false;
    let webhookOk = false;

    // 1. Verificar Backend
    try {
        const res = await fetch(`${API_BASE_URL}/health`, {
            method: "GET",
            signal: AbortSignal.timeout(8000)
        });
        if (res.ok) {
            const data = await res.json();
            backendOk = data.status === "healthy" && data.database === "connected";
        }
    } catch (e) {
        // Timeout o error de red
    }

    // 2. Verificar Webhook (WhatsApp)
    try {
        const res = await fetch(WEBHOOK_URL, {
            method: "GET",
            signal: AbortSignal.timeout(8000)
        });
        if (res.ok) {
            const data = await res.json();
            webhookOk = data.status === "running";
        }
    } catch (e) {
        // Timeout o error de red
    }

    // 3. Determinar estado
    if (backendOk && webhookOk) {
        setConnectionStatus(STATUS.CONNECTED);
    } else if (backendOk && !webhookOk) {
        setConnectionStatus(STATUS.PARTIAL);
    } else {
        setConnectionStatus(STATUS.DISCONNECTED);
    }
}

/**
 * Inicia la verificación periódica
 */
function initConnectionStatus() {
    // Estado inicial: conectando
    setConnectionStatus(STATUS.CONNECTING);

    // Primera verificación inmediata
    checkConnection();

    // Verificación periódica
    if (connectionCheckTimer) clearInterval(connectionCheckTimer);
    connectionCheckTimer = setInterval(checkConnection, CONNECTION_CHECK_INTERVAL);
}

// Auto-init cuando el layout esté listo
function waitForNavbarAndInit() {
    if (document.getElementById("connectionDot")) {
        initConnectionStatus();
    } else {
        setTimeout(waitForNavbarAndInit, 500);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    setTimeout(waitForNavbarAndInit, 1500);
});