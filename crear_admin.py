#!/usr/bin/env python3
"""
Script para crear el usuario admin por defecto en MongoDB
Ejecuta este script si recibes "Credenciales inválidas" en el login
"""

from pymongo import MongoClient
from datetime import datetime
import bcrypt

# Configuración MongoDB (copia de config_global.py)
MONGO_URI = "mongodb+srv://admin_db:LatticeDB123@latticecluster.tlhnwps.mongodb.net/?retryWrites=true&w=majority&appName=LatticeCluster"
DB_NAME = "heavensy_prod"

# Datos del usuario admin
ADMIN_DATA = {
    "username": "admin",
    "email": "admin@heavensy.com",
    "password": "Admin123!",  # Se hasheará
    "first_name": "Super",
    "last_name": "Admin",
    "rut": "11111111-1",
    "company_id": "HEAVENSY_001",
    "role": "ADMIN_ROL"
}

def hash_password(password: str) -> str:
    """Hashea la contraseña usando bcrypt"""
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')

def create_admin_user():
    """Crea el usuario admin en MongoDB"""
    try:
        # Conectar a MongoDB
        print(f"🔌 Conectando a MongoDB...")
        client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=8000)
        db = client[DB_NAME]
        users_collection = db["system_users"]
        
        # Verificar si el usuario ya existe
        existing = users_collection.find_one({"username": ADMIN_DATA["username"]})
        
        if existing:
            print(f"⚠️  El usuario '{ADMIN_DATA['username']}' ya existe en la base de datos.")
            print(f"    Si olvidaste la contraseña, debes cambiarla manualmente en MongoDB.")
            return False
        
        # Hashear contraseña
        hashed_password = hash_password(ADMIN_DATA["password"])
        
        # Preparar documento
        admin_user = {
            "username": ADMIN_DATA["username"],
            "email": ADMIN_DATA["email"],
            "password_hash": hashed_password,
            "first_name": ADMIN_DATA["first_name"],
            "last_name": ADMIN_DATA["last_name"],
            "full_name": f"{ADMIN_DATA['first_name']} {ADMIN_DATA['last_name']}",
            "rut": ADMIN_DATA["rut"],
            "phone": None,
            "companies": [
                {
                    "company_id": ADMIN_DATA["company_id"],
                    "roles": [ADMIN_DATA["role"]],
                    "is_primary": True,
                    "joined_at": datetime.utcnow()
                }
            ],
            "is_active": True,
            "is_verified": True,
            "email_verified": True,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "last_login": None,
            "login_attempts": 0,
            "locked_until": None
        }
        
        # Insertar usuario
        result = users_collection.insert_one(admin_user)
        
        print(f"✅ Usuario admin creado exitosamente!")
        print(f"   ID: {result.inserted_id}")
        print(f"\n📝 Credenciales de login:")
        print(f"   Usuario: {ADMIN_DATA['username']}")
        print(f"   Password: {ADMIN_DATA['password']}")
        print(f"\n🌐 Ahora puedes hacer login en el panel de administración.")
        
        return True
        
    except Exception as e:
        print(f"❌ Error al crear usuario admin: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        if 'client' in locals():
            client.close()

if __name__ == "__main__":
    print("=" * 60)
    print("🚀 Heavensy - Crear Usuario Admin")
    print("=" * 60)
    print()
    
    create_admin_user()
    
    print()
    print("=" * 60)
