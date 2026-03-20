import type { CorridorCurrentResponse } from '@/types/api';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export async function fetchCorridorSpeed(corridorId: string): Promise<CorridorCurrentResponse> {
  const res = await fetch(`${API_URL}/api/corridors/${corridorId}/current`);
  if (!res.ok) throw new Error(`Failed to fetch corridor ${corridorId}: ${res.status}`);
  return res.json();
}
