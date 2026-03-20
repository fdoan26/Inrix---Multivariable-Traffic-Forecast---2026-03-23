import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

vi.mock('../../db/connection.js', () => ({
  query: vi.fn(),
}));

import { query } from '../../db/connection.js';
const mockedQuery = vi.mocked(query);

import { app } from '../index.js';

describe('Error middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 500 with JSON error for unhandled route errors', async () => {
    mockedQuery.mockRejectedValueOnce(new Error('DB connection failed'));

    const res = await request(app).get('/api/corridors/us-101/current');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Internal server error' });
  });

  it('returns application/json content-type on error', async () => {
    mockedQuery.mockRejectedValueOnce(new Error('DB connection failed'));

    const res = await request(app).get('/api/corridors/us-101/current');

    expect(res.headers['content-type']).toMatch(/application\/json/);
  });
});
