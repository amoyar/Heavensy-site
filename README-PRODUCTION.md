# Heavensy Admin Panel - VERSIÓN PRODUCCIÓN

Esta es la versión de PRODUCCIÓN que se conecta directamente a tu backend real de Heavensy.

## 🔴 IMPORTANTE - BACKEND REQUERIDO

Esta versión **REQUIERE** que tu backend esté activo y funcionando:
- Backend: https://heavensy-api-backend.onrender.com
- Webhook: https://heavensy-api-webhook.onrender.com

## ⚙️ Configuración

La configuración está en `js/config.js`:

```javascript
const CONFIG = {
    DEMO_MODE: false,  // Backend real
    BACKEND_URL: 'https://heavensy-api-backend.onrender.com',
    WEBHOOK_URL: 'https://heavensy-api-webhook.onrender.com',
    SOCKET_URL: 'https://heavensy-api-backend.onrender.com',
};
```

### Para desarrollo local:

Cambia las URLs en `js/config.js`:

```javascript
BACKEND_URL: 'http://localhost:5001',
WEBHOOK_URL: 'http://localhost:10000',
SOCKET_URL: 'http://localhost:5001',
```

## 🚀 Cómo Usar

### 1. Activar el Backend

Si tu backend está en Render (free tier), probablemente esté dormido:

1. Abre `index.html` en tu navegador
2. Ve al menú lateral (sidebar)
3. Presiona el botón **"Activar Backend"**
4. Espera 30-60 segundos
5. Intenta hacer login

### 2. Hacer Login

Usa las credenciales reales de tu sistema:
- Email: El email configurado en tu backend
- Password: La contraseña configurada

Por ejemplo, si usas las credenciales por defecto de `config_global.py`:
- Email: `admin@heavensy.com`
- Password: `Admin123!`

### 3. Si el Backend No Responde

**Soluciones:**

1. **Presiona "Activar Backend"** en el sidebar
   - Esto llama a `/health` para despertar el backend
   
2. **Espera 30-60 segundos**
   - Render free tier tarda en despertar

3. **Verifica las URLs**
   - Abre `js/config.js`
   - Confirma que las URLs sean correctas

4. **Revisa la consola del navegador**
   - Presiona F12
   - Ve a la pestaña "Console"
   - Busca errores de CORS o conexión

5. **Verifica que el backend esté funcionando**
   - Abre directamente: https://heavensy-api-backend.onrender.com/health
   - Deberías ver una respuesta JSON

## 📋 Funcionalidades

Todas las funcionalidades están conectadas al backend real:

- ✅ **Autenticación JWT** - Login/Logout real
- ✅ **Dashboard en Tiempo Real** - WebSocket con Socket.IO
- ✅ **Gestión de Empresas** - CRUD completo
- ✅ **Usuarios del Sistema** - Crear, editar, eliminar
- ✅ **Usuarios WhatsApp** - Ver, bloquear, desbloquear
- ✅ **Conversaciones** - Historial real
- ✅ **Multimedia** - Archivos de Cloudinary
- ✅ **Webhook Testing** - Pruebas reales
- ✅ **Configuración** - Parámetros del sistema

## 🐛 Troubleshooting

### Error: "Failed to fetch"

**Causa:** El backend no está respondiendo

**Solución:**
1. Presiona "Activar Backend"
2. Espera 1 minuto
3. Recarga la página (F5)
4. Intenta login nuevamente

### Error: "timeout"

**Causa:** El backend tardó más de 10 segundos

**Solución:**
1. El backend está muy lento o caído
2. Verifica el estado en Render
3. Considera usar un plan pago para mejor performance

### Error: CORS

**Causa:** Configuración incorrecta en el backend

**Solución:**
1. Verifica que el backend permita tu dominio en CORS
2. Si estás en localhost, el backend debe permitir `localhost`

### No se ven los mensajes en tiempo real

**Causa:** WebSocket no conectó

**Solución:**
1. Revisa la consola del navegador (F12)
2. Verifica que Socket.IO esté configurado en el backend
3. Mira el indicador de conexión en el navbar (debe estar verde)

## 🔐 Credenciales

Las credenciales dependen de lo que hayas configurado en tu backend.

Valores por defecto de `backend/config_global.py`:
- Email: `admin@heavensy.com`
- Password: `Admin123!`

## 📝 Notas Importantes

1. **Esta versión NO funciona offline** - Requiere backend activo
2. **Render free tier duerme** - Debes despertar el backend regularmente
3. **WebSocket requiere conexión persistente** - Si el backend se duerme, reconecta
4. **JWT expira en 8 horas** - Tendrás que hacer login nuevamente

## 🆚 Diferencia con Versión Demo

| Característica | Versión Demo | Versión Producción |
|---------------|--------------|-------------------|
| Backend requerido | ❌ No | ✅ Sí |
| Datos reales | ❌ No | ✅ Sí |
| Login funcional | Simulado | Real con JWT |
| WebSocket | Simulado | Real con Socket.IO |
| CRUD operaciones | Simulado | Real con API |
| Offline | ✅ Funciona | ❌ No funciona |

---

**Para volver a la versión Demo:**
Edita `js/config.js` y cambia `DEMO_MODE: true`
