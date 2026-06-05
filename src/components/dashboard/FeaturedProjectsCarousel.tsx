import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { useCarouselItemsPerPage } from '../../hooks/useCarouselMetrics';
import { useViewportWidth } from '../../hooks/useViewportWidth';
import type { Project } from '../../types/dashboard';
import { chunkProjects } from '../../utils/chunkProjects';
import '../../styles/carousel.css';
import { ProjectCard } from './ProjectCard';

interface FeaturedProjectsCarouselProps {
  projects: Project[];
}

export function FeaturedProjectsCarousel({ projects }: FeaturedProjectsCarouselProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const itemsPerPage = useCarouselItemsPerPage(viewportRef);
  const viewportWidth = useViewportWidth(viewportRef);
  const [pageIndex, setPageIndex] = useState(0);

  const pages = useMemo(
    () => chunkProjects(projects, itemsPerPage),
    [projects, itemsPerPage],
  );

  const pageCount = pages.length;
  const maxPage = Math.max(0, pageCount - 1);
  const currentPage = Math.min(pageIndex, maxPage);
  const canGoPrev = currentPage > 0;
  const canGoNext = currentPage < maxPage;

  const goPrev = useCallback(() => {
    setPageIndex((page) => Math.max(0, page - 1));
  }, []);

  const goNext = useCallback(() => {
    setPageIndex((page) => Math.min(maxPage, page + 1));
  }, [maxPage]);

  const trackStyle = useMemo((): CSSProperties | undefined => {
    if (viewportWidth <= 0) return undefined;
    return {
      width: viewportWidth * pageCount,
      transform: `translate3d(-${currentPage * viewportWidth}px, 0, 0)`,
    };
  }, [currentPage, pageCount, viewportWidth]);

  return (
    <div className="carousel" role="region" aria-label="Proyectos destacados">
      <button
        type="button"
        className="carousel__nav carousel__nav--prev"
        onClick={goPrev}
        disabled={!canGoPrev}
        aria-label="Página anterior de proyectos"
      >
        <ChevronLeft size={24} aria-hidden />
      </button>

      <div className="carousel__viewport" ref={viewportRef}>
        <div className="carousel__pages" style={trackStyle} aria-live="polite">
          {pages.map((pageProjects, pageIndex) => (
            <div
              key={pageIndex}
              className="carousel__page"
              style={viewportWidth > 0 ? { width: viewportWidth } : undefined}
              aria-hidden={pageIndex !== currentPage}
            >
              {pageProjects.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          ))}
        </div>
      </div>

      <button
        type="button"
        className="carousel__nav carousel__nav--next"
        onClick={goNext}
        disabled={!canGoNext}
        aria-label="Página siguiente de proyectos"
      >
        <ChevronRight size={24} aria-hidden />
      </button>

      <p className="carousel__pagination sr-only" aria-live="polite">
        Página {currentPage + 1} de {pageCount}
      </p>
    </div>
  );
}
