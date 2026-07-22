console.log('ESTA ES LA VERSIÓN NUEVA DEL ARCHIVO 2.3.0');
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const path = require('path'); 

// IMPORTACIÓN OFICIAL DE LA API DE BREVO
const SibApiV3Sdk = require('@getbrevo/brevo');
const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();

// CONFIGURACIÓN DE LA LLAVE DE ACCESO SEGURA (VERSIÓN FINAL DE PRODUCCIÓN)
const apiKey = apiInstance.authentications['apiKey'];
apiKey.apiKey = process.env.BREVO_API_KEY; // ← CORREGIDO: Lee la llave secreta directamente desde Render sin exponerla

const app = express();


// =========================================================================
// 1. MIDDLEWARES (CONFIGURADO CON TU URL REAL DE GITHUB PAGES)
// =========================================================================
app.use(cors({
    origin: [
        'https://github.io', 
        'http://localhost:3000',
        'http://127.0.0.1:5500'
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

app.use(express.json());
app.use(express.static(path.join(__dirname)));


// 2. CONFIGURACIÓN MEDIANTE POOL DE CONEXIONES (REUTILIZA CLEVER CLOUD)
const pool = mysql.createPool({
    host: 'bqxquadwgh6wn3twrgyy-mysql.services.clever-cloud.com',
    user: 'usp9nsl8ipuiouao',
    password: 'vXf0fCll6xPxv7f6XV84',
    database: 'bqxquadwgh6wn3twrgyy',
    port: 3306,
    waitForConnections: true,
    connectionLimit: 5, // Límite estricto para cuidar el plan gratuito
    queueLimit: 0
});

// Verificación inicial del Pool
pool.getConnection((err, connection) => {
    if (err) {
        console.error('Error crítico al obtener conexión del Pool en Clever Cloud:', err);
        return;
    }
    console.log('¡Pool de conexiones verificado y activo con Clever Cloud desde Ecosistema!');
    connection.release(); 
});





// =========================================================================
// 3. RUTAS DE LA API - PARTE A (AUTENTICACIÓN, PERSONAL Y CONSULTORIOS)
// =========================================================================

// RUTA API POST: Validación de usuarios y roles unificada (REEMPLAZO ASOCIADO A ROLES)
// =========================================================================
// =========================================================================
// RUTA API POST: AUTENTICACIÓN UNIFICADA DE DOBLE CAPA (CORREGIDA)
// =========================================================================
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: 'El usuario y la contraseña son obligatorios.' });
    }

    const userUpper = username.trim().toUpperCase();
    const passTrim = password.trim(); 

    // CAPA 1: Buscamos primero en la tabla de Usuarios Maestros (users)
    const sqlUsers = `
        SELECT u.id, u.username, u.password, u.role_id, r.role_name 
        FROM users u 
        LEFT JOIN roles r ON u.role_id = r.id 
        WHERE u.username = ?
    `;

    pool.query(sqlUsers, [userUpper], (errUser, userResults) => {
        if (errUser) {
            console.error('Error al consultar users:', errUser);
            return res.status(500).json({ message: 'Error interno en el servidor al autenticar.' });
        }

        // 🚀 REPARACIÓN: Extraemos de forma explícita el índice [0] del renglón encontrado
        if (userResults && userResults.length > 0) {
            const usuarioMaestro = userResults[0]; // ← CORREGIDO: Añadido [0]
            
            // Validación de credencial maestro en texto plano
            if (usuarioMaestro.password !== passTrim) {
                return res.status(401).json({ message: 'Las credenciales introducidas son incorrectas.' });
            }

            return res.status(200).json({
                message: 'Acceso concedido como Usuario Maestro.',
                user: {
                    id: usuarioMaestro.id,
                    username: usuarioMaestro.username,
                    roleId: usuarioMaestro.role_id,
                    roleName: usuarioMaestro.role_name || 'SIN ROL ASIGNADO',
                    serviceName: 'ADMINISTRACIÓN GENERAL'
                }
            });
        }

        // CAPA 2: Si no existe en Users, buscamos en la plantilla de Empleados (employees)
        const sqlEmployees = `
            SELECT id, rfc, employee_number, name, category, service 
            FROM employees 
            WHERE rfc = ?
        `;

        pool.query(sqlEmployees, [userUpper], (errEmp, empResults) => {
            if (errEmp) {
                console.error('Error al consultar employees:', errEmp);
                return res.status(500).json({ message: 'Error interno en el servidor.' });
            }

            if (!empResults || empResults.length === 0) {
                return res.status(401).json({ message: 'Las credenciales introducidas son incorrectas o el personal no existe.' });
            }

            const empleadoEncontrado = empResults[0]; // ← CORREGIDO: Añadido [0] para consistencia

            // Validamos que su contraseña sea su Número de Empleado (Texto plano coincidente)
            if (empleadoEncontrado.employee_number !== passTrim.toUpperCase()) {
                return res.status(401).json({ message: 'Las credenciales introducidas son incorrectas.' });
            }

            res.status(200).json({
                message: 'Acceso concedido como Personal Operativo.',
                user: {
                    id: empleadoEncontrado.id,
                    username: empleadoEncontrado.rfc,
                    roleId: 0,
                    roleName: empleadoEncontrado.category.toUpperCase(), 
                    serviceName: empleadoEncontrado.service ? empleadoEncontrado.service.toUpperCase() : 'SIN SERVICIO'
                }
            });
        });
    });
});



// RUTA API: Obtener toda la plantilla con los nombres separados
app.get('/api/doctors', (req, res) => {
    // 🚀 INYECCIÓN: Traemos la columna 'service' desde Clever Cloud
    const sql = 'SELECT id, rfc, employee_number, first_name, last_name_paternal, last_name_maternal, name, shift, category, service, created_at FROM employees ORDER BY last_name_paternal ASC, first_name ASC';
    
    pool.query(sql, (err, results) => {
        if (err) {
            console.error('Error al consultar plantilla en Clever Cloud:', err);
            return res.status(500).json({ message: 'Error al obtener los datos de la base de datos.' });
        }
        res.status(200).json(results);
    });
});


// RUTA API: Registrar personal con nombre desglosado


// ENDPOINT: REGISTRAR PERSONAL CON COLUMNA DE SERVICIO INDEPENDIENTE (TEXTO PLANO)
app.post('/api/doctors', (req, res) => {
    const { rfc, employeeNumber, firstName, lastNamePaternal, lastNameMaternal, shift, category, serviceName } = req.body;
    
    if (!rfc || !employeeNumber || !firstName || !lastNamePaternal || !category || !serviceName) {
        return res.status(400).json({ message: 'RFC, Número de Empleado, Nombre, Apellido, Rol y Servicio son obligatorios.' });
    }

    const nameCompleto = `${lastNamePaternal} ${lastNameMaternal || ''} ${firstName}`.trim().toUpperCase();
    
    // 🏛️ INYECCIÓN: Agregamos la columna 'service' al final del INSERT INTO
    const insertSql = 'INSERT INTO employees (rfc, employee_number, first_name, last_name_paternal, last_name_maternal, name, shift, category, service) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)';
    
    pool.query(insertSql, [
        rfc.trim().toUpperCase(), 
        employeeNumber.trim().toUpperCase(), 
        firstName.trim().toUpperCase(), 
        lastNamePaternal.trim().toUpperCase(), 
        lastNameMaternal ? lastNameMaternal.trim().toUpperCase() : '', 
        nameCompleto, 
        shift || 'Matutino', 
        category.trim().toUpperCase(),
        serviceName.trim().toUpperCase() // 🚀 Se guarda como texto desacoplado para permitir borrar el catálogo original sin bloqueos
    ], (err, result) => {
        if (err) {
            console.error('Error al insertar registro en employees con columna service:', err);
            return res.status(500).json({ message: 'No se pudieron guardar los datos en el servidor.' });
        }
        res.status(201).json({ message: 'Personal registrado correctamente.' });
    });
});





// RUTA API: Eliminar personal de la plantilla por su número de empleado (RFC)
app.delete('/api/doctors/:rfc', (req, res) => {
    const { rfc } = req.params;
    
    const sql = 'DELETE FROM employees WHERE rfc = ?';
    pool.query(sql, [rfc], (err, result) => {
        if (err) {
            console.error('Error al eliminar registro:', err);
            return res.status(500).json({ message: 'Error interno al intentar eliminar al empleado.' });
        }
        res.status(200).json({ message: 'Registro eliminado correctamente de la base de datos.' });
    });
});

// RUTA API: Obtener todos los consultorios registrados
// RUTA API: Obtener todos los consultorios registrados (INCLUYENDO TIPO DE CITA)
app.get('/api/offices', (req, res) => {
    // Agregamos el campo appointment_type a la consulta SELECT
    const sql = 'SELECT id, office_name, shift, appointment_type, created_at FROM offices ORDER BY office_name ASC, shift ASC';
    pool.query(sql, (err, results) => {
        if (err) {
            console.error('Error al consultar consultorios:', err);
            return res.status(500).json({ message: 'Error al obtener los consultorios de la base de datos.' });
        }
        res.status(200).json(results);
    });
});


