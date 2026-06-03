export interface Project {
  id: string;
  name: string;
  pendingTasks: number;
}

export interface PendingItem {
  id: string;
  summary: string;
  projectName: string;
  priority: 'Alta' | 'Media' | 'Baja';
  status: 'Pendiente' | 'En curso';
}

export const FEATURED_PROJECTS: Project[] = Array.from({ length: 10 }, (_, i) => ({
  id: String(i + 1),
  name: `Proyecto ${i + 1}`,
  pendingTasks: (i % 5) + 1,
}));

export const PENDING_ITEMS: PendingItem[] = [
  {
    id: '1',
    summary: 'Texto de ejemplo',
    projectName: 'Nombre del Proyecto',
    priority: 'Alta',
    status: 'Pendiente',
  },
  {
    id: '2',
    summary: 'Texto de ejemplo',
    projectName: 'Nombre del Proyecto',
    priority: 'Media',
    status: 'En curso',
  },
  {
    id: '3',
    summary: 'Texto de ejemplo',
    projectName: 'Nombre del Proyecto',
    priority: 'Baja',
    status: 'Pendiente',
  },
];
