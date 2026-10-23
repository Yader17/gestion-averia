import { Averia } from '../types/averia';
import { parseDate } from './dateUtils';

export const ATTENTION_WINDOW_DAYS = 30;

export type DashboardStats = {
  total: number;
  resolved: number;
  pending: number;
  resolutionRate: number; // integer 0-100
  latest: Averia[];
  attention: Averia[];
  topTypes: { label: string; value: number }[];
};

function timestamp(averia: Averia): number {
  return parseDate(averia.fecha)?.getTime() ?? 0;
}

export function computeDashboardStats(
  averias: Averia[],
  now: Date = new Date(),
  options: { latestCount?: number; attentionCount?: number; topTypesCount?: number } = {}
): DashboardStats {
  const { latestCount = 5, attentionCount = 5, topTypesCount = 5 } = options;
  const total = averias.length;
  const resolved = averias.filter((a) => a.solucionado).length;
  const pending = total - resolved;

  const sortedDesc = [...averias].sort((a, b) => timestamp(b) - timestamp(a));
  const windowStart = now.getTime() - ATTENTION_WINDOW_DAYS * 86_400_000;

  const attention = sortedDesc
    .filter((a) => !a.solucionado && timestamp(a) >= windowStart && timestamp(a) > 0)
    .slice(0, attentionCount);

  const typeCounts = new Map<string, number>();
  averias.forEach((a) => typeCounts.set(a.tipoAveria, (typeCounts.get(a.tipoAveria) ?? 0) + 1));
  const topTypes = Array.from(typeCounts.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))
    .slice(0, topTypesCount);

  return {
    total,
    resolved,
    pending,
    resolutionRate: total > 0 ? Math.round((resolved / total) * 100) : 0,
    latest: sortedDesc.slice(0, latestCount),
    attention,
    topTypes,
  };
}
