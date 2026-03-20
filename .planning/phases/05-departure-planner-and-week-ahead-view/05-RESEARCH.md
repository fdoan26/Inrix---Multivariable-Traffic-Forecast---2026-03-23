# Phase 5: Departure Planner and Week-Ahead View - Research

**Researched:** 2026-03-20
**Domain:** React frontend -- heatmap grid, form handling, TanStack Query patterns
**Confidence:** HIGH

## Summary

Phase 5 is a frontend-only phase that adds two views to the existing CorridorPanel: a week-ahead heatmap grid (7 days x 17 hours) and a departure planner form with ranked results. Both backend APIs already exist (`/forecast?hours=168` and `/departure-windows?arrival=<ISO>&window_count=5`). The primary challenges are: (1) fitting a 7-column heatmap into a 320px panel with readable text, (2) correctly mapping ISO timestamps to grid coordinates, (3) deriving congestion levels from raw p50/p10 ratios on the frontend, and (4) combining HTML date+time inputs into a valid ISO string for the API.

All libraries needed are already installed: React 19, TanStack Query v5, date-fns v4, Zustand v5, Tailwind v4, Zod. No new dependencies are required. The existing test infrastructure (Vitest 4.1 + RTL 16 + jsdom) covers component testing patterns established in Phase 4.

**Primary recommendation:** Build the heatmap as a plain HTML `<table>` with CSS grid-like fixed cell widths (~36px), use `date-fns` for all timestamp-to-grid-index mapping, and derive congestion from the same p50/p10 ratio thresholds the backend uses.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Two tabs in CorridorPanel header: **Live** | **Plan** -- tab state is local component state (not Zustand)
- Heatmap in "Live" tab when corridor selected, replacing segment detail section
- Grid: 7 columns (today+6), 17 rows (6am-10pm), cell shows p50 minutes truncated ("36m")
- Cell background: `CONGESTION_COLORS` from corridors.ts mapped via congestion level thresholds
- Fetch: `GET /api/corridors/:id/forecast?hours=168`, query key `['forecast', corridorId]`, no refetch interval
- Confidence intervals: CSS `title` attribute tooltip ("p10: 28m | p50: 36m | p90: 44m") -- no Floating UI
- Departure planner form: corridor dropdown, date input (min=today, max=today+7), time input (step=1800)
- Submit calls `GET /api/corridors/:id/departure-windows?arrival=<ISO>&window_count=5`
- Results ordered by lowest p50, best result (index 0) gets `bg-amber-900/30 border border-amber-700`
- Each result shows: departure time, travel time with p10-p90 range, congestion badge, reason text
- New types in `src/types/api.ts`: ForecastEntry, DepartureWindow, ForecastResponse, DepartureWindowsResponse
- Zod validation client-side: arrival must be within 7 days
- Skeleton loading: gray-800 background cells
- Error state: inline message "No forecast data available for this corridor and time"

### Claude's Discretion
- Exact heatmap cell dimensions and text sizing (must fit 7 columns in 320px)
- Whether to show modifier indicators (weather/event/school icons) in heatmap cells
- Exact skeleton loading animation for heatmap grid
- Error boundary for failed forecast fetch

### Deferred Ideas (OUT OF SCOPE)
- Free-text origin/destination input with geocoding
- PWA / mobile app installability
- Email/push alerts for saved routes
- Heatmap comparison view (this week vs last week)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| MAP-04 | Week-ahead corridor heatmap -- 7-day x time-slot grid per corridor showing predicted congestion | Heatmap grid layout pattern, timestamp-to-grid mapping, congestion derivation logic, CONGESTION_COLORS reuse |
| MAP-05 | Confidence interval display alongside predicted travel times | CSS title tooltip pattern for heatmap cells, inline p10-p90 range in departure results |
| PLAN-01 | User inputs origin, destination, and desired arrival time | Corridor dropdown (proxy for origin/dest), HTML date+time inputs, ISO string construction |
| PLAN-02 | System returns recommended departure windows across the week with congestion risk score | TanStack Query hook for departure-windows endpoint, result list rendering pattern |
| PLAN-03 | Best departure time highlighted with "Slow due to [reason]" explanations | Amber highlight for index 0, reason text from API response, modifier reason display |
</phase_requirements>

