# Phase 6: Validation and Accuracy Tracking - Research

**Researched:** 2026-03-20
**Domain:** Forecast validation, accuracy metrics (MAE/MAPE), DB aggregation SQL, backend/frontend testing patterns
**Confidence:** HIGH

## Summary

Phase 6 adds forecast outcome logging and an accuracy dashboard. The core technical challenges are: (1) writing correct SQL to join `forecasts` with `speed_readings` to compute actual corridor-level travel times, (2) aggregating error metrics (MAE/MAPE) with day-of-week breakdown and trend detection, and (3) handling the empty-data edge case gracefully in both API and UI.

All patterns are well-established in this codebase. The outcome logger follows the same one-shot script pattern as existing collectors (weather, inrix-speeds). The API endpoint follows the Express Router + mocked `query()` + supertest pattern from Phase 3. The frontend follows the TanStack Query + Vitest/RTL + `data-testid` pattern from Phases 4-5.

**Primary recommendation:** Focus implementation effort on getting the SQL joins right (segments to corridor aggregation with time-window matching), and ensure comprehensive empty-state handling throughout the stack.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- New DB migration: `backend/src/db/migrations/006_create-forecast-outcomes-table.sql` with `forecast_outcomes` table including GENERATED ALWAYS columns for `abs_error_minutes` and `abs_pct_error`
- Actuals sourced from `speed_readings` with +/-30 min window around `forecast_for`
- Outcome logger: `backend/src/collectors/outcome-logger.ts` as one-shot CLI script
- Finds forecasts where `forecast_for < NOW() - INTERVAL '1 hour'`
- Upserts via `ON CONFLICT (corridor_id, forecast_for) DO NOTHING`
- API: `GET /api/accuracy` in `backend/src/api/accuracy.ts`, mounted in index.ts
- Cached with 1-hour TTL
- Frontend: "Accuracy" tab in CorridorPanel (Live | Plan | Accuracy)
- `AccuracyDashboard.tsx` component, `useAccuracyMetrics.ts` hook
- Trend: "improving"/"degrading"/"stable" based on last 7 days vs prior 7 days MAPE with 5% relative threshold
- Day-of-week breakdown (expandable row) per corridor
- No new npm dependencies

### Claude's Discretion
- Exact SQL query for joining `forecasts` with `speed_readings` (segment-level aggregation to corridor-level travel time)
- Whether to show a "Run outcome logger" button in the UI (probably not -- keep it backend-only for MVP)
- Exact day-of-week expand/collapse interaction (toggle state local to component)
- Whether to add trend arrow to corridor list in Live tab (no -- keep Live tab focused on current speeds)

### Deferred Ideas (OUT OF SCOPE)
- User-facing accuracy alerts ("Model degraded beyond threshold this week") -- v2
- Corridor-level retraining trigger based on accuracy threshold breach -- v2
- Historical accuracy chart (time series of MAPE over weeks) -- v2
- Per-hour breakdown (in addition to per-day-of-week) -- v2
- Export accuracy report as CSV -- v2
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| VAL-01 | Actual travel times logged against predicted values for each forecast | Outcome logger SQL patterns, segment-to-corridor aggregation, time-window matching, idempotent upsert pattern |
| VAL-02 | Prediction accuracy metrics viewable (MAE, MAPE per corridor) | Accuracy API aggregation SQL, trend detection, day-of-week breakdown, AccuracyDashboard component patterns, empty-state handling |
</phase_requirements>

## Standard Stack

No new dependencies. All tools are already in the project.

### Core (Backend)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pg (via `query()`) | existing | Database queries for outcome logger and accuracy API | Already used by all collectors and API routes |
| express Router | existing | `/api/accuracy` endpoint | Same pattern as corridors, forecasts, incidents routers |
| zod | existing | Query param validation (`corridor_id`) | Used in departure-windows endpoint |
| cache service | existing | 1-hour TTL for accuracy endpoint | `cacheGet`/`cacheSet` from `services/cache.ts` |

### Core (Frontend)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @tanstack/react-query v5 | existing | `useAccuracyMetrics` hook | Same pattern as `useCorridorForecast` |
| Tailwind v4 | existing | AccuracyDashboard styling | Dark theme with `bg-gray-900`, `text-gray-100` etc. |
| vitest + @testing-library/react | existing | Component and hook tests | Same pattern as CorridorPanel.test.tsx, WeekHeatmap.test.tsx |

