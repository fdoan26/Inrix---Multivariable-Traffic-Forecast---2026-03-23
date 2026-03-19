---
phase: 01-data-pipeline
verified: 2026-03-19T14:45:00Z
status: human_needed
score: 13/13 must-haves verified
re_verification:
  previous_status: gaps_found
  previous_score: 12/13
  gaps_closed:
    - "TypeScript project compiles with strict mode (npx tsc --noEmit exits 0)"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Run worker process and confirm all three collectors are invoked on schedule"
    expected: "Cron fires collectSpeeds at :00 and :15 of each hour, collectIncidents at :00 and :30, collectWeather once at 08:00 UTC"
    why_human: "Cannot verify cron scheduling behaviour programmatically without a live DB and INRIX credentials"
  - test: "Run migrations against a local TimescaleDB instance and confirm hypertables are created"
    expected: "SELECT * FROM timescaledb_information.hypertables returns speed_readings, incidents, weather_forecasts"
    why_human: "No TimescaleDB available in CI; migration SQL must be applied to a real instance to verify"
  - test: "Run 'npm run seed:calendar' and 'npm run seed:events' against a live DB"
    expected: "calendar_flags has 121 school-day rows and 22 event rows; duplicate run updates rather than duplicating"
    why_human: "Upsert ON CONFLICT behaviour requires a real database to confirm"
---

# Phase 1: Data Pipeline Verification Report

**Phase Goal:** All external data sources flowing into the database on schedule, within INRIX rate limits, accumulating the historical data the forecast model needs
**Verified:** 2026-03-19T14:45:00Z
**Status:** human_needed — all 13 automated checks pass; 3 items require a live database/credentials
**Re-verification:** Yes — after gap closure (TypeScript strict-mode compile error fixed in 01-04)

## Gap Closure Summary

The single gap from the initial verification is confirmed closed:

- **Was failing:** `npx tsc --noEmit` exited with code 2; 17 type errors across three collector test files because `vi.mocked(axios).get` does not carry vitest mock method types under strict mode.
- **Fix applied:** All three test files now declare `const mockedAxiosGet = vi.mocked(axios.get)` (line 27 in each of `inrix-speeds.test.ts`, `inrix-incidents.test.ts`, `weather.test.ts`). The old `vi.mocked(axios)` variable is completely absent.
- **Confirmed:** `npx tsc --noEmit` exits 0 with zero errors. `npx vitest run` reports 51/51 tests passing with no regressions.

---

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | TypeScript project compiles with strict mode | VERIFIED | `npx tsc --noEmit` exits 0; zero errors. Old `vi.mocked(axios)` pattern absent from all three test files; `vi.mocked(axios.get)` present in each. |
| 2  | All 51 unit tests pass after the type fix | VERIFIED | `npx vitest run` reports 51/51 tests passing across 10 test files |
| 3  | Database schema creates all required tables when migrations run | VERIFIED | `001_create-extension-and-tables.sql` contains all 6 tables with correct DDL and 3 hypertable calls |
| 4  | INRIX auth acquires and caches tokens with expiry-aware refresh | VERIFIED | `inrix-auth.ts` lines 22-43: 5-min threshold check, axios GET to uas-api.inrix.com, token + expiry cached |
| 5  | Budget tracker blocks API calls when weekly count reaches 1600 | VERIFIED | `budget-tracker.ts` lines 6-14: `count < WEEKLY_LIMIT` (1600), startOfISOWeek boundary, api_call_log query |
| 6  | Retry utility retries up to 3 times with exponential backoff | VERIFIED | `retry.ts` lines 14-46: loop up to maxAttempts, `baseDelayMs * 2^(attempt-1) + jitter`, capped at maxDelayMs |
| 7  | INRIX speed collector fetches all SF segments via bounding-box and stores in speed_readings | VERIFIED | `inrix-speeds.ts`: segment-api.inrix.com/v1/segments/speed, box=37.858\|-122.541,..., SpeedResponseSchema.parse, insertSpeedReadings |
| 8  | INRIX incident collector fetches via bounding-box and stores in incidents table | VERIFIED | `inrix-incidents.ts`: incident-api.inrix.com/v1/incidents, incidentType=Incidents,Construction,Events,Flow, IncidentResponseSchema.parse, insertIncidents |
| 9  | Weather collector fetches Open-Meteo 7-day hourly forecast and upserts into weather_forecasts | VERIFIED | `weather.ts`: api.open-meteo.com/v1/forecast, lat=37.7749, lon=-122.4194, forecast_days=7, WeatherResponseSchema.parse, upsertWeatherForecasts |
| 10 | All collectors validate API responses with Zod before database insertion | VERIFIED | Each collector calls .parse() on response.data before passing to DB query function |
| 11 | All collectors log calls to api_call_log via budget tracker before making requests | VERIFIED | All three collectors call recordCall() before the withRetry(axios.get(...)) block |
| 12 | SFUSD school calendar CSV is parsed and loaded into calendar_flags with school_day boolean per date | VERIFIED | `school-calendar.ts`: csv-parse/sync, `r.school_day === 'true'` boolean mapping, upsertSchoolDays |
| 13 | Event seed file is parsed and loaded into calendar_flags with event_name and event_type | VERIFIED | `events.ts`: Zod array validation, EventRow mapping, upsertEvents; events.json has 22 entries covering giants/warriors/festival/concert |

