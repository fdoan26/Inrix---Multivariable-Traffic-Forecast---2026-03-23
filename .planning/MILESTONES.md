# Milestones

## v1.0 MVP (Shipped: 2026-03-23)

**Phases completed:** 6 phases (1–6), 14 plans
**Lines of code:** ~6,300 (TypeScript + Python)
**Timeline:** 2026-03-19 → 2026-03-23
**Tests:** ~281 passing across all phases

**Delivered:** A complete week-ahead SF traffic forecasting system — from INRIX data collection through ML forecasting, REST API, interactive Mapbox map, departure planner, and forecast accuracy dashboard.

**Key accomplishments:**

1. **Full data pipeline** — INRIX speed/incident collectors, Open-Meteo weather, school calendar, and events seed all flowing into TimescaleDB with a 1,600-call/week budget hard stop
2. **ML forecasting pipeline** — Baseline + XGBoost two-tier model for 6 SF corridors with weather/event/school modifiers and p10/p50/p90 confidence intervals, refreshed every 6 hours
3. **REST API layer** — 5 Express endpoints (current speeds, forecast, departure windows, incidents, accuracy) with CORS, error middleware, Zod validation, and TTL cache
4. **Interactive map and live view** — Mapbox GL JS dark map with 6 color-coded corridor polylines, real-time 5-min auto-refresh, and INRIX incident markers with popups
5. **Departure planner and week-ahead heatmap** — 7×17 heatmap grid, departure planner form with Zod validation, ranked windows with amber-highlighted best time and modifier reason text
6. **Accuracy tracking dashboard** — `forecast_outcomes` table with GENERATED error columns, batch outcome-logger CLI, `/api/accuracy` endpoint with MAE/MAPE/trend/DOW breakdown, and AccuracyDashboard component

**Tech debt carried forward:**
- TD-01: `logOutcomes()` not yet scheduled in `worker.ts` (CLI works; cron wiring needed)
- TD-02: TMC_PLACEHOLDER segment IDs in `ml/src/corridors.py` (resolves after Phase 1 data accumulates)
- TD-03: `INCIDENT_TYPE_MAP` exported in `types/api.ts` but not consumed by `IncidentMarker`/`IncidentPopup`

**Archive:** `.planning/milestones/v1.0-ROADMAP.md`, `.planning/milestones/v1.0-REQUIREMENTS.md`

---