### Testing
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| supertest | existing | Backend API endpoint testing | Same pattern as departure-windows.test.ts |
| vitest | existing | All test files | `vi.mock`, `vi.mocked`, `vi.fn()` patterns |

## Architecture Patterns

### Recommended Project Structure
```
backend/src/
  db/migrations/
    006_create-forecast-outcomes-table.sql
  collectors/
    outcome-logger.ts             # One-shot CLI script
    __tests__/
      outcome-logger.test.ts      # Unit test with mocked query()
  api/
    accuracy.ts                   # GET /api/accuracy router
    index.ts                      # Mount accuracyRouter
    __tests__/
      accuracy.test.ts            # Supertest with mocked query + cache

frontend/src/
  types/
    api.ts                        # Extended with AccuracyResponse types
  hooks/
    useAccuracyMetrics.ts         # TanStack Query hook
  components/
    AccuracyDashboard.tsx         # Accuracy tab content
    __tests__/
      AccuracyDashboard.test.tsx  # RTL test with mocked hook
  lib/
    api.ts                        # Extended with fetchAccuracyMetrics()
```

### Pattern 1: Segment-to-Corridor Actual Travel Time Aggregation

**What:** The `speed_readings` table stores per-segment data. The `forecasts` table stores per-corridor predictions. The outcome logger must aggregate segment-level `travel_time_min` into corridor-level actual travel times for comparison.

**Key insight:** The `corridors` table has `segment_ids TEXT[]`. Corridor travel time = SUM of segment travel times (segments are sequential parts of a route). Use `segment_id = ANY(c.segment_ids)` to match.

**SQL for actual travel time within a forecast window:**
```sql
-- For a given corridor and forecast_for timestamp,
-- get the average total corridor travel time from speed_readings
-- within +/- 30 minutes of forecast_for
SELECT
  SUM(sr.avg_travel_time) AS actual_minutes
FROM (
  SELECT
    segment_id,
    AVG(travel_time_min) AS avg_travel_time
  FROM speed_readings
  WHERE segment_id = ANY($1)        -- corridor's segment_ids
    AND recorded_at >= $2 - INTERVAL '30 minutes'
    AND recorded_at <= $2 + INTERVAL '30 minutes'
  GROUP BY segment_id
) sr
```

**Why this approach:**
- `speed_readings` has multiple readings per segment per time window (collected periodically)
- First AVG within each segment to get average travel time per segment in the window
- Then SUM across segments to get total corridor travel time
- This matches how `corridors.ts` computes `avg_travel_time_min` (line 31-33): it sums `travel_time_min` across segments

**Edge case:** If no readings exist for some segments in the window, the SUM will undercount. The outcome logger should require readings from ALL segments (or a minimum threshold) to consider the actual valid.

### Pattern 2: Outcome Logger as One-Shot Script

**What:** The outcome logger is a CLI script that reads from `forecasts` + `speed_readings` and writes to `forecast_outcomes`. It does NOT use the collector pattern (no budget tracking, no retry, no API calls).

**Simpler than collectors:** The existing collectors (weather.ts, inrix-speeds.ts) call external APIs with budget tracking. The outcome logger only reads/writes to the local database, so it needs a simpler pattern:
```typescript
// outcome-logger.ts
import { query } from '../db/connection.js';

async function logOutcomes(): Promise<{ processed: number; inserted: number }> {
  // 1. Find forecasts that are past (forecast_for < NOW() - 1hr)
  //    and not yet in forecast_outcomes
  // 2. For each, compute actual travel time from speed_readings
  // 3. Upsert into forecast_outcomes
  // 4. Return counts
}

// CLI entry point
logOutcomes()
  .then(result => {
    console.log(`Processed ${result.processed}, inserted ${result.inserted}`);
    process.exit(0);
  })
  .catch(err => {
    console.error('Outcome logger failed:', err);
    process.exit(1);
  });
```

