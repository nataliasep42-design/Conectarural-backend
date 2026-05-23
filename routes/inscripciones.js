// routes/inscripciones.js
 
const express = require('express');
const router = express.Router();
const { query } = require('../db');
const authenticateToken = require('../middleware/authMiddleware');
 
 
// POST /cursos/:id/inscribirse -------------------------------------------
// Inscribir a la usuaria logueada en un curso
router.post('/cursos/:id/inscribirse', authenticateToken, async (req, res) => {
  if (isNaN(parseInt(req.params.id))) {
    return res.status(400).json({ error: 'El id del curso debe ser un número' });
  }
 
  try {
    const sql = `
      INSERT INTO inscripcion (id_usuario, id_curso)
      VALUES ($1, $2)
      RETURNING id_inscripcion, id_curso, fecha, estado;
    `;
    const result = await query(sql, [req.user.id, req.params.id]);
    res.status(201).json({ message: 'Inscripción realizada', inscripcion: result.rows[0] });
  } catch (error) {
    if (error.code === '23505')
      return res.status(400).json({ error: 'Ya estás inscrita en este curso' });
    // FK violation: el curso no existe
    if (error.code === '23503')
      return res.status(404).json({ error: 'El curso indicado no existe' });
    console.error(error);
    res.status(500).json({ error: 'Error al inscribirse en el curso' });
  }
});
 
 
// GET /mis-cursos ----------------------------------------------------------
// Cursos en los que está inscrita la usuaria con su estado
router.get('/mis-cursos', authenticateToken, async (req, res) => {
  try {
    const sql = `
      SELECT i.id_inscripcion, i.fecha, i.estado AS inscripcion_estado,
             c.id_curso, c.titulo, c.descripcion, c.categoria,
             c.nivel, c.duracion, c.descargable
      FROM inscripcion i
      JOIN curso c ON i.id_curso = c.id_curso
      WHERE i.id_usuario = $1
      ORDER BY i.fecha DESC;
    `;
    const result = await query(sql, [req.user.id]);
    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener tus cursos' });
  }
});
 
 
// POST /modulos/:id/progreso -----------------------------------------------
// Guardar o actualizar el porcentaje de progreso en un módulo
router.post('/modulos/:id/progreso', authenticateToken, async (req, res) => {
  const { porcentaje } = req.body;
 
  // CORRECCIÓN: antes porcentaje llegaba sin validar.
  // Si era undefined → completado = (undefined >= 100) = false
  // y el INSERT fallaba con un error de PostgreSQL poco claro.
  if (porcentaje === undefined || porcentaje === null) {
    return res.status(400).json({ error: 'porcentaje es obligatorio' });
  }
  if (typeof porcentaje !== 'number' || isNaN(porcentaje)) {
    return res.status(400).json({ error: 'porcentaje debe ser un número' });
  }
  if (porcentaje < 0 || porcentaje > 100) {
    return res.status(400).json({ error: 'porcentaje debe estar entre 0 y 100' });
  }
 
  if (isNaN(parseInt(req.params.id))) {
    return res.status(400).json({ error: 'El id del módulo debe ser un número' });
  }
 
  const completado = porcentaje >= 100;
 
  try {
    const sql = `
      INSERT INTO progreso (id_usuario, id_modulo, porcentaje, completado, last_access)
      VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
      ON CONFLICT ON CONSTRAINT uq_progreso DO UPDATE
        SET porcentaje  = $3,
            completado  = $4,
            last_access = CURRENT_TIMESTAMP
      RETURNING *;
    `;
    const result = await query(sql, [req.user.id, req.params.id, porcentaje, completado]);
    res.json({ message: 'Progreso actualizado', progreso: result.rows[0] });
  } catch (error) {
    // FK violation: el módulo no existe
    if (error.code === '23503')
      return res.status(404).json({ error: 'El módulo indicado no existe' });
    console.error(error);
    res.status(500).json({ error: 'Error al actualizar el progreso' });
  }
});
 
 
// GET /progreso/mis-cursos -----------------------------------------------------
// Progreso completo por curso para "Mi progreso" y "Continúa donde lo dejaste"
router.get('/progreso/mis-cursos', authenticateToken, async (req, res) => {
  try {
    const sql = `
      SELECT
        c.id_curso,
        c.titulo             AS curso_titulo,
        c.descargable,
        m.id_modulo,
        m.titulo             AS modulo_titulo,
        m.orden,
        m.size_mb,
        p.porcentaje,
        p.completado,
        p.last_access,
        COUNT(m.id_modulo) OVER (PARTITION BY c.id_curso)                AS total_modulos,
        COUNT(CASE WHEN p.completado = true THEN 1 END)
          OVER (PARTITION BY c.id_curso)                                  AS modulos_completados
      FROM inscripcion i
      JOIN curso   c ON i.id_curso   = c.id_curso
      JOIN modulo  m ON m.id_curso   = c.id_curso
      LEFT JOIN progreso p
             ON p.id_modulo  = m.id_modulo
            AND p.id_usuario = $1
      WHERE i.id_usuario = $1
      ORDER BY c.id_curso, m.orden;
    `;
 
    const result = await query(sql, [req.user.id]);
 
    // Agrupar por curso para devolver una estructura limpia a Flutter
    const cursosMap = {};
    for (const row of result.rows) {
      if (!cursosMap[row.id_curso]) {
        cursosMap[row.id_curso] = {
          id_curso:            row.id_curso,
          titulo:              row.curso_titulo,
          descargable:         row.descargable,
          total_modulos:       parseInt(row.total_modulos),
          modulos_completados: parseInt(row.modulos_completados),
          ultimo_acceso:       null,
          ultimo_modulo:       null,
          modulos:             []
        };
      }
 
      const modulo = {
        id_modulo:   row.id_modulo,
        titulo:      row.modulo_titulo,
        orden:       row.orden,
        size_mb:     row.size_mb,
        porcentaje:  row.porcentaje  ?? 0,
        completado:  row.completado  ?? false,
        last_access: row.last_access ?? null
      };
 
      cursosMap[row.id_curso].modulos.push(modulo);
 
      // Módulo con last_access más reciente → "Continúa donde lo dejaste"
      if (
        row.last_access &&
        (!cursosMap[row.id_curso].ultimo_acceso ||
          row.last_access > cursosMap[row.id_curso].ultimo_acceso)
      ) {
        cursosMap[row.id_curso].ultimo_acceso = row.last_access;
        cursosMap[row.id_curso].ultimo_modulo = {
          id_modulo:  row.id_modulo,
          titulo:     row.modulo_titulo,
          orden:      row.orden,
          porcentaje: row.porcentaje ?? 0
        };
      }
    }
 
    res.json(Object.values(cursosMap));
  } catch (error) {
    console.error('Error al obtener el progreso:', error);
    res.status(500).json({ error: 'Error al obtener el progreso' });
  }
});
 
 
module.exports = router;