## Standard Stack

### Core (Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react | ^19.2.4 | UI framework | Already scaffolded Phase 4 |
| @tanstack/react-query | ^5.91.2 | Data fetching + caching | Established pattern in useCorridorSpeeds |
| date-fns | ^4.1.0 | Date manipulation | Already installed, used in CorridorPanel |
| zustand | ^5.0.12 | Global state (selectedCorridorId) | Already in mapStore.ts |
| tailwindcss | ^4.2.2 | Styling | Dark theme established |
| zod | (via backend, also usable in frontend bundle) | Form validation | Already a project dependency |

### Supporting (Already Installed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest | ^4.1.0 | Unit tests | All new component/hook tests |
| @testing-library/react | ^16.3.2 | Component rendering in tests | CorridorPanel, HeatmapGrid, DeparturePlanner tests |
| @testing-library/jest-dom | ^6.9.1 | DOM assertions | toBeInTheDocument, toHaveClass, etc. |

### No New Dependencies Needed
No additional packages required. The heatmap is a plain HTML table styled with Tailwind. Date handling uses date-fns. Form validation uses Zod (already in the frontend bundle via zod dependency). Tooltips use native `title` attribute.

## Architecture Patterns

### Recommended Component Structure
```
src/
  components/
    CorridorPanel.tsx          # Modify: add tab navigation, conditionally render heatmap vs planner
    WeekHeatmap.tsx            # NEW: 7x17 grid table component
    DeparturePlannerForm.tsx   # NEW: form with corridor/date/time inputs
    DepartureResults.tsx       # NEW: ordered result list
  hooks/
    useCorridorForecast.ts     # NEW: TanStack Query hook for /forecast?hours=168
    useDepartureWindows.ts     # NEW: TanStack Query hook for /departure-windows
  lib/
    api.ts                     # Extend: fetchCorridorForecast, fetchDepartureWindows
    congestion.ts              # NEW: deriveCongestionLevel utility
  types/
    api.ts                     # Extend: ForecastEntry, DepartureWindow, etc.
```

### Pattern 1: Tab Navigation (Local State)
**What:** Simple useState-based tab switching in CorridorPanel
**When to use:** Tab state doesn't need cross-component coordination
**Example:**
```typescript
type PanelTab = 'live' | 'plan';

export function CorridorPanel() {
  const [activeTab, setActiveTab] = useState<PanelTab>('live');
  // ... existing hooks ...

  return (
    <div>
      {/* Tab bar */}
      <div className="flex border-b border-gray-700">
        <button
          onClick={() => setActiveTab('live')}
          className={activeTab === 'live'
            ? 'border-b-2 border-amber-400 text-white px-4 py-2 text-sm'
            : 'text-gray-400 px-4 py-2 text-sm'}
        >Live</button>
        <button
          onClick={() => setActiveTab('plan')}
          className={activeTab === 'plan'
            ? 'border-b-2 border-amber-400 text-white px-4 py-2 text-sm'
            : 'text-gray-400 px-4 py-2 text-sm'}
        >Plan</button>
      </div>

      {activeTab === 'live' ? (
        <>
          {/* corridor list */}
          {selectedCorridorId && <WeekHeatmap corridorId={selectedCorridorId} />}
        </>
      ) : (
        <DeparturePlannerForm />
      )}
    </div>
  );
}
```

### Pattern 2: Conditional Fetch with TanStack Query `enabled`
**What:** Only fetch forecast data when a corridor is selected
**When to use:** Heatmap appears only when corridor is selected
**Example:**
```typescript
export function useCorridorForecast(corridorId: string | null) {
  return useQuery({
    queryKey: ['forecast', corridorId],
    queryFn: () => fetchCorridorForecast(corridorId!),
    enabled: !!corridorId,           // don't fetch until corridor selected
    refetchInterval: false,           // week-ahead data is stable
    staleTime: 30 * 60 * 1000,       // 30 min stale time (forecasts refresh every 6h)
  });
}
```

