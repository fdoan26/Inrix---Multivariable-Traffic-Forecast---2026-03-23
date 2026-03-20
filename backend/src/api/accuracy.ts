import { Router } from 'express';
import { query } from '../db/connection.js';
import { cacheGet, cacheSet } from '../services/cache.js';

export const accuracyRouter = Router();

const ACCURACY_CACHE_TTL = 60 * 60 * 1000; // 1 hour

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const CORRIDOR_DISPLAY_NAMES: Record<string, string> = {
  'us-101': 'US-101',
  'i-280': 'I-280',
  'bay-bridge': 'Bay Bridge Approach',
  'van-ness': 'Van Ness Ave',
  '19th-ave': '19th Ave',
  'market-st': 'Market St',
};

export function deriveTrend(recent: number | null, prior: number | null): 'improving' | 'degrading' | 'stable' {
  if (recent == null || prior == null || prior === 0) return 'stable';
  if (recent < prior * 0.95) return 'improving';
  if (recent > prior * 1.05) return 'degrading';
  return 'stable';
}

accuracyRouter.get('/', async (req, res) => {
  const corridorId = (req.query.corridor_id as string) || null;
  const cacheKey = corridorId ? `accuracy:${corridorId}` : 'accuracy:all';

  const cached = cacheGet(cacheKey);
  if (cached) {
    res.json(cached);
    return;
  }

  // Query 1: Main aggregation
  const mainResult = await query(
    `SELECT corridor_id, COUNT(*)::int AS sample_count,
            AVG(abs_error_minutes) AS mae_minutes,
            AVG(abs_pct_error) AS mape_pct
     FROM forecast_outcomes
     WHERE ($1::text IS NULL OR corridor_id = $1)
     GROUP BY corridor_id ORDER BY corridor_id`,
    [corridorId]
  );

  // Query 2: Trend (last 7 vs prior 7 days)
  const trendResult = await query(
    `SELECT corridor_id,
            AVG(abs_pct_error) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') AS recent_mape,
            AVG(abs_pct_error) FILTER (WHERE created_at >= NOW() - INTERVAL '14 days' AND created_at < NOW() - INTERVAL '7 days') AS prior_mape
     FROM forecast_outcomes
     WHERE ($1::text IS NULL OR corridor_id = $1)
     GROUP BY corridor_id`,
    [corridorId]
  );

  // Query 3: Day-of-week breakdown
  const dayResult = await query(
    `SELECT corridor_id,
            EXTRACT(DOW FROM forecast_for AT TIME ZONE 'America/Los_Angeles')::int AS day,
            COUNT(*)::int AS count,
            AVG(abs_error_minutes) AS mae_minutes,
            AVG(abs_pct_error) AS mape_pct
     FROM forecast_outcomes
     WHERE ($1::text IS NULL OR corridor_id = $1)
     GROUP BY corridor_id, EXTRACT(DOW FROM forecast_for AT TIME ZONE 'America/Los_Angeles')
     ORDER BY corridor_id, day`,
    [corridorId]
  );

  const mainRows = mainResult.rows;
  const trendRows = trendResult.rows;
  const dayRows = dayResult.rows;

  const corridors = mainRows.map((row: any) => {
    const trendRow = trendRows.find((t: any) => t.corridor_id === row.corridor_id);
    const dowRows = dayRows.filter((d: any) => d.corridor_id === row.corridor_id);
    return {
      corridor_id: row.corridor_id,
      display_name: CORRIDOR_DISPLAY_NAMES[row.corridor_id] || row.corridor_id,
      sample_count: row.sample_count,
      mae_minutes: row.mae_minutes ? parseFloat(Number(row.mae_minutes).toFixed(1)) : null,
      mape_pct: row.mape_pct ? parseFloat(Number(row.mape_pct).toFixed(1)) : null,
      trend: deriveTrend(trendRow?.recent_mape ?? null, trendRow?.prior_mape ?? null),
      by_day_of_week: dowRows.map((d: any) => ({
        day: d.day,
        day_name: DAY_NAMES[d.day],
        mae_minutes: parseFloat(Number(d.mae_minutes).toFixed(1)),
        mape_pct: parseFloat(Number(d.mape_pct).toFixed(1)),
        count: d.count,
      })),
    };
  });

  const response = { generated_at: new Date().toISOString(), corridors };
  cacheSet(cacheKey, response, ACCURACY_CACHE_TTL);
  res.json(response);
});
