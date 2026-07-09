from fastapi import FastAPI, Depends, HTTPException, status, Header
from sqlalchemy.orm import Session
from typing import List
import json
import redis
import hashlib
import uuid

from database import engine, Base, get_db
from models import Lead, LeadCreate, LeadResponse, Usuario, UserLogin, TokenResponse
from queue_manager import queue_manager
from config import settings

app = FastAPI(
    title="INSECOM CRM Backend API",
    description="Core backend for managing commercial leads and projects of INSECOM S.A.",
    version="1.0.0"
)

# --- Password Hashing Helpers ---
def generate_salt() -> str:
    return uuid.uuid4().hex

def hash_password(password: str, salt: str) -> str:
    # Use SHA-256 with salt for robust password hashing
    password_salted = password + salt
    return hashlib.sha256(password_salted.encode('utf-8')).hexdigest()

def verify_password(password: str, salt: str, hashed: str) -> bool:
    return hash_password(password, salt) == hashed

# --- Token Verification Dependency ---
def verify_token(authorization: str = Header(None)) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Se requiere token de autenticación válido (Bearer token)"
        )
    token = authorization.split(" ")[1]
    if not token.startswith("token-"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido o expirado"
        )
    username = token.replace("token-", "")
    return username

# Initialize database tables and seed default user on startup
@app.on_event("startup")
def startup_event():
    import time
    from database import SessionLocal
    from sqlalchemy import text
    
    print("Connecting to MySQL Database...")
    db_connected = False
    # Retry up to 15 times (30 seconds) to wait for MySQL initialization
    for i in range(15):
        try:
            with engine.connect() as connection:
                connection.execute(text("SELECT 1"))
            db_connected = True
            print("Successfully connected to MySQL Database.")
            break
        except Exception as e:
            print(f"Database not ready yet (Attempt {i+1}/15). Retrying in 2 seconds... Error: {e}")
            time.sleep(2)
            
    if not db_connected:
        print("CRITICAL ERROR: Could not connect to MySQL database on startup.")
        # We don't crash the server here, let SQLalchemy fail on request or raise error
    
    print("Initializing Database tables...")
    Base.metadata.create_all(bind=engine)
    print("Database tables initialized successfully.")
    
    # Seed default user: admin / admin123
    db = SessionLocal()
    try:
        user_count = db.query(Usuario).count()
        if user_count == 0:
            print("Seeding default user...")
            salt = generate_salt()
            hashed_pw = hash_password("admin123", salt)
            default_user = Usuario(
                username="admin",
                hashed_password=hashed_pw,
                salt=salt
            )
            db.add(default_user)
            db.commit()
            print("Default user (admin / admin123) created successfully.")
        else:
            print(f"Database already seeded with {user_count} users.")
    except Exception as e:
        print(f"Error seeding user: {e}")
    finally:
        db.close()

# Redis client connection
def get_redis():
    try:
        r = redis.Redis(
            host=settings.REDIS_HOST,
            port=settings.REDIS_PORT,
            decode_responses=True
        )
        return r
    except Exception as e:
        print(f"Failed to connect to Redis: {e}")
        return None

# Healthcheck Endpoint
@app.get("/api/v1/health")
def healthcheck():
    return {"status": "healthy", "environment": settings.ENVIRONMENT}

# POST: Authenticate user (Login)
@app.post("/api/v1/auth/login", response_model=TokenResponse)
def login(login_data: UserLogin, db: Session = Depends(get_db)):
    user = db.query(Usuario).filter(Usuario.username == login_data.username).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario o contraseña incorrectos"
        )
        
    if not verify_password(login_data.password, user.salt, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario o contraseña incorrectos"
        )
        
    # Return mock token containing username
    token = f"token-{user.username}"
    return {
        "access_token": token,
        "token_type": "bearer",
        "username": user.username
    }

