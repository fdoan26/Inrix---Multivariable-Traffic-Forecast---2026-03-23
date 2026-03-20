# Phase 6: Validation and Accuracy Tracking - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 6 is the final phase. It adds two things:
1. **Outcome logging (VAL-01)** — A backend cron job that compares past forecast predictions against the actual observed travel times (from `speed_readings`) and stores outcomes in a new `forecast_outcomes` table. No manual data entry — fully automatic once data accumulates.
2. **Accuracy dashboard (VAL-02)** — A new "Accuracy" tab in `CorridorPanel` showing per-corridor MAE, MAPE, sample count, and 7-day trend. Backed by a new `GET /api/accuracy` endpoint.

No new external data sources. No new major libraries. This phase works entirely from data already in the database.

</domain>

<decisions>
## Implementation Decisions

### Outcome Logging (VAL-01)
- New DB migration: `backend/src/db/migrations/006_create-forecast-outcomes-table.sql`
  - Table: `forecast_outcomes(id SERIAL, corridor_id TEXT, forecast_for TIMESTAMPTZ, predicted_minutes FLOAT, actual_minutes FLOAT, p10_minutes FLOAT, p50_minutes FLOAT, p90_minutes FLOAT, abs_error_minutes FLOAT GENERATED ALWAYS AS (ABS(actual_minutes - predicted_minutes)) STORED, abs_pct_error FLOAT GENERATED ALWAYS AS (CASE WHEN predicted_minutes > 0 THEN ABS(actual_minutes - predicted_minutes) / predicted_minutes * 100 ELSE NULL END) STORED, created_at TIMESTAMPTZ DEFAULT NOW(), UNIQUE(corridor_id, forecast_for))`
- Actuals sourced from `speed_readings` table — average `avg_travel_time_min` for readings within the forecast window (±30 min of `forecast_for`)
- New backend script: `backend/src/collectors/outcome-logger.ts`
  - Finds all `forecasts` rows where `forecast_for < NOW() - INTERVAL '1 hour'` (past, with 1h grace)
  - For each, queries `speed_readings` for average actual travel time in the corridor's segments during that window
  - Upserts into `forecast_outcomes` via `ON CONFLICT (corridor_id, forecast_for) DO NOTHING` (idempotent)
  - Runs as a CLI script: `npx tsx backend/src/collectors/outcome-logger.ts`
  - Also schedulable as a cron: runs daily (low priority — historical data only)
- The outcome logger is a one-shot script (not a long-running process) — same pattern as `ml/scripts/run_forecast.py`

