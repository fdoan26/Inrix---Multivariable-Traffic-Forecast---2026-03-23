---
phase: 05-departure-planner-and-week-ahead-view
plan: 01
subsystem: ui
tags: [react, tanstack-query, heatmap, date-fns, vitest]

requires:
  - phase: 04-frontend-map-and-corridor-panel
    provides: CorridorPanel component, mapStore, corridor data, CONGESTION_COLORS
provides:
  - deriveCongestionLevel utility matching backend p50/p10 ratio thresholds
  - buildHeatmapGrid and generateDayHeaders heatmap utilities
  - useCorridorForecast TanStack Query hook for /api/corridors/:id/forecast
  - WeekHeatmap 7x17 grid component with congestion colors and p10/p50/p90 tooltips
  - CorridorPanel Live|Plan tab navigation
  - ForecastEntry, ForecastResponse, DepartureWindow, DepartureWindowsResponse types
  - fetchCorridorForecast and fetchDepartureWindows API functions
affects: [05-departure-planner-and-week-ahead-view]

tech-stack:
  added: []
  patterns: [vi.useFakeTimers for deterministic date tests, mock hook pattern for component isolation]

key-files:
  created:
    - frontend/src/lib/congestion.ts
    - frontend/src/lib/heatmap.ts
    - frontend/src/hooks/useCorridorForecast.ts
    - frontend/src/components/WeekHeatmap.tsx
    - frontend/src/lib/__tests__/congestion.test.ts
    - frontend/src/lib/__tests__/heatmap.test.ts
    - frontend/src/components/__tests__/WeekHeatmap.test.tsx
  modified:
    - frontend/src/types/api.ts
    - frontend/src/lib/api.ts
    - frontend/src/components/CorridorPanel.tsx
    - frontend/src/components/__tests__/CorridorPanel.test.tsx

key-decisions:
  - "Removed segment detail section from CorridorPanel, replaced with WeekHeatmap view"
  - "useCorridorForecast uses 30min staleTime and no refetchInterval (forecast data is slow-changing)"

patterns-established:
  - "Mock hook pattern: vi.mock hook module, return shaped query result objects for loading/error/success states"
  - "vi.useFakeTimers + vi.setSystemTime for deterministic date-dependent component tests"

requirements-completed: [MAP-04, MAP-05]

duration: 3min
completed: 2026-03-20
---

# Phase 05 Plan 01: Week-Ahead Heatmap Summary

**7-day x 17-hour congestion heatmap with p50/p10 ratio-based coloring, confidence interval tooltips, and Live|Plan tab navigation in CorridorPanel**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-20T07:58:36Z
- **Completed:** 2026-03-20T08:01:51Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments
- Built congestion derivation utility matching backend thresholds (p50/p10 ratio: <=1.2 free_flow, <=1.5 moderate, >1.5 heavy)
- Created WeekHeatmap component rendering 7-day x 17-hour grid with CONGESTION_COLORS background, p50 cell text, and p10/p50/p90 title tooltips
- Added Live|Plan tab navigation to CorridorPanel with WeekHeatmap in Live tab
- Added ForecastEntry, ForecastResponse, DepartureWindow, DepartureWindowsResponse types and fetchCorridorForecast/fetchDepartureWindows API functions

## Task Commits

Each task was committed atomically:

1. **Task 1: Wave 0 test stubs + types + utility functions** - `bf4f14f` (feat)
2. **Task 2: WeekHeatmap component + useCorridorForecast hook + CorridorPanel tab integration** - `859347b` (feat)

## Files Created/Modified
- `frontend/src/types/api.ts` - Added ForecastEntry, ForecastResponse, DepartureWindow, DepartureWindowsResponse interfaces
- `frontend/src/lib/api.ts` - Added fetchCorridorForecast and fetchDepartureWindows functions
- `frontend/src/lib/congestion.ts` - deriveCongestionLevel utility with p50/p10 ratio thresholds
- `frontend/src/lib/heatmap.ts` - forecastToGridCoord, buildHeatmapGrid, generateDayHeaders utilities
- `frontend/src/hooks/useCorridorForecast.ts` - TanStack Query hook for corridor forecast data
- `frontend/src/components/WeekHeatmap.tsx` - 7x17 heatmap grid with congestion colors and tooltips
- `frontend/src/components/CorridorPanel.tsx` - Added Live|Plan tabs, integrated WeekHeatmap
- `frontend/src/lib/__tests__/congestion.test.ts` - 5 tests for deriveCongestionLevel
- `frontend/src/lib/__tests__/heatmap.test.ts` - 13 tests for heatmap utilities
- `frontend/src/components/__tests__/WeekHeatmap.test.tsx` - 8 tests for WeekHeatmap component
- `frontend/src/components/__tests__/CorridorPanel.test.tsx` - Extended with 5 tab navigation tests

## Decisions Made
- Removed segment detail section from CorridorPanel, replaced with WeekHeatmap view (heatmap provides more value)
- useCorridorForecast uses 30min staleTime and no refetchInterval since forecast data is slow-changing

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- WeekHeatmap and tab navigation ready for Plan 05-02 departure planner integration
- DepartureWindow types and fetchDepartureWindows API function pre-created for Plan 05-02
- Plan tab placeholder ready to receive departure planner component

## Self-Check: PASSED

All 7 created files verified present. Both task commits (bf4f14f, 859347b) verified in git log.

---
*Phase: 05-departure-planner-and-week-ahead-view*
*Completed: 2026-03-20*
