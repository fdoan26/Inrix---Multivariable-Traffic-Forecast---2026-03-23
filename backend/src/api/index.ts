import express from 'express';
import { corridorsRouter } from './corridors.js';
import { forecastsRouter } from './forecasts.js';

export const app = express();
app.use(express.json());
app.use('/api/corridors', corridorsRouter);
app.use('/api/corridors', forecastsRouter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
