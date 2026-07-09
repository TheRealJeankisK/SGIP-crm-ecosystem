import azure.functions as func
import logging
import json
import os
import redis
from datetime import datetime

app = func.FunctionApp()

# Shared core logic for both Azure cloud execution and local emulator
def process_lead_event(lead_data: dict) -> dict:
    """
    Core function logic (the Lambda/Function body).
    Processes lead data, creates a notification event, and writes it to Redis cache.
    """
    lead_id = lead_data.get("id", "N/A")
    nombre = lead_data.get("nombre", "Desconocido")
    proyecto = lead_data.get("proyecto", "Proyecto Sin Nombre")
    req = lead_data.get("requerimientos", "No especificado")
    action = lead_data.get("action", "created")
    estado = lead_data.get("estado", "Pendiente")
    fecha_cita = lead_data.get("fecha_cita")
    
    # 1. Generate Custom Notification based on action and status
    if action == "deleted":
        notification_title = f"🗑️ Lead Eliminado (#{lead_id})"
        notification_msg = f"El prospecto comercial #{lead_id} ha sido retirado del sistema."
    elif action == "updated":
        if estado == "Interesado":
            notification_title = f"🔥 Interés Confirmado (#{lead_id})"
            notification_msg = f"El contacto '{nombre}' ({proyecto}) se encuentra interesado."
            if fecha_cita:
                notification_msg += f" Cita agendada para el {fecha_cita}. RECORDATORIO: Llamar a {nombre} en 15 minutos."
        elif estado == "No Interesado":
            notification_title = f"❄️ Lead Descartado (#{lead_id})"
            notification_msg = f"El contacto '{nombre}' ({proyecto}) ha sido marcado como NO INTERESADO."
        else:
            notification_title = f"🔄 Lead Actualizado (#{lead_id})"
            notification_msg = f"Datos del cliente '{nombre}' ({proyecto}) actualizados. Estado: {estado}."
    else: # created
        notification_title = f"🆕 Nuevo Lead Registrado (#{lead_id})"
        notification_msg = f"El contacto '{nombre}' ha solicitado integración para '{proyecto}' (Req: {req})."
        
    timestamp = datetime.utcnow().isoformat()
    
    log_payload = {
        "id": lead_id,
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
        r.rpush("leads_notifications_list", json.dumps(log_payload))
        # Keep only the last 50 notifications to prevent cache bloat
        r.ltrim("leads_notifications_list", -50, -1)
        logging.info(f"[REDIS SUCCESS] Logged notification for Lead #{lead_id} in Redis Cache.")
    except Exception as e:
        logging.error(f"[REDIS ERROR] Failed to write notification to Redis: {e}")
        
    return log_payload

# Azure Function Trigger (triggered by Azure Service Bus Queue in production)
@app.service_bus_queue_trigger(
    arg_name="msg", 
    queue_name="leads-queue", 
    connection="ServiceBusConnectionString"
)
def lead_notification_trigger(msg: func.ServiceBusMessage) -> None:
    logging.info("[AZURE FUNCTION TRIGGERED] Processing message from Service Bus...")
    
    try:
        message_body = msg.get_body().decode('utf-8')
        lead_data = json.loads(message_body)
        notification = process_lead_event(lead_data)
        logging.info(f"[AZURE FUNCTION COMPLETED] Notification processed: {notification['title']}")
    except Exception as e:
        logging.error(f"[AZURE FUNCTION ERROR] Failed to process message: {e}")
