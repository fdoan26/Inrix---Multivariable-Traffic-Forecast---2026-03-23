# Project Research Summary

**Project:** SF Traffic Forecaster
**Domain:** Real-time + predictive traffic forecasting (week-ahead, SF-specific)
**Researched:** 2026-03-19
**Confidence:** MEDIUM-HIGH

## Executive Summary

The SF Traffic Forecaster is a week-ahead traffic prediction tool that fills a gap no consumer app currently addresses: proactive commute planning with uncertainty quantification. Google Maps, Waze, and Apple Maps optimize for "leave now" navigation; nobody serves "plan your week's driving." The recommended approach is a polyglot system -- a Node.js API backend handling data collection and serving, a Python microservice for ML forecasting with XGBoost, a React/Mapbox frontend for visualization, and PostgreSQL with TimescaleDB for unified time-series and relational storage. This architecture keeps all data in one database while leveraging the best ML ecosystem (Python) and the best web ecosystem (TypeScript/React) for their respective strengths.

The core technical challenge is not the ML model itself -- XGBoost with good feature engineering will outperform more complex approaches at this data scale. The challenge is the INRIX trial API's brutal constraint: 2000 calls/week at 1 RPS. The entire data pipeline must be engineered around this budget from day one, using bounding-box batch endpoints instead of per-segment polling. The second challenge is the cold-start problem: the forecast model needs 2-4 weeks of accumulated historical data before it can produce meaningful predictions, which means the data pipeline must be the very first thing built and running.

Key risks are threefold. First, burning through INRIX quota in days due to naive per-segment polling (mitigated by batch bounding-box calls and adaptive scheduling). Second, producing confidence intervals that are either too wide to be useful or too narrow to be honest -- this is the product's core differentiator, so getting it wrong undermines the entire value proposition (mitigated by quantile regression or conformal prediction, validated by interval coverage testing). Third, data leakage in time-series train/test splits creating falsely optimistic model metrics that collapse in production (mitigated by strict chronological splits and walk-forward validation).

## Key Findings

### Recommended Stack

The stack splits cleanly along language boundaries: TypeScript for everything web-facing (Node.js backend, React frontend), Python for everything ML (FastAPI microservice, XGBoost, scikit-learn, pandas). PostgreSQL with TimescaleDB unifies time-series storage and relational data, avoiding the operational burden of running two databases. The frontend uses Mapbox GL JS for map rendering and Recharts for forecast visualization.

**Core technologies:**
- **Node.js 24 LTS + Express 5 + TypeScript:** API gateway, data collection orchestration, INRIX/weather polling via cron jobs
- **PostgreSQL 16 + TimescaleDB 2.x:** Single database for time-series readings (hypertables), weather forecasts, events, school calendar, and forecast results
- **Python 3.12 + FastAPI + XGBoost:** ML microservice for feature engineering, model training, and batch forecast generation
- **React 19 + Vite 8 + Mapbox GL JS 3.x:** SPA with interactive traffic map, corridor heatmaps, and forecast charts
- **TanStack Query 5.x + Zustand 5.x:** Server state caching (5-min poll interval for live data) and lightweight client state
- **zod 4.x:** Runtime validation of INRIX/Open-Meteo API responses to catch contract changes before data corruption

### Expected Features

**Must have (table stakes):**
- Interactive map with traffic color overlay -- users orient around a map
- Current traffic conditions display -- builds trust before users rely on forecasts
- Day/time selector for future lookup -- minimum forecast interaction
- Mobile-responsive layout -- SF commuters check on phones

**Should have (differentiators -- these ARE the product):**
- Week-ahead corridor forecast heatmap -- the signature view, no competitor offers this
- Confidence intervals on travel times -- "32-44 min, most likely 36" vs Google's false-precision single number
- Weather-adjusted forecasts -- proactive (uses forecast) vs reactive (sees rain slowdown after it happens)
- Best departure time recommender -- "leave at 7:10 AM Tuesday" across the full week

**Defer (v2+):**
- Origin-destination route planner -- corridor-based view is sufficient for MVP
- Push notifications / email alerts -- requires user accounts and background infrastructure
- Multi-city support -- INRIX trial key is geo-locked to SF; multi-city requires paid contract
- Native mobile app -- mobile-responsive PWA first; native only if DAU justifies it
- Turn-by-turn navigation -- completely different product; "we tell you when to leave, Google tells you how to get there"

### Architecture Approach

The system is a four-layer architecture: data collection (independent pollers for INRIX, weather, events, school calendar), storage (PostgreSQL+TimescaleDB with hypertables), ML/forecast (Python service that reads a pre-computed feature table and writes forecast results on a 6-hour schedule), and API+frontend (Node.js serves pre-computed forecasts from the database; React renders map and charts). The critical architectural decision is that the ML service and API communicate through the database, not through synchronous HTTP calls. Forecasts are batch-computed and cached, keeping API response times under 200ms.

