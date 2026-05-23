// routes/cursos.js
 
const express = require('express');
const router = express.Router();
const { query } = require('../db');
const authenticateToken = require('../middleware/authMiddleware');
const requireRol = require('../middleware/roleMiddleware');
 
 
// GET /cursos ------------------------------------------------------------------------
// Listado de cursos activos con filtros opcionales y paginación
// Ruta pública — no requiere token
router.get('/cursos', async (req, res) => {
  const { categoria, nivel, page = 1, limit = 10 } = req.query;
 
  // Convertir a entero para evitar inyección y errores de tipo
  const pageInt  = Math.max(1, parseInt(page)  || 1);
  const limitInt = Math.min(50, Math.max(1, parseInt(limit) || 10)); // máximo 50 por página
  const offset   = (pageInt - 1) * limitInt;
 
  const params = [];
 
  // CORRECCIÓN CRÍTICA: antes había un segundo `const sql` dentro del try
  // que redeclaraba la variable y descartaba todos los filtros y la paginación.
  // Ahora hay una sola variable sql que se construye dinámicamente.
  let sql = `
    SELECT id_curso, titulo, descripcion, categoria, nivel, duracion, descargable
    FROM curso
    WHERE estado = 'activo'
  `;
 
  if (categoria) { params.push(categoria); sql += ` AND categoria = $${params.length}`; }
  if (nivel)     { params.push(nivel);     sql += ` AND nivel = $${params.length}`; }
 
  // CORRECCIÓN: se usan backticks (template literal) para que los índices
  // se calculen bien, y se añade espacio antes de ORDER BY
  sql += ` ORDER BY titulo LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(limitInt, offset);
 
  try {
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener cursos:', error);
    res.status(500).json({ error: 'Error al obtener el listado de cursos' });
  }
});
 
 
// GET /cursos/:id -------------------------------------------------------------------
// Detalle de un curso con todos sus módulos
// Ruta pública — no requiere token
router.get('/cursos/:id', async (req, res) => {
  const { id } = req.params;
 
  // Validar que el id sea un número
  if (isNaN(parseInt(id))) {
    return res.status(400).json({ error: 'El id del curso debe ser un número' });
  }
 
  try {
    const sql = `
      SELECT
        c.id_curso, c.titulo AS curso_titulo, c.descripcion AS curso_desc,
        c.duracion, c.descargable,
        m.id_modulo, m.titulo AS modulo_titulo, m.orden, m.size_mb
      FROM curso c
      LEFT JOIN modulo m ON c.id_curso = m.id_curso
      WHERE c.id_curso = $1
      ORDER BY m.orden;
    `;
 
    const result = await query(sql, [id]);
 
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Curso no encontrado' });
    }
 
    const curso = {
      id_curso:    result.rows[0].id_curso,
      titulo:      result.rows[0].curso_titulo,
      descripcion: result.rows[0].curso_desc,
      duracion:    result.rows[0].duracion,
      descargable: result.rows[0].descargable,
      modulos: result.rows
        .filter(row => row.id_modulo !== null)
        .map(row => ({
          id_modulo: row.id_modulo,
          titulo:    row.modulo_titulo,
          orden:     row.orden,
          size_mb:   row.size_mb
        }))
    };
 
    res.json(curso);
  } catch (error) {
    console.error('Error al obtener detalle del curso:', error);
    res.status(500).json({ error: 'Error al obtener los detalles' });
  }
});
 
 
// GET /cursos/:id/modulos -----------------------------------------------------------
// Listar módulos de un curso (útil para backoffice)
// Ruta pública — no requiere token
router.get('/cursos/:id/modulos', async (req, res) => {
  if (isNaN(parseInt(req.params.id))) {
    return res.status(400).json({ error: 'El id del curso debe ser un número' });
  }
  try {
    const sql = `
      SELECT id_modulo, titulo, descripcion, orden, size_mb, estado
      FROM modulo
      WHERE id_curso = $1 AND estado = 'activo'
      ORDER BY orden;
    `;
    const result = await query(sql, [req.params.id]);
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener los módulos' });
  }
});
 
 
// POST /cursos -----------------------------------------------------------------------
// Crear curso — solo admin (rol 3)
router.post('/cursos', authenticateToken, requireRol(3), async (req, res) => {
  const { titulo, descripcion, categoria, nivel, duracion, descargable } = req.body;
 
  // Validaciones
  if (!titulo || !categoria || !nivel) {
    return res.status(400).json({ error: 'Faltan campos obligatorios: titulo, categoria, nivel' });
  }
  if (duracion !== undefined && (isNaN(duracion) || duracion <= 0)) {
    return res.status(400).json({ error: 'duracion debe ser un número mayor que 0' });
  }
 
  try {
    const sql = `
      INSERT INTO curso (titulo, descripcion, categoria, nivel, duracion, descargable)
      VALUES ($1, $2, $3, $4, $5, COALESCE($6, true))
      RETURNING *;
    `;
    const result = await query(sql, [titulo, descripcion, categoria, nivel, duracion, descargable]);
    res.status(201).json({ message: 'Curso creado', curso: result.rows[0] });
  } catch (error) {
    console.error('Error al crear el curso:', error);
    res.status(500).json({ error: 'Error al crear el curso' });
  }
});
 
 
// PUT /cursos/:id ------------------------------------------------------------------
// Editar curso — solo admin (rol 3)
router.put('/cursos/:id', authenticateToken, requireRol(3), async (req, res) => {
  const { titulo, descripcion, categoria, nivel, duracion, descargable, estado } = req.body;
 
  // Validar que se envía al menos un campo
  if (!titulo && !descripcion && !categoria && !nivel &&
      duracion === undefined && descargable === undefined && !estado) {
    return res.status(400).json({ error: 'Debes enviar al menos un campo para actualizar' });
  }
 
  const estadosValidos = ['activo', 'inactivo'];
  if (estado && !estadosValidos.includes(estado)) {
    return res.status(400).json({ error: `estado debe ser: ${estadosValidos.join(', ')}` });
  }
 
  try {
    const sql = `
      UPDATE curso
      SET titulo      = COALESCE($1, titulo),
          descripcion = COALESCE($2, descripcion),
          categoria   = COALESCE($3, categoria),
          nivel       = COALESCE($4, nivel),
          duracion    = COALESCE($5, duracion),
          descargable = COALESCE($6, descargable),
          estado      = COALESCE($7, estado)
      WHERE id_curso = $8
      RETURNING *;
    `;
    const result = await query(sql, [titulo, descripcion, categoria, nivel, duracion, descargable, estado, req.params.id]);
    if (result.rows.length === 0)
      return res.status(404).json({ error: 'Curso no encontrado' });
    res.json({ message: 'Curso actualizado', curso: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar el curso' });
  }
});
 
 
// POST /cursos/:id/modulos ---------------------------------------------------------
// Crear módulo dentro de un curso — solo admin (rol 3)
router.post('/cursos/:id/modulos', authenticateToken, requireRol(3), async (req, res) => {
  const { titulo, descripcion, orden, size_mb } = req.body;
 
  // Validaciones
  if (!titulo) {
    return res.status(400).json({ error: 'El campo titulo es obligatorio' });
  }
  if (orden === undefined || isNaN(parseInt(orden)) || orden < 1) {
    return res.status(400).json({ error: 'orden es obligatorio y debe ser un número mayor que 0' });
  }
 
  try {
    const sql = `
      INSERT INTO modulo (id_curso, titulo, descripcion, orden, size_mb)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;
    const result = await query(sql, [req.params.id, titulo, descripcion, orden, size_mb]);
    res.status(201).json({ message: 'Módulo creado', modulo: result.rows[0] });
  } catch (error) {
    // Error de FK: el curso no existe
    if (error.code === '23503') {
      return res.status(404).json({ error: 'El curso indicado no existe' });
    }
    console.error(error);
    res.status(500).json({ error: 'Error al crear el módulo' });
  }
});
 
 
// PUT /modulos/:id -----------------------------------------------------------------
// Editar módulo — solo admin (rol 3)
router.put('/modulos/:id', authenticateToken, requireRol(3), async (req, res) => {
  const { titulo, descripcion, orden, size_mb, estado } = req.body;
 
  if (!titulo && !descripcion && orden === undefined &&
      size_mb === undefined && !estado) {
    return res.status(400).json({ error: 'Debes enviar al menos un campo para actualizar' });
  }
 
  const estadosValidos = ['activo', 'inactivo'];
  if (estado && !estadosValidos.includes(estado)) {
    return res.status(400).json({ error: `estado debe ser: ${estadosValidos.join(', ')}` });
  }
 
  try {
    const sql = `
      UPDATE modulo
      SET titulo      = COALESCE($1, titulo),
          descripcion = COALESCE($2, descripcion),
          orden       = COALESCE($3, orden),
          size_mb     = COALESCE($4, size_mb),
          estado      = COALESCE($5, estado)
      WHERE id_modulo = $6
      RETURNING *;
    `;
    const result = await query(sql, [titulo, descripcion, orden, size_mb, estado, req.params.id]);
    if (result.rows.length === 0)
      return res.status(404).json({ error: 'Módulo no encontrado' });
    res.json({ message: 'Módulo actualizado', modulo: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar el módulo' });
  }
});
 
 
module.exports = router;