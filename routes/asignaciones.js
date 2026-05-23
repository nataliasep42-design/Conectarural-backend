// routes/asignaciones.js
 
const express = require('express');
const router = express.Router();
const { query } = require('../db');
const authenticateToken = require('../middleware/authMiddleware');
const requireRol = require('../middleware/roleMiddleware');
 
 
// GET /tecnicos ------------------------------------------------------
// Listar técnicas disponibles — técnica o admin
// Una técnica puede consultar el listado para reasignaciones internas;
// el admin lo usa para gestión completa.
router.get('/tecnicos', authenticateToken, requireRol(2, 3), async (req, res) => {
  const { zona, estado } = req.query;
  const params = [];
 
  let sql = `
    SELECT u.id_usuario, u.nombre, u.apellidos, u.email,
           u.telefono, u.zona, u.estado
    FROM usuario u
    JOIN rol r ON u.id_rol = r.id_rol
    WHERE r.nombre_rol = 'tecnico'
  `;
 
  if (zona)   { params.push(zona);   sql += ` AND u.zona = $${params.length}`; }
  if (estado) { params.push(estado); sql += ` AND u.estado = $${params.length}`; }
 
  sql += ' ORDER BY u.nombre;';
 
  try {
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener las técnicas' });
  }
});
 
 
// POST /asignaciones -------------------------------------------------
// Crear asignación técnica–usuaria — solo admin (rol 3)
router.post('/asignaciones', authenticateToken, requireRol(3), async (req, res) => {
  const { id_tecnico, id_usuaria, notas } = req.body;
 
  if (!id_tecnico || !id_usuaria) {
    return res.status(400).json({ error: 'Faltan campos obligatorios: id_tecnico, id_usuaria' });
  }
  if (id_tecnico === id_usuaria) {
    return res.status(400).json({ error: 'Un técnico no puede asignarse a sí mismo' });
  }
 
  try {
    const sql = `
      INSERT INTO asignacion_tecnico_usuaria (id_tecnico, id_usuaria, notas)
      VALUES ($1, $2, $3)
      RETURNING *;
    `;
    const result = await query(sql, [id_tecnico, id_usuaria, notas]);
    res.status(201).json({ message: 'Asignación creada', asignacion: result.rows[0] });
  } catch (error) {
    if (error.code === '23505')
      return res.status(400).json({ error: 'Esta técnica ya está asignada a esa usuaria' });
    if (error.code === '23503')
      return res.status(400).json({ error: 'El id_tecnico o id_usuaria no existe en la base de datos' });
    console.error('Error al crear la asignación:', error);
    res.status(500).json({ error: 'Error al crear la asignación' });
  }
});
 
 
// GET /asignaciones/tecnico/:id---------------------------------------
// Usuarias asignadas a una técnica concreta — técnica o admin
// CORRECCIÓN DE SEGURIDAD: antes cualquier técnica autenticada podía
// consultar las asignaciones de otra técnica pasando su id en la URL.
// Ahora una técnica (rol 2) solo puede ver las suyas propias.
// Un admin (rol 3) puede ver las de cualquier técnica.
router.get('/asignaciones/tecnico/:id', authenticateToken, requireRol(2, 3), async (req, res) => {
  if (isNaN(parseInt(req.params.id))) {
    return res.status(400).json({ error: 'El id debe ser un número' });
  }
 
  // Una técnica solo puede consultar sus propias asignaciones
  if (req.user.rol === 2 && parseInt(req.params.id) !== req.user.id) {
    return res.status(403).json({ error: 'Solo puedes consultar tus propias asignaciones' });
  }
 
  try {
    const sql = `
      SELECT a.id_asignacion, a.fecha, a.estado AS asignacion_estado, a.notas,
             u.id_usuario, u.nombre, u.apellidos, u.email,
             u.telefono, u.zona, u.estado AS usuaria_estado
      FROM asignacion_tecnico_usuaria a
      JOIN usuario u ON a.id_usuaria = u.id_usuario
      WHERE a.id_tecnico = $1
      ORDER BY u.nombre;
    `;
    const result = await query(sql, [req.params.id]);
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener las usuarias asignadas' });
  }
});
 
 
// GET /mi-tecnico----------------------------------------------------------
// Técnica asignada a la usuaria logueada — pantalla "Contactar con mi técnica"
// Si tiene más de una asignación activa devuelve la más reciente
router.get('/mi-tecnico', authenticateToken, async (req, res) => {
  try {
    const sql = `
      SELECT
        t.id_usuario  AS id_tecnico,
        t.nombre,
        t.apellidos,
        t.email,
        t.telefono,
        t.zona,
        a.fecha       AS fecha_asignacion,
        a.notas
      FROM asignacion_tecnico_usuaria a
      JOIN usuario t ON a.id_tecnico = t.id_usuario
      WHERE a.id_usuaria = $1
        AND a.estado = 'activa'
      ORDER BY a.fecha DESC
      LIMIT 1;
    `;
 
    const result = await query(sql, [req.user.id]);
 
    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'No tienes ninguna técnica asignada todavía'
      });
    }
 
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error al obtener la técnica asignada:', error);
    res.status(500).json({ error: 'Error al obtener tu técnica de apoyo' });
  }
});
 
 
module.exports = router;