**Major components:**
1. **INRIX Poller + Rate Budget Manager** -- collects SF bounding-box speed data within 2000 calls/week, adaptive scheduling for rush hours
2. **Feature Store (PostgreSQL table)** -- denormalized join of speed readings + weather + events + school calendar, rebuilt every 6 hours
3. **Python Forecast Service** -- XGBoost model reads feature store, generates week-ahead predictions with confidence intervals, writes to forecast_results table
4. **Node.js API** -- serves pre-computed forecasts and live speed data; orchestrates but never performs ML inference in request path
5. **React + Mapbox Frontend** -- corridor heatmap (signature view), forecast charts with confidence bands, live traffic map

### Critical Pitfalls

1. **INRIX quota exhaustion** -- Use bounding-box endpoint (1 call for all SF segments vs N calls per segment). Implement a call budget tracker. Design adaptive polling: rush hours every 15 min, off-peak every 60 min, overnight skip entirely. This must be the first thing designed, before any code.
2. **Data leakage in ML evaluation** -- Never use random train/test splits on time-series data. Use strictly chronological splits (TimeSeriesSplit) and walk-forward validation. Build the evaluation harness before the model.
3. **Meaningless confidence intervals** -- Use quantile regression (predict 10th/50th/90th percentiles) or conformal prediction instead of naive mean +/- std. Traffic delays are right-skewed. Validate that 80% intervals actually contain 80% of actuals.
4. **Node.js monolith coupling** -- Separate data collector and API server from day one with distinct entry points, even if they share a codebase. The collector writes to the database; the API reads from it. No shared in-memory state.
5. **TimescaleDB chunk misconfiguration** -- Set chunk intervals explicitly (7 days is fine for trial-tier data volume). Enable compression on chunks older than 2 weeks. Add a retention policy early.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Data Pipeline and Database Foundation
**Rationale:** Everything depends on having traffic data in the database. The forecast model needs 2-4 weeks of accumulated data, so the pipeline must start collecting immediately. This is the critical-path bottleneck -- every day of delay pushes out the first usable forecast by the same amount.
**Delivers:** Working INRIX data collection within rate limits, PostgreSQL+TimescaleDB schema with hypertables, weather/events/school calendar ingestion, call budget tracker.
**Addresses features:** INRIX data collection pipeline, current traffic conditions display (data layer only).
**Avoids pitfalls:** INRIX quota exhaustion (budget manager), TimescaleDB chunk misconfiguration (explicit intervals + compression), Node.js monolith (separate collector entry point from start), storing raw JSON blobs (normalize at ingestion).

### Phase 2: Feature Engineering and Baseline Model
**Rationale:** With 2+ weeks of collected data, build the feature store and train a baseline model. The feature store is the bridge between raw data and predictions -- all signals (speed, weather, events, school) merge here. Starting with a simple historical-average baseline lets you validate the pipeline end-to-end before investing in model complexity.
**Delivers:** Denormalized feature table (forecast_features), baseline XGBoost model, chronological train/test evaluation harness, initial confidence interval implementation.
**Uses:** Python 3.12, FastAPI, XGBoost, scikit-learn, pandas.
**Avoids pitfalls:** Data leakage (chronological splits enforced from start), non-stationary time series (explicit regime features), meaningless confidence intervals (quantile regression from the beginning).

### Phase 3: API Layer and Forecast Serving
**Rationale:** With forecasts being generated, expose them through a REST API. The API serves pre-computed results from the database -- no ML inference in the request path. This phase also sets up the batch forecast generation cron (every 6 hours) and the live speed data endpoints.
**Delivers:** Express API with endpoints for live segments, corridor forecasts, and incidents. Batch forecast generation on schedule. API response times under 200ms.
**Uses:** Node.js 24, Express 5, TypeScript, pg driver, node-cron.
**Implements:** API layer from architecture, forecast cache pattern.

### Phase 4: Frontend -- Map and Forecast Visualization
**Rationale:** With the API serving data, build the user-facing application. The corridor heatmap is the signature view and should be the centerpiece. Map rendering with live traffic overlay builds user trust. This is where the product becomes tangible.
**Delivers:** Interactive Mapbox map with traffic overlay, week-ahead corridor heatmap, forecast charts with confidence bands, day/time selector, mobile-responsive layout.
**Uses:** React 19, Vite 8, Mapbox GL JS, react-map-gl, Recharts, Zustand, TanStack Query.
**Avoids pitfalls:** Mapbox token exposure (URL-restricted tokens), rendering too many segments (single GeoJSON source with data-driven styling), no explanation for predictions (show contributing factors).

### Phase 5: Differentiator Features and Validation
**Rationale:** With the core product working, add the features that complete the competitive advantage: best departure time recommender, event-aware predictions, forecast accuracy dashboard. Also validate confidence interval calibration against accumulated actuals. This phase turns a working prototype into a differentiated product.
**Delivers:** Best departure time recommender, event-aware congestion modifiers, congestion risk score, forecast accuracy tracking, actual-vs-predicted validation.
**Addresses features:** Best departure time (P2), event-aware predictions (P2), incident overlay (P2), congestion risk score (P2), forecast accuracy dashboard (P2), school calendar signal (P2).

