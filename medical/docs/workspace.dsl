workspace {

    model {
        doctor = person "Personal Médico" "Visualiza alertas, administra fichas de pacientes y gestiona usuarios en el portal."
        paciente = person "Paciente" "Recibe atención clínica, visualiza sus reportes y genera métricas de signos vitales."

        sgip = softwareSystem "Sistema SGIP" "Ecosistema de gestión integrada de pacientes y telemedicina." {
            gateway = container "API Gateway (Nginx)" "Enruta las peticiones de red hacia el frontend, backend y documentación." "Nginx"
            frontend = container "Portal Clínico (Frontend)" "SPA en modo oscuro con dashboard interactivo de Chart.js." "HTML5/JS/CSS"
            backend = container "Patients API (Backend)" "API RESTful para lógica de negocio, autenticación y transacciones." "FastAPI/Python" {
                auth = component "Módulo de Seguridad" "Gestión de accesos basados en roles (RBAC) y hashing con SHA-256 + Salt." "Python"
                adapter = component "Adaptador de Exámenes (Adapter Pattern)" "Normaliza reportes heterogéneos XML/JSON de laboratorios externos." "Python/XMLAdapter"
                publisher = component "Publicador de Eventos" "Publica eventos clínicos serializados en formato JSON en el broker." "Python/RabbitMQ"
                controller = component "Controlador de Pacientes" "Gestiona las fichas, diagnósticos y agendamientos en la base de datos." "Python"
            }
            queue = container "Queue Broker (RabbitMQ)" "Persiste y enruta eventos clínicos de forma asíncrona hacia el worker." "RabbitMQ"
            lambda = container "Notification Worker (Lambda)" "Función serverless que analiza constantes vitales y genera alertas críticas." "Azure Functions" {
                cdss = component "Motor de Reglas Clínicas (CDSS)" "Evalúa constantes vitales mediante Regex y clasifica anomalías." "Python"
                redisClient = component "Conector Redis" "Escribe alertas de alta prioridad con un tiempo de vida (TTL) dinámico." "Python/Redis"
            }
            database = container "MySQL Database" "Almacenamiento relacional persistente de fichas clínicas y credenciales." "MySQL"
            cache = container "Redis Cache" "Almacenamiento en memoria para alertas de salud en tiempo real con baja latencia." "Redis"
        }

        lab = softwareSystem "Laboratorio Clínico Externo" "Envía exámenes diagnósticos clínicos en formatos XML o JSON."
        appInsights = softwareSystem "Azure Application Insights" "Servicio APM para monitoreo de telemetría y logs distribuidos."
        github = softwareSystem "GitHub Actions" "Pipeline de integración y despliegue continuo (CI/CD) automatizado."

        # Relationships
        doctor -> gateway "Usa el portal web y gestiona pacientes a través de" "HTTPS/Port 80"
        paciente -> gateway "Visualiza alertas y reportes a través de" "HTTPS/Port 80"
        lab -> gateway "Envía resultados de exámenes médicos a" "HTTPS/REST/Port 80"
        
        gateway -> frontend "Sirve archivos estáticos de" "HTTP"
        gateway -> backend "Enruta peticiones API a" "HTTP"
        gateway -> cache "Consulta alertas en tiempo real de" "TCP"

        backend -> database "Lee y escribe en" "SQL/TCP/Port 3306"
        backend -> queue "Publica eventos clínicos en" "AMQP/TCP/Port 5672"
        backend -> cache "Consulta telemetría en" "TCP/Port 6379"
        backend -> appInsights "Envía trazas de ejecución y telemetría a" "HTTPS"

        queue -> lambda "Dispara ejecución en" "AMQP/TCP/Port 5672"
        lambda -> cache "Escribe alertas clínicas en" "TCP/Port 6379"
        lambda -> appInsights "Envía logs de ejecución a" "HTTPS"

        github -> backend "Compila y despliega el contenedor de" "SSH/HTTPS"
        github -> lambda "Compila y despliega el código serverless de" "SSH/HTTPS"

        # Deployment Environment
        deploymentEnvironment "Production" {
            deploymentNode "Microsoft Azure Cloud" {
                tags "Azure"

                deploymentNode "Azure Region (East US)" {
                    
                    deploymentNode "Azure Static Web Apps" "Alojamiento estático de la SPA" "SaaS" {
                        containerInstance frontend
                    }

                    deploymentNode "Azure API Management (APIM)" "API Gateway administrado para enrutamiento seguro" "PaaS" {
                        containerInstance gateway
                    }

                    deploymentNode "Azure Container Apps" "Servicios de contenedores auto-escalables" "PaaS" {
                        containerInstance backend
                    }

                    deploymentNode "Azure Service Bus" "Broker de colas de mensajería empresarial" "PaaS" {
                        containerInstance queue
                    }

                    deploymentNode "Azure Functions" "Plataforma serverless de computación por eventos" "FaaS" {
                        containerInstance lambda
                    }

                    deploymentNode "Azure Database for MySQL" "Base de datos relacional flexible" "PaaS" {
                        containerInstance database
                    }

                    deploymentNode "Azure Cache for Redis" "Caché de baja latencia en memoria" "PaaS" {
                        containerInstance cache
                    }
                }
            }
        }
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

        deployment sgip "Production" "AzureDeployment" "Esquema de Despliegue en Microsoft Azure" {
            include *
            autolayout tb
        }

        theme default
    }

}
