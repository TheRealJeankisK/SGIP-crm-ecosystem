import json
import pika
from azure.servicebus import ServiceBusClient, ServiceBusMessage
from config import settings

class QueueManager:
    def __init__(self):
        self.env = settings.ENVIRONMENT.lower()
        print(f"QueueManager initialized in environment: {self.env.upper()}")

    def publish_patient_event(self, patient_data: dict):
        """
        Publishes a Patient Event. 
        Chooses between Local RabbitMQ and Azure Service Bus based on configuration.
        """
        message_body = json.dumps(patient_data)
        
        if self.env == "azure" and settings.AZURE_SERVICE_BUS_CONNECTION_STRING:
            self._publish_to_azure(message_body)
        else:
            self._publish_to_local_rabbitmq(message_body)

    def _publish_to_local_rabbitmq(self, message_body: str):
        """
        Publishes message to local RabbitMQ broker.
        """
        try:
            # Credentials for RabbitMQ
            credentials = pika.PlainCredentials(settings.RABBITMQ_USER, settings.RABBITMQ_PASSWORD)
            connection_params = pika.ConnectionParameters(
                host=settings.RABBITMQ_HOST,
                port=settings.RABBITMQ_PORT,
                credentials=credentials
            )
            
            # Open connection and channel
            connection = pika.BlockingConnection(connection_params)
            channel = connection.channel()
            
            # Declare queue (ensures queue exists)
            channel.queue_declare(queue=settings.RABBITMQ_QUEUE, durable=True)
            
            # Publish message
            channel.basic_publish(
                exchange='',
                routing_key=settings.RABBITMQ_QUEUE,
                body=message_body,
                properties=pika.BasicProperties(
                    delivery_mode=2, # Make message persistent
                    content_type='application/json'
                )
            )
            connection.close()
            print(f"[RABBITMQ] Published event: {message_body}")
        except Exception as e:
            print(f"[RABBITMQ ERROR] Failed to publish event: {e}")
            raise e

    def _publish_to_azure(self, message_body: str):
        """
        Publishes message to Azure Service Bus queue.
        """
        try:
            # Connect to Azure Service Bus Queue
            sb_client = ServiceBusClient.from_connection_string(
                conn_str=settings.AZURE_SERVICE_BUS_CONNECTION_STRING
            )
            
            with sb_client:
                sender = sb_client.get_queue_sender(
                    queue_name=settings.AZURE_SERVICE_BUS_QUEUE_NAME
                )
                with sender:
                    message = ServiceBusMessage(message_body)
                    sender.send_messages(message)
                    
            print(f"[AZURE SERVICE BUS] Sent message to {settings.AZURE_SERVICE_BUS_QUEUE_NAME}: {message_body}")
        except Exception as e:
            print(f"[AZURE SERVICE BUS ERROR] Failed to send message: {e}")
            raise e

queue_adapter = QueueManager()
