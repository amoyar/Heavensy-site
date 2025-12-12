# ============================================
# ENDPOINTS PARA PANEL ADMIN - AGREGAR A backend_socketio.py
# Ubicación: Después de @app.route("/api/conversaciones/<numero>") 
# y ANTES de @app.errorhandler(404)
# ============================================

@app.route("/api/dashboard", methods=["GET"])
def get_dashboard_stats():
    """Obtiene estadísticas generales del dashboard."""
    try:
        client_local = MongoClient(MONGO_URI)
        db_local = client_local[DB_NAME]
        
        # Contar mensajes totales
        total_messages = db_local.chat.estimated_document_count()
        
        # Contar usuarios únicos de WhatsApp
        unique_users = len(db_local.chat.distinct("user_id"))
        
        # Contar empresas activas
        total_companies = db_local.companies.count_documents({"active": True})
        
        # Contar usuarios del sistema activos  
        total_system_users = db_local.users.count_documents({"status": "A"})
        
        # Mensajes de hoy
        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        messages_today = db_local.chat.count_documents({
            "timestamp": {"$gte": today_start.isoformat()}
        })
        
        stats = {
            "total_messages": total_messages,
            "unique_users": unique_users,
            "total_companies": total_companies,
            "total_system_users": total_system_users,
            "messages_today": messages_today
        }
        
        return jsonify({
            "ok": True,
            "stats": stats,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }), 200
        
    except Exception as e:
        log_error(f"❌ Error obteniendo dashboard stats: {e}")
        return jsonify({"ok": False, "error": str(e)}), 500


@app.route("/api/companies", methods=["GET"])
def get_all_companies():
    """Lista todas las empresas."""
    try:
        client_local = MongoClient(MONGO_URI)
        db_local = client_local[DB_NAME]
        
        companies = list(db_local.companies.find({}, {"_id": 0}))
        
        return jsonify({
            "ok": True,
            "total": len(companies),
            "companies": companies
        }), 200
        
    except Exception as e:
        log_error(f"❌ Error obteniendo empresas: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/companies/<company_id>", methods=["GET"])
def get_company_by_id(company_id):
    """Obtiene una empresa por ID."""
    try:
        client_local = MongoClient(MONGO_URI)
        db_local = client_local[DB_NAME]
        
        company = db_local.companies.find_one({"company_id": company_id}, {"_id": 0})
        
        if not company:
            return jsonify({"error": "Empresa no encontrada"}), 404
        
        return jsonify({
            "ok": True,
            "company": company
        }), 200
        
    except Exception as e:
        log_error(f"❌ Error obteniendo empresa: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/companies", methods=["POST"])
def create_company():
    """Crea una nueva empresa."""
    try:
        data = request.get_json()
        
        if not data or "company_id" not in data:
            return jsonify({"error": "company_id es requerido"}), 400
        
        client_local = MongoClient(MONGO_URI)
        db_local = client_local[DB_NAME]
        
        # Verificar que no exista
        if db_local.companies.find_one({"company_id": data["company_id"]}):
            return jsonify({"error": "Empresa ya existe"}), 409
        
        # Agregar timestamps
        data["created_at"] = datetime.now(timezone.utc).isoformat()
        data["updated_at"] = datetime.now(timezone.utc).isoformat()
        data["active"] = data.get("active", True)
        
        db_local.companies.insert_one(data)
        
        return jsonify({
            "ok": True,
            "message": "Empresa creada exitosamente",
            "company_id": data["company_id"]
        }), 201
        
    except Exception as e:
        log_error(f"❌ Error creando empresa: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/companies/<company_id>", methods=["PUT"])
