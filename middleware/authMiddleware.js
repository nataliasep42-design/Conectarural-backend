// middleware/authMiddleware.js
 
const jwt = require('jsonwebtoken');
 
function authenticateToken(req, res, next) {
  // 1. Leer cabecera Authorization
  const authHeader = req.headers['authorization']; // 'Bearer <token>'
  const token = authHeader && authHeader.split(' ')[1];
 
  if (!token) {
    return res.status(401).json({ error: 'Token no proporcionado. Acceso denegado.' });
  }
 
  try {
    // 2. Verificar token con la clave del .env
    // Se accede en tiempo de ejecución (no en carga del módulo) para
    // garantizar que dotenv ya ha cargado las variables
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
 
    // 3. Adjuntar payload al request: { id, rol }
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token caducado. Vuelve a iniciar sesión.' });
    }
    return res.status(403).json({ error: 'Token inválido.' });
  }
}
 
module.exports = authenticateToken;
