import { ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { Project } from "../../types/dashboard";
import { ROUTES } from "../../routes";
import "../../styles/carousel.css";

interface ProjectCardProps {
  project: Project;
}

function taskLabel(count: number): string {
  return count === 1 ? "1 tarea pendiente" : `${count} tareas pendientes`;
}

export function ProjectCard({ project }: ProjectCardProps) {
  const navigate = useNavigate();

  return (
    <article className="project-card" aria-label={project.name}>
      <div className="project-card__content">
        <h3 className="project-card__title">{project.name}</h3>
        <p className="project-card__meta">{taskLabel(project.pendingTasks)}</p>
      </div>
      <div className="project-card__footer">
        <button
          type="button"
          className="project-card__go-btn"
          aria-label={`Ir al proyecto ${project.name}`}
          onClick={() => navigate(ROUTES.projectConfig(project.id))}
        >
          Ir al proyecto
          <ArrowRight size={18} aria-hidden />
        </button>
      </div>
    </article>
  );
}
