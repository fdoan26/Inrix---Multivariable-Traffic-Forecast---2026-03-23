import { query } from '../connection.js';
import type { SpeedSegment } from '../../collectors/schemas/inrix.js';

export async function insertSpeedReadings(
  segments: SpeedSegment[],
  recordedAt: Date
): Promise<number> {
  if (segments.length === 0) return 0;

  const COLS_PER_ROW = 8;
  const values: unknown[] = [];
  const placeholders: string[] = [];

  for (let i = 0; i < segments.length; i++) {
    const offset = i * COLS_PER_ROW;
    placeholders.push(
      `($${offset + 1},$${offset + 2},$${offset + 3},$${offset + 4},$${offset + 5},$${offset + 6},$${offset + 7},$${offset + 8})`
    );
    const s = segments[i];
    values.push(
      s.segmentId,
      recordedAt,
      s.speed,
      s.reference,
      s.average,
      s.speedBucket,
      s.travelTimeMinutes,
      s.durationMinutes ?? null
    );
  }

  const sql = `INSERT INTO speed_readings (segment_id, recorded_at, speed, free_flow_speed, historical_avg, congestion_score, travel_time_min, duration_minutes)
VALUES ${placeholders.join(', ')}`;

  const result = await query(sql, values);
  return result.rowCount ?? 0;
}
