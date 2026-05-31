-- Migración 003: añadir updated_at a módulos para detección de cambios
-- Ejecutar: psql -U conectarural_user -d conectarural_db -f migrations/003_modulo_updated_at.sql

ALTER TABLE modulo ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- Actualizar los registros existentes con la fecha actual si el campo es NULL
UPDATE modulo SET updated_at = NOW() WHERE updated_at IS NULL;

-- Trigger para actualizar automáticamente updated_at en cada modificación
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

-- Verificar:
-- SELECT id_modulo, titulo, updated_at FROM modulo LIMIT 5;
