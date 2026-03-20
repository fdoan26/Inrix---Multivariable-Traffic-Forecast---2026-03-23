import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

vi.mock('../../db/connection.js', () => ({
  query: vi.fn(),
}));

vi.mock('../../services/cache.js', () => ({
  cacheGet: vi.fn(),
  cacheSet: vi.fn(),
  cacheClear: vi.fn(),
}));

import { query } from '../../db/connection.js';
import { cacheGet, cacheSet } from '../../services/cache.js';
const mockedQuery = vi.mocked(query);
const mockedCacheGet = vi.mocked(cacheGet);
const mockedCacheSet = vi.mocked(cacheSet);

import { app } from '../index.js';

const ARRIVAL = '2026-03-25T09:00:00Z';
const BASE_URL = '/api/corridors/us-101/departure-windows';

// Helper to build a mock QueryResult
function mockResult(rows: unknown[]) {
  return {
    rows,
    rowCount: rows.length,
    command: 'SELECT' as const,
    oid: 0,
    fields: [],
  } as any;
}

// Two forecast rows with different characteristics
const ROW_NO_MODIFIERS = {
  forecast_for: '2026-03-25T08:00:00Z',
  predicted_minutes: 12,
  p10_minutes: 10,
  p50_minutes: 12,
  p90_minutes: 15,
  weather_modifier: null,
  event_modifier: null,
  school_modifier: null,
};

const ROW_WITH_MODIFIERS = {
  forecast_for: '2026-03-25T09:00:00Z',
  predicted_minutes: 18,
  p10_minutes: 10,
  p50_minutes: 18,
  p90_minutes: 25,
  weather_modifier: 1.15,
  event_modifier: 1.1,
  school_modifier: null,
};

