# 🚀 QUICK START - Heavensy Admin Panel

## ⚡ Inicio en 5 Minutos

### 1️⃣ Extraer el Proyecto
```bash
tar -xzf NuevoSite-Completo.tar.gz
cd NuevoSite
```

### 2️⃣ Configurar URL del Backend
Editar `assets/js/app.js` línea 2:
```javascript
const API_BASE_URL = 'http://localhost:5000';  // ← Cambia esto
```

### 3️⃣ Iniciar Servidor Local
```bash
# Opción 1: Python
python -m http.server 8080

# Opción 2: Node.js
npx http-server -p 8080

# Opción 3: PHP
php -S localhost:8080
```

### 4️⃣ Abrir en Navegador
```
http://localhost:8080
```

### 5️⃣ Login
- Usuario: (según tu backend)
- Contraseña: (según tu backend)

---

## 📂 Estructura Rápida

```
NuevoSite/
├── index.html          ← Página principal
├── login.html          ← Página de login
├── layout/             ← Componentes compartidos
│   ├── navbar.html
│   ├── sidebar.html
│   └── layout.js
├── pages/              ← Todas las páginas
│   ├── dashboard.html
│   ├── users.html
│   ├── companies.html
│   ├── roles.html
│   ├── monitor.html
│   ├── profile.html
│   └── ...
└── assets/
    ├── js/             ← Lógica JavaScript
    └── css/            ← Estilos
```

---

## 🎯 Páginas Disponibles

| URL | Página | Estado |
|-----|--------|--------|
| `#dashboard` | Dashboard | ✅ Funcional |
| `#users` | Usuarios | ✅ Funcional |
| `#companies` | Empresas | ✅ Funcional |
| `#roles` | Roles | ✅ Funcional |
| `#monitor` | Monitor Real-time | ✅ Funcional |
| `#profile` | Mi Perfil | ✅ Funcional |
| `#conversations` | Conversaciones | 🔄 Placeholder |
| `#logs` | Logs | 🔄 Placeholder |
| `#settings` | Configuración | 🔄 Placeholder |

---

## 🔧 Configuración Inicial

### Backend URL
```javascript
// assets/js/app.js
const API_BASE_URL = 'http://tu-backend.com';
```

### Verificar Conexión
1. Abrir navegador
2. Ir a `http://localhost:8080`
3. Abrir DevTools (F12)
4. Ver pestaña "Console"
5. Debería ver: "✅ App iniciada"

---

## 🐛 Solución de Problemas

### Problema: "No se puede cargar la página"
**Solución:** Verificar que el servidor HTTP está corriendo
```bash
# Verificar puertos en uso
netstat -an | grep 8080
```

### Problema: "Error de conexión API"
**Solución:** Verificar `API_BASE_URL` y que el backend esté corriendo
```bash
# Probar backend
curl http://localhost:5000/api/health
```

### Problema: "Token inválido"
**Solución:** Hacer logout y login nuevamente
```javascript
// En consola del navegador
localStorage.clear();
location.reload();
```

---

## 📝 Primeros Pasos Recomendados

### Día 1: Familiarización
1. ✅ Explorar todas las páginas
2. ✅ Probar crear un usuario
3. ✅ Probar crear una empresa
4. ✅ Ver el Monitor en tiempo real
5. ✅ Actualizar tu perfil

### Día 2: Personalización
1. ✅ Cambiar colores en `assets/css/theme.css`
2. ✅ Actualizar logo en `assets/img/`
3. ✅ Probar todas las funcionalidades CRUD

### Día 3: Desarrollo
1. ✅ Leer `README.md` completo
2. ✅ Leer `ARQUITECTURA.md`
3. ✅ Intentar agregar una página simple
4. ✅ Explorar el código fuente

---

## 🎓 Recursos de Aprendizaje

### Documentación Incluida
- `README.md` - Guía completa del proyecto
- `MIGRACION.md` - Detalles técnicos de la migración
- `ARQUITECTURA.md` - Diagramas y explicaciones
- `RESUMEN.md` - Resumen ejecutivo

### Rutas Importantes
- Código base: `assets/js/app.js`
- Router: `assets/js/router.js`
- Páginas: `pages/*.html`
- Lógica: `assets/js/*.js`

---

## 💡 Tips Útiles

### Debugging
```javascript
// Ver estado actual
console.log('Token:', localStorage.getItem('token'));
console.log('User:', localStorage.getItem('user'));

// Limpiar todo
localStorage.clear();
```

### Recargar Componentes
```javascript
// Recargar sidebar
loadComponent('sidebar', './layout/sidebar.html');

// Recargar navbar
loadComponent('navbar', './layout/navbar.html');
```

### API Testing
```javascript
// Probar API desde consola
const response = await apiCall('/api/users');
console.log(response);
```

---

## 🎯 Checklist de Verificación

Antes de ir a producción, verificar:

- [ ] `API_BASE_URL` configurado correctamente
- [ ] Backend funcionando y accesible
- [ ] CORS configurado en backend
- [ ] Login funciona
- [ ] CRUD de usuarios funciona
- [ ] CRUD de empresas funciona
- [ ] Monitor conecta correctamente
- [ ] Profile se actualiza correctamente
- [ ] Logo personalizado (opcional)
- [ ] Colores personalizados (opcional)

---

## 📞 Ayuda Adicional

### Si algo no funciona:
1. Revisar consola del navegador (F12)
2. Verificar Network tab para ver requests fallidos
3. Verificar que el backend está corriendo
4. Consultar la documentación en `README.md`

### Estructura de archivos críticos:
```
SI MODIFICAS:           AFECTA A:
─────────────────────────────────────
layout/sidebar.html  →  Toda la navegación
layout/navbar.html   →  Todo el header
assets/js/app.js     →  Toda la app
assets/js/router.js  →  Toda la navegación
```

---

## 🎉 ¡Listo para Empezar!

Tu panel de administración está completamente funcional y listo para usar.

**Próximo paso:** Abre `http://localhost:8080` y comienza a explorar.

---

**Nota:** Si encuentras algún problema, revisa primero:
1. Consola del navegador (F12)
2. `README.md` para documentación detallada
3. `ARQUITECTURA.md` para entender el flujo

¡Éxito! 🚀
