import { useQuery } from '@tanstack/react-query';
import { fetchAccuracyMetrics } from '@/lib/api';
import type { AccuracyResponse } from '@/types/api';

export function useAccuracyMetrics() {
  return useQuery<AccuracyResponse>({
    queryKey: ['accuracy'],
    queryFn: () => fetchAccuracyMetrics(),
    refetchInterval: 60 * 60 * 1000,
    staleTime: 30 * 60 * 1000,
  });
}