# POST: Create a new Lead (Protected)
@app.post("/api/v1/leads", response_model=LeadResponse, status_code=status.HTTP_201_CREATED)
def create_lead(
    lead_create: LeadCreate, 
    db: Session = Depends(get_db),
    username: str = Depends(verify_token)
):
    # 1. Persist in MySQL Database
    db_lead = Lead(
        nombre=lead_create.nombre,
        email=lead_create.email,
        telefono=lead_create.telefono,
        proyecto=lead_create.proyecto,
        requerimientos=lead_create.requerimientos,
        detalles=lead_create.detalles,
        estado=lead_create.estado,
        fecha_cita=lead_create.fecha_cita
    )
    db.add(db_lead)
    db.commit()
    db.refresh(db_lead)

    # 2. Format event payload
    event_data = {
        "id": db_lead.id,
        "nombre": db_lead.nombre,
        "email": db_lead.email,
        "proyecto": db_lead.proyecto,
        "requerimientos": db_lead.requerimientos,
        "estado": db_lead.estado,
        "fecha_cita": db_lead.fecha_cita,
        "action": "created"
    }

    # 3. Publish event to Queue (RabbitMQ or Azure Service Bus)
    try:
        queue_manager.publish_lead_event(event_data)
    except Exception as e:
        print(f"[WARNING] Event publishing failed: {e}")

    return db_lead

# GET: Fetch all Leads from MySQL (Protected)
@app.get("/api/v1/leads", response_model=List[LeadResponse])
def get_leads(
    db: Session = Depends(get_db),
    username: str = Depends(verify_token)
):
    leads = db.query(Lead).order_by(Lead.id.desc()).all()
    return leads

# PUT: Update an existing Lead (Protected)
@app.put("/api/v1/leads/{lead_id}", response_model=LeadResponse)
def update_lead(
    lead_id: int,
    lead_update: LeadCreate,
    db: Session = Depends(get_db),
    username: str = Depends(verify_token)
):
    db_lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not db_lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lead no encontrado"
        )
    
    db_lead.nombre = lead_update.nombre
    db_lead.email = lead_update.email
    db_lead.telefono = lead_update.telefono
    db_lead.proyecto = lead_update.proyecto
    db_lead.requerimientos = lead_update.requerimientos
    db_lead.detalles = lead_update.detalles
    db_lead.estado = lead_update.estado
    db_lead.fecha_cita = lead_update.fecha_cita
    
    db.commit()
    db.refresh(db_lead)
    
    # Format and publish event to queue
    event_data = {
        "id": db_lead.id,
        "nombre": db_lead.nombre,
        "email": db_lead.email,
        "proyecto": db_lead.proyecto,
        "requerimientos": db_lead.requerimientos,
        "estado": db_lead.estado,
        "fecha_cita": db_lead.fecha_cita,
        "action": "updated"
    }
    try:
        queue_manager.publish_lead_event(event_data)
    except Exception as e:
        print(f"[WARNING] Event publishing failed on update: {e}")
        
    return db_lead

# DELETE: Remove a Lead (Protected)
@app.delete("/api/v1/leads/{lead_id}", status_code=status.HTTP_200_OK)
def delete_lead(
    lead_id: int,
    db: Session = Depends(get_db),
    username: str = Depends(verify_token)
):
    db_lead = db.query(Lead).filter(Lead.id == lead_id).first()
    if not db_lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lead no encontrado"
        )
    
    db.delete(db_lead)
    db.commit()
    
    # Publish delete event to queue
    event_data = {
        "id": lead_id,
        "action": "deleted"
    }
    try:
        queue_manager.publish_lead_event(event_data)
    except Exception as e:
        print(f"[WARNING] Event publishing failed on delete: {e}")
        
    return {"message": "Lead eliminado exitosamente", "id": lead_id}

# GET: Fetch processed notifications from Redis Cache (Protected)
@app.get("/api/v1/leads/notifications")
def get_notifications(
    redis_client = Depends(get_redis),
    username: str = Depends(verify_token)
):
    if redis_client is None:
        return []
    
    try:
        # Retrieve all notifications from Redis List
        logs = redis_client.lrange("leads_notifications_list", 0, -1)
        parsed_logs = []
        for log in logs:
            try:
                parsed_logs.append(json.loads(log))
            except Exception:
                continue
        return parsed_logs
    except Exception as e:
        print(f"Error reading from Redis: {e}")
        return []

# DELETE: Clear all notifications from Redis Cache (Protected)
@app.delete("/api/v1/leads/notifications")
def delete_notifications(
    redis_client = Depends(get_redis),
    username: str = Depends(verify_token)
):
    if redis_client is None:
        raise HTTPException(
            status_code=500,
            detail="Redis connection not available"
        )
    try:
        redis_client.delete("leads_notifications_list")
        return {"message": "Historial de alertas limpiado exitosamente"}
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error clearing cache: {e}"
        )
