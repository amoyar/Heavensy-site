# 🎯 Heavensy Admin Panel - NuevoSite

Panel de administración modular y escalable para Heavensy, con arquitectura de componentes separados.

## 🚀 Características

### ✨ Arquitectura Modular
- Navbar y Sidebar separados (no duplicados en cada página)
- Sistema de routing basado en hash
- Carga dinámica de páginas
- Inicialización automática de scripts por página

### 📊 Módulos Disponibles

#### ✅ Completamente Funcionales
- **Dashboard**: Vista general del sistema
- **Usuarios**: Gestión completa de usuarios (CRUD)
- **Empresas**: Gestión de empresas (CRUD)
- **Roles**: Visualización de roles y permisos
- **Monitor**: Monitoreo en tiempo real con Socket.IO
- **Perfil**: Gestión de perfil y cambio de contraseña

#### 🔄 Próximamente
- **Conversaciones**: Historial de conversaciones
- **Logs**: Registro histórico del sistema
- **Configuración**: Ajustes generales

## 📁 Estructura del Proyecto

```
NuevoSite/
├── index.html              # Punto de entrada
├── login.html              # Login
├── layout/
│   ├── navbar.html        # Navbar reutilizable
│   ├── sidebar.html       # Sidebar con navegación
│   └── layout.js          # Carga de componentes
├── pages/                 # Páginas sin layout
│   ├── dashboard.html
│   ├── users.html
│   ├── companies.html
│   ├── roles.html
│   ├── conversations.html
│   ├── monitor.html
│   ├── logs.html
│   ├── settings.html
│   └── profile.html
└── assets/
    ├── js/
    │   ├── app.js         # Config y utilities
    │   ├── router.js      # Sistema de routing
    │   └── *.js           # Scripts por página
    ├── css/
    │   ├── styles.css
    │   └── theme.css
    └── img/
```

## 🔧 Instalación

1. **Clonar o descargar el proyecto**
```bash
git clone [tu-repo]
cd NuevoSite
```

2. **Configurar la URL del backend**
Editar `assets/js/app.js`:
```javascript
const API_BASE_URL = 'http://tu-backend:5000';
```

3. **Servir la aplicación**
Usar cualquier servidor HTTP:
```bash
# Python
python -m http.server 8080

# Node.js
npx http-server -p 8080

# PHP
php -S localhost:8080
```

4. **Abrir en el navegador**
```
http://localhost:8080
```

## 🔑 Autenticación

El sistema usa JWT para autenticación:

1. Login en `login.html`
2. Token guardado en `localStorage`
3. Token enviado en cada petición API
4. Redirección automática a login si no autenticado

## 🎨 Navegación

### Usando el Sidebar
```html
<a href="#dashboard">Dashboard</a>
<a href="#users">Usuarios</a>
<a href="#companies">Empresas</a>
```

### Routing Automático
1. Click en link → Actualiza hash (`#users`)
2. Router carga `pages/users.html`
3. Router ejecuta `initUsersPage()`
4. Página renderizada sin duplicar navbar/sidebar

## 🛠️ Desarrollo

### Agregar una Nueva Página

**1. Crear HTML**
```html
<!-- pages/mi-pagina.html -->
<div class="container mx-auto">
  <h1 class="text-2xl font-bold">Mi Página</h1>
  <!-- Tu contenido -->
</div>
```

**2. Crear JavaScript**
```javascript
// assets/js/mi-pagina.js
function initMiPaginaPage() {
  console.log('Mi página iniciada');
  // Tu lógica aquí
}
```

**3. Agregar al Sidebar**
```html
<!-- layout/sidebar.html -->
<a href="#mi-pagina" class="flex items-center px-3 py-2 rounded-lg hover:bg-blue-50 text-gray-700">
  <i class="fas fa-star w-5 text-blue-500"></i>
  <span class="ml-3">Mi Página</span>
</a>
```

**4. Incluir Script**
```html
<!-- index.html -->
<script src="./assets/js/mi-pagina.js"></script>
```

### API Calls

Usar la función `apiCall()` incluida:

```javascript
// GET
const response = await apiCall('/api/users');
if (response.ok) {
  const users = response.data;
}

// POST
const response = await apiCall('/api/users', {
  method: 'POST',
  body: JSON.stringify({ name: 'Juan' })
});

// PUT
const response = await apiCall('/api/users/123', {
  method: 'PUT',
  body: JSON.stringify({ name: 'Juan Actualizado' })
});

// DELETE
const response = await apiCall('/api/users/123', {
  method: 'DELETE'
});
```

### Utilities Disponibles

```javascript
// Mostrar loader global
showGlobalLoader();
hideGlobalLoader();

// Alertas
showAlert('Mensaje', 'success');  // success, error, warning, info

// Escape HTML
const safe = escapeHtml(userInput);

// Formateo de fechas
const formatted = formatDate('2024-01-29T12:00:00Z');
```

## 🔍 Monitor en Tiempo Real

Características especiales:
- Socket.IO para comunicación en tiempo real
- Carga dinámica del script solo cuando se necesita
- Filtrado por empresa
- Estadísticas en vivo
- Logs del sistema

```javascript
// El monitor se inicializa automáticamente
// cuando se navega a #monitor
```

## 🎨 Personalización

### Colores y Estilos
- Tailwind CSS para utilidades
- `assets/css/styles.css` para estilos custom
- `assets/css/theme.css` para temas

### Iconos
Font Awesome 6.4.0 incluido:
```html
<i class="fas fa-user"></i>
<i class="fas fa-building"></i>
<i class="fas fa-chart-line"></i>
```

## 📱 Responsive

El diseño es completamente responsive:
- Desktop: Sidebar fijo
- Tablet: Sidebar colapsable
- Mobile: Sidebar como overlay

## 🐛 Troubleshooting

### Página no carga
- ✅ Verificar que existe `pages/nombre-pagina.html`
- ✅ Verificar que el script está en `index.html`
- ✅ Verificar la función `initNombrePaginaPage()`
- ✅ Revisar consola del navegador

### Problemas de API
- ✅ Verificar `API_BASE_URL` en `app.js`
- ✅ Verificar CORS en el backend
- ✅ Verificar que el token JWT es válido
- ✅ Revisar Network tab en DevTools

### Socket.IO no conecta
- ✅ Verificar URL del backend
- ✅ Verificar que el backend soporta Socket.IO
- ✅ Revisar logs en la página de Monitor

## 📚 Documentación Adicional

- `MIGRACION.md`: Detalles de la migración desde admin_panel
- Backend API docs: [Consultar con el equipo]

## 🤝 Contribuir

1. Fork del proyecto
2. Crear feature branch
3. Commit cambios
4. Push a la branch
5. Abrir Pull Request

## 📄 Licencia

Propiedad de Heavensy

## 👨‍💻 Desarrollado Por

Alberto Raúl Moya Riffo
- Sistema modular y escalable
- Migración desde admin_panel
- Arquitectura de componentes separados

---

**Versión:** 2.0  
**Última actualización:** Enero 2026  
**Estado:** ✅ Producción Ready
