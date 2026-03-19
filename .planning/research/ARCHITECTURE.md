# Architecture Research

**Domain:** Real-time + predictive traffic forecasting (SF-specific, week-ahead)
**Researched:** 2026-03-19
**Confidence:** MEDIUM (based on established patterns for time-series forecasting systems; no web verification available)

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        DATA COLLECTION LAYER                        │
│  ┌───────────┐  ┌────────────┐  ┌────────────┐  ┌──────────────┐  │
│  │  INRIX    │  │ Open-Meteo │  │  Events    │  │  School Cal  │  │
│  │  Poller   │  │  Poller    │  │  Scraper   │  │  Loader      │  │
│  └─────┬─────┘  └─────┬──────┘  └─────┬──────┘  └──────┬───────┘  │
│        │              │              │               │             │
├────────┴──────────────┴──────────────┴───────────────┴─────────────┤
│                        STORAGE LAYER                                │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │              PostgreSQL + TimescaleDB                        │   │
│  │  ┌─────────────┐ ┌──────────────┐ ┌──────────────────────┐ │   │
│  │  │ speed_readings│ │ weather_fcsts │ │ events / school_cal │ │   │
│  │  │ (hypertable) │ │ (hypertable) │ │ (regular tables)     │ │   │
│  │  └─────────────┘ └──────────────┘ └──────────────────────┘ │   │
│  └─────────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────┤
│                        ML / FORECAST LAYER                          │
│  ┌────────────────────────────────────────────────────┐            │
│  │            Python Forecast Service                  │            │
│  │  ┌──────────┐  ┌───────────┐  ┌─────────────────┐ │            │
│  │  │ Feature  │  │  Model    │  │  Confidence     │ │            │
│  │  │ Builder  │  │ (XGBoost) │  │  Interval Calc  │ │            │
│  │  └──────────┘  └───────────┘  └─────────────────┘ │            │
│  └────────────────────────┬───────────────────────────┘            │
├───────────────────────────┼─────────────────────────────────────────┤
│                        API LAYER                                    │
│  ┌────────────────────────┴───────────────────────────┐            │
│  │            Node.js / Express Backend                │            │
│  │  ┌───────────┐  ┌───────────┐  ┌────────────────┐ │            │
│  │  │ /segments │  │ /forecast │  │ /planner       │ │            │
│  │  │ (realtime)│  │ (predict) │  │ (best-time)    │ │            │
│  │  └───────────┘  └───────────┘  └────────────────┘ │            │
│  └────────────────────────┬───────────────────────────┘            │
├───────────────────────────┼─────────────────────────────────────────┤
│                        FRONTEND LAYER                               │
│  ┌────────────────────────┴───────────────────────────┐            │
│  │            React + Mapbox GL JS                     │            │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │            │
│  │  │ Map View │  │ Forecast │  │ Departure        │ │            │
│  │  │ (live)   │  │ Charts   │  │ Planner          │ │            │
│  │  └──────────┘  └──────────┘  └──────────────────┘ │            │
│  └────────────────────────────────────────────────────┘            │
└─────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| INRIX Poller | Collect segment speeds on a cron schedule within rate limits | Node.js cron job (node-cron), 1 RPS / 2000 calls/week budget |
| Open-Meteo Poller | Fetch 7-day hourly weather forecast for SF | Node.js cron job, daily or twice-daily refresh |
| Events Scraper/Loader | Ingest Giants/Warriors/concert schedules, Outside Lands | Scraped or manual CSV loads; updated weekly |
| School Calendar Loader | SFUSD school day/break schedule | Static CSV/JSON loaded once per semester |
| PostgreSQL + TimescaleDB | Time-series storage with efficient range queries | Hypertables for speed_readings and weather_forecasts |
| Python Forecast Service | Train models, generate week-ahead predictions with confidence intervals | Flask/FastAPI microservice, XGBoost + bootstrap CI |
| Node.js API Backend | Serve REST endpoints, orchestrate data reads, proxy to ML service | Express with route handlers per domain |
| React + Mapbox Frontend | Interactive map, forecast charts, departure planner UI | SPA with Mapbox GL JS for map layers |

