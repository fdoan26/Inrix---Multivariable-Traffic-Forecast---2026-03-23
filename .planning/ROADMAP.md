# Roadmap: SF Traffic Forecaster

## Overview

This roadmap delivers a week-ahead traffic forecasting tool for San Francisco in six phases. The data pipeline runs first because the ML model needs 2-4 weeks of accumulated historical data before producing meaningful predictions -- every day of delay pushes out the first usable forecast. From there, phases build vertically: forecasting model, API layer, frontend visualization, departure planner, and finally validation. Each phase delivers a complete, verifiable capability that unlocks the next.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Data Pipeline** - INRIX, weather, events, and school calendar data flowing into TimescaleDB within rate limits (completed 2026-03-19)
- [ ] **Phase 2: Forecasting Model** - Week-ahead corridor forecasts with confidence intervals generated from collected data
- [ ] **Phase 3: API Layer** - REST endpoints serving live speeds, forecasts, and incidents
- [ ] **Phase 4: Map and Live View** - Interactive Mapbox map with live traffic overlay and incidents
- [ ] **Phase 5: Departure Planner and Week-Ahead View** - Best departure time recommender and corridor heatmap visualization
- [ ] **Phase 6: Validation and Accuracy Tracking** - Actual vs predicted logging with accuracy metrics dashboard

## Phase Details

### Phase 1: Data Pipeline
**Goal**: All external data sources flowing into the database on schedule, within INRIX rate limits, accumulating the historical data the forecast model needs
**Depends on**: Nothing (first phase)
**Requirements**: DATA-01, DATA-02, DATA-03, DATA-04, DATA-05, DATA-06, DATA-07
**Success Criteria** (what must be TRUE):
  1. INRIX segment speeds for the SF bounding box are collected on a recurring schedule and stored in TimescaleDB with segment ID, timestamp, speed, free-flow speed, historical average, and congestion score
  2. INRIX call budget tracker prevents exceeding 2000 calls/week -- jobs refuse to run when budget is exhausted
  3. INRIX incidents (crashes, construction, congestion alerts) are collected and stored separately from speed readings
  4. Open-Meteo 7-day hourly weather forecasts (temperature, precipitation, visibility/fog) are fetched daily and stored
  5. SFUSD school calendar and local event calendar (Giants/Warriors games, major concerts) are ingested with date-level flags
**Plans:** 4/4 plans complete

Plans:
- [x] 01-01-PLAN.md -- Project scaffold, DB schema, core services (INRIX auth, budget tracker, retry, Zod schemas)
- [x] 01-02-PLAN.md -- INRIX speed collector, incident collector, and Open-Meteo weather collector
- [x] 01-03-PLAN.md -- School calendar and event seed scripts, worker process with cron scheduling
- [x] 01-04-PLAN.md -- Gap closure: fix TypeScript strict-mode errors in collector test files

### Phase 2: Forecasting Model
**Goal**: The system generates week-ahead congestion forecasts with confidence intervals for every major SF corridor, refreshed on a scheduled basis
**Depends on**: Phase 1
**Requirements**: FORE-01, FORE-02, FORE-03, FORE-04, FORE-05, FORE-06, FORE-07, FORE-08
**Success Criteria** (what must be TRUE):
  1. Week-ahead forecast exists for each major SF corridor (101, 280, Bay Bridge approach, Van Ness, 19th Ave, Market St) broken down by day-of-week and hour-of-day
  2. Each prediction includes a confidence interval displayed as range plus most-likely value (e.g., "32-44 min, most likely 36") rather than a single number
  3. Weather (rain/fog), event days (games/concerts), and school calendar (SFUSD school days vs breaks) each visibly modify predictions compared to a plain baseline
  4. Short-term forecasts (0-2hr) use INRIX built-in Duration parameter; week-ahead uses the trained model with all modifiers
  5. Forecasts refresh automatically on a scheduled basis (every 6 hours minimum)
**Plans**: TBD

Plans:
- [ ] 02-01: TBD
- [ ] 02-02: TBD
- [ ] 02-03: TBD

### Phase 3: API Layer
**Goal**: Pre-computed forecasts and live data are accessible through a REST API with sub-200ms response times
**Depends on**: Phase 2
**Requirements**: API-01, API-02, API-03
**Success Criteria** (what must be TRUE):
  1. GET endpoint returns current corridor speeds with congestion level for any major SF corridor
  2. GET endpoint returns week-ahead forecast (with confidence intervals) for a given corridor, day, and hour
  3. GET endpoint accepts origin/destination pair and desired arrival time, returning recommended departure windows with congestion risk scores
  4. All endpoints respond in under 200ms by serving pre-computed data from the database (no ML inference in the request path)
**Plans**: TBD

Plans:
- [ ] 03-01: TBD

### Phase 4: Map and Live View
**Goal**: Users see an interactive map of SF with real-time traffic conditions and incidents, building trust before they rely on forecasts
**Depends on**: Phase 3
**Requirements**: MAP-01, MAP-02, MAP-03
**Success Criteria** (what must be TRUE):
  1. Interactive Mapbox map loads centered on SF showing the major corridors (101, 280, Bay Bridge approach, Van Ness, 19th Ave, Market St)
  2. Live segment speeds are color-coded on the map by congestion level (green/yellow/red) and update automatically
  3. INRIX incidents (crashes, construction, congestion alerts) are displayed as markers on the map with detail popups
  4. Map is mobile-responsive -- usable on phone screens without horizontal scrolling or broken layout
**Plans**: TBD

Plans:
- [ ] 04-01: TBD
- [ ] 04-02: TBD

### Phase 5: Departure Planner and Week-Ahead View
**Goal**: Users can plan their week's driving with a corridor heatmap and a departure time recommender that explains why certain times are slow
**Depends on**: Phase 4
**Requirements**: MAP-04, MAP-05, PLAN-01, PLAN-02, PLAN-03
**Success Criteria** (what must be TRUE):
  1. Week-ahead corridor heatmap displays a 7-day by time-slot grid per corridor showing predicted congestion levels at a glance
  2. Confidence intervals are displayed alongside predicted travel times in the heatmap and forecast views
  3. User can input origin, destination, and desired arrival time to get recommended departure windows across the week
  4. Best departure time is highlighted with explanations like "Slow due to rain forecast" or "Slow due to Giants game" where modifiers apply
**Plans**: TBD

Plans:
- [ ] 05-01: TBD
- [ ] 05-02: TBD

### Phase 6: Validation and Accuracy Tracking
**Goal**: Users and the developer can see how accurate forecasts are, and the system logs outcomes to enable model improvement
**Depends on**: Phase 5
**Requirements**: VAL-01, VAL-02
**Success Criteria** (what must be TRUE):
  1. Actual travel times are logged against predicted values for each forecast window automatically
  2. Prediction accuracy metrics (MAE, MAPE per corridor) are viewable in a dashboard or summary page
  3. Accuracy data covers enough history to show whether the model is improving or degrading over time
**Plans**: TBD

Plans:
- [ ] 06-01: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Data Pipeline | 4/4 | Complete    | 2026-03-19 |
| 2. Forecasting Model | 0/3 | Not started | - |
| 3. API Layer | 0/1 | Not started | - |
| 4. Map and Live View | 0/2 | Not started | - |
| 5. Departure Planner and Week-Ahead View | 0/2 | Not started | - |
| 6. Validation and Accuracy Tracking | 0/1 | Not started | - |
