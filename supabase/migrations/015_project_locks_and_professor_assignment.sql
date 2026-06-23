-- Bloqueo por sección en proyectos y asignación de profesores supervisores

ALTER TABLE grupos_proyectos
  ADD COLUMN IF NOT EXISTS bloqueo_alcance boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bloqueo_documentacion boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bloqueo_equipo boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS proyecto_profesor_asignado (
  id_proyecto_profesor_asignado integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_grupo integer NOT NULL REFERENCES grupos_proyectos(id_grupo) ON DELETE CASCADE,
  id_profesor uuid NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
  UNIQUE (id_grupo, id_profesor)
);

ALTER TABLE proyecto_profesor_asignado ENABLE ROW LEVEL SECURITY;

CREATE POLICY ppa_select_self ON proyecto_profesor_asignado
  FOR SELECT TO authenticated
  USING (id_profesor = auth.uid());

CREATE OR REPLACE FUNCTION public.can_manage_proyecto(p_id_grupo integer)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM usuarios u
    JOIN roles r ON r.id_rol = u.id_rol
    WHERE u.id_usuario = auth.uid()
      AND lower(r.nombre_rol) = 'admin'
  )
  OR EXISTS (
    SELECT 1
    FROM proyecto_profesor pp
    WHERE pp.id_grupo = p_id_grupo
      AND pp.id_profesor = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM proyecto_profesor_asignado ppa
    WHERE ppa.id_grupo = p_id_grupo
      AND ppa.id_profesor = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.can_manage_proyecto(integer) TO authenticated;

CREATE POLICY grupos_proyectos_select_manager ON grupos_proyectos
  FOR SELECT TO authenticated
  USING (can_manage_proyecto(id_grupo));

CREATE POLICY grupos_proyectos_update_manager ON grupos_proyectos
  FOR UPDATE TO authenticated
  USING (can_manage_proyecto(id_grupo));

CREATE POLICY grupo_estudiante_select_manager ON grupo_estudiante
  FOR SELECT TO authenticated
  USING (can_manage_proyecto(id_grupo));

CREATE POLICY grupo_estudiante_insert_manager ON grupo_estudiante
  FOR INSERT TO authenticated
  WITH CHECK (can_manage_proyecto(id_grupo));

CREATE POLICY grupo_estudiante_delete_manager ON grupo_estudiante
  FOR DELETE TO authenticated
  USING (can_manage_proyecto(id_grupo));

CREATE OR REPLACE FUNCTION public.get_assigned_professor_emails(p_id_grupo integer)
RETURNS SETOF text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT lower(u.email::text)
  FROM proyecto_profesor_asignado ppa
  JOIN auth.users u ON u.id = ppa.id_profesor
  WHERE ppa.id_grupo = p_id_grupo
  ORDER BY 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_assigned_professor_emails(integer) TO authenticated;
