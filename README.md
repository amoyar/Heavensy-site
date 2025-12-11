# Heavensy Admin Panel

Panel de administración profesional para el sistema Heavensy - Sistema de gestión multi-empresa para WhatsApp Business con IA.

## 🌟 Características

- **Dashboard en Tiempo Real**: Monitoreo de mensajes con WebSocket
- **Gestión de Empresas**: CRUD completo de empresas
- **Gestión de Usuarios**: 
  - Usuarios del sistema (profesionales, admins)
  - Usuarios de WhatsApp (clientes)
- **Conversaciones**: Historial completo de interacciones
- **Multimedia**: Gestión de archivos en Cloudinary
- **Webhook Testing**: Herramientas para probar el webhook
- **Configuración**: Parámetros del sistema
- **Autenticación JWT**: Sistema de login seguro

## 🚀 Instalación

### Modo Demo (Por Defecto)

El sitio viene configurado en **MODO DEMO** por defecto, lo que significa que:
- ✅ **NO necesitas backend activo** para probarlo
- ✅ Funciona completamente offline
- ✅ Muestra datos de ejemplo
- ✅ Todas las páginas son navegables

**Para usar en modo demo:**
1. Simplemente abre el archivo `index.html` en tu navegador
2. Ve a Login y usa: `admin@heavensy.com` / `Admin123!`
3. Explora todas las funcionalidades

### Conectar con Backend Real

Para conectar con tu backend de Heavensy:

1. Edita `js/config.js`
2. Cambia `DEMO_MODE: true` a `DEMO_MODE: false`
3. Configura las URLs de tu backend:

```javascript
const CONFIG = {
    DEMO_MODE: false, // ← Cambia esto
    BACKEND_URL: 'https://tu-backend.onrender.com',
    WEBHOOK_URL: 'https://tu-webhook.onrender.com',
    SOCKET_URL: 'https://tu-backend.onrender.com',
};
```

### Opción 1: Servidor Local

1. Simplemente abre el archivo `index.html` en tu navegador

### Opción 2: Servidor HTTP Simple (Python)

```bash
cd heavensy-admin
python -m http.server 8000
```

Luego abre http://localhost:8000 en tu navegador

### Opción 3: Live Server (VS Code)

1. Instala la extensión "Live Server" en VS Code
2. Haz clic derecho en `index.html` → "Open with Live Server"

## 🔐 Credenciales de Acceso

**Usuario por defecto:**
- Email: `admin@heavensy.com`
- Password: `Admin123!`

## 📁 Estructura del Proyecto

```
heavensy-admin/
├── index.html                 # Página de inicio
├── auth.html                  # Página de login
├── dashboard.html             # Dashboard principal
├── companies.html             # Gestión de empresas
├── users.html                 # Usuarios del sistema
├── whatsapp-users.html        # Usuarios de WhatsApp
├── conversations.html         # Historial de conversaciones
├── multimedia.html            # Archivos multimedia
├── config.html                # Configuración
├── webhook-test.html          # Testing de webhook
├── css/
│   └── styles.css             # Estilos personalizados
└── js/
    ├── config.js              # Configuración de API
    ├── auth.js                # Autenticación
    ├── main.js                # Funciones principales
    ├── companies.js           # Lógica de empresas
    ├── users.js               # Lógica de usuarios del sistema
    ├── whatsapp-users.js      # Lógica de usuarios WhatsApp
    └── webhook-test.js        # Testing de webhook
```

## ⚙️ Configuración

### URLs del Backend

Edita el archivo `js/config.js` para configurar las URLs de tu backend:

```javascript
const CONFIG = {
    BACKEND_URL: 'https://heavensy-api-backend.onrender.com',
    WEBHOOK_URL: 'https://heavensy-api-webhook.onrender.com',
    SOCKET_URL: 'https://heavensy-api-backend.onrender.com',
};
```

Para desarrollo local, descomenta las líneas:

```javascript
// BACKEND_URL: 'http://localhost:5001',
// WEBHOOK_URL: 'http://localhost:10000',
// SOCKET_URL: 'http://localhost:5001',
```

## 🎨 Paleta de Colores Heavensy

