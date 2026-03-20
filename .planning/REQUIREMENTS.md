# Requirements: SF Traffic Forecaster

**Defined:** 2026-03-19
**Core Value:** Give SF drivers a planning-horizon departure tool with confidence intervals -- something Google/Apple cannot offer because they only react to real-time conditions.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Data Pipeline

- [x] **DATA-01**: System collects SF segment speeds from INRIX bounding-box endpoint on a scheduled basis
- [x] **DATA-02**: INRIX call budget stays within 2000 calls/week (budget tracker enforced before each job run)
- [x] **DATA-03**: Collected readings stored in TimescaleDB hypertable with segment ID, timestamp, speed, free-flow speed, historical average, and congestion score
- [x] **DATA-04**: INRIX incidents (crashes, construction, congestion alerts) collected and stored separately
- [x] **DATA-05**: Open-Meteo 7-day hourly weather forecast fetched daily and stored (temperature, precipitation, visibility/fog)
- [x] **DATA-06**: SFUSD school calendar ingested (school day vs. break vs. holiday flags by date)
- [x] **DATA-07**: Local event calendar ingested -- Giants/Warriors games, major concerts, Outside Lands flagged as high-congestion days

### Forecasting Model

- [x] **FORE-01**: Baseline forecast derived from historical average speed for a given corridor x day-of-week x hour-of-day
- [x] **FORE-02**: Weather modifier applied to baseline -- rain and fog reduce predicted speed on SF surface streets
- [x] **FORE-03**: Event modifier applied -- flagged event days shift predicted speeds on affected corridors
- [x] **FORE-04**: School calendar modifier applied -- SFUSD school days vs. breaks shift morning rush predictions
- [x] **FORE-05**: Week-ahead forecast generated for each major SF corridor (101, 280, Bay Bridge approach, Van Ness, 19th Ave, Market St)
- [x] **FORE-06**: Confidence intervals computed for each prediction -- displayed as range + most-likely value (e.g., "32-44 min, most likely 36")
- [x] **FORE-07**: Short-term (0-2hr) forecast uses INRIX Duration parameter (built-in)
- [x] **FORE-08**: Forecast refreshed on a scheduled basis (every 6 hours minimum)

### Map & Visualization

- [x] **MAP-01**: Interactive Mapbox GL JS map centered on SF showing major corridors
- [x] **MAP-02**: Live segment speed overlay -- color-coded by congestion level (green/yellow/red)
- [x] **MAP-03**: INRIX incidents layer -- crashes, construction, congestion alerts displayed on map
- [x] **MAP-04**: Week-ahead corridor heatmap -- 7-day x time-slot grid per corridor showing predicted congestion
- [x] **MAP-05**: Confidence interval display alongside predicted travel times

### Departure Planner

- [x] **PLAN-01**: User inputs origin, destination, and desired arrival time
- [x] **PLAN-02**: System returns recommended departure windows across the week with congestion risk score
- [x] **PLAN-03**: Best departure time highlighted with "Slow due to [reason]" explanations where modifiers apply

### Validation

- [ ] **VAL-01**: Actual travel times logged against predicted values for each forecast
- [ ] **VAL-02**: Prediction accuracy metrics viewable (MAE, MAPE per corridor)

### API Layer

- [x] **API-01**: REST API endpoint serving current corridor speeds
- [x] **API-02**: REST API endpoint serving week-ahead forecast for a given corridor
- [x] **API-03**: REST API endpoint serving best departure windows for origin/destination pair

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Alerts

- **ALRT-01**: User can subscribe to alerts for their regular commute corridor
- **ALRT-02**: Email or push notification when predicted congestion exceeds threshold on a saved route

### Mobile

- **MOBL-01**: Progressive web app (PWA) installable on mobile
- **MOBL-02**: Native iOS/Android app

### Multi-City

- **MULTI-01**: Extend coverage beyond SF bounding box to East Bay / South Bay
- **MULTI-02**: Support non-INRIX data sources for non-trial coverage

## Out of Scope

| Feature | Reason |
|---------|--------|
| Live Google Maps comparison layer | Against ToS for programmatic use; manual benchmarking used instead |
| Turn-by-turn navigation | Product is a planner, not a navigator; would compete with well-funded apps |
| Real-time chat / social features | No community value in traffic forecasting MVP |
| OAuth / user accounts | Anonymous use is fine for v1; accounts add complexity without core value |
| Video or rich media content | Not relevant to traffic forecasting |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| DATA-01 | Phase 1 | Complete |
| DATA-02 | Phase 1 | Complete |
| DATA-03 | Phase 1 | Complete |
| DATA-04 | Phase 1 | Complete |
| DATA-05 | Phase 1 | Complete |
| DATA-06 | Phase 1 | Complete |
| DATA-07 | Phase 1 | Complete |
| FORE-01 | Phase 2 | Complete |
| FORE-02 | Phase 2 | Complete |
| FORE-03 | Phase 2 | Complete |
| FORE-04 | Phase 2 | Complete |
| FORE-05 | Phase 2 | Complete |
| FORE-06 | Phase 2 | Complete |
| FORE-07 | Phase 2 | Complete |
| FORE-08 | Phase 2 | Complete |
| API-01 | Phase 3 | Complete |
| API-02 | Phase 3 | Complete |
| API-03 | Phase 3 | Complete |
| MAP-01 | Phase 4 | Complete |
| MAP-02 | Phase 4 | Complete |
| MAP-03 | Phase 4 | Complete |
| MAP-04 | Phase 5 | Complete |
| MAP-05 | Phase 5 | Complete |
| PLAN-01 | Phase 5 | Complete |
| PLAN-02 | Phase 5 | Complete |
| PLAN-03 | Phase 5 | Complete |
| VAL-01 | Phase 6 | Pending |
| VAL-02 | Phase 6 | Pending |

**Coverage:**
- v1 requirements: 27 total
- Mapped to phases: 27
- Unmapped: 0

---
*Requirements defined: 2026-03-19*
*Last updated: 2026-03-19 after roadmap creation*
