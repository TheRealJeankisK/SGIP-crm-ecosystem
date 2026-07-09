from sqlalchemy import Column, Integer, String, Text, DateTime
from sqlalchemy.sql import func
from database import Base
from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional

# --- SQLAlchemy Database Models ---
class Lead(Base):
    __tablename__ = "leads"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(100), nullable=False)
    email = Column(String(200), nullable=False)  # Increased length to support multiple emails
    telefono = Column(String(150), nullable=False)  # Increased length for multiple phones
    proyecto = Column(String(300), nullable=False)  # Increased length for multiple projects/buildings
    requerimientos = Column(String(200), nullable=False)
    detalles = Column(String(500), nullable=True)  # New details column
    estado = Column(String(50), default="Pendiente", nullable=False) # New lead status
    fecha_cita = Column(String(100), nullable=True) # New scheduled meeting/call date
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Usuario(Base):
    __tablename__ = "usuarios"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    hashed_password = Column(String(128), nullable=False)
    salt = Column(String(32), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

# --- Pydantic Schemas for Validation ---
class UserLogin(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    username: str

class LeadCreate(BaseModel):
    nombre: str
    email: str  # Changed from EmailStr to str to support multiple comma-separated emails
    telefono: str
    proyecto: str
    requerimientos: str
    detalles: Optional[str] = None  # New optional details field
    estado: str = "Pendiente" # New lead status field
    fecha_cita: Optional[str] = None # New scheduled date

class LeadResponse(BaseModel):
    id: int
    nombre: str
    email: str  # Changed from EmailStr to str
    telefono: str
    proyecto: str
    requerimientos: str
    detalles: Optional[str] = None  # New optional details field
    estado: str = "Pendiente" # New lead status field
    fecha_cita: Optional[str] = None # New scheduled date
    created_at: datetime

    class Config:
        from_attributes = True
        
# --- Notification Schema ---
class NotificationLog(BaseModel):
    title: str
    message: str
    timestamp: datetime
