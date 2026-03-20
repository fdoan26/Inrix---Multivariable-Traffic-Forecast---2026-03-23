import type { CongestionLevel } from '@/types/api';

export function deriveCongestionLevel(p50: number, p10: number): CongestionLevel {
  if (p10 <= 0) return 'unknown';
  const ratio = p50 / p10;
  if (ratio <= 1.2) return 'free_flow';
  if (ratio <= 1.5) return 'moderate';
  return 'heavy';
}