### Backend Accuracy API (VAL-02)
- New endpoint: `GET /api/accuracy`
  - Optional query param: `?corridor_id=us-101` (filters to one corridor; default = all 6)
  - Response shape:
    ```json
    {
      "generated_at": "2026-03-20T...",
      "corridors": [
        {
          "corridor_id": "us-101",
          "display_name": "US-101",
          "sample_count": 42,
          "mae_minutes": 3.2,
          "mape_pct": 8.5,
          "trend": "improving",
          "by_day_of_week": [
            { "day": 0, "day_name": "Sunday", "mae_minutes": 2.1, "mape_pct": 6.2, "count": 6 },
            ...
          ]
        }
      ]
    }
    ```
  - `trend` derived from comparing last 7 days MAPE vs prior 7 days MAPE: "improving" (<5% relative decrease), "degrading" (>5% relative increase), "stable" otherwise
  - New router: `backend/src/api/accuracy.ts`, mounted at `/api/accuracy` in `backend/src/api/index.ts`
  - Cached with 1-hour TTL (accuracy metrics don't need live freshness)
  - Tests in `backend/src/api/__tests__/accuracy.test.ts`

### Accuracy Dashboard UI (VAL-02)
- New "Accuracy" tab added to `CorridorPanel` header: **Live** | **Plan** | **Accuracy**
- Active tab underline style: same as existing (`border-b-2 border-amber-400 text-white`)
- Accuracy tab content: `AccuracyDashboard` component
- `AccuracyDashboard` shows:
  - Header: "Forecast Accuracy" + last-updated timestamp
  - Per-corridor table rows: corridor name, MAE (e.g., "3.2 min"), MAPE (e.g., "8.5%"), sample count, trend badge
  - Trend badge: green "↑ Improving" / red "↓ Degrading" / gray "→ Stable"
  - Expandable day-of-week breakdown per corridor (click to expand row): small sub-table with Sun–Sat MAE/MAPE
  - Empty state: "Not enough data yet — outcomes are logged automatically as forecasts mature"
- New hook: `frontend/src/hooks/useAccuracyMetrics.ts` (TanStack Query, `queryKey: ['accuracy']`, `refetchInterval: 60 * 60 * 1000` — 1 hour)
- New component: `frontend/src/components/AccuracyDashboard.tsx`
- `frontend/src/types/api.ts` extended with `AccuracyResponse`, `CorridorAccuracy`, `DayOfWeekAccuracy`

### No New Dependencies
- Backend: No new npm packages — uses existing `query` DB connection, `express Router`, `zod`
- Frontend: No new npm packages — extends existing TanStack Query + Tailwind patterns

### Claude's Discretion
- Exact SQL query for joining `forecasts` with `speed_readings` (segment-level aggregation to corridor-level travel time)
- Whether to show a "Run outcome logger" button in the UI (probably not — keep it backend-only for MVP)
- Exact day-of-week expand/collapse interaction (toggle state local to component)
- Whether to add trend arrow to corridor list in Live tab (no — keep Live tab focused on current speeds)

</decisions>

<canonical_refs>
## Canonical References

No external specs — requirements are fully captured in decisions above.

### Planning documents
- `.planning/REQUIREMENTS.md` — VAL-01, VAL-02 definitions
- `.planning/phases/03-api-layer/03-CONTEXT.md` — cache service pattern (TTL cache) used for accuracy endpoint
- `.planning/phases/04-map-and-live-view/04-CONTEXT.md` — existing frontend patterns
- `.planning/phases/05-departure-planner-and-week-ahead-view/05-CONTEXT.md` — tab navigation pattern (Live | Plan) to extend

### Database schema
- `backend/src/db/migrations/003_create-forecasts-table.sql` — `forecasts` table schema (corridor_id, forecast_for, predicted_minutes, p10/p50/p90, modifiers)
- `backend/src/db/migrations/001_create-extension-and-tables.sql` — `speed_readings` table schema (segment_id, recorded_at, avg_travel_time_min)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/src/api/forecasts.ts` — Router pattern, `query()` usage, `cacheGet`/`cacheSet` — replicate for `accuracy.ts`
- `backend/src/services/cache.ts` — `cacheSet(key, value, ttl?)` — use with 1-hour TTL for accuracy endpoint
- `backend/src/api/index.ts` — mount new accuracy router at `/api/accuracy`
- `backend/src/api/corridors.ts` — `CORRIDOR_IDS` pattern for iterating all 6 corridors
- `frontend/src/components/CorridorPanel.tsx` — existing `PanelTab` type and tab navigation to extend with "accuracy" tab
- `frontend/src/hooks/useCorridorForecast.ts` — TanStack Query pattern to replicate in `useAccuracyMetrics.ts`
- `frontend/src/types/api.ts` — extend with accuracy types
- `frontend/src/data/corridors.ts` — `CORRIDOR_DISPLAY_NAMES` for mapping corridor_id → display name

### Established Patterns
- Backend: Express Router + `query()` + Zod validation + TTL cache — all established
- Frontend: TanStack Query v5 with `useQuery`, Tailwind v4 dark theme, `data-testid` attrs, Vitest + RTL tests
- Tab navigation in `CorridorPanel`: `useState<PanelTab>` with `border-b-2 border-amber-400` active style
- Backend tests use `supertest` with mocked `query` function

### Integration Points
- `outcome-logger.ts` reads from `forecasts` + `speed_readings`, writes to `forecast_outcomes`
- `accuracy.ts` router reads from `forecast_outcomes`, served at `/api/accuracy`
- `AccuracyDashboard` → `useAccuracyMetrics` → `GET /api/accuracy`
- `CorridorPanel` mounts `<AccuracyDashboard />` in the Accuracy tab

</code_context>

<specifics>
## Specific Ideas

- The empty state ("Not enough data yet") is important — Phase 6 will ship before significant forecast outcomes have accumulated. The dashboard must degrade gracefully when `forecast_outcomes` is empty.
- The outcome logger's idempotency (ON CONFLICT DO NOTHING) means it can safely be run multiple times per day as a cron job without double-counting outcomes.
- The day-of-week breakdown is the key analytical insight — it reveals systematic model biases (e.g., "Monday mornings are consistently underestimated by 15%") that can guide model retraining.

</specifics>

<deferred>
## Deferred Ideas

- User-facing accuracy alerts ("Model degraded beyond threshold this week") — v2
- Corridor-level retraining trigger based on accuracy threshold breach — v2
- Historical accuracy chart (time series of MAPE over weeks) — v2
- Per-hour breakdown (in addition to per-day-of-week) — v2
- Export accuracy report as CSV — v2

</deferred>

---

*Phase: 06-validation-and-accuracy-tracking*
*Context gathered: 2026-03-20*
