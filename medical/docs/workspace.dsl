workspace {

    model {
        doctor = person "Personal Médico" "Visualiza alertas y gestiona historiales clínicos en el portal."
        paciente = person "Paciente" "Recibe atención clínica y genera métricas de signos vitales."

        sgip = softwareSystem "Sistema SGIP" "Ecosistema de gestión integrada de pacientes y telemedicina." {
            gateway = container "API Gateway (Nginx)" "Enruta las peticiones de red hacia el frontend y backend." "Nginx"
            frontend = container "Portal Clínico (Frontend)" "SPA en modo oscuro que visualiza el dashboard y gestiona pacientes." "HTML5/JS"
            backend = container "Patients API (Backend)" "API RESTful para lógica de negocio y transacciones." "FastAPI/Python" {
                auth = component "Módulo de Seguridad" "Gestión de accesos por roles (RBAC) y hash SHA-256 + Salt." "Python"
                adapter = component "Adaptador de Exámenes (Adapter Pattern)" "Normaliza inputs XML/JSON de laboratorios externos." "Python/XMLAdapter"
                publisher = component "Publicador de Eventos" "Envía eventos clínicos a la cola de mensajería." "Python/RabbitMQ"
                controller = component "Controlador de Pacientes" "CRUD de fichas, diagnósticos y agendamientos en MySQL." "Python"
            }
            queue = container "Queue Broker (RabbitMQ)" "Persiste y enruta eventos clínicos de forma asíncrona." "RabbitMQ"
            lambda = container "Notification Worker (Lambda)" "Función serverless que analiza constantes vitales y genera alertas." "Azure Functions" {
                cdss = component "Motor de Reglas Clínicas (CDSS)" "Evalúa anomalías en signos vitales (Temp, SpO2, FC, PA) mediante Regex." "Python"
                redisClient = component "Conector Redis" "Escribe alertas de salud con prioridad y tiempo de vida (TTL)." "Python/Redis"
            }
            database = container "MySQL Database" "Almacenamiento persistente de fichas clínicas, signos vitales y usuarios." "MySQL"
            cache = container "Redis Cache" "Almacenamiento en memoria para alertas de salud en tiempo real con baja latencia." "Redis"
        }

        lab = softwareSystem "Laboratorio Clínico Externo" "Envía exámenes diagnósticos en XML o JSON."

        # Relationships
        doctor -> gateway "Usa el portal web y gestiona pacientes a través de" "HTTPS/Port 80"
        lab -> gateway "Envía resultados de exámenes médicos a" "HTTPS/REST/Port 80"
        
        gateway -> frontend "Sirve archivos estáticos de" "HTTP"
        gateway -> backend "Enruta peticiones API a" "HTTP"
        gateway -> cache "Consulta alertas en tiempo real de" "TCP"

        backend -> database "Lee y escribe en" "SQL/TCP/Port 3306"
        backend -> queue "Publica eventos clínicos en" "AMQP/TCP/Port 5672"
        backend -> cache "Consulta telemetría en" "TCP/Port 6379"

        queue -> lambda "Dispara ejecución en" "AMQP/TCP/Port 5672"
        lambda -> cache "Escribe alertas clínicas en" "TCP/Port 6379"
    }

    views {
        systemContext sgip "SystemContext" {
            include *
            autolayout tb
        }

        container sgip "Containers" {
            include *
            autolayout tb
        }

        component backend "BackendComponents" {
            include *
            autolayout tb
        }

        component lambda "LambdaComponents" {
            include *
            autolayout tb
        }

        theme default
    }

}
