# INSECOM CRM - Proyecto Integrador de Diseño y Arquitectura de Software

**Materia:** Diseño y Arquitectura de Software (ISWZ2202)  
**Facultad:** Ingeniería y Ciencias Aplicadas (FICA) - Ingeniería de Software  
**Integrantes:**  
* Jean Carlos Gómez Mafla  
* Adrian Morales  
* Adrian Puco  

---

## 📋 Descripción del Ecosistema de Microservicios

Este repositorio contiene la solución completa de arquitectura propuesta para la digitalización del flujo comercial de **INSECOM S.A. (Ecuador)**. La solución está diseñada como un **ecosistema resiliente de microservicios desacoplados**, estructurado en contenedores Docker y compatible para su despliegue Serverless en **Microsoft Azure** (aprovechando los $100 USD de crédito estudiantil).

El sistema gestiona la captación de prospectos (leads) de automatización y climatización (BMS) e integra un flujo asíncrono para agendar inspecciones técnicas en campo sin pérdida de datos en zonas sin cobertura de internet móvil.

---

## 🛠️ Arquitectura de la Solución (Cumplimiento de Requisitos)

La solución cumple de forma estricta con todos los requisitos obligatorios planteados en la rúbrica del proyecto integrador:

### 1. Ecosistema de Múltiples Aplicaciones (Rúbrica: Mínimo 3)
*   **App 1: Portal Web (Frontend):** Single Page Application (SPA) responsiva con diseño premium oscuro, estructurada con la marca y colores oficiales de **INSECOM Ecuador** (Verde `#6ba92a` y Gris). Incluye control de sesión en cliente, vistas dinámicas por pestañas y alertas en tiempo real.
*   **App 2: Leads Service (Backend API):** Servicio desarrollado en **FastAPI (Python)** que encapsula la lógica de negocio, realiza la validación criptográfica de usuarios (SHA-256 + Salt único) en base de datos, emite tokens de autorización Bearer, interactúa con MySQL y publica los leads comerciales en el gestor de colas.
*   **App 3: Notification Lambda (Serverless):** Microservicio compatible con la firma de **Azure Functions (Lambda)**. En desarrollo local, se implementa mediante un contenedor escuchando eventos en la cola, formateando alertas de preventa e impactando la caché persistente de Redis.

### 2. Capas de Datos Dockerizadas (Rúbrica: Capas de datos independientes en Docker)
*   **MySQL Database (`insecom_mysql`):** Base de datos relacional transaccional para persistencia estructurada de usuarios (credenciales seguras) y leads registrados.
*   **Redis Cache (`insecom_redis`):** Caché en memoria para almacenar las alertas comerciales procesadas por la Lambda, consumidas en tiempo real por el frontend, garantizando tiempos de respuesta ultrarrápidos (< 3ms).

### 3. Gestor de Colas (Rúbrica: Implementación de mensajería asíncrona)
*   **RabbitMQ (`insecom_queue`):** Message Broker de alto rendimiento para el desacoplamiento de la API y la Lambda. En producción en la nube, se mapea dinámicamente con **Azure Service Bus** mediante variables de entorno en el archivo `.env`.

### 4. API Gateway Centralizado con Swagger (Rúbrica: Exposición única REST y Swagger Hub)
*   **Nginx Gateway (`insecom_gateway`):** Servidor Nginx que actúa como **API Gateway** centralizado. Expone el puerto único `80` para servir el frontend, enrutar de forma segura las peticiones al backend y resolver políticas CORS.
*   **Swagger UI Integrado:** La documentación interactiva de la API (OpenAPI/Swagger) está centralizada a través del Gateway en: `http://localhost/docs`.

---

## 📂 Índice de Documentación Detallada (Requisitos Documentales)

Toda la documentación teórica y diagramas requeridos por la rúbrica han sido estructurados en la carpeta [docs/](docs/):

1.  **[Diagramas de Arquitectura (C4, Infraestructura y Despliegue)](docs/arquitectura_c4.md):**
    *   *Nivel 1: Contexto del Sistema (Mermaid.js)*
    *   *Nivel 2: Contenedores (Mermaid.js)*
    *   *Nivel 3: Componentes de Software (Mermaid.js)*
    *   *Diagrama de Despliegue en la Nube (Topología física de Microsoft Azure)*
2.  **[Análisis de Atributos de Calidad de la Arquitectura](docs/analisis_atributos.md):**
    *   Análisis y justificación técnica detallada de los 9 atributos obligatorios de la rúbrica: **Caché, Balanceo, Indexación, Redundancia, Disponibilidad, Concurrencia, Latencia, Costo y Proyección (Azure for Students), y Performance/Escalabilidad**.
3.  **[Mantenibilidad, Gestión de Logs, Monitoreo y CI/CD](docs/cicd_logs.md):**
    *   Diseño de la tubería de Integración y Despliegue Continuo (**GitHub Actions** Workflow para Azure Static Apps, Container Apps y Azure Functions).
    *   Estrategia de logs centralizados (Nginx logs, stdout/stderr y Azure Monitor).
    *   Monitoreo basado en las *4 Golden Signals* (Latencia, Tráfico, Errores, Saturación) con Azure Application Insights.

---

## 🚀 Guía de Arranque y Ejecución Local (Desarrollo)

Para validar el funcionamiento del ecosistema completo en tu entorno local (Docker Desktop), sigue estos pasos:

### Paso 1: Limpiar volumen de datos antiguos (Muy Recomendado)
Si has corrido versiones previas del docker-compose sin base de datos, ejecuta este comando en tu terminal para garantizar que MySQL cree las tablas y semille el usuario administrador correctamente de forma limpia:
```bash
docker-compose down -v
```

### Paso 2: Iniciar el Proyecto
Puedes levantar todos los servicios de dos formas:
*   **Opción A (Fácil):** Haz doble clic en el archivo automatizado **`iniciar_proyecto.bat`** en la raíz del proyecto. Este abrirá Docker, compilará los contenedores, los levantará en segundo plano y te abrirá el navegador directamente en la UI.
*   **Opción B (Consola):** Corre el comando tradicional:
    ```bash
    docker-compose up --build
    ```

### Paso 3: Acceso a las Aplicaciones
*   **Portal Web (Frontend):** Abre `http://localhost/` en tu navegador.
*   **Documentación Interactiva (Swagger):** Abre `http://localhost/docs`.

### Paso 5: Credenciales de Evaluación
*   **Usuario:** `admin`
*   **Contraseña:** `admin123`
*   *(Nota: La contraseña está almacenada de forma segura mediante encriptación criptográfica SHA-256 + Salt único en la base de datos MySQL, autosemillada por FastAPI en su primera conexión).*

---

## 🔒 Buenas Prácticas de Ingeniería de Software (Principios SOLID & OOP)
*   **Responsabilidad Única (SRP):** Cada clase del backend y cada contenedor realiza una sola tarea lógica (API Gateway rutea, FastAPI procesa lógica REST, RabbitMQ encola y la Lambda notifica).
*   **Seguridad por Diseño (Security by Design):** Cumple con las mejores prácticas de OWASP. Las llamadas a la base de datos se ejecutan de manera segura a través de un ORM (SQLAlchemy) para prevenir inyecciones SQL. Las credenciales nunca se exponen ni se queman en el código (hardcoded), sino que se leen de variables del entorno configuradas en el archivo `.env`.
*   **Control de Versiones (Dev Git):** Archivo `.env.example` incluido para guiar la configuración del equipo sin subir credenciales secretas al repositorio público.
