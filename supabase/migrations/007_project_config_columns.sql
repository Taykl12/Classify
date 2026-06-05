ALTER TABLE grupos_proyectos
  ADD COLUMN IF NOT EXISTS alcance_detalle text,
  ADD COLUMN IF NOT EXISTS notas_alcance text,
  ADD COLUMN IF NOT EXISTS anteproyecto_validado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS link_respaldo text,
  ADD COLUMN IF NOT EXISTS link_calificaciones text,
  ADD COLUMN IF NOT EXISTS documentos jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE OR REPLACE FUNCTION public.get_project_owner_email(p_id_grupo integer)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT lower(au.email::text)
  FROM proyecto_profesor pp
  INNER JOIN auth.users au ON au.id = pp.id_profesor
  WHERE pp.id_grupo = p_id_grupo
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_project_owner_email(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_project_owner_email(integer) TO authenticated;
