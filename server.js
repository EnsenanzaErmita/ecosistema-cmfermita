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
