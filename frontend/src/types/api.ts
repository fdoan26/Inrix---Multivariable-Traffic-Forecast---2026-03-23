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
