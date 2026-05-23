// middleware/roleMiddleware.js
 
// Uso: requireRol(3)      → solo admin
//      requireRol(2, 3)   → tecnico o admin
//      requireRol(1, 2, 3)→ cualquier rol autenticado
// IMPORTANTE: usar siempre después de authenticateToken
// porque necesita que req.user ya esté definido
 
function requireRol(...rolesPermitidos) {
  return (req, res, next) => {
    if (!req.user) {
      // Nunca debería llegar aquí si authenticateToken está antes,
      // pero lo cubrimos por si se usa requireRol sin authenticateToken
      return res.status(401).json({ error: 'No autenticado' });
    }
    if (!rolesPermitidos.includes(req.user.rol)) {
      return res.status(403).json({ error: 'No tienes permisos para esta acción' });
    }
    next();
  };
}
 
module.exports = requireRol;