### Pattern 3: On-Demand Fetch for Departure Windows
**What:** Fetch departure windows only when form is submitted (not on mount)
**When to use:** User-triggered query, not automatic
**Example:**
```typescript
export function useDepartureWindows(corridorId: string | null, arrival: string | null) {
  return useQuery({
    queryKey: ['departure-windows', corridorId, arrival],
    queryFn: () => fetchDepartureWindows(corridorId!, arrival!),
    enabled: !!corridorId && !!arrival,  // only fetch when both set
    refetchInterval: false,
  });
}

// In the form component, set arrival state on submit:
function DeparturePlannerForm() {
  const [submittedArrival, setSubmittedArrival] = useState<string | null>(null);
  const [selectedCorridor, setSelectedCorridor] = useState<string | null>(
    useMapStore.getState().selectedCorridorId
  );

  const { data, isPending, isError } = useDepartureWindows(selectedCorridor, submittedArrival);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    // Combine date + time into ISO string, then set state to trigger fetch
    setSubmittedArrival(combinedISO);
  }
}
```

### Pattern 4: Heatmap Grid as HTML Table
**What:** Plain `<table>` with fixed cell widths for the 7x17 heatmap
**When to use:** Fits naturally in 320px panel, no canvas/SVG needed

**Cell sizing calculation (320px panel):**
- Panel inner width after padding (px-2 = 8px each side): 304px
- Time label column: ~40px ("10pm" needs ~35px)
- Remaining for 7 day columns: 264px
- Per cell: ~37px width
- Font: text-[10px] or text-xs (12px) -- "36m" fits in 37px at 10px font
- Cell height: 22-24px for compact display

