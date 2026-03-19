---
phase: 01-data-pipeline
plan: 01
subsystem: database, api, services
tags: [typescript, timescaledb, zod, pg, axios, inrix, open-meteo, vitest]

# Dependency graph
requires: []
provides:
  - "TimescaleDB schema with 6 tables (speed_readings, incidents, weather_forecasts, calendar_flags, api_call_log, job_log)"
  - "INRIX auth service with SHA1 hashToken and 24h token caching"
  - "Budget tracker enforcing 1600-call weekly hard stop via api_call_log"
  - "Retry utility with exponential backoff and jitter"
  - "Zod validation schemas for INRIX speed/incident and Open-Meteo weather responses"
  - "pg Pool connection singleton"
affects: [01-02-PLAN, 01-03-PLAN, 02-forecasting-model]

# Tech tracking
tech-stack:
  added: [pg@8.20.0, axios@1.13.6, node-cron@4.2.1, zod@4.3.6, dotenv@17.3.1, date-fns@4.1.0, typescript@5.9.3, vitest@4.1.0, node-pg-migrate@8.0.4]
  patterns: [NodeNext modules, strict TypeScript, Zod runtime validation, vi.mock for unit tests]

key-files:
  created:
    - backend/package.json
    - backend/tsconfig.json
    - backend/vitest.config.ts
    - backend/.env.example
    - backend/src/db/connection.ts
    - backend/src/db/migrations/001_create-extension-and-tables.sql
    - backend/src/db/migrations/002_compression-policies.sql
    - backend/src/collectors/schemas/inrix.ts
    - backend/src/collectors/schemas/weather.ts
    - backend/src/services/inrix-auth.ts
    - backend/src/services/budget-tracker.ts
    - backend/src/services/retry.ts
    - backend/src/services/__tests__/inrix-auth.test.ts
    - backend/src/services/__tests__/budget-tracker.test.ts
    - backend/src/services/__tests__/retry.test.ts
    - backend/src/collectors/schemas/__tests__/inrix.test.ts
    - backend/src/collectors/schemas/__tests__/weather.test.ts
  modified: []

key-decisions:
  - "Used NodeNext module resolution for native ESM compatibility with TypeScript"
  - "Budget tracker inserts pending status BEFORE API call to prevent counter drift on timeouts"
  - "Retry utility uses real timers in tests (not fake timers) to avoid unhandled rejection issues with vitest"

patterns-established:
  - "Zod schema validation: define schema, export schema + inferred type, parse before DB insert"
  - "Service mocking: vi.mock for module-level mocks, vi.mocked for typed access"
  - "DB access: centralized pool singleton with query helper function"

requirements-completed: [DATA-02, DATA-03]

# Metrics
duration: 6min
completed: 2026-03-19
---

# Phase 1 Plan 01: Backend Scaffold and Core Services Summary

**TypeScript backend with TimescaleDB 6-table schema, INRIX SHA1 auth with token caching, 1600-call/week budget tracker, exponential backoff retry, and Zod schemas for INRIX/Open-Meteo responses -- 26 tests passing**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-19T20:49:53Z
- **Completed:** 2026-03-19T20:56:05Z
- **Tasks:** 2
- **Files modified:** 18

## Accomplishments
- Scaffolded TypeScript backend with strict mode, ES2022 target, NodeNext modules
- Created TimescaleDB migration with 3 hypertables (speed_readings, incidents, weather_forecasts) and 3 regular tables (calendar_flags, api_call_log, job_log) plus compression policies
- Built INRIX auth service computing SHA1(lowercase(appId|appKey)) with expiry-aware token caching and 5-minute refresh threshold
- Built budget tracker enforcing 1600-call weekly hard stop with pre-call pending insert pattern to prevent counter drift
- Built retry utility with configurable exponential backoff, jitter, and onRetry callback
- Created Zod validation schemas for INRIX speed response, INRIX incident response, and Open-Meteo weather forecast
- 26 unit tests across 5 test files all passing

## Task Commits

Each task was committed atomically:

1. **Task 1: Project scaffold, DB migrations, and Zod schemas** - `fbe43a4` (feat)
2. **Task 2: INRIX auth service, budget tracker, and retry utility with tests** - `81b062b` (feat)

