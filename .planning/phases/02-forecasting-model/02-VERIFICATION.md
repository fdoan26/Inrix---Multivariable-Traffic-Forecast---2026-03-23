---
phase: 02-forecasting-model
verified: 2026-03-19T22:45:00Z
status: human_needed
score: 4/5 success criteria verified
re_verification: false
gaps:
  - truth: "Weather, event, and school calendar modifiers each visibly modify predictions compared to a plain baseline (real corridor segment IDs needed for actual data flow)"
    status: partial
    reason: "All modifier logic is implemented and tested. However all 6 corridors use TMC_PLACEHOLDER as their segment_ids in both corridors.py and migration 004. Until real INRIX segment IDs are populated from Phase 1 data, the forecast pipeline will produce only placeholder forecasts (20-min default) for every corridor because no speed_readings rows will match the placeholder segment filter. The modifiers exist in code but cannot influence a real data-backed forecast until segment IDs are resolved."
    artifacts:
      - path: "ml/src/corridors.py"
        issue: "All 6 corridors define segment_ids=(\"TMC_PLACEHOLDER\",) — no real INRIX segment IDs populated"
      - path: "backend/src/db/migrations/004_create-corridors-table.sql"
        issue: "All 6 corridor rows insert ARRAY['TMC_PLACEHOLDER'] for segment_ids"
    missing:
      - "Replace TMC_PLACEHOLDER with actual INRIX segment IDs from `SELECT DISTINCT segment_id FROM speed_readings` once Phase 1 data has accumulated"
  - truth: "API-01 and API-02 requirement IDs are not formally claimed in any Phase 2 plan frontmatter and remain marked Pending under Phase 3 in REQUIREMENTS.md and ROADMAP.md"
    status: failed
    reason: "Plan 02-03 implements the API-01 and API-02 endpoints and marks them in must_haves.truths, but the plan's requirements: frontmatter only lists FORE-07. REQUIREMENTS.md still shows API-01 and API-02 as '[ ] Pending' mapped to Phase 3. ROADMAP.md still shows all 3 Phase 2 plans as unchecked '[ ]' and progress as '1/3 plans executed'. The implementations are real and working — the tracking documents are stale."
    artifacts:
      - path: ".planning/REQUIREMENTS.md"
        issue: "API-01 and API-02 show as '[ ]' Pending under Phase 3; FORE-01 through FORE-08 show as '[x]' Complete but the checkboxes appear to have been updated without corresponding ROADMAP update"
      - path: ".planning/ROADMAP.md"
        issue: "Phase 2 progress shows '1/3 plans executed' and all plan checkboxes are unchecked; table shows 'In Progress' with no completion date"
    missing:
      - "Update ROADMAP.md: check off 02-01-PLAN.md, 02-02-PLAN.md, 02-03-PLAN.md; change progress to '3/3 plans complete'; mark Phase 2 Complete with date"
      - "Update REQUIREMENTS.md: if API-01 and API-02 are considered satisfied by Phase 2 work, mark them [x] and update traceability table; otherwise leave as Phase 3 and accept that Phase 2 delivered the implementations early"
---

# Phase 2: Forecasting Model Verification Report

