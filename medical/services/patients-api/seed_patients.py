import sys
from adapters.database import SessionLocal
from models import Paciente
from datetime import datetime, timedelta
from adapters.queue import queue_adapter as queue_manager

def seed_patients():
    db = SessionLocal()
    try:
        # Clear existing patients for a clean reload of bulk data
        print("Clearing existing patients for a clean reload...")
        db.query(Paciente).delete()
        db.commit()
        
        # Define date strings for scheduled control appointments (ISO 8601 format)
        now = datetime.now()
        date_control1 = (now + timedelta(days=5)).replace(hour=10, minute=0, second=0).isoformat()[:16]
        date_control2 = (now + timedelta(days=2)).replace(hour=14, minute=30, second=0).isoformat()[:16]
        date_control3 = (now + timedelta(days=1)).replace(hour=9, minute=0, second=0).isoformat()[:16]
        
        # Define 25 realistic patients for SGIP with vital signs details to trigger CDSS alerts
        patients_data = [
            {
                "nombre": "Luis Alfredo Gómez",
                "email": "lgomez@outlook.com",
                "telefono": "+593998765432",
                "diagnostico": "Hipertensión Arterial G2",
                "tipo_examen": "Perfil Renal & Electrólitos",
                "detalles": "Paciente estable. Temperatura: 36.5. Pulso: 72. SatO2: 98%. Mantener dosis de Enalapril.",
                "estado": "Estable",
                "fecha_cita": date_control1,
                "created_at": datetime.utcnow() - timedelta(days=5)
            },
            {
                "nombre": "María José Cevallos",
                "email": "mjcevallos@yahoo.com",
                "telefono": "+593981234567",
                "diagnostico": "Insuficiencia Cardíaca Congestiva",
                "tipo_examen": "Ecocardiograma Transtorácico",
                "detalles": "Frecuencia Cardíaca: 95. Presión Arterial: 135/85. Presenta disnea leve de esfuerzo.",
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
                "detalles": "Paciente en buen estado. Temperatura: 36.8. SatO2: 97%. Continuar con Metformina.",
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
                "detalles": "Fiebre (Temperatura: 38.8). FC: 104 lpm. Dolor agudo en fosa ilíaca derecha.",
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
                "detalles": "Palpitaciones esporádicas. Frecuencia Cardíaca: 98. Presión: 130/85.",
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
                "detalles": "Revisión rutinaria de electrodos del generador cardíaco. Pulso: 70. SatO2: 98%.",
                "estado": "Estable",
                "fecha_cita": None,
                "created_at": datetime.utcnow()
            },
            {
                "nombre": "Carlos Julio Benítez",
                "email": "cbenitez@gmail.com",
                "telefono": "+593994443333",
                "diagnostico": "Crisis Asmática Aguda",
                "tipo_examen": "Espirometría / Gases Arteriales",
                "detalles": "Paciente con sibilancias severas. Hipoxia (SatO2: 89). Taquicardia (FC: 110).",
                "estado": "Crítico",
                "fecha_cita": date_control3,
                "created_at": datetime.utcnow()
            },
            {
                "nombre": "Ana Lucía Merino",
                "email": "amerino@gmail.com",
                "telefono": "+593982223333",
                "diagnostico": "Neumonía Severa",
                "tipo_examen": "Radiografía de Tórax AP",
                "detalles": "Dificultad respiratoria aguda. Temperatura: 39.1. Desaturación (SatO2: 87).",
                "estado": "Crítico",
                "fecha_cita": date_control3,
                "created_at": datetime.utcnow()
            },
            {
                "nombre": "Pedro José Ortiz",
                "email": "portiz@yahoo.com",
                "telefono": "+593997778888",
                "diagnostico": "Post-Infarto Agudo de Miocardio",
                "tipo_examen": "Electrocardiograma 12 Derivaciones",
                "detalles": "Bradicardia severa (FC: 48). Hipotensión arterial (PA: 85/55).",
                "estado": "Crítico",
                "fecha_cita": date_control3,
                "created_at": datetime.utcnow()
            },
            {
                "nombre": "Elena del Pilar Viteri",
                "email": "eviteri@hotmail.com",
                "telefono": "+593991119999",
                "diagnostico": "Insuficiencia Renal Crónica G4",
                "tipo_examen": "Depuración de Creatinina 24h",
                "detalles": "Presión Arterial: 138/88. Temperatura: 37.1. Edema leve en extremidades inferiores.",
                "estado": "Observación",
                "fecha_cita": date_control2,
                "created_at": datetime.utcnow()
            },
            {
                "nombre": "Jorge Washington Calderón",
                "email": "jcalderon@outlook.com",
                "telefono": "+593985552222",
                "diagnostico": "EPOC Exacerbado",
                "tipo_examen": "Gases Arteriales",
                "detalles": "Uso de musculatura accesoria. Desaturación (SatO2: 90). Pulso: 105.",
                "estado": "Crítico",
                "fecha_cita": date_control3,
                "created_at": datetime.utcnow()
            },
            {
                "nombre": "Diana Carolina Montes",
                "email": "dmontes@gmail.com",
                "telefono": "+593996667777",
                "diagnostico": "Hipotiroidismo de Hashimoto",
                "tipo_examen": "Perfil Tiroideo (TSH, T4L)",
                "detalles": "Paciente estable. Temperatura: 36.4. Pulso: 68. SatO2: 98%. Ajuste de levotiroxina.",
                "estado": "Estable",
                "fecha_cita": None,
                "created_at": datetime.utcnow()
            },
            {
                "nombre": "Guillermo Arturo Lasso",
                "email": "glasso@outlook.com",
                "telefono": "+593998881111",
                "diagnostico": "Monitoreo de Presión Post-Operatorio",
                "tipo_examen": "Monitoreo Ambulatorio de PA (MAPA)",
                "detalles": "Recuperación estable en sala. Presión Arterial: 135/89. Pulso: 75.",
                "estado": "Observación",
                "fecha_cita": date_control2,
                "created_at": datetime.utcnow()
            },
            {
                "nombre": "Mónica Alejandra Ruiz",
                "email": "mruiz@hospital.med.ec",
                "telefono": "+593971114444",
                "diagnostico": "Embarazo de Alto Riesgo - Preeclampsia",
                "tipo_examen": "Ecografía Obstétrica Doppler",
                "detalles": "Cefalea intensa. Crisis Hipertensiva (PA: 165/102). Temperatura: 37.4.",
                "estado": "Crítico",
                "fecha_cita": date_control3,
                "created_at": datetime.utcnow()
            },
            {
                "nombre": "Francisco Javier Coronel",
                "email": "fcoronel@gmail.com",
                "telefono": "+593993339999",
                "diagnostico": "Fibrilación Auricular Crónica",
                "tipo_examen": "Electrocardiograma de Control",
                "detalles": "Arritmia esporádica. Frecuencia Cardíaca: 96 lpm. SatO2: 95%.",
                "estado": "Observación",
                "fecha_cita": date_control2,
                "created_at": datetime.utcnow()
            },
            {
                "nombre": "Verónica Mercedes Silva",
                "email": "vsilva@gmail.com",
                "telefono": "+593991231234",
                "diagnostico": "Recuperación de Fractura de Fémur",
                "tipo_examen": "Radiografía de Control",
                "detalles": "Evolución favorable. Temperatura: 36.6. Pulso: 72. SatO2: 98%. Sin signos de infección.",
                "estado": "Estable",
                "fecha_cita": None,
                "created_at": datetime.utcnow()
            },
            {
                "nombre": "Gabriel Humberto Noboa",
                "email": "gnoboa@outlook.com",
                "telefono": "+593998889999",
                "diagnostico": "Sepsis de Origen Urinario",
                "tipo_examen": "Urocultivo & Hemograma",
                "detalles": "Febril. Fiebre Alta (Temperatura: 39.6). Taquicardia (FC: 120). Hipotensión (PA: 88/50).",
                "estado": "Crítico",
                "fecha_cita": date_control3,
                "created_at": datetime.utcnow()
            },
            {
                "nombre": "Patricia Elizabeth Cárdenas",
                "email": "pcardenas@hotmail.com",
                "telefono": "+593983334444",
                "diagnostico": "Alta Médica por Neumonía Resuelta",
                "tipo_examen": "Espirometría de Control",
                "detalles": "Paciente recuperado. Temperatura: 36.7. SatO2: 99%. Pulso: 70.",
                "estado": "Estable",
                "fecha_cita": None,
                "created_at": datetime.utcnow()
            },
            {
                "nombre": "Roberto Alexander Cobo",
                "email": "rcobo@gmail.com",
                "telefono": "+593995556666",
                "diagnostico": "Post-Quirúrgico de Colecistectomía",
                "tipo_examen": "Hemograma & Tiempos de Coagulación",
                "detalles": "Herida en buen estado. Presión: 130/80. Pulso: 88. Sin fiebre.",
                "estado": "Observación",
                "fecha_cita": date_control2,
                "created_at": datetime.utcnow()
            },
            {
                "nombre": "Cristina Michelle Espinoza",
                "email": "cespinoza@outlook.com",
                "telefono": "+593991112222",
                "diagnostico": "Cetoacidosis Diabética",
                "tipo_examen": "Gases Arteriales & Glucosa Capilar",
                "detalles": "Deshidratada. Temperatura: 38.5. Taquicardia (FC: 112). Presión: 145/95.",
                "estado": "Crítico",
                "fecha_cita": date_control3,
                "created_at": datetime.utcnow()
            },
            {
                "nombre": "Juan Sebastián Carrera",
                "email": "jcarrera@gmail.com",
                "telefono": "+593981119999",
                "diagnostico": "Chequeo Clínico Anual",
                "tipo_examen": "Perfil Lipídico Completo",
                "detalles": "Paciente sano. Temperatura: 36.3. Pulso: 74. SatO2: 98%.",
                "estado": "Estable",
                "fecha_cita": None,
                "created_at": datetime.utcnow()
            },
            {
                "nombre": "Silvia Paola Roldán",
                "email": "sroldan@gmail.com",
                "telefono": "+593997775555",
                "diagnostico": "Migraña Crónica Exacerbada",
                "tipo_examen": "Tomografía Axial de Cráneo (TAC)",
                "detalles": "Cefalea intensa refractaria. Presión: 135/88. Temp: 37.2.",
                "estado": "Observación",
                "fecha_cita": date_control2,
                "created_at": datetime.utcnow()
            },
            {
                "nombre": "Andrés Ricardo Ponce",
                "email": "aponce@gmail.com",
                "telefono": "+593982229999",
                "diagnostico": "Shock Anafiláctico por Alergia",
                "tipo_examen": "Gases Arteriales & Lactato",
                "detalles": "Hipotensión severa (PA: 80/50). FC: 125. Hipoxia (SatO2: 91). Emergencia médica.",
                "estado": "Crítico",
                "fecha_cita": date_control3,
                "created_at": datetime.utcnow()
            },
            {
                "nombre": "Carmen Delia Moreno",
                "email": "cmoreno@hotmail.com",
                "telefono": "+593993331111",
                "diagnostico": "Artrosis de Rodilla Control",
                "tipo_examen": "Radiografía de Rodilla Bilateral",
                "detalles": "Control de dolor crónico. Temperatura: 36.5. Pulso: 70. SatO2: 97%.",
                "estado": "Estable",
                "fecha_cita": None,
                "created_at": datetime.utcnow()
            },
            {
                "nombre": "Jaime Enrique Nebot",
                "email": "jnebot@outlook.com",
                "telefono": "+593985558888",
                "diagnostico": "Evaluación Pre-Operatoria Hernia",
                "tipo_examen": "Electrocardiograma & Hemograma",
                "detalles": "Paciente asintomático. Presión Arterial: 138/89. Frecuencia Cardíaca: 84.",
                "estado": "Observación",
                "fecha_cita": date_control2,
                "created_at": datetime.utcnow()
            }
        ]
        
        print(f"Inserting {len(patients_data)} realistic clinical patients into database...")
        for data in patients_data:
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
            
            # Format event payload for RabbitMQ/Service Bus
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
                print(f"Published clinical event to broker for Patient #{patient.id}: {patient.nombre}")
            except Exception as e:
                print(f"Failed to publish clinical event: {e}")
                
        print(f"Successfully seeded database with {len(patients_data)} patients and triggered their clinical events.")
    except Exception as e:
        print(f"Error seeding patients: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed_patients()