```typescript
function WeekHeatmap({ corridorId }: { corridorId: string }) {
  const { data, isPending } = useCorridorForecast(corridorId);

  // Build grid: map forecasts to [dayIndex][hourIndex]
  const grid = useMemo(() => buildHeatmapGrid(data?.forecasts ?? []), [data]);

  return (
    <div className="px-2 py-2 overflow-x-auto">
      <table className="w-full table-fixed text-[10px]">
        <thead>
          <tr>
            <th className="w-10 text-left text-gray-500">Time</th>
            {dayHeaders.map(h => (
              <th key={h.key} className="text-center text-gray-400 font-normal px-0.5">
                {h.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {HOURS.map(hour => (
            <tr key={hour}>
              <td className="text-gray-500 text-left pr-1">{formatHourLabel(hour)}</td>
              {Array.from({ length: 7 }, (_, dayIdx) => {
                const cell = grid[dayIdx]?.[hour];
                return (
                  <td
                    key={dayIdx}
                    className="text-center py-0.5 rounded-sm"
                    style={{ backgroundColor: cell ? CONGESTION_COLORS[cell.level] + '40' : undefined }}
                    title={cell ? `p10: ${cell.p10}m | p50: ${cell.p50}m | p90: ${cell.p90}m` : ''}
                  >
                    {cell ? `${cell.p50}m` : '-'}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

### Anti-Patterns to Avoid
- **Canvas/SVG for the heatmap:** Overkill for a 7x17 grid. HTML table is simpler, accessible, and allows native tooltips.
- **Storing tab state in Zustand:** Tab switching is local to CorridorPanel, adding it to global state creates unnecessary coupling.
- **Using `refetchInterval` for forecast data:** Week-ahead forecasts refresh every 6 hours server-side. No benefit to polling on the frontend.
- **Building a custom date picker:** HTML `<input type="date">` and `<input type="time">` are sufficient for MVP. Native inputs work well on mobile.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Date arithmetic (add days, format) | Manual Date math | `date-fns` (addDays, format, startOfDay, setHours) | Timezone edge cases, DST handling |
| Congestion level derivation | Custom per-component logic | Shared `deriveCongestionLevel(p50, p10)` utility | Backend already uses p50/p10 ratio -- must match |
| ISO string from date+time inputs | String concatenation | `new Date(dateString + 'T' + timeString).toISOString()` or `date-fns/parse` | Timezone correctness |
| Tooltip positioning | Custom JS positioning | Native `title` attribute | Decision locked: no Floating UI for MVP |
| Form validation | Manual if/else | Zod schema `.safeParse()` | Already project standard, mirrors backend validation |

**Key insight:** The backend already has `deriveCongestionRisk` (p50/p10 ratio thresholds: <=1.2 free_flow, <=1.5 moderate, >1.5 heavy). The frontend MUST use the same thresholds to avoid inconsistency between heatmap colors and API response `congestion_risk` fields.

## Common Pitfalls

### Pitfall 1: Timezone Mismatch in Grid Mapping
**What goes wrong:** Forecast `forecast_for` timestamps are in UTC. Mapping them to day columns and hour rows requires converting to the user's local timezone (or SF timezone). Without conversion, a 9am PT forecast shows up in the 5pm column.
**Why it happens:** `new Date(isoString).getHours()` returns local browser hours, but `getDay()` may differ from the SF day if the user is in a different timezone.
**How to avoid:** Since the app is SF-specific, use `date-fns` or `date-fns-tz` to convert to America/Los_Angeles. However, date-fns v4 does not include timezone utilities by default. Simpler approach: since all users are SF drivers, `new Date(timestamp).getHours()` in the browser's local time is correct for most users. For robustness, parse with date-fns `parseISO` and use `getHours()` / `getDay()`.
**Warning signs:** Heatmap columns labeled "Mon" but showing Tuesday's data.

### Pitfall 2: Missing Forecast Hours Create Empty Grid Cells
**What goes wrong:** The forecast API returns hourly data, but some hours may be missing (e.g., if the forecast engine hasn't run yet for far-future hours). The grid must handle `undefined` cells gracefully.
**Why it happens:** `?hours=168` returns UP TO 168 hours of data. Gaps are normal.
**How to avoid:** Build the grid as a sparse data structure (Map or 2D array initialized to null). Render missing cells as "-" or gray placeholder. Never assume all 119 cells (7x17) will be populated.
**Warning signs:** Grid crashes with "Cannot read property of undefined" on sparse data.

### Pitfall 3: Date + Time Input Combination for ISO String
**What goes wrong:** `<input type="date">` returns "2026-03-25" and `<input type="time">` returns "09:30". Naive concatenation `"2026-03-25T09:30"` creates a local-time string. Calling `new Date("2026-03-25T09:30").toISOString()` converts to UTC, which is what the API expects. But if the user intends 9:30am PT, the ISO string must be `2026-03-25T17:30:00.000Z` (UTC).
**Why it happens:** HTML date/time inputs return values without timezone info.
**How to avoid:** `new Date(dateValue + 'T' + timeValue)` interprets as local time, then `.toISOString()` converts to UTC. This is correct behavior -- local time in, UTC out. Verify with a test.
**Warning signs:** Departure windows are offset by 7-8 hours from expected.

### Pitfall 4: Heatmap Overflows Panel on Narrow Screens
**What goes wrong:** 7 columns at 37px each plus labels does not leave room for any padding. On mobile (bottom drawer), the panel may be full-width but short.
**Why it happens:** Fixed cell widths don't adapt to varying panel widths.
**How to avoid:** Use `table-fixed` with percentage widths, or use `overflow-x-auto` as a safety valve. Set `min-width` on the table so it scrolls horizontally if needed rather than breaking layout.
**Warning signs:** Cells overlap or text wraps to two lines.

### Pitfall 5: Congestion Level Mismatch Between Heatmap and API
**What goes wrong:** The departure-windows API returns `congestion_risk` derived from `p50/p10` ratio. If the heatmap derives congestion differently (e.g., comparing to a fixed "free-flow" baseline), colors won't match.
**Why it happens:** CONTEXT.md mentions "p50 vs historical baseline" but the backend uses `p50/p10` ratio.
**How to avoid:** Use the SAME derivation as the backend: `p50/p10` ratio with thresholds 1.2 and 1.5. This is already defined in `backend/src/api/forecasts.ts` line 13-17. Replicate exactly in `frontend/src/lib/congestion.ts`.
**Warning signs:** A cell shows green in heatmap but the same time slot shows "moderate" in departure results.

## Code Examples

### Congestion Level Derivation (must match backend)
```typescript
// Source: backend/src/api/forecasts.ts lines 13-17 (replicated for frontend)
import type { CongestionLevel } from '@/types/api';