// RUTA API: Registrar un consultorio nuevo (Valida texto y duplicados por turno)
// RUTA API: Registrar un consultorio nuevo (CON TIPO DE CITA MANDATORIO)
app.post('/api/offices', (req, res) => {
    // Recibimos el nuevo campo appointmentType desde el frontend
    const { officeName, shift, appointmentType } = req.body;
    
    if (!officeName || !shift || !appointmentType) {
        return res.status(400).json({ message: 'El nombre, turno y tipo de cita son obligatorios.' });
    }

    const officeUpper = officeName.trim().toUpperCase();
    const typeUpper = appointmentType.trim().toUpperCase(); // 'CITA MÉDICA' o 'CITA PRESENCIAL'

    // Validamos que no exista esa combinación exacta de consultorio y turno
    const checkSql = 'SELECT * FROM offices WHERE office_name = ? AND shift = ?';
    pool.query(checkSql, [officeUpper, shift], (err, results) => {
        if (err) {
            console.error('Error al buscar consultorio duplicado:', err);
            return res.status(500).json({ message: 'Error interno en el servidor.' });
        }
        if (results && results.length > 0) {
            return res.status(400).json({ message: 'Este consultorio ya está registrado para el turno seleccionado.' });
        }

        // Inserción limpia incluyendo el nuevo campo appointment_type
        const insertSql = 'INSERT INTO offices (office_name, shift, appointment_type) VALUES (?, ?, ?)';
        pool.query(insertSql, [officeUpper, shift, typeUpper], (err, result) => {
            if (err) {
                console.error('Error al insertar consultorio:', err);
                return res.status(500).json({ message: 'No se pudo guardar el consultorio en el servidor.' });
            }
            res.status(201).json({ message: 'Consultorio registrado correctamente.' });
        });
    });
});



// =========================================================================
// 3. RUTAS DE LA API - PARTE B1 (ASIGNACIONES DE CONSULTORIO)
// =========================================================================

// RUTA API: Eliminar un consultorio por su ID
app.delete('/api/offices/:id', (req, res) => {
    const { id } = req.params;
    const sql = 'DELETE FROM offices WHERE id = ?';
    pool.query(sql, [id], (err, result) => {
        if (err) {
            console.error('Error al eliminar consultorio:', err);
            return res.status(500).json({ message: 'Error interno al intentar eliminar el consultorio.' });
        }
        res.status(200).json({ message: 'Consultorio eliminado correctamente.' });
    });
});

// RUTA API: Obtener solo empleados de la categoría 'médico'
app.get('/api/employees/doctors-only', (req, res) => {
    const sql = "SELECT id, rfc, first_name, last_name_paternal, last_name_maternal, shift FROM employees WHERE LOWER(category) = 'médico' ORDER BY last_name_paternal ASC";
    pool.query(sql, (err, results) => {
        if (err) {
            console.error('Error al consultar médicos:', err);
            return res.status(500).json({ message: 'Error al obtener los médicos.' });
        }
        res.status(200).json(results);
    });
});

// RUTA API: Obtener la lista de asignaciones unificando la nueva tabla independiente
app.get('/api/assignments', (req, res) => {
    const sql = `
        SELECT da.id AS assignment_id, e.id AS employee_id, e.rfc, e.first_name, e.last_name_paternal, e.last_name_maternal, e.shift AS emp_shift,
               o.id AS office_id, o.office_name, o.shift AS office_shift
        FROM doctor_offices da
        INNER JOIN employees e ON da.employee_id = e.id
        INNER JOIN offices o ON da.office_id = o.id
        WHERE LOWER(e.category) = 'médico'
        ORDER BY o.office_name ASC, o.shift ASC
    `;
    pool.query(sql, (err, results) => {
        if (err) {
            console.error('Error al consultar asignaciones independientes:', err);
            return res.status(500).json({ message: 'Error al obtener las asignaciones de la base de datos.' });
        }
        res.status(200).json(results);
    });
});

// RUTA API: Vincular médico con consultorio (Con doble validación de seguridad)
app.post('/api/assignments', (req, res) => {
    const { employeeId, officeId } = req.body;

    if (!employeeId || !officeId) {
        return res.status(400).json({ message: 'El médico y el consultorio son obligatorios.' });
    }

    const checkDoctorSql = 'SELECT * FROM doctor_offices WHERE employee_id = ?';
    pool.query(checkDoctorSql, [employeeId], (err, doctorResults) => {
        if (err) {
            console.error('Error al validar médico existente:', err);
            return res.status(500).json({ message: 'Error interno al validar el estado del médico.' });
        }
        
        if (doctorResults && doctorResults.length > 0) {
            return res.status(400).json({ 
                message: 'El médico ya está vinculado a un consultorio. Debe desvincularlo primero desde la tabla de abajo antes de asignarle uno nuevo.' 
            });
        }

        const checkOfficeSql = 'SELECT * FROM doctor_offices WHERE office_id = ?';
        pool.query(checkOfficeSql, [officeId], (err, officeResults) => {
            if (err) {
                console.error('Error al validar consultorio ocupado:', err);
                return res.status(500).json({ message: 'Error interno al validar la disponibilidad del consultorio.' });
            }

            if (officeResults && officeResults.length > 0) {
                return res.status(400).json({ 
                    message: 'Este consultorio ya se encuentra ocupado por otro médico en este mismo turno. Seleccione un espacio libre.' 
                });
            }

            const insertSql = 'INSERT INTO doctor_offices (employee_id, office_id) VALUES (?, ?)';
            pool.query(insertSql, [employeeId, officeId], (err, result) => {
                if (err) {
                    console.error('Error al registrar asignación independiente:', err);
                    return res.status(500).json({ message: 'No se pudo guardar la asignación en la base de datos.' });
                }
                res.status(201).json({ message: 'Asignación guardada correctamente en la tabla independiente.' });
            });
        });
    });
});




// RUTA API BACKEND: Eliminar una asignación de médico de la tabla independiente
app.delete('/api/assignments/:id', (req, res) => {
    const { id } = req.params; // Este ID debe ser el PRIMARY KEY de doctor_offices
    
    const sql = 'DELETE FROM doctor_offices WHERE id = ?';
    pool.query(sql, [id], (err, result) => {
        if (err) {
            console.error('Error crítico al eliminar asignación en Clever Cloud:', err);
            return res.status(500).json({ message: 'Error interno al intentar eliminar la asignación.' });
        }
        res.status(200).json({ message: 'Asociación removida correctamente de la base de datos.' });
    });
});



// =========================================================================
// 3. RUTAS DE LA API - PARTE B2 (TRÁMITES, DICTAMINACIÓN Y ARRANQUE)
// =========================================================================

