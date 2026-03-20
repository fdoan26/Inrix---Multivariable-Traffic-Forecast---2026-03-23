import { useQuery } from '@tanstack/react-query';
import { fetchIncidents } from '@/lib/api';

export function useIncidents() {
  return useQuery({
    queryKey: ['incidents'],
    queryFn: fetchIncidents,
    refetchInterval: 5 * 60 * 1000,
    staleTime: 4 * 60 * 1000,
  });
}
