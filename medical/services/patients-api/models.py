from sqlalchemy import Column, Integer, String, Text, DateTime
from sqlalchemy.sql import func
from database import Base
from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional

# --- SQLAlchemy Database Models ---
class Paciente(Base):
    __tablename__ = "pacientes"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(100), nullable=False)
    email = Column(String(200), nullable=False)  # Supports multiple comma-separated emails
    telefono = Column(String(150), nullable=False)  # Supports multiple comma-separated phones
    diagnostico = Column(String(300), nullable=False)  # Primary clinical diagnosis / chief complaint
    tipo_examen = Column(String(200), nullable=False)  # Type of medical lab exam requested
    detalles = Column(String(500), nullable=True)  # Clinical notes and evolution notes
    estado = Column(String(50), default="Estable", nullable=False) # Patient status (Estable, Observación, Crítico)
    fecha_cita = Column(String(100), nullable=True) # Next appointment / clinical control date
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Usuario(Base):
    __tablename__ = "usuarios"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    hashed_password = Column(String(128), nullable=False)
    salt = Column(String(32), nullable=False)
    role = Column(String(50), default="doctor", nullable=False)  # User role (admin / doctor)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

# --- Pydantic Schemas for Validation ---
class UserLogin(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    username: str
    role: str

class PacienteCreate(BaseModel):
    nombre: str
    email: str  # Supports multiple comma-separated emails
    telefono: str
    diagnostico: str
    tipo_examen: str
    detalles: Optional[str] = None  # Optional clinical details
    estado: str = "Estable" # Patient status field (default: Estable)
    fecha_cita: Optional[str] = None # Next scheduled control date

class PacienteResponse(BaseModel):
    id: int
    nombre: str
    email: str  
    telefono: str
    diagnostico: str
    tipo_examen: str
    detalles: Optional[str] = None  
    estado: str = "Estable" 
    fecha_cita: Optional[str] = None 
    created_at: datetime

    class Config:
        from_attributes = True
        
# --- Notification Schema ---
class NotificationLog(BaseModel):
    title: str
    message: str
    timestamp: datetime

# --- User Management Schemas ---
class UsuarioCreate(BaseModel):
    username: str
    password: str
    role: str = "doctor"

class UsuarioResponse(BaseModel):
    id: int
    username: str
    role: str
    created_at: datetime

    class Config:
        from_attributes = True
