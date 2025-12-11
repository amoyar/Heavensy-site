# 🔧 Solución: "Credenciales inválidas"

Si al intentar hacer login recibes el error **"Credenciales inválidas"**, significa que el usuario `admin` **NO existe en tu base de datos MongoDB**.

## 🎯 Solución Rápida

### Opción 1: Crear el usuario admin con Python

1. **Soluciona el conflicto bson/pymongo:**
```bash
pip uninstall -y bson pymongo
pip install pymongo bcrypt
```

2. **Ejecuta el script simple (recomendado):**
```bash
python crear_admin_simple.py
```

O si prefieres el script original:
```bash
python crear_admin.py
```

**Si ves error de ImportError con 'SON' from 'bson':**
Tienes instalado el paquete `bson` incorrecto. Desinstálalo:
```bash
pip uninstall -y bson
pip install --upgrade pymongo
```

3. **Verás este mensaje:**
```
✅ Usuario admin creado exitosamente!
📝 Credenciales de login:
   Usuario: admin
   Password: Admin123!
```

4. **Ahora haz login** en el panel con esas credenciales

---

### Opción 2: Crear manualmente en MongoDB

Si no puedes ejecutar Python, crea el usuario directamente en MongoDB Atlas:

1. Ve a https://cloud.mongodb.com
2. Conecta a tu cluster `LatticeCluster`
3. Base de datos: `heavensy_prod`
4. Colección: `system_users`
5. Haz clic en "Insert Document"
6. Copia y pega este JSON:

```json
{
  "username": "admin",
  "email": "admin@heavensy.com",
  "password_hash": "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5kosgc0q3W.8q",
  "first_name": "Super",
  "last_name": "Admin",
  "full_name": "Super Admin",
  "rut": "11111111-1",
  "phone": null,
  "companies": [
    {
      "company_id": "HEAVENSY_001",
      "roles": ["ADMIN_ROL"],
      "is_primary": true,
      "joined_at": { "$date": "2024-12-11T00:00:00.000Z" }
    }
  ],
  "is_active": true,
  "is_verified": true,
  "email_verified": true,
  "created_at": { "$date": "2024-12-11T00:00:00.000Z" },
  "updated_at": { "$date": "2024-12-11T00:00:00.000Z" },
  "last_login": null,
  "login_attempts": 0,
  "locked_until": null
}
```

**Nota:** El password_hash corresponde a `Admin123!`

---

### Opción 3: Crear la empresa HEAVENSY_001

El usuario admin necesita que exista la empresa `HEAVENSY_001`. Si no existe:

1. Ve a MongoDB Atlas
2. Base de datos: `heavensy_prod`
3. Colección: `companies`
4. Inserta:

```json
{
  "company_id": "HEAVENSY_001",
  "name": "Heavensy",
  "legal_name": "Heavensy SpA",
  "rut": "76999999-9",
  "description": "Sistema de gestión multi-empresa",
  "contact_email": "contacto@heavensy.com",
  "contact_phone": "+56912345678",
  "address": "Santiago, Chile",
  "website": "https://heavensy.com",
  "active": true,
  "created_at": { "$date": "2024-12-11T00:00:00.000Z" },
  "updated_at": { "$date": "2024-12-11T00:00:00.000Z" }
}
```

---

## 🔍 Verificar si el usuario existe

Puedes verificar en la consola del navegador (F12) los logs del login. Verás:

```
🔐 Intentando login en: https://heavensy-api-backend.onrender.com/api/auth/login
📤 Datos enviados: {username: "admin", password: "***"}
📥 Response status: 401
📥 Response data: {error: "Credenciales inválidas"}
```

Si ves `status: 401` con "Credenciales inválidas", el usuario NO existe o la contraseña es incorrecta.

---

## 📝 Después de crear el usuario

1. Asegúrate que el backend esté activo (botón "Activar Backend")
2. Espera 30-60 segundos
3. Haz login con:
   - Usuario: `admin`
   - Password: `Admin123!`

---

## ❓ Otras causas posibles

### 1. Backend no responde
- Verifica que el backend esté en https://heavensy-api-backend.onrender.com/api/health
- Debe responder: `{"status": "healthy"}`

### 2. CORS bloqueado
- Abre la consola (F12)
- Si ves errores de CORS, el backend necesita permitir tu origen

### 3. Colección incorrecta
- El backend busca en: `heavensy_prod.system_users`
- Verifica que el usuario esté en esa colección exacta

---

## 🆘 Soporte

Si ninguna solución funciona, verifica:

1. La URL del backend en `js/config.js`
2. Que MongoDB Atlas esté accesible
3. Que las credenciales de MongoDB sean correctas
4. Los logs del backend en Render