export function deriveCongestionLevel(p50: number, p10: number): CongestionLevel {
  if (p10 <= 0) return 'unknown';
  const ratio = p50 / p10;
  if (ratio <= 1.2) return 'free_flow';
  if (ratio <= 1.5) return 'moderate';
  return 'heavy';
}
```

### Timestamp to Grid Index Mapping
```typescript
// Map ISO forecast_for to { dayIndex: 0-6, hour: 6-22 }
import { parseISO, differenceInCalendarDays, startOfDay } from 'date-fns';

const FIRST_HOUR = 6;
const LAST_HOUR = 22;

interface GridCoord {
  dayIndex: number; // 0 = today, 6 = today+6
  hour: number;     // 6-22
}

export function forecastToGridCoord(forecastFor: string, today: Date): GridCoord | null {
  const dt = parseISO(forecastFor);
  const dayIndex = differenceInCalendarDays(dt, startOfDay(today));
  const hour = dt.getHours();

  if (dayIndex < 0 || dayIndex > 6) return null;
  if (hour < FIRST_HOUR || hour > LAST_HOUR) return null;

  return { dayIndex, hour };
}
```

### Building the Heatmap Grid Data Structure
```typescript
interface HeatmapCell {
  p10: number;
  p50: number;
  p90: number;
  level: CongestionLevel;
}

type HeatmapGrid = Record<number, Record<number, HeatmapCell>>; // [dayIndex][hour]

export function buildHeatmapGrid(forecasts: ForecastEntry[]): HeatmapGrid {
  const today = startOfDay(new Date());
  const grid: HeatmapGrid = {};

  for (const f of forecasts) {
    const coord = forecastToGridCoord(f.forecast_for, today);
    if (!coord) continue;

    if (!grid[coord.dayIndex]) grid[coord.dayIndex] = {};
    grid[coord.dayIndex][coord.hour] = {
      p10: Math.round(f.p10_minutes),
      p50: Math.round(f.p50_minutes),
      p90: Math.round(f.p90_minutes),
      level: deriveCongestionLevel(f.p50_minutes, f.p10_minutes),
    };
  }

  return grid;
}
```

### Day Header Generation
```typescript
import { addDays, format } from 'date-fns';

export function generateDayHeaders(): { key: string; label: string }[] {
  const today = startOfDay(new Date());
  return Array.from({ length: 7 }, (_, i) => {
    const day = addDays(today, i);
    return {
      key: format(day, 'yyyy-MM-dd'),
      label: format(day, 'EEE M/d'),  // "Mon 3/20"
    };
  });
}
```

### Combining Date + Time Inputs to ISO String
```typescript
function buildArrivalISO(dateValue: string, timeValue: string): string {
  // dateValue: "2026-03-25", timeValue: "09:30"
  // Constructs local time, then converts to UTC ISO
  const localDate = new Date(`${dateValue}T${timeValue}`);
  return localDate.toISOString();
}
```

### API Fetch Functions
```typescript
// Extend frontend/src/lib/api.ts

export interface ForecastEntry {
  forecast_for: string;
  predicted_minutes: number;
  p10_minutes: number;
  p50_minutes: number;
  p90_minutes: number;
  model_version: string;
  weather_modifier: number | null;
  event_modifier: number | null;
  school_modifier: number | null;
}

export interface ForecastResponse {
  corridor_id: string;
  horizon_hours: number;
  forecasts: ForecastEntry[];
}

export interface DepartureWindow {
  departure_at: string;
  estimated_travel_min: number;
  p10_minutes: number;
  p90_minutes: number;
  congestion_risk: 'free_flow' | 'moderate' | 'heavy';
  reason: string | null;
}

export interface DepartureWindowsResponse {
  corridor_id: string;
  arrival_target: string;
  windows: DepartureWindow[];
}

export async function fetchCorridorForecast(corridorId: string): Promise<ForecastResponse> {
  const res = await fetch(`${API_URL}/api/corridors/${corridorId}/forecast?hours=168`);
  if (!res.ok) throw new Error(`Forecast fetch failed: ${res.status}`);
  return res.json();
}

export async function fetchDepartureWindows(
  corridorId: string,
  arrival: string,
  windowCount = 5,
): Promise<DepartureWindowsResponse> {
  const params = new URLSearchParams({ arrival, window_count: String(windowCount) });
  const res = await fetch(`${API_URL}/api/corridors/${corridorId}/departure-windows?${params}`);
  if (!res.ok) throw new Error(`Departure windows fetch failed: ${res.status}`);
  return res.json();
}
```

### Zod Client-Side Validation for Departure Form
```typescript
import { z } from 'zod';

