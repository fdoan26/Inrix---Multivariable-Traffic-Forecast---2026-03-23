export type CongestionLevel = 'free_flow' | 'moderate' | 'heavy' | 'unknown';

export interface CorridorSegment {
  segment_id: string;
  speed: number;
  congestion_score: number;
  travel_time_min: number;
  recorded_at: string;
}

export interface CorridorCurrentResponse {
  corridor_id: string;
  display_name: string;
  congestion_level: CongestionLevel;
  avg_travel_time_min: number;
  segments: CorridorSegment[];
}

export type IncidentType = 'crash' | 'construction' | 'congestion' | 'event';

export interface Incident {
  incident_id: string;
  incident_type: number; // 1=Construction, 2=Event, 3=Flow, 4=Incident
  severity: number;
  latitude: number;
  longitude: number;
  short_desc: string;
  long_desc: string | null;
  delay_from_typical_min: number | null;
  recorded_at: string;
  status: string;
}

export interface IncidentsResponse {
  incidents: Incident[];
}

/** Map INRIX incident_type number to display category */
export const INCIDENT_TYPE_MAP: Record<number, IncidentType> = {
  1: 'construction', // Construction
  2: 'event',        // Event -> treat as congestion icon
  3: 'congestion',   // Flow
  4: 'crash',        // Incident
};
