import { useCallback, useState } from 'react';

const STORAGE_KEY = 'classify-sidebar-collapsed';

function readStoredCollapsed(defaultCollapsed: boolean): boolean {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === null) return defaultCollapsed;
  return stored === 'true';
}

export function useSidebarCollapsed(defaultCollapsed = true) {
  const [collapsed, setCollapsed] = useState(() => readStoredCollapsed(defaultCollapsed));

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }, []);

  return { collapsed, toggle };
}