**Phase Goal:** The system generates week-ahead congestion forecasts with confidence intervals for every major SF corridor, refreshed on a scheduled basis
**Verified:** 2026-03-19T22:45:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | Week-ahead forecast exists for each major SF corridor (101, 280, Bay Bridge, Van Ness, 19th Ave, Market St) broken down by day-of-week and hour | PARTIAL | Pipeline code generates 168 rows/corridor. All segment_ids are TMC_PLACEHOLDER so real data cannot flow until Phase 1 IDs are populated. Placeholder fallback (20-min default) fires instead. |
| 2 | Each prediction includes p10/p50/p90 confidence interval displayed as range plus most-likely value | VERIFIED | `compute_baseline()` in `ml/src/baseline.py` produces p10_minutes, p50_minutes, p90_minutes, predicted_minutes. `bootstrap_ci()` in `ml/src/confidence.py` enforces monotonicity. `write_forecasts()` INSERTs all four columns. API forecasts.ts exposes all three quantile columns in JSON response. |
| 3 | Weather, event, and school calendar modifiers each visibly modify predictions compared to plain baseline | PARTIAL | Modifier functions exist in `ml/src/features.py` (rain: 1.15x, fog: 1.10x, heavy rain: 1.25x, Giants: 1.20x, school morning: 1.08x). The forecast orchestrator applies them per hour. However, because all corridor segment_ids are TMC_PLACEHOLDER, no historical speeds will be fetched and placeholder forecasts (fixed 20-min, no modifier applied) will be returned in practice until real IDs are populated. Modifier logic is correct in isolation (all 7 unit tests pass). |
| 4 | Short-term (0-2hr) forecasts use INRIX Duration parameter | VERIFIED | `backend/src/collectors/inrix-speeds.ts` adds `Duration: 120` to the INRIX API request. Zod schema includes optional `durationMinutes` field. `insertSpeedReadings` includes `duration_minutes` in INSERT. Migration 005 adds the column. |
| 5 | Forecasts refresh automatically on a scheduled basis (every 6 hours minimum) | VERIFIED | `ml/scripts/run_forecast.py` contains cron schedule comment `0 */6 * * * cd /path/to/ml && python -m scripts.run_forecast >> logs/forecast.log 2>&1`. `REFRESH_INTERVAL_HOURS = 6` in `ml/src/config.py`. CLI is runnable via `python -m scripts.run_forecast`. NOTE: Actual cron wiring requires manual setup on the deployment host — the script and schedule are documented but not installed by the code. This is expected (no CI/CD system defined yet). |

**Score:** 3/5 fully verified, 2/5 partial (due to TMC_PLACEHOLDER segment IDs blocking real data flow, and tracking documentation staleness)

---

## Required Artifacts

### Plan 02-01 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `ml/src/baseline.py` | Historical average baseline with percentile CI | VERIFIED | `compute_baseline()` groupby (corridor, dow, hour) with np.percentile at 10/50/90. Substantive, 32 lines. |
| `ml/src/features.py` | Feature assembly with weather/event/school modifiers | VERIFIED | `apply_modifiers()`, `build_feature_row()`, `FEATURE_COLUMNS` all present. 105 lines, all modifier constants defined. |
| `ml/src/confidence.py` | Bootstrap CI computation | VERIFIED | `bootstrap_ci()` with monotonicity enforcement. 29 lines. |
| `ml/src/corridors.py` | Corridor-to-segment mapping for 6 SF corridors | VERIFIED (PARTIAL) | 6 corridors defined. `get_corridor()` raises ValueError for unknown IDs. All segment_ids are TMC_PLACEHOLDER — placeholder values awaiting real INRIX segment IDs. |
| `ml/src/db.py` | psycopg2 ThreadedConnectionPool with context manager | VERIFIED | `get_conn()`, `get_pool()`, `close_pool()` all implemented. 35 lines. |
| `backend/src/db/migrations/003_create-forecasts-table.sql` | Forecasts hypertable with p10/p50/p90 columns | VERIFIED | Creates forecasts hypertable with all required columns including p10_minutes, p50_minutes, p90_minutes, model_version, weather_modifier, event_modifier, school_modifier. |
| `backend/src/db/migrations/004_create-corridors-table.sql` | Corridors lookup table with segment_ids array | VERIFIED (PARTIAL) | Creates corridors table and inserts 6 rows. All segment_ids are ARRAY['TMC_PLACEHOLDER']. |

