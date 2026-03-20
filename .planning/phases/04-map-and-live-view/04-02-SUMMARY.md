---
phase: 04-map-and-live-view
plan: 02
subsystem: api, ui
tags: [express, react, mapbox, tanstack-query, incidents, geojson]

requires:
  - phase: 04-map-and-live-view/plan-01
    provides: MapView component, corridor layers, mapStore with incidentsVisible toggle
provides:
  - GET /api/incidents endpoint returning recent non-cleared incidents
  - IncidentMarker component with colored SVG icons by type
  - IncidentPopup component with type, description, delay, relative time
  - useIncidents hook with 5-min auto-refresh
  - Incident layer toggle via mapStore.incidentsVisible
affects: [05-departure-planner, 06-polish]

tech-stack:
  added: []
  patterns: [inline-svg-markers, popup-dark-theme, conditional-layer-rendering]

key-files:
  created:
    - backend/src/api/incidents.ts
    - backend/src/api/__tests__/incidents.test.ts
    - frontend/src/hooks/useIncidents.ts
    - frontend/src/components/IncidentMarker.tsx
    - frontend/src/components/IncidentPopup.tsx
    - frontend/src/components/__tests__/IncidentPopup.test.tsx
  modified:
    - backend/src/api/index.ts
    - frontend/src/types/api.ts
    - frontend/src/lib/api.ts
    - frontend/src/components/MapView.tsx

key-decisions:
  - "Inline SVG icons for incident markers rather than Mapbox symbol layer for simpler React integration"
  - "Dark popup styling (bg-gray-800) to match dark-v11 map theme"

patterns-established:
  - "Incident marker pattern: Marker wrapper with inline SVG child and click handler"
  - "Conditional layer rendering: incidentsVisible && markers pattern in MapView"

requirements-completed: [MAP-03]

duration: 3min
completed: 2026-03-20
---

# Phase 04 Plan 02: Incidents Layer Summary

**INRIX incidents layer with backend endpoint, colored SVG map markers (crash/construction/congestion), click-to-popup interaction, and panel toggle**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-20T07:29:27Z
- **Completed:** 2026-03-20T07:32:46Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Backend GET /api/incidents endpoint returning recent non-cleared incidents (24h window, limit 100)
- Frontend incident markers with type-specific colored SVG icons (red crash, orange construction, yellow congestion)
- Click-to-popup with incident type, description, delay, and relative timestamp
- Incidents layer toggleable via incidentsVisible in mapStore, auto-refreshes every 5 minutes

## Task Commits

Each task was committed atomically:

1. **Task 1: Create backend GET /api/incidents endpoint with tests** - `1cb37a0` (feat)
2. **Task 2: Add frontend incident markers, popups, toggle, and hook with tests** - `5f9240c` (feat)

## Files Created/Modified
- `backend/src/api/incidents.ts` - GET /api/incidents endpoint with SQL query
- `backend/src/api/__tests__/incidents.test.ts` - 4 test cases for incidents endpoint
- `backend/src/api/index.ts` - Mount incidentsRouter at /api/incidents
- `frontend/src/types/api.ts` - Incident, IncidentsResponse types, INCIDENT_TYPE_MAP
- `frontend/src/lib/api.ts` - fetchIncidents API function
- `frontend/src/hooks/useIncidents.ts` - TanStack Query hook with 5-min refetch
- `frontend/src/components/IncidentMarker.tsx` - Marker with inline SVG icons by type
- `frontend/src/components/IncidentPopup.tsx` - Popup with type label, desc, delay, time
- `frontend/src/components/MapView.tsx` - Conditional rendering of incident markers/popup
- `frontend/src/components/__tests__/IncidentPopup.test.tsx` - 7 test cases for popup

## Decisions Made
- Used inline SVG icons for incident markers rather than Mapbox symbol layer for simpler React integration and easier type-based coloring
- Dark popup styling (bg-gray-800) to match dark-v11 map theme

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 04 complete: map with corridor lines, speed coloring, corridor panel, and incident markers/popups
- Ready for Phase 05 departure planner UI

---
*Phase: 04-map-and-live-view*
*Completed: 2026-03-20*
