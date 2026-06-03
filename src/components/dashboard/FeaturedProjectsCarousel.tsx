import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { useCarouselMetrics } from '../../hooks/useCarouselMetrics';
import type { Project } from '../../types/dashboard';
import '../../styles/carousel.css';
import { ProjectCard } from './ProjectCard';

interface FeaturedProjectsCarouselProps {
  projects: Project[];
}

export function FeaturedProjectsCarousel({ projects }: FeaturedProjectsCarouselProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const { visibleSlots } = useCarouselMetrics(viewportRef);
  const [index, setIndex] = useState(0);

  const maxIndex = Math.max(0, projects.length - visibleSlots);
  const canGoPrev = index > 0;
  const canGoNext = index < maxIndex;

  useEffect(() => {
    setIndex((current) => Math.min(current, maxIndex));
  }, [maxIndex]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    track.style.setProperty('--carousel-index', String(index));
  }, [index]);

  const goPrev = useCallback(() => {
    setIndex((i) => Math.max(0, i - 1));
  }, []);

  const goNext = useCallback(() => {
    setIndex((i) => Math.min(maxIndex, i + 1));
  }, [maxIndex]);

  const handleRegionKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'ArrowLeft' && canGoPrev) {
        event.preventDefault();
        goPrev();
      }
      if (event.key === 'ArrowRight' && canGoNext) {
        event.preventDefault();
        goNext();
      }
    },
    [canGoPrev, canGoNext, goPrev, goNext],
  );

  return (
    <div
      className="carousel"
      role="region"
      aria-label="Proyectos destacados"
      tabIndex={0}
      onKeyDown={handleRegionKeyDown}
    >
      <button
        type="button"
        className="carousel__nav carousel__nav--prev"
        onClick={goPrev}
        disabled={!canGoPrev}
        aria-label="Proyecto anterior"
      >
        <ChevronLeft size={24} aria-hidden />
      </button>

      <div className="carousel__viewport" ref={viewportRef}>
        <div className="carousel__track" ref={trackRef}>
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      </div>

      <button
        type="button"
        className="carousel__nav carousel__nav--next"
        onClick={goNext}
        disabled={!canGoNext}
        aria-label="Proyecto siguiente"
      >
        <ChevronRight size={24} aria-hidden />
      </button>
    </div>
  );
}
