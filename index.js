// index.js

const express = require('express');
const cors    = require('cors');
const path    = require('path');
const dotenv = require('dotenv');

// Carga variables de entorno antes de cualquier otra cosa
dotenv.config();

// Sentry: monitorización de errores — activar con SENTRY_DSN en .env
// Si no hay DSN, la app sigue funcionando sin monitorización.
let Sentry = null;
if (process.env.SENTRY_DSN) {
  try {
    Sentry = require('@sentry/node');
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      tracesSampleRate: 0.1,
      environment: process.env.NODE_ENV || 'development',
    });
    console.log('Sentry inicializado correctamente');
  } catch (e) {
    console.warn('Sentry no pudo inicializarse (opcional):', e.message);
    Sentry = null;
  }
}

const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:8080',
  /^http:\/\/localhost:\d+$/,  // permite CUALQUIER puerto localhost
];
 
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

// Servir archivos estáticos de uploads (vídeos subidos por el admin)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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
app.use('/',            require('./routes/fcm_tokens'));
// Handler 404 -----------------------------------------------------------
// Captura cualquier ruta que no haya sido registrada arriba
app.use((req, res) => {
  res.status(404).json({ error: `Ruta ${req.method} ${req.path} no encontrada` });
});
 
// Handler de errores Sentry (debe ir antes del handler personalizado)
if (Sentry) {
  app.use(Sentry.expressErrorHandler());
}

// Handler global de errores ----------------------------------------------
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
