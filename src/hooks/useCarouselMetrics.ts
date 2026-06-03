import { useEffect, useState } from 'react';
import type { RefObject } from 'react';

const CARD_GAP = 20;
const PEEK = 28;
const MIN_CARD_WIDTH = 200;
const MAX_VISIBLE = 4;

export function useCarouselMetrics(viewportRef: RefObject<HTMLDivElement | null>) {
  const [visibleSlots, setVisibleSlots] = useState(3);
  const [cardWidth, setCardWidth] = useState(280);

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;

    const update = () => {
      const width = element.clientWidth;
      let visible = Math.floor((width + CARD_GAP) / (MIN_CARD_WIDTH + CARD_GAP));
      visible = Math.max(1, Math.min(visible, MAX_VISIBLE));
      const computedCardWidth = (width - PEEK - (visible - 1) * CARD_GAP) / visible;

      setVisibleSlots(visible);
      setCardWidth(computedCardWidth);
      element.style.setProperty('--carousel-card-width', `${computedCardWidth}px`);
      element.style.setProperty('--carousel-stride', `${computedCardWidth + CARD_GAP}px`);
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [viewportRef]);

  return { visibleSlots, cardWidth, stride: cardWidth + CARD_GAP };
}
