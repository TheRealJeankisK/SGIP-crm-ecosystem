import azure.functions as func
import logging
import json
import os
import redis
import re
from datetime import datetime

app = func.FunctionApp()

def run_clinical_rules(detalles: str, diagnostico: str) -> list:
    """
    Motor de Reglas Clínicas de Soporte a Decisiones (CDSS).
    Analiza cadenas de texto en búsqueda de signos vitales y evalúa umbrales críticos.
    """
    alerts = []
    text = f"{detalles or ''} {diagnostico or ''}"
    
    # 1. Temperatura (Temp / Temperatura: XX)
    temp_match = re.search(r'(?:Temp|Temperatura):\s*(\d+\.?\d*)', text, re.IGNORECASE)
    if temp_match:
        temp = float(temp_match.group(1))
        if temp > 38.3:
            alerts.append(f"🤒 Fiebre Alta ({temp}°C)")
        elif temp < 35.0:
            alerts.append(f"🥶 Hipotermia ({temp}°C)")
            
    # 2. Frecuencia Cardíaca (FC / Frecuencia Cardíaca / Pulso: XX)
    fc_match = re.search(r'(?:FC|Frecuencia\s+Card[ií]aca|Pulso):\s*(\d+)', text, re.IGNORECASE)
    if fc_match:
        fc = int(fc_match.group(1))
        if fc > 100:
            alerts.append(f"🫀 Taquicardia ({fc} lpm)")
        elif fc < 50:
            alerts.append(f"🫀 Bradicardia ({fc} lpm)")
            
    # 3. Presión Arterial (PA / Presión / Presión Arterial: XXX/XX)
    pa_match = re.search(r'(?:PA|Presi[oó]n\s+Arterial|Presi[oó]n):\s*(\d+)\s*/\s*(\d+)', text, re.IGNORECASE)
    if pa_match:
        sys = int(pa_match.group(1))
        dia = int(pa_match.group(2))
        if sys > 140 or dia > 90:
            alerts.append(f"🩺 Crisis Hipertensiva ({sys}/{dia} mmHg)")
        elif sys < 90 or dia < 60:
            alerts.append(f"🩺 Hipotensión ({sys}/{dia} mmHg)")
            
    # 4. Saturación de Oxígeno (SatO2 / SpO2 / Saturación: XX)
    sat_match = re.search(r'(?:SatO2|SpO2|Saturaci[oó]n):\s*(\d+)', text, re.IGNORECASE)
    if sat_match:
        sat = int(sat_match.group(1))
        if sat < 92:
            alerts.append(f"🫁 Hipoxia / Desaturación ({sat}%)")
            
    return alerts