## Recommended Project Structure

```
sf-traffic-forecaster/
├── backend/                    # Node.js Express API + data collection
│   ├── src/
│   │   ├── collectors/         # INRIX, Open-Meteo, events pollers
│   │   │   ├── inrix.ts        # INRIX API client + rate limiter
│   │   │   ├── weather.ts      # Open-Meteo fetcher
│   │   │   └── events.ts       # Event/calendar loaders
│   │   ├── routes/             # Express route handlers
│   │   │   ├── segments.ts     # Real-time speed endpoints
│   │   │   ├── forecast.ts     # Forecast proxy to ML service
│   │   │   └── planner.ts      # Best-time-to-drive logic
│   │   ├── services/           # Business logic
│   │   │   ├── inrix-service.ts
│   │   │   ├── forecast-service.ts
│   │   │   └── planner-service.ts
│   │   ├── db/                 # Database connection, migrations, queries
│   │   │   ├── migrations/
│   │   │   ├── queries/
│   │   │   └── connection.ts
│   │   ├── jobs/               # Cron job definitions
│   │   │   └── scheduler.ts
│   │   └── app.ts              # Express app entry point
│   ├── package.json
│   └── tsconfig.json
├── ml/                         # Python forecast microservice
│   ├── app/
│   │   ├── api.py              # FastAPI endpoints
│   │   ├── features.py         # Feature engineering pipeline
│   │   ├── model.py            # XGBoost training + prediction
│   │   ├── confidence.py       # Bootstrap confidence intervals
│   │   └── config.py           # Model hyperparams, corridor defs
│   ├── scripts/
│   │   ├── train.py            # Offline model training script
│   │   └── backfill.py         # Historical feature backfill
│   ├── models/                 # Serialized model artifacts (.joblib)
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/                   # React SPA
│   ├── src/
│   │   ├── components/
│   │   │   ├── Map/            # Mapbox GL map + layers
│   │   │   ├── Forecast/       # Forecast charts (per corridor)
│   │   │   ├── Planner/        # Departure planner form + results
│   │   │   └── Incidents/      # Real-time incident overlay
│   │   ├── hooks/              # Data fetching hooks
│   │   ├── services/           # API client
│   │   └── App.tsx
│   ├── package.json
│   └── vite.config.ts
├── db/                         # Shared database schema
│   └── migrations/             # SQL migration files
├── docker-compose.yml          # Local dev: Postgres, backend, ml, frontend
└── .env.example
```

### Structure Rationale

- **backend/:** Node.js handles both the API server and data collection cron jobs. These are the same process in dev (simpler), separable in production if needed. TypeScript for type safety across the API.
- **ml/:** Separate Python service because the ML ecosystem (scikit-learn, XGBoost, pandas, numpy) has no viable Node.js equivalent. Communicates with backend via HTTP. Deployed as its own container.
- **frontend/:** Standard React SPA. Vite for fast dev builds. Mapbox GL JS is the only viable free-tier interactive map library with the layer control needed for traffic overlays.
- **db/migrations/ at root:** Shared between backend and ml service -- both need to read from the same database. Migrations run from backend but schema is a shared concern.

## Architectural Patterns

### Pattern 1: Scheduled Collection with Rate Budget

**What:** A cron scheduler that distributes INRIX API calls across the week to maximize coverage within the 2000 calls/week limit.
**When to use:** Always -- the rate limit is the hardest constraint in this system.
**Trade-offs:** More complex scheduling logic upfront, but prevents the system from going dark mid-week.

The key math: 2000 calls/week / 7 days = ~285 calls/day. If each call fetches one segment, and there are ~6 major corridors, you get ~47 readings per corridor per day. That is roughly one reading every 30 minutes per corridor -- sufficient for building hourly baseline models but not for truly real-time display of all segments.

