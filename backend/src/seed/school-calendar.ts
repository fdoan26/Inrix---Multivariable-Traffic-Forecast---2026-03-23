import { parse } from 'csv-parse/sync';
import fs from 'node:fs';
import path from 'node:path';
import { upsertSchoolDays } from '../db/queries/calendar.js';
import type { SchoolDayRow } from '../db/queries/calendar.js';

export async function seedSchoolCalendar(csvPath?: string): Promise<number> {
  const filePath = csvPath ?? path.resolve(__dirname, '../../data/sfusd-calendar.csv');
  const content = fs.readFileSync(filePath, 'utf-8');

  const records: Array<{ date: string; school_day: string }> = parse(content, {
    columns: true,
    trim: true,
  });

  const rows: SchoolDayRow[] = records.map((r) => ({
    date: r.date,
    schoolDay: r.school_day === 'true',
  }));

  const count = await upsertSchoolDays(rows);
  console.log(`Seeded ${count} school calendar days`);
  return count;
}

// Allow running as a script
if (require.main === module) {
  seedSchoolCalendar()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
