import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the db connection module
vi.mock('../../db/connection.js', () => ({
  query: vi.fn(),
}));

import { checkBudget, recordCall, updateCallStatus, WEEKLY_LIMIT } from '../budget-tracker.js';
import { query } from '../../db/connection.js';

const mockedQuery = vi.mocked(query);

describe('Budget Tracker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('WEEKLY_LIMIT', () => {
    it('defaults to 1600', () => {
      expect(WEEKLY_LIMIT).toBe(1600);
    });
  });

  describe('checkBudget', () => {
    it('returns allowed:true when weekly count is 0', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [{ count: 0 }] } as never);
      const result = await checkBudget();
      expect(result).toEqual({ allowed: true, count: 0 });
    });

    it('returns allowed:false when count equals 1600', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [{ count: 1600 }] } as never);
      const result = await checkBudget();
      expect(result).toEqual({ allowed: false, count: 1600 });
    });

    it('returns allowed:false when count exceeds 1600', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [{ count: 1601 }] } as never);
      const result = await checkBudget();
      expect(result).toEqual({ allowed: false, count: 1601 });
    });

    it('returns allowed:true when count is 1599', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [{ count: 1599 }] } as never);
      const result = await checkBudget();
      expect(result).toEqual({ allowed: true, count: 1599 });
    });
  });

  describe('recordCall', () => {
    it('inserts a row with status pending and returns the id', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [{ id: 42 }] } as never);
      const id = await recordCall('inrix_speeds', '/v1/segments/speed');
      expect(id).toBe(42);
      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO api_call_log'),
        expect.arrayContaining(['inrix_speeds', '/v1/segments/speed', 'pending'])
      );
    });
  });

  describe('updateCallStatus', () => {
    it('updates the correct row with status and metadata', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [] } as never);
      await updateCallStatus(42, 'success', 200, 150);
      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE api_call_log'),
        expect.arrayContaining(['success', 200, 150, undefined, 42])
      );
    });

    it('updates with error status and message', async () => {
      mockedQuery.mockResolvedValueOnce({ rows: [] } as never);
      await updateCallStatus(42, 'error', 500, 2000, 'Internal server error');
      expect(mockedQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE api_call_log'),
        expect.arrayContaining(['error', 500, 2000, 'Internal server error', 42])
      );
    });
  });
});
