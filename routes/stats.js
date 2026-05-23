// routes/stats.js
const express = require('express');
const router = express.Router();
const { query } = require('../db');
const authenticateToken = require('../middleware/authMiddleware');
const requireRol = require('../middleware/roleMiddleware');

// GET /stats/resumen
// Estadísticas básicas para dashboard de admin (rol 3)
// Filtros opcionales: ?zona=Toledo&desde=2026-01-01&hasta=2026-05-01
router.get('/resumen', authenticateToken, requireRol(3), async (req, res) => {
  const { zona, desde, hasta } = req.query;
  const params = [];

  try {
    // Usuarias activas (rol 1)
    let sqlUsuarios = `SELECT COUNT(*) AS total FROM usuario WHERE estado = 'activo' AND id_rol = 1`;
    if (zona) { sqlUsuarios += ` AND zona = $${params.length + 1}`; params.push(zona); }
    if (desde) { sqlUsuarios += ` AND fecha_alta >= $${params.length + 1}`; params.push(desde); }
    if (hasta) { sqlUsuarios += ` AND fecha_alta <= $${params.length + 1}`; params.push(hasta); }
    const usuarios = await query(sqlUsuarios, params);
    params.length = 0; // Reset para siguiente query

    // Cursos iniciados (inscripciones)
    let sqlCursosIniciados = `SELECT COUNT(*) AS total FROM inscripcion`;
    if (desde) { sqlCursosIniciados += ` WHERE fecha >= $${params.length + 1}`; params.push(desde); }
    if (hasta) { sqlCursosIniciados += ` AND fecha <= $${params.length + 1}`; params.push(hasta); }
    const cursosIniciados = await query(sqlCursosIniciados, params);
    params.length = 0;

    // Cursos completados (cada usuaria-curso con todos los módulos completados)
    let sqlCursosCompletados = `
      SELECT COUNT(*) AS total
      FROM (
        SELECT DISTINCT p.id_usuario, m.id_curso
        FROM progreso p
        JOIN modulo m ON p.id_modulo = m.id_modulo
        WHERE p.completado = true
      ) t
    `;
    const cursosCompletados = await query(sqlCursosCompletados);

    // Incidencias resueltas
    let sqlIncidencias = `SELECT COUNT(*) AS total FROM incidencia WHERE estado = 'cerrada'`;
    if (desde) { sqlIncidencias += ` AND date_create >= $${params.length + 1}`; params.push(desde); }
    if (hasta) { sqlIncidencias += ` AND date_create <= $${params.length + 1}`; params.push(hasta); }
    const incidenciasResueltas = await query(sqlIncidencias, params);

    res.json({
      ok: true,
      data: {
        usuariasActivas: parseInt(usuarios.rows[0].total),
        cursosIniciados: parseInt(cursosIniciados.rows[0].total),
        cursosCompletados: parseInt(cursosCompletados.rows[0].total),
        incidenciasResueltas: parseInt(incidenciasResueltas.rows[0].total)
      }
    });
  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    res.status(500).json({ ok: false, error: 'Error al obtener estadísticas' });
  }
});

module.exports = router;