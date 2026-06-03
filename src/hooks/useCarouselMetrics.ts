import { useEffect, useState } from 'react';
import type { RefObject } from 'react';

const CARD_GAP = 20;
const MIN_CARD_WIDTH = 200;
export const MAX_ITEMS_PER_PAGE = 4;

export function useCarouselItemsPerPage(
  viewportRef: RefObject<HTMLDivElement | null>,
): number {
  const [itemsPerPage, setItemsPerPage] = useState(MAX_ITEMS_PER_PAGE);

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;

    const update = () => {
      const width = element.clientWidth;
      const visible = Math.floor((width + CARD_GAP) / (MIN_CARD_WIDTH + CARD_GAP));
      setItemsPerPage(Math.max(1, Math.min(visible, MAX_ITEMS_PER_PAGE)));
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [viewportRef]);

  return itemsPerPage;
}