**Batch approach (recommended):** Rather than N+1 queries per forecast row, use a single query that joins `forecasts` with `speed_readings` and bulk-inserts:
```sql
-- Find all unprocessed forecasts and compute actuals in one query
INSERT INTO forecast_outcomes (corridor_id, forecast_for, predicted_minutes, actual_minutes, p10_minutes, p50_minutes, p90_minutes)
SELECT
  f.corridor_id,
  f.forecast_for,
  f.predicted_minutes,
  actuals.actual_minutes,
  f.p10_minutes,
  f.p50_minutes,
  f.p90_minutes
FROM forecasts f
JOIN corridors c ON c.corridor_id = f.corridor_id
CROSS JOIN LATERAL (
  SELECT SUM(seg_avg) AS actual_minutes
  FROM (
    SELECT AVG(sr.travel_time_min) AS seg_avg
    FROM speed_readings sr
    WHERE sr.segment_id = ANY(c.segment_ids)
      AND sr.recorded_at >= f.forecast_for - INTERVAL '30 minutes'
      AND sr.recorded_at <= f.forecast_for + INTERVAL '30 minutes'
    GROUP BY sr.segment_id
  ) sub
) actuals
WHERE f.forecast_for < NOW() - INTERVAL '1 hour'
  AND actuals.actual_minutes IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM forecast_outcomes fo
    WHERE fo.corridor_id = f.corridor_id AND fo.forecast_for = f.forecast_for
  )
ON CONFLICT (corridor_id, forecast_for) DO NOTHING
```

**Why CROSS JOIN LATERAL:** This allows the subquery to reference `f.forecast_for` and `c.segment_ids` from the outer query, computing actuals per forecast row. This is a standard PostgreSQL pattern for correlated subqueries.

**Why NOT EXISTS instead of LEFT JOIN:** The `NOT EXISTS` check before the INSERT avoids computing actuals for forecasts that already have outcomes. Combined with `ON CONFLICT DO NOTHING`, this is doubly idempotent.

### Pattern 3: Accuracy Aggregation API

**MAE/MAPE aggregation SQL:**
```sql
SELECT
  corridor_id,
  COUNT(*) AS sample_count,
  AVG(abs_error_minutes) AS mae_minutes,
  AVG(abs_pct_error) AS mape_pct
FROM forecast_outcomes
WHERE corridor_id = COALESCE($1, corridor_id)
GROUP BY corridor_id
ORDER BY corridor_id
```

**Trend detection SQL (last 7 days vs prior 7 days):**
```sql
SELECT
  corridor_id,
  AVG(abs_pct_error) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') AS recent_mape,
  AVG(abs_pct_error) FILTER (WHERE created_at >= NOW() - INTERVAL '14 days' AND created_at < NOW() - INTERVAL '7 days') AS prior_mape
FROM forecast_outcomes
GROUP BY corridor_id
```

Then in TypeScript:
```typescript
function deriveTrend(recent: number | null, prior: number | null): 'improving' | 'degrading' | 'stable' {
  if (recent == null || prior == null || prior === 0) return 'stable';
  const relativeChange = (recent - prior) / prior;
  if (relativeChange < -0.05) return 'improving';   // MAPE decreased by >5%
  if (relativeChange > 0.05) return 'degrading';     // MAPE increased by >5%
  return 'stable';
}
```

**Day-of-week breakdown SQL:**
```sql
SELECT
  corridor_id,
  EXTRACT(DOW FROM forecast_for) AS day,
  COUNT(*) AS count,
  AVG(abs_error_minutes) AS mae_minutes,
  AVG(abs_pct_error) AS mape_pct
FROM forecast_outcomes
GROUP BY corridor_id, EXTRACT(DOW FROM forecast_for)
ORDER BY corridor_id, day
```

**Note:** `EXTRACT(DOW FROM ...)` returns 0=Sunday through 6=Saturday in PostgreSQL, matching the CONTEXT.md day-of-week response shape.

### Pattern 4: Cache with 1-hour TTL

```typescript
const ACCURACY_CACHE_TTL = 60 * 60 * 1000; // 1 hour in ms
const cacheKey = corridorId ? `accuracy:${corridorId}` : 'accuracy:all';
const cached = cacheGet(cacheKey);
if (cached) { res.json(cached); return; }
// ... query DB ...
cacheSet(cacheKey, response, ACCURACY_CACHE_TTL);
```