export const departureFormSchema = z.object({
  corridorId: z.string().min(1, 'Select a corridor'),
  date: z.string().min(1, 'Select a date'),
  time: z.string().min(1, 'Select a time'),
}).refine(
  (data) => {
    const arrival = new Date(`${data.date}T${data.time}`);
    const now = new Date();
    const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    return arrival >= now && arrival <= sevenDays;
  },
  { message: 'Arrival must be within the next 7 days' },
);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| D3.js / canvas heatmaps | Plain HTML table + CSS | Always valid for small grids | No extra dependency, better accessibility |
| Custom date pickers (react-datepicker) | Native `<input type="date/time">` | Browser support now universal | No extra dependency, good mobile UX |
| `moment.js` for dates | `date-fns` v4 (tree-shakeable) | 2020+ | Already installed in project |
| Redux for form state | Local `useState` + TanStack Query | 2022+ (TanStack Query v4+) | Simpler, no form library needed |

**Deprecated/outdated:**
- `moment.js`: Replaced by date-fns project-wide (already using date-fns v4)
- `react-query` v3 import path: Use `@tanstack/react-query` v5 (already correct in project)

## Discretion Recommendations

### Heatmap Cell Dimensions
**Recommendation:** 37px wide cells, 22px tall, `text-[10px]` font. Use `table-fixed` layout with explicit column widths. Time label column at 40px, each day column at `calc((100% - 40px) / 7)`.

### Modifier Indicators in Heatmap
**Recommendation:** Do NOT show modifier icons in heatmap cells for MVP. At 37px x 22px, there is no room for icons alongside "36m" text. Instead, the `title` tooltip already includes the p10/p50/p90 range which implicitly reflects modifiers. Modifier reasons are surfaced explicitly in the departure planner results where there is more space.

### Skeleton Loading
**Recommendation:** Use `bg-gray-800 animate-pulse rounded-sm` on each cell. Render the full 7x17 grid skeleton immediately so the layout doesn't shift when data loads. No spinner -- the grid shape itself communicates "loading."

### Error Boundary
**Recommendation:** Wrap `WeekHeatmap` in a simple try/catch error boundary that shows "Failed to load forecast" inline. Use React's `ErrorBoundary` pattern or a simple `isError` check from TanStack Query (preferred since it handles fetch errors without needing a class component boundary).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1 + @testing-library/react 16.3 |
| Config file | `frontend/vitest.config.ts` |
| Quick run command | `cd frontend && npx vitest run --reporter=verbose` |
| Full suite command | `cd frontend && npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MAP-04 | Heatmap renders 7-day x 17-hour grid with congestion colors | unit | `cd frontend && npx vitest run src/components/__tests__/WeekHeatmap.test.tsx` | No -- Wave 0 |
| MAP-04 | buildHeatmapGrid maps forecasts to correct day/hour cells | unit | `cd frontend && npx vitest run src/lib/__tests__/heatmap.test.ts` | No -- Wave 0 |
| MAP-05 | Heatmap cells have title tooltip with p10/p50/p90 | unit | `cd frontend && npx vitest run src/components/__tests__/WeekHeatmap.test.tsx` | No -- Wave 0 |
| PLAN-01 | Departure form renders corridor dropdown, date, time inputs | unit | `cd frontend && npx vitest run src/components/__tests__/DeparturePlannerForm.test.tsx` | No -- Wave 0 |
| PLAN-02 | Departure results display ordered windows with travel times | unit | `cd frontend && npx vitest run src/components/__tests__/DepartureResults.test.tsx` | No -- Wave 0 |
| PLAN-03 | Best result highlighted, reason text shown when present | unit | `cd frontend && npx vitest run src/components/__tests__/DepartureResults.test.tsx` | No -- Wave 0 |
| MAP-04 | deriveCongestionLevel matches backend thresholds | unit | `cd frontend && npx vitest run src/lib/__tests__/congestion.test.ts` | No -- Wave 0 |
| MAP-04 | forecastToGridCoord maps ISO timestamps correctly | unit | `cd frontend && npx vitest run src/lib/__tests__/heatmap.test.ts` | No -- Wave 0 |
| PLAN-01 | Tab navigation switches between Live and Plan views | unit | `cd frontend && npx vitest run src/components/__tests__/CorridorPanel.test.tsx` | Yes -- extend existing |

### Sampling Rate
- **Per task commit:** `cd frontend && npx vitest run --reporter=verbose`
- **Per wave merge:** `cd frontend && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `frontend/src/components/__tests__/WeekHeatmap.test.tsx` -- covers MAP-04, MAP-05
- [ ] `frontend/src/components/__tests__/DeparturePlannerForm.test.tsx` -- covers PLAN-01
- [ ] `frontend/src/components/__tests__/DepartureResults.test.tsx` -- covers PLAN-02, PLAN-03
- [ ] `frontend/src/lib/__tests__/congestion.test.ts` -- covers congestion derivation
- [ ] `frontend/src/lib/__tests__/heatmap.test.ts` -- covers grid mapping logic

