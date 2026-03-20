---
phase: 03-api-layer
verified: 2026-03-19T00:00:00Z
status: passed
score: 10/10 must-haves verified
gaps: []
human_verification:
  - test: "Sub-200ms response time validation for API-01 and API-02 under load"
    expected: "GET /api/corridors/:id/current and /:id/forecast respond in under 200ms when the database has pre-computed data"
    why_human: "No benchmark or load test exists in the codebase. API-01 and API-02 have no in-memory caching — response time depends entirely on DB latency, which cannot be verified without a running database."
---

# Phase 3: API Layer Verification Report

**Phase Goal:** Pre-computed forecasts and live data are accessible through a REST API with sub-200ms response times
**Verified:** 2026-03-19
**Status:** passed (with one human verification item)
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | CORS headers are present on all API responses with configurable allowed origins | VERIFIED | `app.use(cors({ origin: allowedOrigins }))` before JSON middleware in `api/index.ts`; ALLOWED_ORIGINS env var parsed with default `http://localhost:5173`; 2 supertest tests confirm header presence and preflight 204 |
| 2 | Unhandled route errors return JSON `{error: string}` with 500 status, not HTML | VERIFIED | 4-param error handler at end of `api/index.ts`; 2 supertest tests confirm JSON body `{error: "Internal server error"}` and `application/json` content-type |
| 3 | In-memory cache stores and retrieves values with TTL expiry | VERIFIED | `cache.ts` has `Map`-backed store, `DEFAULT_TTL_MS = 6h`, lazy eviction on get; 6 vitest unit tests with fake timers cover all behaviors |
| 4 | Cache returns undefined for expired entries | VERIFIED | `cacheGet` checks `Date.now() > entry.expires` and deletes on expiry; test confirms this with `vi.advanceTimersByTime` |
| 5 | GET /api/corridors/:corridorId/departure-windows returns ranked departure windows sorted by best travel time | VERIFIED | Route at line 69 of `forecasts.ts`; SQL ORDER BY p50_minutes ASC; test confirms `windows[0].estimated_travel_min` is the lower p50 value |
| 6 | Each window includes departure_at, estimated_travel_min, p10_minutes, p90_minutes, congestion_risk, and reason | VERIFIED | Response shape mapped at lines 127-135 of `forecasts.ts`; integration test verifies all 6 fields present |
| 7 | Invalid params (bad ISO date, out-of-range window_count) return 400 with `{error: string}` | VERIFIED | Zod `departureWindowsSchema` with `safeParse`; 7-day check; 3 tests covering `not-a-date`, `window_count=0`, `window_count=51`, `arrival > 7 days` |
| 8 | Unknown corridor returns 404 | VERIFIED | Corridor lookup query; `rows.length === 0` check returns 404; integration test with empty mock confirms |
| 9 | Results are cached — second identical request does not hit DB | VERIFIED | `cacheGet`/`cacheSet` wired at lines 92-96 and 143 of `forecasts.ts`; test confirms `mockedQuery` not called on cache hit; separate test confirms `cacheSet` called after DB query |
| 10 | Reason field surfaces weather/event/school modifiers when active, null otherwise | VERIFIED | `deriveReason` helper checks `> 1.05` threshold for each modifier; integration tests confirm reason contains correct strings and is null when modifiers are null |

