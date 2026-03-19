# Phase 1: Data Pipeline - Research

**Researched:** 2026-03-19
**Domain:** INRIX API integration, TimescaleDB schema, scheduled data collection, external signal ingestion
**Confidence:** HIGH

## Summary

Phase 1 builds the data foundation: scheduled INRIX speed and incident collection, Open-Meteo weather fetching, and manual ingestion of school calendar and event data, all flowing into TimescaleDB. The hardest constraint is the INRIX 2000 calls/week trial budget -- the entire collection architecture revolves around this. The bounding-box endpoint returns all SF segments in a single call, making 15-minute speed collection (672 calls/week) and 30-minute incident collection (336 calls/week) feasible within budget.

The INRIX Segment Speed API at `segment-api.inrix.com/v1/segments/speed` and the Incidents API at `incident-api.inrix.com/v1/incidents` both accept a `box` parameter. Authentication uses a 24-hour bearer token obtained from the AppToken endpoint using appId + hashToken (SHA1 of `appId|appKey`). Open-Meteo is free, keyless, and returns hourly forecasts for 7 days including visibility (fog detection via weather_code 45/48). The worker process (node-cron in a separate entry point) handles scheduling, retry with backoff, and budget tracking.

**Primary recommendation:** Build the budget tracker and INRIX auth module first. Everything else depends on being able to make INRIX calls without burning quota. Use node-pg-migrate for SQL-based migrations and zod for runtime validation of all external API responses.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- INRIX bounding-box endpoint (one call returns all SF segments) -- preserves quota vs per-segment polling
- Collect segment speeds every 15 minutes (~672 calls/week for speeds, leaves ~1,328 calls headroom)
- Collect incidents every 30 minutes -- incidents change slowly, saves ~336 calls/week vs matching speed frequency
- Hard stop at 80% of weekly budget (1,600 calls) -- budget tracker runs before each job, aborts if limit reached
- TimescaleDB chunk interval: 1 day -- matches daily traffic patterns, compresses well
- Store all segments in SF bounding box -- maximizes data for model training; filtering to 6 corridors loses training data
- Separate hypertable for forecasts -- queryable and indexable vs JSONB column
- Primary index: composite (segment_id, timestamp) -- efficient range queries per segment
- node-cron for scheduling -- simple, no Redis dependency appropriate for solo project scope
- Retry with exponential backoff (3 attempts) -- handles INRIX transient failures
- Console + DB log table for job logging -- enables budget tracking and post-hoc debugging
- Separate worker process for data collection -- decoupled from API server so restarts don't kill active collection jobs
- School calendar: manual CSV seeded from SFUSD published calendar
- Events: manual seed file for Giants/Warriors schedules + major concerts
- Weather: fetch from Open-Meteo daily at midnight -- 7-day forecast is stable, one daily fetch is sufficient
- Signal storage: date-keyed flags table (columns: date, school_day BOOLEAN, event_name TEXT, event_type TEXT)

### Claude's Discretion
- Specific TimescaleDB hypertable compression policy settings
- Exact DB table column names and types (beyond the agreed structure)
- node-cron cron expression syntax for 15/30 min intervals
- Backoff timing (e.g., 1s -> 5s -> 30s)
- Error alerting format in DB log table