**Score:** 13/13 truths verified

---

## Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `backend/src/db/migrations/001_create-extension-and-tables.sql` | VERIFIED | CREATE EXTENSION timescaledb; 3 hypertables (speed_readings, incidents, weather_forecasts), 3 regular tables (calendar_flags, api_call_log, job_log) |
| `backend/src/db/migrations/002_compression-policies.sql` | VERIFIED | File exists |
| `backend/src/services/inrix-auth.ts` | VERIFIED | Exports computeHashToken + InrixAuthService; SHA1 via node:crypto; uas-api.inrix.com endpoint |
| `backend/src/services/budget-tracker.ts` | VERIFIED | Exports checkBudget, recordCall, updateCallStatus; api_call_log query; startOfISOWeek; WEEKLY_LIMIT=1600 |
| `backend/src/services/retry.ts` | VERIFIED | Exports withRetry; maxAttempts/baseDelayMs/maxDelayMs/onRetry options; exponential backoff with jitter |
| `backend/src/collectors/schemas/inrix.ts` | VERIFIED | Exports SpeedResponseSchema, IncidentResponseSchema, SpeedSegment, Incident types |
| `backend/src/collectors/schemas/weather.ts` | VERIFIED | Exports WeatherResponseSchema, WeatherHourly, WeatherResponse types |
| `backend/src/collectors/inrix-speeds.ts` | VERIFIED | Exports collectSpeeds; full lifecycle: logJobStart -> checkBudget -> recordCall -> withRetry -> Zod parse -> insertSpeedReadings -> updateCallStatus -> logJobEnd |
| `backend/src/collectors/inrix-incidents.ts` | VERIFIED | Exports collectIncidents; same lifecycle; IncidentResponseSchema; incidentType param |
| `backend/src/collectors/weather.ts` | VERIFIED | Exports collectWeather; no budget check (Open-Meteo is free); WeatherResponseSchema; upsertWeatherForecasts |
| `backend/src/collectors/__tests__/inrix-speeds.test.ts` | VERIFIED | Line 27: `const mockedAxiosGet = vi.mocked(axios.get)`; 7 tests; 0 occurrences of `vi.mocked(axios)` |
| `backend/src/collectors/__tests__/inrix-incidents.test.ts` | VERIFIED | Line 27: `const mockedAxiosGet = vi.mocked(axios.get)`; 6 tests; 0 occurrences of `vi.mocked(axios)` |
| `backend/src/collectors/__tests__/weather.test.ts` | VERIFIED | Line 25: `const mockedAxiosGet = vi.mocked(axios.get)`; 6 tests; 0 occurrences of `vi.mocked(axios)` |
| `backend/src/db/queries/speed-readings.ts` | VERIFIED | Exports insertSpeedReadings; multi-row parameterized INSERT INTO speed_readings |
| `backend/src/db/queries/incidents.ts` | VERIFIED | Exports insertIncidents; 13-column parameterized INSERT INTO incidents |
| `backend/src/db/queries/weather.ts` | VERIFIED | Exports upsertWeatherForecasts; INSERT ON CONFLICT (forecast_hour) DO UPDATE SET EXCLUDED.* |
| `backend/src/db/queries/budget.ts` | VERIFIED | Exports logJobStart, logJobEnd; INSERT/UPDATE job_log table |
| `backend/src/db/queries/calendar.ts` | VERIFIED | Exports upsertSchoolDays, upsertEvents; ON CONFLICT (flag_date) DO UPDATE for both |
| `backend/src/seed/school-calendar.ts` | VERIFIED | Exports seedSchoolCalendar; csv-parse/sync; sfusd-calendar.csv default path; string-to-boolean mapping |
| `backend/src/seed/events.ts` | VERIFIED | Exports seedEvents; Zod EventSchema validation; events.json default path |
| `backend/data/sfusd-calendar.csv` | VERIFIED | 122 lines (121 data rows + header); first line "date,school_day"; covers Mar-Jun 2026 |
| `backend/data/events.json` | VERIFIED | 22 entries; types: giants, warriors, festival, concert |
| `backend/src/worker.ts` | VERIFIED | cron.schedule with */15, */30, 0 8 patterns; createJob overlap prevention; SIGINT/SIGTERM graceful shutdown; dotenv/config at top |
| `backend/src/db/connection.ts` | VERIFIED | pg Pool singleton; exports query helper and getPool; dotenv/config |
| `backend/package.json` | VERIFIED | All required dependencies: pg, axios, node-cron, zod, dotenv, date-fns, csv-parse; devDeps: typescript, vitest, tsx, node-pg-migrate; all scripts present |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `budget-tracker.ts` | `db/connection.ts` | pg Pool query to api_call_log | WIRED | Line 1: `import { query } from '../db/connection.js'`; api_call_log in both checkBudget and recordCall |
| `inrix-auth.ts` | `https://uas-api.inrix.com/v1/appToken` | axios GET with appId and hashToken | WIRED | TOKEN_URL const; axios.get(TOKEN_URL, { params: { appId, hashToken } }) |
| `inrix-speeds.ts` | `budget-tracker.ts` | checkBudget() before API call, recordCall() before HTTP | WIRED | Lines 17-23: checkBudget called, early return if !budget.allowed, then recordCall before withRetry block |
| `inrix-speeds.ts` | `inrix-auth.ts` | getToken() for Authorization header | WIRED | Line 29: `const token = await auth.getToken()` inside withRetry |
| `inrix-speeds.ts` | `collectors/schemas/inrix.ts` | SpeedResponseSchema.parse() on API response | WIRED | Line 53: `const parsed = SpeedResponseSchema.parse(response.data)` |
| `weather.ts` | `collectors/schemas/weather.ts` | WeatherResponseSchema.parse() on API response | WIRED | Line 35: `const parsed = WeatherResponseSchema.parse(response.data)` |
| `db/queries/weather.ts` | `weather_forecasts table` | INSERT ON CONFLICT (forecast_hour) DO UPDATE | WIRED | Lines 35-43: exact SQL with EXCLUDED.temperature_c etc. |
| `worker.ts` | `collectors/inrix-speeds.ts` | cron.schedule('*/15 * * * *', collectSpeeds) | WIRED | Line 41: `cron.schedule('*/15 * * * *', createJob('inrix_speeds', () => collectSpeeds(auth)))` |
| `worker.ts` | `collectors/inrix-incidents.ts` | cron.schedule('*/30 * * * *', collectIncidents) | WIRED | Line 44: `cron.schedule('*/30 * * * *', createJob('inrix_incidents', () => collectIncidents(auth)))` |
| `worker.ts` | `collectors/weather.ts` | cron.schedule('0 8 * * *', collectWeather) | WIRED | Line 47: `cron.schedule('0 8 * * *', createJob('weather', () => collectWeather()))` |
| `seed/school-calendar.ts` | `db/queries/calendar.ts` | upsertSchoolDays after CSV parse | WIRED | Line 21: `const count = await upsertSchoolDays(rows)` |
| `inrix-speeds.test.ts` | `axios` | vi.mocked(axios.get) typed mock | WIRED | Line 27: `const mockedAxiosGet = vi.mocked(axios.get)` — carries MockedFunction types |
| `inrix-incidents.test.ts` | `axios` | vi.mocked(axios.get) typed mock | WIRED | Line 27: `const mockedAxiosGet = vi.mocked(axios.get)` — carries MockedFunction types |
| `weather.test.ts` | `axios` | vi.mocked(axios.get) typed mock | WIRED | Line 25: `const mockedAxiosGet = vi.mocked(axios.get)` — carries MockedFunction types |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| DATA-01 | 01-02 | System collects SF segment speeds from INRIX bounding-box endpoint on a scheduled basis | SATISFIED | inrix-speeds.ts uses segment-api.inrix.com bounding-box; worker.ts schedules every 15 min |
| DATA-02 | 01-01 | INRIX call budget stays within 2000 calls/week (budget tracker enforced before each job run) | SATISFIED | budget-tracker.ts enforces at 1600 (more conservative than 2000 cap); checkBudget called before every INRIX HTTP request |
| DATA-03 | 01-01 | Collected readings stored in TimescaleDB hypertable with segment ID, timestamp, speed, free-flow speed, historical average, and congestion score | SATISFIED | migration 001 creates speed_readings hypertable with all required columns; insertSpeedReadings maps all fields |
| DATA-04 | 01-02 | INRIX incidents collected and stored separately | SATISFIED | inrix-incidents.ts fetches incident-api.inrix.com; insertIncidents stores in incidents hypertable |
| DATA-05 | 01-02 | Open-Meteo 7-day hourly weather forecast fetched daily and stored (temperature, precipitation, visibility/fog) | SATISFIED | weather.ts fetches 7-day hourly with all weather fields; upserts into weather_forecasts; worker schedules daily at 08:00 UTC |
| DATA-06 | 01-03 | SFUSD school calendar ingested (school day vs. break vs. holiday flags by date) | SATISFIED | school-calendar.ts parses sfusd-calendar.csv (121 rows); school_day boolean upserted into calendar_flags |
| DATA-07 | 01-03 | Local event calendar ingested -- Giants/Warriors games, major concerts, Outside Lands flagged | SATISFIED | events.json has 22 entries with giants/warriors/festival/concert types; seedEvents upserts into calendar_flags |

