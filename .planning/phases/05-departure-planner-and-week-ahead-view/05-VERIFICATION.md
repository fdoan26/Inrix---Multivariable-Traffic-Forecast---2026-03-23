---
phase: 05-departure-planner-and-week-ahead-view
verified: 2026-03-20T01:15:30Z
status: passed
score: 9/9 must-haves verified
re_verification: false
gaps: []
human_verification:
  - test: "Heatmap visual rendering"
    expected: "7x17 grid fills CorridorPanel with color-coded cells (green/yellow/red at 25% opacity) matching congestion levels, cell text is legible at 10px"
    why_human: "Cannot verify CSS color rendering, font legibility, or overflow-x scroll behavior programmatically"
  - test: "Departure planner end-to-end user flow"
    expected: "User selects corridor, picks date/time, submits form; results appear ranked with amber-highlighted best window and italic reason text where modifiers apply"
    why_human: "Full API integration against live backend cannot be verified in unit tests; real departure-windows endpoint not yet built (Phase 3 pending)"
---

# Phase 05: Departure Planner and Week-Ahead View Verification Report

**Phase Goal:** Users can plan their week's driving with a corridor heatmap and a departure time recommender that explains why certain times are slow
**Verified:** 2026-03-20T01:15:30Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Week-ahead heatmap renders a 7-day x 17-hour grid with congestion-colored cells when a corridor is selected | VERIFIED | `WeekHeatmap.tsx` renders `<table data-testid="week-heatmap">` with 17 HOURS x 7 dayHeaders cells; `style={{ backgroundColor: CONGESTION_COLORS[cell.level] + '40' }}`; 8 passing WeekHeatmap tests including grid structure, headers, and cell content |
| 2 | Each heatmap cell shows p50 travel time in minutes and has a title tooltip with p10/p50/p90 values | VERIFIED | `WeekHeatmap.tsx` line 80: `{cell.p50}m`; line 78: `` title={`p10: ${cell.p10}m | p50: ${cell.p50}m | p90: ${cell.p90}m`} ``; test `has title tooltip with p10/p50/p90 values` passes |
| 3 | Tab navigation switches between Live and Plan views in the CorridorPanel | VERIFIED | `CorridorPanel.tsx` uses `useState<PanelTab>('live')`, renders `data-testid="tab-live"` and `data-testid="tab-plan"` buttons; conditional render `{activeTab === 'live' ? ... : <DeparturePlannerForm />}`; 4 CorridorPanel tab tests pass |
| 4 | Congestion level derivation on frontend matches backend thresholds (p50/p10 ratio: <=1.2 free_flow, <=1.5 moderate, >1.5 heavy) | VERIFIED | `congestion.ts` implements exactly: `if (ratio <= 1.2) return 'free_flow'; if (ratio <= 1.5) return 'moderate'; return 'heavy'`; 5 unit tests confirm all threshold boundaries including p10<=0 returns 'unknown' |
| 5 | User can select a corridor, date, and time to find best departure windows | VERIFIED | `DeparturePlannerForm.tsx` renders corridor dropdown (6 CORRIDOR_IDS), date input (type="date"), time input (type="time"), "Find Best Times" button; 10 passing tests covering render, validation, and submit behavior |
| 6 | System displays ranked departure windows ordered by lowest travel time | VERIFIED | `DepartureResults.tsx` renders `data-testid="departure-results"` with indexed `departure-window-N` items; windows displayed in API order (API is responsible for ordering); confidence ranges shown as `{N} min ({p10}-{p90})`; 9 passing DepartureResults tests |
| 7 | Best departure time (index 0) is visually highlighted with amber styling | VERIFIED | `DepartureResults.tsx` line 25: `isBest ? 'bg-amber-900/30 border border-amber-700'`; test `first item has amber highlight classes` passes; test `second and third items do NOT have amber highlight` passes |
| 8 | Reason text like "Slow due to rain/fog forecast" appears on results with modifiers | VERIFIED | `DepartureResults.tsx` lines 38-40: `{w.reason && <p className="text-xs text-gray-500 italic mt-0.5">{w.reason}</p>}`; test `shows reason text for results with non-null reason` passes with "Slow due to rain/fog forecast" and "Slow due to Giants game" |
| 9 | Confidence intervals shown inline as "Xm (Y-Z)" on each result | VERIFIED | `DepartureResults.tsx` line 36: `{Math.round(w.estimated_travel_min)} min ({Math.round(w.p10_minutes)}-{Math.round(w.p90_minutes)})`; test `shows travel time with confidence range` matches `/32 min/` and `/26.*40/` patterns |

