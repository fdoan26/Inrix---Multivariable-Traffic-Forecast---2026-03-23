import { Router } from 'express';
import { query } from '../db/connection.js';

export const corridorsRouter = Router();

corridorsRouter.get('/:corridorId/current', async (req, res) => {
  const { corridorId } = req.params;

  // Look up corridor in corridors table
  const corridorResult = await query(
    'SELECT corridor_id, display_name, segment_ids FROM corridors WHERE corridor_id = $1',
    [corridorId]
  );
  if (corridorResult.rows.length === 0) {
    res.status(404).json({ error: `Corridor not found: ${corridorId}` });
    return;
  }
  const corridor = corridorResult.rows[0];

  // Get latest speed readings for corridor segments
  const speedsResult = await query(
    `SELECT DISTINCT ON (segment_id)
       segment_id, speed, congestion_score, travel_time_min, recorded_at
     FROM speed_readings
     WHERE segment_id = ANY($1)
     ORDER BY segment_id, recorded_at DESC`,
    [corridor.segment_ids]
  );

  const segments = speedsResult.rows;
  const avgTravelTime = segments.length > 0
    ? segments.reduce((sum: number, s: any) => sum + (s.travel_time_min || 0), 0)
    : 0;
  const avgCongestion = segments.length > 0
    ? segments.reduce((sum: number, s: any) => sum + (s.congestion_score || 0), 0) / segments.length
    : 0;

  const congestionLevel = avgCongestion <= 1 ? 'free_flow'
    : avgCongestion <= 2 ? 'moderate' : 'heavy';

  res.json({
    corridor_id: corridorId,
    display_name: corridor.display_name,
    congestion_level: congestionLevel,
    avg_travel_time_min: Math.round(avgTravelTime * 100) / 100,
    segments: segments.map((s: any) => ({
      segment_id: s.segment_id,
      speed: s.speed,
      congestion_score: s.congestion_score,
      travel_time_min: s.travel_time_min,
      recorded_at: s.recorded_at,
    })),
  });
});
