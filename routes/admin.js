// routes/admin.js
// Endpoints de gestion — requieren rol admin (3) o tecnica (2) segun el caso

const express = require('express');
const router  = express.Router();
const db      = require('../db');
const authenticateToken = require('../middleware/authMiddleware');
const { isAdmin, isAdminOrTecnica } = require('../middleware/isAdmin');

// ── Aplicar autenticacion a todas las rutas de este router ────────────────
router.use(authenticateToken);


// ═══════════════════════════════════════════════════════════════════════════
// STATS — Dashboard
// GET /admin/stats
// ═══════════════════════════════════════════════════════════════════════════
router.get('/stats', isAdminOrTecnica, async (req, res) => {
  try {
    const [u, t, c, ia, ip, sa] = await Promise.all([
      db.query(`SELECT COUNT(*)::int AS total FROM usuario WHERE id_rol = 1`),
      db.query(`SELECT COUNT(*)::int AS total FROM usuario WHERE id_rol = 2`),
      db.query(`SELECT COUNT(*)::int AS total FROM curso WHERE estado = 'activo'`),
      db.query(`SELECT COUNT(*)::int AS total FROM incidencia WHERE estado = 'abierta'`),
      db.query(`SELECT COUNT(*)::int AS total FROM incidencia WHERE estado = 'en_proceso'`),
      db.query(`
        SELECT COUNT(*)::int AS total FROM usuario u
        WHERE u.id_rol = 1
          AND NOT EXISTS (
            SELECT 1 FROM asignacion_tecnico_usuaria a
            WHERE a.id_usuaria = u.id_usuario AND a.estado = 'activa'
          )
      `),
    ]);
    res.json({
      total_usuarias:           u.rows[0].total,
      total_tecnicas:           t.rows[0].total,
      total_cursos:             c.rows[0].total,
      incidencias_abiertas:     ia.rows[0].total,
      incidencias_en_proceso:   ip.rows[0].total,
      usuarias_sin_asignar:     sa.rows[0].total,
    });
  } catch (err) {
    console.error('Error en /admin/stats:', err);
    res.status(500).json({ error: 'Error al obtener estadisticas' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// USUARIAS
// GET /admin/usuarias?search=&zona=&estado=
// ═══════════════════════════════════════════════════════════════════════════
router.get('/usuarias', isAdminOrTecnica, async (req, res) => {
  try {
    const { search, zona, estado } = req.query;

    let query = `
      SELECT
        u.id_usuario,
        u.nombre,
        u.apellidos,
        u.email,
        u.telefono,
        u.zona,
        u.estado,
        u.fecha_alta,
        u.id_rol,
        r.nombre_rol
      FROM usuario u
      JOIN rol r ON u.id_rol = r.id_rol
      WHERE u.id_rol = 1
    `;
    const params = [];

    if (search) {
      params.push(`%${search}%`);
      query += ` AND (
        u.nombre    ILIKE $${params.length} OR
        u.apellidos ILIKE $${params.length} OR
        u.email     ILIKE $${params.length} OR
        u.zona      ILIKE $${params.length}
      )`;
    }

    if (zona) {
      params.push(zona);
      query += ` AND u.zona = $${params.length}`;
    }

    if (estado) {
      params.push(estado);
      query += ` AND u.estado = $${params.length}`;
    }

    query += ` ORDER BY u.fecha_alta DESC`;

    const { rows } = await db.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error('Error en /admin/usuarias:', err);
    res.status(500).json({ error: 'Error al obtener usuarias' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// ACTUALIZAR USUARIA — rol o estado
// PUT /admin/usuarias/:id   body: { id_rol?, estado? }
// ═══════════════════════════════════════════════════════════════════════════
router.put('/usuarias/:id', isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { id_rol, estado } = req.body;

    if (!id_rol && !estado) {
      return res.status(400).json({ error: 'Debes enviar id_rol o estado' });
    }

    if (id_rol !== undefined) {
      const rolInt = parseInt(id_rol);
      if (![1, 2].includes(rolInt)) {
        return res.status(400).json({ error: 'id_rol debe ser 1 (usuaria) o 2 (tecnica)' });
      }
    }

    const estadosValidos = ['activo', 'inactivo', 'bloqueado'];
    if (estado && !estadosValidos.includes(estado)) {
      return res.status(400).json({ error: `estado debe ser: ${estadosValidos.join(', ')}` });
    }

    const fields = [];
    const params = [];

    if (id_rol !== undefined) {
      params.push(parseInt(id_rol));
      fields.push(`id_rol = $${params.length}`);
    }
    if (estado) {
      params.push(estado);
      fields.push(`estado = $${params.length}`);
    }

    params.push(id);
    const { rows, rowCount } = await db.query(
      `UPDATE usuario SET ${fields.join(', ')} WHERE id_usuario = $${params.length}
       RETURNING id_usuario, nombre, apellidos, email, id_rol, estado`,
      params
    );

    if (rowCount === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json({ message: 'Usuario actualizado', usuario: rows[0] });
  } catch (err) {
    console.error('Error en PUT /admin/usuarias/:id:', err);
    res.status(500).json({ error: 'Error al actualizar el usuario' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// TECNICAS
// GET /admin/tecnicas
// ═══════════════════════════════════════════════════════════════════════════
router.get('/tecnicas', isAdminOrTecnica, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT
        u.id_usuario,
        u.nombre,
        u.apellidos,
        u.email,
        u.telefono,
        u.zona,
        u.estado,
        u.fecha_alta
      FROM usuario u
      WHERE u.id_rol = 2
      ORDER BY u.nombre ASC
    `);
    res.json(rows);
  } catch (err) {
    console.error('Error en /admin/tecnicas:', err);
    res.status(500).json({ error: 'Error al obtener tecnicas' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// ASIGNACIONES
// GET    /admin/asignaciones
// POST   /admin/asignaciones   body: { id_tecnica, id_usuario }
// DELETE /admin/asignaciones/:id
// ═══════════════════════════════════════════════════════════════════════════
router.get('/asignaciones', isAdminOrTecnica, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT
        a.id_asignacion,
        a.id_tecnico    AS id_tecnica,
        t.nombre        AS tecnica_nombre,
        t.apellidos     AS tecnica_apellidos,
        t.zona          AS tecnica_zona,
        a.id_usuaria    AS id_usuario,
        u.nombre        AS usuaria_nombre,
        u.apellidos     AS usuaria_apellidos,
        u.zona,
        u.telefono      AS usuaria_telefono,
        a.fecha,
        a.estado
      FROM asignacion_tecnico_usuaria a
      JOIN usuario t ON a.id_tecnico = t.id_usuario
      JOIN usuario u ON a.id_usuaria = u.id_usuario
      ORDER BY a.fecha DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error('Error en GET /admin/asignaciones:', err);
    res.status(500).json({ error: 'Error al obtener asignaciones' });
  }
});

router.post('/asignaciones', isAdmin, async (req, res) => {
  try {
    const { id_tecnica, id_usuario } = req.body;

    if (!id_tecnica || !id_usuario) {
      return res.status(400).json({ error: 'Se requieren id_tecnica e id_usuario' });
    }

    // Verificar que la tecnica existe y tiene rol 2
    const { rows: tecRows } = await db.query(
      `SELECT id_usuario FROM usuario WHERE id_usuario = $1 AND id_rol = 2`,
      [id_tecnica]
    );
    if (tecRows.length === 0) {
      return res.status(404).json({ error: 'Tecnica no encontrada' });
    }

    // Verificar que la usuaria existe y tiene rol 1
    const { rows: usRows } = await db.query(
      `SELECT id_usuario FROM usuario WHERE id_usuario = $1 AND id_rol = 1`,
      [id_usuario]
    );
    if (usRows.length === 0) {
      return res.status(404).json({ error: 'Usuaria no encontrada' });
    }

    // Verificar que no tiene ya asignacion activa
    const { rows: existing } = await db.query(
      `SELECT id_asignacion FROM asignacion_tecnico_usuaria
       WHERE id_usuaria = $1 AND estado = 'activa'`,
      [id_usuario]
    );
    if (existing.length > 0) {
      return res.status(409).json({
        error: 'Esta usuaria ya tiene una tecnica asignada. Elimina la asignacion anterior primero.'
      });
    }

    const { rows } = await db.query(
      `INSERT INTO asignacion_tecnico_usuaria (id_tecnico, id_usuaria, fecha, estado)
       VALUES ($1, $2, NOW(), 'activa')
       RETURNING id_asignacion`,
      [id_tecnica, id_usuario]
    );

    res.status(201).json({
      message: 'Asignacion creada correctamente',
      id_asignacion: rows[0].id_asignacion
    });
  } catch (err) {
    console.error('Error en POST /admin/asignaciones:', err);
    res.status(500).json({ error: 'Error al crear asignacion' });
  }
});

router.delete('/asignaciones/:id', isAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const { rowCount } = await db.query(
      `DELETE FROM asignacion_tecnico_usuaria WHERE id_asignacion = $1`,
      [id]
    );

    if (rowCount === 0) {
      return res.status(404).json({ error: 'Asignacion no encontrada' });
    }

    res.json({ message: 'Asignacion eliminada correctamente' });
  } catch (err) {
    console.error('Error en DELETE /admin/asignaciones/:id:', err);
    res.status(500).json({ error: 'Error al eliminar asignacion' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// INCIDENCIAS (todas — para el admin)
// GET /admin/incidencias?estado=&prioridad=
// ═══════════════════════════════════════════════════════════════════════════
router.get('/incidencias', isAdminOrTecnica, async (req, res) => {
  try {
    const { estado, prioridad } = req.query;

    let query = `
      SELECT
        i.id_incidencia,
        i.asunto,
        i.descripcion,
        i.respuesta,
        i.prioridad,
        i.estado,
        i.tipo_contacto,
        i.date_create,
        u.nombre        AS usuaria_nombre,
        u.apellidos     AS usuaria_apellidos,
        u.telefono      AS usuaria_telefono,
        u.zona          AS usuaria_zona
      FROM incidencia i
      JOIN usuario u ON i.id_usuario = u.id_usuario
      WHERE 1=1
    `;
    const params = [];

    if (estado) {
      params.push(estado);
      query += ` AND i.estado = $${params.length}`;
    }

    if (prioridad) {
      params.push(prioridad);
      query += ` AND i.prioridad = $${params.length}`;
    }

    query += ` ORDER BY
      CASE i.prioridad WHEN 'alta' THEN 1 WHEN 'media' THEN 2 ELSE 3 END,
      i.date_create DESC`;

    const { rows } = await db.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error('Error en /admin/incidencias:', err);
    res.status(500).json({ error: 'Error al obtener incidencias' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// CURSOS — crear y eliminar (editar ya existe en cursos.js)
// POST   /admin/cursos
// DELETE /admin/cursos/:id
// ═══════════════════════════════════════════════════════════════════════════
router.post('/cursos', isAdmin, async (req, res) => {
  try {
    const { titulo, descripcion, categoria, nivel, duracion, descargable } = req.body;

    if (!titulo) {
      return res.status(400).json({ error: 'El titulo es obligatorio' });
    }

    const { rows } = await db.query(
      `INSERT INTO curso (titulo, descripcion, categoria, nivel, duracion, descargable, estado)
       VALUES ($1, $2, $3, $4, $5, $6, 'activo')
       RETURNING *`,
      [titulo, descripcion || null, categoria || null,
       nivel || 'basico', duracion || null, descargable !== false]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Error en POST /admin/cursos:', err);
    res.status(500).json({ error: 'Error al crear el curso' });
  }
});

router.put('/cursos/:id', isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { titulo, descripcion, categoria, nivel, duracion, descargable } = req.body;

    const { rows, rowCount } = await db.query(
      `UPDATE curso SET
        titulo      = COALESCE($1, titulo),
        descripcion = COALESCE($2, descripcion),
        categoria   = COALESCE($3, categoria),
        nivel       = COALESCE($4, nivel),
        duracion    = COALESCE($5, duracion),
        descargable = COALESCE($6, descargable)
       WHERE id_curso = $7
       RETURNING *`,
      [titulo, descripcion, categoria, nivel, duracion, descargable, id]
    );

    if (rowCount === 0) {
      return res.status(404).json({ error: 'Curso no encontrado' });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error('Error en PUT /admin/cursos/:id:', err);
    res.status(500).json({ error: 'Error al actualizar el curso' });
  }
});

router.delete('/cursos/:id', isAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Eliminar en cascada: progreso, descargas, modulos, inscripciones
    await db.query(`DELETE FROM progreso    WHERE id_modulo IN (SELECT id_modulo FROM modulo WHERE id_curso = $1)`, [id]);
    await db.query(`DELETE FROM descarga    WHERE id_modulo IN (SELECT id_modulo FROM modulo WHERE id_curso = $1)`, [id]);
    await db.query(`DELETE FROM modulo      WHERE id_curso = $1`, [id]);
    await db.query(`DELETE FROM inscripcion WHERE id_curso = $1`, [id]);

    const { rowCount } = await db.query(
      `DELETE FROM curso WHERE id_curso = $1`, [id]
    );

    if (rowCount === 0) {
      return res.status(404).json({ error: 'Curso no encontrado' });
    }

    res.json({ message: 'Curso eliminado correctamente' });
  } catch (err) {
    console.error('Error en DELETE /admin/cursos/:id:', err);
    res.status(500).json({ error: 'Error al eliminar el curso' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// MODULOS — crear, editar, eliminar
// POST   /admin/modulos/:idCurso
// PUT    /admin/modulos/:id
// DELETE /admin/modulos/:id
// ═══════════════════════════════════════════════════════════════════════════
router.post('/modulos/:idCurso', isAdmin, async (req, res) => {
  try {
    const { idCurso } = req.params;
    const { titulo, descripcion, orden, size_mb } = req.body;

    if (!titulo) {
      return res.status(400).json({ error: 'El titulo es obligatorio' });
    }

    // Si no se especifica orden, poner al final
    let ordenFinal = orden;
    if (!ordenFinal) {
      const { rows } = await db.query(
        `SELECT COALESCE(MAX(orden), 0) + 1 AS siguiente FROM modulo WHERE id_curso = $1`,
        [idCurso]
      );
      ordenFinal = rows[0].siguiente;
    }

    const { rows } = await db.query(
      `INSERT INTO modulo (id_curso, titulo, descripcion, orden, size_mb, estado)
       VALUES ($1, $2, $3, $4, $5, 'activo')
       RETURNING *`,
      [idCurso, titulo, descripcion || null, ordenFinal, size_mb || null]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Error en POST /admin/modulos/:idCurso:', err);
    res.status(500).json({ error: 'Error al crear el modulo' });
  }
});

router.put('/modulos/:id', isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { titulo, descripcion, orden, size_mb, url_archivo } = req.body;

    const { rows, rowCount } = await db.query(
      `UPDATE modulo SET
        titulo      = COALESCE($1, titulo),
        descripcion = COALESCE($2, descripcion),
        orden       = COALESCE($3, orden),
        size_mb     = COALESCE($4, size_mb),
        url_archivo = COALESCE($5, url_archivo)
       WHERE id_modulo = $6
       RETURNING *`,
      [titulo, descripcion, orden, size_mb, url_archivo || null, id]
    );

    if (rowCount === 0) {
      return res.status(404).json({ error: 'Modulo no encontrado' });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error('Error en PUT /admin/modulos/:id:', err);
    res.status(500).json({ error: 'Error al actualizar el modulo' });
  }
});

router.delete('/modulos/:id', isAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Eliminar progreso y descargas del modulo primero
    await db.query(`DELETE FROM progreso WHERE id_modulo = $1`, [id]);
    await db.query(`DELETE FROM descarga WHERE id_modulo = $1`, [id]);

    const { rowCount } = await db.query(
      `DELETE FROM modulo WHERE id_modulo = $1`, [id]
    );

    if (rowCount === 0) {
      return res.status(404).json({ error: 'Modulo no encontrado' });
    }

    res.json({ message: 'Modulo eliminado correctamente' });
  } catch (err) {
    console.error('Error en DELETE /admin/modulos/:id:', err);
    res.status(500).json({ error: 'Error al eliminar el modulo' });
  }
});

module.exports = router;