### Anti-Patterns to Avoid
- **N+1 queries in outcome logger:** Do NOT loop through forecasts one-by-one querying speed_readings for each. Use a single bulk INSERT...SELECT with LATERAL join.
- **Computing MAE/MAPE in TypeScript:** Do NOT fetch all rows and compute averages in JS. Let PostgreSQL do the aggregation.
- **Forgetting GENERATED columns:** The `abs_error_minutes` and `abs_pct_error` columns are GENERATED ALWAYS STORED. Do NOT include them in INSERT statements -- they auto-compute from `actual_minutes` and `predicted_minutes`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| MAE/MAPE calculation | JS-side averaging | PostgreSQL AVG() on generated columns | DB handles NULLs, precision, and grouping correctly |
| Day name mapping | Switch/case for day names | Static array `['Sunday','Monday',...]` indexed by DOW | Simpler, less error-prone |
| Cache invalidation | Custom expiry logic | Existing `cacheSet(key, value, ttlMs)` with lazy eviction | Already built and tested in Phase 3 |
| Corridor display names | Hardcoded in accuracy API | Import from corridors table or `CORRIDOR_DISPLAY_NAMES` | Single source of truth |

## Common Pitfalls

### Pitfall 1: GENERATED ALWAYS Columns in INSERT
**What goes wrong:** Including `abs_error_minutes` or `abs_pct_error` in INSERT column list causes a PostgreSQL error: "cannot insert a non-DEFAULT value into column ... defined as GENERATED ALWAYS"
**Why it happens:** These columns auto-compute from `actual_minutes` and `predicted_minutes`
**How to avoid:** Only INSERT the source columns: `corridor_id, forecast_for, predicted_minutes, actual_minutes, p10_minutes, p50_minutes, p90_minutes`
**Warning signs:** PostgreSQL error mentioning "GENERATED ALWAYS"

### Pitfall 2: Division by Zero in MAPE
**What goes wrong:** `abs_pct_error` = `ABS(actual - predicted) / predicted * 100` produces NULL or error when `predicted_minutes = 0`
**Why it happens:** Placeholder forecasts (Phase 2 decision: 20min default) should prevent this, but edge case exists
**How to avoid:** The CONTEXT.md schema already handles this with `CASE WHEN predicted_minutes > 0 THEN ... ELSE NULL END`. Ensure the AVG in accuracy API uses `AVG(abs_pct_error)` which naturally excludes NULLs.

### Pitfall 3: Empty forecast_outcomes Table
**What goes wrong:** API returns empty arrays, MAPE/MAE are null, trend is undefined. Frontend crashes on `.toFixed()` or `.map()` of undefined.
**Why it happens:** Phase 6 ships before sufficient forecast data accumulates.
**How to avoid:**
- API: Return `sample_count: 0`, `mae_minutes: null`, `mape_pct: null`, `trend: 'stable'`, `by_day_of_week: []` for corridors with no data
- Frontend: Check `sample_count === 0` and show "Not enough data yet" message
- Tests: Include explicit empty-state test cases for both API and UI

### Pitfall 4: TimescaleDB Compression on speed_readings
**What goes wrong:** Querying compressed chunks in `speed_readings` with the LATERAL join may be slow if forecast_for timestamps span many days.
**Why it happens:** `speed_readings` has 1-day chunk interval with compression.
**How to avoid:** The outcome logger already filters `forecast_for < NOW() - INTERVAL '1 hour'` and the `NOT EXISTS` check limits to unprocessed forecasts only. Performance should be fine for daily batch runs. No optimization needed for MVP.

### Pitfall 5: Timezone Awareness in DOW Extraction
**What goes wrong:** `EXTRACT(DOW FROM forecast_for)` uses UTC day-of-week, not local SF time. A forecast at 11pm PST Friday shows as Saturday in UTC.
**Why it happens:** `forecast_for` is TIMESTAMPTZ stored in UTC.
**How to avoid:** Convert to local time before extraction: `EXTRACT(DOW FROM forecast_for AT TIME ZONE 'America/Los_Angeles')`
**Warning signs:** Day-of-week breakdown shows unexpected patterns (e.g., high evening traffic attributed to next day)

### Pitfall 6: Supertest Import with Express 5
**What goes wrong:** Nothing specific -- just follow the established mock pattern from `departure-windows.test.ts`.
**How to avoid:** Always mock `../../db/connection.js` AND `../../services/cache.js` BEFORE importing `app` from `../index.js`. The `vi.mock()` hoisting in vitest handles ordering, but keep the pattern consistent with existing tests.

