import { query } from '../db/connection.js';

const OUTCOME_SQL = `
INSERT INTO forecast_outcomes (corridor_id, forecast_for, predicted_minutes, actual_minutes, p10_minutes, p50_minutes, p90_minutes)
SELECT
  f.corridor_id,
  f.forecast_for,
  f.predicted_minutes,
  actuals.actual_minutes,
  f.p10_minutes,
  f.p50_minutes,
  f.p90_minutes
FROM forecasts f
JOIN corridors c ON c.corridor_id = f.corridor_id
CROSS JOIN LATERAL (
  SELECT SUM(seg_avg) AS actual_minutes
  FROM (
    SELECT AVG(sr.travel_time_min) AS seg_avg
    FROM speed_readings sr
    WHERE sr.segment_id = ANY(c.segment_ids)
      AND sr.recorded_at >= f.forecast_for - INTERVAL '30 minutes'
      AND sr.recorded_at <= f.forecast_for + INTERVAL '30 minutes'
    GROUP BY sr.segment_id
    HAVING COUNT(DISTINCT sr.segment_id) = array_length(c.segment_ids, 1)
  ) sub
) actuals
WHERE f.forecast_for < NOW() - INTERVAL '1 hour'
  AND actuals.actual_minutes IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM forecast_outcomes fo
    WHERE fo.corridor_id = f.corridor_id AND fo.forecast_for = f.forecast_for
  )
ON CONFLICT (corridor_id, forecast_for) DO NOTHING
`;

export async function logOutcomes(): Promise<{ processed: number; inserted: number }> {
  const result = await query(OUTCOME_SQL, []);
  const inserted = result.rowCount ?? 0;
  return { processed: inserted, inserted };
}

// CLI entry point
if (require.main === module) {
  logOutcomes()
    .then(r => { console.log(`Outcome logger: inserted ${r.inserted} outcomes`); process.exit(0); })
    .catch(err => { console.error('Outcome logger failed:', err); process.exit(1); });
}
