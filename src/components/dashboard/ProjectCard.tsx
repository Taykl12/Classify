import type { Project } from '../../types/dashboard';
import '../../styles/carousel.css';

interface ProjectCardProps {
  project: Project;
}

function taskLabel(count: number): string {
  return count === 1 ? '1 tarea pendiente' : `${count} tareas pendientes`;
}

export function ProjectCard({ project }: ProjectCardProps) {
  return (
    <article className="project-card" aria-label={project.name}>
      <div className="project-card__content">
        <h3 className="project-card__title">{project.name}</h3>
        <p className="project-card__meta">{taskLabel(project.pendingTasks)}</p>
      </div>
    </article>
  );
}
