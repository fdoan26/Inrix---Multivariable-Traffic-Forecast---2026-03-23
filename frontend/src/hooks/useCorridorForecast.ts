import { useQuery } from '@tanstack/react-query';
import { fetchCorridorForecast } from '@/lib/api';

export function useCorridorForecast(corridorId: string | null) {
  return useQuery({
    queryKey: ['forecast', corridorId],
    queryFn: () => fetchCorridorForecast(corridorId!),
    enabled: !!corridorId,
    refetchInterval: false,
    staleTime: 30 * 60 * 1000,
  });
}
