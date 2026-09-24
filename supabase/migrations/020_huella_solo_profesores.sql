-- La huella pasa a ser exclusiva del rol PROFESOR (id_rol = 2).
-- Antes estaba limitada al rol ALUMNO (id_rol = 3) desde la migración 017.
--
-- ⚠️  ESTA MIGRACIÓN LIMPIA DATOS: la constraint nueva falla si quedan filas con
-- `huella_id` asignada a un rol distinto de profesor, así que primero se anulan esas
-- huellas. Los docentes/alumnos que ya tenían huella deberán re-enrolarse.
--
-- Después de aplicarla:
--   1. Ejecutá "Vaciar sensor" en /admin/esp32 (el sensor físico todavía tiene los
--      templates viejos cargados y los slots quedarían desincronizados).
--   2. Enrolá la huella de los profesores desde /admin/usuarios.

ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS chk_huella_alumno;

-- Sin esto la constraint de abajo no se puede crear.
UPDATE usuarios
SET huella_id = NULL
WHERE huella_id IS NOT NULL
  AND id_rol IS DISTINCT FROM 2;

ALTER TABLE usuarios
  ADD CONSTRAINT chk_huella_profesor
  CHECK (id_rol = 2 OR huella_id IS NULL);

-- Los respaldos de templates de quienes ya no pueden tener huella dejan de corresponder
-- (la tabla `huellas` es el respaldo durable del sensor, migración 018).
DELETE FROM huellas
WHERE id_usuario IN (
  SELECT id_usuario FROM usuarios WHERE id_rol IS DISTINCT FROM 2
);
