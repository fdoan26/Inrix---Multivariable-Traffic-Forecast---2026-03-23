# Phase 4: Map and Live View - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 4 is the first frontend phase. It delivers the React/Vite/TypeScript app scaffold and the live map view: Mapbox GL JS map of SF centered on the 6 major corridors, color-coded by congestion level, with an INRIX incidents layer. No departure planner, no forecast heatmap — those are Phase 5. The goal is a functional map users can trust before they rely on forecasts.

</domain>

<decisions>
## Implementation Decisions

### App Scaffold
- React 19 + Vite + TypeScript — `npm create vite@latest frontend -- --template react-ts`
- Frontend lives in `frontend/` at repo root, peer to `backend/` and `ml/`
- Environment variables via Vite convention: `VITE_MAPBOX_TOKEN`, `VITE_API_URL` (defaults to `http://localhost:3001`)
- ESLint flat config (`eslint.config.js`) + Prettier for formatting
- Path alias: `@/` → `src/` (configured in `vite.config.ts` and `tsconfig.json`)

### Map Library & Style
- Mapbox GL JS 3.20.x + react-map-gl 8.1.x (React declarative wrapper: `<Map>`, `<Source>`, `<Layer>`)
- Map style: `mapbox://styles/mapbox/dark-v11` — dark background makes color-coded traffic pop
- Initial center: `[-122.4194, 37.7749]` (SF City Hall), zoom 12
- Map fills the full viewport; no fixed-height container

### App Shell & Layout
- Full-viewport map (`width: 100vw, height: 100vh`)
- Floating panel: left side on desktop (320px wide), slides up from bottom on mobile (CSS media query breakpoint 768px)
- Panel contains: app title, corridor list with congestion badges, last-updated timestamp, layer toggle for incidents
- No separate route/page for MVP — single-page map view only

### Corridor Visualization (MAP-01, MAP-02)
- 6 corridors defined as GeoJSON LineString features in `src/data/corridors.ts` with hard-coded coordinates:
  - `us-101-n` — US-101 Northbound (SF to SFO direction)
  - `us-101-s` — US-101 Southbound
  - `i-280-n` — I-280 Northbound
  - `i-280-s` — I-280 Southbound
  - `bay-bridge-w` — Bay Bridge approach (I-80 Westbound, Oakland→SF)
  - `van-ness-n` — Van Ness Ave Northbound
- Corridor color from `congestion_level` API field: `free_flow=#10b981` (green), `moderate=#f59e0b` (amber), `heavy=#ef4444` (red), `unknown=#6b7280` (gray)
- Line width: 6px, line-cap: round, line-join: round
- Clicking a corridor line: selects it, highlights it (opacity 1.0 vs 0.6 for unselected), shows speed details in panel
- Corridors displayed as a single `<Source>` with multiple `<Layer>` children (one per corridor for independent color control)

### Live Update (MAP-02)
- TanStack Query v5 (`@tanstack/react-query`) with `refetchInterval: 5 * 60 * 1000` (5 minutes)
- Query key: `['corridor-speeds']` — fetches all 6 corridors in parallel (6 separate API calls to `/api/corridors/:id/current`)
- Stale-while-revalidate: show previous data while fetching (no loading flicker)
- Panel header shows last-fetched timestamp: "Updated 2 min ago"
- Loading spinner in panel header during refetch

### Incident Markers (MAP-03)
- Fetch from `/api/incidents` — new backend endpoint returning recent incidents from `traffic_incidents` table
- Mapbox symbol layer with three custom marker icons (SVG encoded as base64 data URIs):
  - `crash` → red circle with ❗
  - `construction` → orange cone icon
  - `congestion` → yellow triangle with ⚠️
- Click incident marker → popup with: incident type, description, delay_minutes (if available), recorded_at timestamp
- Incidents layer toggleable via checkbox in panel (default: on)
- Fetch interval: 5 minutes (same as speeds)

### State Management
- Zustand store (`src/store/mapStore.ts`): `selectedCorridorId`, `incidentsVisible`, `lastUpdated`
- TanStack Query handles all server state (speeds, incidents) — Zustand only for UI state
- No Redux, no Context API for global state

