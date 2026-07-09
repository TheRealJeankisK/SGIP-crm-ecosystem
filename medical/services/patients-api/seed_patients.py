import sys
from database import SessionLocal
from models import Paciente
from datetime import datetime, timedelta
from queue_manager import queue_manager

def seed_patients():
    db = SessionLocal()
    try:
        # Check if patients already exist
        count = db.query(Paciente).count()
        print(f"Current patients in database: {count}")
        
        # Define date strings for scheduled control appointments (ISO 8601 format)
        now = datetime.now()
        date_control1 = (now + timedelta(days=5)).replace(hour=10, minute=0, second=0).isoformat()[:16]
        date_control2 = (now + timedelta(days=2)).replace(hour=14, minute=30, second=0).isoformat()[:16]
        date_control3 = (now + timedelta(days=1)).replace(hour=9, minute=0, second=0).isoformat()[:16]
        
        # Define realistic patients for SGIP (Ecuador)
        patients_data = [
            {
                "nombre": "Luis Alfredo Gómez",
                "email": "lgomez@outlook.com",
                "telefono": "+593998765432",
                "diagnostico": "Hipertensión Arterial G2",
                "tipo_examen": "Perfil Renal & Electrólitos",
                "detalles": "Paciente reporta cefalea ocasional. Mantener dosis de Enalapril 20mg.",
                "estado": "Estable",
                "fecha_cita": date_control1,
                "created_at": datetime.utcnow() - timedelta(days=5)
            },
            {
                "nombre": "María José Cevallos",
                "email": "mjcevallos@yahoo.com",
                "telefono": "+593981234567",
                "diagnostico": "Insuficiencia Cardíaca Congestiva",
                "tipo_examen": "Ecococardiograma Transtorácico",
                "detalles": "Presenta disnea leve de esfuerzo. Ajustar dosis de Espironolactona si persiste edema.",
                "estado": "Observación",
                "fecha_cita": date_control2,
                "created_at": datetime.utcnow() - timedelta(days=4)
            },
            {
                "nombre": "Esteban Larrea",
                "email": "elarrea@gmail.com",
                "telefono": "+593995554321",
                "diagnostico": "Diabetes Mellitus Tipo 2",
                "tipo_examen": "Hemoglobina Glicosilada (HbA1c)",
                "detalles": "Buen control glucémico. Continuar con Metformina 850mg dos veces al día.",
                "estado": "Estable",
                "fecha_cita": None,
                "created_at": datetime.utcnow() - timedelta(days=3)
            },
            {
                "nombre": "Dra. Sofía Martínez",
                "email": "smartinez@hospital.med.ec",
                "telefono": "+593979876543",
                "diagnostico": "Sospecha de Apendicitis Aguda",
                "tipo_examen": "Ecografía de Abdomen Completo",
                "detalles": "Dolor agudo en fosa ilíaca derecha. Náuseas y febrícula (38°C).",
                "estado": "Crítico",
                "fecha_cita": date_control3,
                "created_at": datetime.utcnow() - timedelta(days=2)
            },
            {
                "nombre": "Dr. Fernando Terán",
                "email": "fteran@hmetro.med.ec",
                "telefono": "+59323998000",
                "diagnostico": "Control de Arritmia Cardíaca",
                "tipo_examen": "Holter de Ritmo Cardíaco 24h",
                "detalles": "Monitoreo rutinario solicitado tras reporte de palpitaciones esporádicas.",
                "estado": "Observación",
                "fecha_cita": None,
                "created_at": datetime.utcnow() - timedelta(days=1)
            },
            {
                "nombre": "Lorena Romero",
                "email": "lromero@gmail.com",
                "telefono": "+593992221111",
                "diagnostico": "Control Post-Operación de Marcapasos",
                "tipo_examen": "Radiografía de Tórax AP/Lateral",
                "detalles": "Revisión rutinaria de electrodos del generador cardíaco. Herida sana.",
                "estado": "Estable",
                "fecha_cita": None,
                "created_at": datetime.utcnow()
            }
        ]
        
        print("Inserting 6 realistic patients clinical records...")
        for data in patients_data:
            # Check if this patient already exists to avoid duplicates
            exists = db.query(Paciente).filter(Paciente.nombre == data["nombre"]).first()
            if not exists:
                patient = Paciente(
                    nombre=data["nombre"],
                    email=data["email"],
                    telefono=data["telefono"],
                    diagnostico=data["diagnostico"],
                    tipo_examen=data["tipo_examen"],
                    detalles=data["detalles"],
                    estado=data["estado"],
                    fecha_cita=data["fecha_cita"],
                    created_at=data["created_at"]
                )
                db.add(patient)
                db.commit() # Commit to get ID
                db.refresh(patient)
                
                # Format event payload for RabbitMQ
                event_data = {
                    "id": patient.id,
                    "nombre": patient.nombre,
                    "email": patient.email,
                    "telefono": patient.telefono,
                    "diagnostico": patient.diagnostico,
                    "tipo_examen": patient.tipo_examen,
                    "detalles": patient.detalles,
                    "estado": patient.estado,
                    "fecha_cita": patient.fecha_cita,
                    "action": "created"
                }
                
                # Publish event to the queue
                try:
                    queue_manager.publish_patient_event(event_data)
                    print(f"Published seed event to broker for Patient #{patient.id}")
                except Exception as e:
                    print(f"Failed to publish seed event: {e}")
                    
        print("Successfully seeded patient database and triggered clinical events.")
    except Exception as e:
        print(f"Error seeding patients: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed_patients()