**Score:** 9/9 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `frontend/src/lib/congestion.ts` | deriveCongestionLevel utility | VERIFIED | Exports `deriveCongestionLevel(p50, p10): CongestionLevel`; 10 lines, fully implemented |
| `frontend/src/lib/heatmap.ts` | forecastToGridCoord, buildHeatmapGrid, generateDayHeaders | VERIFIED | Exports all 3 functions plus `GridCoord`, `HeatmapCell`, `HeatmapGrid` types; 57 lines, fully implemented with date-fns |
| `frontend/src/hooks/useCorridorForecast.ts` | TanStack Query hook for corridor forecast | VERIFIED | Exports `useCorridorForecast`; uses `queryKey: ['forecast', corridorId]`, `enabled: !!corridorId`, `refetchInterval: false`, `staleTime: 30*60*1000` |
| `frontend/src/components/WeekHeatmap.tsx` | 7x17 heatmap grid component | VERIFIED | Exports `WeekHeatmap`; implements skeleton loading, error state, and full 7x17 grid with CONGESTION_COLORS, p50 cell text, and title tooltips |
| `frontend/src/hooks/useDepartureWindows.ts` | TanStack Query hook for departure windows | VERIFIED | Exports `useDepartureWindows`; uses `enabled: !!corridorId && !!arrival`, `refetchInterval: false` |
| `frontend/src/components/DeparturePlannerForm.tsx` | Form with corridor dropdown, date, time inputs + Zod validation | VERIFIED | Exports `DeparturePlannerForm`; Zod schema validates corridorId/date/time; `validateArrivalRange()` enforces 7-day window; all required `data-testid` attributes present |
| `frontend/src/components/DepartureResults.tsx` | Ordered result list with amber highlight and reason text | VERIFIED | Exports `DepartureResults`; first item `bg-amber-900/30 border border-amber-700`, CONGESTION_COLORS badge dots, italic reason text, empty state handled |
| `frontend/src/types/api.ts` | ForecastEntry, ForecastResponse, DepartureWindow, DepartureWindowsResponse types | VERIFIED | All 4 interfaces present; `DepartureWindow` includes `congestion_risk: CongestionLevel` and `reason: string | null` |
| `frontend/src/lib/api.ts` | fetchCorridorForecast and fetchDepartureWindows | VERIFIED | Both functions exported; `fetchCorridorForecast` hits `/api/corridors/${corridorId}/forecast?hours=168`; `fetchDepartureWindows` uses URLSearchParams with `arrival` and `window_count` |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `WeekHeatmap.tsx` | `/api/corridors/:id/forecast?hours=168` | `useCorridorForecast(corridorId)` hook | WIRED | Line 13: `const { data, isPending, isError } = useCorridorForecast(corridorId)`; hook calls `fetchCorridorForecast` which hits the forecast URL |
| `CorridorPanel.tsx` | `WeekHeatmap.tsx` | conditional render in Live tab when corridor selected | WIRED | Line 128: `{selectedCorridorId && <WeekHeatmap corridorId={selectedCorridorId} />}` in `activeTab === 'live'` branch |
| `heatmap.ts` | `congestion.ts` | `buildHeatmapGrid` calls `deriveCongestionLevel` | WIRED | `heatmap.ts` line 1: `import { deriveCongestionLevel } from '@/lib/congestion'`; line 42: `level: deriveCongestionLevel(f.p50_minutes, f.p10_minutes)` |
| `DeparturePlannerForm.tsx` | `/api/corridors/:id/departure-windows` | `useDepartureWindows` hook triggered by form submit | WIRED | Lines 35, 57-58: hook enabled after `setSubmittedCorridor`/`setSubmittedArrival`; hook calls `fetchDepartureWindows` which hits departure-windows URL |
| `DeparturePlannerForm.tsx` | `DepartureResults.tsx` | passes query data as props | WIRED | Lines 135-137: `{data && data.windows && <DepartureResults windows={data.windows} />}` |
| `CorridorPanel.tsx` | `DeparturePlannerForm.tsx` | rendered in Plan tab | WIRED | Line 145: `<DeparturePlannerForm />` in the `activeTab === 'plan'` branch; import on line 11 |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| MAP-04 | 05-01-PLAN.md | Week-ahead corridor heatmap — 7-day x time-slot grid per corridor showing predicted congestion | SATISFIED | `WeekHeatmap.tsx` renders 7 day columns x 17 hour rows; cells colored by `deriveCongestionLevel` via `buildHeatmapGrid`; all 8 WeekHeatmap tests pass |
| MAP-05 | 05-01-PLAN.md | Confidence interval display alongside predicted travel times | SATISFIED | Heatmap cell titles show `p10: Xm | p50: Ym | p90: Zm`; DepartureResults shows `N min (p10-p90)`; verified by tooltip test and confidence range test |
| PLAN-01 | 05-02-PLAN.md | User inputs origin, destination, and desired arrival time | SATISFIED | `DeparturePlannerForm` provides corridor dropdown (origin/destination) + date + time inputs with Zod validation; 10 passing form tests |
| PLAN-02 | 05-02-PLAN.md | System returns recommended departure windows across the week with congestion risk score | SATISFIED | `DepartureResults` renders ordered windows with congestion badge dots (colored by `CONGESTION_COLORS`); confidence ranges displayed; 9 passing result tests |
| PLAN-03 | 05-02-PLAN.md | Best departure time highlighted with "Slow due to [reason]" explanations where modifiers apply | SATISFIED | Index 0 window has `bg-amber-900/30 border border-amber-700`; `w.reason` renders as italic paragraph; both behaviors tested and passing |

