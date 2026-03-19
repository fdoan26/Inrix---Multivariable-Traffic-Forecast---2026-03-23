import { query } from '../connection.js';
import type { Incident } from '../../collectors/schemas/inrix.js';

export async function insertIncidents(
  incidents: Incident[],
  recordedAt: Date
): Promise<number> {
  if (incidents.length === 0) return 0;

  const COLS_PER_ROW = 13;
  const values: unknown[] = [];
  const placeholders: string[] = [];

  for (let i = 0; i < incidents.length; i++) {
    const offset = i * COLS_PER_ROW;
    placeholders.push(
      `($${offset + 1},$${offset + 2},$${offset + 3},$${offset + 4},$${offset + 5},$${offset + 6},$${offset + 7},$${offset + 8},$${offset + 9},$${offset + 10},$${offset + 11},$${offset + 12},$${offset + 13})`
    );
    const inc = incidents[i];
    values.push(
      inc.id,
      recordedAt,
      inc.type,
      inc.severity,
      inc.latitude,
      inc.longitude,
      inc.shortDesc,
      inc.longDesc ?? null,
      inc.direction ?? null,
      inc.impacting ?? null,
      inc.delayFromTypical ?? null,
      inc.delayFromFreeFlow ?? null,
      inc.status ?? null
    );
  }

  const sql = `INSERT INTO incidents (incident_id, recorded_at, incident_type, severity, latitude, longitude, short_desc, long_desc, direction, impacting, delay_from_typical_min, delay_from_freeflow_min, status)
VALUES ${placeholders.join(', ')}`;

  const result = await query(sql, values);
  return result.rowCount ?? 0;
}
