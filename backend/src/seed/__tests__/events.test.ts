import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

vi.mock('../../db/queries/calendar.js', () => ({
  upsertEvents: vi.fn().mockResolvedValue(2),
}));

import { seedEvents } from '../events.js';
import { upsertEvents } from '../../db/queries/calendar.js';

describe('seedEvents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('parses JSON and calls upsertEvents with correct EventRow objects', async () => {
    const events = [
      { date: '2026-04-10', event_name: 'Giants vs Dodgers', event_type: 'giants' },
      { date: '2026-04-12', event_name: 'Warriors vs Lakers', event_type: 'warriors' },
    ];
    const tmpDir = path.join(process.cwd(), 'tmp-test');
    fs.mkdirSync(tmpDir, { recursive: true });
    const tmpFile = path.join(tmpDir, 'test-events.json');
    fs.writeFileSync(tmpFile, JSON.stringify(events));

    try {
      const count = await seedEvents(tmpFile);

      expect(count).toBe(2);
      expect(upsertEvents).toHaveBeenCalledOnce();
      const rows = vi.mocked(upsertEvents).mock.calls[0][0];
      expect(rows).toHaveLength(2);
      expect(rows[0]).toEqual({
        date: '2026-04-10',
        eventName: 'Giants vs Dodgers',
        eventType: 'giants',
      });
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('preserves event_type values', async () => {
    const events = [
      { date: '2026-08-07', event_name: 'Outside Lands 2026', event_type: 'festival' },
      { date: '2026-06-15', event_name: 'Taylor Swift at Chase Center', event_type: 'concert' },
    ];
    const tmpDir = path.join(process.cwd(), 'tmp-test');
    fs.mkdirSync(tmpDir, { recursive: true });
    const tmpFile = path.join(tmpDir, 'test-events.json');
    fs.writeFileSync(tmpFile, JSON.stringify(events));

    try {
      await seedEvents(tmpFile);

      const rows = vi.mocked(upsertEvents).mock.calls[0][0];
      expect(rows[0].eventType).toBe('festival');
      expect(rows[1].eventType).toBe('concert');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('rejects invalid JSON shape via zod validation', async () => {
    const events = [
      { date: '2026-04-10', wrong_field: 'Giants vs Dodgers' },
    ];
    const tmpDir = path.join(process.cwd(), 'tmp-test');
    fs.mkdirSync(tmpDir, { recursive: true });
    const tmpFile = path.join(tmpDir, 'test-events.json');
    fs.writeFileSync(tmpFile, JSON.stringify(events));

    try {
      await expect(seedEvents(tmpFile)).rejects.toThrow();
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