## Files Created/Modified
- `backend/package.json` - Project manifest with pg, axios, zod, date-fns, vitest, typescript
- `backend/tsconfig.json` - Strict TypeScript config with ES2022/NodeNext
- `backend/vitest.config.ts` - Test configuration for vitest
- `backend/.env.example` - Environment variable template (DATABASE_URL, INRIX credentials, budget limit)
- `backend/src/db/connection.ts` - pg Pool singleton with query helper
- `backend/src/db/migrations/001_create-extension-and-tables.sql` - TimescaleDB extension + 6 tables
- `backend/src/db/migrations/002_compression-policies.sql` - Compression policies for speed_readings and incidents
- `backend/src/collectors/schemas/inrix.ts` - Zod schemas: SpeedResponseSchema, IncidentResponseSchema
- `backend/src/collectors/schemas/weather.ts` - Zod schema: WeatherResponseSchema
- `backend/src/services/inrix-auth.ts` - INRIX token acquisition with SHA1 hashToken and caching
- `backend/src/services/budget-tracker.ts` - Weekly API call budget enforcement (1600 limit)
- `backend/src/services/retry.ts` - Exponential backoff retry utility with jitter
- `backend/src/services/__tests__/inrix-auth.test.ts` - 6 tests: hashToken computation, token caching, refresh, invalidate
- `backend/src/services/__tests__/budget-tracker.test.ts` - 7 tests: budget limits, recordCall, updateCallStatus
- `backend/src/services/__tests__/retry.test.ts` - 5 tests: success, retry, exhaust, callback, backoff
- `backend/src/collectors/schemas/__tests__/inrix.test.ts` - 5 tests: speed/incident schema validation
- `backend/src/collectors/schemas/__tests__/weather.test.ts` - 2 tests: weather schema validation
- `.gitignore` - node_modules, dist, .env exclusions

## Decisions Made
- Used NodeNext module resolution for native ESM compatibility with TypeScript strict mode
- Budget tracker inserts pending status BEFORE API call to prevent counter drift on network timeouts (per RESEARCH.md pitfall 2)
- Switched retry tests from fake timers to real timers with short delays to avoid vitest unhandled rejection issues
- Added .gitignore for node_modules/dist/.env (not in plan but necessary for clean repo)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript strict mode return type in InrixAuthService.getToken()**
- **Found during:** Task 2 (INRIX auth implementation)
- **Issue:** `this.cachedToken` typed as `string | null` could not be returned as `string`
- **Fix:** Extracted token to a local const with explicit `string` type before caching and returning
- **Files modified:** backend/src/services/inrix-auth.ts
- **Verification:** `npx tsc --noEmit` passes
- **Committed in:** 81b062b (Task 2 commit)

**2. [Rule 1 - Bug] Fixed missing afterEach import in retry test**
- **Found during:** Task 2 (retry test)
- **Issue:** `afterEach` used but not imported from vitest
- **Fix:** Added `afterEach` to the vitest import (later simplified test to not need fake timers)
- **Files modified:** backend/src/services/__tests__/retry.test.ts
- **Verification:** `npx tsc --noEmit` passes
- **Committed in:** 81b062b (Task 2 commit)

**3. [Rule 3 - Blocking] Added .gitignore for generated files**
- **Found during:** Post-Task 2 (untracked node_modules)
- **Issue:** node_modules/ showing as untracked in git status
- **Fix:** Created .gitignore with node_modules/, dist/, .env exclusions
- **Files modified:** .gitignore
- **Verification:** `git status` no longer shows node_modules
- **Committed in:** (will be part of docs commit)

---

**Total deviations:** 3 auto-fixed (2 bugs, 1 blocking)
**Impact on plan:** All auto-fixes necessary for correctness. No scope creep.

## Issues Encountered
- vitest fake timers with rejected promises caused unhandled rejection warnings; resolved by switching to real timers with short delays for retry tests

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Database schema ready for migration against TimescaleDB instance
- INRIX auth, budget tracker, and retry utility ready for collector implementations (Plans 02 and 03)
- Zod schemas ready for response validation in speed, incident, and weather collectors
- All core services have passing unit tests establishing test patterns for future development

## Self-Check: PASSED

All 15 created files verified present. Both task commits (fbe43a4, 81b062b) verified in git log. 26/26 tests passing.

---
*Phase: 01-data-pipeline*
*Completed: 2026-03-19*
