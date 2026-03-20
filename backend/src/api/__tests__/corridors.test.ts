import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

vi.mock('../../db/connection.js', () => ({
  query: vi.fn(),
}));

import { query } from '../../db/connection.js';
const mockedQuery = vi.mocked(query);

// Import app after mocks are set up
import { app } from '../index.js';

describe('GET /api/corridors/:corridorId/current', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 with corridor data including segments', async () => {
    // First call: corridor lookup
    mockedQuery.mockResolvedValueOnce({
      rows: [{ corridor_id: 'us-101', display_name: 'US 101', segment_ids: ['seg-001', 'seg-002'] }],
      rowCount: 1, command: 'SELECT', oid: 0, fields: [],
    } as any);
    // Second call: speed readings
    mockedQuery.mockResolvedValueOnce({
      rows: [
        { segment_id: 'seg-001', speed: 45, congestion_score: 1, travel_time_min: 2.5, recorded_at: '2026-03-20T00:00:00Z' },
        { segment_id: 'seg-002', speed: 30, congestion_score: 2, travel_time_min: 3.8, recorded_at: '2026-03-20T00:00:00Z' },
      ],
      rowCount: 2, command: 'SELECT', oid: 0, fields: [],
    } as any);

    const res = await request(app).get('/api/corridors/us-101/current');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('corridor_id', 'us-101');
    expect(res.body).toHaveProperty('display_name', 'US 101');
    expect(res.body).toHaveProperty('congestion_level');
    expect(res.body).toHaveProperty('avg_travel_time_min');
    expect(res.body.segments).toHaveLength(2);
  });

  it('returns segments with segment_id, speed, congestion_score, travel_time_min', async () => {
    mockedQuery.mockResolvedValueOnce({
      rows: [{ corridor_id: 'us-101', display_name: 'US 101', segment_ids: ['seg-001'] }],
      rowCount: 1, command: 'SELECT', oid: 0, fields: [],
    } as any);
    mockedQuery.mockResolvedValueOnce({
      rows: [
        { segment_id: 'seg-001', speed: 45, congestion_score: 1, travel_time_min: 2.5, recorded_at: '2026-03-20T00:00:00Z' },
      ],
      rowCount: 1, command: 'SELECT', oid: 0, fields: [],
    } as any);

    const res = await request(app).get('/api/corridors/us-101/current');

    const seg = res.body.segments[0];
    expect(seg).toHaveProperty('segment_id', 'seg-001');
    expect(seg).toHaveProperty('speed', 45);
    expect(seg).toHaveProperty('congestion_score', 1);
    expect(seg).toHaveProperty('travel_time_min', 2.5);
  });

  it('returns 404 for unknown corridor', async () => {
    mockedQuery.mockResolvedValueOnce({
      rows: [], rowCount: 0, command: 'SELECT', oid: 0, fields: [],
    } as any);

    const res = await request(app).get('/api/corridors/unknown-corridor/current');

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
  });

  it('returns congestion_level "free_flow" when avg congestion_score <= 1', async () => {
    mockedQuery.mockResolvedValueOnce({
      rows: [{ corridor_id: 'us-101', display_name: 'US 101', segment_ids: ['seg-001'] }],
      rowCount: 1, command: 'SELECT', oid: 0, fields: [],
    } as any);
    mockedQuery.mockResolvedValueOnce({
      rows: [
        { segment_id: 'seg-001', speed: 60, congestion_score: 0, travel_time_min: 1.5, recorded_at: '2026-03-20T00:00:00Z' },
      ],
      rowCount: 1, command: 'SELECT', oid: 0, fields: [],
    } as any);

    const res = await request(app).get('/api/corridors/us-101/current');
    expect(res.body.congestion_level).toBe('free_flow');
  });

  it('returns congestion_level "moderate" when avg congestion_score is around 2', async () => {
    mockedQuery.mockResolvedValueOnce({
      rows: [{ corridor_id: 'us-101', display_name: 'US 101', segment_ids: ['seg-001'] }],
      rowCount: 1, command: 'SELECT', oid: 0, fields: [],
    } as any);
    mockedQuery.mockResolvedValueOnce({
      rows: [
        { segment_id: 'seg-001', speed: 35, congestion_score: 2, travel_time_min: 3.0, recorded_at: '2026-03-20T00:00:00Z' },
      ],
      rowCount: 1, command: 'SELECT', oid: 0, fields: [],
    } as any);

    const res = await request(app).get('/api/corridors/us-101/current');
    expect(res.body.congestion_level).toBe('moderate');
  });

  it('returns congestion_level "heavy" when avg congestion_score > 2', async () => {
    mockedQuery.mockResolvedValueOnce({
      rows: [{ corridor_id: 'us-101', display_name: 'US 101', segment_ids: ['seg-001'] }],
      rowCount: 1, command: 'SELECT', oid: 0, fields: [],
    } as any);
    mockedQuery.mockResolvedValueOnce({
      rows: [
        { segment_id: 'seg-001', speed: 15, congestion_score: 3, travel_time_min: 5.0, recorded_at: '2026-03-20T00:00:00Z' },
      ],
      rowCount: 1, command: 'SELECT', oid: 0, fields: [],
    } as any);

    const res = await request(app).get('/api/corridors/us-101/current');
    expect(res.body.congestion_level).toBe('heavy');
  });
});
