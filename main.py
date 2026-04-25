import os
import sqlite3
import jwt
import secrets
import re
import hashlib
from datetime import datetime, timedelta
from typing import Optional, Dict
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Depends, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
import uvicorn

# ============= CONFIGURACION =============
DATABASE_PATH = "gooseline.db"
SECRET_KEY = secrets.token_urlsafe(32)
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 7 * 24 * 60
UPLOAD_DIR = "uploads"

os.makedirs(UPLOAD_DIR, exist_ok=True)

# ============= MODELOS =============
class RegisterRequest(BaseModel):
    username: str
    password: str
    goose_id: str

class LoginRequest(BaseModel):
    username: str
    password: str
    goose_id: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: Dict

# ============= FUNCIONES DE SEGURIDAD =============
def hash_password(password: str) -> str:
    """Hashea una contraseña usando SHA256"""
    salt = secrets.token_hex(16)
    hashed = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt.encode('utf-8'), 100000)
    return f"{salt}${hashed.hex()}"

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifica una contraseña"""
    try:
        salt, hashed = hashed_password.split('$')
        new_hash = hashlib.pbkdf2_hmac('sha256', plain_password.encode('utf-8'), salt.encode('utf-8'), 100000)
        return new_hash.hex() == hashed
    except Exception as e:
        print(f"Error verificando contraseña: {e}")
        return False

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Crea un JWT token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_token(token: str) -> Dict:
    """Verifica un JWT token"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.InvalidTokenError as e:
        print(f"Error verificando token: {e}")
        raise HTTPException(status_code=401, detail="Token invalido")

def get_current_user(token: Optional[str] = None) -> Dict:
    """Obtiene el usuario actual del token"""
    if not token:
        raise HTTPException(status_code=401, detail="Token no proporcionado")
    
    payload = verify_token(token)
    goose_id = payload.get("goose_id")
    
    if not goose_id:
        raise HTTPException(status_code=401, detail="Token invalido")
    
    return {"goose_id": goose_id}

def is_valid_goose_id(goose_id: str) -> bool:
    """Valida el formato del Goose-ID"""
    if not goose_id:
        return False
    pattern = r'^GOOSE-\d{4}-[A-Z]{3}$'
    return bool(re.match(pattern, goose_id.upper())) and len(goose_id) == 14

