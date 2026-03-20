import { useQueries } from '@tanstack/react-query';
import { CORRIDOR_IDS } from '@/data/corridors';
import { fetchCorridorSpeed } from '@/lib/api';

export function useCorridorSpeeds() {
  return useQueries({
    queries: CORRIDOR_IDS.map((id) => ({
      queryKey: ['corridor-speed', id] as const,
      queryFn: () => fetchCorridorSpeed(id),
      refetchInterval: 5 * 60 * 1000,
      staleTime: 4 * 60 * 1000,
    })),
  });
}
