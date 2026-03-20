---
phase: 06-validation-and-accuracy-tracking
plan: 01
subsystem: api, ui, database
tags: [postgres, express, react, tanstack-query, vitest, accuracy, MAE, MAPE]

# Dependency graph
requires:
  - phase: 03-api-layer
    provides: Express Router pattern, cache service, supertest test pattern
  - phase: 04-frontend-dashboard
    provides: CorridorPanel component, TanStack Query hooks, Tailwind dark theme
  - phase: 05-departure-planner
    provides: Tab bar pattern in CorridorPanel, DeparturePlannerForm pattern
provides:
  - forecast_outcomes DB table with GENERATED ALWAYS error columns
  - Outcome logger CLI for batch-inserting predicted vs actual comparisons
  - GET /api/accuracy endpoint with MAE/MAPE/trend/day-of-week breakdown
  - AccuracyDashboard component with expandable corridor rows
  - Accuracy tab in CorridorPanel (3-tab layout)
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns: [CROSS JOIN LATERAL for correlated subquery aggregation, GENERATED ALWAYS STORED columns, trend derivation with 5% relative threshold]

key-files:
  created:
    - backend/src/db/migrations/006_create-forecast-outcomes-table.sql
    - backend/src/collectors/outcome-logger.ts
    - backend/src/collectors/__tests__/outcome-logger.test.ts
    - backend/src/api/accuracy.ts
    - backend/src/api/__tests__/accuracy.test.ts
    - frontend/src/hooks/useAccuracyMetrics.ts
    - frontend/src/components/AccuracyDashboard.tsx
    - frontend/src/components/__tests__/AccuracyDashboard.test.tsx
  modified:
    - backend/src/api/index.ts
    - frontend/src/types/api.ts
    - frontend/src/lib/api.ts
    - frontend/src/components/CorridorPanel.tsx
    - frontend/src/components/__tests__/CorridorPanel.test.tsx

key-decisions:
  - "CORRIDOR_DISPLAY_NAMES replicated as const in accuracy.ts (corridors.ts does not export it)"
  - "require.main === module for CLI entry point (backend is CommonJS, not ESM)"
  - "3 sequential queries in accuracy endpoint (main aggregation, trend, day-of-week) for clear separation"

patterns-established:
  - "GENERATED ALWAYS AS ... STORED for computed columns that should never be manually inserted"
  - "deriveTrend() with 5% relative threshold comparing 7-day windows"
  - "Expandable row pattern with useState<string | null> for single-item expand/collapse"

requirements-completed: [VAL-01, VAL-02]

# Metrics
duration: 6min
completed: 2026-03-20
---

# Phase 6 Plan 1: Validation and Accuracy Tracking Summary

**Forecast outcome logger with batch CROSS JOIN LATERAL SQL, per-corridor MAE/MAPE/trend accuracy API, and AccuracyDashboard with expandable day-of-week breakdown**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-20T17:08:20Z
- **Completed:** 2026-03-20T17:14:54Z
- **Tasks:** 3
- **Files modified:** 13

## Accomplishments
- Migration 006 creates forecast_outcomes table with GENERATED ALWAYS error columns (abs_error_minutes, abs_pct_error)
- Outcome logger uses single batch INSERT...SELECT with CROSS JOIN LATERAL to join forecasts with speed_readings, idempotent via ON CONFLICT DO NOTHING
- GET /api/accuracy returns per-corridor MAE, MAPE, sample count, trend (improving/degrading/stable), and day-of-week breakdown with 1-hour cache
- AccuracyDashboard renders corridor rows with trend badges and expandable day-of-week sub-tables, with graceful empty state
- CorridorPanel now has 3 tabs: Live | Plan | Accuracy

## Task Commits

Each task was committed atomically:

1. **Task 1: DB migration + outcome logger with tests** - `7385b71` (feat)
2. **Task 2: Backend accuracy API endpoint with tests** - `bdd75e4` (feat)
3. **Task 3: Frontend accuracy dashboard and CorridorPanel integration** - `11381f8` (feat)

## Files Created/Modified
- `backend/src/db/migrations/006_create-forecast-outcomes-table.sql` - forecast_outcomes table with GENERATED ALWAYS error columns
- `backend/src/collectors/outcome-logger.ts` - Batch outcome logging with CROSS JOIN LATERAL SQL
- `backend/src/collectors/__tests__/outcome-logger.test.ts` - 4 unit tests for outcome logger
- `backend/src/api/accuracy.ts` - GET /api/accuracy with 3-query aggregation and deriveTrend()
- `backend/src/api/__tests__/accuracy.test.ts` - 11 tests covering API and trend derivation
- `backend/src/api/index.ts` - Mount accuracyRouter at /api/accuracy
- `frontend/src/types/api.ts` - AccuracyResponse, CorridorAccuracy, DayOfWeekAccuracy types
- `frontend/src/lib/api.ts` - fetchAccuracyMetrics() function
- `frontend/src/hooks/useAccuracyMetrics.ts` - TanStack Query hook with 1hr refetch
- `frontend/src/components/AccuracyDashboard.tsx` - Accuracy dashboard with trend badges and day-of-week expansion
- `frontend/src/components/__tests__/AccuracyDashboard.test.tsx` - 5 component tests
- `frontend/src/components/CorridorPanel.tsx` - Added Accuracy tab (3-tab layout)
- `frontend/src/components/__tests__/CorridorPanel.test.tsx` - 2 new Accuracy tab tests

## Decisions Made
- Replicated CORRIDOR_DISPLAY_NAMES as const in accuracy.ts since corridors.ts does not export the mapping
- Used require.main === module for CLI entry point since backend package type is CommonJS
- 3 sequential queries in accuracy endpoint for clear separation of concerns (aggregation, trend, day-of-week)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed import.meta.url incompatibility with CommonJS**
- **Found during:** Task 1 verification (TypeScript check)
- **Issue:** Plan specified `import.meta.url` for CLI entry point, but backend is CommonJS (`"type": "commonjs"` in package.json)
- **Fix:** Replaced with `require.main === module`
- **Files modified:** backend/src/collectors/outcome-logger.ts
- **Verification:** `npx tsc --noEmit` passes cleanly
- **Committed in:** `2bdc560`

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minimal - same functionality with correct module system detection.

## Issues Encountered
None beyond the auto-fixed deviation above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All validation infrastructure is in place
- This is the final phase (Phase 6 of 6) - project milestone v1.0 complete
- All 109 backend tests and 80 frontend tests pass
- TypeScript compiles cleanly in both backend and frontend

## Self-Check: PASSED

All 8 created files verified on disk. All 4 commit hashes (7385b71, bdd75e4, 11381f8, 2bdc560) found in git log.

---
*Phase: 06-validation-and-accuracy-tracking*
*Completed: 2026-03-20*
