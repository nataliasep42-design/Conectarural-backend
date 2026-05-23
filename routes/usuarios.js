// routes/usuarios.js
 
const express = require('express');
const router = express.Router();
const { query } = require('../db');
const authenticateToken = require('../middleware/authMiddleware');
const requireRol = require('../middleware/roleMiddleware');
 
// Prefijo /usuarios definido en index.js
// / → /usuarios    /:id → /usuarios/:id


// GET /usuarios ------------------------------------------------------------
// Listar todos los usuarios con filtros opcionales
// CORRECCIÓN: era requireRol(2, 3) → técnicas podían ver todos los usuarios.
// Solo admin (rol 3) debe tener acceso al listado completo.
router.get('/', authenticateToken, requireRol(3), async (req, res) => {
  const { rol, zona, estado } = req.query;
  const params = [];
 
  let sql = `
    SELECT u.id_usuario, u.nombre, u.apellidos, u.email,
           u.telefono, u.zona, u.estado, u.fecha_alta, r.nombre_rol
    FROM usuario u
    JOIN rol r ON u.id_rol = r.id_rol
    WHERE 1=1
  `;
 
  if (rol)    { params.push(rol);    sql += ` AND r.nombre_rol = $${params.length}`; }
  if (zona)   { params.push(zona);   sql += ` AND u.zona = $${params.length}`; }
  if (estado) { params.push(estado); sql += ` AND u.estado = $${params.length}`; }
 
  sql += ' ORDER BY u.nombre;';
 
  try {
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});
 
 
// GET /usuarios/:id ---------------------------------------------------------
// Ficha detallada de un usuario
// CORRECCIÓN: era requireRol(2, 3) — mismo razonamiento, solo admin.
router.get('/:id', authenticateToken, requireRol(3), async (req, res) => {
  if (isNaN(parseInt(req.params.id))) {
    return res.status(400).json({ error: 'El id debe ser un número' });
  }
 
  try {
    const sql = `
      SELECT u.id_usuario, u.nombre, u.apellidos, u.email,
             u.telefono, u.zona, u.estado, u.fecha_alta, r.nombre_rol
      FROM usuario u
      JOIN rol r ON u.id_rol = r.id_rol
      WHERE u.id_usuario = $1;
    `;
    const result = await query(sql, [req.params.id]);
 
    if (result.rows.length === 0)
      return res.status(404).json({ error: 'Usuario no encontrado' });
 
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error al obtener el usuario:', error);
    res.status(500).json({ error: 'Error al obtener el usuario' });
  }
});
 
 
// PUT /usuarios/:id ----------------------------------------------------------
// Editar datos o activar/desactivar usuaria — solo admin (rol 3)
router.put('/:id', authenticateToken, requireRol(3), async (req, res) => {
  const { nombre, apellidos, telefono, zona, estado } = req.body;
 
  if (!nombre && !apellidos && !telefono && !zona && !estado) {
    return res.status(400).json({ error: 'Debes enviar al menos un campo para actualizar' });
  }
 
  const estadosValidos = ['activo', 'inactivo'];
  if (estado && !estadosValidos.includes(estado)) {
    return res.status(400).json({ error: `estado debe ser: ${estadosValidos.join(', ')}` });
  }
 
  if (isNaN(parseInt(req.params.id))) {
    return res.status(400).json({ error: 'El id debe ser un número' });
  }
 
  try {
    const sql = `
      UPDATE usuario
      SET nombre    = COALESCE($1, nombre),
          apellidos = COALESCE($2, apellidos),
          telefono  = COALESCE($3, telefono),
          zona      = COALESCE($4, zona),
          estado    = COALESCE($5, estado)
      WHERE id_usuario = $6
      RETURNING id_usuario, nombre, apellidos, email, telefono, zona, estado;
    `;
    const result = await query(sql, [nombre, apellidos, telefono, zona, estado, req.params.id]);
 
    if (result.rows.length === 0)
      return res.status(404).json({ error: 'Usuario no encontrado' });
 
    res.json({ message: 'Usuario actualizado', usuario: result.rows[0] });
  } catch (error) {
    console.error('Error al actualizar el usuario:', error);
    res.status(500).json({ error: 'Error al actualizar el usuario' });
  }
});
 
 
module.exports = router;