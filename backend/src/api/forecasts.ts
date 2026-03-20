import { Router } from 'express';
import { query } from '../db/connection.js';

export const forecastsRouter = Router();

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
