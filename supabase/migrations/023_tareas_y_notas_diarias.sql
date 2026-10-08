-- 023 — Tareas de proyecto (UI + permisos) y notas diarias
--
--  * `tareas_grupo`: el RPC de creación solo permitía dueño/integrante; se amplía a
--    `can_view_proyecto` (incluye profesor asignado y admin). Se agregan policies
--    SELECT/INSERT/UPDATE/DELETE para que los integrantes puedan gestionar tareas.
--  * `calificaciones_proyecto`: pasa de "una nota final por alumno" a "notas diarias"
--    (varias por alumno, con descripción y fecha). El promedio se calcula en el API.

-- ---------------------------------------------------------------------------
-- Tareas
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.create_tarea_grupo(integer, varchar, text, varchar, timestamptz);

CREATE OR REPLACE FUNCTION public.create_tarea_grupo(
  p_id_grupo integer,
  p_titulo varchar,
  p_descripcion text DEFAULT NULL,
  p_prioridad varchar DEFAULT 'Media',
  p_fecha_limite timestamptz DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row tareas_grupo%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  IF p_titulo IS NULL OR trim(p_titulo) = '' THEN
    RAISE EXCEPTION 'El título de la tarea es obligatorio';
  END IF;

  IF p_prioridad IS NULL OR p_prioridad NOT IN ('Baja', 'Media', 'Alta') THEN
    RAISE EXCEPTION 'Prioridad inválida';
  END IF;

  IF NOT public.can_view_proyecto(p_id_grupo) THEN
    RAISE EXCEPTION 'No tenés acceso a este proyecto';
  END IF;

  INSERT INTO tareas_grupo (
    id_grupo,
    titulo_tarea,
    descripcion_tarea,
    prioridad_tarea,
    estado_tarea,
    fecha_limite,
    id_creado_por
  ) VALUES (
    p_id_grupo,
    trim(p_titulo),
    NULLIF(trim(p_descripcion), ''),
    p_prioridad,
    'Pendiente',
    p_fecha_limite,
    v_uid
  )
  RETURNING * INTO v_row;

  RETURN row_to_json(v_row);
END;
$$;

REVOKE ALL ON FUNCTION public.create_tarea_grupo(integer, varchar, text, varchar, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_tarea_grupo(integer, varchar, text, varchar, timestamptz) TO authenticated;

DROP POLICY IF EXISTS tareas_grupo_select_access ON public.tareas_grupo;
CREATE POLICY tareas_grupo_select_access ON public.tareas_grupo
  FOR SELECT TO authenticated
  USING (can_view_proyecto(id_grupo));

DROP POLICY IF EXISTS tareas_grupo_insert_access ON public.tareas_grupo;
CREATE POLICY tareas_grupo_insert_access ON public.tareas_grupo
  FOR INSERT TO authenticated
  WITH CHECK (id_creado_por = auth.uid() AND can_view_proyecto(id_grupo));

DROP POLICY IF EXISTS tareas_grupo_update_access ON public.tareas_grupo;
CREATE POLICY tareas_grupo_update_access ON public.tareas_grupo
  FOR UPDATE TO authenticated
  USING (can_view_proyecto(id_grupo))
  WITH CHECK (can_view_proyecto(id_grupo));

DROP POLICY IF EXISTS tareas_grupo_delete_access ON public.tareas_grupo;
CREATE POLICY tareas_grupo_delete_access ON public.tareas_grupo
  FOR DELETE TO authenticated
  USING (can_view_proyecto(id_grupo));

-- ---------------------------------------------------------------------------
-- Notas diarias
-- ---------------------------------------------------------------------------
ALTER TABLE public.calificaciones_proyecto
  ADD COLUMN IF NOT EXISTS descripcion text,
  ADD COLUMN IF NOT EXISTS fecha date NOT NULL DEFAULT CURRENT_DATE;

-- Ya no es una única nota por alumno.
ALTER TABLE public.calificaciones_proyecto
  DROP CONSTRAINT IF EXISTS calificaciones_proyecto_id_grupo_id_usuario_key;

CREATE INDEX IF NOT EXISTS idx_calificaciones_proyecto_usuario
  ON public.calificaciones_proyecto (id_grupo, id_usuario);

NOTIFY pgrst, 'reload schema';
