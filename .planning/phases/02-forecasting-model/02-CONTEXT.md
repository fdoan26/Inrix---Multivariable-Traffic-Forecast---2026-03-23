# Phase 2: Forecasting Model - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 2 delivers the forecasting pipeline: a Python ML microservice that reads from TimescaleDB (speed_readings, weather_forecasts, calendar_flags), generates week-ahead corridor forecasts with confidence intervals (p10/p50/p90), stores results back in a forecasts hypertable, and refreshes every 6 hours. Also delivers Node.js REST API endpoints for current corridor speeds (API-01) and week-ahead forecasts (API-02). No frontend in this phase.

</domain>

<decisions>
## Implementation Decisions

### ML Approach & Cold-Start Strategy
- Deploy historical average baseline immediately (day-of-week × hour × corridor) — no training data needed, ships on day 1
- Upgrade to XGBoost (scikit-learn wrapper) when 2+ weeks of speed_readings data has accumulated
- Python microservice owns all feature assembly — weather/events/school joined in Python before training/inference
- Weekly manual retrain for MVP — trigger script, no automated scheduler

### Python Service Architecture
- Node ↔ Python communication via shared TimescaleDB — Python reads raw data tables, writes to forecasts table; Node only reads forecasts table. No HTTP between services.
- Script-based Python service — cron-invoked scripts (not a long-running FastAPI server) for MVP simplicity
- Model artifacts stored on local filesystem in `ml/models/` directory (.pkl files)
- `ml/` directory at repo root, peer to `backend/`, with own `requirements.txt` and `pyproject.toml`

### Confidence Intervals
- Bootstrap method from historical variance (day × hour × corridor) — simple, no extra model complexity during baseline phase
- 80% prediction interval (p10 to p90) — wide enough to be honest, narrow enough to be actionable
- Display format: "32–44 min (most likely 36)" — exactly as specified in PROJECT.md
- Store p10_minutes, p50_minutes, p90_minutes as separate columns in forecasts table — queryable and flexible

### Forecast Schema & Refresh
- Forecasts table columns: corridor_id, forecast_for (timestamp), predicted_minutes (= p50), p10_minutes, p50_minutes, p90_minutes, model_version, weather_modifier, event_modifier, school_modifier, created_at
- Forecast refresh: separate Python cron script every 6 hours — independent from data collection worker
- INRIX Duration (short-term 0-2hr): called from Node.js collector at collection time, duration_minutes stored in speed_readings table — reuses existing auth/budget infrastructure
- API-01 (current corridor speeds) and API-02 (week-ahead forecast) both built in Phase 2 — API layer is needed before Phase 3 map can consume live data

### Claude's Discretion
- Specific XGBoost hyperparameter defaults
- Python script entry points and CLI argument structure
- Exact corridor_id format (string slug vs integer)
- Walk-forward validation split ratio for model evaluation
- TimescaleDB migration numbering (003+)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/src/services/inrix-auth.ts` — INRIX auth with token caching (Node.js; Python makes its own DB-only queries, no INRIX from Python)
- `backend/src/services/budget-tracker.ts` — budget tracker (Node.js; Python doesn't call INRIX directly)
- `backend/src/services/retry.ts` — retry utility (Node.js)
- `backend/src/db/connection.ts` — pg pool connection pattern to replicate in Python (psycopg2)
- `backend/src/db/migrations/001_create-extension-and-tables.sql` — existing schema; Phase 2 adds migration 003 for forecasts table

### Established Patterns
- TimescaleDB hypertables with chunk_time_interval (see migration 001)
- Zod validation schemas for external API responses
- vitest for Node.js tests; pytest for Python
- node-cron for Node.js scheduling; Python uses schedule library or cron entries
- Separate `__tests__/` directories per module

### Integration Points
- Python reads: `speed_readings`, `weather_forecasts`, `calendar_flags` tables
- Python writes: `forecasts` hypertable (migration 003)
- Node.js API reads: `forecasts` table + `speed_readings` (for API-01 current speeds)
- Node.js API adds new Express routes in `backend/src/api/` — new directory

</code_context>

<specifics>
## Specific Ideas

- Target corridors for forecasts: US-101 N/S, I-280 N/S, Bay Bridge approach (I-80 W), Van Ness Ave N/S, 19th Ave N/S, Market St E/W — 6 corridors, each a named segment group
- Confidence interval example from PROJECT.md: "32–44 min (most likely 36)"
- INRIX Duration param: built-in 0-2hr forecast via the Duration query parameter on the speeds endpoint — Phase 1 collector may not currently use it; Phase 2 ensures it's stored as `duration_minutes` in speed_readings
- Week-ahead means 7 days × 24 hours = 168 forecast slots per corridor = 1,008 rows per refresh cycle

</specifics>

<deferred>
## Deferred Ideas

- Automated XGBoost retraining pipeline — manual trigger sufficient for MVP; automation is v2
- FastAPI server for Python ML service — script-based cron is sufficient for MVP
- MLflow experiment tracking — overkill for MVP
- Real-time model drift detection — v2 feature

</deferred>
