import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

vi.mock('../../db/connection.js', () => ({
  query: vi.fn(),
}));

import { query } from '../../db/connection.js';
const mockedQuery = vi.mocked(query);

import { app } from '../index.js';

describe('GET /api/corridors/:corridorId/forecast', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 with forecast data', async () => {
    // Corridor lookup
    mockedQuery.mockResolvedValueOnce({
      rows: [{ corridor_id: 'us-101' }],
      rowCount: 1, command: 'SELECT', oid: 0, fields: [],
    } as any);
    // Forecast query
    mockedQuery.mockResolvedValueOnce({
      rows: [
        {
          corridor_id: 'us-101', forecast_for: '2026-03-21T08:00:00Z',
          predicted_minutes: 12.5, p10_minutes: 10.0, p50_minutes: 12.5,
          p90_minutes: 15.0, model_version: 'v1', weather_modifier: 1.0,
          event_modifier: 1.0, school_modifier: 1.0,
        },
      ],
      rowCount: 1, command: 'SELECT', oid: 0, fields: [],
    } as any);

    const res = await request(app).get('/api/corridors/us-101/forecast');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('corridor_id', 'us-101');
    expect(res.body).toHaveProperty('horizon_hours', 168);
    expect(res.body.forecasts).toHaveLength(1);
  });

  it('returns forecast objects with required fields including p10/p50/p90', async () => {
    mockedQuery.mockResolvedValueOnce({
      rows: [{ corridor_id: 'us-101' }],
      rowCount: 1, command: 'SELECT', oid: 0, fields: [],
    } as any);
    mockedQuery.mockResolvedValueOnce({
      rows: [
        {
          corridor_id: 'us-101', forecast_for: '2026-03-21T08:00:00Z',
          predicted_minutes: 12.5, p10_minutes: 10.0, p50_minutes: 12.5,
          p90_minutes: 15.0, model_version: 'v1', weather_modifier: 1.0,
          event_modifier: 1.0, school_modifier: 1.0,
        },
      ],
      rowCount: 1, command: 'SELECT', oid: 0, fields: [],
    } as any);

    const res = await request(app).get('/api/corridors/us-101/forecast');

    const forecast = res.body.forecasts[0];
    expect(forecast).toHaveProperty('forecast_for');
    expect(forecast).toHaveProperty('predicted_minutes');
    expect(forecast).toHaveProperty('p10_minutes');
    expect(forecast).toHaveProperty('p50_minutes');
    expect(forecast).toHaveProperty('p90_minutes');
    expect(forecast).toHaveProperty('model_version');
  });

  it('limits forecast window with ?hours=48 query parameter', async () => {
    mockedQuery.mockResolvedValueOnce({
      rows: [{ corridor_id: 'us-101' }],
      rowCount: 1, command: 'SELECT', oid: 0, fields: [],
    } as any);
    mockedQuery.mockResolvedValueOnce({
      rows: [], rowCount: 0, command: 'SELECT', oid: 0, fields: [],
    } as any);

    const res = await request(app).get('/api/corridors/us-101/forecast?hours=48');

    expect(res.status).toBe(200);
    expect(res.body.horizon_hours).toBe(48);
    // Verify query was called with 48 hours interval
    expect(mockedQuery).toHaveBeenCalledWith(
      expect.stringContaining('forecast'),
      expect.arrayContaining(['us-101', '48 hours'])
    );
  });

  it('returns 404 for unknown corridor', async () => {
    mockedQuery.mockResolvedValueOnce({
      rows: [], rowCount: 0, command: 'SELECT', oid: 0, fields: [],
    } as any);

    const res = await request(app).get('/api/corridors/unknown-corridor/forecast');

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
  });

  it('returns forecasts sorted by forecast_for ascending', async () => {
    mockedQuery.mockResolvedValueOnce({
      rows: [{ corridor_id: 'us-101' }],
      rowCount: 1, command: 'SELECT', oid: 0, fields: [],
    } as any);
    mockedQuery.mockResolvedValueOnce({
      rows: [
        { corridor_id: 'us-101', forecast_for: '2026-03-21T08:00:00Z', predicted_minutes: 12, p10_minutes: 10, p50_minutes: 12, p90_minutes: 14, model_version: 'v1', weather_modifier: 1.0, event_modifier: 1.0, school_modifier: 1.0 },
        { corridor_id: 'us-101', forecast_for: '2026-03-21T09:00:00Z', predicted_minutes: 13, p10_minutes: 11, p50_minutes: 13, p90_minutes: 15, model_version: 'v1', weather_modifier: 1.0, event_modifier: 1.0, school_modifier: 1.0 },
      ],
      rowCount: 2, command: 'SELECT', oid: 0, fields: [],
    } as any);

    const res = await request(app).get('/api/corridors/us-101/forecast');

    // The SQL has ORDER BY forecast_for ASC, so the mock returns them in order
    // Verify the query has ORDER BY
    expect(mockedQuery).toHaveBeenCalledWith(
      expect.stringContaining('ORDER BY forecast_for ASC'),
      expect.any(Array)
    );
  });
});
