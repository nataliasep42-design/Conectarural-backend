-- migration_2026.sql
-- Ejecutar como superusuario postgres:
--   psql -U postgres -d conectarural_db -f migration_2026.sql
-- O pegar directamente en pgAdmin > Query Tool

ALTER TABLE incidencia ADD COLUMN IF NOT EXISTS respuesta TEXT;
ALTER TABLE modulo     ADD COLUMN IF NOT EXISTS url_archivo TEXT;

-- Verificacion
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name IN ('incidencia', 'modulo')
  AND column_name IN ('respuesta', 'url_archivo')
ORDER BY table_name, column_name;