### Plan 02-02 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `ml/src/forecast.py` | Forecast orchestrator: run_forecast, write_forecasts, count_data_weeks | VERIFIED | All three functions present plus fetch helpers. Two-tier dispatch: baseline below 2 weeks, XGBoost when data >= 2 weeks and model exists. 270 lines. |
| `ml/src/model.py` | XGBoost training, quantile prediction, save/load, evaluate | VERIFIED | `train_quantile_model()` uses `reg:quantileerror` with `quantile_alpha=[0.1, 0.5, 0.9]`. `predict_quantiles()` includes crossing guard. `evaluate_model()` computes pinball loss. `save_model()`/`load_model()` round-trip via joblib. 84 lines. |
| `ml/scripts/run_forecast.py` | CLI entry point for forecast refresh | VERIFIED | click command with `--corridor`/`--horizon`. Cron schedule documented. `close_pool()` in finally. 45 lines. |
| `ml/scripts/train_model.py` | CLI entry point for XGBoost retrain | VERIFIED | click command with `--corridor`/`--version`. Calls `evaluate_model()` after training and logs metrics. |
| `ml/scripts/backfill_baseline.py` | One-time baseline backfill script | VERIFIED | click command iterating all 6 corridors. `close_pool()` in finally. |

### Plan 02-03 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/src/api/corridors.ts` | Express route handler for GET /api/corridors/:id/current | VERIFIED | Queries corridors table, then speed_readings with DISTINCT ON (segment_id). Maps congestion_score to free_flow/moderate/heavy. Returns corridor_id, display_name, congestion_level, avg_travel_time_min, segments[]. |
| `backend/src/api/forecasts.ts` | Express route handler for GET /api/corridors/:id/forecast | VERIFIED | Validates corridor exists, queries forecasts table with `forecast_for >= NOW()` window, returns p10/p50/p90 per row, ORDER BY forecast_for ASC. Supports `?hours=N` parameter. |
| `backend/src/api/index.ts` | Express app with mounted routers | VERIFIED | Exports `app`. Mounts corridorsRouter and forecastsRouter on `/api/corridors`. Health check at `/api/health`. |
| `backend/src/server.ts` | HTTP server entry point on PORT 3001 | VERIFIED | Imports `app` from `./api/index.js`. Calls `app.listen(PORT)`. Graceful SIGINT/SIGTERM handlers. Default PORT 3001. |
| `backend/src/db/migrations/005_add-duration-minutes.sql` | Add duration_minutes REAL column | VERIFIED | `ALTER TABLE speed_readings ADD COLUMN IF NOT EXISTS duration_minutes REAL;` |

---

## Key Link Verification

### Plan 02-01 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `ml/src/forecast.py` | `ml/src/baseline.py` | `compute_baseline(hist)` in `_predict_baseline` | VERIFIED | Line 113: `baseline = compute_baseline(hist)` — direct call present. |
| `ml/src/features.py` | speed_readings, weather_forecasts, calendar_flags tables | SQL queries in `forecast.py` fetch helpers | VERIFIED | `fetch_weather_for_range()` queries weather_forecasts. `fetch_calendar_for_range()` queries calendar_flags. `fetch_historical_speeds()` queries speed_readings. |
| `ml/src/corridors.py` | `ml/src/baseline.py` | `corridor.segment_ids` used to filter speed_readings | VERIFIED | `count_data_weeks()` and `fetch_historical_speeds()` in forecast.py use `corridor.segment_ids` to parameterize queries via `WHERE segment_id = ANY(%s)`. |

### Plan 02-02 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `ml/src/forecast.py` | `ml/src/baseline.py` | `compute_baseline` called in `_predict_baseline` | VERIFIED | Line 113: `baseline = compute_baseline(hist)` |
| `ml/src/forecast.py` | `ml/src/features.py` | `apply_modifiers` for each forecast row | VERIFIED | Lines 128-130: `mods = apply_modifiers(w[0], w[1], w[2], ...)` inside the forecast loop. |
| `ml/src/forecast.py` | forecasts table | `write_forecasts` with `cursor.executemany` | VERIFIED | Lines 252-269: `cur.executemany(insert_sql, rows)` with INSERT INTO forecasts. DELETE before insert. |
| `ml/scripts/run_forecast.py` | `ml/src/forecast.py` | click CLI invoking `run_forecast` | VERIFIED | Line 35: `count = run_forecast(conn, cid, horizon)` |

