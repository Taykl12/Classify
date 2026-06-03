import { useEffect, useState } from 'react';
import type { RefObject } from 'react';

export function useViewportWidth(
  elementRef: RefObject<HTMLElement | null>,
): number {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const update = () => setWidth(element.clientWidth);
    update();

    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [elementRef]);

  return width;
}
