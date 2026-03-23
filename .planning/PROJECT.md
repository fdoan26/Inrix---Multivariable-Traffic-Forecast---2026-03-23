# SF Traffic Forecaster

## What This Is

A week-ahead traffic forecasting tool for San Francisco that outperforms Google Maps and Apple Maps by explicitly modeling weather forecasts, local events, school calendars, and construction — signals those apps ignore in their predictions. Targets SF commuters, logistics managers, and anyone making time-sensitive drives who needs a confidence range and a planning horizon, not just a single reactive ETA.

v1.0 shipped with a complete pipeline: INRIX data collection → TimescaleDB → ML forecasting (baseline + XGBoost) → REST API → React/Mapbox frontend with departure planner and accuracy dashboard.

## Core Value

Give SF drivers a genuinely useful week-ahead departure planner with confidence intervals — something Google and Apple cannot offer because they only react to conditions in real-time.

## Requirements

### Validated (v1.0)

- ✓ System collects SF segment speeds from INRIX bounding-box endpoint on schedule — v1.0 Phase 1
- ✓ INRIX call budget enforced (hard stop at 1,600/week) — v1.0 Phase 1
- ✓ Segment speeds stored in TimescaleDB hypertable with all required fields — v1.0 Phase 1
- ✓ INRIX incidents collected and stored separately — v1.0 Phase 1
- ✓ Open-Meteo 7-day weather forecasts fetched daily and stored — v1.0 Phase 1
- ✓ SFUSD school calendar ingested with date-level flags — v1.0 Phase 1
- ✓ Local event calendar ingested (Giants/Warriors/concerts) — v1.0 Phase 1
- ✓ Week-ahead congestion forecast pipeline (baseline + XGBoost) for all 6 SF corridors — v1.0 Phase 2
- ✓ Weather/event/school modifiers applied to baseline forecast — v1.0 Phase 2
- ✓ Confidence intervals (p10/p50/p90) via bootstrap method — v1.0 Phase 2
- ✓ Short-term (0–2hr) INRIX Duration forecast stored in speed_readings — v1.0 Phase 2
- ✓ 6-hour forecast refresh cycle (cron-ready CLI script) — v1.0 Phase 2
- ✓ REST API endpoints: current corridor speeds (API-01) and week-ahead forecasts (API-02) — v1.0 Phase 2
- ✓ Departure-windows endpoint (API-03) with Zod validation, congestion risk, and reason derivation — v1.0 Phase 3
- ✓ In-memory TTL cache service (6-hour TTL aligned to forecast refresh) — v1.0 Phase 3
- ✓ CORS middleware + centralized error handler (Express 5 error propagation) — v1.0 Phase 3
- ✓ React 19 + Vite 8 + TypeScript frontend scaffold with Tailwind CSS v4 — v1.0 Phase 4
- ✓ Mapbox GL JS map of SF with 6 color-coded corridor polylines (green/amber/red by congestion) — v1.0 Phase 4
- ✓ TanStack Query live speed overlay with 5-minute auto-refresh — v1.0 Phase 4
- ✓ INRIX incidents layer — real-time crashes, construction, and congestion markers with popup details — v1.0 Phase 4
- ✓ Responsive floating panel (desktop sidebar / mobile bottom drawer) — v1.0 Phase 4
- ✓ GET /api/incidents backend endpoint (24h window, non-Cleared, limit 100) — v1.0 Phase 4
- ✓ Week-ahead corridor heatmap — 7-day × 17-hour grid (6am–10pm) color-coded by predicted congestion — v1.0 Phase 5
- ✓ Confidence intervals displayed as tooltip (heatmap) and inline range "X min (Y–Z)" (departure results) — v1.0 Phase 5
- ✓ Departure planner form — corridor dropdown, arrival date+time, Zod validation — v1.0 Phase 5
- ✓ Ranked departure windows with congestion badges, best result highlighted, modifier reason text — v1.0 Phase 5
- ✓ Live/Plan tab navigation added to CorridorPanel — v1.0 Phase 5
- ✓ forecast_outcomes table with GENERATED ALWAYS computed error columns — v1.0 Phase 6
- ✓ Outcome logger CLI script comparing forecasts vs observed speed_readings (batch SQL, idempotent) — v1.0 Phase 6
- ✓ GET /api/accuracy endpoint — per-corridor MAE, MAPE, trend (improving/degrading/stable), day-of-week breakdown — v1.0 Phase 6
- ✓ AccuracyDashboard with expand/collapse day-of-week, graceful empty state, trend badges — v1.0 Phase 6
- ✓ Live/Plan/Accuracy three-tab CorridorPanel — v1.0 Phase 6

### Active (v1.1 candidates)

