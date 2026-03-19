---
phase: 01-data-pipeline
plan: 02
subsystem: collectors, database
tags: [inrix, open-meteo, axios, zod, timescaledb, vitest]

# Dependency graph
requires:
  - phase: 01-data-pipeline/01
    provides: "INRIX auth, budget tracker, retry utility, Zod schemas, DB connection"
provides:
  - "INRIX speed collector (collectSpeeds) fetching bounding-box endpoint with budget enforcement"
  - "INRIX incident collector (collectIncidents) fetching incident-api.inrix.com with type filter"
  - "Open-Meteo weather collector (collectWeather) fetching 7-day hourly forecast with upsert"
  - "DB query modules for speed_readings batch insert, incidents batch insert, weather_forecasts upsert"
  - "Job logging via logJobStart/logJobEnd for all collectors"
affects: [01-03-PLAN, 02-forecasting-model]

# Tech tracking
tech-stack:
  added: []
  patterns: [collector pattern with budget-check/record-call/fetch/validate/insert/log-job lifecycle, multi-row parameterized INSERT, ON CONFLICT upsert]

key-files:
  created:
    - backend/src/collectors/inrix-speeds.ts
    - backend/src/collectors/inrix-incidents.ts
    - backend/src/collectors/weather.ts
    - backend/src/db/queries/speed-readings.ts
    - backend/src/db/queries/incidents.ts
    - backend/src/db/queries/weather.ts
    - backend/src/db/queries/budget.ts
    - backend/src/collectors/__tests__/inrix-speeds.test.ts
    - backend/src/collectors/__tests__/inrix-incidents.test.ts
    - backend/src/collectors/__tests__/weather.test.ts
  modified: []

key-decisions:
  - "Collector lifecycle: logJobStart -> checkBudget -> recordCall -> withRetry(fetch) -> Zod parse -> batch insert -> updateCallStatus -> logJobEnd"
  - "Weather upsert uses ON CONFLICT (forecast_hour) DO UPDATE to prevent duplicate rows on re-fetch"
  - "Auth token invalidation on 401 happens inside retry loop so fresh token is acquired on next attempt"

patterns-established:
  - "Collector pattern: budget check -> record call -> fetch with retry -> Zod validate -> batch insert -> log result"
  - "Multi-row parameterized INSERT with dynamic placeholder generation (COLS_PER_ROW offset)"
  - "ON CONFLICT DO UPDATE upsert for idempotent weather forecast storage"

requirements-completed: [DATA-01, DATA-04, DATA-05]

# Metrics
duration: 3min
completed: 2026-03-19
---

# Phase 1 Plan 02: Data Collectors Summary

**Three data collectors (INRIX speeds, INRIX incidents, Open-Meteo weather) with Zod validation, budget enforcement, batch insert/upsert into TimescaleDB, and job logging -- 19 new tests, 45 total passing**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-19T20:59:32Z
- **Completed:** 2026-03-19T21:02:32Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Built INRIX speed collector fetching bounding-box endpoint at segment-api.inrix.com with SpeedOutputFields=All, Zod validation, and batch INSERT into speed_readings
- Built INRIX incident collector fetching incident-api.inrix.com with incidentType=Incidents,Construction,Events,Flow filter, Zod validation, and batch INSERT into incidents
- Built Open-Meteo weather collector fetching 7-day hourly forecast for SF coordinates, Zod validation, and upsert into weather_forecasts with ON CONFLICT handling
- All collectors enforce budget limits before INRIX calls, record API calls before HTTP requests, and log job start/end
- 19 new unit tests across 3 test files covering happy path, budget rejection, call ordering, 401 handling, field mapping, and fog detection

## Task Commits

Each task was committed atomically:

1. **Task 1: INRIX speed and incident collectors with DB queries** - `bd7ce11` (feat)
2. **Task 2: Open-Meteo weather collector with upsert and tests** - `8956fd9` (feat)

## Files Created/Modified
- `backend/src/collectors/inrix-speeds.ts` - INRIX bounding-box speed collection with budget enforcement and retry
- `backend/src/collectors/inrix-incidents.ts` - INRIX incident collection with type filter and retry
- `backend/src/collectors/weather.ts` - Open-Meteo 7-day hourly forecast collection
- `backend/src/db/queries/speed-readings.ts` - Multi-row batch INSERT for speed_readings table
- `backend/src/db/queries/incidents.ts` - Multi-row batch INSERT for incidents table
- `backend/src/db/queries/weather.ts` - Upsert with ON CONFLICT for weather_forecasts table
- `backend/src/db/queries/budget.ts` - Job logging (logJobStart/logJobEnd) for job_log table
- `backend/src/collectors/__tests__/inrix-speeds.test.ts` - 7 tests: URL/params, budget skip, validation, call order, 401 handling, job/call logging
- `backend/src/collectors/__tests__/inrix-incidents.test.ts` - 6 tests: URL/params, budget skip, validation, call order, 401 handling, job logging
- `backend/src/collectors/__tests__/weather.test.ts` - 6 tests: params, validation, field mapping, row count, fog detection, job logging

## Decisions Made
- Collector lifecycle standardized: logJobStart -> checkBudget -> recordCall -> withRetry(fetch) -> Zod parse -> batch insert -> updateCallStatus -> logJobEnd
- Weather upsert uses ON CONFLICT (forecast_hour) DO UPDATE to prevent duplicate rows (per RESEARCH.md pitfall 5)
- Auth token invalidation on 401 happens inside the retry callback so the next retry attempt acquires a fresh token
- Used AxiosError type guard for 401 detection rather than generic error checking

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All three collectors ready for worker process scheduling (Plan 03 -- cron jobs)
- collectSpeeds and collectIncidents require InrixAuthService instance as argument
- collectWeather is standalone (no auth needed, Open-Meteo is free/keyless)
- DB query modules independently testable and reusable

## Self-Check: PASSED

All 10 created files verified present. Both task commits (bd7ce11, 8956fd9) verified in git log. 45/45 tests passing.

---
*Phase: 01-data-pipeline*
*Completed: 2026-03-19*
