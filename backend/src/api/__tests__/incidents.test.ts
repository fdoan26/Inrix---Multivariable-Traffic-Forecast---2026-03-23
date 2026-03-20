import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

vi.mock('../../db/connection.js', () => ({
  query: vi.fn(),
}));

import { query } from '../../db/connection.js';
const mockedQuery = vi.mocked(query);

// Import app after mocks are set up
import { app } from '../index.js';

describe('GET /api/incidents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 with incidents array', async () => {
    mockedQuery.mockResolvedValueOnce({
      rows: [
        {
          incident_id: 'inc-001',
          incident_type: 4,
          severity: 3,
          latitude: 37.78,
          longitude: -122.42,
          short_desc: 'Vehicle collision on US-101 NB',
          long_desc: null,
          delay_from_typical_min: 12.5,
          recorded_at: '2026-03-20T06:00:00Z',
          status: 'Active',
        },
      ],
      rowCount: 1, command: 'SELECT', oid: 0, fields: [],
    } as any);

    const res = await request(app).get('/api/incidents');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('incidents');
    expect(Array.isArray(res.body.incidents)).toBe(true);
    expect(res.body.incidents).toHaveLength(1);
  });

  it('returns expected fields for each incident', async () => {
    mockedQuery.mockResolvedValueOnce({
      rows: [
        {
          incident_id: 'inc-001',
          incident_type: 4,
          severity: 3,
          latitude: 37.78,
          longitude: -122.42,
          short_desc: 'Vehicle collision on US-101 NB',
          long_desc: 'Multi-vehicle accident blocking right lane',
          delay_from_typical_min: 12.5,
          recorded_at: '2026-03-20T06:00:00Z',
          status: 'Active',
        },
      ],
      rowCount: 1, command: 'SELECT', oid: 0, fields: [],
    } as any);

    const res = await request(app).get('/api/incidents');
    const incident = res.body.incidents[0];

    expect(incident).toHaveProperty('incident_id', 'inc-001');
    expect(incident).toHaveProperty('incident_type', 4);
    expect(incident).toHaveProperty('severity', 3);
    expect(incident).toHaveProperty('latitude', 37.78);
    expect(incident).toHaveProperty('longitude', -122.42);
    expect(incident).toHaveProperty('short_desc');
    expect(incident).toHaveProperty('delay_from_typical_min', 12.5);
    expect(incident).toHaveProperty('recorded_at');
    expect(incident).toHaveProperty('status', 'Active');
  });

  it('returns empty array when no incidents', async () => {
    mockedQuery.mockResolvedValueOnce({
      rows: [],
      rowCount: 0, command: 'SELECT', oid: 0, fields: [],
    } as any);

    const res = await request(app).get('/api/incidents');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ incidents: [] });
  });

  it('SQL query filters by 24-hour window and non-Cleared status', async () => {
    mockedQuery.mockResolvedValueOnce({
      rows: [],
      rowCount: 0, command: 'SELECT', oid: 0, fields: [],
    } as any);

    await request(app).get('/api/incidents');

    expect(mockedQuery).toHaveBeenCalledOnce();
    const sqlArg = mockedQuery.mock.calls[0][0] as string;
    expect(sqlArg).toContain("NOW() - INTERVAL '24 hours'");
    expect(sqlArg).toContain("status != 'Cleared'");
    expect(sqlArg).toContain('ORDER BY recorded_at DESC');
    expect(sqlArg).toContain('LIMIT 100');
  });
});