# ============= BASE DE DATOS =============
def init_db():
    """Inicializa la base de datos"""
    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            goose_id TEXT UNIQUE NOT NULL,
            nickname TEXT NOT NULL,
            avatar TEXT DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sender_goose_id TEXT NOT NULL,
            receiver_goose_id TEXT NOT NULL,
            text TEXT NOT NULL,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS contacts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_goose_id TEXT NOT NULL,
            contact_goose_id TEXT NOT NULL,
            contact_nickname TEXT,
            added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_goose_id, contact_goose_id)
        )
    ''')
    
    conn.commit()
    
    cursor.execute("SELECT * FROM users WHERE goose_id = ?", ("GOOSE-2009-BOT",))
    if not cursor.fetchone():
        goosebot_password = hash_password("goosebot123")
        cursor.execute('''
            INSERT INTO users (username, password, goose_id, nickname, avatar)
            VALUES (?, ?, ?, ?, ?)
        ''', ("Goosebot", goosebot_password, "GOOSE-2009-BOT", "Goosebot", "Gooseline-profile.png"))
        conn.commit()
        print("Goosebot agregado a la base de datos")
    
    conn.close()
    print("Base de datos inicializada correctamente")

def get_db():
    """Obtiene conexion a la base de datos"""
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    return conn

# ============= APLICACION FASTAPI =============
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Inicializa la app"""
    init_db()
    yield

app = FastAPI(title="Gooseline API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============= RUTAS ESTATICAS =============
@app.get("/")
async def serve_index():
    """Servir la pagina principal"""
    return FileResponse("index.html", media_type="text/html")

@app.get("/index.html")
async def serve_index_html():
    return FileResponse("index.html", media_type="text/html")

@app.get("/index-styles.css")
async def serve_css():
    return FileResponse("index-styles.css", media_type="text/css")

@app.get("/index-script.js")
async def serve_js():
    return FileResponse("index-script.js", media_type="text/javascript")

@app.get("/{filename}")
async def serve_static(filename: str):
    """Servir archivos estaticos"""
    if filename in ["index.html", "index-styles.css", "index-script.js"]:
        return
    
    if os.path.exists(filename):
        return FileResponse(filename)
    
    raise HTTPException(status_code=404, detail="Archivo no encontrado")

if os.path.exists("uploads"):
    app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# ============= RUTAS DE SALUD =============
@app.get("/api/health")
def health_check():
    return {"status": "healthy"}

# ============= RUTAS DE AUTENTICACION =============
@app.post("/api/register")
def register(request: RegisterRequest, conn: sqlite3.Connection = Depends(get_db)):
    """Registra un nuevo usuario"""
    
    print(f"Registrando usuario: {request.username} con Goose-ID: {request.goose_id}")
    
    try:
        if not is_valid_goose_id(request.goose_id):
            print(f"Goose-ID invalido: {request.goose_id}")
            raise HTTPException(status_code=400, detail="Formato de Goose-ID invalido")
        
        if not request.username or len(request.username) < 3:
            raise HTTPException(status_code=400, detail="Username debe tener al menos 3 caracteres")
        
        if not request.password or len(request.password) < 4:
            raise HTTPException(status_code=400, detail="Password debe tener al menos 4 caracteres")
        
        cursor = conn.cursor()
        
        cursor.execute("SELECT * FROM users WHERE username = ?", (request.username,))
        if cursor.fetchone():
            print(f"Usuario ya existe: {request.username}")
            raise HTTPException(status_code=400, detail="Usuario ya existe")
        
        cursor.execute("SELECT * FROM users WHERE goose_id = ?", (request.goose_id.upper(),))
        if cursor.fetchone():
            print(f"Goose-ID ya registrado: {request.goose_id}")
            raise HTTPException(status_code=400, detail="Goose-ID ya esta registrado")
        
        hashed_password = hash_password(request.password)
        print(f"Hash generado correctamente para {request.username}")
        
        cursor.execute('''
            INSERT INTO users (username, password, goose_id, nickname)
            VALUES (?, ?, ?, ?)
        ''', (request.username, hashed_password, request.goose_id.upper(), request.username))
        
        conn.commit()
        print(f"Usuario registrado exitosamente: {request.username}")
        
        return {"message": "Usuario registrado correctamente"}
        
    except HTTPException as e:
        conn.close()
        raise e
    except Exception as e:
        conn.close()
        print(f"Error en registro: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error al registrar: {str(e)}")

@app.post("/api/login", response_model=TokenResponse)
def login(request: LoginRequest, conn: sqlite3.Connection = Depends(get_db)):
    """Login de usuario"""
    
    print(f"Login intento: {request.username} con Goose-ID: {request.goose_id}")
    
    try:
        cursor = conn.cursor()
        
        cursor.execute(
            "SELECT * FROM users WHERE username = ? AND goose_id = ?",
            (request.username, request.goose_id.upper())
        )
        user = cursor.fetchone()
        
        if not user:
            print(f"Usuario no encontrado: {request.username}")
            raise HTTPException(status_code=401, detail="Credenciales invalidas")
        
        if not verify_password(request.password, user['password']):
            print(f"Contraseña incorrecta para: {request.username}")
            raise HTTPException(status_code=401, detail="Credenciales invalidas")
        
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"goose_id": user['goose_id']},
            expires_delta=access_token_expires
        )
        
        print(f"Login exitoso para: {request.username}")
        
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "username": user['username'],
                "goose_id": user['goose_id'],
                "nickname": user['nickname'],
                "avatar": user['avatar']
            }
        }
        
    except HTTPException as e:
        conn.close()
        raise e
    except Exception as e:
        conn.close()
        print(f"Error en login: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error en login: {str(e)}")

# ============= RUTAS DE PERFIL =============
@app.get("/api/user/profile")
def get_profile(token: str, conn: sqlite3.Connection = Depends(get_db)):
    """Obtiene el perfil del usuario"""
    
    try:
        current_user = get_current_user(token)
        cursor = conn.cursor()
        
        cursor.execute(
            "SELECT username, goose_id, nickname, avatar FROM users WHERE goose_id = ?",
            (current_user['goose_id'],)
        )
        user = cursor.fetchone()
        
        if not user:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")
        
        return {
            "username": user['username'],
            "goose_id": user['goose_id'],
            "nickname": user['nickname'],
            "avatar": user['avatar']
        }
        
    except HTTPException as e:
        conn.close()
        raise e
    except Exception as e:
        conn.close()
        print(f"Error obteniendo perfil: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

@app.post("/api/user/profile/avatar")
async def upload_avatar(token: str, file: UploadFile = File(...)):
    """Sube la foto de perfil"""
    
    print("===== INICIANDO UPLOAD DE AVATAR =====")
    
    conn = None
    try:
        print(f"Token recibido: {token[:20]}...")
        
        current_user = get_current_user(token)
        print(f"Usuario: {current_user['goose_id']}")
        
        if not file.content_type.startswith('image/'):
            print(f"Tipo de archivo invalido: {file.content_type}")
            raise HTTPException(status_code=400, detail="El archivo debe ser una imagen")
        
        print(f"Tipo de archivo: {file.content_type}")
        
        if not os.path.exists(UPLOAD_DIR):
            os.makedirs(UPLOAD_DIR, exist_ok=True)
            print(f"Carpeta creada: {UPLOAD_DIR}")
        else:
            print(f"Carpeta existe: {UPLOAD_DIR}")
        
        filename = f"{current_user['goose_id']}.png"
        filepath = os.path.join(UPLOAD_DIR, filename)
        
        print(f"Ruta del archivo: {filepath}")
        
        contents = await file.read()
        print(f"Bytes leidos: {len(contents)}")
        
        with open(filepath, 'wb') as f:
            bytes_written = f.write(contents)
            print(f"Bytes escritos: {bytes_written}")
        
        print(f"Archivo guardado: {filepath}")
        
        conn = get_db()
        cursor = conn.cursor()
        
        avatar_path = f"/uploads/{filename}"
        print(f"Avatar path a guardar: {avatar_path}")
        
        cursor.execute(
            "UPDATE users SET avatar = ? WHERE goose_id = ?",
            (avatar_path, current_user['goose_id'])
        )
        conn.commit()
        
        print(f"Avatar actualizado en BD: {current_user['goose_id']}")
        print("===== UPLOAD COMPLETADO EXITOSAMENTE =====")
        
        return {"message": "Avatar actualizado", "avatar": avatar_path}
        
    except HTTPException as e:
        if conn:
            conn.close()
        print(f"HTTPException: {e.detail}")
        raise e
    except Exception as e:
        if conn:
            conn.close()
        print(f"ERROR GENERAL: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

@app.get("/api/user/contacts")
def get_contacts(token: str, conn: sqlite3.Connection = Depends(get_db)):
    """Obtiene los contactos del usuario"""
    
    try:
        current_user = get_current_user(token)
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT u.username, u.goose_id, u.nickname, u.avatar, c.contact_nickname
            FROM contacts c
            JOIN users u ON c.contact_goose_id = u.goose_id
            WHERE c.user_goose_id = ?
        ''', (current_user['goose_id'],))
        
        contacts = []
        for row in cursor.fetchall():
            contacts.append({
                "username": row['username'],
                "goose_id": row['goose_id'],
                "nickname": row['contact_nickname'] or row['nickname'],
                "avatar": row['avatar'],
                "isBot": row['goose_id'] == 'GOOSE-2009-BOT'
            })
        
        return contacts
        
    except HTTPException as e:
        conn.close()
        raise e
    except Exception as e:
        conn.close()
        print(f"Error obteniendo contactos: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

@app.post("/api/user/contacts/add")
def add_contact(token: str, request: dict, conn: sqlite3.Connection = Depends(get_db)):
    """Anade un contacto"""
    
    try:
        current_user = get_current_user(token)
        contact_goose_id = request.get('goose_id', '').upper()
        contact_nickname = request.get('nickname', '')
        
        cursor = conn.cursor()
        
        cursor.execute("SELECT * FROM users WHERE goose_id = ?", (contact_goose_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Goose-ID no encontrado")
        
        if contact_goose_id == current_user['goose_id']:
            raise HTTPException(status_code=400, detail="No puedes anadirte a ti mismo")
        
        cursor.execute(
            "SELECT * FROM contacts WHERE user_goose_id = ? AND contact_goose_id = ?",
            (current_user['goose_id'], contact_goose_id)
        )
        if cursor.fetchone():
            raise HTTPException(status_code=400, detail="El contacto ya existe")
        
        cursor.execute('''
            INSERT INTO contacts (user_goose_id, contact_goose_id, contact_nickname)
            VALUES (?, ?, ?)
        ''', (current_user['goose_id'], contact_goose_id, contact_nickname))
        
        conn.commit()
        print(f"Contacto anadido: {current_user['goose_id']} -> {contact_goose_id}")
        
        return {"message": "Contacto anadido"}
        
    except HTTPException as e:
        conn.close()
        raise e
    except Exception as e:
        conn.close()
        print(f"Error anadiendo contacto: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

# ============= RUTAS DE MENSAJES =============
@app.get("/api/messages/{contact_goose_id}")
def get_messages(contact_goose_id: str, token: str, conn: sqlite3.Connection = Depends(get_db)):
    """Obtiene el historial de mensajes"""
    
    try:
        current_user = get_current_user(token)
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT sender_goose_id, text, timestamp
            FROM messages
            WHERE (sender_goose_id = ? AND receiver_goose_id = ?)
               OR (sender_goose_id = ? AND receiver_goose_id = ?)
            ORDER BY timestamp ASC
        ''', (current_user['goose_id'], contact_goose_id, contact_goose_id, current_user['goose_id']))
        
        messages = []
        for row in cursor.fetchall():
            try:
                time_part = row['timestamp'].split(' ')[1][:5]
            except:
                time_part = "00:00"
            
            messages.append({
                "text": row['text'],
                "time": time_part,
                "isOwn": row['sender_goose_id'] == current_user['goose_id']
            })
        
        return messages
        
    except HTTPException as e:
        conn.close()
        raise e
    except Exception as e:
        conn.close()
        print(f"Error obteniendo mensajes: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

# ============= WEBSOCKETS =============
class ConnectionManager:
    def __init__(self):
        self.active_connections = {}
    
    async def connect(self, goose_id: str, websocket: WebSocket):
        await websocket.accept()
        if goose_id not in self.active_connections:
            self.active_connections[goose_id] = []
        self.active_connections[goose_id].append(websocket)
        print(f"Conectado: {goose_id}")
    
    def disconnect(self, goose_id: str, websocket: WebSocket):
        if goose_id in self.active_connections:
            self.active_connections[goose_id].remove(websocket)
            if not self.active_connections[goose_id]:
                del self.active_connections[goose_id]
            print(f"Desconectado: {goose_id}")
    
    async def broadcast_to_user(self, goose_id: str, message: dict):
        if goose_id in self.active_connections:
            for connection in self.active_connections[goose_id]:
                try:
                    await connection.send_json(message)
                except Exception as e:
                    print(f"Error enviando mensaje: {e}")

manager = ConnectionManager()

@app.websocket("/ws/{goose_id}")
async def websocket_endpoint(goose_id: str, websocket: WebSocket):
    """WebSocket para mensajes en tiempo real"""
    
    await manager.connect(goose_id, websocket)
    
    try:
        while True:
            data = await websocket.receive_json()
            
            if data.get('type') == 'message':
                conn = get_db()
                cursor = conn.cursor()
                
                cursor.execute('''
                    INSERT INTO messages (sender_goose_id, receiver_goose_id, text)
                    VALUES (?, ?, ?)
                ''', (goose_id, data['receiver_goose_id'], data['text']))
                
                conn.commit()
                conn.close()
                
                message_data = {
                    "type": "message",
                    "sender": goose_id,
                    "text": data['text'],
                    "time": datetime.now().strftime("%H:%M")
                }
                
                await manager.broadcast_to_user(data['receiver_goose_id'], message_data)
                print(f"Mensaje: {goose_id} -> {data['receiver_goose_id']}")
    
    except WebSocketDisconnect:
        manager.disconnect(goose_id, websocket)

# ============= INICIO =============
if __name__ == "__main__":
    print("Iniciando Gooseline API...")
    print(f"Base de datos: {DATABASE_PATH}")
    print(f"Carpeta de uploads: {UPLOAD_DIR}")
    print("Accede a http://localhost:8000")
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")