- **Primary**: `#00d4ff` (Turquesa brillante)
- **Secondary**: `#0099ff` (Azul cielo)
- **Gradient**: `linear-gradient(135deg, #00d4ff 0%, #0099ff 100%)`

## 📋 Funcionalidades Principales

### 1. Autenticación
- Login con email y password
- JWT token storage
- Logout automático al expirar sesión

### 2. Dashboard
- Estadísticas en tiempo real
- Conexión WebSocket
- Tabla de mensajes en vivo
- Indicador de estado de conexión

### 3. Empresas
- Crear nueva empresa
- Listar todas las empresas
- Ver detalles de empresa
- Editar información
- Desactivar empresa
- Configuración de WhatsApp
- Configuración del bot

### 4. Usuarios del Sistema
- Crear usuario (admin, operador, visualizador)
- Asignar roles
- Asignar a empresa
- Activar/desactivar usuarios

### 5. Usuarios de WhatsApp
- Ver todos los usuarios de WhatsApp
- Ver mensajes por usuario
- Bloquear/desbloquear usuarios
- Ver usuarios bloqueados

### 6. Webhook Testing
- Health check del webhook
- Verificación de token
- Simular mensajes de WhatsApp

## 🔧 Botón "Activar Backend"

Ubicado en el sidebar, este botón llama al endpoint `/health` del backend para:
- Despertar el backend si está dormido (Render free tier)
- Verificar que el servidor está respondiendo
- Preparar el sistema para recibir mensajes

## 🌐 Endpoints Implementados

### Autenticación
- `POST /auth/login` - Iniciar sesión
- `POST /auth/logout` - Cerrar sesión
- `POST /auth/refresh` - Renovar token

### Empresas
- `GET /companies` - Listar empresas
- `POST /companies` - Crear empresa
- `GET /companies/:id` - Ver empresa
- `PUT /companies/:id` - Actualizar empresa
- `DELETE /companies/:id` - Desactivar empresa
- `GET /companies/:id/stats` - Estadísticas

### Usuarios del Sistema
- `GET /users` - Listar usuarios
- `POST /users` - Crear usuario
- `GET /users/:id` - Ver usuario
- `PUT /users/:id` - Actualizar usuario
- `DELETE /users/:id` - Eliminar usuario

### Usuarios de WhatsApp
- `GET /whatsapp-users` - Listar usuarios
- `GET /whatsapp-users/:id` - Ver usuario
- `GET /whatsapp-users/:id/messages` - Ver mensajes
- `POST /whatsapp-users/:id/block` - Bloquear
- `POST /whatsapp-users/:id/unblock` - Desbloquear
- `GET /whatsapp-users/blocked` - Usuarios bloqueados

### Dashboard
- `GET /dashboard` - Estadísticas generales

### Multimedia
- `GET /media` - Listar multimedia
- `GET /media/stats` - Estadísticas de Cloudinary

### Configuración
- `GET /config` - Obtener configuración
- `PUT /config` - Actualizar configuración

### Webhook
- `GET /webhook/message` - Verificación
- `POST /webhook/message` - Recibir mensaje
- `GET /health` - Health check

## 🔒 Seguridad

- Todas las páginas protegidas verifican autenticación
- Tokens JWT almacenados en localStorage
- Headers de autorización en todas las requests
- Validación de formularios

## 📱 Responsive Design

El panel está completamente optimizado para:
- Desktop (>1200px)
- Tablet (768px - 1199px)
- Mobile (< 768px)

## 🎯 Próximas Mejoras

- [ ] Gráficos con Chart.js
- [ ] Exportación de datos
- [ ] Filtros avanzados
- [ ] Búsqueda en tiempo real
- [ ] Notificaciones push
- [ ] Modo oscuro
- [ ] Múltiples idiomas

## 📝 Notas Importantes

1. Este es un sitio de **demo** para desarrollo
2. Para producción, implementar en Angular como está planeado
3. El backend debe estar activo para todas las funcionalidades
4. Socket.IO requiere conexión WebSocket activa

## 🆘 Soporte

Para problemas o consultas:
- Revisa la consola del navegador (F12)
- Verifica que el backend esté activo
- Comprueba las URLs en `js/config.js`

---

Desarrollado con ❤️ para Heavensy