**Strategy:** Prioritize rush-hour windows (6-10 AM, 4-8 PM) for higher-frequency polling. Off-peak can be hourly or less. Batch multiple segments per call if the INRIX API supports it (the segments-by-bounding-box endpoint returns multiple segments in one call, which is far more efficient).

```typescript
// Prefer bounding-box calls over per-segment calls
// One bounding-box call returns ALL segments in the SF box
// This is 1 API call instead of N calls per corridor
async function collectSFSegments() {
  const data = await inrixClient.getSegmentSpeeds({
    boundingBox: SF_BOUNDING_BOX,  // Single call for all SF
    units: 'mph'
  });
  await db.bulkInsertReadings(data.segments);
}
```

### Pattern 2: Feature Store for ML

**What:** Pre-compute and store ML features (time-of-day, day-of-week, weather forecast values, event flags, school-day flag) alongside raw data, so the ML service reads a ready-made feature table rather than joining across 5 tables at prediction time.
**When to use:** Once you have more than 2-3 signal sources feeding the model.
**Trade-offs:** Some data duplication, but dramatically simplifies the ML service and makes retraining fast.

```sql
-- Materialized feature table, rebuilt hourly or daily
CREATE TABLE forecast_features (
  corridor_id   TEXT,
  target_hour   TIMESTAMPTZ,
  -- Target
  avg_speed     FLOAT,
  -- Time features
  hour_of_day   INT,
  day_of_week   INT,
  is_weekend    BOOLEAN,
  -- Weather features (from forecast)
  precip_mm     FLOAT,
  visibility_km FLOAT,
  wind_speed    FLOAT,
  -- Event features
  has_major_event BOOLEAN,
  event_type    TEXT,
  -- School features
  is_school_day BOOLEAN,
  -- Baseline
  historical_avg_speed FLOAT
);
```

### Pattern 3: Forecast Cache with TTL

**What:** Week-ahead forecasts do not change minute-to-minute. Generate them once (e.g., every 6 hours) and cache the results. The API serves cached forecasts; the ML service runs on a schedule, not on-demand.
**When to use:** Always for week-ahead predictions. On-demand ML inference is unnecessary latency.
**Trade-offs:** Forecasts may be slightly stale (up to 6 hours old), but week-ahead predictions do not need real-time freshness.

```
Cron (every 6h) -> ML Service generates forecasts -> Writes to forecast_results table
API request -> Reads from forecast_results table -> Returns cached forecast
```

This pattern keeps the ML service simple (batch job, not a live API under load) and keeps API response times fast (database read, no ML inference).

## Data Flow

### Data Collection Flow

```
Every 30 min (rush hour) / 60 min (off-peak):
  INRIX API ──GET segments/speed──> INRIX Poller ──INSERT──> speed_readings (hypertable)

Every 12 hours:
  Open-Meteo API ──GET forecast──> Weather Poller ──UPSERT──> weather_forecasts (hypertable)

Weekly (or manual):
  Event sources ──scrape/load──> Events Loader ──UPSERT──> events table

Per semester:
  SFUSD calendar ──parse──> School Loader ──INSERT──> school_calendar table
```

### Feature Engineering Flow

```
Every 6 hours:
  Feature Builder reads:
    speed_readings (historical averages by corridor/hour/day)
    + weather_forecasts (next 7 days)
    + events (next 7 days)
    + school_calendar (next 7 days)
  ──JOIN + TRANSFORM──> forecast_features table
```

### Prediction Flow

```
Every 6 hours (after feature build):
  ML Service reads: forecast_features (next 7 days of feature rows)
  ──XGBoost predict──> point predictions per corridor/hour
  ──Bootstrap CI──> confidence intervals
  ──INSERT──> forecast_results table
```

### API Request Flow

