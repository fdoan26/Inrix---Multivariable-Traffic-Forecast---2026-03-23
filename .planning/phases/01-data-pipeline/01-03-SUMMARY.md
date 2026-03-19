---
phase: 01-data-pipeline
plan: 03
subsystem: seed, worker, database
tags: [csv-parse, zod, node-cron, tsx, typescript, timescaledb]

# Dependency graph
requires:
  - phase: 01-data-pipeline/01-01
    provides: "DB connection singleton, TimescaleDB schema with calendar_flags table"
  - phase: 01-data-pipeline/01-02
    provides: "collectSpeeds, collectIncidents, collectWeather collector functions, InrixAuthService"
provides:
  - "School calendar CSV seed script (seedSchoolCalendar) parsing SFUSD calendar into calendar_flags"
  - "Event JSON seed script (seedEvents) with Zod validation loading events into calendar_flags"
  - "Calendar upsert queries (upsertSchoolDays, upsertEvents) with ON CONFLICT handling"
  - "Sample SFUSD calendar data (121 rows, Mar-Jun 2026)"
  - "Sample event data (22 entries: Giants, Warriors, Outside Lands, concerts)"
  - "Worker process entry point with cron-scheduled speed/incident/weather collection"
affects: [02-forecasting-model]

# Tech tracking
tech-stack:
  added: [csv-parse@6.2.0, tsx@4.21.0, "@types/node-cron@3.0.11"]
  patterns: [CSV seed with csv-parse/sync, JSON seed with Zod array validation, cron job overlap prevention]

key-files:
  created:
    - backend/src/db/queries/calendar.ts
    - backend/src/seed/school-calendar.ts
    - backend/src/seed/events.ts
    - backend/src/seed/__tests__/school-calendar.test.ts
    - backend/src/seed/__tests__/events.test.ts
    - backend/data/sfusd-calendar.csv
    - backend/data/events.json
    - backend/src/worker.ts
  modified:
    - backend/package.json

key-decisions:
  - "Used csv-parse/sync for CSV parsing per RESEARCH.md 'Don't Hand-Roll' recommendation"
  - "Worker createJob wrapper uses promise chain (.then/.catch/.finally) instead of async callback to avoid unhandled rejection in cron"

patterns-established:
  - "Seed script pattern: parse file -> validate -> map to DB row type -> upsert -> log count"
  - "Cron job overlap prevention: boolean running flag checked before each execution"

requirements-completed: [DATA-06, DATA-07]

# Metrics
duration: 4min
completed: 2026-03-19
---

# Phase 1 Plan 03: Calendar/Event Seeds and Worker Process Summary

**SFUSD school calendar CSV parser, Zod-validated event seed loader, and node-cron worker scheduling speeds/incidents/weather collection with overlap prevention**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-19T21:05:26Z
- **Completed:** 2026-03-19T21:09:12Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Built school calendar seed script parsing CSV (csv-parse/sync) into calendar_flags with boolean school_day mapping
- Built event seed script with Zod validation loading JSON events (Giants, Warriors, concerts, festivals) into calendar_flags
- Created calendar upsert queries with INSERT ON CONFLICT (flag_date) DO UPDATE for both school days and events
- Created realistic sample data: 121-row SFUSD calendar (Mar-Jun 2026) and 22-entry event file
- Built worker.ts entry point scheduling all three collectors via node-cron with overlap prevention and graceful shutdown
- 6 new seed tests (TDD), 51 total tests passing

## Task Commits

Each task was committed atomically:

1. **Task 1: School calendar and event seed scripts with sample data** - `7a89642` (feat)
2. **Task 2: Worker process entry point with cron scheduling** - `a177786` (feat)

## Files Created/Modified
- `backend/src/db/queries/calendar.ts` - Upsert functions for calendar_flags (school days and events)
- `backend/src/seed/school-calendar.ts` - CSV parser and DB loader for SFUSD calendar
- `backend/src/seed/events.ts` - JSON parser with Zod validation and DB loader for events
- `backend/src/seed/__tests__/school-calendar.test.ts` - 3 tests: CSV parsing, boolean mapping, date format
- `backend/src/seed/__tests__/events.test.ts` - 3 tests: JSON parsing, event_type preservation, Zod rejection
- `backend/data/sfusd-calendar.csv` - 121 rows of school calendar data (Mar-Jun 2026)
- `backend/data/events.json` - 22 events (Giants, Warriors, Outside Lands, concerts)
- `backend/src/worker.ts` - Cron-scheduled worker: speeds/15min, incidents/30min, weather/daily
- `backend/package.json` - Added csv-parse, tsx, @types/node-cron; seed and worker scripts

## Decisions Made
- Used csv-parse/sync for school calendar CSV parsing (per RESEARCH.md "Don't Hand-Roll" table)
- Worker createJob uses promise chain pattern to avoid async callback issues with node-cron
- Added tsx as dev dependency for running TypeScript scripts directly (seed and worker)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing TypeScript errors in collector test files (from Plan 01-02) due to untyped axios mocks -- these are out of scope and do not affect runtime behavior (all 51 tests pass)

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All Phase 1 data pipeline components complete: DB schema, auth, budget tracker, retry, collectors, seeds, worker
- Calendar_flags table ready for model training feature joins in Phase 2
- Worker process ready to be deployed alongside API server for scheduled data collection
- Sample data files available for local development and testing

## Self-Check: PASSED

All 8 created files verified present. Both task commits (7a89642, a177786) verified in git log. 51/51 tests passing.

---
*Phase: 01-data-pipeline*
*Completed: 2026-03-19*