describe('GET /api/corridors/:corridorId/departure-windows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedCacheGet.mockReturnValue(undefined); // cache miss by default
  });

  it('returns 200 with departure windows sorted by p50_minutes', async () => {
    mockedQuery.mockResolvedValueOnce(mockResult([{ corridor_id: 'us-101' }]));
    mockedQuery.mockResolvedValueOnce(mockResult([ROW_NO_MODIFIERS, ROW_WITH_MODIFIERS]));

    const res = await request(app).get(`${BASE_URL}?arrival=${ARRIVAL}`);

    expect(res.status).toBe(200);
    expect(res.body.corridor_id).toBe('us-101');
    expect(res.body.arrival_target).toBe(ARRIVAL);
    expect(res.body.windows).toHaveLength(2);
    // Sorted by p50 ASC: row1 (12) before row2 (18)
    expect(res.body.windows[0].estimated_travel_min).toBe(12);
    expect(res.body.windows[1].estimated_travel_min).toBe(18);
  });

  it('returns correct response shape for each window', async () => {
    mockedQuery.mockResolvedValueOnce(mockResult([{ corridor_id: 'us-101' }]));
    mockedQuery.mockResolvedValueOnce(mockResult([ROW_NO_MODIFIERS]));

    const res = await request(app).get(`${BASE_URL}?arrival=${ARRIVAL}`);

    const w = res.body.windows[0];
    expect(w).toHaveProperty('departure_at');
    expect(w).toHaveProperty('estimated_travel_min');
    expect(w).toHaveProperty('p10_minutes');
    expect(w).toHaveProperty('p90_minutes');
    expect(w).toHaveProperty('congestion_risk');
    expect(w).toHaveProperty('reason');
  });

  it('computes departure_at as forecast_for minus p50_minutes', async () => {
    mockedQuery.mockResolvedValueOnce(mockResult([{ corridor_id: 'us-101' }]));
    mockedQuery.mockResolvedValueOnce(mockResult([ROW_NO_MODIFIERS]));

    const res = await request(app).get(`${BASE_URL}?arrival=${ARRIVAL}`);

    const w = res.body.windows[0];
    // forecast_for = 2026-03-25T08:00:00Z, p50_minutes = 12
    // departure_at = 08:00 - 12min = 07:48:00Z
    expect(w.departure_at).toBe('2026-03-25T07:48:00.000Z');
  });

  it('derives congestion_risk as "free_flow" when p50/p10 ratio <= 1.2', async () => {
    const freeFlowRow = { ...ROW_NO_MODIFIERS, p10_minutes: 10, p50_minutes: 12 };
    mockedQuery.mockResolvedValueOnce(mockResult([{ corridor_id: 'us-101' }]));
    mockedQuery.mockResolvedValueOnce(mockResult([freeFlowRow]));

    const res = await request(app).get(`${BASE_URL}?arrival=${ARRIVAL}`);

    // 12/10 = 1.2 => free_flow (ratio <= 1.2)
    expect(res.body.windows[0].congestion_risk).toBe('free_flow');
  });

  it('derives congestion_risk as "moderate" when p50/p10 ratio <= 1.5', async () => {
    const moderateRow = { ...ROW_NO_MODIFIERS, p10_minutes: 10, p50_minutes: 14 };
    mockedQuery.mockResolvedValueOnce(mockResult([{ corridor_id: 'us-101' }]));
    mockedQuery.mockResolvedValueOnce(mockResult([moderateRow]));

    const res = await request(app).get(`${BASE_URL}?arrival=${ARRIVAL}`);

    // 14/10 = 1.4 => moderate
    expect(res.body.windows[0].congestion_risk).toBe('moderate');
  });

  it('derives congestion_risk as "heavy" when p50/p10 ratio > 1.5', async () => {
    mockedQuery.mockResolvedValueOnce(mockResult([{ corridor_id: 'us-101' }]));
    mockedQuery.mockResolvedValueOnce(mockResult([ROW_WITH_MODIFIERS]));

    const res = await request(app).get(`${BASE_URL}?arrival=${ARRIVAL}`);

    // 18/10 = 1.8 => heavy
    expect(res.body.windows[0].congestion_risk).toBe('heavy');
  });

  it('surfaces weather and event modifiers in reason field', async () => {
    mockedQuery.mockResolvedValueOnce(mockResult([{ corridor_id: 'us-101' }]));
    mockedQuery.mockResolvedValueOnce(mockResult([ROW_WITH_MODIFIERS]));

    const res = await request(app).get(`${BASE_URL}?arrival=${ARRIVAL}`);

    const reason = res.body.windows[0].reason;
    expect(reason).toContain('Weather: rain/fog forecast');
    expect(reason).toContain('Event: local event nearby');
    expect(reason).not.toContain('School');
  });

  it('returns reason as null when no modifiers are active', async () => {
    mockedQuery.mockResolvedValueOnce(mockResult([{ corridor_id: 'us-101' }]));
    mockedQuery.mockResolvedValueOnce(mockResult([ROW_NO_MODIFIERS]));

    const res = await request(app).get(`${BASE_URL}?arrival=${ARRIVAL}`);

    expect(res.body.windows[0].reason).toBeNull();
  });

  it('returns 400 for invalid arrival param (not ISO 8601)', async () => {
    const res = await request(app).get(`${BASE_URL}?arrival=not-a-date`);

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 400 for window_count of 0', async () => {
    const res = await request(app).get(`${BASE_URL}?arrival=${ARRIVAL}&window_count=0`);

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 400 for window_count of 51', async () => {
    const res = await request(app).get(`${BASE_URL}?arrival=${ARRIVAL}&window_count=51`);

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 400 for arrival more than 7 days out', async () => {
    const farFuture = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000).toISOString();
    const res = await request(app).get(`${BASE_URL}?arrival=${farFuture}`);

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('7 days');
  });

  it('returns 404 for unknown corridor', async () => {
    mockedQuery.mockResolvedValueOnce(mockResult([]));

    const res = await request(app).get(`/api/corridors/unknown-corridor/departure-windows?arrival=${ARRIVAL}`);

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
  });

  it('defaults window_count to 10 when not provided', async () => {
    mockedQuery.mockResolvedValueOnce(mockResult([{ corridor_id: 'us-101' }]));
    mockedQuery.mockResolvedValueOnce(mockResult([]));

    await request(app).get(`${BASE_URL}?arrival=${ARRIVAL}`);

    // Second query call should have LIMIT 10
    const secondCall = mockedQuery.mock.calls[1];
    expect(secondCall[1]).toContain(10);
  });

  it('returns cached data without DB query on cache hit', async () => {
    const cachedResponse = {
      corridor_id: 'us-101',
      arrival_target: ARRIVAL,
      windows: [{ departure_at: '2026-03-25T07:48:00.000Z', estimated_travel_min: 12, p10_minutes: 10, p90_minutes: 15, congestion_risk: 'free_flow', reason: null }],
    };
    mockedCacheGet.mockReturnValue(cachedResponse);

    const res = await request(app).get(`${BASE_URL}?arrival=${ARRIVAL}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(cachedResponse);
    expect(mockedQuery).not.toHaveBeenCalled();
  });

  it('sets cache after successful DB query', async () => {
    mockedQuery.mockResolvedValueOnce(mockResult([{ corridor_id: 'us-101' }]));
    mockedQuery.mockResolvedValueOnce(mockResult([ROW_NO_MODIFIERS]));

    await request(app).get(`${BASE_URL}?arrival=${ARRIVAL}`);

    expect(mockedCacheSet).toHaveBeenCalledTimes(1);
    expect(mockedCacheSet).toHaveBeenCalledWith(
      expect.stringContaining('us-101:departures:'),
      expect.objectContaining({ corridor_id: 'us-101', windows: expect.any(Array) }),
    );
  });
});
