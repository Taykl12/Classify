import type { Project } from '../types/dashboard';

export function chunkProjects(projects: Project[], pageSize: number): Project[][] {
  if (projects.length === 0) return [];

  const pages: Project[][] = [];
  for (let i = 0; i < projects.length; i += pageSize) {
    pages.push(projects.slice(i, i + pageSize));
  }
  return pages;
}
