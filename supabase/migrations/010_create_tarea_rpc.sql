-- Crea una tarea en un proyecto donde el usuario es miembro o dueño
-- Sigue el patrón SECURITY DEFINER de create_grupo_proyecto

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
  v_is_member boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  -- Verificar que el usuario es dueño o integrante del proyecto
  SELECT EXISTS (
    SELECT 1 FROM proyecto_profesor WHERE id_profesor = v_uid AND id_grupo = p_id_grupo
    UNION
    SELECT 1 FROM grupo_estudiante WHERE id_usuario = v_uid AND id_grupo = p_id_grupo
  ) INTO v_is_member;

  IF NOT v_is_member THEN
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

GRANT EXECUTE ON FUNCTION public.create_tarea_grupo(integer, varchar, text, varchar, timestamptz) TO authenticated;
