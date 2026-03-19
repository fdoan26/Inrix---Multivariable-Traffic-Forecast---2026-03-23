import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { upsertEvents } from '../db/queries/calendar.js';
import type { EventRow } from '../db/queries/calendar.js';

const EventSchema = z.array(
  z.object({
    date: z.string(),
    event_name: z.string(),
    event_type: z.string(),
  })
);

export async function seedEvents(jsonPath?: string): Promise<number> {
  const filePath = jsonPath ?? path.resolve(__dirname, '../../data/events.json');
  const content = fs.readFileSync(filePath, 'utf-8');
  const raw = JSON.parse(content);

  const parsed = EventSchema.parse(raw);

  const rows: EventRow[] = parsed.map((item) => ({
    date: item.date,
    eventName: item.event_name,
    eventType: item.event_type,
  }));

  const count = await upsertEvents(rows);
  console.log(`Seeded ${count} events`);
  return count;
}

// Allow running as a script
if (require.main === module) {
  seedEvents()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
