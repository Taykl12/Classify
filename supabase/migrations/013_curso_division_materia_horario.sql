-- Curso: división (ej. "2ª") para componer "1° 2ª T.E.P".
ALTER TABLE public.cursos ADD COLUMN IF NOT EXISTS division varchar;

-- Materia: horario predefinido (ej. "Lunes a Viernes 07:30 - 12:30").
ALTER TABLE public.materias ADD COLUMN IF NOT EXISTS horario varchar;
