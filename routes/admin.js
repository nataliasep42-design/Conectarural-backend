// routes/admin.js
// Endpoints de gestion — requieren rol admin (3) o tecnica (2) segun el caso

const express = require('express');
const router  = express.Router();
const db      = require('../db');
const path    = require('path');
const authenticateToken = require('../middleware/authMiddleware');
const { isAdmin, isAdminOrTecnica } = require('../middleware/isAdmin');
const { logAdmin } = require('../utils/logAdmin');
const { uploadBuffer, deleteByUrl } = require('../services/storageService');

// Multer para subida de vídeos (carga diferida para no romper si no está instalado)
// Usa memoryStorage: el archivo llega como buffer en RAM y se sube directamente a
// Firebase Storage (routes/admin.js no debe escribir en el disco local de Render,
// que es efímero y se borra en cada reinicio/redespliegue).
let upload;
try {
  const multer = require('multer');
  const ALLOWED_VIDEO_EXTS = ['.mp4', '.mov', '.avi', '.webm', '.mkv', '.m4v'];

  const videoFilter = (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_VIDEO_EXTS.includes(ext)) {
      return cb(new Error(`Formato no permitido. Usa: ${ALLOWED_VIDEO_EXTS.join(', ')}`));
    }
    cb(null, true);
  };

  upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 500 * 1024 * 1024 },
    fileFilter: videoFilter,
  });
} catch (_) {
  upload = null;
}

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
      if (![1, 2, 3].includes(rolInt)) {
        return res.status(400).json({ error: 'id_rol debe ser 1 (usuaria), 2 (tecnica) o 3 (admin)' });
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

    // Auditoría
    const detalle = [
      id_rol !== undefined ? `rol→${id_rol}` : null,
      estado ? `estado→${estado}` : null
    ].filter(Boolean).join(', ');
    await logAdmin(req.user.id, 'actualizar_usuario', 'usuario', parseInt(id), detalle);

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

    await logAdmin(req.user.id, 'crear_asignacion', 'asignacion', rows[0].id_asignacion,
      `tecnica:${id_tecnica}→usuaria:${id_usuario}`);

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

    await logAdmin(req.user.id, 'eliminar_asignacion', 'asignacion', parseInt(id), null);
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
    const { estado, prioridad, id_usuaria } = req.query;

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

    if (id_usuaria) {
      params.push(id_usuaria);
      query += ` AND i.id_usuario = $${params.length}`;
    }

    query += ` ORDER BY
      CASE i.prioridad WHEN 'urgente' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,
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


// ═══════════════════════════════════════════════════════════════════════════
// SUBIDA DE VÍDEO — POST /admin/modulos/:id/video
// ═══════════════════════════════════════════════════════════════════════════
router.post('/modulos/:id/video', isAdmin, (req, res, next) => {
  if (!upload) {
    return res.status(501).json({ error: 'Subida de archivos no disponible. Ejecuta: npm install multer' });
  }
  upload.single('video')(req, res, next);
}, async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se ha enviado ningún archivo de vídeo' });
  }
  try {
    const ext = path.extname(req.file.originalname).toLowerCase() || '.mp4';
    const destPath = `videos/modulo_${req.params.id}_${Date.now()}${ext}`;
    const url = await uploadBuffer(req.file.buffer, destPath, req.file.mimetype);
    const sizeMb = parseFloat((req.file.size / (1024 * 1024)).toFixed(2));
    const { rows, rowCount } = await db.query(
      `UPDATE modulo SET url_archivo = $1, size_mb = $2 WHERE id_modulo = $3 RETURNING *`,
      [url, sizeMb, req.params.id]
    );
    if (rowCount === 0) {
      await deleteByUrl(url);
      return res.status(404).json({ error: 'Módulo no encontrado' });
    }
    res.json({ message: 'Vídeo subido correctamente', url, modulo: rows[0] });
  } catch (err) {
    console.error('Error en POST /admin/modulos/:id/video:', err);
    res.status(500).json({ error: 'Error al subir el vídeo' });
  }
});


// ═══════════════════════════════════════════════════════════════════════════
// ESTADÍSTICAS AVANZADAS — GET /admin/stats/detalles
// ═══════════════════════════════════════════════════════════════════════════
router.get('/stats/detalles', isAdminOrTecnica, async (req, res) => {
  try {
    const [cursosPopulares, tasaCompletado, usuariasActivas30d] = await Promise.all([
      // Top 5 cursos por número de inscripciones
      db.query(`
        SELECT c.id_curso, c.titulo,
               COUNT(i.id_inscripcion)::int AS total_inscritas,
               COUNT(CASE WHEN p_agg.completado THEN 1 END)::int AS completaron
        FROM curso c
        LEFT JOIN inscripcion i ON i.id_curso = c.id_curso
        LEFT JOIN LATERAL (
          SELECT bool_and(p.completado) AS completado
          FROM progreso p
          JOIN modulo m ON m.id_modulo = p.id_modulo
          WHERE p.id_usuario = i.id_usuario AND m.id_curso = c.id_curso
        ) p_agg ON true
        WHERE c.estado = 'activo'
        GROUP BY c.id_curso, c.titulo
        ORDER BY total_inscritas DESC
        LIMIT 5
      `),
      // Tasa global de completado (módulos completados / módulos totales con progreso)
      db.query(`
        SELECT
          COUNT(*)::int AS total_progreso,
          COUNT(CASE WHEN completado THEN 1 END)::int AS completados,
          ROUND(
            100.0 * COUNT(CASE WHEN completado THEN 1 END) / NULLIF(COUNT(*), 0), 1
          ) AS tasa_completado
        FROM progreso
      `),
      // Usuarias activas en los últimos 30 días (con acceso a contenido)
      db.query(`
        SELECT COUNT(DISTINCT p.id_usuario)::int AS usuarias_activas_30d
        FROM progreso p
        WHERE p.last_access >= NOW() - INTERVAL '30 days'
      `),
    ]);

    res.json({
      cursos_populares: cursosPopulares.rows,
      tasa_completado: tasaCompletado.rows[0],
      usuarias_activas_30d: usuariasActivas30d.rows[0].usuarias_activas_30d,
    });
  } catch (err) {
    console.error('Error en /admin/stats/detalles:', err);
    res.status(500).json({ error: 'Error al obtener estadísticas avanzadas' });
  }
});


// ═══════════════════════════════════════════════════════════════════════════
// LOG DE AUDITORÍA ADMIN
// GET /admin/logs?limit=50
// ═══════════════════════════════════════════════════════════════════════════
router.get('/logs', isAdmin, async (req, res) => {
  try {
    const limit  = Math.min(parseInt(req.query.limit)  || 50, 100);
    const offset = Math.max(parseInt(req.query.offset) || 0,   0);
    const { accion, desde, hasta } = req.query;

    const params = [];
    let where = '';

    if (accion) {
      params.push(accion);
      where += ` AND l.accion = $${params.length}`;
    }
    if (desde) {
      params.push(desde);
      where += ` AND l.fecha >= $${params.length}`;
    }
    if (hasta) {
      params.push(hasta);
      where += ` AND l.fecha <= $${params.length}`;
    }

    params.push(limit + 1, offset); // +1 para detectar si hay más páginas
    const { rows } = await db.query(`
      SELECT l.id_log, l.accion, l.entidad, l.id_entidad, l.detalle, l.fecha,
             u.nombre AS admin_nombre, u.apellidos AS admin_apellidos,
             eu.email AS entidad_email
      FROM log_admin l
      LEFT JOIN usuario u  ON l.id_admin  = u.id_usuario
      LEFT JOIN usuario eu ON l.entidad = 'usuario' AND l.id_entidad = eu.id_usuario
      WHERE 1=1 ${where}
      ORDER BY l.fecha DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `, params);

    const hasMore = rows.length > limit;
    res.json({ logs: rows.slice(0, limit), hasMore, offset, limit });
  } catch (err) {
    console.error('Error en GET /admin/logs:', err);
    res.status(500).json({ error: 'Error al obtener el log de auditoría' });
  }
});


// ═══════════════════════════════════════════════════════════════════════════
// SUBIDA DE DOCUMENTO (PDF, imágenes, presentaciones) — POST /admin/modulos/:id/documento
// ═══════════════════════════════════════════════════════════════════════════
router.post('/modulos/:id/documento', isAdmin, (req, res, next) => {
  if (!upload) {
    return res.status(501).json({ error: 'Subida de archivos no disponible. Instala multer.' });
  }

  const docFilter = (req, file, cb) => {
    const ALLOWED_DOC_EXTS = ['.pdf', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.pptx', '.ppt', '.doc', '.docx'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_DOC_EXTS.includes(ext)) {
      return cb(new Error(`Formato no permitido. Usa: ${ALLOWED_DOC_EXTS.join(', ')}`));
    }
    cb(null, true);
  };

  const multer = require('multer');
  multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 }, fileFilter: docFilter })
    .single('documento')(req, res, next);
}, async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No se ha enviado ningún archivo' });
  }
  try {
    const ext = path.extname(req.file.originalname).toLowerCase();
    const destPath = `documentos/modulo_${req.params.id}_${Date.now()}${ext}`;
    const url = await uploadBuffer(req.file.buffer, destPath, req.file.mimetype);
    const sizeMb = parseFloat((req.file.size / (1024 * 1024)).toFixed(2));
    const { rows, rowCount } = await db.query(
      `UPDATE modulo SET url_archivo = $1, size_mb = $2 WHERE id_modulo = $3 RETURNING *`,
      [url, sizeMb, req.params.id]
    );
    if (rowCount === 0) {
      await deleteByUrl(url);
      return res.status(404).json({ error: 'Módulo no encontrado' });
    }
    res.json({ message: 'Documento subido correctamente', url, modulo: rows[0] });
  } catch (err) {
    console.error('Error en POST /admin/modulos/:id/documento:', err);
    res.status(500).json({ error: 'Error al subir el documento' });
  }
});


// ═══════════════════════════════════════════════════════════════════════════
// BLOQUEAR / DESBLOQUEAR TÉCNICA
// PUT /admin/tecnicas/:id/estado   body: { estado: 'activo' | 'bloqueado' | 'inactivo' }
// Reutiliza la misma lógica que PUT /admin/usuarias/:id
// ═══════════════════════════════════════════════════════════════════════════
router.put('/tecnicas/:id/estado', isAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;

    const estadosValidos = ['activo', 'inactivo', 'bloqueado'];
    if (!estado || !estadosValidos.includes(estado)) {
      return res.status(400).json({ error: `estado debe ser: ${estadosValidos.join(', ')}` });
    }

    const { rows, rowCount } = await db.query(
      `UPDATE usuario SET estado = $1 WHERE id_usuario = $2 AND id_rol = 2
       RETURNING id_usuario, nombre, apellidos, email, estado`,
      [estado, id]
    );

    if (rowCount === 0) {
      return res.status(404).json({ error: 'Técnica no encontrada' });
    }

    await logAdmin(req.user.id, 'cambiar_estado_tecnica', 'usuario', parseInt(id), `estado→${estado}`);
    res.json({ message: 'Estado de técnica actualizado', tecnica: rows[0] });
  } catch (err) {
    console.error('Error en PUT /admin/tecnicas/:id/estado:', err);
    res.status(500).json({ error: 'Error al actualizar el estado' });
  }
});


module.exports = router;