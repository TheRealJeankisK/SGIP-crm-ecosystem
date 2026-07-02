import sys
from database import SessionLocal
from models import Lead
from datetime import datetime, timedelta
from queue_manager import queue_manager

def seed_leads():
    db = SessionLocal()
    try:
        # Check if leads already exist
        count = db.query(Lead).count()
        print(f"Current leads in database: {count}")
        
        # Define date strings for scheduled meetings/reminders (ISO 8601 format)
        now = datetime.now()
        date_unique = (now + timedelta(days=5)).replace(hour=10, minute=0, second=0).isoformat()[:16]
        date_elite = (now + timedelta(days=2)).replace(hour=14, minute=30, second=0).isoformat()[:16]
        date_hospital = (now + timedelta(days=1)).replace(hour=9, minute=0, second=0).isoformat()[:16]
        
        # Define realistic leads for INSECOM S.A. (Ecuador)
        leads_data = [
            {
                "nombre": "Diego Portilla",
                "email": "dportilla@uribeschwarzkopf.com",
                "telefono": "+593998765432",
                "proyecto": "Edificio Unique (Uribe Schwarzkopf)",
                "requerimientos": "BMS & Climatización (HVAC)",
                "detalles": "Cliente solicita integración con sistema de climatización Carrier existente.",
                "estado": "Interesado",
                "fecha_cita": date_unique,
                "created_at": datetime.utcnow() - timedelta(days=5)
            },
            {
                "nombre": "Ing. Carlos Cevallos",
                "email": "ccevallos@eliteplaza.com.ec",
                "telefono": "+593981234567",
                "proyecto": "Torre Elite Plaza",
                "requerimientos": "Seguridad Electrónica y CCTV",
                "detalles": "Inspección técnica requerida el próximo lunes. Solicita cotización de 32 cámaras IP.",
                "estado": "Interesado",
                "fecha_cita": date_elite,
                "created_at": datetime.utcnow() - timedelta(days=4)
            },
            {
                "nombre": "Dra. Sofía Martínez",
                "email": "smartinez@plazamericas.com",
                "telefono": "+593995554321",
                "proyecto": "Plaza de las Américas Centro Comercial",
                "requerimientos": "Control de Accesos & Biométricos",
                "detalles": "Integrar biométricos de reconocimiento facial con el software de nómina.",
                "estado": "Pendiente",
                "fecha_cita": None,
                "created_at": datetime.utcnow() - timedelta(days=3)
            },
            {
                "nombre": "Arq. Andrés Larrea",
                "email": "alarrea@epiquecumbaya.com",
                "telefono": "+593979876543",
                "proyecto": "Edificio Epique Cumbayá",
                "requerimientos": "Audio/Video Integral & Cableado",
                "detalles": "Nota: Edificio en obra gris, cableado estructurado Categoría 6A necesario.",
                "estado": "No Interesado",
                "fecha_cita": None,
                "created_at": datetime.utcnow() - timedelta(days=2)
            },
            {
                "nombre": "Dr. Fernando Terán",
                "email": "fteran@hmetro.med.ec",
                "telefono": "+59323998000",
                "proyecto": "Hospital Metropolitano - Nueva Ala Norte",
                "requerimientos": "Proyecto Completo de Edificio Inteligente",
                "detalles": "Urgente. Requiere sistema BMS completo integrado con tableros eléctricos Schneider.",
                "estado": "Interesado",
                "fecha_cita": date_hospital,
                "created_at": datetime.utcnow() - timedelta(days=1)
            },
            {
                "nombre": "Ing. Lorena Romero",
                "email": "lromero@pronaca.com.ec",
                "telefono": "+593992221111",
                "proyecto": "Oficinas Administrativas Pronaca Quito",
                "requerimientos": "BMS & Climatización (HVAC)",
                "detalles": "Proyecto de modernización de controladores viejos.",
                "estado": "Pendiente",
                "fecha_cita": None,
                "created_at": datetime.utcnow()
            }
        ]
        
        print("Inserting 6 realistic commercial leads with status and meetings...")
        for data in leads_data:
            # Check if this project already exists to avoid duplicates
            exists = db.query(Lead).filter(Lead.proyecto == data["proyecto"]).first()
            if not exists:
                lead = Lead(
                    nombre=data["nombre"],
                    email=data["email"],
                    telefono=data["telefono"],
                    proyecto=data["proyecto"],
                    requerimientos=data["requerimientos"],
                    detalles=data["detalles"],
                    estado=data["estado"],
                    fecha_cita=data["fecha_cita"],
                    created_at=data["created_at"]
                )
                db.add(lead)
                db.commit() # Commit to get ID
                db.refresh(lead)
                
                # Format event payload for RabbitMQ
                event_data = {
                    "id": lead.id,
                    "nombre": lead.nombre,
                    "email": lead.email,
                    "proyecto": lead.proyecto,
                    "requerimientos": lead.requerimientos,
                    "estado": lead.estado,
                    "fecha_cita": lead.fecha_cita,
                    "action": "created"
                }
                
                # Publish event to the queue
                try:
                    queue_manager.publish_lead_event(event_data)
                    print(f"Published seed event to broker for Lead #{lead.id}")
                except Exception as e:
                    print(f"Failed to publish seed event: {e}")
                    
        print("Successfully seeded database and triggered notifications.")
    except Exception as e:
        print(f"Error seeding leads: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed_leads()