def update_company(company_id):
    """Actualiza una empresa."""
    try:
        data = request.get_json()
        
        client_local = MongoClient(MONGO_URI)
        db_local = client_local[DB_NAME]
        
        # Agregar timestamp de actualización
        data["updated_at"] = datetime.now(timezone.utc).isoformat()
        
        result = db_local.companies.update_one(
            {"company_id": company_id},
            {"$set": data}
        )
        
        if result.matched_count == 0:
            return jsonify({"error": "Empresa no encontrada"}), 404
        
        return jsonify({
            "ok": True,
            "message": "Empresa actualizada exitosamente"
        }), 200
        
    except Exception as e:
        log_error(f"❌ Error actualizando empresa: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/companies/<company_id>", methods=["DELETE"])
def delete_company(company_id):
    """Elimina una empresa (soft delete)."""
    try:
        client_local = MongoClient(MONGO_URI)
        db_local = client_local[DB_NAME]
        
        result = db_local.companies.update_one(
            {"company_id": company_id},
            {"$set": {
                "active": False,
                "deleted_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        if result.matched_count == 0:
            return jsonify({"error": "Empresa no encontrada"}), 404
        
        return jsonify({
            "ok": True,
            "message": "Empresa desactivada exitosamente"
        }), 200
        
    except Exception as e:
        log_error(f"❌ Error eliminando empresa: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/users", methods=["GET"])
def get_all_users():
    """Lista todos los usuarios del sistema."""
    try:
        client_local = MongoClient(MONGO_URI)
        db_local = client_local[DB_NAME]
        
        users = list(db_local.users.find({}, {"_id": 0, "password": 0}))
        
        return jsonify({
            "ok": True,
            "total": len(users),
            "users": users
        }), 200
        
    except Exception as e:
        log_error(f"❌ Error obteniendo usuarios: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/users/<username>", methods=["GET"])
def get_user_by_username(username):
    """Obtiene un usuario por username."""
    try:
        client_local = MongoClient(MONGO_URI)
        db_local = client_local[DB_NAME]
        
        user = db_local.users.find_one({"username": username}, {"_id": 0, "password": 0})
        
        if not user:
            return jsonify({"error": "Usuario no encontrado"}), 404
        
        return jsonify({
            "ok": True,
            "user": user
        }), 200
        
    except Exception as e:
        log_error(f"❌ Error obteniendo usuario: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/users", methods=["POST"])
def create_user():
    """Crea un nuevo usuario."""
    try:
        data = request.get_json()
        
        if not data or "username" not in data or "password" not in data:
            return jsonify({"error": "username y password son requeridos"}), 400
        
        client_local = MongoClient(MONGO_URI)
        db_local = client_local[DB_NAME]
        
        # Verificar que no exista
        if db_local.users.find_one({"username": data["username"]}):
            return jsonify({"error": "Usuario ya existe"}), 409
        
        # Hashear password
        import bcrypt
        password_hash = bcrypt.hashpw(data["password"].encode('utf-8'), bcrypt.gensalt())
        
        user_doc = {
            "username": data["username"],
            "email": data.get("email", ""),
            "password": password_hash.decode('utf-8'),
            "first_name": data.get("first_name", ""),
            "last_name": data.get("last_name", ""),
            "full_name": f"{data.get('first_name', '')} {data.get('last_name', '')}".strip(),
            "phone": data.get("phone"),
            "companies": data.get("companies", []),
            "status": "A",
            "is_verified": True,
            "email_verified": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
            "login_attempts": 0,
            "locked_until": None
        }
        
        db_local.users.insert_one(user_doc)
        
        return jsonify({
            "ok": True,
            "message": "Usuario creado exitosamente",
            "username": data["username"]
        }), 201
        
    except Exception as e:
        log_error(f"❌ Error creando usuario: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/users/<username>", methods=["PUT"])
def update_user(username):
    """Actualiza un usuario."""
    try:
        data = request.get_json()
        
        client_local = MongoClient(MONGO_URI)
        db_local = client_local[DB_NAME]
        
        # Si hay password, hashearlo
        if "password" in data and data["password"]:
            import bcrypt
            data["password"] = bcrypt.hashpw(data["password"].encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        else:
            data.pop("password", None)  # No actualizar password si viene vacío
        
        data["updated_at"] = datetime.now(timezone.utc).isoformat()
        
        result = db_local.users.update_one(
            {"username": username},
            {"$set": data}
        )
        
        if result.matched_count == 0:
            return jsonify({"error": "Usuario no encontrado"}), 404
        
        return jsonify({
            "ok": True,
            "message": "Usuario actualizado exitosamente"
        }), 200
        
    except Exception as e:
        log_error(f"❌ Error actualizando usuario: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/users/<username>", methods=["DELETE"])
def delete_user(username):
    """Desactiva un usuario."""
    try:
        client_local = MongoClient(MONGO_URI)
        db_local = client_local[DB_NAME]
        
        result = db_local.users.update_one(
            {"username": username},
            {"$set": {
                "status": "I",
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        if result.matched_count == 0:
            return jsonify({"error": "Usuario no encontrado"}), 404
        
        return jsonify({
            "ok": True,
            "message": "Usuario desactivado exitosamente"
        }), 200
        
    except Exception as e:
        log_error(f"❌ Error desactivando usuario: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/whatsapp-users", methods=["GET"])
def get_whatsapp_users():
    """Lista usuarios de WhatsApp."""
    try:
        client_local = MongoClient(MONGO_URI)
        db_local = client_local[DB_NAME]
        
        users = []
        unique_phones = db_local.chat.distinct("user_id")
        
        for phone in unique_phones:
            last_msg = db_local.chat.find_one(
                {"user_id": phone},
                sort=[("timestamp", -1)]
            )
            
            if last_msg:
                users.append({
                    "user_id": phone,
                    "phone": phone,
                    "profile_name": last_msg.get("profile_name", "Unknown"),
                    "last_message": last_msg.get("text", ""),
                    "last_interaction": last_msg.get("timestamp"),
                    "message_count": db_local.chat.count_documents({"user_id": phone})
                })
        
        return jsonify({
            "ok": True,
            "total": len(users),
            "users": users
        }), 200
        
    except Exception as e:
        log_error(f"❌ Error obteniendo usuarios WhatsApp: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/whatsapp-users/<phone>", methods=["GET"])
def get_whatsapp_user(phone):
    """Obtiene detalles de un usuario de WhatsApp."""
    try:
        client_local = MongoClient(MONGO_URI)
        db_local = client_local[DB_NAME]
        
        messages = list(db_local.chat.find(
            {"user_id": phone},
            {"_id": 0}
        ).sort("timestamp", -1).limit(50))
        
        if not messages:
            return jsonify({"error": "Usuario no encontrado"}), 404
        
        return jsonify({
            "ok": True,
            "user_id": phone,
            "phone": phone,
            "profile_name": messages[0].get("profile_name", "Unknown"),
            "total_messages": len(messages),
            "messages": messages
        }), 200
        
    except Exception as e:
        log_error(f"❌ Error obteniendo usuario WhatsApp: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/conversations", methods=["GET"])
def get_all_conversations():
    """Lista todas las conversaciones."""
    try:
        client_local = MongoClient(MONGO_URI)
        db_local = client_local[DB_NAME]
        
        pipeline = [
            {"$sort": {"timestamp": -1}},
            {"$group": {
                "_id": "$user_id",
                "last_message": {"$first": "$text"},
                "last_timestamp": {"$first": "$timestamp"},
                "profile_name": {"$first": "$profile_name"},
                "message_count": {"$sum": 1}
            }},
            {"$sort": {"last_timestamp": -1}},
            {"$limit": 100}
        ]
        
        conversations = list(db_local.chat.aggregate(pipeline))
        
        result = []
        for conv in conversations:
            result.append({
                "user_id": conv["_id"],
                "phone": conv["_id"],
                "profile_name": conv.get("profile_name", "Unknown"),
                "last_message": conv.get("last_message", ""),
                "last_timestamp": conv.get("last_timestamp"),
                "message_count": conv.get("message_count", 0)
            })
        
        return jsonify({
            "ok": True,
            "total": len(result),
            "conversations": result
        }), 200
        
    except Exception as e:
        log_error(f"❌ Error obteniendo conversaciones: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/conversations/<phone>", methods=["GET"])
def get_conversation_detail(phone):
    """Obtiene detalle de una conversación."""
    try:
        client_local = MongoClient(MONGO_URI)
        db_local = client_local[DB_NAME]
        
        messages = list(db_local.chat.find(
            {"user_id": phone},
            {"_id": 0}
        ).sort("timestamp", 1))
        
        if not messages:
            return jsonify({"error": "Conversación no encontrada"}), 404
        
        return jsonify({
            "ok": True,
            "user_id": phone,
            "phone": phone,
            "profile_name": messages[0].get("profile_name", "Unknown"),
            "total_messages": len(messages),
            "messages": messages
        }), 200
        
    except Exception as e:
        log_error(f"❌ Error obteniendo conversación: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/media/stats", methods=["GET"])
def get_media_stats():
    """Estadísticas de multimedia."""
    try:
        client_local = MongoClient(MONGO_URI)
        db_local = client_local[DB_NAME]
        
        total_media = db_local.media_records.estimated_document_count()
        images = db_local.media_records.count_documents({"mime_type": {"$regex": "^image"}})
        videos = db_local.media_records.count_documents({"mime_type": {"$regex": "^video"}})
        audios = db_local.media_records.count_documents({"mime_type": {"$regex": "^audio"}})
        documents = db_local.media_records.count_documents({"mime_type": {"$regex": "application"}})
        
        return jsonify({
            "ok": True,
            "stats": {
                "total": total_media,
                "images": images,
                "videos": videos,
                "audios": audios,
                "documents": documents
            }
        }), 200
        
    except Exception as e:
        log_error(f"❌ Error obteniendo media stats: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/media", methods=["GET"])
def get_all_media():
    """Lista archivos multimedia."""
    try:
        client_local = MongoClient(MONGO_URI)
        db_local = client_local[DB_NAME]
        
        limit = int(request.args.get("limit", 50))
        limit = min(limit, 200)
        
        media_type = request.args.get("type")  # image, video, audio, document
        
        query = {}
        if media_type:
            if media_type == "image":
                query["mime_type"] = {"$regex": "^image"}
            elif media_type == "video":
                query["mime_type"] = {"$regex": "^video"}
            elif media_type == "audio":
                query["mime_type"] = {"$regex": "^audio"}
            elif media_type == "document":
                query["mime_type"] = {"$regex": "application"}
        
        media = list(db_local.media_records.find(query, {"_id": 0}).sort("created_at", -1).limit(limit))
        
        return jsonify({
            "ok": True,
            "total": len(media),
            "media": media
        }), 200
        
    except Exception as e:
        log_error(f"❌ Error obteniendo media: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/config", methods=["GET"])
def get_system_config():
    """Obtiene configuración del sistema."""
    try:
        config_data = {
            "database": DB_NAME,
            "socket_timeout": get_config("SOCKET_DEFAULT_TIMEOUT", 300),
            "ping_interval": get_config("SOCKETIO_PING_INTERVAL", 60),
            "ping_timeout": get_config("SOCKETIO_PING_TIMEOUT", 180),
            "rate_limit_window": RATE_LIMIT_WINDOW,
            "max_connections": MAX_CONNECTIONS_PER_WINDOW,
            "backend_version": "3.0",
            "features": {
                "socketio": True,
                "admin_system": True,
                "multi_tenant": True,
                "jwt_auth": True
            }
        }
        
        return jsonify({
            "ok": True,
            "config": config_data
        }), 200
        
    except Exception as e:
        log_error(f"❌ Error obteniendo config: {e}")
        return jsonify({"error": str(e)}), 500


# ============================================
# FIN DE ENDPOINTS PARA PANEL ADMIN
# ============================================
