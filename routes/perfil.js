// routes/perfil.js
 
const express = require('express');
const router = express.Router();
const { query } = require('../db');
const authenticateToken = require('../middleware/authMiddleware');
 
 
// GET /perfil ------------------------------------------------------------
// Datos reales de la usuaria logueada desde la BD
router.get('/perfil', authenticateToken, async (req, res) => {
  try {
    const sql = `
      SELECT u.id_usuario, u.nombre, u.apellidos, u.email,
             u.telefono, u.zona, u.fecha_alta, u.estado,
             r.nombre_rol
      FROM usuario u
      JOIN rol r ON u.id_rol = r.id_rol
      WHERE u.id_usuario = $1;
    `;
    const result = await query(sql, [req.user.id]);
 
    if (result.rows.length === 0)
      return res.status(404).json({ error: 'Usuaria no encontrada' });
 
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error al obtener el perfil:', error);
    res.status(500).json({ error: 'Error al obtener el perfil' });
  }
});
 
 
// PUT /perfil ----------------------------------------------------------
// Actualizar datos básicos de la usuaria logueada
router.put('/perfil', authenticateToken, async (req, res) => {
  const { telefono, zona } = req.body;
 
  // CORRECCIÓN: antes no se validaba que llegara al menos un campo.
  // Si se hacía PUT /perfil con body vacío, el UPDATE se ejecutaba
  // sin cambiar nada y devolvía la misma fila sin avisar.
  if (!telefono && !zona) {
    return res.status(400).json({ error: 'Debes enviar al menos un campo: telefono o zona' });
  }
 
  try {
    const sql = `
      UPDATE usuario
      SET telefono = COALESCE($1, telefono),
          zona     = COALESCE($2, zona)
      WHERE id_usuario = $3
      RETURNING id_usuario, nombre, apellidos, email, telefono, zona, id_rol;
    `;
    const result = await query(sql, [telefono, zona, req.user.id]);
 
    if (result.rows.length === 0)
      return res.status(404).json({ error: 'Usuaria no encontrada' });
 
    res.json({ message: 'Perfil actualizado', usuario: result.rows[0] });
  } catch (error) {
    console.error('Error al actualizar el perfil:', error);
    res.status(500).json({ error: 'Error al actualizar el perfil' });
  }
});
 
 
module.exports = router;
