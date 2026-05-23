// routes/descargas.js
 
const express = require('express');
const router = express.Router();
const { query } = require('../db');
const authenticateToken = require('../middleware/authMiddleware');
 
 
// POST /modulos/:id/descargas -------------------------------------------------
// Registrar que la usuaria descarga un módulo para uso offline
router.post('/modulos/:id/descargas', authenticateToken, async (req, res) => {
  const { size_desc } = req.body;
 
  if (isNaN(parseInt(req.params.id))) {
    return res.status(400).json({ error: 'El id del módulo debe ser un número' });
  }
  if (!size_desc) {
    return res.status(400).json({ error: 'size_desc es obligatorio' });
  }
 
  try {
    const sql = `
      INSERT INTO descarga (id_usuario, id_modulo, size_desc)
      VALUES ($1, $2, $3)
      ON CONFLICT ON CONSTRAINT uq_descarga DO UPDATE
        SET fecha_desc  = CURRENT_TIMESTAMP,
            estado_desc = 'completa'
      RETURNING *;
    `;
    const result = await query(sql, [req.user.id, req.params.id, size_desc]);
    res.status(201).json({ message: 'Descarga registrada', descarga: result.rows[0] });
  } catch (error) {
    if (error.code === '23503')
      return res.status(404).json({ error: 'El módulo indicado no existe' });
    console.error(error);
    res.status(500).json({ error: 'Error al registrar la descarga' });
  }
});
 
 
// GET /mis-descargas ---------------------------------------------------------
// Módulos descargados por la usuaria con su progreso actual
// Alimenta la pantalla "Descargas" del wireframe
router.get('/mis-descargas', authenticateToken, async (req, res) => {
  try {
    const sql = `
      SELECT
        d.id_descarga,
        d.fecha_desc,
        d.estado_desc,
        d.size_desc,
        m.id_modulo,
        m.titulo       AS modulo_titulo,
        m.orden,
        m.size_mb,
        c.id_curso,
        c.titulo       AS curso_titulo,
        p.porcentaje,
        p.completado,
        p.last_access
      FROM descarga d
      JOIN modulo   m ON d.id_modulo  = m.id_modulo
      JOIN curso    c ON m.id_curso   = c.id_curso
      LEFT JOIN progreso p
             ON p.id_modulo  = m.id_modulo
            AND p.id_usuario = $1
      WHERE d.id_usuario = $1
      ORDER BY d.fecha_desc DESC;
    `;
    const result = await query(sql, [req.user.id]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener las descargas:', error);
    res.status(500).json({ error: 'Error al obtener tus descargas' });
  }
});
 
 
// DELETE /modulos/:id_modulo/descargas -------------------------------------------
// Eliminar una descarga (liberar espacio offline)
// CORRECCIÓN: antes era router.delete('/:id_modulo', ...) que en el
// contexto de app.use('/', ...) generaba la ruta genérica DELETE /:id_modulo,
// que colisionaba con cualquier otra ruta dinámica del mismo prefijo.
// La ruta correcta es /modulos/:id_modulo/descargas para ser coherente
// con el POST /modulos/:id/descargas.
router.delete('/modulos/:id_modulo/descargas', authenticateToken, async (req, res) => {
  if (isNaN(parseInt(req.params.id_modulo))) {
    return res.status(400).json({ error: 'El id del módulo debe ser un número' });
  }
 
  try {
    const sql = `
      DELETE FROM descarga
      WHERE id_modulo = $1 AND id_usuario = $2
      RETURNING *;
    `;
    const result = await query(sql, [req.params.id_modulo, req.user.id]);
 
    if (result.rows.length === 0)
      return res.status(404).json({ error: 'Descarga no encontrada' });
 
    res.json({ message: 'Descarga eliminada correctamente' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al eliminar la descarga' });
  }
});
 
 
module.exports = router;