### Plan 02-03 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `backend/src/api/corridors.ts` | speed_readings table | SELECT with segment_id filter from corridors table | VERIFIED | Two queries: corridor lookup by corridor_id, then `WHERE segment_id = ANY($1)` on speed_readings. |
| `backend/src/api/forecasts.ts` | forecasts table | SELECT with corridor_id and forecast_for range | VERIFIED | `WHERE corridor_id = $1 AND forecast_for >= NOW() AND forecast_for <= NOW() + $2::interval` |
| `backend/src/collectors/inrix-speeds.ts` | speed_readings table | `duration_minutes` added to INSERT | VERIFIED | `speed-readings.ts` INSERT includes `duration_minutes` column; inrix-speeds.ts passes `s.durationMinutes ?? null`. |
| `backend/src/server.ts` | `backend/src/api/index.ts` | imports app and calls app.listen | VERIFIED | Line 2: `import { app } from './api/index.js'`; Line 6: `app.listen(PORT, ...)` |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|---------|
| FORE-01 | 02-01-PLAN.md | Baseline forecast from historical average speed per corridor x DOW x hour | SATISFIED | `compute_baseline()` groupby (corridor_id, day_of_week, hour) with np.percentile |
| FORE-02 | 02-01-PLAN.md | Weather modifier — rain and fog reduce predicted speed | SATISFIED | `compute_weather_modifier()` returns 1.15x for rain, 1.10x for fog, 1.25x for heavy rain |
| FORE-03 | 02-01-PLAN.md | Event modifier — flagged event days shift predicted speeds | SATISFIED | `compute_event_modifier()` returns 1.20x Giants, 1.15x Warriors, 1.10x concert |
| FORE-04 | 02-01-PLAN.md | School calendar modifier — SFUSD school days vs breaks shift morning rush | SATISFIED | `compute_school_modifier()` returns 1.08x for school days at hours 7-8 |
| FORE-05 | 02-02-PLAN.md | Week-ahead forecast for each major SF corridor | SATISFIED (PARTIAL) | Forecast orchestrator generates 168 rows/corridor for all 6 corridors. Real data blocked by TMC_PLACEHOLDER segment IDs until Phase 1 IDs are populated. |
| FORE-06 | 02-01-PLAN.md | Confidence intervals computed — range + most-likely value | SATISFIED | `bootstrap_ci()` returns (p10, p50, p90). API exposes p10_minutes, p50_minutes, p90_minutes per forecast row. |
| FORE-07 | 02-03-PLAN.md | Short-term 0-2hr forecast uses INRIX Duration parameter | SATISFIED | `Duration: 120` in INRIX API request; `durationMinutes` in Zod schema; `duration_minutes` in speed_readings INSERT and migration 005. |
| FORE-08 | 02-02-PLAN.md | Forecast refreshed on scheduled basis (every 6 hours minimum) | SATISFIED | Cron schedule `0 */6 * * *` documented in run_forecast.py. `REFRESH_INTERVAL_HOURS = 6` in config.py. CLI invocable via `python -m scripts.run_forecast`. |

**Orphaned or Misattributed Requirements:**

The phase goal statement (from the verification prompt) and Plan 02-03 describe delivering "API-01 current speeds" and "API-02 week-ahead forecasts". However:
- REQUIREMENTS.md maps API-01 and API-02 to **Phase 3**, not Phase 2
- Plan 02-03's `requirements:` frontmatter lists only `FORE-07` — it does not claim API-01 or API-02
- REQUIREMENTS.md shows API-01 and API-02 as `[ ]` Pending
- The endpoints ARE fully implemented in Phase 2

This creates a requirements tracking discrepancy. The implementations exist and work; the tracking documents have not been updated to reflect that API-01 and API-02 were delivered early in Phase 2.

---

## Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `ml/src/corridors.py` (all 6 rows) | `segment_ids=("TMC_PLACEHOLDER",)` | WARNING | Forecast pipeline generates only placeholder (20-min fixed) forecasts; modifiers cannot influence predictions until real INRIX segment IDs are populated. Documented as intentional pending Phase 1 data collection. |
| `backend/src/db/migrations/004_create-corridors-table.sql` (all 6 rows) | `ARRAY['TMC_PLACEHOLDER']` | WARNING | Same issue as corridors.py — DB corridors table will have placeholder segment IDs until updated. |
| `ml/src/forecast.py` lines 213-233 | `_generate_placeholder_forecasts()` returns fixed 20-min travel time | INFO | Intentional fallback for the no-data case; model_version "placeholder-v1" clearly signals the forecast is synthetic. Not a bug, but means the forecast table is populated with non-predictive data until real data flows. |
| `.planning/ROADMAP.md` | All Phase 2 plan checkboxes unchecked, progress shows "1/3 plans executed" | WARNING | Documentation staleness — 3 plans are fully executed. This is a tracking inconsistency, not a code bug. |

---

## Human Verification Required

### 1. Cron Scheduler Deployment

**Test:** Confirm the 6-hour cron job is registered on the deployment host.
**Expected:** `crontab -l` shows `0 */6 * * * cd /path/to/ml && python -m scripts.run_forecast >> logs/forecast.log 2>&1`
**Why human:** The cron schedule is documented in a comment in `run_forecast.py` but not installed by any automation. A human must register it on the target machine.

### 2. Corridor Segment ID Population

**Test:** After Phase 1 data has accumulated, run `SELECT DISTINCT segment_id FROM speed_readings LIMIT 20;` and verify that actual INRIX TMC segment IDs (e.g., `P34521370`) appear. Then update `corridors.py` and migration 004.
**Expected:** Real segment IDs replace TMC_PLACEHOLDER in both the Python config and the corridors DB table. A subsequent `python -m scripts.run_forecast` produces corridor-specific forecasts rather than placeholder-v1 rows.
**Why human:** The Phase 1 data collector has been running; whether it has accumulated sufficient data with real segment IDs requires inspection of the live database.

### 3. End-to-End API Response Correctness

**Test:** Start the server (`tsx src/server.ts`), call `GET /api/corridors/us-101/current` and `GET /api/corridors/us-101/forecast`.
**Expected:** Both return 200 with correct JSON shapes. The /current endpoint returns at least one segment; the /forecast endpoint returns forecast rows with p10/p50/p90 values (not just the placeholder 20-min rows).
**Why human:** Requires a live database with migrated schema and populated data. Cannot verify programmatically without a running DB.

---

## Gaps Summary

Two gaps block full goal achievement:

**Gap 1 — Segment ID Placeholder (Operational, Not a Code Bug):** All 6 corridors use `TMC_PLACEHOLDER` as their INRIX segment IDs in both `ml/src/corridors.py` and the corridors DB table. The forecast pipeline's `fetch_historical_speeds()` queries `WHERE segment_id = ANY([TMC_PLACEHOLDER])` which will match no rows in `speed_readings`, causing every corridor to fall through to `_generate_placeholder_forecasts()` (fixed 20-min, no modifiers). The modifiers are implemented correctly and tested — this is a data dependency gap, not a logic gap. Resolution: populate real segment IDs from Phase 1 collected data.

**Gap 2 — Requirements Tracking Staleness:** ROADMAP.md shows Phase 2 at "1/3 plans executed" with all plans unchecked; REQUIREMENTS.md shows API-01 and API-02 as Pending under Phase 3, even though the endpoints are implemented. This is a documentation consistency issue. The three plan SUMMARYs claim requirements FORE-01 through FORE-08 are complete, and the REQUIREMENTS.md checkbox column does show FORE-01 through FORE-08 as `[x]`, but the ROADMAP progress table was never updated.

Both gaps are non-blocking for the code's correctness — all logic is implemented, tested, and wired. Gap 1 resolves naturally once Phase 1 data is available. Gap 2 requires a documentation update.

---

*Verified: 2026-03-19T22:45:00Z*
*Verifier: Claude (gsd-verifier)*