### Styling
- Tailwind CSS v4 for utility classes — `npm install tailwindcss @tailwindcss/vite`
- No component library (Shadcn, MUI) for MVP — plain Tailwind for the minimal panel UI
- Dark theme matching Mapbox dark-v11 (bg-gray-900, text-gray-100)

### Testing
- Vitest + React Testing Library for component tests
- No E2E (Playwright) for MVP — component tests for panel logic, API response parsing
- Test files co-located: `src/components/__tests__/CorridorPanel.test.tsx`

### Claude's Discretion
- Exact GeoJSON coordinates for each corridor (approximate real SF road paths)
- Incident icon SVG designs
- Exact Tailwind class combinations for panel styling
- Whether to add a "Refresh now" button vs auto-only

</decisions>

<canonical_refs>
## Canonical References

No external specs — requirements are fully captured in decisions above.

### Planning documents
- `.planning/REQUIREMENTS.md` — MAP-01, MAP-02, MAP-03 definitions
- `.planning/research/STACK.md` — tech stack decisions (React 19, Vite, Mapbox GL JS 3.20, react-map-gl 8.1, Zustand, TanStack Query)
- `.planning/phases/03-api-layer/03-CONTEXT.md` — existing API endpoints that the frontend consumes
- `.planning/phases/03-api-layer/03-02-PLAN.md` — departure-windows endpoint response shape (for context on API contract)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/src/api/corridors.ts` — `GET /api/corridors/:corridorId/current` returns `{corridor_id, display_name, congestion_level, avg_travel_time_min, segments[]}` — the frontend fetches this for each of 6 corridors
- `backend/src/api/forecasts.ts` — `GET /api/corridors/:corridorId/forecast` and departure-windows (Phase 5 will use these)
- Corridor IDs defined in `backend/src/db/migrations/004_create-corridors-table.sql` and `ml/src/corridors.py`: `us-101-n`, `us-101-s`, `i-280-n`, `i-280-s`, `bay-bridge-w`, `van-ness-n`
- `backend/src/api/index.ts` — CORS already configured with `ALLOWED_ORIGINS` env var; frontend at `http://localhost:5173` is covered by default

### Established Patterns
- TypeScript throughout the backend (same conventions apply to frontend)
- Environment variables via `.env` files (backend uses `dotenv/config`; frontend uses Vite's `import.meta.env`)
- Node.js project structure: `package.json` in `frontend/` directory

### Integration Points
- Frontend → Backend: REST API calls to `http://localhost:3001/api/` (configurable via `VITE_API_URL`)
- New backend endpoint needed: `GET /api/incidents` — returns recent incidents from `traffic_incidents` table (MAP-03 requires this; currently no incidents endpoint exists)
- `VITE_API_URL` in `frontend/.env.development` → `http://localhost:3001`
- Backend CORS must allow `http://localhost:5173` — already configured in Phase 3

</code_context>

<specifics>
## Specific Ideas

- Dark Mapbox style (`dark-v11`) was chosen to make the color-coded corridor lines (green/amber/red) stand out visually — this is the core UX payoff of the app
- The 6 corridor IDs in `ml/src/corridors.py` and migration 004 are the canonical source — GeoJSON coordinates in `frontend/src/data/corridors.ts` must match these exact IDs
- Phase 3 delivered the API but no frontend — users cannot see anything yet. Phase 4 is the first user-visible output.
- Mobile usability matters: the target includes SF commuters checking traffic on their phones

</specifics>

<deferred>
## Deferred Ideas

- Week-ahead corridor heatmap (7-day × time-slot grid) — Phase 5
- Confidence interval display alongside travel times — Phase 5
- Departure planner UI — Phase 5
- Actual vs predicted accuracy view — Phase 6
- Route drawing / custom corridor selection — v2
- PWA/offline mode — v2
- Dark/light theme toggle — v2 (dark only for MVP)

</deferred>

---

*Phase: 04-map-and-live-view*
*Context gathered: 2026-03-19*
