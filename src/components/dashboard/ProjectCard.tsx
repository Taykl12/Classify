import type { Project } from '../../types/dashboard';
import '../../styles/carousel.css';

interface ProjectCardProps {
  project: Project;
}

export function ProjectCard({ project }: ProjectCardProps) {
  return (
    <article className="project-card" aria-label={project.name}>
      <h3 className="project-card__title">{project.name}</h3>
    </article>
  );
}
