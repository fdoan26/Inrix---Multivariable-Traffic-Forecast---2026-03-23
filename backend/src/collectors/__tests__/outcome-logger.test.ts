import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../db/connection.js', () => ({
  query: vi.fn(),
}));

import { query } from '../../db/connection.js';
import { logOutcomes } from '../outcome-logger.js';

const mockedQuery = vi.mocked(query);

describe('logOutcomes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('inserts outcomes for unprocessed forecasts', async () => {
    mockedQuery.mockResolvedValueOnce({
      rows: [],
      rowCount: 5,
      command: 'INSERT',
      oid: 0,
      fields: [],
    } as any);

    const result = await logOutcomes();
    expect(result.inserted).toBe(5);
    expect(mockedQuery).toHaveBeenCalledTimes(1);
  });

  it('returns inserted: 0 when no unprocessed forecasts exist', async () => {
    mockedQuery.mockResolvedValueOnce({
      rows: [],
      rowCount: 0,
      command: 'INSERT',
      oid: 0,
      fields: [],
    } as any);

    const result = await logOutcomes();
    expect(result.inserted).toBe(0);
  });

  it('SQL contains INSERT INTO forecast_outcomes and CROSS JOIN LATERAL and ON CONFLICT', async () => {
    mockedQuery.mockResolvedValueOnce({
      rows: [],
      rowCount: 0,
      command: 'INSERT',
      oid: 0,
      fields: [],
    } as any);

    await logOutcomes();

    const sql = mockedQuery.mock.calls[0][0] as string;
    expect(sql).toContain('INSERT INTO forecast_outcomes');
    expect(sql).toContain('CROSS JOIN LATERAL');
    expect(sql).toContain('ON CONFLICT (corridor_id, forecast_for) DO NOTHING');
  });

  it('SQL contains HAVING COUNT(DISTINCT segment_id) for segment coverage validation', async () => {
    mockedQuery.mockResolvedValueOnce({
      rows: [],
      rowCount: 0,
      command: 'INSERT',
      oid: 0,
      fields: [],
    } as any);

    await logOutcomes();

    const sql = mockedQuery.mock.calls[0][0] as string;
    expect(sql).toContain('HAVING COUNT(DISTINCT');
  });
});