**Score:** 10/10 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/src/services/cache.ts` | In-memory TTL cache with cacheGet, cacheSet, cacheClear exports | VERIFIED | 26 lines, all 3 functions exported, 6-hour default TTL, lazy eviction |
| `backend/src/api/index.ts` | Express app with CORS, JSON, routers, and error middleware | VERIFIED | cors import present, CORS before JSON body parser, 4-param error handler after routes |
| `backend/src/services/__tests__/cache.test.ts` | Cache unit tests | VERIFIED | 6 `it()` blocks, fake timers, covers all specified behaviors |
| `backend/src/api/__tests__/cors.test.ts` | CORS integration tests | VERIFIED | 2 `it()` blocks, supertest with Origin header, preflight 204 |
| `backend/src/api/__tests__/error-middleware.test.ts` | Error middleware integration tests | VERIFIED | 2 `it()` blocks, DB rejection triggers 500 JSON |
| `backend/src/api/forecasts.ts` | Departure-windows endpoint on forecastsRouter | VERIFIED | Route at `/:corridorId/departure-windows`, Zod schema, `deriveCongestionRisk`, `deriveReason`, cacheGet/cacheSet wired |
| `backend/src/api/__tests__/departure-windows.test.ts` | Supertest integration tests for departure-windows | VERIFIED | 16 `it()` blocks covering success, shape, departure_at computation, all congestion_risk levels, reason with/without modifiers, 400 variants, 404, cache hit/miss, cacheSet call |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `backend/src/api/index.ts` | cors package | `app.use(cors(...))` | WIRED | Line 13: `app.use(cors({ origin: allowedOrigins }))` before `app.use(express.json())` at line 14 |
| `backend/src/api/index.ts` | error middleware | 4-param handler after routes | WIRED | Lines 25-28: `(err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction)` after all route registrations |
| `backend/src/api/forecasts.ts` | `backend/src/db/connection.ts` | `query()` for forecasts table | WIRED | Lines 99 and 109: two `query()` calls; result rows mapped to response |
| `backend/src/api/forecasts.ts` | `backend/src/services/cache.ts` | `cacheGet`/`cacheSet` for response caching | WIRED | Line 4 import; `cacheGet` called at line 92, `cacheSet` called at line 143 |
| `backend/src/api/forecasts.ts` | zod | Zod schema validation on query params | WIRED | Line 2 import; `departureWindowsSchema.safeParse(req.query)` at line 73 |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| API-01 | 03-01-PLAN.md | REST API endpoint serving current corridor speeds | SATISFIED | `backend/src/api/corridors.ts` — `/:corridorId/current` route queries `speed_readings` and returns congestion_level, avg_travel_time_min, segments with speed/congestion_score |
| API-02 | 03-01-PLAN.md | REST API endpoint serving week-ahead forecast for a given corridor | SATISFIED | `backend/src/api/forecasts.ts` — `/:corridorId/forecast` route queries `forecasts` table returning p10/p50/p90 and modifier columns across requested hour window |
| API-03 | 03-02-PLAN.md | REST API endpoint serving best departure windows for origin/destination pair | SATISFIED | `backend/src/api/forecasts.ts` — `/:corridorId/departure-windows` route with Zod validation, ranked windows, congestion_risk, reason field, cache integration |

All three requirements claimed by the phase plans are present and substantive. No orphaned requirements found — REQUIREMENTS.md maps API-01, API-02, API-03 exclusively to Phase 3, all accounted for.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found | — | — | — | — |

No TODOs, FIXMEs, empty return stubs, placeholder comments, or console.log-only handlers found in any phase-3 files. All route handlers perform real DB queries or return real computed data.

---

### Commit Verification

All commit hashes documented in summaries are confirmed present in git history:

| Commit | Summary claim | Status |
|--------|---------------|--------|
| `865f013` | test(03-01): cache RED | Present |
| `3faba33` | feat(03-01): cache GREEN | Present |
| `80be57f` | test(03-01): CORS/error RED | Present |
| `f56c41e` | feat(03-01): CORS/error GREEN | Present |
| `1b60d9f` | test(03-02): departure-windows RED | Present |
| `a49932a` | feat(03-02): departure-windows GREEN | Present |

---

### Human Verification Required

#### 1. Sub-200ms Response Time Under Database Load

**Test:** Start the backend with a real database containing pre-computed forecast data. Use `curl -w "%{time_total}"` or `autocannon` to send 50 requests to each of the three endpoints:
- `GET /api/corridors/us-101/current`
- `GET /api/corridors/us-101/forecast`
- `GET /api/corridors/us-101/departure-windows?arrival=<ISO_WITHIN_7_DAYS>`

**Expected:** p95 response time under 200ms for all three endpoints. The departure-windows endpoint should be faster on the second request (cache hit, no DB).

**Why human:** No load test or benchmark exists in the codebase. API-01 (`corridors.ts`) and API-02 (`forecasts.ts`) have no in-memory cache — they query the database on every request. Response time depends on DB latency, TimescaleDB indexing, and network conditions, none of which can be verified statically. The sub-200ms success criterion is satisfied architecturally (no ML inference in request path, pre-computed data), but cannot be confirmed without a live database.

---

### Gaps Summary

No gaps. All 10 must-haves from the two PLAN frontmatter blocks are verified: all artifacts exist at the expected paths, all are substantive (not stubs), all key links are wired end-to-end, and all three requirement IDs (API-01, API-02, API-03) are satisfied by real implementations.

The one human verification item (sub-200ms latency) is a performance characteristic that cannot be confirmed statically. The architectural approach — pre-computed forecasts stored in TimescaleDB, cache on the departure-windows endpoint — is the correct mechanism. Whether it achieves 200ms in production depends on DB setup, indexing, and infrastructure not present in this codebase verification context.

---

_Verified: 2026-03-19_
_Verifier: Claude (gsd-verifier)_