- [ ] TMC segment IDs — replace TMC_PLACEHOLDER in corridors.py with real IDs from `SELECT DISTINCT segment_id FROM speed_readings` once Phase 1 data accumulates
- [ ] Run outcome logger after forecast data accumulates (7+ days) — add daily cron schedule to `worker.ts`
- [ ] Connect `INCIDENT_TYPE_MAP` in `types/api.ts` to `IncidentMarker`/`IncidentPopup` display logic

### Out of Scope

- Live Google Maps comparison layer — against ToS for programmatic use; replaced by manual benchmarking during validation
- Mobile app — web-first, mobile is a future concern
- Multi-city support — INRIX trial key is geo-locked to SF bounding box

## Context

- INRIX IQ API trial credentials are in hand (appId + hashToken). SF bounding box: `37.858,-122.541 → 37.699,-122.341`. Rate limits: 1 RPS, 2000 calls/week.
- INRIX provides: current speed, historical average (baseline), free-flow reference, built-in 0–2hr forecast via Duration param, route travel times by day/hour, and incidents with delay trend + advance warning flags.
- Open-Meteo is free with no API key — 7-day hourly forecast for SF coordinates.
- Forecasting model logic:
  - Short-term (0–2hr): INRIX Duration param (built-in)
  - Medium-term (2–24hr): Baseline + recent drift multiplier
  - Week-ahead: Baseline + weather modifier + event modifier + school day modifier
  - Confidence intervals: Bootstrap from historical variance for that day/hour combination
- Competitive gap: Google/Apple only observe weather effects in real-time via probe data — they do not use weather forecasts to pre-emptively predict slower traffic, show no confidence intervals, and have no week-ahead planning view.
- Google Maps comparison will be done via manual benchmarking (logging ETAs for specific routes during validation), not a live in-app layer.
- v1.0 shipped: ~6,300 LOC (TypeScript + Python), ~281 tests passing, 14 plans executed across 6 phases.
- Known: TMC_PLACEHOLDER segment IDs are in use until Phase 1 data accumulates — forecasts are placeholder (20-min default) until real segment IDs are populated.

## Constraints

- **API Rate Limit**: INRIX trial — 1 RPS, 2000 calls/week. Data collection jobs must be designed around this.
- **Geo-lock**: INRIX trial key restricted to SF bounding box (37.858,-122.541 → 37.699,-122.341).
- **Budget**: Free/low-cost only — Open-Meteo (free), Railway/Render free tier for backend, Vercel for frontend.
- **Team**: Solo developer — keep infrastructure simple, avoid operational overhead.
- **Timeline**: Working demo target within 4–6 weeks across 6 phases. ✅ v1.0 shipped.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Node.js (Express) for backend | API orchestration + data collection jobs; familiar stack | ✓ Good — Express 5 async propagation, Router-per-resource pattern worked well |
| PostgreSQL + TimescaleDB | Time-series optimized; INRIX readings need efficient range queries | ✓ Good — hypertables, ON CONFLICT upserts, GENERATED ALWAYS columns all used effectively |
| Python microservice for ML | scikit-learn/XGBoost ecosystem; clean separation from Node backend | ✓ Good — clean boundary; `run_forecast.py` CLI called from cron independently |
| React + Mapbox GL JS for frontend | Interactive map rendering; Mapbox free tier sufficient for dev | ✓ Good — react-map-gl/mapbox v3 import path was non-obvious but worked |
| Open-Meteo over paid weather APIs | Free, no key, 7-day hourly forecast meets all requirements | ✓ Good — zero friction, API stable |
| Manual Google Maps benchmarking | ToS risk + fragility of scraping outweighs comparison value in MVP | ✓ Good — not needed for v1.0 |
| Tailwind v4 (CSS @import, no config.js) | v4 breaks v3 config patterns; @tailwindcss/vite plugin required | ✓ Good — documented in STATE.md |
| TanStack Query v5 (useQuery + useQueries) | v5 breaks v4 API; `useQueries` for parallel corridor queries | ✓ Good — `enabled` flag for conditional fetching worked cleanly |
| Zod v4 (`.issues` not `.errors`) | v4 breaking change; `.issues` array replaces `.errors` | ✓ Good — caught and fixed during Phase 5 execution |
| Outcome logger as CLI (not worker-integrated) | Low priority; historical data only; safe to run manually | ⚠️ Revisit — `worker.ts` cron wiring needed before accuracy dashboard becomes useful |
| TMC_PLACEHOLDER in corridors.py | Phase 1 data not accumulated at time of Phase 2 planning | ⚠️ Revisit — resolve after `SELECT DISTINCT segment_id FROM speed_readings` has real data |

---
*Last updated: 2026-03-23 after v1.0 MVP milestone complete — all 6 phases shipped*
