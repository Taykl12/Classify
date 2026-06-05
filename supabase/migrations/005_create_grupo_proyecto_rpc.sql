-- Crea grupo + vínculo proyecto_profesor en una transacción (evita fallo RLS en INSERT...RETURNING)
CREATE OR REPLACE FUNCTION public.create_grupo_proyecto(
  p_nombre varchar,
  p_descripcion text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row grupos_proyectos%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  INSERT INTO grupos_proyectos (nombre_proyecto, descripcion, estado_proyecto, es_favorito)
  VALUES (trim(p_nombre), NULLIF(trim(p_descripcion), ''), 'Abierto', false)
  RETURNING * INTO v_row;

  INSERT INTO proyecto_profesor (id_profesor, id_grupo)
  VALUES (v_uid, v_row.id_grupo);

  RETURN row_to_json(v_row);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_grupo_proyecto(varchar, text) TO authenticated;