### Phase 6: Polish and Deployment
**Rationale:** Production hardening, responsive design refinement, deployment to Railway/Render (backend) and Vercel (frontend). Add user-facing touches: corridor bookmarks in localStorage, map view persistence, prediction explanations.
**Delivers:** Production deployment, Docker Compose for reproducible environments, monitoring, error handling, UX polish.

### Phase Ordering Rationale

- **Data pipeline first because of cold-start dependency:** The ML model needs 2-4 weeks of historical data. Every day the pipeline is not running is a day the forecast launch slips. Start collecting on day 1.
- **Feature engineering before API because the feature store design drives everything:** The denormalized feature table is the contract between data collection and ML. Getting this right early prevents rework.
- **API before frontend because mock data only gets you so far:** Real INRIX data has quirks (missing segments, low-score readings, irregular timestamps) that mock data hides. Build against real API responses.
- **Differentiators last because they enhance, not enable:** Weather/event modifiers improve an already-working baseline forecast. They can be added incrementally without blocking the core product.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1:** INRIX API specifics need verification -- bounding-box endpoint behavior, exact auth flow (appId + hashToken), response format details, segment ID stability. The trial key's exact limitations should be tested empirically before committing to a polling strategy.
- **Phase 2:** Confidence interval methodology (quantile regression vs conformal prediction) needs experimentation with actual collected data. The right approach depends on data volume and distribution shape.
- **Phase 5:** Event data sourcing (SeatGeek API? manual CSV? web scraping?) needs investigation. Giants/Warriors schedules are predictable, but concerts and festivals vary.

Phases with standard patterns (skip research-phase):
- **Phase 3:** Express API serving pre-computed data from PostgreSQL is a thoroughly documented pattern. No novel integration challenges.
- **Phase 4:** React + Mapbox GL JS with GeoJSON layers is well-documented with extensive examples. Recharts confidence-band charts have standard recipes.
- **Phase 6:** Railway/Render/Vercel deployment is straightforward with established workflows.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All versions verified against npm/PyPI registries. Technology choices are mainstream and well-documented. |
| Features | MEDIUM-HIGH | Table stakes and differentiators are well-reasoned. Competitor feature analysis is based on training data (early 2025) -- Google/Apple may have added planning features since. |
| Architecture | MEDIUM | Patterns are established for time-series forecasting systems. INRIX-specific details (bounding-box endpoint behavior, auth flow) need empirical verification. |
| Pitfalls | MEDIUM | Core pitfalls (quota management, data leakage, confidence intervals) are well-understood in the domain. INRIX-specific gotchas (segment ID stability, score field interpretation) need docs verification. |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **INRIX bounding-box endpoint behavior:** Research assumes one API call returns all SF segments. This must be verified with the actual trial key during Phase 1. If the endpoint returns only a subset, the entire polling strategy changes.
- **INRIX auth token lifecycle:** The hashToken auth mechanism needs documentation review. Does the token expire? Is there a refresh flow? Handle 401 errors gracefully.
- **Confidence interval calibration approach:** Quantile regression and conformal prediction are both viable. The right choice depends on data volume after 2-4 weeks of collection. Defer decision to Phase 2 start.
- **Event data sourcing:** No concrete plan for obtaining Giants/Warriors/concert schedules programmatically. SeatGeek and Ticketmaster have free API tiers, but availability and rate limits need investigation in Phase 5.
- **Competitor verification:** Google Maps and Apple Maps may have added week-ahead or weather-adjusted features since early 2025. Verify competitive gap still exists before marketing claims.
- **INRIX score field semantics:** The INRIX response includes a confidence score (0-30). The exact thresholds for "measured vs estimated" should be verified against INRIX documentation to set appropriate filtering rules.

## Sources

### Primary (HIGH confidence)
- npm registry -- all JavaScript/TypeScript package versions verified 2026-03-19
- PyPI -- all Python package versions verified 2026-03-19
- TimescaleDB documentation -- hypertable patterns, compression, continuous aggregates
- scikit-learn documentation -- TimeSeriesSplit, cross-validation methodology

### Secondary (MEDIUM confidence)
- INRIX IQ API capabilities as described in PROJECT.md context
- Mapbox GL JS documentation -- data-driven styling, source management, token security
- XGBoost tabular forecasting best practices from ML literature
- Competitive landscape analysis (Google Maps, Waze, Apple Maps) from training data knowledge

### Tertiary (LOW confidence)
- INRIX trial key specific limitations -- need empirical verification
- Event data source availability (SeatGeek/Ticketmaster free tier APIs) -- need investigation
- Google Maps / Apple Maps current feature set -- may have changed since early 2025

---
*Research completed: 2026-03-19*
*Ready for roadmap: yes*
