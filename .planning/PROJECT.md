# SF Traffic Forecaster

## What This Is

A week-ahead traffic forecasting tool for San Francisco that outperforms Google Maps and Apple Maps by explicitly modeling weather forecasts, local events, school calendars, and construction — signals those apps ignore in their predictions. Targets SF commuters, logistics managers, and anyone making time-sensitive drives who needs a confidence range and a planning horizon, not just a single reactive ETA.

## Core Value

Give SF drivers a genuinely useful week-ahead departure planner with confidence intervals — something Google and Apple cannot offer because they only react to conditions in real-time.

## Requirements

### Validated

- ✓ System collects SF segment speeds from INRIX bounding-box endpoint on schedule — Phase 1
- ✓ INRIX call budget enforced (hard stop at 1,600/week) — Phase 1
- ✓ Segment speeds stored in TimescaleDB hypertable with all required fields — Phase 1
- ✓ INRIX incidents collected and stored separately — Phase 1
- ✓ Open-Meteo 7-day weather forecasts fetched daily and stored — Phase 1
- ✓ SFUSD school calendar ingested with date-level flags — Phase 1
- ✓ Local event calendar ingested (Giants/Warriors/concerts) — Phase 1
- ✓ Week-ahead congestion forecast pipeline (baseline + XGBoost) for all 6 SF corridors — Phase 2
- ✓ Weather/event/school modifiers applied to baseline forecast — Phase 2
- ✓ Confidence intervals (p10/p50/p90) via bootstrap method — Phase 2
- ✓ Short-term (0–2hr) INRIX Duration forecast stored in speed_readings — Phase 2
- ✓ 6-hour forecast refresh cycle (cron-ready CLI script) — Phase 2
- ✓ REST API endpoints: current corridor speeds (API-01) and week-ahead forecasts (API-02) — Phase 2

### Active

- [ ] Real-time SF segment speeds via INRIX API (geo-locked to SF bounding box)
- [ ] "Best time to drive" planner — origin/destination + desired arrival → recommended departure window with congestion risk score across the week
- [ ] INRIX incidents layer — real-time crashes, construction, and congestion alerts on map
- [ ] Actual vs predicted tracking — log real outcomes to validate and improve the model
- [ ] TMC segment IDs needed — replace TMC_PLACEHOLDER in corridors.py with real IDs from `SELECT DISTINCT segment_id FROM speed_readings` once Phase 1 data accumulates

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

## Constraints

- **API Rate Limit**: INRIX trial — 1 RPS, 2000 calls/week. Data collection jobs must be designed around this.
- **Geo-lock**: INRIX trial key restricted to SF bounding box (37.858,-122.541 → 37.699,-122.341).
- **Budget**: Free/low-cost only — Open-Meteo (free), Railway/Render free tier for backend, Vercel for frontend.
- **Team**: Solo developer — keep infrastructure simple, avoid operational overhead.
- **Timeline**: Working demo target within 4–6 weeks across 6 phases.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Node.js (Express) for backend | API orchestration + data collection jobs; familiar stack | — Pending |
| PostgreSQL + TimescaleDB | Time-series optimized; INRIX readings need efficient range queries | — Pending |
| Python microservice for ML | scikit-learn/XGBoost ecosystem; clean separation from Node backend | — Pending |
| React + Mapbox GL JS for frontend | Interactive map rendering; Mapbox free tier sufficient for dev | — Pending |
| Open-Meteo over paid weather APIs | Free, no key, 7-day hourly forecast meets all requirements | — Pending |
| Manual Google Maps benchmarking | ToS risk + fragility of scraping outweighs comparison value in MVP | — Pending |

---
*Last updated: 2026-03-19 after Phase 2: Forecasting Model complete*
