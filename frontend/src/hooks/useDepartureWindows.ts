import { useQuery } from '@tanstack/react-query';
import { fetchDepartureWindows } from '@/lib/api';

export function useDepartureWindows(corridorId: string | null, arrival: string | null) {
  return useQuery({
    queryKey: ['departure-windows', corridorId, arrival],
    queryFn: () => fetchDepartureWindows(corridorId!, arrival!),
    enabled: !!corridorId && !!arrival,
    refetchInterval: false,
  });
}
