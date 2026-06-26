const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const path = require('path'); 

const app = express();

// =========================================================================
// 1. MIDDLEWARES (CONFIGURADO CON TU URL REAL DE GITHUB PAGES)
// =========================================================================
app.use(cors({
    origin: [
        'https://ensenanzaermita.github.io', // Tu dominio oficial de GitHub Pages
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
// 3. RUTAS DE LA API (EXCLUSIVAS DE ESTE SEGUNDO PROYECTO)
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

        const user = results[0]; // Extracción segura del objeto de usuario

        if (user.role !== requiredRole && user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'No tienes permisos para acceder.' });
        }

        res.status(200).json({ success: true, message: 'Acceso autorizado.' });
    });
});

// RUTA API: Obtener toda la plantilla con los nombres separados
app.get('/api/doctors', (req, res) => {
    // Traemos los campos desglosados y mantenemos 'name' por compatibilidad si se requiere
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

    // Validamos duplicados de número de empleado (RFC)
    const checkSql = 'SELECT * FROM employees WHERE rfc = ?';
    pool.query(checkSql, [rfc], (err, results) => {
        if (err) {
            console.error('Error al buscar duplicado:', err);
            return res.status(500).json({ message: 'Error interno en el servidor.' });
        }
        if (results && results.length > 0) {
            return res.status(400).json({ message: 'Este número de empleado ya se encuentra registrado.' });
        }

        // Concatenamos el nombre completo de forma automática para llenar el campo 'name' viejo y no romper vistas antiguas
        const nameCompleto = `${lastNamePaternal} ${lastNameMaternal || ''} ${firstName}`.trim().toUpperCase();

        // Inserción limpia de los nuevos campos desglosados + el nombre compuesto
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
    // CORRECCIÓN: Se cambiaron comillas dobles por comillas simples estándar en 'médico'
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
    // CORRECCIÓN: Se cambiaron comillas dobles por comillas simples estándar en 'médico'
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

    // --- VALIDACIÓN 1: Verificar si el médico ya tiene un consultorio asignado ---
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

        // --- VALIDACIÓN 2: Verificar si el consultorio ya está ocupado en ese turno ---
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

            // --- INSERCIÓN LIMPIA: Si pasa ambos filtros, se guarda en la tabla independiente ---
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





// RUTA API: Eliminar una asignación (Elimina el registro de la tabla intermedia)
app.delete('/api/assignments/:employeeId', (req, res) => {
    const { employeeId } = req.params;
    const sql = 'DELETE FROM doctor_offices WHERE employee_id = ?';
    pool.query(sql, [employeeId], (err, result) => {
        if (err) {
            console.error('Error al eliminar asignación independiente:', err);
            return res.status(500).json({ message: 'Error interno al intentar remover la vinculación.' });
        }
        res.status(200).json({ message: 'Asignación removida correctamente de la tabla independiente.' });
    });
});








// RUTA API: Registrar trámite incluyendo el motivo del cambio y consultorios cruzados
app.post('/api/office-changes', (req, res) => {
    const {
        paternalLastname, maternalLastname, firstNames, rfc,
        isWorker, isPensioner, street, extNum, intNum, colonia,
        postalCode, age, maritalStatus, phone, insuredType, totalFamilyMembers,
        beneficiaries, currentOfficeId, currentOfficeReason, requestedOfficeId, requestedOfficeReason
    } = req.body;

    if (!paternalLastname || !firstNames || !rfc || !currentOfficeId || !requestedOfficeId) {
        return res.status(400).json({ message: 'Todos los datos obligatorios y la selección de consultorios deben ser requisitados.' });
    }

    if (parseInt(currentOfficeId) === parseInt(requestedOfficeId)) {
        return res.status(400).json({ message: 'El consultorio solicitado debe ser diferente al consultorio actual.' });
    }

    const beneficiariesJson = beneficiaries ? JSON.stringify(beneficiaries) : '[]';

    const insertSql = `
        INSERT INTO office_change_requests (
            paternal_lastname, maternal_lastname, first_names, rfc,
            is_worker, is_pensioner, street, ext_num, int_num, colonia,
            postal_code, age, marital_status, phone, insured_type, total_family_members,
            beneficiaries, current_office_id, current_office_reason, requested_office_id, requested_office_reason
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
        insuredType,
        parseInt(totalFamilyMembers),
        beneficiariesJson,
        parseInt(currentOfficeId),
        currentOfficeReason.trim().toUpperCase(),
        parseInt(requestedOfficeId),
        requestedOfficeReason.trim().toUpperCase()
    ], (err, result) => {
        if (err) {
            console.error('Error al insertar trámite con motivos:', err);
            return res.status(500).json({ message: 'No se pudo guardar la solicitud.' });
        }
        res.status(201).json({ message: 'Solicitud tramitada correctamente.' });
    });
});














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