No orphaned requirements: all 5 IDs declared in plans (MAP-04, MAP-05 in 05-01; PLAN-01, PLAN-02, PLAN-03 in 05-02) match the REQUIREMENTS.md traceability table mapping all 5 to Phase 5.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | — | — | — | — |

No TODO/FIXME/placeholder comments in production code. No stub implementations. No empty return values. No console.log-only handlers. The prior "Departure planner coming soon" placeholder from 05-01 was correctly replaced with `<DeparturePlannerForm />` in 05-02 (confirmed absent from `CorridorPanel.tsx`).

---

### Human Verification Required

#### 1. Heatmap visual rendering

**Test:** Select a corridor in the Live tab of the CorridorPanel; observe the WeekHeatmap that appears below the corridor list.
**Expected:** A scrollable 7x17 table with green/yellow/red tinted cells (25% opacity backgrounds), small p50 minute values in each cell, "-" for unfilled slots, and hovering any cell shows a native tooltip like "p10: 28m | p50: 36m | p90: 44m". Day headers follow "Mon 3/23" format and hour labels show "6am" through "10pm".
**Why human:** CSS opacity rendering, color perception at 25% alpha, layout overflow behavior, and tooltip trigger behavior cannot be verified programmatically in unit tests.

#### 2. Departure planner full user flow

**Test:** In CorridorPanel Plan tab, select a corridor from the dropdown, pick a date 1-3 days out, set an arrival time, click "Find Best Times".
**Expected:** Loading spinner appears briefly, then 5 departure windows display ordered by travel time. The top result (index 0) is highlighted with an amber border. Any window with a weather/event/school modifier shows italic "Slow due to..." text. Confidence ranges display as "32 min (26-40)".
**Why human:** Requires live backend API (Phase 3 departure-windows endpoint not yet built per ROADMAP.md); real API response ordering and modifier reason generation cannot be exercised in the current test environment.

---

### Gaps Summary

No gaps. All 9 observable truths verified, all 9 artifacts confirmed substantive and wired, all 6 key links confirmed, all 5 requirement IDs satisfied. The two human verification items are noted for completeness but do not block the phase goal — they depend on a live backend which is a downstream phase dependency, not a Phase 5 deliverable.

---

_Verified: 2026-03-20T01:15:30Z_
_Verifier: Claude (gsd-verifier)_
