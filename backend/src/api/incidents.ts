import { Router } from 'express';
import { query } from '../db/connection.js';

export const incidentsRouter = Router();

incidentsRouter.get('/', async (_req, res) => {
  const result = await query(
    `SELECT incident_id, incident_type, severity, latitude, longitude,
            short_desc, long_desc, delay_from_typical_min, recorded_at, status
     FROM incidents
     WHERE recorded_at > NOW() - INTERVAL '24 hours'
       AND status != 'Cleared'
     ORDER BY recorded_at DESC
     LIMIT 100`,
    []
  );
  res.json({ incidents: result.rows });
});
