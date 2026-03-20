# Phase 3: API Layer - Research

**Researched:** 2026-03-19
**Domain:** REST API (Express 5), request validation, caching, CORS
**Confidence:** HIGH

## Summary

Phase 3 completes the API surface for the SF Traffic Forecaster. API-01 (current speeds) and API-02 (week-ahead forecast) were already delivered in Phase 2. The remaining work is: (1) implement the API-03 departure-windows endpoint, (2) add Zod request validation middleware, (3) add an in-memory cache with TTL, (4) wire up CORS, and (5) add centralized error-handling middleware.

The codebase already has Express 5.2.1, Zod 4.3.6, vitest 4.1, and supertest 7.2 in place. The established patterns (router-per-resource, mocked `query()` in tests, `api/index.ts` as the app factory) are well-suited for extension. Express 5 natively catches rejected promises and forwards them to error middleware, so no try/catch or asyncHandler wrappers are needed in route handlers.

**Primary recommendation:** Add the departure-windows route to `forecastsRouter`, create a standalone `cache.ts` service using a `Map` with TTL, add `cors` and a centralized error handler to `api/index.ts`, and validate all inputs with Zod schemas.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- API-03 route: `GET /api/corridors/:corridorId/departure-windows?arrival=<ISO>&window_count=10`
- Algorithm: query forecasts for slots within +/-3 hours of arrival, sort by p50_minutes ASC, return top window_count
- Response shape: `{corridor_id, arrival_target, windows: [{departure_at, estimated_travel_min, p10_minutes, p90_minutes, congestion_risk, reason}]}`
- congestion_risk: free_flow / moderate / heavy derived from p50 vs historical average
- reason: human-readable from modifier columns (weather, event, school) -- null when no modifiers
- Mount on existing forecastsRouter
- In-memory Map-based cache, 6-hour TTL, no Redis
- Cache key: `${corridorId}:${endpointType}`
- Zod schemas for all query params
- Standard error response: `{error: string}` with 400/404/500
- Express error middleware in api/index.ts
- `cors` npm package with ALLOWED_ORIGINS env var
- Default origin: `http://localhost:5173`

### Claude's Discretion
- Exact cache eviction strategy (simple TTL sufficient for MVP)
- Error middleware placement and logging approach
- Whether to add request logging (morgan or custom)
- Zod schema reuse vs per-route schema definitions

### Deferred Ideas (OUT OF SCOPE)
- Address-based O/D pairs (geocoding to corridor) -- Phase 5
- WebSocket/SSE for real-time updates -- v2
- API authentication/rate limiting -- v2
- Redis caching -- v2
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| API-01 | REST API endpoint serving current corridor speeds | Already implemented in `corridors.ts` (Phase 2). Phase 3 adds caching and validation on top. |
| API-02 | REST API endpoint serving week-ahead forecast for a given corridor | Already implemented in `forecasts.ts` (Phase 2). Phase 3 adds caching and validation on top. |
| API-03 | REST API endpoint serving best departure windows for origin/destination pair | New endpoint in `forecasts.ts`. Query design, response shape, and Zod validation all specified in CONTEXT.md decisions. |
</phase_requirements>

## Standard Stack

### Core (already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| express | 5.2.1 | HTTP framework | Already in project; native async error handling |
| zod | 4.3.6 | Request validation | Already in project; used in collectors |
| pg | 8.20.0 | PostgreSQL client | Already in project via `query()` helper |

### New Dependencies
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| cors | 2.8.6 | CORS middleware | Applied at app level in api/index.ts |
| @types/cors | 2.8.19 | TypeScript types for cors | Dev dependency |

### No Additional Dependencies Needed
The in-memory cache is a simple `Map` with TTL -- no library required. Zod is already installed. Express 5 error handling is built-in. `date-fns` 4.1 is already installed for any date manipulation needed in the departure-windows algorithm.

**Installation:**
```bash
cd backend && npm install cors && npm install -D @types/cors
```

**Version verification:** cors 2.8.6 confirmed via `npm view cors version` on 2026-03-19. @types/cors 2.8.19 confirmed same day.

## Architecture Patterns

### Current Project Structure (relevant files)
```
backend/src/
├── api/
│   ├── index.ts           # Express app, middleware, router mounting
│   ├── corridors.ts       # corridorsRouter (API-01)
│   ├── forecasts.ts       # forecastsRouter (API-02, API-03 goes here)
│   └── __tests__/
│       ├── corridors.test.ts
│       ├── forecasts.test.ts
│       └── departure-windows.test.ts  # NEW
├── services/
│   └── cache.ts           # NEW: in-memory TTL cache
├── db/
│   └── connection.ts      # query() helper
└── server.ts              # Entry point
```

