console.log('ESTA ES LA VERSIÓN NUEVA DEL ARCHIVO 1.0.0');
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

// RUTA API: Validación de usuarios y roles para el login
app.post('/api/login', (req, res) => {
    const { username, password, requiredRole } = req.body;

    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Usuario y contraseña obligatorios.' });
    }

    const sql = 'SELECT * FROM users WHERE username = ? AND password = ?';
    
    pool.query(sql, [username, password], (err, results) => {
        if (err) {
            console.error('Error en consulta de login:', err);
            return res.status(500).json({ success: false, message: 'Error interno en el servidor.' });
        }

        if (!results || results.length === 0) {
            return res.status(401).json({ success: false, message: 'Usuario o contraseña incorrectos.' });
        }

        const user = results[0]; 

        if (user.role !== requiredRole && user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'No tienes permisos para acceder.' });
        }

        res.status(200).json({ success: true, message: 'Acceso autorizado.' });
    });
});

// RUTA API: Obtener toda la plantilla con los nombres separados
app.get('/api/doctors', (req, res) => {
    const sql = 'SELECT id, rfc, first_name, last_name_paternal, last_name_maternal, name, shift, category, created_at FROM employees ORDER BY last_name_paternal ASC, first_name ASC';
    
    pool.query(sql, (err, results) => {
        if (err) {
            console.error('Error al consultar plantilla:', err);
            return res.status(500).json({ message: 'Error al obtener los datos de la base de datos.' });
        }
        res.status(200).json(results);
    });
});

// RUTA API: Registrar personal con nombre desglosado
app.post('/api/doctors', (req, res) => {
    const { rfc, firstName, lastNamePaternal, lastNameMaternal, shift, category } = req.body;
    
    if (!rfc || !firstName || !lastNamePaternal) {
        return res.status(400).json({ message: 'El RFC, Nombre y Apellido Paterno son obligatorios.' });
    }

    const checkSql = 'SELECT * FROM employees WHERE rfc = ?';
    pool.query(checkSql, [rfc], (err, results) => {
        if (err) {
            console.error('Error al buscar duplicado:', err);
            return res.status(500).json({ message: 'Error interno en el servidor.' });
        }
        if (results && results.length > 0) {
            return res.status(400).json({ message: 'Este número de empleado ya se encuentra registrado.' });
        }

        const nameCompleto = `${lastNamePaternal} ${lastNameMaternal || ''} ${firstName}`.trim().toUpperCase();

        const insertSql = 'INSERT INTO employees (rfc, first_name, last_name_paternal, last_name_maternal, name, shift, category) VALUES (?, ?, ?, ?, ?, ?, ?)';
        pool.query(insertSql, [rfc, firstName, lastNamePaternal, lastNameMaternal || '', nameCompleto, shift || 'Matutino', category || 'médico'], (err, result) => {
            if (err) {
                console.error('Error al insertar registro:', err);
                return res.status(500).json({ message: 'No se pudieron guardar los datos en el servidor.' });
            }
            res.status(201).json({ message: 'Personal registrado correctamente.' });
        });
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
app.get('/api/offices', (req, res) => {
    const sql = 'SELECT id, office_name, shift, created_at FROM offices ORDER BY office_name ASC, shift ASC';
    pool.query(sql, (err, results) => {
        if (err) {
            console.error('Error al consultar consultorios:', err);
            return res.status(500).json({ message: 'Error al obtener los consultorios de la base de datos.' });
        }
        res.status(200).json(results);
    });
});

// RUTA API: Registrar un consultorio nuevo (Valida texto y duplicados por turno)
app.post('/api/offices', (req, res) => {
    const { officeName, shift } = req.body;
    
    if (!officeName || !shift) {
        return res.status(400).json({ message: 'El nombre del consultorio y el turno son obligatorios.' });
    }

    const officeUpper = officeName.trim().toUpperCase();

    const checkSql = 'SELECT * FROM offices WHERE office_name = ? AND shift = ?';
    pool.query(checkSql, [officeUpper, shift], (err, results) => {
        if (err) {
            console.error('Error al buscar consultorio duplicado:', err);
            return res.status(500).json({ message: 'Error interno en el servidor.' });
        }
        if (results && results.length > 0) {
            return res.status(400).json({ message: 'Este consultorio ya está registrado para el turno seleccionado.' });
        }

        const insertSql = 'INSERT INTO offices (office_name, shift) VALUES (?, ?)';
        pool.query(insertSql, [officeUpper, shift], (err, result) => {
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


// =========================================================================
// 3. RUTAS DE LA API - PARTE B2 (TRÁMITES, DICTAMINACIÓN Y ARRANQUE)
// =========================================================================

// RUTA API POST: Recibir trámite incluyendo el nuevo campo 'email'
app.post('/api/office-changes', (req, res) => {
    const {
        paternalLastname, maternalLastname, firstNames, rfc,
        isWorker, isPensioner, street, extNum, intNum, colonia,
        postalCode, age, maritalStatus, phone, email, insuredType, totalFamilyMembers,
        beneficiaries, currentOfficeId, requestedOfficeId, changeReason
    } = req.body;

    if (!paternalLastname || !firstNames || !rfc || !email || !currentOfficeId || !requestedOfficeId || !changeReason) {
        return res.status(400).json({ message: 'Todos los datos obligatorios, incluyendo el correo y el motivo de cambio, deben ser requisitados.' });
    }

    const insertSql = `
        INSERT INTO office_change_requests (
            paternal_lastname, maternal_lastname, first_names, rfc,
            is_worker, is_pensioner, street, ext_num, int_num, colonia,
            postal_code, age, marital_status, phone, email, insured_type, total_family_members,
            beneficiaries, current_office_id, requested_office_id, change_reason
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

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
        changeReason.trim().toUpperCase()
    ], (err, result) => {
        if (err) {
            console.error('Error al insertar trámite en Clever Cloud:', err);
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
                        <a href="https://encuestas-ermita-salud-mental.onrender.com/" target="_blank" rel="noopener noreferrer" style="background-color: #611232; color: white; border: 1px solid #b38e5d; padding: 10px 20px; text-decoration: none; border-radius: 4px; font-weight: bold; font-size: 0.9em; display: inline-block; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
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
