---
phase: 02-forecasting-model
plan: 03
subsystem: api
tags: [express, rest-api, inrix, forecasts, corridors]

# Dependency graph
requires:
  - phase: 01-data-pipeline
    provides: "DB schema (speed_readings, forecasts, corridors tables), INRIX speed collector, connection pool"
  - phase: 02-forecasting-model/01
    provides: "ML pipeline writing forecasts to forecasts table"
provides:
  - "GET /api/corridors/:id/current endpoint for real-time corridor speeds"
  - "GET /api/corridors/:id/forecast endpoint for week-ahead p10/p50/p90 forecasts"
  - "Express app exported from backend/src/api/index.ts"
  - "HTTP server entry point at backend/src/server.ts"
  - "INRIX Duration parameter (duration_minutes) in speed_readings for 0-2hr forecasts"
affects: [04-frontend-dashboard, 03-alerting-system]

# Tech tracking
tech-stack:
  added: [express@5.1, supertest]
  patterns: [express-router-per-resource, supertest-integration-tests, mock-db-query]

key-files:
  created:
    - backend/src/api/index.ts
    - backend/src/api/corridors.ts
    - backend/src/api/forecasts.ts
    - backend/src/server.ts
    - backend/src/api/__tests__/corridors.test.ts
    - backend/src/api/__tests__/forecasts.test.ts
    - backend/src/db/migrations/005_add-duration-minutes.sql
  modified:
    - backend/package.json
    - backend/src/collectors/schemas/inrix.ts
    - backend/src/collectors/inrix-speeds.ts
    - backend/src/db/queries/speed-readings.ts
    - backend/src/collectors/__tests__/inrix-speeds.test.ts

key-decisions:
  - "Express 5.1 with Router-per-resource pattern (corridorsRouter, forecastsRouter)"
  - "supertest for HTTP-level integration tests with mocked DB query function"
  - "server.ts as separate entry point from worker.ts (API server vs data collection)"

patterns-established:
  - "Router-per-resource: each domain gets its own Router exported from a module"
  - "DB mock pattern: vi.mock connection.js, import query, vi.mocked(query) for test control"
  - "supertest against app export for endpoint integration tests"

requirements-completed: [FORE-07]

# Metrics
duration: 3min
completed: 2026-03-20
---

# Phase 02 Plan 03: REST API Endpoints Summary

**Express REST API with corridor speeds endpoint, week-ahead forecast endpoint, and INRIX Duration parameter for short-term predictions**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-20T05:32:35Z
- **Completed:** 2026-03-20T05:36:00Z
- **Tasks:** 2
- **Files modified:** 13

## Accomplishments
- Two REST endpoints serving corridor speed and forecast data from PostgreSQL
- Congestion classification (free_flow/moderate/heavy) based on average congestion_score
- INRIX Duration=120 parameter for 0-2hr short-term forecast data (FORE-07)
- HTTP server entry point (server.ts) separate from data collection worker
- 11 new API tests + 2 new collector tests, all 64 backend tests pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Express API (TDD RED)** - `97ba0c7` (test)
2. **Task 1: Express API (TDD GREEN)** - `ce16c9b` (feat)
3. **Task 2: INRIX Duration parameter** - `79bde76` (feat)

_Note: Task 1 used TDD with separate RED/GREEN commits_

## Files Created/Modified
- `backend/src/api/index.ts` - Express app with mounted routers and health check
- `backend/src/api/corridors.ts` - GET /:corridorId/current with segment speeds and congestion level
- `backend/src/api/forecasts.ts` - GET /:corridorId/forecast with p10/p50/p90 predictions
- `backend/src/server.ts` - HTTP server entry point on PORT 3001
- `backend/src/api/__tests__/corridors.test.ts` - 6 tests for corridors endpoint
- `backend/src/api/__tests__/forecasts.test.ts` - 5 tests for forecasts endpoint
- `backend/src/db/migrations/005_add-duration-minutes.sql` - Adds duration_minutes column
- `backend/src/collectors/schemas/inrix.ts` - Added optional durationMinutes to Zod schema
- `backend/src/collectors/inrix-speeds.ts` - Added Duration=120 to INRIX API params
- `backend/src/db/queries/speed-readings.ts` - Added duration_minutes to INSERT
- `backend/src/collectors/__tests__/inrix-speeds.test.ts` - 2 new tests for Duration param
- `backend/package.json` - Added express, supertest dependencies

## Decisions Made
- Used Express 5.1 (latest stable) with Router-per-resource pattern
- supertest for HTTP-level integration tests (mock DB, real HTTP stack)
- server.ts as separate process from worker.ts -- API and data collection run independently

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- API endpoints ready for frontend consumption in Phase 4
- server.ts can be started with `tsx src/server.ts` or compiled with `tsc && node dist/server.js`
- Duration parameter ready to populate once INRIX API is called in production

## Self-Check: PASSED

All 7 created files verified on disk. All 3 commit hashes verified in git log.

---
*Phase: 02-forecasting-model*
*Completed: 2026-03-20*
