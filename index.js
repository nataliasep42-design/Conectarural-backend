// index.js
 
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:8080',
  /^http:\/\/localhost:\d+$/,  // permite CUALQUIER puerto localhost
];
 
// Carga variables de entorno (.env) — SIEMPRE lo primero
dotenv.config();
 
const app = express();
const PORT = process.env.PORT || 3000;
const rateLimit = require('express-rate-limit');
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Demasiados intentos. Inténtalo de nuevo más tarde.' }
});
 
// Middlewares globales
app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    
    const allowed = allowedOrigins.some(o =>
      typeof o === 'string' ? o === origin : o.test(origin)
    );
    
    if (allowed) return callback(null, true);
    return callback(new Error('Origen no permitido por CORS'));
  },
  credentials: true,
}));
app.use(express.json());
 
// Rutas de diagnóstico (solo en desarrollo)--------------------------------
// En producción estas rutas no existen y no exponen info del servidor
if (process.env.NODE_ENV !== 'production') {
  const { query } = require('./db');
 
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'ConectaRural API funcionando' });
  });
 
  app.get('/test-db', async (req, res) => {
    try {
      const result = await query('SELECT NOW() AS now');
      res.json({ db: 'ok', now: result.rows[0].now });
    } catch (error) {
      res.status(500).json({ db: 'error', error: 'No se pudo conectar a la base de datos' });
    }
  });
}


 
// Rutas-----------------------------------------------------------------
app.use('/auth',        require('./routes/auth'));
app.use('/',            require('./routes/perfil'));
app.use('/usuarios',    require('./routes/usuarios'));
app.use('/',            require('./routes/cursos'));
app.use('/',            require('./routes/inscripciones'));
app.use('/',            require('./routes/descargas'));
app.use('/incidencias', require('./routes/incidencias'));
app.use('/',            require('./routes/asignaciones'));
app.use('/',            require('./routes/stats'));
app.use('/admin',       require('./routes/admin'));
// Handler 404 -----------------------------------------------------------
// Captura cualquier ruta que no haya sido registrada arriba
app.use((req, res) => {
  res.status(404).json({ error: `Ruta ${req.method} ${req.path} no encontrada` });
});
 
// Handler global de errores ----------------------------------------------
// Captura cualquier error que llegue con next(err) desde las rutas
// Sin este handler Express devuelve HTML con el stack trace completo
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('Error no controlado:', err);
  res.status(500).json({ error: 'Error interno del servidor' });
});
 
// Arrancar servidor --------------------------------------------------------
app.listen(PORT, () => {
  console.log(`ConectaRural API escuchando en http://localhost:${PORT}`);
  console.log(`Entorno: ${process.env.NODE_ENV || 'development'}`);
});
