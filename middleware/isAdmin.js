// middleware/isAdmin.js
const isAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'No autenticado' });
  }
  if (req.user.rol !== 3) {
    return res.status(403).json({ error: 'Acceso denegado. Se requiere rol de administrador.' });
  }
  next();
};

const isAdminOrTecnica = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'No autenticado' });
  }
  if (req.user.rol !== 2 && req.user.rol !== 3) {
    return res.status(403).json({ error: 'Acceso denegado. Se requiere rol de tecnica o administrador.' });
  }
  next();
};

module.exports = { isAdmin, isAdminOrTecnica };