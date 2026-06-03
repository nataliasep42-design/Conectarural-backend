-- schema.sql — Esquema completo de ConectaRural
-- Ejecutar en una base de datos vacía (nueva o recién creada en Render):
--   psql "<DATABASE_URL>" -f schema.sql
--
-- Este archivo crea todas las tablas, índices, datos iniciales y triggers.
-- Si ya tienes datos y solo necesitas añadir columnas, usa migration_2026.sql.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. TABLAS BASE
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rol (
  id_rol     SERIAL PRIMARY KEY,
  nombre_rol VARCHAR(50) UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS usuario (
  id_usuario  SERIAL PRIMARY KEY,
  nombre      VARCHAR(100) NOT NULL,
  apellidos   VARCHAR(100),
  email       VARCHAR(150) UNIQUE NOT NULL,
  telefono    VARCHAR(20),
  pass_hash   TEXT NOT NULL,
  zona        VARCHAR(100),
  id_rol      INTEGER NOT NULL REFERENCES rol(id_rol),
  estado      VARCHAR(20) NOT NULL DEFAULT 'activo'
                CHECK (estado IN ('activo', 'inactivo', 'bloqueado')),
  fecha_alta  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fcm_token   TEXT
);

CREATE TABLE IF NOT EXISTS curso (
  id_curso    SERIAL PRIMARY KEY,
  titulo      VARCHAR(200) NOT NULL,
  descripcion TEXT,
  categoria   VARCHAR(100),
  nivel       VARCHAR(50),
  duracion    INTEGER,
  descargable BOOLEAN NOT NULL DEFAULT TRUE,
  estado      VARCHAR(20) NOT NULL DEFAULT 'activo'
                CHECK (estado IN ('activo', 'inactivo'))
);

CREATE TABLE IF NOT EXISTS modulo (
  id_modulo   SERIAL PRIMARY KEY,
  id_curso    INTEGER NOT NULL REFERENCES curso(id_curso) ON DELETE CASCADE,
  titulo      VARCHAR(200) NOT NULL,
  descripcion TEXT,
  orden       INTEGER,
  size_mb     NUMERIC,
  url_archivo TEXT,
  estado      VARCHAR(20) NOT NULL DEFAULT 'activo'
                CHECK (estado IN ('activo', 'inactivo')),
  updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inscripcion (
  id_inscripcion SERIAL PRIMARY KEY,
  id_usuario     INTEGER NOT NULL REFERENCES usuario(id_usuario) ON DELETE CASCADE,
  id_curso       INTEGER NOT NULL REFERENCES curso(id_curso) ON DELETE CASCADE,
  fecha          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  estado         VARCHAR(20) NOT NULL DEFAULT 'activo',
  CONSTRAINT uq_inscripcion UNIQUE (id_usuario, id_curso)
);

CREATE TABLE IF NOT EXISTS progreso (
  id_usuario  INTEGER NOT NULL REFERENCES usuario(id_usuario) ON DELETE CASCADE,
  id_modulo   INTEGER NOT NULL REFERENCES modulo(id_modulo) ON DELETE CASCADE,
  porcentaje  NUMERIC NOT NULL DEFAULT 0,
  completado  BOOLEAN NOT NULL DEFAULT FALSE,
  last_access TIMESTAMP,
  CONSTRAINT uq_progreso UNIQUE (id_usuario, id_modulo)
);

CREATE TABLE IF NOT EXISTS descarga (
  id_descarga  SERIAL PRIMARY KEY,
  id_usuario   INTEGER NOT NULL REFERENCES usuario(id_usuario) ON DELETE CASCADE,
  id_modulo    INTEGER NOT NULL REFERENCES modulo(id_modulo) ON DELETE CASCADE,
  fecha_desc   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  estado_desc  VARCHAR(20) NOT NULL DEFAULT 'completa',
  size_desc    VARCHAR(50),
  CONSTRAINT uq_descarga UNIQUE (id_usuario, id_modulo)
);

CREATE TABLE IF NOT EXISTS incidencia (
  id_incidencia SERIAL PRIMARY KEY,
  id_usuario    INTEGER NOT NULL REFERENCES usuario(id_usuario) ON DELETE CASCADE,
  asunto        VARCHAR(150) NOT NULL,
  descripcion   TEXT,
  respuesta     TEXT,
  prioridad     VARCHAR(20) NOT NULL DEFAULT 'normal'
                  CHECK (prioridad IN ('baja', 'normal', 'urgente')),
  estado        VARCHAR(20) NOT NULL DEFAULT 'abierta'
                  CHECK (estado IN ('abierta', 'en_proceso', 'cerrada')),
  tipo_contacto VARCHAR(50) NOT NULL,
  date_create   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  id_tecnico    INTEGER REFERENCES usuario(id_usuario) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS asignacion_tecnico_usuaria (
  id_asignacion SERIAL PRIMARY KEY,
  id_tecnico    INTEGER NOT NULL REFERENCES usuario(id_usuario) ON DELETE CASCADE,
  id_usuaria    INTEGER NOT NULL REFERENCES usuario(id_usuario) ON DELETE CASCADE,
  fecha         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  estado        VARCHAR(20) NOT NULL DEFAULT 'activa',
  notas         TEXT,
  CONSTRAINT uq_asignacion UNIQUE (id_tecnico, id_usuaria)
);

CREATE TABLE IF NOT EXISTS log_admin (
  id_log     SERIAL PRIMARY KEY,
  id_admin   INTEGER REFERENCES usuario(id_usuario) ON DELETE SET NULL,
  accion     VARCHAR(100) NOT NULL,
  entidad    VARCHAR(50),
  id_entidad INTEGER,
  detalle    TEXT,
  fecha      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. ÍNDICES
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_usuario_email      ON usuario (email);
CREATE INDEX IF NOT EXISTS idx_usuario_rol        ON usuario (id_rol);
CREATE INDEX IF NOT EXISTS idx_modulo_curso       ON modulo (id_curso);
CREATE INDEX IF NOT EXISTS idx_inscripcion_user   ON inscripcion (id_usuario);
CREATE INDEX IF NOT EXISTS idx_progreso_user      ON progreso (id_usuario);
CREATE INDEX IF NOT EXISTS idx_descarga_user      ON descarga (id_usuario);
CREATE INDEX IF NOT EXISTS idx_incidencia_user    ON incidencia (id_usuario);
CREATE INDEX IF NOT EXISTS idx_incidencia_tecnico ON incidencia (id_tecnico);
CREATE INDEX IF NOT EXISTS idx_asignacion_tecnico ON asignacion_tecnico_usuaria (id_tecnico);
CREATE INDEX IF NOT EXISTS idx_asignacion_usuaria ON asignacion_tecnico_usuaria (id_usuaria);
CREATE INDEX IF NOT EXISTS idx_log_admin_fecha    ON log_admin (fecha DESC);
CREATE INDEX IF NOT EXISTS idx_log_admin_admin    ON log_admin (id_admin);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. TRIGGER: actualizar modulo.updated_at en cada UPDATE
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_update_modulo_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_modulo_updated_at ON modulo;
CREATE TRIGGER trg_modulo_updated_at
  BEFORE UPDATE ON modulo
  FOR EACH ROW EXECUTE FUNCTION fn_update_modulo_timestamp();

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. DATOS INICIALES
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO rol (nombre_rol) VALUES
  ('usuaria'),
  ('tecnico'),
  ('admin')
ON CONFLICT (nombre_rol) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────────
-- Verificación
-- ─────────────────────────────────────────────────────────────────────────────
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
