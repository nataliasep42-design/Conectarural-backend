// routes/incidencias.js
 
const express = require('express');
const router = express.Router();
const { query } = require('../db');
const authenticateToken = require('../middleware/authMiddleware');
const requireRol = require('../middleware/roleMiddleware');
 
 
// POST /incidencias --------------------------------------------
// Crear incidencia — cualquier usuaria autenticada
router.post('/', authenticateToken, async (req, res) => {
  const { asunto, descripcion, prioridad, tipo_contacto } = req.body;
  const idUsuario = req.user.id;
 
  // Validaciones
  if (!asunto || !descripcion || !tipo_contacto) {
    return res.status(400).json({ error: 'Faltan campos obligatorios: asunto, descripcion, tipo_contacto' });
  }
  if (asunto.length > 150) {
    return res.status(400).json({ error: 'El asunto no puede superar los 150 caracteres' });
  }
  const prioridadesValidas = ['baja', 'media', 'alta'];
  if (prioridad && !prioridadesValidas.includes(prioridad)) {
    return res.status(400).json({ error: `prioridad debe ser: ${prioridadesValidas.join(', ')}` });
  }
 
  try {
    const sql = `
      INSERT INTO incidencia (id_usuario, asunto, descripcion, prioridad, tipo_contacto)
      VALUES ($1, $2, $3, COALESCE($4, 'media'), $5)
      RETURNING id_incidencia, asunto, estado, prioridad, date_create;
    `;
    const result = await query(sql, [idUsuario, asunto, descripcion, prioridad, tipo_contacto]);
    res.status(201).json({ message: 'Incidencia creada correctamente', incidencia: result.rows[0] });
  } catch (error) {
    console.error('Error al crear la incidencia:', error);
    res.status(500).json({ error: 'Error al crear la incidencia' });
  }
});
 
 
// GET /incidencias/mias-------------------------------------------
// Incidencias de la usuaria logueada
router.get('/mias', authenticateToken, async (req, res) => {
  const idUsuario = req.user.id;
  try {
    const sql = `
      SELECT id_incidencia, asunto, descripcion, prioridad,
             estado, tipo_contacto, date_create
      FROM incidencia
      WHERE id_usuario = $1
      ORDER BY date_create DESC;
    `;
    const result = await query(sql, [idUsuario]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener incidencias de la usuaria:', error);
    res.status(500).json({ error: 'Error al obtener tus incidencias' });
  }
});
 
 
// GET /incidencias/asignadas -------------------------------------
// Incidencias asignadas a la técnica logueada — técnica o admin
// Filtro opcional: ?estado=abierta | en_proceso | cerrada
router.get('/asignadas', authenticateToken, requireRol(2, 3), async (req, res) => {
  const { estado } = req.query;
  const params = [req.user.id];
 
  let sql = `
    SELECT i.id_incidencia, i.asunto, i.descripcion, i.prioridad,
           i.estado, i.tipo_contacto, i.date_create,
           u.nombre AS usuaria_nombre, u.apellidos AS usuaria_apellidos,
           u.telefono AS usuaria_telefono, u.zona AS usuaria_zona
    FROM incidencia i
    JOIN usuario u ON i.id_usuario = u.id_usuario
    WHERE i.id_tecnico = $1
  `;
 
  if (estado) { params.push(estado); sql += ` AND i.estado = $${params.length}`; }
  sql += ' ORDER BY i.date_create DESC;';
 
  try {
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener las incidencias asignadas' });
  }
});
 
 
// PUT /incidencias/:id -------------------------------------------
//solo puede hacerlo la técnica asignada
router.put('/:id', authenticateToken, requireRol(2, 3), async (req, res) => {
  const { estado, descripcion } = req.body;
 
  if (!estado && !descripcion) {
    return res.status(400).json({ error: 'Debes enviar al menos un campo: estado o descripcion' });
  }
 
  // Validar valores permitidos para estado
  const estadosValidos = ['abierta', 'en_proceso', 'cerrada'];
  if (estado && !estadosValidos.includes(estado)) {
    return res.status(400).json({ error: `estado debe ser: ${estadosValidos.join(', ')}` });
  }
 
  if (isNaN(parseInt(req.params.id))) {
    return res.status(400).json({ error: 'El id de la incidencia debe ser un número' });
  }
 
  try {
    const sql = `
      UPDATE incidencia
      SET estado      = COALESCE($1, estado),
          descripcion = COALESCE($2, descripcion)
      WHERE id_incidencia = $3
        AND (id_tecnico = $4 OR $5 = 3)
      RETURNING *;
    `;
    // $4 = id de la técnica logueada
    // $5 = rol del usuario logueado (si es 3 = admin, puede editar cualquiera)
    const result = await query(sql, [estado, descripcion, req.params.id, req.user.id, req.user.rol]);
 
    if (result.rows.length === 0)
      return res.status(404).json({
        error: 'Incidencia no encontrada o no tienes permisos para modificarla'
      });
 
    res.json({ message: 'Incidencia actualizada', incidencia: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar la incidencia' });
  }
});
 
 
module.exports = router;
