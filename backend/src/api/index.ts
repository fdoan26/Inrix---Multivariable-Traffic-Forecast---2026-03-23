import express from 'express';
import cors from 'cors';
import { corridorsRouter } from './corridors.js';
import { forecastsRouter } from './forecasts.js';
import { incidentsRouter } from './incidents.js';
import { accuracyRouter } from './accuracy.js';

const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map(s => s.trim());

export const app = express();

// CORS must be FIRST, before JSON body parser (pitfall 6 from RESEARCH.md)
app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

// Routes
app.use('/api/corridors', corridorsRouter);
app.use('/api/corridors', forecastsRouter);
app.use('/api/incidents', incidentsRouter);
app.use('/api/accuracy', accuracyRouter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error middleware MUST be AFTER routes, MUST have 4 params (pitfalls 1 & 2 from RESEARCH.md)
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[api] Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});