All 7 Phase 1 requirements are SATISFIED. No orphaned requirements found.

---

## Anti-Patterns Found

No anti-patterns detected in any source or test file.

- No `vi.mocked(axios)` (untyped mock) present in any collector test file.
- No stub implementations, empty handlers, or placeholder returns in production source files.
- No TODO/FIXME/placeholder comments in modified files.

---

## Test Suite Results

51/51 tests passing across 10 test files (confirmed by `npx vitest run` after gap closure):

- `src/services/__tests__/inrix-auth.test.ts` — 6 tests
- `src/services/__tests__/budget-tracker.test.ts` — 7 tests
- `src/services/__tests__/retry.test.ts` — 5 tests
- `src/collectors/schemas/__tests__/inrix.test.ts` — 5 tests
- `src/collectors/schemas/__tests__/weather.test.ts` — 2 tests
- `src/collectors/__tests__/inrix-speeds.test.ts` — 7 tests
- `src/collectors/__tests__/inrix-incidents.test.ts` — 6 tests
- `src/collectors/__tests__/weather.test.ts` — 6 tests
- `src/seed/__tests__/school-calendar.test.ts` — 3 tests
- `src/seed/__tests__/events.test.ts` — 3 tests

---

## Human Verification Required

### 1. Worker Cron Schedule Execution