### Deferred Ideas (OUT OF SCOPE)
- Automated event scraping (Ticketmaster/SeatGeek API) -- manual seeding sufficient for MVP
- SFUSD iCal subscription -- manual CSV is more reliable for MVP timeframe
- Multi-city expansion -- out of scope per PROJECT.md (INRIX trial geo-locked to SF)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DATA-01 | System collects SF segment speeds from INRIX bounding-box endpoint on a scheduled basis | INRIX Segment Speed API documented: `segment-api.inrix.com/v1/segments/speed?box=...`, returns speed/reference/average/travelTimeMinutes/speedBucket per segment. node-cron schedules every 15 min. |
| DATA-02 | INRIX call budget stays within 2000 calls/week (budget tracker enforced before each job run) | Budget tracker pattern: DB table tracks calls per ISO week. Pre-check before each job. Hard stop at 1,600 (80%). Token cached for 24h to avoid extra auth calls. |
| DATA-03 | Collected readings stored in TimescaleDB hypertable with segment ID, timestamp, speed, free-flow speed, historical average, and congestion score | INRIX response includes: speed, reference (free-flow), average (historical), speedBucket (congestion 0-3). TimescaleDB hypertable with 1-day chunks and composite index (segment_id, timestamp). |
| DATA-04 | INRIX incidents collected and stored separately | INRIX Incidents API: `incident-api.inrix.com/v1/incidents?box=...&incidentType=Incidents,Construction,Events,Flow`. Returns id, type, severity, geometry, descriptions, delay impact. |
| DATA-05 | Open-Meteo 7-day hourly weather forecast fetched daily and stored | Open-Meteo API: `api.open-meteo.com/v1/forecast?latitude=37.7749&longitude=-122.4194&hourly=temperature_2m,precipitation,visibility,weather_code&forecast_days=7&timezone=auto`. Free, no key. weather_code 45/48 = fog. |
| DATA-06 | SFUSD school calendar ingested (school day vs. break vs. holiday flags by date) | Manual CSV load into calendar_flags table. Columns: date, school_day BOOLEAN. Loaded once per semester via seed script. |
| DATA-07 | Local event calendar ingested -- Giants/Warriors games, major concerts, Outside Lands | Manual seed file (JSON or CSV) into calendar_flags table. Columns: date, event_name TEXT, event_type TEXT. Updated manually as schedules are published. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pg (node-postgres) | 8.20.0 | PostgreSQL/TimescaleDB driver | Direct SQL access required for TimescaleDB functions (create_hypertable, time_bucket). ORMs cannot express these. |
| axios | 1.13.6 | HTTP client for INRIX + Open-Meteo | Interceptors for auth token refresh, retry logic, timeout configuration. Better than fetch for complex retry patterns. |
| node-cron | 4.2.1 | Job scheduling | Lightweight cron for 15/30 min collection intervals. No Redis dependency. Runs in separate worker process. |
| zod | 4.3.6 | Runtime schema validation | Validate INRIX and Open-Meteo response shapes before DB insert. Catches API contract changes before data corruption. |
| dotenv | 17.3.1 | Environment variables | INRIX credentials, DB connection string, budget thresholds. Keep secrets out of code. |
| TypeScript | 5.9.3 | Type safety | Type INRIX/Open-Meteo responses, DB query results, job configurations. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| node-pg-migrate | 8.0.4 | SQL-based DB migrations | Schema creation and evolution. Plain SQL files, no ORM. TypeScript CLI support. |
| vitest | 4.1.0 | Testing | Unit tests for budget tracker, INRIX response parsing, retry logic. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| node-cron | Croner | Croner is TypeScript-native and DST-aware. node-cron is simpler and sufficient for UTC-based 15/30 min intervals. |
| axios | node-fetch / undici | Native fetch lacks interceptors for token refresh and retry. axios interceptors simplify auth + retry patterns. |
| node-pg-migrate | postgres-migrations | postgres-migrations is even simpler (numbered SQL files) but node-pg-migrate has better TypeScript support and rollback capability. |

**Installation:**
```bash
npm init -y
npm install pg axios node-cron zod dotenv
npm install -D typescript @types/node @types/pg node-pg-migrate vitest
```

## Architecture Patterns

### Recommended Project Structure (Phase 1 scope)
```
backend/
├── src/
│   ├── collectors/           # Data collection modules
│   │   ├── inrix-speeds.ts   # Bounding-box speed fetcher
│   │   ├── inrix-incidents.ts # Incident fetcher
│   │   ├── weather.ts        # Open-Meteo fetcher
│   │   └── schemas/          # Zod schemas for API responses
│   │       ├── inrix.ts
│   │       └── weather.ts
│   ├── db/
│   │   ├── connection.ts     # pg Pool singleton
│   │   ├── migrations/       # SQL migration files
│   │   └── queries/          # Parameterized query functions
│   │       ├── speed-readings.ts
│   │       ├── incidents.ts
│   │       ├── weather.ts
│   │       ├── calendar.ts
│   │       └── budget.ts
│   ├── services/
│   │   ├── inrix-auth.ts     # Token acquisition + caching
│   │   ├── budget-tracker.ts # Weekly call budget management
│   │   └── retry.ts          # Exponential backoff utility
│   ├── worker.ts             # Separate entry point: cron scheduler
│   └── seed/
│       ├── school-calendar.ts # CSV parser + DB loader
│       └── events.ts         # JSON/CSV parser + DB loader
├── data/
│   ├── sfusd-calendar.csv    # Manual school calendar data
│   └── events.json           # Manual event data (Giants, Warriors, concerts)
├── package.json
├── tsconfig.json
└── .env.example
```

