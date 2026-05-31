-- migration_2026.sql
-- Ejecutar como superusuario postgres:
--   psql -U postgres -d conectarural_db -f migration_2026.sql
-- O pegar directamente en pgAdmin > Query Tool

ALTER TABLE incidencia ADD COLUMN IF NOT EXISTS respuesta TEXT;
ALTER TABLE modulo     ADD COLUMN IF NOT EXISTS url_archivo TEXT;

-- Verificacion de columnas
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name IN ('incidencia', 'modulo')
  AND column_name IN ('respuesta', 'url_archivo')
ORDER BY table_name, column_name;

-- ── Migración de prioridades (baja/media/alta → baja/normal/urgente) ────────
UPDATE incidencia SET prioridad = 'normal'  WHERE prioridad = 'media';
UPDATE incidencia SET prioridad = 'urgente' WHERE prioridad = 'alta';

-- Verificacion de prioridades
SELECT prioridad, COUNT(*) FROM incidencia GROUP BY prioridad;

-- ── Migración FCM tokens (notificaciones push) ───────────────────────────────
ALTER TABLE usuario ADD COLUMN IF NOT EXISTS fcm_token TEXT;

-- ── Auditoría de acciones admin ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS log_admin (
  id_log     SERIAL PRIMARY KEY,
  id_admin   INTEGER REFERENCES usuario(id_usuario) ON DELETE SET NULL,
  accion     VARCHAR(100) NOT NULL,
  entidad    VARCHAR(50),
  id_entidad INTEGER,
  detalle    TEXT,
  fecha      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_log_admin_fecha ON log_admin (fecha DESC);
CREATE INDEX IF NOT EXISTS idx_log_admin_admin ON log_admin (id_admin);

-- Verificacion
SELECT column_name FROM information_schema.columns
WHERE table_name = 'usuario' AND column_name = 'fcm_token';
