const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const path = require('path'); 

const app = express();

// 1. MIDDLEWARES
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.static(__dirname)); 

// 2. CONFIGURACIÓN DE BASE DE DATOS (REUTILIZA TU MISMA BD DE CLEVER CLOUD)
const dbConfig = {
    host: '://clever-cloud.com',
    user: 'usp9nsl8ipuiouao',
    password: 'vXf0fCll6xPxv7f6XV84',
    database: 'bqxquadwgh6wn3twrgyy',
    port: 3306
};

let db;

function handleDisconnect() {
    db = mysql.createConnection(dbConfig); 

    db.connect(err => {
        if (err) {
            console.error('Error al reconectar a MySQL, reintentando...', err);
            setTimeout(handleDisconnect, 2000); 
        } else {
            console.log('¡Conexión exitosa a Clever Cloud desde el Segundo Proyecto!');
        }
    });

    db.on('error', err => {
        console.error('Error en el nodo de MySQL:', err);
        if (err.code === 'PROTOCOL_CONNECTION_LOST' || err.code === 'ECONNRESET') {
            handleDisconnect(); 
        } else {
            throw err;
        }
    });
}

handleDisconnect();

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
    db.query(sql, [username, password], (err, results) => {
        if (err) {
            console.error('Error en login:', err);
            return res.status(500).json({ success: false, message: 'Error interno.' });
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