### Pattern 1: Router-per-Resource (established)
**What:** Each resource (corridors, forecasts) gets its own Express Router, mounted at `/api/corridors` in `index.ts`.
**When to use:** All API routes in this project.
**Example (existing):**
```typescript
// forecasts.ts
import { Router } from 'express';
export const forecastsRouter = Router();
forecastsRouter.get('/:corridorId/forecast', async (req, res) => { ... });
// NEW: departure-windows mounts on same router
forecastsRouter.get('/:corridorId/departure-windows', async (req, res) => { ... });
```

### Pattern 2: Express 5 Async Error Propagation
**What:** Express 5 automatically catches rejected promises from async route handlers and forwards to error middleware. No try/catch or asyncHandler needed.
**When to use:** All async route handlers.
**Example:**
```typescript
// In api/index.ts -- error middleware MUST be registered AFTER routes
// Express 5 recognizes 4-param signature as error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[api] Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});
```

### Pattern 3: Zod Validation at Route Entry
**What:** Parse and validate query params / path params with Zod at the top of the handler. Return 400 on failure.
**When to use:** All endpoints with user-supplied parameters.
**Example:**
```typescript
import { z } from 'zod';

const departureWindowsSchema = z.object({
  arrival: z.string().datetime({ message: 'arrival must be ISO 8601' }),
  window_count: z.coerce.number().int().min(1).max(50).default(10),
});

forecastsRouter.get('/:corridorId/departure-windows', async (req, res) => {
  const result = departureWindowsSchema.safeParse(req.query);
  if (!result.success) {
    res.status(400).json({ error: result.error.issues[0].message });
    return;
  }
  const { arrival, window_count } = result.data;
  // ... query and respond
});
```

### Pattern 4: In-Memory TTL Cache
**What:** Module-level `Map<string, { data: unknown; expires: number }>` with get/set/clear operations.
**When to use:** Wrap DB query results in route handlers.
**Example:**
```typescript
// services/cache.ts
interface CacheEntry<T> {
  data: T;
  expires: number;
}

const store = new Map<string, CacheEntry<unknown>>();
const DEFAULT_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

export function cacheGet<T>(key: string): T | undefined {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expires) {
    store.delete(key);
    return undefined;
  }
  return entry.data as T;
}

export function cacheSet<T>(key: string, data: T, ttlMs = DEFAULT_TTL_MS): void {
  store.set(key, { data, expires: Date.now() + ttlMs });
}

export function cacheClear(): void {
  store.clear();
}
```

### Anti-Patterns to Avoid
- **Importing `pool` directly in route handlers:** Always use the `query()` helper from `db/connection.ts`. This is the established pattern and enables test mocking.
- **Try/catch in async route handlers for Express 5:** Express 5 handles this automatically. Only use try/catch if you need to transform the error into a specific 4xx response (e.g., catching a Zod parse error to return 400).
- **Cache in route handler scope:** The cache must be module-level (shared across requests). Do not create cache instances per request.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CORS handling | Custom headers middleware | `cors` npm package | Handles preflight, credential headers, multiple origins correctly |
| Date/time parsing | Manual ISO parsing | `new Date()` + Zod `.datetime()` | ISO 8601 edge cases (timezone offsets, milliseconds) are subtle |
| Date arithmetic | Manual ms math | `date-fns` (already installed) | Already in project; handles DST, leap seconds correctly |
| Query param coercion | `parseInt(req.query.x)` | `z.coerce.number()` | Handles NaN, empty string, type coercion edge cases |

**Key insight:** The CONTEXT.md decisions have already scoped all components tightly. The only "build" work is the departure-windows SQL query logic, the cache module, and wiring middleware. Everything else uses existing libraries.

## Common Pitfalls

### Pitfall 1: Express 5 Error Middleware Signature
**What goes wrong:** Error middleware with 3 params `(req, res, next)` is treated as a regular middleware, not an error handler.
**Why it happens:** Express uses the function's `.length` property to distinguish error handlers (4 params) from regular middleware (3 params).
**How to avoid:** Always include all 4 parameters: `(err, req, res, next)`. Use `_next` if unused but keep the parameter.
**Warning signs:** Unhandled 500 errors returning HTML instead of JSON.

### Pitfall 2: Express 5 Error Middleware Must Be After Routes
**What goes wrong:** Error middleware registered before routes never catches route errors.
**Why it happens:** Express processes middleware in registration order. Error middleware must be the last `app.use()`.
**How to avoid:** In `api/index.ts`, add error middleware AFTER all `app.use('/api/...', router)` calls.
**Warning signs:** Errors returning default Express error page instead of `{error: string}` JSON.

