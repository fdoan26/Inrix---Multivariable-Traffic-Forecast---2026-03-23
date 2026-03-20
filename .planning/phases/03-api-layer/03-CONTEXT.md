# Phase 3: API Layer - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 3 completes the REST API surface: API-01 (current corridor speeds) and API-02 (week-ahead forecast) were delivered early in Phase 2. The remaining work is API-03 (departure windows endpoint), plus CORS, request validation middleware, and an in-memory caching layer to hit sub-200ms response times. No frontend work in this phase.

</domain>

<decisions>
## Implementation Decisions

### API-03 Departure Windows Endpoint
- Route: `GET /api/corridors/:corridorId/departure-windows?arrival=<ISO>&window_count=10`
- Input: `corridorId` (path param), `arrival` (ISO 8601 timestamp, required), `window_count` (optional, default 10, max 50)
- Algorithm: query forecasts table for slots within ±3 hours of the requested arrival time across the full 7-day lookahead, sort by p50_minutes ASC (lowest travel time = best departure), return top `window_count` results
- Response shape: `{corridor_id, arrival_target, windows: [{departure_at, estimated_travel_min, p10_minutes, p90_minutes, congestion_risk, reason}]}`
- `congestion_risk`: derived from p50 vs historical average (free_flow / moderate / heavy)
- `reason`: human-readable explanation derived from modifier columns (e.g., "Weather: rain forecast", "Event: Giants game", "School: school day morning rush") — null when no modifiers active
- Mount at `/api/corridors/:corridorId/departure-windows` in existing forecastsRouter

### Caching Strategy
- In-memory `Map`-based cache with TTL — no Redis, no external dependency for solo dev MVP
- Cache TTL: 6 hours, aligned with forecast refresh cycle
- Cache key: `${corridorId}:${endpointType}` (e.g., `us-101-n:forecast`, `us-101-n:departures:09:00`)
- Cache invalidation: TTL-based only (no manual invalidation in MVP)
- Cache is module-level in a `cache.ts` service, shared across routers

### Request Validation & Error Contracts
- Zod schemas for all query params — already the established pattern (inrix.ts, worker.ts)
- Standard error response: `{error: string}` JSON with appropriate HTTP status
  - 400: invalid params (bad ISO date, window_count out of range, unknown corridorId format)
  - 404: corridor not found in DB
  - 500: DB query failure
- Express error middleware in `api/index.ts` catches unhandled errors and returns 500
- Arrival time must be within the next 7 days (beyond that, no forecast data exists)

### CORS & Deployment Readiness
- `cors` npm package with `ALLOWED_ORIGINS` env var (comma-separated)
- Default: `http://localhost:5173` (Vite dev server) in development, configurable for Railway/Render prod
- Applied at app level in `api/index.ts` before routes
- `dotenv/config` already loaded in `server.ts`

### What's Already Done (Phase 2)
- API-01: `GET /api/corridors/:corridorId/current` — live speed + congestion level (corridors.ts)
- API-02: `GET /api/corridors/:corridorId/forecast` — week-ahead p10/p50/p90 (forecasts.ts)
- Health check: `GET /api/health`
- Express 5.1, TypeScript, vitest + supertest test pattern already established

### Claude's Discretion
- Exact cache eviction strategy (simple TTL sufficient for MVP)
- Error middleware placement and logging approach
- Whether to add request logging (morgan or custom)
- Zod schema reuse vs per-route schema definitions

</decisions>

<canonical_refs>
## Canonical References

No external specs — requirements are fully captured in decisions above.

### Planning documents
- `.planning/REQUIREMENTS.md` — API-01, API-02, API-03 requirement definitions
- `.planning/phases/02-forecasting-model/02-CONTEXT.md` — decisions on Node↔Python communication, Express 5.1 routing pattern
- `.planning/phases/02-forecasting-model/02-03-PLAN.md` — how API-01/02 were implemented (corridors.ts, forecasts.ts, server.ts)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/src/api/corridors.ts` — corridorsRouter with GET /:corridorId/current (API-01, complete)
- `backend/src/api/forecasts.ts` — forecastsRouter with GET /:corridorId/forecast (API-02, complete); API-03 mounts here
- `backend/src/api/index.ts` — Express app, JSON middleware, router mounting (add CORS and error middleware here)
- `backend/src/server.ts` — server entry point with graceful shutdown (PORT env var)
- `backend/src/db/connection.ts` — `query()` helper used across all routers
- `backend/src/api/__tests__/` — supertest integration test pattern established in corridors.test.ts and forecasts.test.ts

### Established Patterns
- Router-per-resource (corridorsRouter, forecastsRouter) mounted on `/api/corridors`
- `query()` helper for all DB access — no raw pool access in route handlers
- Zod for external input validation (inrix-speeds.ts collector)
- vitest + supertest for HTTP-level testing with mocked `query()`
- `dotenv/config` loaded at server entry point

### Integration Points
- New `departure-windows` route mounts on existing forecastsRouter (same file as forecasts.ts)
- Cache service imports into both forecastsRouter and corridorsRouter (optional for Phase 3)
- CORS middleware added to `api/index.ts` before all routes
- Error middleware added to `api/index.ts` after all routes (Express 5 async error propagation)

</code_context>

<specifics>
## Specific Ideas

- Departure window `reason` field is the key differentiator vs Google Maps — it surfaces WHY a time slot is better or worse (weather, event, school) using modifier columns already stored in forecasts table
- `window_count` default of 10 returns the top 10 best departure times for the week — caller can request up to 50
- The `±3 hours of arrival time` filter means: "I want to arrive at 9am, show me departure slots across the week where you'd typically arrive around 9am given travel time" — each window's `departure_at` is `arrival - estimated_travel_min`

</specifics>

<deferred>
## Deferred Ideas

- Address-based O/D pairs (geocoding to corridor) — Phase 5 Departure Planner
- WebSocket/SSE for real-time speed updates — v2
- API authentication/rate limiting — v2 (solo project, public API for now)
- Redis caching — v2 when multi-instance deployment needed

</deferred>

---

*Phase: 03-api-layer*
*Context gathered: 2026-03-19*