// RUTA API POST: Recibir trámite e inyectar historial congelado de consultorios y médicos
app.post('/api/office-changes', (req, res) => {
    const {
        paternalLastname, maternalLastname, firstNames, rfc,
        isWorker, isPensioner, street, extNum, intNum, colonia,
        postalCode, age, maritalStatus, phone, email, insuredType, totalFamilyMembers,
        beneficiaries, currentOfficeId, requestedOfficeId, changeReason,
        // RECIBIMOS LOS 4 NUEVOS ATRIBUTOS DESDE EL FRONTEND
        currentOfficeNameSnapshot, requestedOfficeNameSnapshot,
        currentDoctorNameSnapshot, requestedDoctorNameSnapshot
    } = req.body;

    if (!paternalLastname || !firstNames || !rfc || !email || !currentOfficeId || !requestedOfficeId || !changeReason) {
        return res.status(400).json({ message: 'Todos los datos obligatorios, incluyendo el correo y el motivo de cambio, deben ser requisitados.' });
    }

    // AMPLIAMOS LAS COLUMNAS EN EL INSERT INTO DE CLEVER CLOUD
    const insertSql = `
        INSERT INTO office_change_requests (
            paternal_lastname, maternal_lastname, first_names, rfc,
            is_worker, is_pensioner, street, ext_num, int_num, colonia,
            postal_code, age, marital_status, phone, email, insured_type, total_family_members,
            beneficiaries, current_office_id, requested_office_id, change_reason,
            current_office_name_snapshot, requested_office_name_snapshot,
            current_doctor_name_snapshot, requested_doctor_name_snapshot
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    // AGREGAMOS LAS VARIABLES AL ARREGLO EN EL MISMO ORDEN DE LAS COLUMNAS (25 EN TOTAL)
    pool.query(insertSql, [
        paternalLastname.trim().toUpperCase(),
        maternalLastname ? maternalLastname.trim().toUpperCase() : '',
        firstNames.trim().toUpperCase(),
        rfc.trim().toUpperCase(),
        isWorker,
        isPensioner,
        street.trim().toUpperCase(),
        extNum.trim().toUpperCase(),
        intNum ? intNum.trim().toUpperCase() : '',
        colonia.trim().toUpperCase(),
        postalCode.trim(),
        parseInt(age),
        maritalStatus,
        phone.trim(),
        email.trim(), 
        insuredType,
        parseInt(totalFamilyMembers),
        beneficiaries,
        parseInt(currentOfficeId),
        parseInt(requestedOfficeId),
        changeReason.trim().toUpperCase(),
        // INYECCIÓN ORDENADA DE LOS 4 VALORES CONGELADOS
        currentOfficeNameSnapshot ? currentOfficeNameSnapshot.trim().toUpperCase() : 'N/A',
        requestedOfficeNameSnapshot ? requestedOfficeNameSnapshot.trim().toUpperCase() : 'N/A',
        currentDoctorNameSnapshot ? currentDoctorNameSnapshot.trim().toUpperCase() : 'SIN MÉDICO ASIGNADO',
        requestedDoctorNameSnapshot ? requestedDoctorNameSnapshot.trim().toUpperCase() : 'SIN MÉDICO ASIGNADO'
    ], (err, result) => {
        if (err) {
            console.error('Error al insertar trámite con snapshots en Clever Cloud:', err);
            return res.status(500).json({ message: 'No se pudo guardar la solicitud.' });
        }
        res.status(201).json({ message: 'Solicitud tramitada correctamente.' });
    });
});





// RUTA API GET: Descargar solicitudes incluyendo correos y motivos de dictamen
app.get('/api/office-changes', (req, res) => {
    const sql = `
        SELECT r.*, 
               o1.office_name AS current_office_name, 
               o2.office_name AS requested_office_name
        FROM office_change_requests r
        LEFT JOIN offices o1 ON r.current_office_id = o1.id
        LEFT JOIN offices o2 ON r.requested_office_id = o2.id
        ORDER BY r.id DESC
    `;
    pool.query(sql, (err, results) => {
        if (err) {
            console.error('Error al consultar solicitudes:', err);
            return res.status(500).json({ message: 'Error interno en Clever Cloud.' });
        }
        res.status(200).json(results);
    });
});



// RUTA API PUT: Procesar dictamen (ORDEN SECUENCIAL VÍA API HTTP DE BREVO)
app.put('/api/office-changes/:id', (req, res) => {
    const { id } = req.params;
    const { status, statusNotes } = req.body;

    if (!status || !['APROBADA', 'RECHAZADA'].includes(status) || !statusNotes) {
        return res.status(400).json({ message: 'Estatus o notas de justificación inválidas.' });
    }

    // PASO 1: Guardamos primero el estatus y las notas en Clever Cloud
    const updateSql = 'UPDATE office_change_requests SET status = ?, status_notes = ? WHERE id = ?';
    
    pool.query(updateSql, [status, statusNotes, id], (err, updateResult) => {
        if (err) {
            console.error('Error crítico al escribir el dictamen en Clever Cloud:', err);
            return res.status(500).json({ message: 'Error al escribir el dictamen en el servidor.' });
        }

        console.log(`[SISTEMA-PUT] Base de datos actualizada con éxito para el Folio: ${id}`);

        // PASO 2: Solo si el UPDATE fue exitoso, buscamos los datos del paciente para el correo
        const findUserSql = 'SELECT first_names, paternal_lastname, email FROM office_change_requests WHERE id = ?';
        
        pool.query(findUserSql, [id], (errFind, userResult) => {
            if (errFind || !userResult || userResult.length === 0) {
                console.error('Error al recuperar correo del derechohabiente tras UPDATE:', errFind);
                return res.status(200).json({ 
                    success: true, 
                    message: 'Trámite dictaminado en BD, pero falló la extracción del correo.',
                    correoDestino: 'VACÍO'
                });
            }

            // Extracción segura del renglón cero
            const paciente = userResult[0];
            console.log(`[SISTEMA-PUT] Preparando disparo de correo HTTP hacia: ${paciente.email}`);

            // PASO 3: Redacción del correo mediante la API HTTP de Brevo
            const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
            sendSmtpEmail.subject = `Estatus de Trámite: Solicitud de Cambio de Consultorio - Folio ${id}`;
            sendSmtpEmail.htmlContent = `
                <div style="font-family: sans-serif; border: 1px solid #ddd; padding: 20px; border-radius: 8px; max-width: 550px;">
                    <h2 style="color: #611232; border-bottom: 3px solid #b38e5d; padding-bottom: 10px; margin-top:0;">C.M.F. ERMITA - NOTIFICACIÓN CAMBIO DE CONSULTORIO</h2>
                    <p>Estimado(a) <strong>${paciente.first_names} ${paciente.paternal_lastname}</strong>,</p>
                    <p>Le informamos que la Coordinación Médica ha dictaminado su solicitud de Cambio de Consultorio:</p>
                    <div style="background: ${status === 'APROBADA' ? '#dcfce7' : '#fee2e2'}; color: ${status === 'APROBADA' ? '#15803d' : '#b91c1c'}; padding: 12px; border-radius: 6px; font-weight: bold; text-align: center; font-size: 1.2em; margin: 15px 0;">
                        ESTATUS: ${status}
                    </div>
                    <p><strong>Fundamento / Motivo:</strong></p>
                    <blockquote style="background: #f3f4f6; padding: 10px 15px; border-left: 4px solid #98989a; font-style: italic; margin: 10px 0;">
                        "${statusNotes}"
                    </blockquote>
                    
                    <!-- NUEVA SECCIÓN DE ENCUESTA INSTITUCIONAL (GUINDA Y DORADO) -->
                    <div style="background: #fbf8f3; border: 1px solid #e1d3bf; padding: 15px; border-radius: 6px; margin: 20px 0; text-align: center;">
                        <h4 style="color: #611232; margin: 0 0 8px 0; font-size: 1em; letter-spacing: 0.5px;">📋 SU OPINIÓN ES MUY IMPORTANTE</h4>
                        <p style="margin: 0 0 12px 0; font-size: 0.9em; color: #4b5563;">
                            Con el objetivo de seguir mejorando la calidad en la atención de nuestra unidad médica, le solicitamos de la manera más atenta apoyarnos a responder una breve encuesta de Adicciones.
                        </p>
                        <!-- BOTÓN BLINDADO CON ATRIBUTOS DE SEGURIDAD PARA ENLACES -->
                        <a href="https://ecosistema-cmfermita.onrender.com/" target="_blank" rel="noopener noreferrer" style="background-color: #611232; color: white; border: 1px solid #b38e5d; padding: 10px 20px; text-decoration: none; border-radius: 4px; font-weight: bold; font-size: 0.9em; display: inline-block; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                            Responder Encuesta de Adicciones
                        </a>
                    </div>

                    <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
                    <p style="font-size: 0.85em; color: #666; text-align: center; margin-bottom:0;">
                        Este es un correo automático. Por favor no responda a este mensaje.<br>
                        <strong>Coordinación de Enseñanza y Calidad - ISSSTE - C.M.F. Ermita</strong>
                    </p>
                </div>
            `;
            sendSmtpEmail.sender = { "name": "C.M.F. ERMITA - ISSSTE", "email": "cmfermitacalidad@gmail.com" };
            sendSmtpEmail.to = [{ "email": paciente.email, "name": paciente.first_names }];

            // Disparar envío HTTP saltando el Firewall de Render
            apiInstance.sendTransacEmail(sendSmtpEmail).then((data) => {
                console.log('--- ¡CORREO ENVIADO CON ÉXITO VÍA API HTTP DESDE RENDER! ---', data.messageId);
            }, (error) => {
                // MODIFICACIÓN DE DIAGNÓSTICO: Nos muestra el texto exacto del rechazo de Brevo
                console.error('❌ ERROR CRÍTICO EN API DE CORREO (BREVO):', error.response ? error.response.body : error);
            });

            // PASO 4: Responder al frontend de forma limpia devolviendo los datos reales
            res.status(200).json({ 
                success: true, 
                message: 'Trámite dictaminado y procesado de forma secuencial por API.',
                correoDestino: paciente.email,
                nombreDestino: paciente.first_names
            });
        }); // Fin de pool.query (SELECT)
    }); // Fin de pool.query (UPDATE)
}); // Fin de app.put






// =========================================================================
// MÓDULO DE ADMINISTRACIÓN DE USUARIOS Y ROLES (SEGURIDAD GLOBAL)
// =========================================================================

// ENDPOINT 1: Obtener todos los roles registrados (Para listados y selects)
app.get('/api/roles', (req, res) => {
    const sql = 'SELECT id, role_name, description, created_at FROM roles ORDER BY role_name ASC';
    pool.query(sql, (err, results) => {
        if (err) {
            console.error('Error al consultar roles en Clever Cloud:', err);
            return res.status(500).json({ message: 'Error interno al obtener el catálogo de roles.' });
        }
        res.status(200).json(results);
    });
});

// ENDPOINT 2: Registrar un nuevo Rol de Servicio
app.post('/api/roles', (req, res) => {
    const { roleName, description } = req.body;

    if (!roleName) {
        return res.status(400).json({ message: 'El nombre del rol es mandatorio.' });
    }

    const roleUpper = roleName.trim().toUpperCase();
    const descUpper = description ? description.trim().toUpperCase() : 'SIN DESCRIPCIÓN ADICIONAL';

    const sql = 'INSERT INTO roles (role_name, description) VALUES (?, ?)';
    pool.query(sql, [roleUpper, descUpper], (err, result) => {
        if (err) {
            console.error('Error al insertar rol en Clever Cloud:', err);
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(400).json({ message: 'Este rol de servicio ya se encuentra registrado.' });
            }
            return res.status(500).json({ message: 'No se pudo guardar el rol en el servidor.' });
        }
        res.status(201).json({ message: 'Rol de servicio registrado correctamente.' });
    });
});




// ENDPOINT: Actualizar un Rol existente (Edición)
app.put('/api/roles/:id', (req, res) => {
    const { id } = req.params;
    const { roleName, description } = req.body;

    if (!roleName) {
        return res.status(400).json({ message: 'El nombre del rol es mandatorio.' });
    }

    const roleUpper = roleName.trim().toUpperCase();
    const descUpper = description ? description.trim().toUpperCase() : 'SIN DESCRIPCIÓN ADICIONAL';

    const sql = 'UPDATE roles SET role_name = ?, description = ? WHERE id = ?';
    pool.query(sql, [roleUpper, descUpper, id], (err, result) => {
        if (err) {
            console.error('Error al actualizar rol en Clever Cloud:', err);
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(400).json({ message: 'Ya existe otro rol con ese nombre.' });
            }
            return res.status(500).json({ message: 'Error interno en el servidor al actualizar el rol.' });
        }
        res.status(200).json({ message: 'Rol de servicio actualizado correctamente.' });
    });
});

// ENDPOINT: Eliminar un Rol de servicio
app.delete('/api/roles/:id', (req, res) => {
    const { id } = req.params;

    // Al tener la llave foránea ON DELETE SET NULL en la tabla users,
    // si borras un rol, los usuarios ligados a él no se borrarán, solo se quedarán temporalmente como "SIN ROL ASIGNADO"
    const sql = 'DELETE FROM roles WHERE id = ?';
    pool.query(sql, [id], (err, result) => {
        if (err) {
            console.error('Error al eliminar rol en Clever Cloud:', err);
            return res.status(500).json({ message: 'No se pudo eliminar el rol por restricciones del sistema.' });
        }
        res.status(200).json({ message: 'Rol de servicio eliminado correctamente.' });
    });
});














// ENDPOINT 3: Obtener todos los usuarios (Con JOIN para ver el nombre de su rol)
app.get('/api/users', (req, res) => {
// Reemplaza la consulta SQL dentro de app.get('/api/users') por esta:
    const sql = `
        SELECT u.id, u.username, u.role_id, r.role_name, u.service_id, s.service_name, u.created_at 
        FROM users u 
        LEFT JOIN roles r ON u.role_id = r.id 
        LEFT JOIN services s ON u.service_id = s.id
        ORDER BY u.username ASC
    `;
    pool.query(sql, (err, results) => {
        if (err) {
            console.error('Error al consultar usuarios en Clever Cloud:', err);
            return res.status(500).json({ message: 'Error interno al obtener el listado de usuarios.' });
        }
        res.status(200).json(results);
    });
});




// =========================================================================
// ENDPOINT 4: REGISTRAR UN NUEVO USUARIO MAESTRO (CORREGIDO SIN SERVICIO)
// =========================================================================
app.post('/api/users', (req, res) => {
    const { username, password, roleId } = req.body;

    if (!username || !password || !roleId) {
        return res.status(400).json({ message: 'Nombre de usuario, contraseña y rol son obligatorios.' });
    }

    const userUpper = username.trim().toUpperCase();
    const passTrim = password.trim(); 

    // 🏛️ REGLA: Insertamos estrictamente 3 campos (username, password, role_id)
    const sql = 'INSERT INTO users (username, password, role_id) VALUES (?, ?, ?)';
    
    // Pasamos exactamente las 3 variables correspondientes a los 3 signos de interrogación
    pool.query(sql, [userUpper, passTrim, parseInt(roleId)], (err, result) => {
        if (err) {
            console.error('Error al insertar usuario en Clever Cloud:', err);
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(400).json({ message: 'El nombre de usuario ya está ocupado por otro personal.' });
            }
            return res.status(500).json({ message: 'No se pudo registrar el usuario en el servidor.' });
        }
        res.status(201).json({ message: 'Usuario del sistema registrado correctamente.' });
    });
});






// ENDPOINT BACKEND: Actualizar las credenciales, rol o servicio de un Usuario existente (Edición)
// ENDPOINT BACKEND: Actualizar las credenciales, rol o servicio de un Usuario existente (Edición)
app.put('/api/users/:id', (req, res) => {
    const { id } = req.params;
    const { username, password, roleId, serviceId } = req.body;

    // Nota: Dejamos serviceId fuera de esta validación obligatoria porque un usuario 
    // podría quedar temporalmente "SIN SERVICIO ASIGNADO" (con valor NULL)
    if (!username || !password || !roleId) {
        return res.status(400).json({ message: 'Nombre de usuario, contraseña y rol son obligatorios.' });
    }

    const userUpper = username.trim().toUpperCase();
    const passTrim = password.trim();

    // 🚀 CORREGIDO: Agregamos "service_id = ?" a la instrucción SQL de actualización
    const sql = 'UPDATE users SET username = ?, password = ?, role_id = ?, service_id = ? WHERE id = ?';
    
    // 🚀 CORREGIDO: Inyectamos serviceId (convertido a entero o pasándole null si viene vacío) y el id de la URL
    pool.query(sql, [
        userUpper, 
        passTrim, 
        parseInt(roleId), 
        serviceId ? parseInt(serviceId) : null, 
        id
    ], (err, result) => {
        if (err) {
            console.error('Error al actualizar usuario relacional en Clever Cloud:', err);
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(400).json({ message: 'Ese nombre de usuario ya está ocupado por otra cuenta.' });
            }
            return res.status(500).json({ message: 'Error interno en el servidor al actualizar el usuario.' });
        }
        res.status(200).json({ message: 'Usuario del sistema actualizado correctamente.' });
    });
});




// ENDPOINT BACKEND: Eliminar un Usuario de la Base de Datos
app.delete('/api/users/:id', (req, res) => {
    const { id } = req.params;

    const sql = 'DELETE FROM users WHERE id = ?';
    pool.query(sql, [id], (err, result) => {
        if (err) {
            console.error('Error al eliminar usuario en Clever Cloud:', err);
            return res.status(500).json({ message: 'No se pudo eliminar el usuario de la base de datos.' });
        }
        res.status(200).json({ message: 'Usuario eliminado correctamente.' });
    });
});










// =========================================================================
// MÓDULO DE ACCESO PARA MIP'S, PASANTES Y RESIDENTES (BACKEND)
// =========================================================================



// ENDPOINT 1: Generar clave aleatoria (CON VALIDACIÓN DE CORREO ÚNICO) y enviarla por correo (CON BOTÓN DE ACCESO DIRECTO)
app.post('/api/trainee-keys/generate', (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ message: 'El correo electrónico es obligatorio.' });
    }

    const emailTrim = email.trim().toLowerCase();

    // VALIDACIÓN DE CORREO EXISTENTE
    const sqlCheck = 'SELECT id, access_key FROM trainee_access_keys WHERE email = ?';
    pool.query(sqlCheck, [emailTrim], (errCheck, resultsCheck) => {
        if (errCheck) {
            console.error('Error al verificar duplicidad de correo:', errCheck);
            return res.status(500).json({ message: 'Error interno al validar el correo en el servidor.' });
        }

        if (resultsCheck && resultsCheck.length > 0) {
            return res.status(400).json({ 
                message: `El correo electrónico [${emailTrim}] ya se encuentra registrado con la clave: ${resultsCheck[0].access_key}. Utilice la opción de reenvío si es necesario.` 
            });
        }

        const caracteres = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let claveGenerada = 'CMF-';
        for (let i = 0; i < 6; i++) {
            claveGenerada += caracteres.charAt(Math.floor(Math.random() * caracteres.length));
        }

        const sqlInsert = 'INSERT INTO trainee_access_keys (email, access_key) VALUES (?, ?)';
        pool.query(sqlInsert, [emailTrim, claveGenerada], (err, result) => {
            if (err) {
                console.error('Error al insertar clave en Clever Cloud:', err);
                return res.status(500).json({ message: 'No se pudo registrar la clave en el servidor.' });
            }

            const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
            sendSmtpEmail.subject = "🏛️ Clave de Acceso Institucional - Personal en Formación - C.M.F. Ermita";
            sendSmtpEmail.htmlContent = `
                <div style="font-family: sans-serif; max-width: 550px; border: 1px solid #d1d5db; border-radius: 8px; overflow: hidden; margin: 0 auto;">
                    <div style="background-color: #611232; color: white; padding: 20px; text-align: center; border-bottom: 3px solid #b38e5d;">
                        <h2 style="margin:0;">C.M.F. ERMITA - ISSSTE</h2>
                        <p style="margin: 5px 0 0 0; font-size: 0.9em; color:#fbf8f3;">Coordinación de Enseñanza y Calidad</p>
                    </div>
                    <div style="padding: 25px; background-color: #fdf2f4; color: #333; line-height: 1.6;">
                        <p>Estimado(a) Personal en Formación (MIP, Pasante o Residente):</p>
                        <p>Se ha generado su CLAVE de acceso para ingresar a la plataforma digital de la C.M.F. Ermita:</p>
                        
                        <div style="background: white; border-left: 5px solid #611232; padding: 15px; margin: 20px 0; text-align: center; border-radius: 0 4px 4px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                            <span style="font-size: 0.8em; color: #666; display: block; font-weight: bold; text-transform: uppercase;">Su Clave Privada de Acceso:</span>
                            <strong style="font-size: 1.6em; color: #611232; letter-spacing: 2px; font-family: monospace; display: block; margin-top: 5px;">${claveGenerada}</strong>
                        </div>

                        <div style="background: #fbf8f3; border: 1px solid #e1d3bf; padding: 15px; border-radius: 6px; margin: 20px 0; text-align: center;">
                            <h4 style="color: #611232; margin: 0 0 8px 0; font-size: 0.95em; letter-spacing: 0.5px;">🌐 URL DE PÁGINA DIGITAL</h4>
                            <p style="margin: 0 0 12px 0; font-size: 0.85em; color: #4b5563;">
                                Ingrese a la página digital de la C.M.F Ertmita pulsando el siguiente botón y posteriormente ingrese su CLAVE autorizada:
                            </p>
                            <a href="https://ensenanzaermita.github.io/Encuestas-Ermita-Salud-Mental/" target="_blank" rel="noopener noreferrer" style="background-color: #611232; color: white; border: 1px solid #b38e5d; padding: 10px 20px; text-decoration: none; border-radius: 4px; font-weight: bold; font-size: 0.9em; display: inline-block; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                                Ingresar a la Plataforma Digital
                            </a>
                        </div>

                        <p style="font-size: 0.85em; color: #555; border-top: 1px solid #eee; padding-top:10px; margin-top:15px;">
                            *Esta clave es estrictamente personal e intransferible. Estará vigente durante el periodo de prestación de sus servicios institucionales en la clínica.
                        </p>
                    </div>
                </div>
            `;
            sendSmtpEmail.sender = { "name": "C.M.F. ERMITA - ISSSTE", "email": "cmfermitacalidad@gmail.com" };
            sendSmtpEmail.to = [{ "email": emailTrim }];

            apiInstance.sendTransacEmail(sendSmtpEmail)
                .then(() => {
                    res.status(201).json({ message: 'Clave generada y notificada por correo con éxito.' });
                })
                .catch((errorMail) => {
                    console.error('Error al enviar correo por API de Brevo:', errorMail);
                    res.status(201).json({ message: 'Clave generada en el sistema, pero falló el envío del correo automático.', key: claveGenerada });
                });
        });
    });
});





// ENDPOINT 2: Obtener el catálogo de claves emitidas para la tabla del Administrador
app.get('/api/trainee-keys', (req, res) => {
    const sql = 'SELECT id, email, access_key, status, created_at FROM trainee_access_keys ORDER BY created_at DESC';
    pool.query(sql, (err, results) => {
        if (err) {
            console.error('Error al consultar catálogo de claves en Clever Cloud:', err);
            return res.status(500).json({ message: 'Error interno al obtener el catálogo de claves.' });
        }
        res.status(200).json(results);
    });
});

// ENDPOINT 3: Alternar estado de la clave (Inactivar / Activar de forma manual)
app.put('/api/trainee-keys/:id/toggle', (req, res) => {
    const { id } = req.params;
    const { currentStatus } = req.body; // Recibimos el estado actual para conmutarlo

    const nuevoEstado = (currentStatus === 'ACTIVA') ? 'INACTIVA' : 'ACTIVA';

    const sql = 'UPDATE trainee_access_keys SET status = ? WHERE id = ?';
    pool.query(sql, [nuevoEstado, id], (err, result) => {
        if (err) {
            console.error('Error al alternar estado en Clever Cloud:', err);
            return res.status(500).json({ message: 'No se pudo modificar la vigencia de la clave.' });
        }
        res.status(200).json({ message: `Clave marcada como ${nuevoEstado} con éxito.`, newStatus: nuevoEstado });
    });
});






// ENDPOINT 4: Reenviar por correo una clave que ya existe (INCLUYE ENLACE DE ACCESO DIRECTO)
app.post('/api/trainee-keys/resend', (req, res) => {
    const { id } = req.body;

    if (!id) {
        return res.status(400).json({ message: 'El identificador del registro es mandatorio.' });
    }

    const sqlFind = 'SELECT email, access_key FROM trainee_access_keys WHERE id = ?';
    pool.query(sqlFind, [id], (errFind, results) => {
        if (errFind || !results || results.length === 0) {
            return res.status(404).json({ message: 'No se encontró el registro de la clave solicitada.' });
        }

        const trainee = results[0];

        const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
        sendSmtpEmail.subject = "🏛️ REENVÍO: Clave de Acceso Institucional - Personal en Formación - C.M.F Ermita";
        sendSmtpEmail.htmlContent = `
            <div style="font-family: sans-serif; max-width: 550px; border: 1px solid #d1d5db; border-radius: 8px; overflow: hidden; margin: 0 auto;">
                <div style="background-color: #611232; color: white; padding: 20px; text-align: center; border-bottom: 3px solid #b38e5d;">
                    <h2 style="margin:0;">C.M.F. ERMITA - ISSSTE</h2>
                    <p style="margin: 5px 0 0 0; font-size: 0.9em; color:#fbf8f3;">Coordinación de Enseñanza y Calidad (Recordatorio)</p>
                </div>
                <div style="padding: 25px; background-color: #fdf2f4; color: #333; line-height: 1.6;">
                    <p>Estimado(a) Personal en Formación (MIP, Pasante o Residente):</p>
                    <p>A solicitud de la administración, le reenviamos su clave vigente de acceso para el ecosistema clínico Ermita:</p>
                    
                    <div style="background: white; border-left: 5px solid #611232; padding: 15px; margin: 20px 0; text-align: center; border-radius: 0 4px 4px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                        <span style="font-size: 0.8em; color: #666; display: block; font-weight: bold; text-transform: uppercase;">Su Clave de Acceso Vigente:</span>
                        <strong style="font-size: 1.6em; color: #611232; letter-spacing: 2px; font-family: monospace; display: block; margin-top: 5px;">${trainee.access_key}</strong>
                    </div>

                    <!-- SECCIÓN CON ENLACE DE ACCESO DIRECTO EN REENVÍO -->
                    <div style="background: #fbf8f3; border: 1px solid #e1d3bf; padding: 15px; border-radius: 6px; margin: 20px 0; text-align: center;">
                        <h4 style="color: #611232; margin: 0 0 8px 0; font-size: 0.95em; letter-spacing: 0.5px;">🌐 DIRECCIÓN DE INGRESO</h4>
                        <p style="margin: 0 0 12px 0; font-size: 0.85em; color: #4b5563;">
                            Utilice su clave autorizada pulsando el siguiente botón o ingresando a la liga oficial del proyecto:
                        </p>
                        <a href="https://ecosistema-cmfermita.onrender.com/" target="_blank" rel="noopener noreferrer" style="background-color: #611232; color: white; border: 1px solid #b38e5d; padding: 10px 20px; text-decoration: none; border-radius: 4px; font-weight: bold; font-size: 0.9em; display: inline-block; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                            Ingresar al Ecosistema Ermita
                        </a>
                    </div>

                    <p style="font-size: 0.85em; color: #555; border-top: 1px solid #eee; padding-top:10px; margin-top:15px;">
                        *Si usted no solicitó este reenvío, por favor haga caso omiso de este mensaje o comuníquese con el Coordinador de Enseñanza.
                    </p>
                </div>
            </div>
        `;
        sendSmtpEmail.sender = { "name": "C.M.F. ERMITA - ISSSTE", "email": "cmfermitacalidad@gmail.com" };
        sendSmtpEmail.to = [{ "email": trainee.email }];

        apiInstance.sendTransacEmail(sendSmtpEmail)
            .then(() => {
                res.status(200).json({ message: `Clave reenviada con éxito al correo: ${trainee.email}` });
            })
            .catch((errorMail) => {
                console.error('Error al reenviar correo por Brevo:', errorMail);
                res.status(500).json({ message: 'El registro existe pero ocurrió un fallo al conectar con la API de Brevo para el reenvío.' });
            });
    });
});







// ENDPOINT BACKEND: Validar la clave de acceso para Médicos en Formación
app.post('/api/trainee-auth/login', (req, res) => {
    const { accessKey } = req.body;

    if (!accessKey) {
        return res.status(400).json({ message: 'La clave de acceso es obligatoria.' });
    }

    const keyUpper = accessKey.trim().toUpperCase();

    // Buscamos la clave exacta en Clever Cloud
    const sql = 'SELECT id, email, access_key, status FROM trainee_access_keys WHERE access_key = ?';
    pool.query(sql, [keyUpper], (err, results) => {
        if (err) {
            console.error('Error al validar clave trainee en Clever Cloud:', err);
            return res.status(500).json({ message: 'Error interno en el servidor al verificar la credencial.' });
        }

        // Si la clave no existe en la base de datos
        if (!results || results.length === 0) {
            return res.status(401).json({ message: 'La clave introducida no es válida o no existe en el registro institucional.' });
        }

        const registroClave = results[0];

        // 🚫 REGLA DE ORO: Validamos que la clave no esté INACTIVA
        if (registroClave.status === 'INACTIVA') {
            return res.status(403).json({ message: 'Acceso Denegado:\nEsta clave ha sido desactivada por la Coordinación de Enseñanza debido a la conclusión de sus servicios.' });
        }

        // Si está ACTIVA, autorizamos el ingreso y mandamos el correo ligado por seguridad
        res.status(200).json({
            message: 'Acceso autorizado.',
            trainee: {
                id: registroClave.id,
                email: registroClave.email,
                accessKey: registroClave.access_key
            }
        });
    });
});






app.get('/api/services', (req, res) => {
    pool.query('SELECT id, service_name, description FROM services ORDER BY service_name ASC', (err, results) => {
        if (err) return res.status(500).json({ message: 'Error al consultar servicios.' });
        res.status(200).json(results);
    });
});

app.post('/api/services', (req, res) => {
    const { serviceName, description } = req.body;
    if (!serviceName) return res.status(400).json({ message: 'El nombre del servicio es obligatorio.' });
    pool.query('INSERT INTO services (service_name, description) VALUES (?, ?)', [serviceName.trim().toUpperCase(), description ? description.trim().toUpperCase() : 'N/A'], (err) => {
        if (err) return res.status(500).json({ message: 'No se pudo guardar el servicio.' });
        res.status(201).json({ message: 'Servicio registrado correctamente.' });
    });
});

app.delete('/api/services/:id', (req, res) => {
    pool.query('DELETE FROM services WHERE id = ?', [req.params.id], (err) => {
        if (err) return res.status(500).json({ message: 'Error al eliminar el servicio.' });
        res.status(200).json({ message: 'Servicio eliminado correctamente.' });
    });
});








// =========================================================================
// 📥 ENDPOINT POST CON AUDITORÍA MÁXIMA EN PRODUCCIÓN (REGISTROS NUEVOS)
// =========================================================================
app.post('/api/preventive-patients/integrated', (req, res) => {
    
    // 📊 IMPRESIÓN IMPERATIVA: Muestra línea por línea en los Logs de Render el JSON que recibe de internet
    console.log("====================================================");
    console.log("📥 [CONSOLA RENDER - POST] PAQUETE RECIBIDO DEL NAVEGADOR:");
    console.log("req.body completo:", JSON.stringify(req.body, null, 2));
    console.log("====================================================");

    const { 
        rfc, curp, firstName, lastNamePaternal, lastNameMaternal, age, gender, phone, email,
        isMinor, companionSelectionType, selectedCompanionId, 
        companionRfc, companionCurp, companionFirstName, companionPaternal, companionMaternal,
        companionAge, companionGender, companionPhone, companionEmail, companionRelationship 
    } = req.body;

    if (!rfc || !curp || !firstName || !lastNamePaternal || !age || !phone || !email) {
        return res.status(400).json({ message: 'Los datos obligatorios del paciente están incompletos en la validación base del servidor.' });
    }

    const cleanCurp = curp.trim().toUpperCase();
    const cleanRfc = rfc.trim().toUpperCase();

    // 🚀 AJUSTE DE IDENTIDAD IGUAL QUE EL NOMBRE: Captura directamente lo que envíe el input del front
    // Si viene completamente vacío o nulo por asincronía, le ponemos un string en blanco para que no rompa la BD
    const textoGenderFinal = gender ? gender.trim().toUpperCase() : '';

    const patientData = [
        cleanRfc, 
        cleanCurp, 
        firstName.trim().toUpperCase(),
        lastNamePaternal.trim().toUpperCase(), 
        lastNameMaternal ? lastNameMaternal.trim().toUpperCase() : '',
        parseInt(age), 
        textoGenderFinal, // ← 🏛️ Inserción limpia a Clever Cloud (Texto libre puro)
        phone.trim(), 
        email.trim().toLowerCase()
    ];

    const sqlInsertPatient = `
        INSERT INTO preventive_patients 
        (rfc, curp, first_name, last_name_paternal, last_name_maternal, age, gender, phone, email) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    pool.query(sqlInsertPatient, patientData, (errPat, resultPat) => {
        if (errPat) {
            console.error('❌ Error de MySQL al persistir en Clever Cloud:', errPat);
            return res.status(500).json({ message: 'Error interno de base de datos al guardar.' });
        }

        const idDelPaciente = resultPat.insertId;

        // Si es adulto (isMinor false), responde de inmediato terminando el hilo de ejecución
        if (!isMinor || isMinor === 'false') {
            return res.status(201).json({ message: `Expediente guardado con éxito. Valor auditado en BD: [${textoGenderFinal}]` });
        }

        // =========================================================================
        // 🚀 INICIO DEL FLUJO RELACIONAL DE TRES NIVELES (PACIENTE MENOR DE EDAD)
        // =========================================================================
        
        // Opción A: Se vinculó un tutor que ya existe en el catálogo general
        if (companionSelectionType === 'EXISTING' && selectedCompanionId && selectedCompanionId !== "") {
            const sqlLink = 'INSERT IGNORE INTO preventive_patient_companions (patient_id, companion_id) VALUES (?, ?)';
            pool.query(sqlLink, [idDelPaciente, parseInt(selectedCompanionId)], (errLink) => {
                if (errLink) return res.status(500).json({ message: 'Error interno al enlazar con el tutor seleccionado.' });
                return res.status(201).json({ message: 'Menor de edad registrado y vinculado con éxito al tutor seleccionado.' });
            });
        } 
        // Opción B: Se registró un acompañante TOTALMENTE NUEVO
        else if (companionSelectionType === 'CREATE') {
            if (!companionRfc || !companionCurp || !companionFirstName || !companionPaternal || !companionAge || !companionGender) {
                return res.status(400).json({ message: 'Los datos obligatorios del nuevo acompañante están incompletos.' });
            }

            const cleanCompCurp = companionCurp.trim().toUpperCase();
            const cleanCompRfc = companionRfc.trim().toUpperCase();
            const tutorGenderSeguro = companionGender.trim().toUpperCase();
            const edadTutorNumerica = companionAge ? parseInt(companionAge) : 0;

            // ACCIÓN 1: Registrar al acompañante en el catálogo general de tutores (preventive_companions)
            const sqlInsertComp = `
                INSERT IGNORE INTO preventive_companions 
                (rfc, curp, first_name, last_name_paternal, last_name_maternal, age, gender, phone, email, relationship) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            pool.query(sqlInsertComp, [
                cleanCompRfc, cleanCompCurp, companionFirstName.trim().toUpperCase(),
                companionPaternal.trim().toUpperCase(), companionMaternal ? companionMaternal.trim().toUpperCase() : '',
                edadTutorNumerica, tutorGenderSeguro, companionPhone.trim(), companionEmail.trim().toLowerCase(), companionRelationship
            ], (errC, resultComp) => {
                if (errC) {
                    console.error('Error al insertar tutor en el catálogo:', errC);
                    return res.status(500).json({ message: 'Error al registrar al acompañante en su catálogo.' });
                }

                // Función interna encapsulada para resolver identidades y enlazar las 3 tablas de forma asíncrona
                const registrarTutorComoPacienteYEnlazar = (idDelTutor) => {
                    
                    // ACCIÓN 2: Clonar al tutor en el padrón general de pacientes (preventive_patients)
                    const sqlTutorComoPaciente = `
                        INSERT IGNORE INTO preventive_patients 
                        (rfc, curp, first_name, last_name_paternal, last_name_maternal, age, gender, phone, email) 
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `;
                    pool.query(sqlTutorComoPaciente, [
                        cleanCompRfc, cleanCompCurp, companionFirstName.trim().toUpperCase(),
                        companionPaternal.trim().toUpperCase(), companionMaternal ? companionMaternal.trim().toUpperCase() : '',
                        edadTutorNumerica, tutorGenderSeguro, companionPhone.trim(), companionEmail.trim().toLowerCase()
                    ], (errClone) => {
                        if (errClone) console.error('Aviso: El tutor ya existía previamente en pacientes generales.');

                        // ACCIÓN 3: Insertar el enlace definitivo en la tabla intermedia (preventive_patient_companions)
                        const sqlLink = 'INSERT IGNORE INTO preventive_patient_companions (patient_id, companion_id) VALUES (?, ?)';
                        pool.query(sqlLink, [idDelPaciente, idDelTutor], (errLink) => {
                            if (errLink) return res.status(500).json({ message: 'Expediente creado pero falló el enlace relacional del tutor.' });
                            return res.status(201).json({ message: 'Expediente del menor guardado. El acompañante quedó registrado simultáneamente como tutor y paciente general en la nube.' });
                        });
                    });
                };

                // Si el tutor es nuevo en la base de datos, MySQL nos entrega su ID directo por insertId
                if (resultComp.insertId !== 0) {
                    registrarTutorComoPacienteYEnlazar(resultComp.insertId);
                } else {
                    // 🚀 CORRECCIÓN DE EXTRACCIÓN SEGURA: Accedemos al índice [0] del renglón para que Clever Cloud no trone
                    pool.query('SELECT id FROM preventive_companions WHERE curp = ?', [cleanCompCurp], (errCId, resCId) => {
                        if (!errCId && resCId && resCId.length > 0) {
                            registrarTutorComoPacienteYEnlazar(resCId[0].id);
                        } else {
                            return res.status(500).json({ message: 'Error interno de sincronización con el tutor existente.' });
                        }
                    });
                }
            });
        } else {
            return res.status(201).json({ message: 'Menor de edad registrado. Pendiente vincular un tutor.' });
        }
    });
});







// =========================================================================
// ENDPOINT: BUSCAR PACIENTE O ACOMPAÑANTES POR CURP (Puntos 2, 3 y 5)
// =========================================================================
app.get('/api/preventive-patients/search/:curp', (req, res) => {
    const curpUpper = req.params.curp.trim().toUpperCase();

    const sqlPatient = 'SELECT * FROM preventive_patients WHERE curp = ?';
    pool.query(sqlPatient, [curpUpper], (err, patientResults) => {
        if (err) {
            console.error('Error al buscar paciente por CURP:', err);
            return res.status(500).json({ message: 'Error interno en el servidor.' });
        }

        if (patientResults && patientResults.length > 0) {
            const paciente = patientResults[0];

            // Si el paciente existe, recuperamos sus acompañantes históricos vinculados (Punto 5)
            const sqlCompanions = `
                SELECT c.* FROM preventive_companions c
                INNER JOIN preventive_patient_companions pc ON c.id = pc.companion_id
                WHERE pc.patient_id = ?
            `;
            pool.query(sqlCompanions, [paciente.id], (errComp, companionResults) => {
                if (errComp) console.error('Error al recuperar acompañantes vinculados:', errComp);
                
                return res.status(200).json({
                    found: true,
                    message: 'Paciente encontrado en el registro institucional.',
                    patient: paciente,
                    companions: companionResults || []
                });
            });
        } else {
            // Si no existe, enviamos todo el catálogo global de tutores disponibles (Punto 5)
            const sqlAllCompanions = `
                SELECT id, curp, 
                CONCAT(first_name, ' ', last_name_paternal, ' ', COALESCE(last_name_maternal, '')) AS full_name, 
                relationship 
                FROM preventive_companions 
                ORDER BY first_name ASC, last_name_paternal ASC
            `;
            pool.query(sqlAllCompanions, (errAll, allCompanions) => {
                if (errAll) {
                    console.error('Error al descargar catálogo global de acompañantes:', errAll);
                    return res.status(200).json({ found: false, availableCompanions: [] });
                }
                
                return res.status(200).json({
                    found: false,
                    message: 'Paciente nuevo. Proceda con la captura.',
                    availableCompanions: allCompanions || []
                });
            });
        }
    });
});






// =========================================================================
// 🚀 ENDPOINT PUT: ACTUALIZACIÓN RELACIONAL TEXTO LIBRE ABSOLUTO (HOMOLOGADO)
// =========================================================================
app.put('/api/preventive-patients/update', (req, res) => {
    const { 
        rfc, curp, firstName, lastNamePaternal, lastNameMaternal, age, gender, phone, email,
        isMinor, companionSelectionType, selectedCompanionId, 
        companionRfc, companionCurp, companionFirstName, companionPaternal, companionMaternal,
        companionAge, companionGender, companionPhone, companionEmail, companionRelationship 
    } = req.body;

    if (!curp || !rfc || !firstName || !lastNamePaternal || !age || !phone || !email) {
        return res.status(400).json({ message: 'Los datos obligatorios para la actualización están incompletos.' });
    }

    const cleanCurp = curp.trim().toUpperCase();
    const pacienteGenderSeguro = (gender && gender.trim() !== "") ? gender.trim().toUpperCase() : 'NO ESPECIFICADO';
    const edadPacienteNumerica = age ? parseInt(age) : 0;

    const sqlUpdatePatient = `
        UPDATE preventive_patients 
        SET rfc = ?, first_name = ?, last_name_paternal = ?, last_name_maternal = ?, age = ?, gender = ?, phone = ?, email = ?
        WHERE curp = ?
    `;

    const patientData = [
        rfc.trim().toUpperCase(), firstName.trim().toUpperCase(), lastNamePaternal.trim().toUpperCase(), 
        lastNameMaternal ? lastNameMaternal.trim().toUpperCase() : '', edadPacienteNumerica, pacienteGenderSeguro, phone.trim(), email.trim().toLowerCase(),
        cleanCurp
    ];

    pool.query(sqlUpdatePatient, patientData, (errUp, resultUp) => {
        if (errUp) {
            console.error('Error al actualizar expediente base:', errUp);
            return res.status(500).json({ message: 'No se pudieron actualizar los datos del paciente.' });
        }

        pool.query('SELECT id FROM preventive_patients WHERE curp = ?', [cleanCurp], (errId, resId) => {
            if (errId || !resId || resId.length === 0) {
                return res.status(500).json({ message: 'Error al recuperar identificador del expediente.' });
            }
            const idDelPaciente = resId[0].id; 

            if (isMinor === true || isMinor === 'true') {
                if (companionSelectionType === 'EXISTING' && selectedCompanionId && selectedCompanionId !== "") {
                    const sqlUpdateExistingComp = `
                        UPDATE preventive_companions 
                        SET rfc = ?, curp = ?, first_name = ?, last_name_paternal = ?, last_name_maternal = ?, age = ?, gender = ?, phone = ?, email = ?, relationship = ?
                        WHERE id = ?
                    `;
                    
                    const tutorGenderSeguro = (companionGender && companionGender.trim() !== "") ? companionGender.trim().toUpperCase() : 'NO ESPECIFICADO';
                    const edadTutorNumerica = companionAge ? parseInt(companionAge) : 0;

                    const compUpdateData = [
                        companionRfc.trim().toUpperCase(), companionCurp.trim().toUpperCase(), companionFirstName.trim().toUpperCase(),
                        companionPaternal.trim().toUpperCase(), companionMaternal ? companionMaternal.trim().toUpperCase() : '',
                        edadTutorNumerica, tutorGenderSeguro, companionPhone.trim(), companionEmail.trim().toLowerCase(), 
                        companionRelationship, parseInt(selectedCompanionId)
                    ];

                    pool.query(sqlUpdateExistingComp, compUpdateData, (errCompUp) => {
                        const sqlUpdateTutorAsPatient = `
                            UPDATE preventive_patients 
                            SET rfc = ?, first_name = ?, last_name_paternal = ?, last_name_maternal = ?, age = ?, gender = ?, phone = ?, email = ?
                            WHERE curp = ?
                        `;
                        
                        const tutorAsPatientData = [
                            companionRfc.trim().toUpperCase(), companionFirstName.trim().toUpperCase(), companionPaternal.trim().toUpperCase(),
                            companionMaternal ? companionMaternal.trim().toUpperCase() : '', edadTutorNumerica, tutorGenderSeguro,
                            companionPhone.trim(), companionEmail.trim().toLowerCase(), companionCurp.trim().toUpperCase()
                        ];

                        pool.query(sqlUpdateTutorAsPatient, tutorAsPatientData, () => {
                            const sqlLink = 'INSERT IGNORE INTO preventive_patient_companions (patient_id, companion_id) VALUES (?, ?)';
                            pool.query(sqlLink, [idDelPaciente, parseInt(selectedCompanionId)], () => {
                                return res.status(200).json({ message: 'Expediente del derechohabiente y datos de su acompañante actualizados con éxito.' });
                            });
                        });
                    });
                }
                else if (companionSelectionType === 'CREATE') {
                    if (!companionRfc || !companionCurp || !companionFirstName || !companionPaternal || !companionAge) {
                        return res.status(400).json({ message: 'Los datos del nuevo acompañante están incompletos.' });
                    }

                    const cleanCompCurp = companionCurp.trim().toUpperCase();
                    const cleanCompRfc = companionRfc.trim().toUpperCase();
                    const tutorGenderSeguro = (companionGender && companionGender.trim() !== "") ? companionGender.trim().toUpperCase() : 'NO ESPECIFICADO';
                    const edadTutorNumerica = companionAge ? parseInt(companionAge) : 0;

                    const sqlInsertComp = `
                        INSERT INTO preventive_companions 
                        (rfc, curp, first_name, last_name_paternal, last_name_maternal, age, gender, phone, email, relationship) 
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        ON DUPLICATE KEY UPDATE first_name=VALUES(first_name), last_name_paternal=VALUES(last_name_paternal), age=VALUES(age), gender=VALUES(gender), phone=VALUES(phone), email=VALUES(email)
                    `;

                    pool.query(sqlInsertComp, [
                        cleanCompRfc, cleanCompCurp, companionFirstName.trim().toUpperCase(),
                        companionPaternal.trim().toUpperCase(), companionMaternal ? companionMaternal.trim().toUpperCase() : '',
                        edadTutorNumerica, tutorGenderSeguro, companionPhone.trim(), companionEmail.trim().toLowerCase(), companionRelationship
                    ], (errC, resultComp) => {
                        if (errC) return res.status(500).json({ message: 'Error al registrar al acompañante.' });

                        const registrarTutorComoPacienteYEnlazar = (idDelTutor) => {
                            const sqlTutorComoPaciente = `
                                INSERT INTO preventive_patients 
                                (rfc, curp, first_name, last_name_paternal, last_name_maternal, age, gender, phone, email) 
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                                ON DUPLICATE KEY UPDATE first_name=VALUES(first_name), last_name_paternal=VALUES(last_name_paternal), age=VALUES(age), gender=VALUES(gender), phone=VALUES(phone), email=VALUES(email)
                            `;
                            pool.query(sqlTutorComoPaciente, [cleanCompRfc, cleanCompCurp, companionFirstName.trim().toUpperCase(), companionPaternal.trim().toUpperCase(), companionMaternal ? companionMaternal.trim().toUpperCase() : '', edadTutorNumerica, tutorGenderSeguro, companionPhone.trim(), companionEmail.trim().toLowerCase()], () => {
                                pool.query('INSERT IGNORE INTO preventive_patient_companions (patient_id, companion_id) VALUES (?, ?)', [idDelPaciente, idDelTutor], () => {
                                    return res.status(200).json({ message: 'Expediente del menor actualizado y nuevo acompañante enlazado con éxito.' });
                                });
                            });
                        };

                        if (resultComp.insertId === 0) {
                            pool.query('SELECT id FROM preventive_companions WHERE curp = ?', [cleanCompCurp], (errCId, resCId) => {
                                if (!errCId && resCId && resCId.length > 0) registrarTutorComoPacienteYEnlazar(resCId[0].id);
                                else res.status(500).json({ message: 'Error al enlazar con el tutor existente.' });
                            });
                        } else {
                            registrarTutorComoPacienteYEnlazar(resultComp.insertId);
                        }
                    });
                } else {
                    return res.status(200).json({ message: 'Expediente del menor actualizado correctamente.' });
                }
            } else {
                return res.status(200).json({ message: 'Expediente de derechohabiente adulto unificado y actualizado con éxito.' });
            }
        });
    });
});















// =========================================================================
// 💉 MODULO VACUNACIÓN - PARTE 1: RUTEO, LIMPIEZA Y BÚSQUEDA RELACIONAL
// =========================================================================

// Variable global de control clínico para el filtrado de biológicos por edad
let _edadPacienteVacunacionGlobal = 0;

/**
 * 🚀 Conmutador de navegación para abrir el formulario de vacunación
 */
function abrirModuloAplicacionVacunas() {
    if (typeof activarModulo === 'function') {
        activarModulo('modulo-aplicacion-vacunas-preventiva', null);
    } else {
        // Alternancia de respaldo si tu ruteador nativo usa el DOM directo
        const views = document.querySelectorAll('.view');
        views.forEach(v => v.style.display = 'none');
        const moduloVac = document.getElementById('modulo-aplicacion-vacunas-preventiva');
        if (moduloVac) moduloVac.style.display = 'block';
    }
}

/**
 * 🚀 Reseteo absoluto de estados y contenedores al volver al panel principal
 */
function volverYLimpiarVacunacion() {
    // Limpieza de textos y cajas nativas
    const formularioVacunas = document.getElementById('form-aplicacion-vacunas');
    if (formularioVacunas) formularioVacunas.reset();
    
    const inputBuscarCurp = document.getElementById('vac-buscar-curp');
    if (inputBuscarCurp) inputBuscarCurp.value = '';

    // Re-bloqueo preventivo de la sección de tutores relacionales
    const seccionTutorVac = document.getElementById('vac-seccion-tutor');
    if (seccionTutorVac) seccionTutorVac.style.display = 'none';

    // Restablece el dropdown de biológicos a su estado inicial de invitación
    const selectBiologico = document.getElementById('vac-biologico-select');
    if (selectBiologico) {
        selectBiologico.innerHTML = '<option value="" disabled selected>-- Primero ingrese la CURP para filtrar biológicos --</option>';
    }

    _edadPacienteVacunacionGlobal = 0;

    // Regresa visualmente al menú de tarjetas institucional
    if (typeof activarModulo === 'function') {
        activarModulo('panel-medicina-preventiva', null);
    } else {
        const views = document.querySelectorAll('.view');
        views.forEach(v => v.style.display = 'none');
        const panelPrincipal = document.getElementById('panel-medicina-preventiva') || document.getElementById('modulo-preventiva-main');
        if (panelPrincipal) panelPrincipal.style.display = 'block';
    }
}

/**
 * 🚀 Buscador en Padrón: Conexión asíncrona Clever Cloud basada en CURP
 */
// Variable global para memorizar la edad del paciente en la consulta de vacunas
let _edadPacienteVacunacionGlobal = 0;

/**
 * 🚀 FUNCIÓN DEL BOTÓN BUSCAR: Se ejecuta de forma imperativa al hacer clic
 */
async function ejecutarBusquedaPadrónVacunas() {
    const inputCurp = document.getElementById('vac-buscar-curp');
    
    // Validamos que la caja no esté vacía y cumpla los 18 caracteres
    if (!inputCurp || inputCurp.value.trim().length !== 18) {
        alert("Por favor, ingrese una CURP válida de 18 caracteres para realizar la búsqueda.");
        return;
    }

    const curp = inputCurp.value.trim().toUpperCase();

    try {
        // Consultamos tu endpoint existente de búsqueda en Clever Cloud
        const response = await fetch(`${BASE_URL}/api/preventive-patients/search/${curp}`);
        const data = await response.json();

        if (data.found) {
            const datosPaciente = data.patient;
            _edadPacienteVacunacionGlobal = datosPaciente.age || 0;

            // 🏛️ AUTO-RELLENO DE LOS CAMPOS VERDES BLOQUEADOS
            document.getElementById('vac-pac-rfc').value = datosPaciente.rfc || '';
            document.getElementById('vac-pac-firstname').value = datosPaciente.first_name || '';
            document.getElementById('vac-pac-paternal').value = datosPaciente.last_name_paternal || '';
            document.getElementById('vac-pac-maternal').value = datosPaciente.last_name_maternal || '';
            document.getElementById('vac-pac-age').value = _edadPacienteVacunacionGlobal;
            document.getElementById('vac-pac-gender').value = datosPaciente.gender || 'NO ESPECIFICADO';
            document.getElementById('vac-pac-phone').value = datosPaciente.phone || '';
            document.getElementById('vac-pac-email').value = datosPaciente.email || '';

            // Revisamos de forma relacional si es un menor de edad
            const seccionTutorVac = document.getElementById('vac-seccion-tutor');
            if (_edadPacienteVacunacionGlobal <= 17) {
                if (seccionTutorVac) seccionTutorVac.style.display = 'grid'; // Muestra los campos del tutor

                // Si tiene un acompañante registrado en la tabla intermedia, lo pintamos
                if (data.companions) {
                    const tutor = data.companions;
                    document.getElementById('vac-tut-curp').value = tutor.curp || '';
                    document.getElementById('vac-tut-fullname').value = `${tutor.first_name} ${tutor.last_name_paternal} ${tutor.last_name_maternal || ''}`.toUpperCase();
                    document.getElementById('vac-tut-relationship').value = tutor.relationship || 'TUTOR RESPONSABLE';
                    document.getElementById('vac-tut-phone').value = tutor.phone || '';
                }
            } else {
                if (seccionTutorVac) seccionTutorVac.style.display = 'none'; // Se oculta si es adulto
            }

            // Llamamos a la matriz para que filtre las vacunas aptas para su edad
            if (typeof filtrarBiologicosAptosPorEdad === 'function') {
                filtrarBiologicosAptosPorEdad(_edadPacienteVacunacionGlobal);
            }

        } else {
            // 🛑 Temporal: Si no lo encuentra, solo mandamos un alert común por el momento
            alert(`La CURP [${curp}] no se encuentra registrada en el sistema.`);
        }

    } catch (error) {
        console.error('Error asíncrono en buscador de vacunación:', error);
    }
}





// =========================================================================
// 💉 MODULO VACUNACIÓN - PARTE 2: MATRIZ CLÍNICA Y GUARDADO DE CONSULTA
// =========================================================================

/**
 * 🚀 MATRIZ INSTITUCIONAL DE INMUNIZACIONES: Inyecta vacunas según la edad demográfica
 */
function filtrarBiologicosAptosPorEdad(edad) {
    const selectBiologico = document.getElementById('vac-biologico-select');
    if (!selectBiologico) return;

    // Limpiamos el dropdown dejando una invitación limpia de captura activa
    selectBiologico.innerHTML = '<option value="" disabled selected>-- Seleccione un Biológico Disponible --</option>';

    let catalogoApto = [];

    // Categoría A: Cartilla Nacional de Niñez y Adolescencia (0 a 17 años)
    if (edad <= 17) {
        catalogoApto = [
            { id: "BCG", name: "BCG (Tuberculosis - Única dosis al nacer)" },
            { id: "HEPATITIS_B_INFANTIL", name: "HEPATITIS B (Dosis Infantil)" },
            { id: "HEXAVALENTE", name: "HEXAVALENTE ACELULAR (Difteria, Tétanos, Tos ferina, Polio, Hib, Hep B)" },
            { id: "ROTAVIRUS", name: "ROTAVIRUS (Prevención de diarreas graves)" },
            { id: "NEUMOCOCICA_CONJUGADA", name: "NEUMOCOCICA CONJUGADA (Infecciones por Neumococo)" },
            { id: "INFLUENZA_ESTACIONAL", name: "INFLUENZA ESTACIONAL (Dosis Pediátrica)" },
            { id: "SRP", name: "SRP (Sarampión, Rubéola y Parotiditis / Paperas)" },
            { id: "VPH", name: "VPH (Virus del Papiloma Humano - Adolescentes)" },
            { id: "TDPA", name: "TDPA (Tétanos, Difteria, Tos Ferina acelular - A partir de los 10 años)" }
        ];
    } 
    // Categoría B: Cartilla Nacional de Adulto Mayor (60 años o más)
    else if (edad >= 60) {
        catalogoApto = [
            { id: "NEUMOCOCICA_POLIVALENTE", name: "NEUMOCOCICA POLIVALENTE (Protección contra neumonía en el adulto mayor)" },
            { id: "INFLUENZA_ESTACIONAL", name: "INFLUENZA ESTACIONAL (Dosis Adulto - Refuerzo Anual)" },
            { id: "TD", name: "TD (Tétanos y Difteria - Refuerzo cada 10 años)" },
            { id: "COVID_19_REFUERZO", name: "COVID-19 (Refuerzo anual estacional / Inmunización activa)" }
        ];
    } 
    // Categoría C: Cartilla Nacional de la Mujer y el Hombre (Adultos de 18 a 59 años)
    else {
        catalogoApto = [
            { id: "TD", name: "TD (Tétanos y Difteria - Esquema o refuerzo)" },
            { id: "SR", name: "SR (Sarampión y Rubéola - Doble viral si no cuenta con antecedente vacunal)" },
            { id: "HEPATITIS_B_ADULTO", name: "HEPATITIS B (Dosis Adulto - Grupos de riesgo o rezago)" },
            { id: "INFLUENZA_ESTACIONAL", name: "INFLUENZA ESTACIONAL (Aplicación invernal en población con comorbilidades)" },
            { id: "COVID_19_ADULTO", name: "COVID-19 (Esquema primario o rezago institucional)" }
        ];
    }

    // Inyectamos las opciones filtradas al elemento <select>
    catalogoApto.forEach(vacuna => {
        const option = document.createElement('option');
        option.value = vacuna.id;
        option.textContent = vacuna.name.toUpperCase();
        selectBiologico.appendChild(option);
    });
}

/**
 * 🚀 TRANSMISIÓN TRANSACCIONAL: Envío del registro de vacunación a Render
 */
async function guardarAplicacionVacunaNube(event) {
    event.preventDefault();

    // Habilitamos temporalmente los campos demográficos bloqueados solo para extraer la CURP
    const inputCurpPadrón = document.getElementById('vac-buscar-curp');
    if (!inputCurpPadrón || inputCurpPadrón.value.trim().length !== 18) {
        alert("Error de validación: Debe buscar una CURP válida del padrón antes de registrar.");
        return;
    }

    const curpPaciente = inputCurpPadrón.value.trim().toUpperCase();

    // Extraemos los campos de captura activa del formulario clínico
    const selectVacuna = document.getElementById('vac-biologico-select');
    const selectDosis = document.getElementById('vac-dosis');
    const inputLote = document.getElementById('vac-lote');
    const inputObs = document.getElementById('vac-observaciones');

    const payload = {
        curp: curpPaciente,
        vaccineId: selectVacuna ? selectVacuna.value : '',
        dose: selectDosis ? selectDosis.value : 'UNICA',
        lotNumber: inputLote ? inputLote.value.trim().toUpperCase() : '',
        observations: inputObs ? inputObs.value.trim().toUpperCase() : 'SIN EVENTUALIDADES',
        ageAtApplication: _edadPacienteVacunacionGlobal
    };

    // Alertas preventivas previas al fetch
    if (!payload.vaccineId || !payload.lotNumber) {
        alert("Los datos obligatorios de la inmunización (Vacuna y Número de Lote) están incompletos.");
        return;
    }

    try {
        const response = await fetch(`${BASE_URL}/api/preventive-vaccines/apply`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.message || 'Error desconocido en el servidor de Render.');
        }

        const data = await response.json();
        alert(data.message); // Notifica el éxito institucional
        volverYLimpiarVacunacion(); // Limpia el formulario y regresa al panel

    } catch (error) {
        alert(`Error en la operación de vacunación: ${error.message}`);
    }
}





















// =========================================================================
// 4. SERVIR EL HTML
// =========================================================================
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 5. ARRANCAR EL SERVIDOR
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor del segundo proyecto corriendo en puerto: ${PORT}`);
});
