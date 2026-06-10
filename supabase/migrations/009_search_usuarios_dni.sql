-- Búsqueda de integrantes: DNI, correo, nombre y apellido
DROP FUNCTION IF EXISTS public.search_usuarios_for_invite(text);

CREATE OR REPLACE FUNCTION public.search_usuarios_for_invite(p_query text)
RETURNS TABLE (
  id_usuario uuid,
  email text,
  nombre text,
  apellido text,
  dni text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT
    u.id_usuario,
    lower(au.email::text) AS email,
    u.nombre,
    u.apellido,
    u.dni
  FROM usuarios u
  INNER JOIN auth.users au ON au.id = u.id_usuario
  WHERE trim(coalesce(p_query, '')) <> ''
    AND (
      coalesce(u.dni, '') ILIKE '%' || trim(p_query) || '%'
      OR lower(au.email::text) LIKE '%' || lower(trim(p_query)) || '%'
      OR lower(coalesce(u.nombre, '')) LIKE '%' || lower(trim(p_query)) || '%'
      OR lower(coalesce(u.apellido, '')) LIKE '%' || lower(trim(p_query)) || '%'
      OR lower(trim(coalesce(u.nombre, '') || ' ' || coalesce(u.apellido, '')))
        LIKE '%' || lower(trim(p_query)) || '%'
    )
  ORDER BY u.apellido NULLS LAST, u.nombre NULLS LAST
  LIMIT 15;
$$;

REVOKE ALL ON FUNCTION public.search_usuarios_for_invite(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_usuarios_for_invite(text) TO authenticated;
