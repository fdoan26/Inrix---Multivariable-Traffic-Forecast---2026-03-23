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
import { deriveTrend } from '../accuracy.js';

function mockResult(rows: unknown[]) {
  return { rows, rowCount: rows.length, command: 'SELECT' as const, oid: 0, fields: [] } as any;
}

describe('GET /api/accuracy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedCacheGet.mockReturnValue(undefined);
  });

  it('returns 200 with generated_at and corridors array', async () => {
    // Main aggregation
    mockedQuery.mockResolvedValueOnce(mockResult([
      { corridor_id: 'us-101', sample_count: 42, mae_minutes: 3.2, mape_pct: 8.5 },
    ]));
    // Trend
    mockedQuery.mockResolvedValueOnce(mockResult([
      { corridor_id: 'us-101', recent_mape: 7.5, prior_mape: 9.0 },
    ]));
    // Day-of-week
    mockedQuery.mockResolvedValueOnce(mockResult([
      { corridor_id: 'us-101', day: 1, count: 6, mae_minutes: 2.8, mape_pct: 7.2 },
    ]));

    const res = await request(app).get('/api/accuracy');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('generated_at');
    expect(res.body.corridors).toHaveLength(1);

    const c = res.body.corridors[0];
    expect(c.corridor_id).toBe('us-101');
    expect(c.display_name).toBe('US-101');
    expect(c.sample_count).toBe(42);
    expect(c.mae_minutes).toBe(3.2);
    expect(c.mape_pct).toBe(8.5);
    expect(c.trend).toBe('improving');
    expect(c.by_day_of_week).toHaveLength(1);
    expect(c.by_day_of_week[0].day_name).toBe('Monday');
  });

  it('filters to single corridor with corridor_id query param', async () => {
    mockedQuery.mockResolvedValueOnce(mockResult([
      { corridor_id: 'us-101', sample_count: 10, mae_minutes: 2.0, mape_pct: 5.0 },
    ]));
    mockedQuery.mockResolvedValueOnce(mockResult([
      { corridor_id: 'us-101', recent_mape: 5.0, prior_mape: 5.0 },
    ]));
    mockedQuery.mockResolvedValueOnce(mockResult([]));

    const res = await request(app).get('/api/accuracy?corridor_id=us-101');

    expect(res.status).toBe(200);
    expect(res.body.corridors).toHaveLength(1);
    expect(res.body.corridors[0].corridor_id).toBe('us-101');

    // All 3 queries should have been called with 'us-101'
    expect(mockedQuery.mock.calls[0][1]).toEqual(['us-101']);
    expect(mockedQuery.mock.calls[1][1]).toEqual(['us-101']);
    expect(mockedQuery.mock.calls[2][1]).toEqual(['us-101']);
  });

  it('returns empty corridors array when no outcomes exist', async () => {
    mockedQuery.mockResolvedValueOnce(mockResult([]));
    mockedQuery.mockResolvedValueOnce(mockResult([]));
    mockedQuery.mockResolvedValueOnce(mockResult([]));

    const res = await request(app).get('/api/accuracy');

    expect(res.status).toBe(200);
    expect(res.body.corridors).toHaveLength(0);
    expect(res.body).toHaveProperty('generated_at');
  });

  it('serves cached response when cacheGet returns data', async () => {
    const cachedData = { generated_at: '2026-03-20T12:00:00Z', corridors: [] };
    mockedCacheGet.mockReturnValue(cachedData);

    const res = await request(app).get('/api/accuracy');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(cachedData);
    expect(mockedQuery).not.toHaveBeenCalled();
  });

  it('calls cacheSet with 1 hour TTL after DB query', async () => {
    mockedQuery.mockResolvedValueOnce(mockResult([]));
    mockedQuery.mockResolvedValueOnce(mockResult([]));
    mockedQuery.mockResolvedValueOnce(mockResult([]));

    await request(app).get('/api/accuracy');

    expect(mockedCacheSet).toHaveBeenCalledWith(
      'accuracy:all',
      expect.objectContaining({ generated_at: expect.any(String), corridors: [] }),
      60 * 60 * 1000,
    );
  });
});

describe('deriveTrend', () => {
  it('returns "improving" when recent_mape < prior_mape * 0.95', () => {
    expect(deriveTrend(7.5, 9.0)).toBe('improving');
  });

  it('returns "degrading" when recent_mape > prior_mape * 1.05', () => {
    expect(deriveTrend(10.0, 9.0)).toBe('degrading');
  });

  it('returns "stable" when within 5% threshold', () => {
    expect(deriveTrend(9.0, 9.0)).toBe('stable');
  });

  it('returns "stable" when recent is null', () => {
    expect(deriveTrend(null, 9.0)).toBe('stable');
  });

  it('returns "stable" when prior is null', () => {
    expect(deriveTrend(7.5, null)).toBe('stable');
  });

  it('returns "stable" when prior is 0', () => {
    expect(deriveTrend(7.5, 0)).toBe('stable');
  });
});
