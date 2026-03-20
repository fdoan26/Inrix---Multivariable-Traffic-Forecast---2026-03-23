import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db/connection.js';
import { cacheGet, cacheSet } from '../services/cache.js';

export const forecastsRouter = Router();

const departureWindowsSchema = z.object({
  arrival: z.string().datetime({ message: 'arrival must be ISO 8601 format' }),
  window_count: z.coerce.number().int().min(1, 'window_count must be 1-50').max(50, 'window_count must be 1-50').default(10),
});

function deriveCongestionRisk(p50: number, p10: number): 'free_flow' | 'moderate' | 'heavy' {
  const ratio = p50 / p10;
  if (ratio <= 1.2) return 'free_flow';
  if (ratio <= 1.5) return 'moderate';
  return 'heavy';
}

function deriveReason(row: { weather_modifier: number | null; event_modifier: number | null; school_modifier: number | null }): string | null {
  const reasons: string[] = [];
  if (row.weather_modifier && row.weather_modifier > 1.05) reasons.push('Weather: rain/fog forecast');
  if (row.event_modifier && row.event_modifier > 1.05) reasons.push('Event: local event nearby');
  if (row.school_modifier && row.school_modifier > 1.05) reasons.push('School: school day rush');
  return reasons.length > 0 ? reasons.join('; ') : null;
}

forecastsRouter.get('/:corridorId/forecast', async (req, res) => {
  const { corridorId } = req.params;
  const hours = parseInt(req.query.hours as string) || 168;

  // Validate corridor exists
  const corridorResult = await query(
    'SELECT corridor_id FROM corridors WHERE corridor_id = $1',
    [corridorId]
  );
  if (corridorResult.rows.length === 0) {
    res.status(404).json({ error: `Corridor not found: ${corridorId}` });
    return;
  }

  const forecastResult = await query(
    `SELECT corridor_id, forecast_for, predicted_minutes,
            p10_minutes, p50_minutes, p90_minutes,
            model_version, weather_modifier, event_modifier, school_modifier
     FROM forecasts
     WHERE corridor_id = $1 AND forecast_for >= NOW() AND forecast_for <= NOW() + $2::interval
     ORDER BY forecast_for ASC`,
    [corridorId, `${hours} hours`]
  );

  res.json({
    corridor_id: corridorId,
    horizon_hours: hours,
    forecasts: forecastResult.rows.map((r: any) => ({
      forecast_for: r.forecast_for,
      predicted_minutes: r.predicted_minutes,
      p10_minutes: r.p10_minutes,
      p50_minutes: r.p50_minutes,
      p90_minutes: r.p90_minutes,
      model_version: r.model_version,
      weather_modifier: r.weather_modifier,
      event_modifier: r.event_modifier,
      school_modifier: r.school_modifier,
    })),
  });
});

forecastsRouter.get('/:corridorId/departure-windows', async (req, res) => {
  const { corridorId } = req.params;

  // Validate query params with Zod
  const result = departureWindowsSchema.safeParse(req.query);
  if (!result.success) {
    res.status(400).json({ error: result.error.issues[0].message });
    return;
  }
  const { arrival, window_count } = result.data;

  // Validate arrival is within 7 days
  const arrivalDate = new Date(arrival);
  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  if (arrivalDate > sevenDaysFromNow) {
    res.status(400).json({ error: 'arrival must be within the next 7 days' });
    return;
  }

  // Cache check -- key includes corridor + arrival hour for granularity
  const arrivalHour = arrivalDate.toISOString().slice(0, 13); // "2026-03-25T09"
  const cacheKey = `${corridorId}:departures:${arrivalHour}`;
  const cached = cacheGet(cacheKey);
  if (cached) {
    res.json(cached);
    return;
  }

  // Validate corridor exists
  const corridorResult = await query(
    'SELECT corridor_id FROM corridors WHERE corridor_id = $1',
    [corridorId]
  );
  if (corridorResult.rows.length === 0) {
    res.status(404).json({ error: `Corridor not found: ${corridorId}` });
    return;
  }

  // Query forecasts within +/-3 hours of requested arrival
  const forecastResult = await query(
    `SELECT forecast_for, predicted_minutes, p10_minutes, p50_minutes, p90_minutes,
            weather_modifier, event_modifier, school_modifier
     FROM forecasts
     WHERE corridor_id = $1
       AND forecast_for >= $2::timestamptz - INTERVAL '3 hours'
       AND forecast_for <= $2::timestamptz + INTERVAL '3 hours'
       AND forecast_for >= NOW()
       AND forecast_for <= NOW() + INTERVAL '7 days'
     ORDER BY p50_minutes ASC
     LIMIT $3`,
    [corridorId, arrival, window_count]
  );

  // Map rows to response windows
  const windows = forecastResult.rows.map((r: any) => {
    const forecastForMs = new Date(r.forecast_for).getTime();
    const travelMs = r.p50_minutes * 60 * 1000;
    return {
      departure_at: new Date(forecastForMs - travelMs).toISOString(),
      estimated_travel_min: r.p50_minutes,
      p10_minutes: r.p10_minutes,
      p90_minutes: r.p90_minutes,
      congestion_risk: deriveCongestionRisk(r.p50_minutes, r.p10_minutes),
      reason: deriveReason(r),
    };
  });

  const response = {
    corridor_id: corridorId,
    arrival_target: arrival,
    windows,
  };

  cacheSet(cacheKey, response);
  res.json(response);
});