# Shared core logic for both Azure cloud execution and local emulator
def process_patient_event(patient_data: dict) -> dict:
    """
    Core function logic (the Lambda/Function body).
    Processes patient data, creates a health notification alert, and writes it to Redis cache.
    """
    patient_id = patient_data.get("id", "N/A")
    nombre = patient_data.get("nombre", "Unknown")
    diagnostico = patient_data.get("diagnostico", "No Diagnosis")
    tipo_examen = patient_data.get("tipo_examen", "Not specified")
    action = patient_data.get("action", "created")
    estado = patient_data.get("estado", "Estable")
    fecha_cita = patient_data.get("fecha_cita")
    detalles = patient_data.get("detalles", "")
    
    # Ejecutar el motor de reglas clínicas en eventos de creación o actualización
    clinical_alerts = []
    if action in ["created", "updated"]:
        clinical_alerts = run_clinical_rules(detalles, diagnostico)
        if clinical_alerts:
            estado = "Crítico"  # Forzar prioridad crítica si hay anomalías clínicas
            
    # 1. Generate Custom Health Alerts based on action and clinical status
    if action == "deleted":
        notification_title = f"🗑️ Ficha Eliminada (#{patient_id})"
        notification_msg = f"El historial clínico del paciente #{patient_id} ha sido retirado del sistema."
    elif clinical_alerts:
        # Alerta automatizada por el motor de reglas
        notification_title = f"🚨 Alerta Clínica Automatizada (#{patient_id})"
        alert_str = " ".join(clinical_alerts)
        notification_msg = f"Signos vitales anómalos detectados para '{nombre}': {alert_str}. ACCIÓN: Requiere valoración clínica inmediata."
    elif action == "updated":
        if estado == "Crítico":
            notification_title = f"🚨 Alerta Médica Crítica (#{patient_id})"
            notification_msg = f"El paciente '{nombre}' (Diag: {diagnostico}) ha sido reportado en estado CRÍTICO."
            if fecha_cita:
                notification_msg += f" Control urgente agendado para el {fecha_cita}. ACCIÓN: Notificar al residente de guardia inmediatamente."
        elif estado == "Observación":
            notification_title = f"🟡 Paciente en Observación (#{patient_id})"
            notification_msg = f"El paciente '{nombre}' (Diag: {diagnostico}) se encuentra bajo observación médica."
        elif estado == "Estable":
            notification_title = f"🟢 Alta / Reporte Estable (#{patient_id})"
            notification_msg = f"El paciente '{nombre}' (Diag: {diagnostico}) se encuentra estable."
        else:
            notification_title = f"🔄 Ficha Actualizada (#{patient_id})"
            notification_msg = f"Datos clínicos del paciente '{nombre}' (Diag: {diagnostico}) actualizados. Estado: {estado}."
    else: # created
        if estado == "Crítico":
            notification_title = f"🚨 Alerta Médica Crítica (#{patient_id})"
            notification_msg = f"Ingreso urgente: Paciente '{nombre}' registrado en estado CRÍTICO. Examen: {tipo_examen}."
        elif estado == "Observación":
            notification_title = f"🟡 Nuevo Ingreso en Observación (#{patient_id})"
            notification_msg = f"Paciente '{nombre}' registrado bajo observación. Diag: {diagnostico} (Examen: {tipo_examen})."
        else:
            notification_title = f"🟢 Nuevo Paciente Registrado (#{patient_id})"
            notification_msg = f"Ficha médica creada para '{nombre}' (Diag: {diagnostico}, Examen: {tipo_examen})."
        
    timestamp = datetime.utcnow().isoformat()
    
    log_payload = {
        "id": patient_id,
        "title": notification_title,
        "message": notification_msg,
        "timestamp": timestamp,
        "estado": estado,
        "fecha_cita": fecha_cita,
        "action": action
    }
    
    # 2. Persist in Redis Cache
    redis_host = os.getenv("REDIS_HOST", "cache")
    redis_port = int(os.getenv("REDIS_PORT", 6379))
    
    try:
        r = redis.Redis(host=redis_host, port=redis_port, decode_responses=True)
        # Push notification to the head of a Redis List
        r.rpush("patients_notifications_list", json.dumps(log_payload))
        # Keep only the last 50 notifications to prevent cache bloat
        r.ltrim("patients_notifications_list", -50, -1)
        logging.info(f"[REDIS SUCCESS] Logged notification for Patient #{patient_id} in Redis Cache.")
    except Exception as e:
        logging.error(f"[REDIS ERROR] Failed to write notification to Redis: {e}")
        
    return log_payload

# Azure Function Trigger (triggered by Azure Service Bus Queue in production)
@app.service_bus_queue_trigger(
    arg_name="msg", 
    queue_name="patients-queue", 
    connection="ServiceBusConnectionString"
)
def patient_notification_trigger(msg: func.ServiceBusMessage) -> None:
    logging.info("[AZURE FUNCTION TRIGGERED] Processing message from Service Bus...")
    
    try:
        message_body = msg.get_body().decode('utf-8')
        patient_data = json.loads(message_body)
        notification = process_patient_event(patient_data)
        logging.info(f"[AZURE FUNCTION COMPLETED] Notification processed: {notification['title']}")
    except Exception as e:
        logging.error(f"[AZURE FUNCTION ERROR] Failed to process message: {e}")
