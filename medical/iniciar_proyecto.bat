@echo off
title Iniciar SGIP - Portal Clinico de Pacientes
color 0B

echo =======================================================================
echo              SGIP - PORTAL CLINICO DE PACIENTES
echo           Gestion Integrada de Pacientes y Telemedicina
echo =======================================================================
echo.
echo Integrantes: Jean Carlos Gomez, Adrian Morales, Adrian Puco.
echo.
echo [1/3] Verificando Docker Desktop...
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    color 0C
    echo [ERROR] Docker no esta instalado o no esta en el PATH del sistema.
    echo Por favor, instala Docker Desktop antes de ejecutar este script.
    echo.
    pause
    exit /b
)

:: Check if Docker engine is running
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo [INFO] El motor de Docker no esta corriendo. Intentando iniciar Docker Desktop...
    :: Launch using registered Windows URI protocol (prevents hardcoding paths)
    start "" docker-desktop:// >nul 2>&1
    echo.
    echo Esperando a que el motor de Docker este listo...
    echo (Esto puede tomar hasta un minuto si Docker se esta iniciando)
    echo.
    
    set count=0
    :loop
    timeout /t 5 >nul
    docker info >nul 2>&1
    if %errorlevel% neq 0 (
        set /a count=count+1
        if %count% geq 15 (
            color 0C
            echo [WARNING] No se pudo iniciar el motor de Docker automaticamente.
            echo Por favor, abre Docker Desktop manualmente, espera a que este activo [icono verde]
            echo y presiona cualquier tecla para continuar en este script...
            echo.
            pause
            color 0B
            set count=0
        )
        echo Cargando motor de Docker... por favor espera...
        goto loop
    )
    echo [OK] El motor de Docker se inicio correctamente!
)

echo.
echo [1.5/3] Detectando puertos libres en el sistema...
:: Ejecuta script de powershell para encontrar puertos libres (comprobando TCP table, IPv4 e IPv6) y crear un bat temporal
powershell -NoProfile -Command "$ports = @{ 'GATEWAY_HOST_PORT' = 80; 'PATIENTS_API_HOST_PORT' = 8000; 'FRONTEND_HOST_PORT' = 8081; 'MYSQL_HOST_PORT' = 3306; 'REDIS_HOST_PORT' = 6379; 'RABBITMQ_HOST_PORT' = 5672; 'RABBITMQ_ADMIN_HOST_PORT' = 15672 }; function Test-PortInUse($p) { if (Get-NetTCPConnection -LocalPort $p -ErrorAction SilentlyContinue) { return $true }; try { $l4 = New-Object System.Net.Sockets.TcpListener ([System.Net.IPAddress]::Any), $p; $l4.Start(); $l4.Stop() } catch { return $true }; try { $l6 = New-Object System.Net.Sockets.TcpListener ([System.Net.IPAddress]::IPv6Any), $p; $l6.Start(); $l6.Stop() } catch { return $true }; return $false }; $out = @(); foreach ($key in $ports.Keys) { $port = $ports[$key]; while (Test-PortInUse $port) { $port++ }; $out += \"set $key=$port\" }; $out | Out-File -FilePath temp_ports.bat -Encoding ascii"
call temp_ports.bat
del temp_ports.bat

echo    - Puerto Nginx Gateway (Web):   %GATEWAY_HOST_PORT%
echo    - Puerto API de Pacientes:      %PATIENTS_API_HOST_PORT%
echo    - Puerto Frontend alterno:      %FRONTEND_HOST_PORT%
echo    - Puerto MySQL Database:        %MYSQL_HOST_PORT%
echo    - Puerto Redis Cache:           %REDIS_HOST_PORT%
echo    - Puerto RabbitMQ Broker:       %RABBITMQ_HOST_PORT%
echo    - Puerto RabbitMQ Admin:        %RABBITMQ_ADMIN_HOST_PORT%

echo.
echo [2/3] Levantando contenedores y compilandolos...
docker-compose up -d --build

echo.
echo [3/3] Iniciando portal clinico en el navegador...
echo Esperando 5 segundos a que los servicios se estabilicen...
timeout /t 5 >nul
if "%GATEWAY_HOST_PORT%"=="80" (
    start "" http://localhost/
    start "" http://localhost/docs
) else (
    start "" http://localhost:%GATEWAY_HOST_PORT%/
    start "" http://localhost:%GATEWAY_HOST_PORT%/docs
)

echo.
echo =======================================================================
echo   El sistema esta ACTIVO. Stream de Logs iniciado.
echo   Para APAGAR los contenedores y liberar puertos, presiona CTRL+C
echo =======================================================================
echo.

:: Stream logs
docker-compose logs -f

echo.
echo Apagando contenedores y limpiando recursos de Docker...
docker-compose down
echo Proceso finalizado.
pause