### Pattern 1: INRIX Auth Token Caching
**What:** Acquire a bearer token from the AppToken endpoint and cache it for 24 hours. Only re-acquire when expired or on 401 response.
**When to use:** Before every INRIX API call.
**Source:** [INRIX Authentication Docs](https://docs.inrix.com/authentication/getting_authorized/)

```typescript
// INRIX token lifecycle:
// 1. Compute hashToken = SHA1(lowercase(appId + "|" + appKey)) as hex
// 2. GET https://uas-api.inrix.com/v1/appToken?appId={appId}&hashToken={hashToken}
// 3. Response: { result: { token: "...", expiry: "2026-03-20T12:00:00Z" } }
// 4. Cache token, refresh when expiry is within 5 minutes
// 5. Use in requests: Authorization: Bearer {token}
//    OR query param: ?accesstoken={token}

import crypto from 'crypto';

function generateHashToken(appId: string, appKey: string): string {
  const combined = `${appId}|${appKey}`.toLowerCase();
  return crypto.createHash('sha1').update(combined, 'utf8').digest('hex');
}
```

### Pattern 2: Budget-Gated Collection
**What:** A pre-check function that queries the call log table, sums calls for the current ISO week, and aborts if >= 1,600 (80% of 2,000).
**When to use:** Called before every INRIX API request.

```typescript
// Budget tracker pattern:
// 1. Before each INRIX call: SELECT COUNT(*) FROM api_call_log
//    WHERE service = 'inrix' AND called_at >= start_of_current_iso_week()
// 2. If count >= 1600: skip collection, log warning
// 3. After each INRIX call: INSERT INTO api_call_log (service, endpoint, called_at, status_code)
// 4. Weekly budget resets at Monday 00:00 UTC
```

### Pattern 3: Separate Worker Process
**What:** The data collection cron jobs run in a separate Node.js process (`worker.ts`) from the API server.
**When to use:** Always -- prevents API server restarts from killing active collection jobs.

```typescript
// worker.ts -- separate entry point
import cron from 'node-cron';

// Every 15 minutes: collect speeds
cron.schedule('*/15 * * * *', collectSpeeds);

// Every 30 minutes: collect incidents
cron.schedule('*/30 * * * *', collectIncidents);

// Daily at midnight PT (08:00 UTC): fetch weather
cron.schedule('0 8 * * *', collectWeather);
```

### Pattern 4: Batch Insert with Zod Validation
**What:** Validate INRIX response with zod, then bulk-insert all segments in a single multi-row INSERT.
**When to use:** On every collection cycle.

```typescript
// 1. Fetch INRIX bounding-box response
// 2. Parse with zod schema (catches API contract changes)
// 3. Multi-row INSERT:
//    INSERT INTO speed_readings (segment_id, timestamp, speed, free_flow_speed, historical_avg, congestion_score)
//    VALUES ($1,$2,$3,$4,$5,$6), ($7,$8,$9,$10,$11,$12), ...
// Use pg's parameterized query with dynamically built VALUES clause
```

### Anti-Patterns to Avoid
- **Per-segment API calls:** One bounding-box call returns ALL SF segments. Never call per-segment -- burns quota instantly.
- **Storing raw JSON blobs:** Extract typed columns at ingestion time. JSONB prevents TimescaleDB compression and continuous aggregates.
- **Shared process for worker + API:** If the API server restarts or crashes, it should not interrupt ongoing data collection.
- **Polling INRIX overnight (midnight-5 AM):** Traffic data at 3 AM has minimal value. Skip overnight to preserve budget. (Discretion: can start with uniform polling and optimize later.)

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Database migrations | Custom SQL execution scripts | node-pg-migrate | Tracks applied migrations, supports rollback, handles version ordering |
| HTTP retry with backoff | Custom setTimeout chains | axios-retry or manual axios interceptor with exponential backoff | Edge cases: jitter, max retries, circuit breaking, timeout vs retry interaction |
| Cron expression parsing | Custom interval timers | node-cron | Handles cron syntax, timezone awareness, edge cases around DST |
| SHA1 hashing for INRIX auth | Manual crypto implementation | Node.js built-in `crypto.createHash('sha1')` | Standard library, no dependency |
| CSV parsing for school calendar | String splitting | csv-parse (from csv package) or papaparse | Handles quoted fields, encoding issues, edge cases |
| Date/week boundary calculations | Manual arithmetic | date-fns `startOfISOWeek()`, `getISOWeek()` | ISO week boundaries are tricky (Monday start, year boundary crossing) |

**Key insight:** The budget tracker is the only truly custom component. Everything else should compose existing libraries.

## Common Pitfalls

### Pitfall 1: INRIX Token Expiry Mid-Collection
**What goes wrong:** Token expires during a collection cycle. The speed fetch succeeds but the incident fetch fails with 401. No retry logic re-authenticates.
**Why it happens:** Token is cached but expiry check happens only at acquisition time, not before each call.
**How to avoid:** Check token expiry before EVERY INRIX call. If within 5 minutes of expiry, proactively refresh. On 401 response, refresh token and retry once.
**Warning signs:** Intermittent 401 errors in logs, always at the same time of day (24h after token acquisition).

### Pitfall 2: Budget Counter Drift
**What goes wrong:** The budget counter and actual INRIX calls diverge. A network timeout means the call was made (counted by INRIX) but the counter was never incremented (insert into api_call_log failed or was skipped).
**Why it happens:** The call log INSERT happens after a successful response. If the response times out but INRIX processed the request, the call is uncounted.
**How to avoid:** Insert the call log entry BEFORE making the INRIX call with status='pending'. Update to 'success'/'error' after. This way, timed-out calls still count against the budget.
**Warning signs:** Budget tracker shows 1,500 but INRIX dashboard shows 1,650.

### Pitfall 3: INRIX Bounding Box Returns XML by Default
**What goes wrong:** The legacy Speed API defaults to XML. Developer parses as JSON, gets cryptic errors.
**Why it happens:** INRIX docs for the legacy endpoint default to XML. The newer Segment Speed API defaults to JSON, but mixing old/new endpoint URLs is easy.
**How to avoid:** Use the new Segment Speed API at `segment-api.inrix.com/v1/segments/speed`. Always set Accept header to `application/json`. Validate response shape with zod before processing.
**Warning signs:** Parsing errors mentioning `<` or `<?xml`, response content-type is `text/xml`.

### Pitfall 4: TimescaleDB Extension Not Enabled
**What goes wrong:** Migrations run `create_hypertable()` but get "function does not exist" because the TimescaleDB extension was not enabled first.
**Why it happens:** The Docker image has TimescaleDB installed but the extension must be enabled per-database with `CREATE EXTENSION IF NOT EXISTS timescaledb`.
**How to avoid:** First migration must be `CREATE EXTENSION IF NOT EXISTS timescaledb;` before any hypertable operations.
**Warning signs:** `ERROR: function create_hypertable does not exist`.

### Pitfall 5: Open-Meteo Forecast Overwrites Instead of Upserts
**What goes wrong:** Each daily weather fetch inserts 168 rows (7 days x 24 hours). The next day's fetch inserts another 168, creating duplicates for overlapping forecast hours.
**Why it happens:** Simple INSERT without conflict handling.
**How to avoid:** Use `INSERT ... ON CONFLICT (forecast_hour) DO UPDATE` to upsert. Each row is keyed by the target forecast hour. New fetches update existing future-hour rows with latest forecast values.
**Warning signs:** Weather table growing at 168 rows/day instead of staying at ~168 rows total.

### Pitfall 6: INRIX speedBucket vs score Confusion
**What goes wrong:** Developer stores `speedBucket` (0-3 congestion level) thinking it is the `score` (0-30 data quality indicator), or vice versa. Model training uses low-quality data without filtering.
**Why it happens:** Both fields are numeric and relate to "how good" the data is, but measure different things.
**How to avoid:** Store both fields explicitly. `speedBucket` is congestion level (0=free-flow, 3=stop-and-go). `score` (if returned in SpeedOutputFields=All) is data quality/confidence. Filter readings with low score values during model training.
**Warning signs:** Model accuracy varies wildly -- some segments have estimated speeds, not measured.

## Code Examples

### INRIX Segment Speed API Call
```typescript
// Source: https://docs.inrix.com/traffic/segmentspeed/
// Endpoint: segment-api.inrix.com/v1/segments/speed
// SF bounding box: 37.858,-122.541 (NW) -> 37.699,-122.341 (SE)

const INRIX_SPEED_URL = 'https://segment-api.inrix.com/v1/segments/speed';
const SF_BOX = '37.858|-122.541,37.699|-122.341';

async function fetchSpeeds(token: string) {
  const response = await axios.get(INRIX_SPEED_URL, {
    params: {
      box: SF_BOX,
      SpeedOutputFields: 'All',
      units: 0,  // English (mph)
    },
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
    timeout: 30000,
  });
  return response.data;
}
```

### INRIX Incidents API Call
```typescript
// Source: https://docs.inrix.com/traffic/xdincidents/
// Endpoint: incident-api.inrix.com/v1/incidents

const INRIX_INCIDENTS_URL = 'https://incident-api.inrix.com/v1/incidents';

async function fetchIncidents(token: string) {
  const response = await axios.get(INRIX_INCIDENTS_URL, {
    params: {
      box: SF_BOX,
      incidentType: 'Incidents,Construction,Events,Flow',
      incidentoutputfields: 'All',
    },
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
    timeout: 30000,
  });
  return response.data;
}
```

### INRIX Auth Token Acquisition
```typescript
// Source: https://docs.inrix.com/authentication/getting_authorized/
import crypto from 'crypto';

const TOKEN_URL = 'https://uas-api.inrix.com/v1/appToken';

function computeHashToken(appId: string, appKey: string): string {
  const raw = `${appId}|${appKey}`.toLowerCase();
  return crypto.createHash('sha1').update(raw, 'utf8').digest('hex');
}

async function getToken(appId: string, appKey: string): Promise<{ token: string; expiry: Date }> {
  const hashToken = computeHashToken(appId, appKey);
  const response = await axios.get(TOKEN_URL, {
    params: { appId, hashToken },
  });
  return {
    token: response.data.result.token,
    expiry: new Date(response.data.result.expiry),
  };
}
```

### Open-Meteo Forecast Call
```typescript
// Source: https://open-meteo.com/en/docs
const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast';

async function fetchWeatherForecast() {
  const response = await axios.get(OPEN_METEO_URL, {
    params: {
      latitude: 37.7749,
      longitude: -122.4194,
      hourly: 'temperature_2m,precipitation,visibility,weather_code,wind_speed_10m',
      forecast_days: 7,
      timezone: 'America/Los_Angeles',
    },
    timeout: 15000,
  });
  // weather_code 45 = fog, 48 = depositing rime fog
  return response.data;
}
```

### TimescaleDB Schema (Migration 001)
```sql
-- Migration 001: Create TimescaleDB extension and core tables

CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Speed readings hypertable
CREATE TABLE speed_readings (
  segment_id    TEXT        NOT NULL,
  recorded_at   TIMESTAMPTZ NOT NULL,
  speed         REAL,           -- current speed (mph)
  free_flow_speed REAL,         -- INRIX reference speed
  historical_avg  REAL,         -- INRIX average for this time/day
  congestion_score SMALLINT,    -- speedBucket 0-3
  travel_time_min  REAL,        -- travelTimeMinutes from INRIX
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

SELECT create_hypertable('speed_readings', 'recorded_at',
  chunk_time_interval => INTERVAL '1 day'
);

CREATE INDEX idx_speed_segment_time ON speed_readings (segment_id, recorded_at DESC);

-- Incidents table
CREATE TABLE incidents (
  incident_id   TEXT        NOT NULL,
  recorded_at   TIMESTAMPTZ NOT NULL,
  incident_type SMALLINT,       -- 1=Construction, 2=Event, 3=Flow, 4=Incident
  severity      SMALLINT,       -- 0-4
  latitude      REAL,
  longitude     REAL,
  short_desc    TEXT,
  long_desc     TEXT,
  direction     TEXT,
  impacting     BOOLEAN,
  delay_from_typical_min REAL,
  delay_from_freeflow_min REAL,
  status        TEXT,           -- Active/Cleared/Inactive
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

SELECT create_hypertable('incidents', 'recorded_at',
  chunk_time_interval => INTERVAL '1 day'
);

CREATE INDEX idx_incident_time ON incidents (recorded_at DESC);

-- Weather forecasts table
CREATE TABLE weather_forecasts (
  forecast_hour   TIMESTAMPTZ NOT NULL,  -- the hour being forecast
  fetched_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  temperature_c   REAL,
  precipitation_mm REAL,
  visibility_m    REAL,
  weather_code    SMALLINT,    -- WMO code (45/48 = fog)
  wind_speed_kmh  REAL,
  UNIQUE (forecast_hour)
);

-- Calendar flags table (regular table, not hypertable)
CREATE TABLE calendar_flags (
  flag_date     DATE        PRIMARY KEY,
  school_day    BOOLEAN     NOT NULL DEFAULT TRUE,
  event_name    TEXT,
  event_type    TEXT         -- 'giants', 'warriors', 'concert', 'festival', etc.
);

-- API call budget log
CREATE TABLE api_call_log (
  id            SERIAL      PRIMARY KEY,
  service       TEXT        NOT NULL,   -- 'inrix_speeds', 'inrix_incidents', 'weather'
  endpoint      TEXT,
  called_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status        TEXT        NOT NULL DEFAULT 'pending',  -- pending/success/error
  status_code   SMALLINT,
  response_time_ms INTEGER,
  error_message TEXT
);

CREATE INDEX idx_call_log_service_time ON api_call_log (service, called_at DESC);

-- Job execution log
CREATE TABLE job_log (
  id            SERIAL      PRIMARY KEY,
  job_name      TEXT        NOT NULL,
  started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at   TIMESTAMPTZ,
  status        TEXT        NOT NULL DEFAULT 'running',  -- running/success/error/skipped
  records_processed INTEGER DEFAULT 0,
  error_message TEXT
);
```

### TimescaleDB Compression Policy
```sql
-- Migration 002: Enable compression (run after initial data collection begins)

ALTER TABLE speed_readings SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'segment_id',
  timescaledb.compress_orderby = 'recorded_at DESC'
);

-- Compress chunks older than 7 days
SELECT add_compression_policy('speed_readings', INTERVAL '7 days');

ALTER TABLE incidents SET (
  timescaledb.compress,
  timescaledb.compress_orderby = 'recorded_at DESC'
);

SELECT add_compression_policy('incidents', INTERVAL '7 days');
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| INRIX legacy `Inrix.ashx` endpoints | New REST API at `segment-api.inrix.com/v1/` | 2024-2025 | New endpoints default to JSON, cleaner parameter names. Legacy still works but deprecated. |
| INRIX XML default response | JSON default on new endpoints | 2024-2025 | No XML parsing needed on new endpoints. Always set Accept: application/json as safety. |
| TimescaleDB manual compression | Automated compression policies | TimescaleDB 2.x | `add_compression_policy()` handles compression automatically on schedule. |
| Custom migration scripts | node-pg-migrate 8.x | 2024-2025 | SQL-file-based migrations with rollback, TypeScript support. |

## Open Questions

1. **INRIX bounding-box segment count for SF**
   - What we know: The box 37.858,-122.541 to 37.699,-122.341 returns "all SF segments" per one API call.
   - What's unclear: Exactly how many segments this returns (could be 50 or 500). This affects INSERT batch size and storage growth rate.
   - Recommendation: Make the first API call manually and log the segment count. Adjust storage estimates accordingly.

2. **INRIX score field availability**
   - What we know: The legacy API had a 0-30 data quality score. The new Segment Speed API has `SpeedOutputFields=All`.
   - What's unclear: Whether the quality score is returned in the new API or only in legacy.
   - Recommendation: Request `SpeedOutputFields=All` and inspect the response. If no quality score, rely on speedBucket for congestion classification only.

3. **INRIX token expiry duration**
   - What we know: Docs say tokens are time-limited and to cache them. One example shows a 24-hour token.
   - What's unclear: Whether trial-tier tokens have a different expiry than paid-tier.
   - Recommendation: Parse the `expiry` field from the token response and respect it. Do not hardcode 24 hours.

4. **INRIX incidents API call counting**
   - What we know: The incidents endpoint is at a different host (`incident-api.inrix.com`) from speeds (`segment-api.inrix.com`).
   - What's unclear: Whether incidents calls count against the same 2000/week budget as speed calls, or if they have a separate allocation.
   - Recommendation: Assume they share the same budget (conservative). Verify empirically after first week of collection.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.0 |
| Config file | vitest.config.ts (Wave 0 -- needs creation) |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DATA-01 | INRIX speed collection returns and parses segments | unit | `npx vitest run src/collectors/__tests__/inrix-speeds.test.ts` | Wave 0 |
| DATA-02 | Budget tracker enforces 80% weekly limit | unit | `npx vitest run src/services/__tests__/budget-tracker.test.ts` | Wave 0 |
| DATA-03 | Speed readings insert correctly into hypertable | integration | `npx vitest run src/db/__tests__/speed-readings.test.ts` | Wave 0 |
| DATA-04 | Incident collection returns and stores incidents | unit | `npx vitest run src/collectors/__tests__/inrix-incidents.test.ts` | Wave 0 |
| DATA-05 | Weather forecast fetch and upsert | unit | `npx vitest run src/collectors/__tests__/weather.test.ts` | Wave 0 |
| DATA-06 | School calendar CSV parsed and loaded | unit | `npx vitest run src/seed/__tests__/school-calendar.test.ts` | Wave 0 |
| DATA-07 | Events seed file parsed and loaded | unit | `npx vitest run src/seed/__tests__/events.test.ts` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `vitest.config.ts` -- project test configuration
- [ ] `tsconfig.json` -- TypeScript configuration
- [ ] `src/collectors/__tests__/inrix-speeds.test.ts` -- covers DATA-01
- [ ] `src/services/__tests__/budget-tracker.test.ts` -- covers DATA-02
- [ ] `src/db/__tests__/speed-readings.test.ts` -- covers DATA-03 (integration, needs test DB)
- [ ] `src/collectors/__tests__/inrix-incidents.test.ts` -- covers DATA-04
- [ ] `src/collectors/__tests__/weather.test.ts` -- covers DATA-05
- [ ] `src/seed/__tests__/school-calendar.test.ts` -- covers DATA-06
- [ ] `src/seed/__tests__/events.test.ts` -- covers DATA-07
- [ ] Framework install: `npm install -D vitest` -- part of initial setup

## Sources

### Primary (HIGH confidence)
- [INRIX Segment Speed API](https://docs.inrix.com/traffic/segmentspeed/) -- endpoint URL, parameters, response fields
- [INRIX Authentication](https://docs.inrix.com/authentication/getting_authorized/) -- token flow, hashToken generation, expiry
- [INRIX Incidents API](https://docs.inrix.com/traffic/xdincidents/) -- bounding box incidents, response fields, types
- [INRIX Incidents New API](https://incident-api.inrix.com/v1/incidents) -- current endpoint confirmed
- [Open-Meteo Forecast API](https://open-meteo.com/en/docs) -- hourly variables, weather_code for fog, forecast_days parameter
- [TimescaleDB Hypertables](https://docs.timescale.com/use-timescale/latest/hypertables/about-hypertables/) -- chunk intervals, compression policies
- npm registry (verified 2026-03-19) -- pg 8.20.0, axios 1.13.6, node-cron 4.2.1, zod 4.3.6, dotenv 17.3.1, node-pg-migrate 8.0.4, vitest 4.1.0, TypeScript 5.9.3

### Secondary (MEDIUM confidence)
- [TimescaleDB Compression Docs](https://docs.timescale.com/use-timescale/latest/compression/manual-compression/) -- compress_segmentby, add_compression_policy
- [TimescaleDB Docker Image](https://hub.docker.com/r/timescale/timescaledb/) -- latest-pg16 tag, version pinning advice
- [node-pg-migrate](https://salsita.github.io/node-pg-migrate/) -- SQL migration file format, TypeScript CLI

### Tertiary (LOW confidence)
- INRIX trial-tier quota sharing between speed and incidents endpoints -- needs empirical verification
- INRIX segment count for SF bounding box -- needs first API call to determine
- INRIX data quality score availability in new API -- needs response inspection

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all versions verified via npm registry, API endpoints verified via official docs
- Architecture: HIGH -- patterns align with CONTEXT.md locked decisions and ARCHITECTURE.md research
- INRIX API specifics: MEDIUM -- endpoint URLs and params confirmed from docs, but trial-tier behavior (quota sharing, segment counts) unverified
- Pitfalls: HIGH -- derived from official API docs and established TimescaleDB patterns

**Research date:** 2026-03-19
**Valid until:** 2026-04-19 (stable APIs, 30-day validity)
