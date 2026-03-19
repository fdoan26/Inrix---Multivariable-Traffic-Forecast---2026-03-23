import { query } from '../connection.js';

export interface SchoolDayRow {
  date: string;
  schoolDay: boolean;
}

export interface EventRow {
  date: string;
  eventName: string;
  eventType: string;
}

export async function upsertSchoolDays(rows: SchoolDayRow[]): Promise<number> {
  if (rows.length === 0) return 0;

  const values: unknown[] = [];
  const placeholders: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const offset = i * 2;
    placeholders.push(`($${offset + 1}, $${offset + 2})`);
    values.push(rows[i].date, rows[i].schoolDay);
  }

  const sql = `
    INSERT INTO calendar_flags (flag_date, school_day)
    VALUES ${placeholders.join(', ')}
    ON CONFLICT (flag_date) DO UPDATE SET school_day = EXCLUDED.school_day
  `;

  const result = await query(sql, values);
  return result.rowCount ?? rows.length;
}

export async function upsertEvents(rows: EventRow[]): Promise<number> {
  if (rows.length === 0) return 0;

  const values: unknown[] = [];
  const placeholders: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const offset = i * 3;
    placeholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3})`);
    values.push(rows[i].date, rows[i].eventName, rows[i].eventType);
  }

  const sql = `
    INSERT INTO calendar_flags (flag_date, event_name, event_type)
    VALUES ${placeholders.join(', ')}
    ON CONFLICT (flag_date) DO UPDATE SET
      event_name = EXCLUDED.event_name,
      event_type = EXCLUDED.event_type
  `;

  const result = await query(sql, values);
  return result.rowCount ?? rows.length;
}
