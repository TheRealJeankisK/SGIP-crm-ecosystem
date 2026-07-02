import time
import json
import pika
import os
from function_app import process_lead_event

# Configuration
RABBITMQ_HOST = os.getenv("RABBITMQ_HOST", "queue")
RABBITMQ_PORT = int(os.getenv("RABBITMQ_PORT", 5672))
RABBITMQ_USER = os.getenv("RABBITMQ_USER", "guest")
RABBITMQ_PASSWORD = os.getenv("RABBITMQ_PASSWORD", "guest")
RABBITMQ_QUEUE = os.getenv("RABBITMQ_QUEUE", "leads_notifications")

def callback(ch, method, properties, body):
    print(f"[RABBITMQ TRIGGER] Received message from queue: {body.decode()}")
    try:
        lead_data = json.loads(body.decode('utf-8'))
        
        # Invoke the exact same core function that runs in Azure Function
        notification = process_lead_event(lead_data)
        
        print(f"[LAMBDA SUCCESS] Processed notification: {notification['title']}")
        ch.basic_ack(delivery_tag=method.delivery_tag)
    except Exception as e:
        print(f"[LAMBDA ERROR] Failed to process event: {e}")
        # Reject message and requeue it
        ch.basic_nack(delivery_tag=method.delivery_tag, requeue=True)

def main():
    print("Starting local Lambda Simulator (RabbitMQ Event Trigger)...")
    
    # Retry connecting in case RabbitMQ is still initializing
    connection = None
    for i in range(10):
        try:
            credentials = pika.PlainCredentials(RABBITMQ_USER, RABBITMQ_PASSWORD)
            connection = pika.BlockingConnection(pika.ConnectionParameters(
                host=RABBITMQ_HOST,
                port=RABBITMQ_PORT,
                credentials=credentials
            ))
            break
        except Exception as e:
            print(f"RabbitMQ not ready yet (Attempt {i+1}/10). Retrying in 4 seconds...")
            time.sleep(4)
            
    if connection is None:
        print("CRITICAL: Could not connect to RabbitMQ. Exiting.")
        return

    channel = connection.channel()
    channel.queue_declare(queue=RABBITMQ_QUEUE, durable=True)
    
    # Prefetch count ensures load balance
    channel.basic_qos(prefetch_count=1)
    channel.basic_consume(queue=RABBITMQ_QUEUE, on_message_callback=callback)

    print(f"Waiting for events on queue '{RABBITMQ_QUEUE}'...")
    try:
        channel.start_consuming()
    except KeyboardInterrupt:
        print("Stopping Lambda Simulator...")
        channel.stop_consuming()
    connection.close()

if __name__ == '__main__':
    main()