## Code Examples

### Migration: forecast_outcomes table
```sql
-- Source: CONTEXT.md decisions, verified against PostgreSQL 16 GENERATED ALWAYS syntax
CREATE TABLE forecast_outcomes (
  id                SERIAL PRIMARY KEY,
  corridor_id       TEXT NOT NULL,
  forecast_for      TIMESTAMPTZ NOT NULL,
  predicted_minutes FLOAT NOT NULL,
  actual_minutes    FLOAT NOT NULL,
  p10_minutes       FLOAT,
  p50_minutes       FLOAT,
  p90_minutes       FLOAT,
  abs_error_minutes FLOAT GENERATED ALWAYS AS (ABS(actual_minutes - predicted_minutes)) STORED,
  abs_pct_error     FLOAT GENERATED ALWAYS AS (
    CASE WHEN predicted_minutes > 0
      THEN ABS(actual_minutes - predicted_minutes) / predicted_minutes * 100
      ELSE NULL
    END
  ) STORED,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(corridor_id, forecast_for)
);

CREATE INDEX idx_forecast_outcomes_corridor
  ON forecast_outcomes (corridor_id, forecast_for DESC);
```

### Backend test pattern: outcome-logger.test.ts
```typescript
// Source: weather.test.ts pattern adapted for outcome-logger
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../db/connection.js', () => ({
  query: vi.fn(),
}));

import { query } from '../../db/connection.js';
const mockedQuery = vi.mocked(query);

import { logOutcomes } from '../outcome-logger.js';

describe('logOutcomes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('inserts outcomes for unprocessed forecasts', async () => {
    // Mock: the bulk INSERT...SELECT returns rowCount
    mockedQuery.mockResolvedValueOnce({
      rows: [], rowCount: 5, command: 'INSERT', oid: 0, fields: [],
    } as any);

    const result = await logOutcomes();
    expect(result.inserted).toBe(5);
    expect(mockedQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO forecast_outcomes'),
      expect.any(Array)  // or [] if no params
    );
  });

  it('returns 0 inserted when no unprocessed forecasts exist', async () => {
    mockedQuery.mockResolvedValueOnce({
      rows: [], rowCount: 0, command: 'INSERT', oid: 0, fields: [],
    } as any);

    const result = await logOutcomes();
    expect(result.inserted).toBe(0);
  });
});
```

### Backend test pattern: accuracy.test.ts
```typescript
// Source: departure-windows.test.ts pattern adapted for accuracy endpoint
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

vi.mock('../../db/connection.js', () => ({
  query: vi.fn(),
}));
vi.mock('../../services/cache.js', () => ({
  cacheGet: vi.fn(),
  cacheSet: vi.fn(),
  cacheClear: vi.fn(),
}));

import { query } from '../../db/connection.js';
import { cacheGet, cacheSet } from '../../services/cache.js';
const mockedQuery = vi.mocked(query);
const mockedCacheGet = vi.mocked(cacheGet);

import { app } from '../index.js';

function mockResult(rows: unknown[]) {
  return { rows, rowCount: rows.length, command: 'SELECT' as const, oid: 0, fields: [] } as any;
}

describe('GET /api/accuracy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedCacheGet.mockReturnValue(undefined);
  });

  it('returns 200 with accuracy data for all corridors', async () => {
    // Main aggregation query
    mockedQuery.mockResolvedValueOnce(mockResult([
      { corridor_id: 'us-101', sample_count: '42', mae_minutes: 3.2, mape_pct: 8.5 },
    ]));
    // Trend query
    mockedQuery.mockResolvedValueOnce(mockResult([
      { corridor_id: 'us-101', recent_mape: 7.5, prior_mape: 9.0 },
    ]));
    // Day-of-week query
    mockedQuery.mockResolvedValueOnce(mockResult([
      { corridor_id: 'us-101', day: 1, count: '6', mae_minutes: 2.8, mape_pct: 7.2 },
    ]));

    const res = await request(app).get('/api/accuracy');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('generated_at');
    expect(res.body.corridors).toHaveLength(1);
    expect(res.body.corridors[0].trend).toBe('improving');
  });

  it('returns empty corridors array when no outcomes exist', async () => {
    mockedQuery.mockResolvedValueOnce(mockResult([]));
    mockedQuery.mockResolvedValueOnce(mockResult([]));
    mockedQuery.mockResolvedValueOnce(mockResult([]));

    const res = await request(app).get('/api/accuracy');
    expect(res.status).toBe(200);
    expect(res.body.corridors).toHaveLength(0);
  });
});
```