```
User opens app:
  Frontend ──GET /segments/live──> Backend ──SELECT latest──> speed_readings
  Frontend ──GET /forecast/:corridor──> Backend ──SELECT──> forecast_results
  Frontend ──GET /incidents──> Backend ──INRIX incidents API──> response (or cached)

User uses departure planner:
  Frontend ──POST /planner──> Backend
    Backend reads forecast_results for origin-dest corridors
    Backend applies routing logic (sum segment forecasts along route)
    Backend returns: recommended departure windows with confidence intervals
  <── { windows: [{ depart: "7:15 AM", eta_range: [32, 44], most_likely: 36 }] }
```

### Key Data Flows

1. **Collection to Storage:** All external data sources write to PostgreSQL/TimescaleDB on independent schedules. No collector depends on another. This means if the events scraper fails, speed collection continues unaffected.
2. **Storage to Features:** A batch job joins multiple tables into a denormalized feature table. This is the single point where all signals merge. If a new signal is added later, only this job changes.
3. **Features to Forecasts:** The ML service reads features and writes forecasts. It never reads raw data directly. This clean boundary means the ML service does not need database credentials for every source table.
4. **Forecasts to User:** The API serves pre-computed forecasts. No ML inference happens at request time. This keeps response times under 200ms.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Solo dev / MVP (now) | Single Node.js process runs API + cron jobs. ML service runs as separate process. SQLite could even work but PostgreSQL is worth it for TimescaleDB. |
| 10-100 users | No changes needed. Pre-computed forecasts serve from DB; Mapbox tiles are CDN-served. The bottleneck is INRIX rate limits, not user load. |
| 1k+ users | Separate cron workers from API process. Add Redis for caching forecast responses. Consider serverless for the API (Vercel Edge Functions). |

### Scaling Priorities

1. **First bottleneck: INRIX rate limits.** This is not a scaling bottleneck but a data-coverage bottleneck. The 2000 calls/week limit constrains how many segments you can poll and how often. Mitigation: Use bounding-box endpoint to get all segments in one call. This is the single most important optimization.
2. **Second bottleneck: ML retraining time.** As historical data grows, retraining takes longer. Mitigation: Train on rolling 90-day windows, not all-time data. XGBoost trains in seconds on 90 days of hourly corridor data (~15K rows per corridor).
3. **Third bottleneck: Frontend map performance.** Mapbox handles this well via vector tiles, but rendering hundreds of colored segments with live updates can lag on mobile. Mitigation: Simplify to corridor-level colors, not individual TMC segments.

## Anti-Patterns

### Anti-Pattern 1: Real-Time ML Inference per Request

**What people do:** Call the ML model on every API request to generate a fresh forecast.
**Why it's wrong:** Adds 500ms-2s latency per request. The model inputs (weather forecast, events) do not change between requests. Week-ahead predictions are inherently batch-oriented.
**Do this instead:** Run ML inference on a cron schedule (every 6 hours). Write results to a forecast table. Serve from the table.

### Anti-Pattern 2: One API Call per Segment

**What people do:** Poll INRIX for each TMC segment individually (101-N, 101-S, 280-N, ...).
**Why it's wrong:** Burns through the 2000 calls/week budget in days. SF has dozens of TMC segments per corridor.
**Do this instead:** Use the bounding-box endpoint to fetch all SF segments in a single API call. Parse the response to extract individual segment data. One call covers everything.

### Anti-Pattern 3: Storing Raw API Responses as JSON Blobs

**What people do:** Dump entire INRIX API responses into a JSONB column for "flexibility."
**Why it's wrong:** Makes time-series queries extremely slow. Cannot use TimescaleDB compression or continuous aggregates on JSON. Feature engineering becomes a parsing exercise.
**Do this instead:** Extract structured columns (segment_id, speed, reference_speed, score, timestamp) at ingestion time. Store as typed columns in a hypertable.

### Anti-Pattern 4: Tight Coupling Between Node Backend and Python ML

