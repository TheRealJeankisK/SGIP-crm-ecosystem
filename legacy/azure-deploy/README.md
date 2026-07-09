# Guía de Despliegue en la Nube (Microsoft Azure)

Esta guía explica cómo desplegar la infraestructura serverless de **INSECOM CRM** utilizando tus créditos de estudiante de Azure ($100 USD) de forma óptima, asegurando un consumo mínimo (menos de $1 USD en total por el tiempo de la demostración).

---

## 1. Costo y Tiers Seleccionados (Control del Crédito)

Para no consumir tus créditos, la plantilla ARM (`main.json`) está configurada con las siguientes tarifas mínimas/gratuitas:
* **Azure Functions (Serverless)**: Desplegado en el plan **Consumption (Y1)**. Azure te otorga **1 millón de peticiones gratuitas al mes**. Costo: **$0.00 USD**.
* **Azure Service Bus (Queue)**: Desplegado en el plan **Basic**. El costo por un millón de operaciones es de centavos de dólar. Costo base: **$0.05 USD / mes**.
* **Azure Storage Account (LRS)**: Utilizado por la función para guardar su código. Se usa la replicación local (LRS), que cuesta menos de **$0.02 USD por GB**.
* **Application Insights**: Plan básico de monitoreo. Gratuito hasta 5 GB de ingesta de logs al mes. Costo: **$0.00 USD**.

*Nota: Para mantener la base de datos MySQL y el caché Redis dentro de los requisitos de la rúbrica y ahorrar dinero, puedes dejarlos corriendo localmente en Docker y configurar los microservicios para conectarse de forma híbrida, o bien crearlos en Azure en la capa gratuita (B1ms burstable para MySQL es gratuita por 12 meses para estudiantes).*

---

## 2. Paso a Paso para Desplegar desde el Portal de Azure (Sin Azure CLI)

Como no tienes instalado Azure CLI, utilizaremos la opción de **Despliegue de Plantillas Personalizadas** directamente en el navegador:

1. Inicia sesión en el [Portal de Azure](https://portal.azure.com/).
2. En la barra de búsqueda de la parte superior, escribe **"Deploy a custom template"** (o "Desplegar una plantilla personalizada") y selecciónalo.
3. Haz clic en **"Build your own template in the editor"** (Crear su propia plantilla en el editor).
4. Borra el código de ejemplo y **pega por completo el contenido del archivo `main.json`** que se encuentra en esta carpeta.
5. Haz clic en **Save** (Guardar).
6. Completa el formulario de configuración:
   * **Subscription (Suscripción)**: Selecciona tu suscripción de estudiante (Azure for Students).
   * **Resource Group (Grupo de recursos)**: Haz clic en *Create new* (Crear nuevo) y llámalo `RG-INSECOM-CRM`.
   * **Region**: Selecciona una región cercana, por ejemplo: `eastus` (Este de EE. UU.) o `southcentralus`.
   * **Project Name**: Elige un identificador corto en minúsculas (ej. `insecomcrm`), de máximo 11 caracteres.
7. Haz clic en **Review + create** (Revisar y crear) y luego en **Create** (Crear).
8. Espera 2-3 minutos a que finalice el despliegue.

---

## 3. Configuración Híbrida / Conexión desde el Microservicio

Una vez finalizado el despliegue, la cola de Azure Service Bus estará lista. Para conectar tu backend local (`leads-service`) a la cola en la nube:

1. Ve al recurso de **Service Bus Namespace** creado (se llamará `insecomcrm-bus`).
2. En el menú de la izquierda, haz clic en **Shared access policies** (Políticas de acceso compartido) y selecciona `RootManageSharedAccessKey`.
3. Copia el valor de **Primary Connection String** (Cadena de conexión primaria).
4. Abre tu archivo `.env` local en la carpeta raíz y realiza los siguientes cambios:
   * Cambia `ENVIRONMENT=local` a `ENVIRONMENT=azure`.
   * Pega la cadena de conexión copiada en la variable:
     `AZURE_SERVICE_BUS_CONNECTION_STRING=tu_cadena_de_conexion_aqui`
   * Asegúrate de que `AZURE_SERVICE_BUS_QUEUE_NAME` sea igual a `leads-queue`.
5. Reinicia tus contenedores de Docker Compose:
   `docker-compose down` y luego `docker-compose up --build`
6. ¡Listo! Ahora, cuando registres un Lead en el Frontend, el backend lo guardará en el MySQL local, pero lo publicará en la **cola real de Azure Service Bus en la nube**.

---

## 4. Desplegar el Código de la Azure Function (Código Serverless)

Para subir el código de tu carpeta `notification-lambda/` a la Function App creada en Azure:

1. Instala la extensión de **Azure Functions** en VSCode.
2. Abre la carpeta `A_ABET Proyecto Integrador` en VSCode.
3. Inicia sesión en Azure desde la pestaña de Azure en VSCode.
4. En el panel de Azure, en la sección de *Workspace*, haz clic en el icono azul de **Deploy** (un rayo con una flecha hacia arriba).
5. Selecciona la carpeta `notification-lambda/` y luego elige la **Function App** que creaste en el paso 2 (se llamará `insecomcrm-func`).
6. Confirma el despliegue. VSCode compilará y subirá la función en segundos.
7. ¡La función estará activa en la nube y responderá automáticamente a los mensajes de la cola de Azure Service Bus!
