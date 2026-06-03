-- Classify (jgrtmokyqdvdxsldmkou)
ALTER TABLE grupos_proyectos
  ADD COLUMN IF NOT EXISTS escuela varchar(20),
  ADD COLUMN IF NOT EXISTS estado_proyecto varchar(20) DEFAULT 'Abierto';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'grupos_proyectos_estado_proyecto_check'
  ) THEN
    ALTER TABLE grupos_proyectos
      ADD CONSTRAINT grupos_proyectos_estado_proyecto_check
      CHECK (estado_proyecto IN ('Abierto', 'Cerrado'));
  END IF;
END $$;

INSERT INTO roles (nombre_rol)
VALUES ('admin'), ('profesor'), ('alumno')
ON CONFLICT (nombre_rol) DO NOTHING;