### Pitfall 3: Cache Key Collision for Departure Windows
**What goes wrong:** Different arrival times for the same corridor return cached results for a previous arrival query.
**Why it happens:** Cache key `${corridorId}:departures` doesn't include the arrival parameter.
**How to avoid:** Include arrival hour in cache key: `${corridorId}:departures:${arrivalHour}` (as specified in CONTEXT.md).
**Warning signs:** Departure windows returning stale or wrong data for different arrival times.

### Pitfall 4: Zod v4 API Differences
**What goes wrong:** Using Zod v3 patterns with Zod v4 installed.
**Why it happens:** Project uses Zod 4.3.6. The `.datetime()` method moved -- in Zod v4, use `z.string().datetime()` for ISO 8601 validation. `z.coerce.number()` works the same.
**How to avoid:** Use `z.string().datetime()` for ISO date validation. Use `safeParse` for query validation (not `parse` which throws).
**Warning signs:** TypeScript compilation errors or runtime crashes on Zod calls.

### Pitfall 5: Departure Window Calculation Logic
**What goes wrong:** `departure_at` computed incorrectly. The intent is: given a desired arrival time, find the best departure times. `departure_at = forecast_for - estimated_travel_min`.
**Why it happens:** Confusing "forecast_for" (when travel occurs) with "when to depart."
**How to avoid:** The `forecast_for` column represents the hour-slot. The `p50_minutes` is the predicted travel time. `departure_at = forecast_for - p50_minutes * 60000` (in ms). The filter is slots where the arrival (forecast_for) is within +/-3 hours of the user's requested arrival time.
**Warning signs:** departure_at values that are AFTER the arrival_target.

### Pitfall 6: CORS Middleware Before JSON Body Parser
**What goes wrong:** Preflight (OPTIONS) requests rejected because CORS headers not set.
**Why it happens:** If CORS middleware is after body parsing, preflight may fail.
**How to avoid:** Add `cors()` as the FIRST middleware in `api/index.ts`, before `express.json()`.
**Warning signs:** Browser console showing CORS errors on preflight requests.

## Code Examples

### Departure Windows SQL Query
```typescript
// Query forecasts within +/-3 hours of requested arrival time
// forecast_for represents the time slot (arrival approximation)
const forecastResult = await query(
  `SELECT forecast_for, predicted_minutes, p10_minutes, p50_minutes, p90_minutes,
          weather_modifier, event_modifier, school_modifier
   FROM forecasts
   WHERE corridor_id = $1
     AND forecast_for >= $2::timestamptz - INTERVAL '3 hours'
     AND forecast_for <= $2::timestamptz + INTERVAL '3 hours'
     AND forecast_for >= NOW()
     AND forecast_for <= NOW() + INTERVAL '7 days'
   ORDER BY p50_minutes ASC
   LIMIT $3`,
  [corridorId, arrival, window_count]
);
```

### Congestion Risk Derivation
```typescript
// congestion_risk based on ratio of p50 to a baseline (e.g., free-flow ~ 1.0 modifier)
function deriveCongestionRisk(p50: number, p10: number): 'free_flow' | 'moderate' | 'heavy' {
  const ratio = p50 / p10; // p10 approximates best-case / free-flow
  if (ratio <= 1.2) return 'free_flow';
  if (ratio <= 1.5) return 'moderate';
  return 'heavy';
}
```

### Reason Field Derivation
```typescript
function deriveReason(row: {
  weather_modifier: number | null;
  event_modifier: number | null;
  school_modifier: number | null;
}): string | null {
  const reasons: string[] = [];
  if (row.weather_modifier && row.weather_modifier > 1.05) reasons.push('Weather: rain/fog forecast');
  if (row.event_modifier && row.event_modifier > 1.05) reasons.push('Event: local event nearby');
  if (row.school_modifier && row.school_modifier > 1.05) reasons.push('School: school day rush');
  return reasons.length > 0 ? reasons.join('; ') : null;
}
```

### CORS Configuration
```typescript
// api/index.ts
import cors from 'cors';

const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map(s => s.trim());

app.use(cors({ origin: allowedOrigins }));
```

