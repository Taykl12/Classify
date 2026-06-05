ALTER TABLE grupos_proyectos
  ADD COLUMN IF NOT EXISTS es_favorito boolean NOT NULL DEFAULT false;

CREATE POLICY proyecto_profesor_insert_own ON proyecto_profesor
  FOR INSERT TO authenticated
  WITH CHECK (id_profesor = auth.uid());

CREATE POLICY proyecto_profesor_delete_own ON proyecto_profesor
  FOR DELETE TO authenticated
  USING (id_profesor = auth.uid());

CREATE POLICY grupos_proyectos_insert_auth ON grupos_proyectos
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY grupos_proyectos_update_owner ON grupos_proyectos
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM proyecto_profesor pp
      WHERE pp.id_grupo = grupos_proyectos.id_grupo AND pp.id_profesor = auth.uid()
    )
  );

CREATE POLICY grupos_proyectos_delete_owner ON grupos_proyectos
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM proyecto_profesor pp
      WHERE pp.id_grupo = grupos_proyectos.id_grupo AND pp.id_profesor = auth.uid()
    )
  );
