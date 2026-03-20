---
phase: 03-api-layer
plan: 02
subsystem: api
tags: [departure-windows, zod, cache, congestion-risk, express]

# Dependency graph
requires:
  - phase: 03-api-layer
    provides: In-memory TTL cache service (cacheGet, cacheSet), CORS middleware, error middleware
  - phase: 02-forecasting-model
    provides: forecasts table with p10/p50/p90 and modifier columns, forecastsRouter skeleton
provides:
  - Departure-windows endpoint with ranked windows, congestion risk, and reason explanations
  - Zod validation for arrival (ISO 8601) and window_count (1-50)
  - Cache-integrated route preventing repeated DB queries
affects: [frontend, 04-dashboard]

# Tech tracking
tech-stack:
  added: []
  patterns: [zod-route-validation, congestion-risk-derivation, modifier-reason-derivation, cache-per-arrival-hour]

key-files:
  created:
    - backend/src/api/__tests__/departure-windows.test.ts
  modified:
    - backend/src/api/forecasts.ts

key-decisions:
  - "p50/p10 ratio thresholds for congestion_risk: <=1.2 free_flow, <=1.5 moderate, >1.5 heavy"
  - "Cache key includes arrival hour for per-slot granularity"
  - "Modifier threshold >1.05 triggers reason text inclusion"

patterns-established:
  - "Zod validation at route entry with safeParse returning 400 on failure"
  - "departure_at = forecast_for - p50_minutes (arrival minus travel time)"
  - "Reason field: semicolon-joined modifier descriptions, null when none active"

requirements-completed: [API-03]

# Metrics
duration: 2min
completed: 2026-03-20
---

# Phase 03 Plan 02: Departure Windows Endpoint Summary

**Departure-windows endpoint returning ranked windows with congestion_risk derivation and weather/event/school reason explanations via Zod-validated query params and in-memory cache**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-20T06:06:26Z
- **Completed:** 2026-03-20T06:08:23Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- GET /api/corridors/:corridorId/departure-windows endpoint with full Zod validation
- Congestion risk derivation (free_flow/moderate/heavy) from p50/p10 ratio
- Reason field surfacing weather, event, and school modifiers when active (>1.05 threshold)
- Cache integration keyed by corridor+arrivalHour preventing redundant DB queries
- 16 new tests via TDD, all 90 tests pass across 16 test files

## Task Commits

Each task was committed atomically:

1. **Task 1: Write departure-windows test file (RED)** - `1b60d9f` (test)
2. **Task 2: Implement departure-windows route handler (GREEN)** - `a49932a` (feat)

_Note: TDD task with RED/GREEN commits_

## Files Created/Modified
- `backend/src/api/__tests__/departure-windows.test.ts` - 16 supertest integration tests covering success, validation, 404, cache hit/miss
- `backend/src/api/forecasts.ts` - Added departure-windows route with Zod schema, deriveCongestionRisk, deriveReason helpers

## Decisions Made
- p50/p10 ratio thresholds for congestion_risk: <=1.2 free_flow, <=1.5 moderate, >1.5 heavy (tunable with real data later)
- Cache key includes arrival hour (ISO slice to 13 chars) for per-slot granularity
- Modifier threshold >1.05 triggers reason text -- null modifiers and values <=1.05 produce null reason

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All API endpoints complete (API-01 current speeds, API-02 forecast, API-03 departure windows)
- Cache, CORS, and error middleware active for all routes
- All 90 tests passing, no regressions
- Ready for Phase 04 (dashboard/frontend)

---
*Phase: 03-api-layer*
*Completed: 2026-03-20*