### Cache Integration in Route Handler
```typescript
forecastsRouter.get('/:corridorId/departure-windows', async (req, res) => {
  // ... validate with Zod ...
  const cacheKey = `${corridorId}:departures:${arrivalHour}`;
  const cached = cacheGet(cacheKey);
  if (cached) {
    res.json(cached);
    return;
  }
  // ... query DB ...
  const response = { corridor_id: corridorId, arrival_target: arrival, windows };
  cacheSet(cacheKey, response);
  res.json(response);
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| try/catch + asyncHandler | Express 5 native async | Express 5.0 (2024) | Remove all asyncHandler wrappers |
| Zod v3 API | Zod v4 API | Zod 4.0 (2025) | New import paths possible; `safeParse` still works |
| Express 4 error handler registration | Same API, better async support | Express 5.0 | Error handler still needs 4 params |

**Deprecated/outdated:**
- `express-async-errors` package: Not needed with Express 5
- `asyncHandler` wrapper: Not needed with Express 5

## Open Questions

1. **Congestion risk threshold calibration**
   - What we know: CONTEXT.md says derive from p50 vs historical average
   - What's unclear: Exact thresholds (what ratio = moderate vs heavy)
   - Recommendation: Use p50/p10 ratio as proxy. Thresholds (1.2, 1.5) are reasonable starting points; tune later with real data.

2. **Cache eviction for large Map**
   - What we know: 6-hour TTL, key per corridor+endpoint+hour
   - What's unclear: Whether lazy eviction (on access) is sufficient or if periodic sweep is needed
   - Recommendation: Lazy eviction is fine for MVP. With ~6 corridors x 3 endpoints x 24 hours = ~432 max entries, memory is negligible. Claude's discretion per CONTEXT.md.

3. **Request logging**
   - What we know: CONTEXT.md lists as Claude's discretion
   - Recommendation: Skip morgan for MVP. The error middleware logs errors. Add morgan later if needed for debugging. Keep the dependency count minimal.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.0 |
| Config file | `backend/vitest.config.ts` |
| Quick run command | `cd backend && npx vitest run --reporter=verbose` |
| Full suite command | `cd backend && npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| API-01 | GET /:corridorId/current returns speeds + congestion | unit (supertest) | `cd backend && npx vitest run src/api/__tests__/corridors.test.ts` | Yes |
| API-02 | GET /:corridorId/forecast returns week-ahead forecast | unit (supertest) | `cd backend && npx vitest run src/api/__tests__/forecasts.test.ts` | Yes |
| API-03 | GET /:corridorId/departure-windows returns ranked windows | unit (supertest) | `cd backend && npx vitest run src/api/__tests__/departure-windows.test.ts` | No -- Wave 0 |
| API-03 | Zod validation rejects bad params (400) | unit (supertest) | same file as above | No -- Wave 0 |
| API-03 | CORS headers present in response | unit (supertest) | `cd backend && npx vitest run src/api/__tests__/cors.test.ts` | No -- Wave 0 |
| API-03 | Error middleware returns JSON 500 on unhandled error | unit (supertest) | `cd backend && npx vitest run src/api/__tests__/error-middleware.test.ts` | No -- Wave 0 |
| ALL | Cache hit returns cached data, cache miss queries DB | unit | `cd backend && npx vitest run src/services/__tests__/cache.test.ts` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `cd backend && npx vitest run --reporter=verbose`
- **Per wave merge:** `cd backend && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/api/__tests__/departure-windows.test.ts` -- covers API-03 endpoint behavior, Zod validation, 400/404/500 responses
- [ ] `src/services/__tests__/cache.test.ts` -- covers cache get/set/TTL expiry/clear
- [ ] `src/api/__tests__/cors.test.ts` -- covers CORS headers on responses (can be minimal, 2-3 tests)
- [ ] `src/api/__tests__/error-middleware.test.ts` -- covers centralized error handler returning JSON 500
- [ ] No framework install needed -- vitest + supertest already configured

## Sources

### Primary (HIGH confidence)
- Project codebase: `backend/src/api/index.ts`, `forecasts.ts`, `corridors.ts`, `server.ts` -- direct code inspection
- Project codebase: `backend/package.json` -- dependency versions confirmed
- Project codebase: `backend/src/db/migrations/003_create-forecasts-table.sql` -- schema confirmed
- npm registry: `cors@2.8.6`, `@types/cors@2.8.19` -- verified via `npm view`

### Secondary (MEDIUM confidence)
- [Express 5 async error handling](https://expressjs.com/en/guide/error-handling.html) -- official Express docs
- [Express 5 native promise support](https://dev.to/siddharth_g/express-5-brings-built-in-promise-support-for-error-handling-5bjf) -- confirmed by multiple sources

### Tertiary (LOW confidence)
- None -- all findings verified against codebase or official sources

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in project or verified on npm
- Architecture: HIGH -- extending established patterns in existing codebase
- Pitfalls: HIGH -- Express 5 error handling well-documented; cache/SQL patterns straightforward
- Departure windows algorithm: MEDIUM -- thresholds for congestion_risk need tuning with real data

**Research date:** 2026-03-19
**Valid until:** 2026-04-19 (stable domain, no fast-moving dependencies)