### Frontend test pattern: AccuracyDashboard.test.tsx
```tsx
// Source: WeekHeatmap.test.tsx and CorridorPanel.test.tsx patterns
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AccuracyDashboard } from '@/components/AccuracyDashboard';

const mockUseAccuracyMetrics = vi.fn();
vi.mock('@/hooks/useAccuracyMetrics', () => ({
  useAccuracyMetrics: (...args: unknown[]) => mockUseAccuracyMetrics(...args),
}));

function renderDashboard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AccuracyDashboard />
    </QueryClientProvider>,
  );
}

describe('AccuracyDashboard', () => {
  it('shows empty state when no data', () => {
    mockUseAccuracyMetrics.mockReturnValue({
      data: { corridors: [] }, isPending: false, isError: false,
    });
    renderDashboard();
    expect(screen.getByTestId('accuracy-empty')).toBeInTheDocument();
    expect(screen.getByText(/not enough data/i)).toBeInTheDocument();
  });

  it('renders corridor accuracy rows', () => {
    mockUseAccuracyMetrics.mockReturnValue({
      data: {
        generated_at: '2026-03-20T12:00:00Z',
        corridors: [{
          corridor_id: 'us-101', display_name: 'US-101',
          sample_count: 42, mae_minutes: 3.2, mape_pct: 8.5,
          trend: 'improving', by_day_of_week: [],
        }],
      },
      isPending: false, isError: false,
    });
    renderDashboard();
    expect(screen.getByText('US-101')).toBeInTheDocument();
    expect(screen.getByText('3.2 min')).toBeInTheDocument();
    expect(screen.getByText('8.5%')).toBeInTheDocument();
  });

  it('expands day-of-week breakdown on row click', () => {
    // Test expand/collapse with fireEvent.click
  });
});
```

### Frontend types extension
```typescript
// Source: CONTEXT.md response shape
export interface DayOfWeekAccuracy {
  day: number;
  day_name: string;
  mae_minutes: number;
  mape_pct: number;
  count: number;
}

export interface CorridorAccuracy {
  corridor_id: string;
  display_name: string;
  sample_count: number;
  mae_minutes: number | null;
  mape_pct: number | null;
  trend: 'improving' | 'degrading' | 'stable';
  by_day_of_week: DayOfWeekAccuracy[];
}

export interface AccuracyResponse {
  generated_at: string;
  corridors: CorridorAccuracy[];
}
```