**What people do:** Call the Python service synchronously from every API request, or import Python scripts from Node via child_process.
**Why it's wrong:** Creates runtime dependency -- if ML service is down, the API is down. child_process spawning is slow and fragile.
**Do this instead:** The ML service writes to the database. The Node backend reads from the database. They share a database, not an API boundary for real-time calls. The only time Node calls Python is for ad-hoc model retraining triggers (optional, not in critical path).

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| INRIX IQ API | HTTP REST, appId + hashToken auth, bounding-box speed endpoint | 1 RPS, 2000 calls/week. Token may expire; handle 401 with re-auth. Response is XML by default -- request JSON format explicitly. |
| Open-Meteo | HTTP REST, no auth, latitude/longitude params | Free, no key. Returns JSON. Rate limit is generous (~10K/day). Fetch hourly forecast for 7 days in one call. |
| Mapbox GL JS | Frontend JS SDK, access token in client code | Free tier: 50K map loads/month. Token is public (restricted by URL origin in Mapbox dashboard). |
| SFUSD calendar | Static data, loaded manually or scraped from SFUSD.edu | Update once per semester. Low-risk integration. |
| Event sources | Scrape or API (SeatGeek, Ticketmaster have free tiers) | Giants/Warriors schedules are published well in advance. Concert schedules change more often. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Backend <-> Database | Direct SQL via pg driver (node-postgres) | Backend owns migrations. Uses parameterized queries. |
| ML Service <-> Database | Direct SQL via psycopg2 or SQLAlchemy | Read-only for features, write for forecasts. |
| Backend <-> ML Service | Shared database (no direct HTTP in critical path) | ML writes forecast_results; backend reads it. For optional retraining triggers, use HTTP POST to ML service. |
| Frontend <-> Backend | REST API over HTTPS | JSON responses. No WebSocket needed -- forecasts update every 6h, not in real-time. Polling every 5 min for live speeds is sufficient. |
| Frontend <-> Mapbox | Mapbox GL JS SDK | Map tiles from Mapbox CDN. Custom layers (speed colors, incidents) rendered client-side from API data. |

## Build Order (Dependencies)

The architecture implies this build sequence:

1. **Database schema + INRIX collection** -- Everything downstream depends on having traffic data in the database. This is the foundation. Cannot test anything without it.
2. **Weather + events + school calendar ingestion** -- These are independent of each other but all feed into features. Can be built in parallel.
3. **Feature engineering pipeline** -- Depends on having data from step 1 and 2 in the database. This is the bridge between raw data and ML.
4. **ML model training + forecast generation** -- Depends on feature pipeline. Cannot train without features. Start with a simple baseline (historical average) and iterate.
5. **API endpoints** -- Can start with live-speed endpoints (depends on step 1) early. Forecast endpoints depend on step 4.
6. **Frontend** -- Depends on API endpoints. Map view can start with mock data, but real integration needs the API.
7. **Departure planner** -- Depends on forecast endpoints working. This is the highest-value feature but requires the full pipeline.

**Critical path:** Database -> INRIX collection -> Feature engineering -> ML model -> Forecast API -> Frontend planner. This is the longest chain and should be started first. Weather/events/school signals can be added incrementally without blocking the critical path.

## Sources

- Training data knowledge of time-series forecasting system patterns (MEDIUM confidence)
- INRIX IQ API capabilities as described in PROJECT.md (HIGH confidence -- from project context)
- TimescaleDB hypertable patterns are well-established (HIGH confidence)
- XGBoost for tabular time-series forecasting is standard practice (HIGH confidence)
- Mapbox GL JS for traffic visualization is industry standard (HIGH confidence)

**Note:** Web search was unavailable during this research. Architecture patterns are based on established conventions for time-series forecasting systems. The specific INRIX API behavior (bounding-box endpoint, response format) should be verified against INRIX documentation during implementation.

---
*Architecture research for: SF Traffic Forecaster*
*Researched: 2026-03-19*
