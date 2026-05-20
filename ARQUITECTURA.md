# 🏗️ ARQUITECTURA DEL SISTEMA

## Estructura Visual

```
┌─────────────────────────────────────────────────────────────┐
│                      index.html                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  <header id="navbar">                                 │  │
│  │  └─► layout/navbar.html (cargado dinámicamente)      │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌─────────────┬────────────────────────────────────────┐  │
│  │             │                                         │  │
│  │  <aside>    │     <main id="app">                    │  │
│  │  sidebar    │     └─► pages/*.html                   │  │
│  │             │         (cargado según hash)           │  │
│  │             │                                         │  │
│  └─────────────┴────────────────────────────────────────┘  │
│                                                              │
│  Scripts cargados:                                          │
│  ├─► app.js (config base)                                  │
│  ├─► router.js (maneja navegación)                         │
│  ├─► layout.js (carga navbar/sidebar)                      │
│  └─► pages/*.js (lógica por página)                        │
└─────────────────────────────────────────────────────────────┘
```

## Flujo de Datos

```
Usuario
  │
  ├─► Click en "Usuarios" (sidebar)
  │
  └─► window.location.hash = "#users"
        │
        ├─► hashchange event
        │     │
        │     └─► router.js detecta cambio
        │           │
        │           ├─► fetch('pages/users.html')
        │           │     │
        │           │     └─► innerHTML del <main>
        │           │
        │           └─► ejecuta initUsersPage()
        │                 │
        │                 ├─► apiCall('/api/users')
        │                 │     │
        │                 │     └─► Backend API
        │                 │
        │                 └─► renderUsers(data)
        │
        └─► Página renderizada sin duplicar layout
```

## Comparación de Arquitecturas

### ❌ ANTES (admin_panel)

```
users.html
├─► navbar (200 líneas) ─┐
├─► sidebar (150 líneas) ─┤
└─► contenido (100 líneas)│
                          │
companies.html            │ CÓDIGO
├─► navbar (200 líneas) ─┤ DUPLICADO
├─► sidebar (150 líneas) ─┤ (2,600 líneas)
└─► contenido (120 líneas)│
                          │
roles.html                │
├─► navbar (200 líneas) ─┤
├─► sidebar (150 líneas) ─┤
└─► contenido (80 líneas) ┘
```

### ✅ AHORA (NuevoSite)

```
layout/
├─► navbar.html (1 vez, 50 líneas)
└─► sidebar.html (1 vez, 60 líneas)

pages/
├─► users.html (100 líneas)
├─► companies.html (120 líneas)
└─► roles.html (80 líneas)

TOTAL: 410 líneas vs 2,600 líneas
REDUCCIÓN: 84%
```

## Sistema de Routing

```
┌──────────────────────────────────────────────────┐
│              router.js                            │
├──────────────────────────────────────────────────┤
│                                                   │
│  1. Escucha hashchange event                     │
│                                                   │
│  2. Extrae página del hash                       │
│     Ejemplo: #users → "users"                    │
│                                                   │
│  3. Carga HTML                                    │
│     fetch(`pages/${page}.html`)                  │
│                                                   │
│  4. Inyecta en DOM                               │
│     document.getElementById('app').innerHTML      │
│                                                   │
│  5. Ejecuta init function                        │
│     window['initUsersPage']()                    │
│                                                   │
└──────────────────────────────────────────────────┘
```

## Comunicación API

```
Frontend (NuevoSite)
  │
  ├─► apiCall() wrapper
  │     │
  │     ├─► Agrega JWT token
  │     ├─► Agrega headers
  │     └─► Maneja errores
  │
  └─► fetch() nativo
        │
        └─► Backend API (Flask/Node)
              │
              ├─► Valida JWT
              ├─► Procesa request
              └─► Retorna JSON
                    │
                    └─► Frontend procesa
                          │
                          └─► Actualiza UI
```

## Estado de Autenticación

```
Login Page
  │
  ├─► Usuario ingresa credenciales
  │
  └─► POST /api/login
        │
        ├─► Backend valida
        │
        └─► Retorna JWT token
              │
              ├─► localStorage.setItem('token', jwt)
              │
              └─► Redirect a #dashboard
                    │
                    └─► Todas las páginas usan token
                          │
                          ├─► apiCall() lee token
                          │
                          └─► Authorization header
                                │
                                └─► Backend valida en cada request
```

## Carga Dinámica de Módulos

```
Página Monitor
  │
  ├─► initMonitorPage()
  │     │
  │     ├─► Verifica si Socket.IO está cargado
  │     │
  │     └─► Si no está:
  │           │
  │           └─► loadSocketIO()
  │                 │
  │                 ├─► Crea <script>
  │                 ├─► src = "socket.io.min.js"
  │                 └─► Espera onload
  │                       │
  │                       └─► initSocket()
  │
  └─► Conexión WebSocket establecida
```

## Patrón de Página

```javascript
// Estructura estándar de cada página

// 1. HTML (solo contenido)
<div class="container">
  <h1>Título</h1>
  <!-- contenido específico -->
</div>

// 2. JavaScript (lógica)
function initNombrePage() {
  // Inicialización
  loadData();
  setupEventListeners();
}

async function loadData() {
  // Llamada a API
  const response = await apiCall('/api/endpoint');
  renderData(response.data);
}

function renderData(data) {
  // Actualizar DOM
}
```

## Ventajas de Esta Arquitectura

### 🎯 Separación de Responsabilidades
```
Layout (navbar/sidebar)
  │
  ├─► Componentes reutilizables
  ├─► Cargados una vez
  └─► Cambios centralizados

Páginas (contenido)
  │
  ├─► Solo lógica específica
  ├─► Sin duplicación
  └─► Fácil de mantener

Router (navegación)
  │
  ├─► Control centralizado
  ├─► Carga dinámica
  └─► Gestión de estado
```

### 📦 Modularidad
```
Agregar nueva página:
  │
  ├─► 1. Crear HTML (20 líneas)
  ├─► 2. Crear JS (50 líneas)
  ├─► 3. Agregar link (1 línea)
  └─► 4. Incluir script (1 línea)

Total: 4 cambios simples
vs
admin_panel: Copiar 200+ líneas y modificar
```

### 🚀 Performance
```
Primera carga:
  │
  ├─► index.html (5KB)
  ├─► layout files (2KB)
  ├─► scripts (20KB)
  └─► Total: ~27KB

Navegación:
  │
  └─► Solo carga HTML de página (~2KB)
      vs cargar página completa (~30KB)
```

## Escalabilidad Futura

```
Fácil agregar:
  │
  ├─► Nuevas páginas (plug & play)
  │
  ├─► Nuevos módulos
  │
  ├─► Nuevas features
  │     │
  │     ├─► WebSockets
  │     ├─► Charts/Graphs
  │     └─► Real-time updates
  │
  └─► Internacionalización (i18n)
```

---

Esta arquitectura permite un desarrollo ágil, mantenimiento simple y 
escalabilidad sin refactorización mayor del código existente.