### Existing Test Patterns to Follow
From `CorridorPanel.test.tsx`:
- Mock hooks with `vi.mock()` returning shaped query objects `{ data, isSuccess, isFetching }`
- Wrap renders in `QueryClientProvider` with `retry: false`
- Use `data-testid` attributes for element targeting
- Use `useMapStore.setState()` in `beforeEach` for store initialization
- Use `fireEvent` for user interactions

## Open Questions

1. **Timezone handling for non-SF users**
   - What we know: The app is built for SF drivers. `forecast_for` timestamps are in UTC. Using `new Date().getHours()` gives browser-local hours.
   - What's unclear: If a user accesses from a different timezone, the heatmap grid will show hours in THEIR local time, not SF time. The `forecast_for` hour mapping would be off.
   - Recommendation: For MVP, assume browser is in Pacific time. Document as a known limitation. Adding `date-fns-tz` with forced `America/Los_Angeles` zone would fix this but adds complexity. Low priority since target users are SF drivers.

2. **Forecast data density**
   - What we know: API returns hourly forecasts for up to 168 hours. The grid has 119 displayable cells (7 days x 17 hours 6am-10pm).
   - What's unclear: How dense the actual data is. If the forecast engine runs every 6 hours, are ALL hourly slots populated or only the next 24-48 hours?
   - Recommendation: Build the grid to handle sparse data gracefully. Display "-" for missing cells. This is already noted as a pitfall above.

## Sources

### Primary (HIGH confidence)
- `backend/src/api/forecasts.ts` -- actual API response shape, `deriveCongestionRisk` logic (p50/p10 ratio thresholds)
- `frontend/src/components/CorridorPanel.tsx` -- existing panel structure, styling patterns, Zustand usage
- `frontend/src/hooks/useCorridorSpeeds.ts` -- TanStack Query v5 hook pattern
- `frontend/src/data/corridors.ts` -- CORRIDOR_IDS, CONGESTION_COLORS, display names
- `frontend/src/types/api.ts` -- existing type definitions to extend
- `frontend/src/lib/api.ts` -- API fetch pattern, API_URL config
- `frontend/src/store/mapStore.ts` -- Zustand store shape, selectedCorridorId
- `frontend/src/components/__tests__/CorridorPanel.test.tsx` -- testing patterns (vi.mock, QueryClientProvider wrapper, data-testid, useMapStore.setState)
- `frontend/vitest.config.ts` -- test config (jsdom, globals: true, setup file)
- `frontend/package.json` -- all dependencies and versions verified

### Secondary (MEDIUM confidence)
- date-fns v4 API (parseISO, differenceInCalendarDays, format, addDays) -- based on training data for date-fns v3/v4, API is stable
- HTML `<input type="date/time">` behavior -- well-documented web standard

### Tertiary (LOW confidence)
- None -- all findings verified against existing codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already installed and in use
- Architecture: HIGH -- patterns directly extend existing codebase patterns
- Pitfalls: HIGH -- derived from actual API contracts and codebase analysis
- Heatmap cell sizing: MEDIUM -- 37px estimate based on arithmetic; needs visual verification

**Research date:** 2026-03-20
**Valid until:** 2026-04-20 (stable -- no rapidly changing dependencies)