**Test:** Start the worker with `npm run worker` (requires a running TimescaleDB and .env with credentials), wait 15 minutes, then query `SELECT * FROM job_log ORDER BY started_at DESC LIMIT 5`.
**Expected:** Rows for inrix_speeds (every 15 min), inrix_incidents (every 30 min), and weather (at 08:00 UTC) with status='success' or budget-skipped.
**Why human:** Cannot verify cron scheduling behaviour or DB writes without a live database and INRIX API credentials.

### 2. TimescaleDB Migration Execution

**Test:** Run `npm run migrate up` against a fresh TimescaleDB instance. Then run `SELECT * FROM timescaledb_information.hypertables;`
**Expected:** Three rows: speed_readings (chunk_interval=1 day), incidents (chunk_interval=1 day), weather_forecasts (chunk_interval=7 days).
**Why human:** TimescaleDB extension required; no live instance in this environment.

### 3. Seed Scripts Against Live DB

**Test:** Run `npm run seed:calendar` and `npm run seed:events`, then run each a second time.
**Expected:** First run inserts 121 school day rows and 22 event rows. Second run updates without creating duplicates (ON CONFLICT DO UPDATE).
**Why human:** Upsert idempotency requires a real PostgreSQL/TimescaleDB instance to verify.

---

*Verified: 2026-03-19T14:45:00Z*
*Verifier: Claude (gsd-verifier)*
