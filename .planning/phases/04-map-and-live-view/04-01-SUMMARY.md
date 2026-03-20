---
phase: 04-map-and-live-view
plan: 01
subsystem: ui
tags: [react, vite, mapbox, react-map-gl, tanstack-query, zustand, tailwindcss-v4, geojson]

# Dependency graph
requires:
  - phase: 03-api-layer
    provides: REST API endpoints for corridor speeds at /api/corridors/:id/current
provides:
  - React/Vite/TypeScript frontend scaffold with full dev and test tooling
  - Interactive Mapbox GL JS map with dark-v11 style centered on SF
  - 6 GeoJSON corridor line features with data-driven congestion colors
  - TanStack Query hooks for corridor speed auto-refresh every 5 minutes
  - Zustand store for UI state (selectedCorridorId, incidentsVisible, lastUpdated)
  - Responsive CorridorPanel (left sidebar desktop, bottom sheet mobile)
affects: [04-02, 05-forecast-ui]

# Tech tracking
tech-stack:
  added: [react@19, vite@8, mapbox-gl@3.20, react-map-gl@8.1, @tanstack/react-query@5, zustand@5, tailwindcss@4, @tailwindcss/vite@4, date-fns@4, vitest@4, @testing-library/react@16]
  patterns: [react-map-gl declarative Source/Layer, TanStack Query useQueries with refetchInterval, Zustand create store, Tailwind v4 @import with Vite plugin, Vite path alias @/]

key-files:
  created:
    - frontend/src/components/MapView.tsx
    - frontend/src/components/CorridorPanel.tsx
    - frontend/src/data/corridors.ts
    - frontend/src/hooks/useCorridorSpeeds.ts
    - frontend/src/store/mapStore.ts
    - frontend/src/types/api.ts
    - frontend/src/lib/api.ts
  modified:
    - frontend/package.json
    - frontend/vite.config.ts
    - frontend/tsconfig.app.json
    - frontend/src/main.tsx
    - frontend/src/App.tsx
    - frontend/src/index.css

key-decisions:
  - "Vitest globals: true required for @testing-library/jest-dom expect integration"
  - "MapView uses LineLayerSpecification type from mapbox-gl for layer config"
  - "GeoJSON memoized with useMemo keyed on corridorQueries for render performance"

patterns-established:
  - "Import from react-map-gl/mapbox (NOT bare react-map-gl) for Mapbox GL JS v3"
  - "Tailwind v4: @import tailwindcss in CSS, @tailwindcss/vite plugin, NO tailwind.config.js"
  - "TanStack Query useQueries for parallel corridor fetching with refetchInterval"
  - "Zustand store for UI-only state, TanStack Query for server state"

requirements-completed: [MAP-01, MAP-02]

# Metrics
duration: 8min
completed: 2026-03-20
---

# Phase 04 Plan 01: Map and Live View Summary

**Interactive Mapbox dark-v11 map with 6 GeoJSON corridor lines color-coded by congestion level, 5-minute auto-refresh via TanStack Query, and responsive floating panel with corridor selection**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-20T07:18:57Z
- **Completed:** 2026-03-20T07:26:36Z
- **Tasks:** 2
- **Files modified:** 27

## Accomplishments
- Full React/Vite/TypeScript frontend scaffold with Tailwind v4, Mapbox GL JS, TanStack Query, and Zustand
- MapView component renders 6 SF corridor lines with data-driven congestion colors (green/amber/red/gray) and click-to-select highlighting
- CorridorPanel with responsive layout (320px sidebar desktop, bottom sheet mobile), congestion badges, travel times, and last-updated timestamp
- 15 passing tests covering corridor data validation, useCorridorSpeeds hook behavior, and CorridorPanel UI

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold frontend app** - `d325f24` (feat)
2. **Task 2: Build MapView and CorridorPanel** - `2736210` (feat)

## Files Created/Modified
- `frontend/package.json` - Project dependencies and scripts
- `frontend/vite.config.ts` - Vite config with React, Tailwind v4, and path alias
- `frontend/vitest.config.ts` - Vitest config with jsdom, globals, and path alias
- `frontend/tsconfig.app.json` - TypeScript config with path alias
- `frontend/src/main.tsx` - Entry point with QueryClientProvider and mapbox-gl CSS import
- `frontend/src/App.tsx` - Root component rendering MapView and CorridorPanel
- `frontend/src/index.css` - Tailwind v4 import
- `frontend/src/types/api.ts` - CongestionLevel, CorridorCurrentResponse interfaces
- `frontend/src/data/corridors.ts` - GeoJSON geometries, corridor IDs, congestion colors, createCorridorFeatureCollection
- `frontend/src/lib/api.ts` - fetchCorridorSpeed with VITE_API_URL
- `frontend/src/store/mapStore.ts` - Zustand store for selectedCorridorId, incidentsVisible, lastUpdated
- `frontend/src/hooks/useCorridorSpeeds.ts` - TanStack Query useQueries hook with 5-min refetchInterval
- `frontend/src/components/MapView.tsx` - Mapbox map with corridor Source/Layer and click selection
- `frontend/src/components/CorridorPanel.tsx` - Responsive floating panel with corridor list and badges
- `frontend/src/data/__tests__/corridors.test.ts` - 7 tests for corridor data validation
- `frontend/src/hooks/__tests__/useCorridorSpeeds.test.ts` - 3 tests for hook behavior
- `frontend/src/components/__tests__/CorridorPanel.test.tsx` - 5 tests for panel UI

## Decisions Made
- Enabled `globals: true` in vitest.config.ts for @testing-library/jest-dom compatibility (expect must be globally available)
- Used `LineLayerSpecification` from mapbox-gl instead of deprecated `LineLayer` type
- GeoJSON data memoized with useMemo keyed on corridor query results to prevent map re-parsing on every render

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Vitest globals configuration**
- **Found during:** Task 1 (test infrastructure)
- **Issue:** @testing-library/jest-dom requires `expect` to be globally available; vitest default does not expose globals
- **Fix:** Added `globals: true` to vitest.config.ts test options
- **Files modified:** frontend/vitest.config.ts
- **Verification:** All tests pass
- **Committed in:** d325f24 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Necessary configuration fix for test infrastructure. No scope creep.

## Issues Encountered
- Network error (ECONNRESET) on first npm install of runtime dependencies; resolved on retry.

## User Setup Required
**Mapbox token required for map rendering.** Set `VITE_MAPBOX_TOKEN` in `frontend/.env.development` with a valid Mapbox access token before running `npm run dev`.

## Next Phase Readiness
- Frontend scaffold complete, ready for Plan 02 (incidents layer)
- Backend incidents endpoint needed for MAP-03 (Plan 02 scope)
- All tests green, TypeScript clean, production build passes

## Self-Check: PASSED

All 8 key files verified on disk. Both task commits (d325f24, 2736210) verified in git log.

---
*Phase: 04-map-and-live-view*
*Completed: 2026-03-20*
