const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const path = require('path'); 

const app = express();

// 1. MIDDLEWARES
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.static(__dirname)); 

// 2. CONFIGURACIÓN MEDIANTE POOL DE CONEXIONES (MÁS SEGURO Y EFICIENTE)
const pool = mysql.createPool({
    host: 'bqxquadwgh6wn3twrgyy-mysql.services.clever-cloud.com',
    user: 'usp9nsl8ipuiouao',
    password: 'vXf0fCll6xPxv7f6XV84',
    database: 'bqxquadwgh6wn3twrgyy',
    port: 3306,
    waitForConnections: true,
    connectionLimit: 5, // Límite estricto para no saturar el plan gratuito de Clever Cloud
    queueLimit: 0
});

// Verificación inicial del Pool
pool.getConnection((err, connection) => {
    if (err) {
        console.error('Error crítico al obtener conexión del Pool en Clever Cloud:', err);
        return;
    }
    console.log('¡Pool de conexiones verificado y activo con Clever Cloud!');
    connection.release(); // Libera la conexión de prueba inmediatamente
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
    
    // Usamos pool.query en lugar de db.query
    pool.query(sql, [username, password], (err, results) => {
        if (err) {
            console.error('Error en consulta de login:', err);
            return res.status(500).json({ success: false, message: 'Error interno en el servidor.' });
        }

        if (!results || results.length === 0) {
            return res.status(401).json({ success: false, message: 'Usuario o contraseña incorrectos.' });
        }

        const user = results[0]; // Extraemos la fila del usuario

        if (user.role !== requiredRole && user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'No tienes permisos para acceder.' });
        }

        res.status(200).json({ success: true, message: 'Acceso autorizado.' });
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
