import type { CorridorCurrentResponse, IncidentsResponse } from '@/types/api';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export async function fetchCorridorSpeed(corridorId: string): Promise<CorridorCurrentResponse> {
  const res = await fetch(`${API_URL}/api/corridors/${corridorId}/current`);
  if (!res.ok) throw new Error(`Failed to fetch corridor ${corridorId}: ${res.status}`);
  return res.json();
}

export async function fetchIncidents(): Promise<IncidentsResponse> {
  const res = await fetch(`${API_URL}/api/incidents`);
  if (!res.ok) throw new Error(`Failed to fetch incidents: ${res.status}`);
  return res.json();
}
