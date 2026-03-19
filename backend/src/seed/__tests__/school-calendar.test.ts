import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

vi.mock('../../db/queries/calendar.js', () => ({
  upsertSchoolDays: vi.fn().mockResolvedValue(3),
}));

import { seedSchoolCalendar } from '../school-calendar.js';
import { upsertSchoolDays } from '../../db/queries/calendar.js';

describe('seedSchoolCalendar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('parses CSV and calls upsertSchoolDays with correct rows', async () => {
    const csvContent = 'date,school_day\n2026-03-19,true\n2026-03-20,true\n2026-03-21,false\n';
    const tmpDir = path.join(process.cwd(), 'tmp-test');
    fs.mkdirSync(tmpDir, { recursive: true });
    const tmpFile = path.join(tmpDir, 'test-calendar.csv');
    fs.writeFileSync(tmpFile, csvContent);

    try {
      const count = await seedSchoolCalendar(tmpFile);

      expect(count).toBe(3);
      expect(upsertSchoolDays).toHaveBeenCalledOnce();
      const rows = vi.mocked(upsertSchoolDays).mock.calls[0][0];
      expect(rows).toHaveLength(3);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('maps school_day string to boolean correctly', async () => {
    const csvContent = 'date,school_day\n2026-03-19,true\n2026-03-21,false\n';
    const tmpDir = path.join(process.cwd(), 'tmp-test');
    fs.mkdirSync(tmpDir, { recursive: true });
    const tmpFile = path.join(tmpDir, 'test-calendar.csv');
    fs.writeFileSync(tmpFile, csvContent);

    try {
      await seedSchoolCalendar(tmpFile);

      const rows = vi.mocked(upsertSchoolDays).mock.calls[0][0];
      expect(rows[0].schoolDay).toBe(true);
      expect(rows[1].schoolDay).toBe(false);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('preserves date in YYYY-MM-DD format', async () => {
    const csvContent = 'date,school_day\n2026-03-19,true\n';
    const tmpDir = path.join(process.cwd(), 'tmp-test');
    fs.mkdirSync(tmpDir, { recursive: true });
    const tmpFile = path.join(tmpDir, 'test-calendar.csv');
    fs.writeFileSync(tmpFile, csvContent);

    try {
      await seedSchoolCalendar(tmpFile);

      const rows = vi.mocked(upsertSchoolDays).mock.calls[0][0];
      expect(rows[0].date).toBe('2026-03-19');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