### useAccuracyMetrics hook
```typescript
// Source: useCorridorForecast.ts pattern
import { useQuery } from '@tanstack/react-query';
import { fetchAccuracyMetrics } from '@/lib/api';

export function useAccuracyMetrics() {
  return useQuery({
    queryKey: ['accuracy'],
    queryFn: fetchAccuracyMetrics,
    refetchInterval: 60 * 60 * 1000, // 1 hour
    staleTime: 30 * 60 * 1000,       // 30 min stale
  });
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual accuracy tracking | Automated outcome logger | This phase | Fully automatic once forecasts mature past 1-hour grace period |
| No accuracy visibility | Per-corridor MAE/MAPE dashboard | This phase | Users and developer can assess model quality |

## Open Questions

1. **Segment coverage threshold for valid actuals**
   - What we know: If some segments have no readings in the +/-30 min window, SUM will undercount actual travel time
   - What's unclear: Should we require ALL segments to have readings, or accept partial coverage?
   - Recommendation: Filter out outcomes where `actual_minutes IS NULL` (the LATERAL join returns NULL when no readings exist). This naturally excludes incomplete data. For partial segment coverage, the SUM will be lower than actual, so it is better to require at least 1 reading per segment. Add a HAVING clause: `HAVING COUNT(DISTINCT segment_id) = array_length(c.segment_ids, 1)`

2. **Trend calculation on first week**
   - What we know: The prior 7-day window will be empty when the feature first launches
   - What's unclear: Should trend default to 'stable' or 'unknown'?
   - Recommendation: Default to 'stable' when prior_mape is NULL (already handled by the `deriveTrend` function above)

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (backend + frontend) |
| Config file | `backend/vitest.config.ts`, `frontend/vitest.config.ts` |
| Quick run command | `npx vitest run --reporter=verbose` (per workspace) |
| Full suite command | `cd backend && npx vitest run && cd ../frontend && npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VAL-01 | Outcome logger computes and inserts outcomes | unit | `cd backend && npx vitest run src/collectors/__tests__/outcome-logger.test.ts -x` | No -- Wave 0 |
| VAL-01 | Idempotent upsert (ON CONFLICT DO NOTHING) | unit | Same file as above | No -- Wave 0 |
| VAL-01 | Handles empty speed_readings gracefully | unit | Same file as above | No -- Wave 0 |
| VAL-02 | GET /api/accuracy returns correct MAE/MAPE | integration | `cd backend && npx vitest run src/api/__tests__/accuracy.test.ts -x` | No -- Wave 0 |
| VAL-02 | GET /api/accuracy with corridor_id filter | integration | Same file as above | No -- Wave 0 |
| VAL-02 | GET /api/accuracy empty state (no outcomes) | integration | Same file as above | No -- Wave 0 |
| VAL-02 | GET /api/accuracy uses cache | integration | Same file as above | No -- Wave 0 |
| VAL-02 | Trend derivation (improving/degrading/stable) | unit | Same file or separate deriveTrend test | No -- Wave 0 |
| VAL-02 | AccuracyDashboard renders corridor rows | unit | `cd frontend && npx vitest run src/components/__tests__/AccuracyDashboard.test.tsx -x` | No -- Wave 0 |
| VAL-02 | AccuracyDashboard shows empty state | unit | Same file as above | No -- Wave 0 |
| VAL-02 | AccuracyDashboard expand/collapse day-of-week | unit | Same file as above | No -- Wave 0 |
| VAL-02 | CorridorPanel renders Accuracy tab | unit | `cd frontend && npx vitest run src/components/__tests__/CorridorPanel.test.tsx -x` | Yes -- extend |

### Sampling Rate
- **Per task commit:** Quick run of changed test files
- **Per wave merge:** Full suite for backend and frontend
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `backend/src/collectors/__tests__/outcome-logger.test.ts` -- covers VAL-01
- [ ] `backend/src/api/__tests__/accuracy.test.ts` -- covers VAL-02 API
- [ ] `frontend/src/components/__tests__/AccuracyDashboard.test.tsx` -- covers VAL-02 UI
- [ ] Extend `frontend/src/components/__tests__/CorridorPanel.test.tsx` -- add Accuracy tab tests

## Sources

### Primary (HIGH confidence)
- Project codebase: `backend/src/api/__tests__/departure-windows.test.ts` -- supertest + cache mock pattern
- Project codebase: `backend/src/collectors/__tests__/weather.test.ts` -- collector test pattern with mocked DB
- Project codebase: `frontend/src/components/__tests__/CorridorPanel.test.tsx` -- tab navigation test pattern
- Project codebase: `frontend/src/components/__tests__/WeekHeatmap.test.tsx` -- hook mocking + RTL test pattern
- Project codebase: `backend/src/api/corridors.ts` -- segment aggregation pattern (SUM of travel_time_min)
- Project codebase: `backend/src/db/migrations/001_create-extension-and-tables.sql` -- speed_readings schema
- Project codebase: `backend/src/db/migrations/003_create-forecasts-table.sql` -- forecasts schema
- Project codebase: `backend/src/db/migrations/004_create-corridors-table.sql` -- corridors table with segment_ids

### Secondary (MEDIUM confidence)
- PostgreSQL GENERATED ALWAYS AS ... STORED syntax: standard PostgreSQL 12+ feature, widely documented
- PostgreSQL EXTRACT(DOW FROM ...) returns 0-6 (Sun-Sat): standard behavior
- CROSS JOIN LATERAL: standard PostgreSQL pattern for correlated subqueries

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, all patterns exist in codebase
- Architecture: HIGH -- SQL patterns verified against existing schema, patterns replicated from existing code
- Pitfalls: HIGH -- identified from direct codebase analysis (timezone, generated columns, empty state)

**Research date:** 2026-03-20
**Valid until:** 2026-04-20 (stable -- no external dependencies changing)
