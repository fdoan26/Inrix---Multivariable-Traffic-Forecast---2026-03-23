---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: unknown
stopped_at: Completed 04-02-PLAN.md
last_updated: "2026-03-20T07:39:13.631Z"
progress:
  total_phases: 6
  completed_phases: 4
  total_plans: 11
  completed_plans: 11
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-19)

**Core value:** Give SF drivers a week-ahead departure planner with confidence intervals -- something Google/Apple cannot offer because they only react to real-time conditions.
**Current focus:** Phase 04 — map-and-live-view

## Current Position

Phase: 04 (map-and-live-view) — COMPLETE
Plan: 2 of 2

## Performance Metrics

**Velocity:**

- Total plans completed: 4
- Average duration: 3.5 min
- Total execution time: 0.24 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-data-pipeline | 4 | 14 min | 3.5 min |

**Recent Trend:**

- Last 5 plans: -
- Trend: -

*Updated after each plan completion*
| Phase 02 P01 | 5min | 2 tasks | 17 files |
| Phase 02 P03 | 3min | 2 tasks | 13 files |
| Phase 02 P02 | 7min | 2 tasks | 8 files |
| Phase 03 P01 | 2min | 2 tasks | 6 files |
| Phase 03 P02 | 2min | 2 tasks | 2 files |
| Phase 04 P01 | 8min | 2 tasks | 27 files |
| Phase 04 P02 | 3min | 2 tasks | 10 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Roadmap: 6 phases derived from 27 requirements. Data pipeline first due to ML cold-start (2-4 weeks of data needed).
- Research: INRIX bounding-box endpoint behavior and auth flow need empirical verification in Phase 1.
- Google Maps comparison: manual benchmarking only (ToS concerns).
- Fine granularity selected. YOLO mode with parallel execution enabled.
- Plan 01-01: Used NodeNext module resolution for native ESM compatibility with TypeScript
- Plan 01-01: Budget tracker inserts pending status BEFORE API call to prevent counter drift on timeouts
- Plan 01-01: Retry tests use real timers with short delays to avoid vitest unhandled rejection issues
- Plan 01-02: Collector lifecycle: logJobStart -> checkBudget -> recordCall -> withRetry(fetch) -> Zod parse -> batch insert -> updateCallStatus -> logJobEnd
- Plan 01-02: Weather upsert uses ON CONFLICT (forecast_hour) DO UPDATE to prevent duplicate rows on re-fetch
- Plan 01-02: Auth token invalidation on 401 happens inside retry loop so fresh token is acquired on next attempt
- Plan 01-03: Used csv-parse/sync for CSV parsing per RESEARCH.md "Don't Hand-Roll" recommendation
- Plan 01-03: Worker createJob wrapper uses promise chain (.then/.catch/.finally) instead of async callback to avoid unhandled rejection in cron
- Plan 01-04: Used vi.mocked(axios.get) instead of vi.mocked(axios) for type-safe mock methods under strict mode
- [Phase 02]: Lazy DATABASE_URL evaluation in config.py to allow module import without DB connection
- [Phase 02]: Multiplicative modifiers (1.15 = 15% slowdown) for weather/event/school factors
- Plan 02-03: Express 5.1 with Router-per-resource pattern for API endpoints
- Plan 02-03: supertest for HTTP-level integration tests with mocked DB query
- Plan 02-03: server.ts as separate process from worker.ts (API vs data collection)
- [Phase 02]: Two-tier dispatch: baseline when data < 2 weeks, XGBoost when model exists and data >= 2 weeks
- [Phase 02]: Placeholder forecasts (20min default) when no historical data, preventing empty forecast tables
- [Phase 02]: XGBoost modifier columns set to None (modifiers baked into ML features, not explicit multipliers)
- [Phase 03]: CORS before JSON body parser to handle preflight correctly
- [Phase 03]: Lazy eviction for cache (delete on access, not background sweep)
- [Phase 03]: Express 5 async error propagation eliminates need for try/catch in route handlers
- [Phase 03]: p50/p10 ratio thresholds for congestion_risk: <=1.2 free_flow, <=1.5 moderate, >1.5 heavy
- [Phase 03]: Cache key includes arrival hour for per-slot granularity
- [Phase 03]: Modifier threshold >1.05 triggers reason text inclusion
- Plan 04-01: Vitest globals: true required for @testing-library/jest-dom expect integration
- Plan 04-01: Import from react-map-gl/mapbox (NOT bare react-map-gl) for Mapbox GL JS v3
- Plan 04-01: Tailwind v4: @import tailwindcss in CSS, @tailwindcss/vite plugin, NO tailwind.config.js
- Plan 04-01: GeoJSON memoized with useMemo keyed on corridorQueries for render performance
- [Phase 04]: Inline SVG icons for incident markers rather than Mapbox symbol layer for simpler React integration
- [Phase 04]: Dark popup styling (bg-gray-800) to match dark-v11 map theme

### Pending Todos

None yet.

### Blockers/Concerns

- INRIX trial key specifics (bounding-box endpoint behavior, auth token lifecycle) need empirical verification before committing to polling strategy.
- Confidence interval methodology (quantile regression vs conformal prediction) deferred to Phase 2 when real data is available.
- Event data sourcing resolved: manual JSON seed file with 22 entries covering Giants, Warriors, concerts, festivals.

## Session Continuity

Last session: 2026-03-20T07:33:35.927Z
Stopped at: Completed 04-02-PLAN.md
Resume file: None
