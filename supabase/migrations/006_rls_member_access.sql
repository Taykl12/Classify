-- Integrantes pueden ver proyectos y tareas de grupos donde están en grupo_estudiante

CREATE POLICY grupos_proyectos_select_member ON grupos_proyectos
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM grupo_estudiante ge
      WHERE ge.id_grupo = grupos_proyectos.id_grupo
        AND ge.id_usuario = auth.uid()
    )
  );

CREATE POLICY grupo_estudiante_select_own ON grupo_estudiante
  FOR SELECT TO authenticated
  USING (id_usuario = auth.uid());

CREATE POLICY tareas_grupo_select_member ON tareas_grupo
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM grupo_estudiante ge
      WHERE ge.id_grupo = tareas_grupo.id_grupo
        AND ge.id_usuario = auth.uid()
    )
  );
