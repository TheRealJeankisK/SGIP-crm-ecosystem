document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements - Auth & Navigation
    const viewLogin = document.getElementById('view-login');
    const appWorkspace = document.getElementById('app-workspace');
    const loginForm = document.getElementById('login-form');
    const loginUsername = document.getElementById('login-username');
    const loginPassword = document.getElementById('login-password');
    const loginError = document.getElementById('login-error');
    const userDisplayName = document.getElementById('user-display-name');
    const btnLogout = document.getElementById('btn-logout');
    
    // Recovery Elements
    const btnForgotPassword = document.getElementById('btn-forgot-password');
    const recoveryMessage = document.getElementById('recovery-message');
    const btnCloseRecovery = document.getElementById('btn-close-recovery');

    // Forgot Password Interactions
    btnForgotPassword.addEventListener('click', (e) => {
        e.preventDefault();
        loginForm.classList.add('hidden');
        recoveryMessage.classList.remove('hidden');
    });

    btnCloseRecovery.addEventListener('click', () => {
        recoveryMessage.classList.add('hidden');
        loginForm.classList.remove('hidden');
    });
    
    // DOM Elements - Views and Tabs
    const menuItems = document.querySelectorAll('.menu-item[data-target]');
    const viewPanes = document.querySelectorAll('.view-pane');
    const viewTitle = document.getElementById('view-title');

    // DOM Elements - Leads & Notifications
    const leadForm = document.getElementById('lead-form');
    const patientsTableBody = document.getElementById('leads-table-body');
    const notificationsList = document.getElementById('notifications-list');
    const notificationCount = document.getElementById('notification-count');
    const btnRefresh = document.getElementById('btn-refresh');

    // Vitals DOM elements
    const chkVitals = document.getElementById('chk-vitals');
    const vitalsContainer = document.getElementById('vitals-container');
    const vitalTemp = document.getElementById('vital-temp');
    const vitalFc = document.getElementById('vital-fc');
    const vitalSat = document.getElementById('vital-sat');
    const vitalPa = document.getElementById('vital-pa');

    if (chkVitals && vitalsContainer) {
        chkVitals.addEventListener('change', () => {
            if (chkVitals.checked) {
                vitalsContainer.classList.remove('hidden');
            } else {
                vitalsContainer.classList.add('hidden');
                vitalTemp.value = '';
                vitalFc.value = '';
                vitalSat.value = '';
                vitalPa.value = '';
            }
        });
    }

    // State Variables
    let notificationsCache = [];
    let patientsCache = [];
    let filteredLeads = [];
    let currentSortCol = 'id';
    let currentSortDir = 'desc';
    let editPatientId = null;
    let pollIntervalLeads = null;
    let pollIntervalNotifications = null;

    // Chart.js instances
    let statusChartInstance = null;
    let diagnosesChartInstance = null;

    // Search/Filter and Export DOM Elements
    const patientsSearchInput = document.getElementById('leads-search-input');
    const patientsFilterRequirement = document.getElementById('leads-filter-requirement');
    const exportSelect = document.getElementById('export-select');

    // --- AUTHENTICATION FLOW ---
    checkAuth();

    function checkAuth() {
        const token = sessionStorage.getItem('auth_token');
        const username = sessionStorage.getItem('auth_username');
        const role = sessionStorage.getItem('auth_role') || 'doctor';
        
        if (token && username) {
            // User is logged in
            viewLogin.classList.add('hidden');
            appWorkspace.classList.remove('hidden');
            userDisplayName.innerText = username;

            // Update role label in header
            const roleEl = document.getElementById('user-display-role');
            if (roleEl) {
                roleEl.innerText = role === 'admin' ? 'Administrador Clínico' : 'Médico Especialista (Lectura)';
            }
            
            // Apply sidebar and action button visibility constraints
            applyRoleRestrictions(role);
            updateHeaderAvatar(username);
            
            // Start background sync
            startSync();
            
            // Switch to default view
            switchTab('view-dashboard');
        } else {
            // User is not logged in
            viewLogin.classList.remove('hidden');
            appWorkspace.classList.add('hidden');
            
            // Stop sync
            stopSync();
        }
    }

    // Role restrictions helper to hide creation buttons/menus for doctors
    function applyRoleRestrictions(role) {
        const navCreate = document.getElementById('nav-create-patient');
        const navLab = document.getElementById('nav-lab-integration');
        const navConfig = document.getElementById('nav-config');
        const btnCreate = document.getElementById('btn-goto-create');
        const actionHeaders = document.querySelectorAll('.action-column');
        
        if (role === 'doctor') {
            if (navCreate) navCreate.classList.add('hidden');
            if (navLab) navLab.classList.add('hidden');
            if (navConfig) navConfig.classList.add('hidden');
            if (btnCreate) btnCreate.classList.add('hidden');
            actionHeaders.forEach(el => el.classList.add('hidden'));
        } else {
            if (navCreate) navCreate.classList.remove('hidden');
            if (navLab) navLab.classList.remove('hidden');
            if (navConfig) navConfig.classList.remove('hidden');
            if (btnCreate) btnCreate.classList.remove('hidden');
            actionHeaders.forEach(el => el.classList.remove('hidden'));
        }
    }

    // Update Top Bar Profile Avatar with dynamic initials and custom deterministic gradient
    function updateHeaderAvatar(username) {
        const avatarEl = document.querySelector('.top-bar .avatar');
        if (!avatarEl) return;
        
        const userInitial = username.charAt(0).toUpperCase();
        
        // Premium curated color gradients
        const gradients = [
            { bg: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)', shadow: 'rgba(13, 148, 136, 0.25)' },
            { bg: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)', shadow: 'rgba(59, 130, 246, 0.25)' },
            { bg: 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)', shadow: 'rgba(99, 102, 241, 0.25)' },
            { bg: 'linear-gradient(135deg, #ec4899 0%, #be185d 100%)', shadow: 'rgba(236, 72, 153, 0.25)' }
        ];
        
        // Select gradient deterministically based on username string hash
        let hash = 0;
        for (let i = 0; i < username.length; i++) {
            hash = username.charCodeAt(i) + ((hash << 5) - hash);
        }
        const index = Math.abs(hash) % gradients.length;
        const selectedGradient = gradients[index];
        
        // Apply dynamic styling and initials letter
        avatarEl.style.background = selectedGradient.bg;
        avatarEl.style.boxShadow = `0 4px 15px ${selectedGradient.shadow}`;
        avatarEl.innerHTML = `<span style="font-weight: 700; text-transform: uppercase; font-size: 1.1rem; letter-spacing: 0.5px; color: white;">${userInitial}</span>`;
    }

    // Handle Login Form Submit
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = loginUsername.value.trim();
        const password = loginPassword.value;
        
        const btnLogin = loginForm.querySelector('.btn-login');
        const originalContent = btnLogin.innerHTML;
        btnLogin.disabled = true;
        btnLogin.innerHTML = '<span>Verificando...</span> <i class="fa-solid fa-spinner fa-spin"></i>';
        loginError.classList.add('hidden');

        try {
            const response = await fetch('/api/v1/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });

            if (!response.ok) {
                if (response.status === 401) {
                    throw new Error('Credenciales incorrectas');
                }
                throw new Error('Error en el servidor');
            }

            const data = await response.json();
            
            // Save session
            sessionStorage.setItem('auth_token', data.access_token);
            sessionStorage.setItem('auth_username', data.username);
            sessionStorage.setItem('auth_role', data.role);
            
            // Reset form
            loginForm.reset();
            
            // Refresh layout
            checkAuth();
            showToast(`<i class="fa-solid fa-shield-halved"></i> ¡Bienvenido, ${data.username}!`);
            
        } catch (error) {
            console.error('Login error:', error);
            loginError.classList.remove('hidden');
        } finally {
            btnLogin.disabled = false;
            btnLogin.innerHTML = originalContent;
        }
    });

    // Handle Logout Click
    btnLogout.addEventListener('click', () => {
        sessionStorage.removeItem('auth_token');
        sessionStorage.removeItem('auth_username');
        sessionStorage.removeItem('auth_role');
        checkAuth();
        showToast('<i class="fa-solid fa-right-from-bracket"></i> Sesión cerrada.');
    });

    // --- TAB / WINDOW SWITCHING FLOW ---
    menuItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const target = item.getAttribute('data-target');
            switchTab(target);
        });
    });

    // --- SUBMENU TOGGLE for Historiales Clínicos ---
    const navPatientsHistory = document.getElementById('nav-patients-history');
    const submenuHistorial = document.getElementById('submenu-historial');
    const submenuChevron = document.getElementById('submenu-chevron');
    let submenuOpen = false;

    if (navPatientsHistory && submenuHistorial) {
        navPatientsHistory.addEventListener('click', (e) => {
            // Toggle submenu visibility
            submenuOpen = !submenuOpen;
            if (submenuOpen) {
                submenuHistorial.style.maxHeight = submenuHistorial.scrollHeight + 'px';
                if (submenuChevron) submenuChevron.style.transform = 'rotate(0deg)';
            } else {
                submenuHistorial.style.maxHeight = '0';
                if (submenuChevron) submenuChevron.style.transform = 'rotate(-90deg)';
            }
        });
    }

    function switchTab(targetId) {
        menuItems.forEach(mi => {
            if (mi.getAttribute('data-target') === targetId) {
                mi.classList.add('active');
            } else {
                mi.classList.remove('active');
            }
        });
        switchView(targetId);
    }

    function switchView(targetId) {
        viewPanes.forEach(pane => {
            if (pane.id === targetId) {
                pane.classList.remove('hidden');
            } else {
                pane.classList.add('hidden');
            }
        });

        // Update Title and Icon on Banner dynamically
        const bannerIconContainer = document.querySelector('.welcome-banner .banner-icon');
        const role = sessionStorage.getItem('auth_role');
        
        if (targetId === 'view-dashboard') {
            viewTitle.innerText = 'Dashboard Clínico y Estadísticas (SGIP)';
            if (bannerIconContainer) {
                bannerIconContainer.innerHTML = '<i class="fa-solid fa-chart-pie"></i>';
            }
            fetchPatients();
        } else if (targetId === 'view-form') {
            viewTitle.innerText = 'Ficha de Registro Clínico';
            if (bannerIconContainer) {
                bannerIconContainer.innerHTML = '<i class="fa-solid fa-user-plus"></i>';
            }
        } else if (targetId === 'view-list') {
            viewTitle.innerText = 'Historial Clínico de Pacientes (MySQL)';
            if (bannerIconContainer) {
                bannerIconContainer.innerHTML = '<i class="fa-solid fa-notes-medical"></i>';
            }
            fetchPatients(); // load immediately when viewing
        } else if (targetId === 'view-notifications') {
            viewTitle.innerText = 'Alertas Médicas y Eventos Serverless (Redis)';
            if (bannerIconContainer) {
                bannerIconContainer.innerHTML = '<i class="fa-solid fa-bolt-lightning"></i>';
            }
            fetchNotifications(); // load immediately
        } else if (targetId === 'view-lab-simulator') {
            viewTitle.innerText = 'Integración de Exámenes Clínicos (Broker)';
            if (bannerIconContainer) {
                bannerIconContainer.innerHTML = '<i class="fa-solid fa-flask-vial"></i>';
            }
            populateLabPatientsDropdown();
            // Trigger load of default payload template
            triggerLabTemplateLoad();
        } else if (targetId === 'view-config') {
            viewTitle.innerText = 'Configuración de Sistema y Parámetros';
            if (bannerIconContainer) {
                bannerIconContainer.innerHTML = '<i class="fa-solid fa-gears"></i>';
            }
            fetchUsers();
        }

        // Reapply role hidden constraints on viewpane switches
        applyRoleRestrictions(role);
    }

    // --- DATA INTEGRATION & SYNC ---
    
    // Auth headers helper
    function getAuthHeaders() {
        const token = sessionStorage.getItem('auth_token');
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };
    }

    // Handle unauthorized responses (401)
    function handleUnauthorized(response) {
        if (response.status === 401) {
            sessionStorage.removeItem('auth_token');
            sessionStorage.removeItem('auth_username');
            sessionStorage.removeItem('auth_role');
            checkAuth();
            showToast('<i class="fa-solid fa-triangle-exclamation"></i> Sesión expirada. Inicia sesión de nuevo.');
            return true;
        }
        return false;
    }

    function startSync() {
        stopSync(); // safety clear
        fetchPatients();
        fetchNotifications();
        pollIntervalNotifications = setInterval(fetchNotifications, 3000);
        pollIntervalLeads = setInterval(fetchPatients, 10000);
    }

    function stopSync() {
        if (pollIntervalLeads) clearInterval(pollIntervalLeads);
        if (pollIntervalNotifications) clearInterval(pollIntervalNotifications);
        pollIntervalLeads = null;
        pollIntervalNotifications = null;
        notificationsCache = [];
    }

    // Fetch Patients from Backend (MySQL)
    async function fetchPatients() {
        if (!sessionStorage.getItem('auth_token')) return;
        
        try {
            const response = await fetch('/api/v1/patients', {
                headers: getAuthHeaders()
            });
            
            if (handleUnauthorized(response)) return;
            if (!response.ok) throw new Error('Error al consultar base de datos');
            
            const data = await response.json();
            patientsCache = data;
            
            // Update UI components
            applyFiltersAndRender();
            updateDashboardMetrics(data);
            renderCharts(data);
            populateLabPatientsDropdown();
        } catch (error) {
            console.error('Error fetching patients:', error);
            patientsTableBody.innerHTML = `
                <tr>
                    <td colspan="10" class="empty-td" style="color: var(--color-danger);">
                        <i class="fa-solid fa-triangle-exclamation"></i> Error al conectar con el servidor MySQL.
                    </td>
                </tr>
            `;
        }
    }

    // Update Dashboard numeric metrics widgets
    function updateDashboardMetrics(patients) {
        const totalPatientsEl = document.getElementById('widget-total-patients');
        const criticalPatientsEl = document.getElementById('widget-critical-patients');
        const obsPatientsEl = document.getElementById('widget-obs-patients');

        if (!totalPatientsEl || !patients) return;

        const total = patients.length;
        const critical = patients.filter(p => p.estado === 'Crítico').length;
        const observation = patients.filter(p => p.estado === 'Observación').length;

        totalPatientsEl.innerText = total;
        criticalPatientsEl.innerText = critical;
        obsPatientsEl.innerText = observation;
    }

    // Render interactive charts using Chart.js
    function renderCharts(patients) {
        const statusCanvas = document.getElementById('chart-health-status');
        const specialtyCanvas = document.getElementById('chart-diagnoses');

        if (!statusCanvas || !specialtyCanvas || !patients) return;

        // --- 1. HEALTH STATUS CHART (DOUGHNUT) ---
        const criticalCount = patients.filter(p => p.estado === 'Crítico').length;
        const obsCount = patients.filter(p => p.estado === 'Observación').length;
        const stableCount = patients.filter(p => p.estado === 'Estable').length;

        if (statusChartInstance) statusChartInstance.destroy();
        statusChartInstance = new Chart(statusCanvas.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: ['Estable', 'Observación', 'Crítico'],
                datasets: [{
                    data: [stableCount, obsCount, criticalCount],
                    backgroundColor: [
                        'rgba(16, 185, 129, 0.6)',  // Green
                        'rgba(245, 158, 11, 0.6)',  // Yellow
                        'rgba(239, 68, 68, 0.6)'    // Red
                    ],
                    borderColor: [
                        '#10b981',
                        '#f59e0b',
                        '#ef4444'
                    ],
                    borderWidth: 1.5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#94a3b8',
                            font: { family: 'Outfit', size: 12 }
                        }
                    }
                }
            }
        });

        // --- 2. EXAM SPECIALTY CHART (BAR) ---
        const specialtiesMap = {};
        patients.forEach(p => {
            const spec = p.tipo_examen || 'General';
            specialtiesMap[spec] = (specialtiesMap[spec] || 0) + 1;
        });

        const specLabels = Object.keys(specialtiesMap);
        const specValues = Object.values(specialtiesMap);

        if (diagnosesChartInstance) diagnosesChartInstance.destroy();
        diagnosesChartInstance = new Chart(specialtyCanvas.getContext('2d'), {
            type: 'bar',
            data: {
                labels: specLabels,
                datasets: [{
                    label: 'Pacientes Asignados',
                    data: specValues,
                    backgroundColor: 'rgba(99, 102, 241, 0.5)', // Indigo
                    borderColor: '#6366f1',
                    borderWidth: 1.5,
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    x: {
                        ticks: { color: '#94a3b8', font: { family: 'Outfit' } },
                        grid: { color: 'rgba(255, 255, 255, 0.05)' }
                    },
                    y: {
                        ticks: { color: '#94a3b8', font: { family: 'Outfit', stepSize: 1 } },
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        beginAtZero: true
                    }
                }
            }
        });
    }

    // Fetch Notifications from Backend (Redis)
    async function fetchNotifications() {
        if (!sessionStorage.getItem('auth_token')) return;
        
        try {
            const response = await fetch('/api/v1/patients/notifications', {
                headers: getAuthHeaders()
            });
            
            if (handleUnauthorized(response)) return;
            if (!response.ok) throw new Error('Error al consultar caché de alertas');
            
            const data = await response.json();
            
            // Show toast on new alerts
            if (data.length > notificationsCache.length && notificationsCache.length > 0) {
                const latest = data[data.length - 1];
                showToast(`<i class="fa-solid fa-bell" style="color: var(--accent-green);"></i> Alerta Médica: ${latest.title}`);
            }

            notificationsCache = data;
            renderNotifications(data);
        } catch (error) {
            console.error('Error fetching notifications:', error);
        }
    }

    // Submit Patient Form (Create or Update)
    async function handleFormSubmit(e) {
        e.preventDefault();

        // Extract multiple email inputs
        const emailInputs = Array.from(document.querySelectorAll('.lead-email-input'))
            .map(input => input.value.trim())
            .filter(val => val !== '');
        const emailsStr = emailInputs.join(', ');

        // Extract multiple phone inputs (strip all spaces for DB storage)
        const phoneInputs = Array.from(document.querySelectorAll('.lead-telefono-input'))
            .map(input => input.value.replace(/\s+/g, '').trim())
            .filter(val => val !== '');
        const phonesStr = phoneInputs.join(', ');

        // Extract multiple project inputs
        const projectInputs = Array.from(document.querySelectorAll('.lead-proyecto-input'))
            .map(input => input.value.trim())
            .filter(val => val !== '');
        const projectsStr = projectInputs.join(', ');

        // Extract requirements type
        let reqsVal = document.getElementById('requerimientos').value;
        if (reqsVal === 'OTRO') {
            reqsVal = document.getElementById('requerimientos-otro').value.trim();
            if (!reqsVal) {
                showToast('<i class="fa-solid fa-triangle-exclamation" style="color: var(--color-danger);"></i> Por favor, especifique el examen personalizado.');
                return;
            }
        }

        // Extract extra details note and check vitals
        let detailsVal = document.getElementById('detalles-textarea').value.trim();
        const chkVitals = document.getElementById('chk-vitals');
        if (chkVitals && chkVitals.checked) {
            const temp = document.getElementById('vital-temp').value.trim();
            const fc = document.getElementById('vital-fc').value.trim();
            const sat = document.getElementById('vital-sat').value.trim();
            const pa = document.getElementById('vital-pa').value.trim();
            
            let vitalsStr = '';
            if (temp) vitalsStr += `Temp: ${temp}`;
            if (fc) vitalsStr += (vitalsStr ? ', ' : '') + `FC: ${fc}`;
            if (sat) vitalsStr += (vitalsStr ? ', ' : '') + `SatO2: ${sat}`;
            if (pa) vitalsStr += (vitalsStr ? ', ' : '') + `PA: ${pa}`;
            
            if (vitalsStr) {
                detailsVal = detailsVal ? `${detailsVal}\n\n[Signos Vitales: ${vitalsStr}]` : `[Signos Vitales: ${vitalsStr}]`;
            }
        }

        // Extract Lead Status and Meeting Date
        const statusVal = document.getElementById('lead-estado').value;
        const fechaCitaVal = document.getElementById('lead-fecha-cita').value;

        const patientData = {
            nombre: document.getElementById('nombre').value.trim(),
            email: emailsStr,
            telefono: phonesStr,
            diagnostico: projectsStr,
            tipo_examen: reqsVal,
            detalles: detailsVal || null,
            estado: statusVal,
            fecha_cita: fechaCitaVal || null
        };

        const btnSubmit = document.getElementById('btn-submit');
        const originalBtnContent = btnSubmit.innerHTML;
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = '<span>Procesando...</span> <i class="fa-solid fa-spinner fa-spin"></i>';

        const isEdit = editPatientId !== null;
        const targetUrl = isEdit ? `/api/v1/patients/${editPatientId}` : '/api/v1/patients';
        const targetMethod = isEdit ? 'PUT' : 'POST';

        try {
            const response = await fetch(targetUrl, {
                method: targetMethod,
                headers: getAuthHeaders(),
                body: JSON.stringify(patientData)
            });

            if (handleUnauthorized(response)) return;
            
            if (response.status === 403) {
                throw new Error('Se requieren permisos de Administrador para realizar esta acción.');
            }
            if (!response.ok) throw new Error('Error al guardar el paciente');

            // Reset form
            leadForm.reset();
            
            // Clean dynamic fields back to 1 input
            document.getElementById('email-fields-container').querySelectorAll('.dynamic-input-wrapper').forEach((el, idx) => {
                if (idx > 0) el.remove();
            });
            document.getElementById('telefono-fields-container').querySelectorAll('.dynamic-input-wrapper').forEach((el, idx) => {
                if (idx > 0) el.remove();
            });
            document.getElementById('proyecto-fields-container').querySelectorAll('.dynamic-input-wrapper').forEach((el, idx) => {
                if (idx > 0) el.remove();
            });
            document.getElementById('requerimientos-otro-container').classList.add('hidden');
            document.getElementById('requerimientos-otro').value = '';
            document.getElementById('requerimientos-otro').required = false;
            
            // Reset vitals checkbox and fields
            if (chkVitals && vitalsContainer) {
                chkVitals.checked = false;
                vitalsContainer.classList.add('hidden');
                document.getElementById('vital-temp').value = '';
                document.getElementById('vital-fc').value = '';
                document.getElementById('vital-sat').value = '';
                document.getElementById('vital-pa').value = '';
            }

            // Reset status & meeting fields
            document.getElementById('lead-estado').value = 'Estable';
            document.getElementById('fecha-cita-container').classList.add('hidden');
            document.getElementById('lead-fecha-cita').value = '';
            document.getElementById('lead-fecha-cita').required = false;

            if (isEdit) {
                editPatientId = null;
                document.querySelector('.form-card .card-header h3').innerText = 'Registro de Nuevo Paciente';
                document.getElementById('btn-submit').innerHTML = '<span>Registrar Paciente</span> <i class="fa-solid fa-paper-plane"></i>';
                showToast('<i class="fa-solid fa-circle-check" style="color: var(--color-success);"></i> Cambios guardados y publicados en la cola.');
            } else {
                showToast('<i class="fa-solid fa-circle-check" style="color: var(--color-success);"></i> Paciente registrado y publicado en la cola.');
            }

            // Redirect back to list view
            switchTab('view-list');

            // Pre-fetch updates after small delay for queue processing
            setTimeout(() => {
                fetchPatients();
                fetchNotifications();
            }, 1000);

        } catch (error) {
            console.error('Error submitting form:', error);
            showToast(`<i class="fa-solid fa-circle-xmark" style="color: var(--color-danger);"></i> ${error.message}`);
        } finally {
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = originalBtnContent;
        }
    }

    // Format phone number visually with spaces
    function formatPhoneVisual(phoneStr) {
        if (!phoneStr) return '-';
        
        const cleaned = phoneStr.replace(/\s+/g, '');
        
        if (cleaned.startsWith('+593') && cleaned.length === 13) {
            return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 6)} ${cleaned.slice(6, 9)} ${cleaned.slice(9)}`;
        }
        
        if (cleaned.startsWith('09') && cleaned.length === 10) {
            return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6)}`;
        }
        
        if (cleaned.length === 9) {
            return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6)}`;
        }
        
        if (cleaned.startsWith('+5932') && cleaned.length === 12) {
            return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 5)} ${cleaned.slice(5, 8)} ${cleaned.slice(8)}`;
        }
        
        return cleaned;
    }

    // Render Patients Table
    function renderLeads(leads) {
        const role = sessionStorage.getItem('auth_role');
        
        if (!leads || leads.length === 0) {
            patientsTableBody.innerHTML = `
                <tr>
                    <td colspan="10" class="empty-td">
                        <i class="fa-solid fa-folder-open"></i> No hay registros clínicos en MySQL.
                    </td>
                </tr>
            `;
            return;
        }

        patientsTableBody.innerHTML = leads.map(lead => {
            const date = new Date(lead.created_at).toLocaleString();
            
            // Format dynamic lists to display nicely
            const emailsList = lead.email.split(',').map(e => `<div>${e.trim()}</div>`).join('');
            const phonesList = lead.telefono.split(',').map(t => `<div>${formatPhoneVisual(t.trim())}</div>`).join('');
            const projectsList = lead.diagnostico.split(',').map(p => `<span class="project-tag block-tag"><i class="fa-solid fa-heart-pulse"></i> ${p.trim()}</span>`).join('');
            
            const detallesText = lead.detalles ? `<span class="detalles-cell" title="${lead.detalles}">${lead.detalles}</span>` : '<span class="text-muted">-</span>';
            
            // Format status badge and control date info
            const patientStatus = lead.estado || 'Estable';
            let estadoHtml = '';
            
            if (patientStatus === 'Crítico') {
                estadoHtml = `<span class="badge-status status-no-interesado" style="background-color: rgba(239, 68, 68, 0.1); border-color: var(--color-danger); color: #fca5a5;"><i class="fa-solid fa-circle-exclamation"></i> Crítico</span>`;
                if (lead.fecha_cita) {
                    const citaDate = new Date(lead.fecha_cita).toLocaleString();
                    estadoHtml += `<div class="cita-text" title="Control médico programado" style="color: #fca5a5;"><i class="fa-solid fa-calendar-day"></i> ${citaDate}</div>`;
                }
            } else if (patientStatus === 'Observación') {
                estadoHtml = `<span class="badge-status status-interesado" style="background-color: rgba(245, 158, 11, 0.1); border-color: var(--color-warning); color: #fde047;"><i class="fa-solid fa-triangle-exclamation"></i> Observación</span>`;
                if (lead.fecha_cita) {
                    const citaDate = new Date(lead.fecha_cita).toLocaleString();
                    estadoHtml += `<div class="cita-text" title="Control médico programado" style="color: #fde047;"><i class="fa-solid fa-calendar-day"></i> ${citaDate}</div>`;
                }
            } else { // Estable
                estadoHtml = `<span class="badge-status status-pendiente" style="background-color: rgba(16, 185, 129, 0.1); border-color: var(--color-success); color: #a7f3d0;"><i class="fa-solid fa-circle-check"></i> Estable</span>`;
            }

            // Hide action columns dynamically for doctor role
            const actionTd = (role === 'admin') ? `
                <td class="action-column">
                    <div class="table-actions">
                        <button class="btn-table-edit" onclick="editLead(${lead.id})" title="Editar Paciente"><i class="fa-solid fa-pen"></i></button>
                        <button class="btn-table-delete" onclick="deletePatient(${lead.id})" title="Borrar Ficha"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </td>
            ` : `<td class="action-column hidden"></td>`;
            
            return `
                <tr>
                    <td><strong>#${lead.id}</strong></td>
                    <td><div class="projects-cell">${projectsList}</div></td>
                    <td><strong>${lead.nombre}</strong></td>
                    <td><div class="emails-cell">${emailsList}</div></td>
                    <td><div class="phones-cell">${phonesList}</div></td>
                    <td><span class="badge-req">${lead.tipo_examen}</span></td>
                    <td><div class="estado-cell">${estadoHtml}</div></td>
                    <td>${detallesText}</td>
                    <td><span class="date-cell">${date}</span></td>
                    ${actionTd}
                </tr>
            `;
        }).join('');
    }

    // Render Notifications (Handles Badge Count and triggers filtering)
    function renderNotifications(notifications) {
        if (!notifications || notifications.length === 0) {
            notificationsList.innerHTML = `
                <div class="no-notifications">
                    <i class="fa-solid fa-circle-nodes"></i>
                    <p>Esperando eventos del Broker de Mensajería...</p>
                </div>
            `;
            notificationCount.innerText = '0';
            return;
        }

        notificationCount.innerText = notifications.length;
        applyFiltersAndRenderNotifications();
    }

    // Apply client-side filters for notifications
    function applyFiltersAndRenderNotifications() {
        const notifSearchInput = document.getElementById('notif-search-input');
        const notifFilterType = document.getElementById('notif-filter-type');
        
        const query = notifSearchInput ? notifSearchInput.value.toLowerCase().trim() : '';
        const filterType = notifFilterType ? notifFilterType.value : 'ALL';
        
        let result = [...notificationsCache];
        
        // 1. Search Query filter (checks title and message body)
        if (query !== '') {
            result = result.filter(notif => {
                const titleMatch = notif.title && notif.title.toLowerCase().includes(query);
                const msgMatch = notif.message && notif.message.toLowerCase().includes(query);
                return titleMatch || msgMatch;
            });
        }
        
        // 2. Type/Status category filter
        if (filterType !== 'ALL') {
            result = result.filter(notif => {
                const action = notif.action || 'created';
                const estado = notif.estado || 'Estable';
                
                if (filterType === 'CREATED') {
                    return action === 'created';
                } else if (filterType === 'INTERESADO') {
                    return estado === 'Crítico';
                } else if (filterType === 'DESCARTADO') {
                    return estado === 'Estable';
                } else if (filterType === 'UPDATED') {
                    return action === 'updated';
                } else if (filterType === 'DELETED') {
                    return action === 'deleted';
                }
                return true;
            });
        }
        
        renderNotificationsList(result);
    }

    // Render Notifications List HTML
    function renderNotificationsList(notifications) {
        if (!notifications || notifications.length === 0) {
            notificationsList.innerHTML = `
                <div class="no-notifications">
                    <i class="fa-solid fa-magnifying-glass"></i>
                    <p>No se encontraron alertas que coincidan con la búsqueda.</p>
                </div>
            `;
            return;
        }

        const sortedList = [...notifications].reverse();

        notificationsList.innerHTML = sortedList.map(notif => {
            const time = new Date(notif.timestamp).toLocaleTimeString();
            
            // Determine styling classes and icons based on action/status
            let notifClass = 'notif-created';
            let iconHtml = '<i class="fa-solid fa-circle-plus" style="color: var(--accent-green)"></i>';
            
            const action = notif.action || 'created';
            const estado = notif.estado || 'Estable';
            
            if (action === 'deleted') {
                notifClass = 'notif-deleted';
                iconHtml = '<i class="fa-solid fa-trash-can" style="color: #ef4444"></i>';
            } else if (action === 'updated' || action === 'created') {
                if (estado === 'Crítico') {
                    notifClass = 'notif-cita'; // Red alert card
                    iconHtml = '<i class="fa-solid fa-triangle-exclamation" style="color: #ef4444"></i>';
                } else if (estado === 'Observación') {
                    notifClass = 'notif-interesado'; // Yellow/Orange card
                    iconHtml = '<i class="fa-solid fa-heart-pulse" style="color: #f59e0b"></i>';
                } else { // Estable
                    notifClass = 'notif-created'; // Green alert card
                    iconHtml = '<i class="fa-solid fa-circle-check" style="color: #10b981"></i>';
                }
            }
            
            return `
                <div class="notification-item ${notifClass}">
                    <div class="notification-header">
                        <span class="notification-title">${iconHtml} ${notif.title}</span>
                        <span class="notification-time">${time}</span>
                    </div>
                    <p class="notification-body">${notif.message}</p>
                    <div class="notification-meta">
                        <span><i class="fa-solid fa-circle-nodes"></i> Trigger: RabbitMQ Queue</span>
                        <span><i class="fa-solid fa-bolt"></i> Lambda: Serverless Trigger</span>
                        <span><i class="fa-solid fa-database"></i> Cache: Redis</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Form submits & Refreshes
    leadForm.addEventListener('submit', handleFormSubmit);
    btnRefresh.addEventListener('click', () => {
        fetchPatients();
        fetchNotifications();
        showToast('<i class="fa-solid fa-sync fa-spin"></i> Sincronizando datos...');
    });

    // --- SEARCH, FILTER & EXPORT LOGIC ---
    function applyFiltersAndRender() {
        if (!patientsCache) return;
        
        const query = patientsSearchInput.value.toLowerCase().trim();
        const filterReq = patientsFilterRequirement.value;
        
        filteredLeads = patientsCache.filter(lead => {
            // Matches Search Query (ID, nombre, email, telefono, diagnostico)
            const matchesQuery = !query || 
                lead.id.toString().includes(query) ||
                lead.nombre.toLowerCase().includes(query) ||
                lead.email.toLowerCase().includes(query) ||
                lead.telefono.toLowerCase().includes(query) ||
                lead.diagnostico.toLowerCase().includes(query) ||
                lead.tipo_examen.toLowerCase().includes(query);
                
            // Matches Dropdown Requirement Filter
            const matchesReq = filterReq === 'ALL' || lead.tipo_examen === filterReq;
            
            return matchesQuery && matchesReq;
        });
        
        // Sort leads based on active sorting criteria
        filteredLeads.sort((a, b) => {
            let valA, valB;
            if (currentSortCol === 'id') {
                valA = Number(a.id);
                valB = Number(b.id);
            } else if (currentSortCol === 'created_at') {
                valA = new Date(a.created_at);
                valB = new Date(b.created_at);
            } else {
                // Map frontend property name to patient object key
                const prop = currentSortCol === 'nombre' ? 'nombre' : 
                             currentSortCol === 'proyecto' ? 'diagnostico' :
                             currentSortCol === 'email' ? 'email' :
                             currentSortCol === 'telefono' ? 'telefono' :
                             currentSortCol === 'requerimientos' ? 'tipo_examen' : currentSortCol;
                
                valA = (a[prop] || '').toString().toLowerCase();
                valB = (b[prop] || '').toString().toLowerCase();
            }
            
            if (valA < valB) return currentSortDir === 'asc' ? -1 : 1;
            if (valA > valB) return currentSortDir === 'asc' ? 1 : -1;
            return 0;
        });
        
        updateSortHeaders();
        renderLeads(filteredLeads);
    }

    function updateSortHeaders() {
        const headers = document.querySelectorAll('.leads-table th.sortable');
        headers.forEach(th => {
            const col = th.getAttribute('data-sort');
            const icon = th.querySelector('i');
            if (!icon) return;
            
            th.classList.remove('active-sort');
            
            if (col === currentSortCol) {
                th.classList.add('active-sort');
                if (currentSortDir === 'asc') {
                    icon.className = 'fa-solid fa-sort-up';
                } else {
                    icon.className = 'fa-solid fa-sort-down';
                }
            } else {
                icon.className = 'fa-solid fa-sort';
            }
        });
    }

    function exportJSON() {
        if (!filteredLeads || filteredLeads.length === 0) {
            showToast('<i class="fa-solid fa-triangle-exclamation" style="color: var(--color-danger);"></i> No hay registros para exportar.');
            return;
        }
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(filteredLeads, null, 2));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", "sgip_historial_clinico_nosql.json");
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
        showToast('<i class="fa-solid fa-file-code" style="color: var(--color-success);"></i> Documento NoSQL JSON exportado.');
    }

    function exportExcel() {
        if (!filteredLeads || filteredLeads.length === 0) {
            showToast('<i class="fa-solid fa-triangle-exclamation" style="color: var(--color-danger);"></i> No hay registros para exportar.');
            return;
        }
        // Create CSV format
        const headers = ["ID Historial Clinico", "Diagnostico Principal", "Paciente", "Emails de Contacto", "Telefono Emergencia", "Examen Solicitado", "Estado Salud", "Notas Clinicas", "Fecha de Registro"];
        const rows = filteredLeads.map(lead => [
            lead.id,
            `"${lead.diagnostico.replace(/"/g, '""')}"`,
            `"${lead.nombre.replace(/"/g, '""')}"`,
            `"${lead.email.replace(/"/g, '""')}"`,
            `"${lead.telefono.replace(/"/g, '""')}"`,
            `"${lead.tipo_examen.replace(/"/g, '""')}"`,
            `"${lead.estado}"`,
            `"${(lead.detalles || '').replace(/"/g, '""')}"`,
            `"${new Date(lead.created_at).toLocaleString()}"`
        ]);
        
        // Use BOM \uFEFF for Excel UTF-8 support
        const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", url);
        downloadAnchor.setAttribute("download", "sgip_reporte_excel.csv");
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
        showToast('<i class="fa-solid fa-file-excel" style="color: var(--color-success);"></i> Reporte CSV de Excel descargado.');
    }

    function exportImage() {
        if (!filteredLeads || filteredLeads.length === 0) {
            showToast('<i class="fa-solid fa-triangle-exclamation" style="color: var(--color-danger);"></i> No hay registros para exportar.');
            return;
        }
        showToast('<i class="fa-solid fa-spinner fa-spin"></i> Generando captura de imagen...');
        const target = document.getElementById('leads-table-to-export');
        
        setTimeout(() => {
            html2canvas(target, {
                backgroundColor: "#0f172a", // Match card background
                scale: 2, // High resolution
                logging: false
            }).then(canvas => {
                const link = document.createElement('a');
                link.download = 'sgip_reporte_imagen.png';
                link.href = canvas.toDataURL('image/png');
                document.body.appendChild(link);
                link.click();
                link.remove();
                showToast('<i class="fa-solid fa-file-image" style="color: var(--color-success);"></i> Captura PNG descargada.');
            }).catch(err => {
                console.error("Error generating canvas:", err);
                showToast('<i class="fa-solid fa-triangle-exclamation" style="color: var(--color-danger);"></i> Error al exportar imagen.');
            });
        }, 150);
    }

    // Binding Search/Filter & Export Event Listeners
    patientsSearchInput.addEventListener('input', applyFiltersAndRender);
    patientsFilterRequirement.addEventListener('change', applyFiltersAndRender);

    // Binding Search & Filter for Notifications
    const notifSearchInput = document.getElementById('notif-search-input');
    const notifFilterType = document.getElementById('notif-filter-type');
    if (notifSearchInput) notifSearchInput.addEventListener('input', applyFiltersAndRenderNotifications);
    if (notifFilterType) notifFilterType.addEventListener('change', applyFiltersAndRenderNotifications);

    // Bind sort click listener to header elements
    document.querySelectorAll('.leads-table th.sortable').forEach(th => {
        th.addEventListener('click', () => {
            const col = th.getAttribute('data-sort');
            if (currentSortCol === col) {
                currentSortDir = currentSortDir === 'asc' ? 'desc' : 'asc';
            } else {
                currentSortCol = col;
                currentSortDir = 'asc';
            }
            applyFiltersAndRender();
        });
    });
    
    exportSelect.addEventListener('change', (e) => {
        const value = e.target.value;
        if (value === 'JSON') {
            exportJSON();
        } else if (value === 'EXCEL') {
            exportExcel();
        } else if (value === 'IMAGE') {
            exportImage();
        }
        // Reset selection back to placeholder
        e.target.value = "";
    });

    // Bind Goto Create Patient button listener
    const btnGotoCreate = document.getElementById('btn-goto-create');
    btnGotoCreate.addEventListener('click', () => {
        // Reset edit mode
        editPatientId = null;
        leadForm.reset();
        
        // Reset card titles and buttons
        document.querySelector('.form-card .card-header h3').innerText = 'Registro de Nuevo Paciente';
        document.getElementById('btn-submit').innerHTML = '<span>Registrar Paciente</span> <i class="fa-solid fa-paper-plane"></i>';
        
        // Remove dynamic inputs except the first one
        document.getElementById('email-fields-container').querySelectorAll('.dynamic-input-wrapper').forEach((el, idx) => {
            if (idx > 0) el.remove();
        });
        document.getElementById('telefono-fields-container').querySelectorAll('.dynamic-input-wrapper').forEach((el, idx) => {
            if (idx > 0) el.remove();
        });
        document.getElementById('proyecto-fields-container').querySelectorAll('.dynamic-input-wrapper').forEach((el, idx) => {
            if (idx > 0) el.remove();
        });
        
        // Hide custom requirement input
        document.getElementById('requerimientos-otro-container').classList.add('hidden');
        document.getElementById('requerimientos-otro').value = '';
        document.getElementById('requerimientos-otro').required = false;

        // Reset status & meeting fields
        document.getElementById('lead-estado').value = 'Estable';
        document.getElementById('fecha-cita-container').classList.add('hidden');
        document.getElementById('lead-fecha-cita').value = '';
        document.getElementById('lead-fecha-cita').required = false;

        switchTab('view-form');
    });

    // Custom requirement toggle visibility listener
    const selectReqs = document.getElementById('requerimientos');
    const containerOtro = document.getElementById('requerimientos-otro-container');
    const inputOtro = document.getElementById('requerimientos-otro');

    selectReqs.addEventListener('change', () => {
        if (selectReqs.value === 'OTRO') {
            containerOtro.classList.remove('hidden');
            inputOtro.required = true;
            inputOtro.focus();
        } else {
            containerOtro.classList.add('hidden');
            inputOtro.value = '';
            inputOtro.required = false;
        }
    });

    // Patient status change listener (toggles visibility of control date picker)
    const selectEstado = document.getElementById('lead-estado');
    const containerCita = document.getElementById('fecha-cita-container');
    const inputCita = document.getElementById('lead-fecha-cita');
    
    selectEstado.addEventListener('change', () => {
        if (selectEstado.value !== 'Estable') {
            containerCita.classList.remove('hidden');
            inputCita.required = true;
            inputCita.focus();
        } else {
            containerCita.classList.add('hidden');
            inputCita.value = '';
            inputCita.required = false;
        }
    });

    // --- LABORATORY SIMULATOR HANDLERS (ADAPTER PATTERN) ---
    const labProviderSelect = document.getElementById('lab-provider');
    const labPayloadTextarea = document.getElementById('lab-payload');
    const labSimulatorForm = document.getElementById('lab-simulator-form');

    const labPatientsCheckboxList = document.getElementById('lab-patients-checkbox-list');
    const labPatientSearch = document.getElementById('lab-patient-search');
    const labFilterStatus = document.getElementById('lab-filter-status');
    const labFilterExam = document.getElementById('lab-filter-exam');

    function populateLabPatientsDropdown() {
        populateLabPatientsCheckboxes();
    }

    function populateLabPatientsCheckboxes() {
        if (!labPatientsCheckboxList || !patientsCache) return;

        const searchText = labPatientSearch ? labPatientSearch.value.toLowerCase().trim() : '';
        const filterStatus = labFilterStatus ? labFilterStatus.value : 'ALL';
        const filterExam = labFilterExam ? labFilterExam.value : 'ALL';

        // Save checked IDs to restore them
        const checkedIds = Array.from(document.querySelectorAll('.lab-patient-checkbox:checked')).map(cb => cb.value);

        labPatientsCheckboxList.innerHTML = '';

        let matchedCount = 0;
        patientsCache.forEach(p => {
            const matchSearch = !searchText || p.nombre.toLowerCase().includes(searchText) || p.id.toString().includes(searchText);
            const matchStatus = filterStatus === 'ALL' || p.estado === filterStatus;
            
            // Loose matching for exam names
            const examClean = p.tipo_examen.toLowerCase();
            const filterExamClean = filterExam.toLowerCase();
            const matchExam = filterExam === 'ALL' || examClean.includes(filterExamClean) || filterExamClean.includes(examClean);

            if (matchSearch && matchStatus && matchExam) {
                const isChecked = checkedIds.includes(p.id.toString()) ? 'checked' : '';
                
                const label = document.createElement('label');
                label.className = 'checkbox-row-item';
                label.style.display = 'flex';
                label.style.alignItems = 'center';
                label.style.gap = '0.8rem';
                label.style.cursor = 'pointer';
                label.style.padding = '6px 10px';
                label.style.borderRadius = '6px';
                label.style.transition = 'background 0.2s';
                label.style.color = 'var(--text-primary)';
                
                label.innerHTML = `
                    <input type="checkbox" value="${p.id}" class="lab-patient-checkbox" ${isChecked} style="width: auto; margin-right: 0.5rem; cursor: pointer;">
                    <span style="font-size: 0.85rem;">
                        <strong>#${p.id} - ${p.nombre}</strong> (${p.tipo_examen}) - 
                        <span class="badge" style="background-color: ${p.estado === 'Crítico' ? 'rgba(239, 68, 68, 0.2)' : p.estado === 'Observación' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(16, 185, 129, 0.2)'}; color: ${p.estado === 'Crítico' ? '#fca5a5' : p.estado === 'Observación' ? '#fde047' : '#a7f3d0'}; font-size: 0.7rem; padding: 2px 6px; border-radius: 4px;">${p.estado}</span>
                    </span>
                `;
                
                label.addEventListener('mouseenter', () => {
                    label.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                });
                label.addEventListener('mouseleave', () => {
                    label.style.backgroundColor = 'transparent';
                });
                
                labPatientsCheckboxList.appendChild(label);
                matchedCount++;
            }
        });

        if (matchedCount === 0) {
            labPatientsCheckboxList.innerHTML = '<div style="text-align: center; color: var(--text-secondary); font-size: 0.85rem; padding: 10px;">No hay pacientes coincidentes con los filtros.</div>';
        }

        // Bind event listeners to new checkboxes to auto-regenerate payload
        document.querySelectorAll('.lab-patient-checkbox').forEach(cb => {
            cb.addEventListener('change', triggerLabTemplateLoad);
        });
    }

    function triggerLabTemplateLoad() {
        const provider = labProviderSelect.value;
        const checkedBoxes = document.querySelectorAll('.lab-patient-checkbox:checked');
        
        if (checkedBoxes.length === 0) {
            if (provider === 'central_json') {
                labPayloadTextarea.value = JSON.stringify([], null, 4);
            } else {
                labPayloadTextarea.value = `<examenes>\n</examenes>`;
            }
            return;
        }

        const selectedPatients = [];
        checkedBoxes.forEach(cb => {
            const patient = patientsCache.find(p => p.id.toString() === cb.value);
            if (patient) {
                selectedPatients.push(patient);
            }
        });

        if (provider === 'central_json') {
            const jsonArray = selectedPatients.map(p => ({
                "patient_name": p.nombre,
                "lab_test": p.tipo_examen,
                "health_status": p.estado || "Estable",
                "observations": p.detalles || "Resultados normales."
            }));
            labPayloadTextarea.value = JSON.stringify(jsonArray, null, 4);
        } else if (provider === 'sanjose_xml') {
            let xmlContent = `<examenes>\n`;
            selectedPatients.forEach(p => {
                xmlContent += `    <exame>
        <nombre_paciente>${p.nombre}</nombre_paciente>
        <tipo>${p.tipo_examen}</tipo>
        <estado_salud>${p.estado || "Estable"}</estado_salud>
        <detalles_clinicos>${p.detalles || "Resultados normales."}</detalles_clinicos>
    </exame>\n`;
            });
            xmlContent += `</examenes>`;
            labPayloadTextarea.value = xmlContent;
        }
    }

    if (labProviderSelect) {
        labProviderSelect.addEventListener('change', triggerLabTemplateLoad);
    }

    if (labPatientSearch) {
        labPatientSearch.addEventListener('input', () => {
            populateLabPatientsCheckboxes();
        });
    }

    if (labFilterStatus) {
        labFilterStatus.addEventListener('change', () => {
            populateLabPatientsCheckboxes();
        });
    }

    if (labFilterExam) {
        labFilterExam.addEventListener('change', () => {
            populateLabPatientsCheckboxes();
        });
    }

    const btnSelectAllLab = document.getElementById('btn-select-all-lab');
    const btnSelectNoneLab = document.getElementById('btn-select-none-lab');

    if (btnSelectAllLab) {
        btnSelectAllLab.addEventListener('click', () => {
            document.querySelectorAll('.lab-patient-checkbox').forEach(cb => {
                cb.checked = true;
            });
            triggerLabTemplateLoad();
        });
    }

    if (btnSelectNoneLab) {
        btnSelectNoneLab.addEventListener('click', () => {
            document.querySelectorAll('.lab-patient-checkbox').forEach(cb => {
                cb.checked = false;
            });
            triggerLabTemplateLoad();
        });
    }

    if (labSimulatorForm) {
        labSimulatorForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const provider = labProviderSelect.value;
            const payload = labPayloadTextarea.value.trim();
            const btnSubmitSim = document.getElementById('btn-submit-simulator');
            const originalContent = btnSubmitSim.innerHTML;

            btnSubmitSim.disabled = true;
            btnSubmitSim.innerHTML = '<span>Adaptando y Procesando...</span> <i class="fa-solid fa-spinner fa-spin"></i>';

            try {
                const response = await fetch('/api/v1/patients/ingest-lab', {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({ provider, payload })
                });

                if (handleUnauthorized(response)) return;
                
                if (response.status === 403) {
                    throw new Error('Se requieren permisos de Administrador para procesar integraciones de laboratorios.');
                }
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.detail || 'Error en la pasarela de integración.');
                }

                showToast('<i class="fa-solid fa-circle-nodes" style="color: var(--color-success);"></i> Patrón Adapter ejecutado. Ficha integrada en MySQL y publicada en cola.');
                
                // Redirect to list view
                switchTab('view-list');

                // Delay refresh to allow queue trigger ingestion
                setTimeout(() => {
                    fetchPatients();
                    fetchNotifications();
                }, 1000);

            } catch (error) {
                console.error("Lab integration error:", error);
                showToast(`<i class="fa-solid fa-circle-xmark" style="color: var(--color-danger);"></i> ${error.message}`);
            } finally {
                btnSubmitSim.disabled = false;
                btnSubmitSim.innerHTML = originalContent;
            }
        });
    }

    // --- PASARELA IMPORT / EXPORT / PRINT ACTIONS ---
    const btnImportFileTrigger = document.getElementById('btn-import-file-trigger');
    const labFileInput = document.getElementById('lab-file-input');
    const btnExportPayload = document.getElementById('btn-export-payload');
    const btnPrintPayload = document.getElementById('btn-print-payload');

    if (btnImportFileTrigger && labFileInput) {
        btnImportFileTrigger.addEventListener('click', () => {
            labFileInput.click();
        });

        labFileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = function(evt) {
                const textContent = evt.target.result.trim();
                labPayloadTextarea.value = textContent;

                // Auto-detect format by checking for opening tags
                if (textContent.startsWith('<')) {
                    labProviderSelect.value = 'sanjose_xml';
                    showToast('<i class="fa-solid fa-file-code" style="color: var(--accent-indigo);"></i> Archivo XML importado y adaptado automáticamente.');
                } else {
                    labProviderSelect.value = 'central_json';
                    showToast('<i class="fa-solid fa-file-code" style="color: var(--accent-indigo);"></i> Archivo JSON importado y adaptado automáticamente.');
                }
            };
            reader.readAsText(file);
            // Clear to allow re-upload
            labFileInput.value = '';
        });
    }

    if (btnExportPayload) {
        btnExportPayload.addEventListener('click', () => {
            const provider = labProviderSelect.value;
            const payload = labPayloadTextarea.value.trim();
            if (!payload) {
                showToast('<i class="fa-solid fa-triangle-exclamation" style="color: var(--color-warning);"></i> El informe de examen está vacío.');
                return;
            }

            const filename = provider === 'sanjose_xml' ? 'sanjose_xml_report.xml' : 'central_json_report.json';
            const mimeType = provider === 'sanjose_xml' ? 'application/xml' : 'application/json';

            const blob = new Blob([payload], { type: mimeType });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            showToast(`<i class="fa-solid fa-file-arrow-down" style="color: var(--color-success);"></i> Archivo ${filename} descargado con éxito.`);
        });
    }

    if (btnPrintPayload) {
        btnPrintPayload.addEventListener('click', () => {
            const provider = labProviderSelect.value;
            const payload = labPayloadTextarea.value.trim();
            if (!payload) {
                showToast('<i class="fa-solid fa-triangle-exclamation" style="color: var(--color-warning);"></i> El informe de examen está vacío.');
                return;
            }

            const providerName = provider === 'sanjose_xml' ? 'Lab Genética San José (Formato XML)' : 'Laboratorio Central (Formato JSON)';
            const currentDate = new Date().toLocaleString('es-EC');

            let patientsToPrint = [];

            try {
                if (provider === 'central_json') {
                    const parsed = JSON.parse(payload);
                    if (Array.isArray(parsed)) {
                        parsed.forEach(item => {
                            patientsToPrint.push({
                                name: item.patient_name || "No especificado",
                                test: item.lab_test || "Examen General",
                                status: item.health_status || "Estable",
                                details: item.observations || "N/A"
                            });
                        });
                    } else {
                        patientsToPrint.push({
                            name: parsed.patient_name || "No especificado",
                            test: parsed.lab_test || "Examen General",
                            status: parsed.health_status || "Estable",
                            details: parsed.observations || "N/A"
                        });
                    }
                } else {
                    // XML parser for multiple exams
                    const exameBlocks = payload.match(/<exame>[\s\S]*?<\/exame>/g);
                    if (exameBlocks && exameBlocks.length > 0) {
                        exameBlocks.forEach(block => {
                            const nameMatch = block.match(/<nombre_paciente>(.*?)<\/nombre_paciente>/);
                            const testMatch = block.match(/<tipo>(.*?)<\/tipo>/);
                            const statusMatch = block.match(/<estado_salud>(.*?)<\/estado_salud>/);
                            const detailsMatch = block.match(/<detalles_clinicos>(.*?)<\/detalles_clinicos>/);

                            patientsToPrint.push({
                                name: nameMatch ? nameMatch[1] : "No especificado",
                                test: testMatch ? testMatch[1] : "Examen General",
                                status: statusMatch ? statusMatch[1] : "Estable",
                                details: detailsMatch ? detailsMatch[1] : "N/A"
                            });
                        });
                    } else {
                        const nameMatch = payload.match(/<nombre_paciente>(.*?)<\/nombre_paciente>/);
                        const testMatch = payload.match(/<tipo>(.*?)<\/tipo>/);
                        const statusMatch = payload.match(/<estado_salud>(.*?)<\/estado_salud>/);
                        const detailsMatch = payload.match(/<detalles_clinicos>(.*?)<\/detalles_clinicos>/);

                        patientsToPrint.push({
                            name: nameMatch ? nameMatch[1] : "No especificado",
                            test: testMatch ? testMatch[1] : "Examen General",
                            status: statusMatch ? statusMatch[1] : "Estable",
                            details: detailsMatch ? detailsMatch[1] : "N/A"
                        });
                    }
                }
            } catch (e) {
                console.warn("Could not parse payload for print:", e);
                patientsToPrint.push({
                    name: "Error de lectura de plantilla",
                    test: "N/A",
                    status: "N/A",
                    details: "Asegúrese de seleccionar pacientes e ingresar un formato JSON/XML válido."
                });
            }

            // Generate HTML sub-cards for each patient dynamically
            let patientsHtml = '';
            patientsToPrint.forEach((p, idx) => {
                patientsHtml += `
                    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
                        <h4 style="margin-top: 0; color: #0d9488; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">Registro #${idx + 1}: ${p.name}</h4>
                        <div class="info-grid">
                            <div class="info-item">
                                <div class="info-label">Tipo de Examen</div>
                                <div class="info-value">${p.test}</div>
                            </div>
                            <div class="info-item">
                                <div class="info-label">Estado de Salud</div>
                                <div class="info-value">${p.status}</div>
                            </div>
                            <div class="info-item" style="grid-column: span 2; margin-top: 10px;">
                                <div class="info-label">Detalles y Evolución</div>
                                <div class="info-value">${p.details}</div>
                            </div>
                        </div>
                    </div>
                `;
            });

            const printWindow = window.open('', '_blank');
            printWindow.document.write(`
                <html>
                <head>
                    <title>Reporte de Recepción Clínica - SGIP</title>
                    <style>
                        body {
                            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
                            color: #1e293b;
                            background-color: #f8fafc;
                            margin: 0;
                            padding: 40px;
                            line-height: 1.5;
                        }
                        .print-container {
                            max-width: 800px;
                            margin: 0 auto;
                            background-color: #ffffff;
                            border: 1px solid #e2e8f0;
                            border-radius: 12px;
                            padding: 40px;
                            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1);
                        }
                        .header {
                            text-align: center;
                            border-bottom: 2px solid #0d9488;
                            padding-bottom: 20px;
                            margin-bottom: 20px;
                        }
                        .logo {
                            font-size: 24px;
                            font-weight: 700;
                            color: #0d9488;
                        }
                        .subtitle {
                            font-size: 12px;
                            color: #64748b;
                            margin-top: 5px;
                        }
                        .info-grid {
                            display: grid;
                            grid-template-columns: 1fr 1fr;
                            gap: 15px;
                        }
                        .info-item {
                            background-color: #ffffff;
                            border: 1px solid #e2e8f0;
                            padding: 10px 15px;
                            border-radius: 6px;
                        }
                        .info-label {
                            font-size: 11px;
                            color: #64748b;
                            text-transform: uppercase;
                            font-weight: 600;
                            margin-bottom: 4px;
                        }
                        .info-value {
                            font-size: 14px;
                            font-weight: 600;
                        }
                        .payload-title {
                            font-size: 14px;
                            font-weight: 700;
                            color: #0d9488;
                            margin-bottom: 10px;
                            border-bottom: 1px solid #cbd5e1;
                            padding-bottom: 5px;
                            margin-top: 30px;
                        }
                        pre {
                            background-color: #f1f5f9;
                            border: 1px solid #cbd5e1;
                            padding: 15px;
                            border-radius: 6px;
                            overflow-x: auto;
                            font-family: 'Courier New', Courier, monospace;
                            font-size: 13px;
                            margin-bottom: 40px;
                        }
                        .signature-section {
                            margin-top: 50px;
                            display: flex;
                            justify-content: space-between;
                        }
                        .signature-line {
                            width: 200px;
                            border-top: 1px solid #64748b;
                            text-align: center;
                            font-size: 12px;
                            color: #64748b;
                            padding-top: 5px;
                            margin-top: 40px;
                        }
                        @media print {
                            body {
                                background-color: transparent;
                                padding: 0;
                            }
                            .print-container {
                                border: none;
                                box-shadow: none;
                                padding: 0;
                                max-width: 100%;
                            }
                        }
                    </style>
                </head>
                <body>
                    <div class="print-container">
                        <div class="header">
                            <div class="logo">SGIP - PORTAL CLINICO DE PACIENTES</div>
                            <div class="subtitle">Pasarela de Integración de Exámenes Clínicos Externos (${patientsToPrint.length} Registros)</div>
                        </div>
                        
                        <!-- List of Patient Cards -->
                        ${patientsHtml}
                        
                        <div class="payload-title">Contenido Crudo del Informe Integrado (Payload)</div>
                        <pre>${escapeHtml(payload)}</pre>
                        
                        <div class="signature-section">
                            <div class="signature-line">Firma del Médico Validador</div>
                            <div class="signature-line">Firma del Laboratorio Emisor</div>
                        </div>
                    </div>
                    
                    <script>
                        window.onload = function() {
                            window.print();
                            window.onafterprint = function() {
                                window.close();
                            };
                        }
                    </script>
                </body>
                </html>
            `);
            printWindow.document.close();
        });
    }

    function escapeHtml(text) {
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // Edit Patient (Exposed Globally)
    window.editLead = function(id) {
        const lead = patientsCache.find(l => l.id === id);
        if (!lead) return;
        
        editPatientId = id;
        
        // Populate standard inputs
        document.getElementById('nombre').value = lead.nombre;
        
        // Parse and populate vitals from details string
        const details = lead.detalles || '';
        const chkVitals = document.getElementById('chk-vitals');
        const vitalsContainer = document.getElementById('vitals-container');
        
        if (chkVitals && vitalsContainer) {
            const tempMatch = details.match(/(?:Temp|Temperatura):\s*(\d+\.?\d*)/i);
            const fcMatch = details.match(/(?:FC|Frecuencia\s+Card[ií]aca|Pulso):\s*(\d+)/i);
            const satMatch = details.match(/(?:SatO2|SpO2|Saturaci[oó]n):\s*(\d+)/i);
            const paMatch = details.match(/(?:PA|Presi[oó]n\s+Arterial|Presi[oó]n):\s*(\d+\/\d+)/i);
            
            if (tempMatch || fcMatch || satMatch || paMatch) {
                chkVitals.checked = true;
                vitalsContainer.classList.remove('hidden');
                document.getElementById('vital-temp').value = tempMatch ? tempMatch[1] : '';
                document.getElementById('vital-fc').value = fcMatch ? fcMatch[1] : '';
                document.getElementById('vital-sat').value = satMatch ? satMatch[1] : '';
                document.getElementById('vital-pa').value = paMatch ? paMatch[1] : '';
                
                // Clean the details textarea of the vitals string block
                document.getElementById('detalles-textarea').value = details.replace(/\s*\[Signos Vitales:.*?\]/i, '').trim();
            } else {
                chkVitals.checked = false;
                vitalsContainer.classList.add('hidden');
                document.getElementById('vital-temp').value = '';
                document.getElementById('vital-fc').value = '';
                document.getElementById('vital-sat').value = '';
                document.getElementById('vital-pa').value = '';
                document.getElementById('detalles-textarea').value = details;
            }
        } else {
            document.getElementById('detalles-textarea').value = details;
        }
        
        // Populate dynamic emails
        const emailContainer = document.getElementById('email-fields-container');
        emailContainer.querySelectorAll('.dynamic-input-wrapper').forEach(el => el.remove());
        const emails = lead.email.split(',');
        emails.forEach((emailVal, idx) => {
            const wrapper = document.createElement('div');
            wrapper.className = 'dynamic-input-wrapper';
            wrapper.innerHTML = `
                <input type="email" class="lead-email-input" placeholder="Ej. contacto@edificio.com" required value="${emailVal.trim()}">
                ${idx > 0 ? `
                <button type="button" class="btn-remove-input" onclick="this.parentElement.remove()">
                    <i class="fa-solid fa-minus"></i>
                </button>` : ''}
            `;
            emailContainer.appendChild(wrapper);
        });

        // Populate dynamic phones
        const phoneContainer = document.getElementById('telefono-fields-container');
        phoneContainer.querySelectorAll('.dynamic-input-wrapper').forEach(el => el.remove());
        const phones = lead.telefono.split(',');
        phones.forEach((phoneVal, idx) => {
            const wrapper = document.createElement('div');
            wrapper.className = 'dynamic-input-wrapper';
            wrapper.innerHTML = `
                <input type="text" class="lead-telefono-input" placeholder="Ej. +593 999999999" required value="${phoneVal.trim()}">
                ${idx > 0 ? `
                <button type="button" class="btn-remove-input" onclick="this.parentElement.remove()">
                    <i class="fa-solid fa-minus"></i>
                </button>` : ''}
            `;
            phoneContainer.appendChild(wrapper);
        });

        // Populate dynamic projects
        const projectContainer = document.getElementById('proyecto-fields-container');
        projectContainer.querySelectorAll('.dynamic-input-wrapper').forEach(el => el.remove());
        const projects = lead.diagnostico.split(',');
        projects.forEach((projVal, idx) => {
            const wrapper = document.createElement('div');
            wrapper.className = 'dynamic-input-wrapper';
            wrapper.innerHTML = `
                <input type="text" class="lead-proyecto-input" placeholder="Ej. Torre Elite Plaza" required value="${projVal.trim()}">
                ${idx > 0 ? `
                <button type="button" class="btn-remove-input" onclick="this.parentElement.remove()">
                    <i class="fa-solid fa-minus"></i>
                </button>` : ''}
            `;
            projectContainer.appendChild(wrapper);
        });

        // Populate requirements
        const standardOptions = [
            "Hemograma Completo & Sangre",
            "Ecocardiograma Transtorácico",
            "Ecografía de Abdomen Completo",
            "Perfil Renal & Electrólitos",
            "Holter de Ritmo Cardíaco 24h"
        ];
        
        if (standardOptions.includes(lead.tipo_examen)) {
            selectReqs.value = lead.tipo_examen;
            containerOtro.classList.add('hidden');
            inputOtro.value = '';
            inputOtro.required = false;
        } else {
            selectReqs.value = "OTRO";
            containerOtro.classList.remove('hidden');
            inputOtro.value = lead.tipo_examen;
            inputOtro.required = true;
        }

        // Populate status and control date fields
        const leadEstado = lead.estado || 'Estable';
        document.getElementById('lead-estado').value = leadEstado;
        
        const fechaCitaContainer = document.getElementById('fecha-cita-container');
        const leadFechaCita = document.getElementById('lead-fecha-cita');
        
        if (leadEstado !== 'Estable') {
            fechaCitaContainer.classList.remove('hidden');
            leadFechaCita.value = lead.fecha_cita || '';
        } else {
            fechaCitaContainer.classList.add('hidden');
            leadFechaCita.value = '';
        }

        // Update form titles
        document.querySelector('.form-card .card-header h3').innerText = 'Editar Ficha del Paciente';
        document.getElementById('btn-submit').innerHTML = '<span>Guardar Cambios</span> <i class="fa-solid fa-floppy-disk"></i>';
        
        switchTab('view-form');
    };

    // Delete Patient (Exposed Globally)
    window.deletePatient = async function(id) {
        if (!confirm(`¿Está seguro de que desea eliminar el paciente #${id}? Esta acción eliminará permanentemente el registro.`)) {
            return;
        }
        
        try {
            const response = await fetch(`/api/v1/patients/${id}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });
            
            if (handleUnauthorized(response)) return;
            
            if (response.status === 403) {
                throw new Error('Se requieren permisos de Administrador para eliminar registros.');
            }
            if (!response.ok) throw new Error('Error al eliminar el paciente');
            
            showToast('<i class="fa-solid fa-trash-can" style="color: var(--color-success);"></i> Paciente eliminado de MySQL.');
            fetchPatients();
        } catch (error) {
            console.error('Error deleting patient:', error);
            showToast(`<i class="fa-solid fa-triangle-exclamation" style="color: var(--color-danger);"></i> ${error.message}`);
        }
    };

    // Dynamic inputs adder (Exposed Globally)
    window.addDynamicField = function(containerId, inputClass, placeholder, inputType) {
        const container = document.getElementById(containerId);
        const wrapper = document.createElement('div');
        wrapper.className = 'dynamic-input-wrapper';
        wrapper.innerHTML = `
            <input type="${inputType}" class="${inputClass}" placeholder="${placeholder}" required>
            <button type="button" class="btn-remove-input" onclick="this.parentElement.remove()">
                <i class="fa-solid fa-minus"></i>
            </button>
        `;
        container.appendChild(wrapper);
    };

    // Clear Notification History Click Listener
    const btnClearNotifications = document.getElementById('btn-clear-notifications');
    btnClearNotifications.addEventListener('click', async () => {
        if (!confirm('¿Está seguro de que desea limpiar todo el historial de alertas en Redis?')) {
            return;
        }
        
        try {
            const response = await fetch('/api/v1/patients/notifications', {
                method: 'DELETE',
                headers: getAuthHeaders()
            });
            
            if (handleUnauthorized(response)) return;
            if (!response.ok) throw new Error('Error al limpiar el historial de alertas');
            
            showToast('<i class="fa-solid fa-trash-can" style="color: var(--color-success);"></i> Historial de alertas limpiado en Redis.');
            notificationsCache = [];
            renderNotifications([]);
        } catch (error) {
            console.error('Error clearing notifications:', error);
            showToast('<i class="fa-solid fa-triangle-exclamation" style="color: var(--color-danger);"></i> Error al limpiar historial de alertas.');
        }
    });

    // Toast alert helper
    function showToast(message) {
        const toast = document.getElementById('toast');
        if (!toast) return;
        toast.innerHTML = message;
        toast.classList.remove('hidden');
        
        setTimeout(() => {
            toast.classList.add('hidden');
        }, 4000);
    }

    // Colors Legend Modal event listeners
    const btnShowLegend = document.getElementById('btn-show-legend');
    const legendModal = document.getElementById('legend-modal');
    const btnCloseLegendModal = document.getElementById('btn-close-legend-modal');
    const btnCloseLegendBtn = document.getElementById('btn-close-legend-btn');

    if (btnShowLegend && legendModal) {
        btnShowLegend.addEventListener('click', () => {
            legendModal.classList.remove('hidden');
        });
    }

    const closeLegendModal = () => {
        if (legendModal) legendModal.classList.add('hidden');
    };

    if (btnCloseLegendModal) btnCloseLegendModal.addEventListener('click', closeLegendModal);
    if (btnCloseLegendBtn) btnCloseLegendBtn.addEventListener('click', closeLegendModal);

    // Close modal if user clicks outside of the modal box
    window.addEventListener('click', (e) => {
        if (e.target === legendModal) {
            closeLegendModal();
        }
        if (e.target === modalUser) {
            closeUserModal();
        }
    });

    // --- USER CRUD MANAGEMENT (ADMIN ONLY) ---
    const btnOpenUserModal = document.getElementById('btn-open-user-modal');
    const modalUser = document.getElementById('modal-user');
    const btnCloseUserModal = document.getElementById('btn-close-user-modal');
    const btnCancelUserModal = document.getElementById('btn-cancel-user-modal');
    const userCreateForm = document.getElementById('user-create-form');
    const configUsersTbody = document.getElementById('config-users-tbody');
    const configParamsForm = document.getElementById('config-params-form');

    // Load custom configuration params on start
    loadConfigParams();

    function loadConfigParams() {
        const limit = localStorage.getItem('sgip_redis_limit') || '50';
        const email = localStorage.getItem('sgip_support_email') || 'soporte@sgip.gob.ec';
        const interval = localStorage.getItem('sgip_telemetry_interval') || '10';

        const limitEl = document.getElementById('config-redis-limit');
        const emailEl = document.getElementById('config-support-email');
        const intervalEl = document.getElementById('config-telemetry-interval');

        if (limitEl) limitEl.value = limit;
        if (emailEl) emailEl.value = email;
        if (intervalEl) intervalEl.value = interval;
    }

    if (configParamsForm) {
        configParamsForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const limit = document.getElementById('config-redis-limit').value;
            const email = document.getElementById('config-support-email').value;
            const interval = document.getElementById('config-telemetry-interval').value;

            localStorage.setItem('sgip_redis_limit', limit);
            localStorage.setItem('sgip_support_email', email);
            localStorage.setItem('sgip_telemetry_interval', interval);

            showToast('<i class="fa-solid fa-floppy-disk" style="color: var(--color-success);"></i> Parámetros de servidor guardados con éxito en almacenamiento persistente.');
        });
    }

    // Modal Control
    if (btnOpenUserModal) {
        btnOpenUserModal.addEventListener('click', () => {
            modalUser.classList.remove('hidden');
        });
    }

    function closeUserModal() {
        if (modalUser) {
            modalUser.classList.add('hidden');
            userCreateForm.reset();
            // Reset to create mode
            const modalTitle = document.getElementById('modal-user-title');
            const modalIcon = document.getElementById('modal-user-icon');
            const submitBtn = document.getElementById('btn-submit-user');
            const passwordHint = document.getElementById('password-hint');
            const originalUsernameInput = document.getElementById('edit-user-original-username');
            if (modalTitle) modalTitle.textContent = 'Registrar Personal Médico';
            if (modalIcon) { modalIcon.className = 'fa-solid fa-user-plus modal-header-icon'; modalIcon.style.color = 'var(--accent-green)'; }
            if (submitBtn) submitBtn.textContent = 'Registrar Usuario';
            if (passwordHint) passwordHint.style.display = 'none';
            if (originalUsernameInput) originalUsernameInput.value = '';
        }
    }

    if (btnCloseUserModal) btnCloseUserModal.addEventListener('click', closeUserModal);
    if (btnCancelUserModal) btnCancelUserModal.addEventListener('click', closeUserModal);

    // Fetch and render users
    async function fetchUsers() {
        if (!configUsersTbody) return;
        
        try {
            const response = await fetch('/api/v1/users', {
                method: 'GET',
                headers: getAuthHeaders()
            });

            if (handleUnauthorized(response)) return;
            if (!response.ok) {
                throw new Error('Error al consultar usuarios del sistema.');
            }

            const users = await response.json();
            renderUsersTable(users);
        } catch (error) {
            console.error("Fetch users error:", error);
            configUsersTbody.innerHTML = `<tr><td colspan="5" style="color: var(--color-danger); text-align: center;"><i class="fa-solid fa-circle-xmark"></i> ${error.message}</td></tr>`;
        }
    }

    function renderUsersTable(users) {
        configUsersTbody.innerHTML = '';
        if (users.length === 0) {
            configUsersTbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-secondary); padding: 2rem;">No hay usuarios registrados.</td></tr>';
            return;
        }

        const loggedInUsername = sessionStorage.getItem('auth_username');

        users.forEach(u => {
            const isSelf = u.username === loggedInUsername;
            const isDefault = u.username === 'admin' || u.username === 'doctor';

            let actionBtns = '';
            if (isSelf) {
                actionBtns = `<div class="table-actions"><span class="badge" style="background-color: var(--accent-indigo); font-size: 0.72rem; padding: 0.3rem 0.7rem;">Tú</span></div>`;
            } else if (isDefault) {
                // Default accounts: can edit but not delete
                actionBtns = `
                    <div class="table-actions">
                        <button type="button" class="btn-table-edit" onclick="editUser('${u.username}', '${u.role}')" title="Editar cuenta">
                            <i class="fa-solid fa-pen-to-square"></i>
                        </button>
                        <span class="badge" style="background-color: rgba(255,255,255,0.05); color: var(--text-secondary); font-size: 0.68rem; padding: 0.25rem 0.5rem; white-space: nowrap;">Protegido</span>
                    </div>
                `;
            } else {
                actionBtns = `
                    <div class="table-actions">
                        <button type="button" class="btn-table-edit" onclick="editUser('${u.username}', '${u.role}')" title="Editar cuenta">
                            <i class="fa-solid fa-pen-to-square"></i>
                        </button>
                        <button type="button" class="btn-table-delete" onclick="deleteUser('${u.username}')" title="Eliminar médico">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                `;
            }

            const formattedDate = new Date(u.created_at).toLocaleDateString('es-EC');
            const roleColor = u.role === 'admin' ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)';
            const roleBorder = u.role === 'admin' ? 'rgba(239,68,68,0.4)' : 'rgba(34,197,94,0.4)';
            const roleText = u.role === 'admin' ? '#f87171' : '#4ade80';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="color: var(--text-secondary); font-size: 0.82rem;">#${u.id}</td>
                <td>
                    <div style="display: flex; align-items: center; gap: 0.6rem;">
                        <div style="width: 34px; height: 34px; border-radius: 50%; background: linear-gradient(135deg, var(--accent-indigo), var(--accent-green)); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.8rem; flex-shrink: 0;">
                            ${u.username.charAt(0).toUpperCase()}
                        </div>
                        <strong>${u.username}</strong>
                    </div>
                </td>
                <td>
                    <span style="background-color: ${roleColor}; border: 1px solid ${roleBorder}; color: ${roleText}; font-size: 0.75rem; padding: 0.25rem 0.65rem; border-radius: 20px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px;">
                        ${u.role}
                    </span>
                </td>
                <td style="color: var(--text-secondary); font-size: 0.85rem;">${formattedDate}</td>
                <td style="text-align: center;">${actionBtns}</td>
            `;
            configUsersTbody.appendChild(tr);
        });
    }

    // Expose editUser globally
    window.editUser = function(username, role) {
        const modalTitle = document.getElementById('modal-user-title');
        const modalIcon = document.getElementById('modal-user-icon');
        const submitBtn = document.getElementById('btn-submit-user');
        const passwordHint = document.getElementById('password-hint');
        const originalUsernameInput = document.getElementById('edit-user-original-username');

        // Set modal to edit mode
        if (modalTitle) modalTitle.textContent = 'Editar Cuenta Médica';
        if (modalIcon) { modalIcon.className = 'fa-solid fa-user-pen modal-header-icon'; modalIcon.style.color = '#38bdf8'; }
        if (submitBtn) submitBtn.textContent = 'Guardar Cambios';
        if (passwordHint) passwordHint.style.display = 'inline';

        document.getElementById('new-user-username').value = username;
        document.getElementById('new-user-password').value = '';
        document.getElementById('new-user-role').value = role;
        if (originalUsernameInput) originalUsernameInput.value = username;

        // Show modal
        document.getElementById('modal-user').classList.remove('hidden');
    };

    // Create / Edit user handler
    if (userCreateForm) {
        userCreateForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const username = document.getElementById('new-user-username').value.trim();
            const password = document.getElementById('new-user-password').value;
            const role = document.getElementById('new-user-role').value;
            const originalUsername = document.getElementById('edit-user-original-username')?.value || '';
            const isEditMode = originalUsername.length > 0;

            // Password required only when creating
            if (!isEditMode && password.length < 6) {
                showToast('<i class="fa-solid fa-triangle-exclamation" style="color: var(--color-warning);"></i> La contraseña debe tener al menos 6 caracteres.');
                return;
            }
            if (isEditMode && password.length > 0 && password.length < 6) {
                showToast('<i class="fa-solid fa-triangle-exclamation" style="color: var(--color-warning);"></i> La contraseña debe tener al menos 6 caracteres o dejarse vacía.');
                return;
            }

            try {
                let response;
                if (isEditMode) {
                    // PATCH / PUT to update user
                    const body = { role };
                    if (password) body.password = password;
                    response = await fetch(`/api/v1/users/${originalUsername}`, {
                        method: 'PUT',
                        headers: getAuthHeaders(),
                        body: JSON.stringify(body)
                    });
                } else {
                    // POST to create user
                    response = await fetch('/api/v1/users', {
                        method: 'POST',
                        headers: getAuthHeaders(),
                        body: JSON.stringify({ username, password, role })
                    });
                }

                if (handleUnauthorized(response)) return;
                if (!response.ok) {
                    const err = await response.json();
                    throw new Error(err.detail || (isEditMode ? 'Error al actualizar la cuenta.' : 'Error al crear la cuenta médica.'));
                }

                showToast(`<i class="fa-solid fa-user-check" style="color: var(--color-success);"></i> Cuenta '${isEditMode ? originalUsername : username}' ${isEditMode ? 'actualizada' : 'registrada'} exitosamente.`);
                closeUserModal();
                fetchUsers();
            } catch (error) {
                console.error("User save error:", error);
                showToast(`<i class="fa-solid fa-circle-xmark" style="color: var(--color-danger);"></i> ${error.message}`);
            }
        });
    }

    // Delete user handler exposing globally
    window.deleteUser = async function(username) {
        if (!confirm(`¿Está seguro de eliminar de forma permanente la cuenta médica '${username}'?`)) {
            return;
        }

        try {
            const response = await fetch(`/api/v1/users/${username}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });

            if (handleUnauthorized(response)) return;
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.detail || 'Error al eliminar la cuenta médica.');
            }

            showToast(`<i class="fa-solid fa-user-slash" style="color: var(--color-success);"></i> Usuario médico '${username}' eliminado de MySQL.`);
            fetchUsers();
        } catch (error) {
            console.error("Delete user error:", error);
            showToast(`<i class="fa-solid fa-circle-xmark" style="color: var(--color-danger);"></i> ${error.message}`);
        }
    }
});
