# Phase 5: Departure Planner and Week-Ahead View - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 5 adds two frontend views on top of the existing React/Mapbox app:
1. **Week-ahead heatmap** (MAP-04, MAP-05) — 7-day × hourly grid per corridor, color-coded by predicted congestion, with p10/p50/p90 confidence intervals on hover
2. **Departure planner** (PLAN-01, PLAN-02, PLAN-03) — form to input corridor + desired arrival time, returns ranked departure windows with congestion risk scores and modifier-based reason text

The backend API for both features already exists (Phase 3): `GET /api/corridors/:id/forecast` and `GET /api/corridors/:id/departure-windows`. This phase is frontend-only except for minor API fixes if needed.

</domain>

<decisions>
## Implementation Decisions

### Panel Navigation
- Two tabs added to the existing `CorridorPanel` header: **Live** | **Plan**
- "Live" tab = current corridor list + heatmap (Phase 5 addition when corridor selected)
- "Plan" tab = departure planner form + results
- Underline-active tab style: `border-b-2 border-amber-400 text-white` for active, `text-gray-400` for inactive
- Tab state is local component state (not Zustand) — no cross-component coordination needed
- No routing — single-page app, tabs switch panel content only

### Week-Ahead Heatmap Layout (MAP-04)
- Heatmap displayed in "Live" tab when a corridor is selected, replacing the current segment detail section
- Grid: 7 columns (days: today through +6), 17 rows (hours: 6am–10pm inclusive)
- Day column headers: short format — "Mon 3/20", "Tue 3/21"
- Time row labels: "6am", "7am", ..., "10pm" (left-aligned)
- Cell content: p50 travel time in minutes — "36m" (truncated, no decimal)
- Cell background: `CONGESTION_COLORS` from `src/data/corridors.ts` mapped from p50 congestion level threshold (same thresholds as live view: free_flow/moderate/heavy)
- Congestion level derived from p50_minutes vs historical baseline: use `congestion_level` field from forecast if available, else map via speed threshold
- Fetch: `GET /api/corridors/:id/forecast?hours=168` (7 days), query key `['forecast', corridorId]`, `refetchInterval: false` (week-ahead data doesn't need live polling)
- Loading state: skeleton cells (gray-800 background) while fetching

### Confidence Interval Display (MAP-05)
- Heatmap cells: **tooltip on hover** showing "p10: 28m | p50: 36m | p90: 44m"
- Implementation: CSS `title` attribute on each `<td>` — no Floating UI / Popper library needed for MVP
- Departure planner results: confidence range shown inline — "36 min (28–44)" on a second line below the departure time
- No separate confidence view — intervals are supplementary to p50 primary display

### Departure Planner Form (PLAN-01)
- Lives in "Plan" tab
- Form fields:
  1. **Corridor** — `<select>` dropdown listing all 6 corridors by display name, defaults to currently-selected corridor from Zustand `selectedCorridorId`
  2. **Arrival date** — `<input type="date">` with min=today, max=today+7
  3. **Arrival time** — `<input type="time">` in 30-min steps (step="1800")
- Submit button: "Find Best Times"
- No origin/destination free-text input — corridor selection is the origin/destination proxy (simpler, matches existing data model)
- Zod validation client-side: arrival must be within 7 days (mirrors backend validation)

### Departure Window Results (PLAN-02, PLAN-03)
- Results displayed below form as an ordered list (best first = lowest p50)
- Each result shows:
  - Departure time: "Mon 3/20 at 7:30am"
  - Travel time: "36 min (28–44)" — p50 with p10–p90 range
  - Congestion badge: same dot-badge from CorridorPanel (green/amber/red)
  - Reason: italic text if present — "Slow due to rain/fog forecast"
- Best result (index 0) gets amber highlight: `bg-amber-900/30 border border-amber-700`
- Default `window_count=5` (fewer results = easier to scan)
- Error state: inline message "No forecast data available for this corridor and time"
- Loading state: spinner in results area

### Styling Consistency
- All new components use existing Tailwind v4 dark theme (bg-gray-900, text-gray-100, border-gray-700)
- No new component libraries — plain Tailwind + existing patterns
- New types added to `src/types/api.ts` (ForecastEntry, DepartureWindow, ForecastResponse, DepartureWindowsResponse)

### Claude's Discretion
- Exact heatmap cell dimensions and text sizing (must fit 7 columns in 320px panel width)
- Whether to show modifier indicators (weather/event/school icons) in heatmap cells
- Exact skeleton loading animation for heatmap grid
- Error boundary for failed forecast fetch

</decisions>

<canonical_refs>
## Canonical References

No external specs — requirements are fully captured in decisions above.

### Planning documents
- `.planning/REQUIREMENTS.md` — MAP-04, MAP-05, PLAN-01, PLAN-02, PLAN-03 definitions
- `.planning/phases/03-api-layer/03-CONTEXT.md` — departure-windows endpoint contract (response shape, cache, Zod validation)
- `.planning/phases/04-map-and-live-view/04-CONTEXT.md` — existing frontend decisions (Tailwind v4, react-map-gl patterns, Zustand store shape)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `frontend/src/components/CorridorPanel.tsx` — main panel component to extend with tabs and heatmap section
- `frontend/src/data/corridors.ts` — `CORRIDOR_IDS`, `CORRIDOR_DISPLAY_NAMES`, `CONGESTION_COLORS` — all reusable in heatmap and planner
- `frontend/src/store/mapStore.ts` — `selectedCorridorId` Zustand state — default corridor for planner dropdown
- `frontend/src/lib/api.ts` — `apiFetch` wrapper with `VITE_API_URL` — use for forecast and departure-windows fetches
- `frontend/src/types/api.ts` — extend with `ForecastEntry`, `ForecastResponse`, `DepartureWindow`, `DepartureWindowsResponse`
- `frontend/src/hooks/useCorridorSpeeds.ts` — TanStack Query pattern to copy for `useCorridorForecast` and `useDepartureWindows` hooks

### Established Patterns
- TanStack Query v5 with `useQuery`: `queryKey`, `queryFn`, `refetchInterval`, stale-while-revalidate
- Tailwind v4 dark theme: `bg-gray-900/95`, `border-gray-700`, `text-gray-100`, `text-gray-400`
- `data-testid` attributes on all interactive elements for test targeting
- `formatDistanceToNow` from `date-fns` (already installed) for relative time display

### Integration Points
- `GET /api/corridors/:corridorId/forecast?hours=168` — returns `forecasts[]` with `forecast_for`, `p10_minutes`, `p50_minutes`, `p90_minutes`, `weather_modifier`, `event_modifier`, `school_modifier`
- `GET /api/corridors/:corridorId/departure-windows?arrival=<ISO>&window_count=5` — returns `windows[]` with `departure_at`, `estimated_travel_min`, `p10_minutes`, `p90_minutes`, `congestion_risk`, `reason`
- Both endpoints already live in `backend/src/api/forecasts.ts` — no new backend work needed
- Frontend must construct arrival ISO string from date + time inputs before calling departure-windows

</code_context>

<specifics>
## Specific Ideas

- The heatmap is the "aha moment" of the app — users should be able to see at a glance that Tuesday mornings are red while Sunday afternoons are green on Market St
- The departure planner should surface the modifier reasons clearly — "Slow due to Giants game" is a differentiator vs Google Maps
- Panel width is 320px on desktop — 7 heatmap columns must fit; cells will be approximately 35–38px wide with 5px padding

</specifics>

<deferred>
## Deferred Ideas

- Free-text origin/destination input with geocoding — too complex for MVP; corridor selection is sufficient
- PWA / mobile app installability — v2
- Email/push alerts for saved routes — v2
- Heatmap comparison view (this week vs last week) — v2

</deferred>

---

*Phase: 05-departure-planner-and-week-ahead-view*
*Context gathered: 2026-03-19*
