# Phase 4: Map and Live View - Research

**Researched:** 2026-03-19
**Domain:** React frontend scaffold, Mapbox GL JS map rendering, real-time data visualization
**Confidence:** HIGH

## Summary

Phase 4 is the first frontend phase -- it creates the React/Vite/TypeScript application from scratch and delivers an interactive Mapbox map of SF with live corridor speeds and incident markers. The core technical challenges are: (1) scaffolding a new Vite+React+TypeScript app with Tailwind CSS v4, (2) rendering GeoJSON line features with data-driven color styling in react-map-gl, (3) implementing incident markers with click-to-popup interaction, and (4) wiring TanStack Query for 5-minute auto-refresh of speed and incident data.

A critical finding: the existing corridor IDs in the database (migration 004) and ML code are `us-101`, `i-280`, `bay-bridge`, `van-ness`, `19th-ave`, `market-st` -- NOT the directional IDs listed in CONTEXT.md (`us-101-n`, `us-101-s`, etc.). The frontend GeoJSON corridor definitions must use the canonical IDs from the database, or the backend must be updated to support directional IDs. This is flagged as an open question for the planner.

Another finding: Mapbox GL JS does NOT support SVG images directly with `addImage()`. Only PNG, JPG, and WebP are supported at runtime. For incident markers, the simplest approach is to use react-map-gl `<Marker>` components with inline JSX/SVG children (which render as HTML overlays), or render SVGs to canvas ImageData before calling `addImage()`. Using `<Marker>` components is the simpler path for a small number of incidents.

**Primary recommendation:** Use react-map-gl `<Source>` + `<Layer>` for corridor lines (data-driven `line-color` from feature properties), react-map-gl `<Marker>` + `<Popup>` for incident markers, and TanStack Query with `refetchInterval` for live updates. New backend `GET /api/incidents` endpoint needed.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- React 19 + Vite + TypeScript -- `npm create vite@latest frontend -- --template react-ts`
- Frontend lives in `frontend/` at repo root, peer to `backend/` and `ml/`
- Environment variables: `VITE_MAPBOX_TOKEN`, `VITE_API_URL` (defaults to `http://localhost:3001`)
- ESLint flat config + Prettier
- Path alias: `@/` -> `src/`
- Mapbox GL JS 3.20.x + react-map-gl 8.1.x
- Map style: `mapbox://styles/mapbox/dark-v11`
- Initial center: `[-122.4194, 37.7749]`, zoom 12
- Full-viewport map, floating panel (320px left on desktop, bottom sheet on mobile at 768px breakpoint)
- Panel: app title, corridor list with congestion badges, last-updated timestamp, incident layer toggle
- 6 corridors as GeoJSON LineString in `src/data/corridors.ts`
- Corridor colors: free_flow=#10b981, moderate=#f59e0b, heavy=#ef4444, unknown=#6b7280
- Line width 6px, line-cap round, line-join round
- Click corridor: highlight (opacity 1.0 vs 0.6), show details in panel
- TanStack Query v5 with 5-minute refetchInterval, stale-while-revalidate
- Zustand store for UI state: selectedCorridorId, incidentsVisible, lastUpdated
- Incident markers with click-to-popup (type, description, delay, timestamp)
- Incidents layer toggleable, default on
- Tailwind CSS v4 via `@tailwindcss/vite` plugin
- No component library -- plain Tailwind
- Dark theme (bg-gray-900, text-gray-100) matching dark-v11
- Vitest + React Testing Library for component tests
- No E2E tests for MVP

### Claude's Discretion
- Exact GeoJSON coordinates for each corridor (approximate real SF road paths)
- Incident icon SVG designs
- Exact Tailwind class combinations for panel styling
- Whether to add a "Refresh now" button vs auto-only

### Deferred Ideas (OUT OF SCOPE)
- Week-ahead corridor heatmap -- Phase 5
- Confidence interval display -- Phase 5
- Departure planner UI -- Phase 5
- Actual vs predicted accuracy view -- Phase 6
- Route drawing / custom corridor selection -- v2
- PWA/offline mode -- v2
- Dark/light theme toggle -- v2
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| MAP-01 | Interactive Mapbox GL JS map centered on SF showing major corridors | react-map-gl `<Map>` with `<Source type="geojson">` + `<Layer type="line">` for corridor rendering; GeoJSON LineString features with hard-coded coordinates; data-driven `line-color` using `['get', 'color']` expression |
| MAP-02 | Live segment speed overlay -- color-coded by congestion level (green/yellow/red) | TanStack Query with `refetchInterval: 300000` fetching `/api/corridors/:id/current`; update GeoJSON feature `color` property based on `congestion_level` response field; stale-while-revalidate prevents flicker |
| MAP-03 | INRIX incidents layer -- crashes, construction, congestion alerts displayed on map | New backend `GET /api/incidents` endpoint; react-map-gl `<Marker>` components with custom JSX children for icons; `<Popup>` on click; toggleable via Zustand `incidentsVisible` state |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react | 19.2.4 | UI framework | Current stable. Locked by CONTEXT.md. |
| vite | 8.0.1 | Build tool | Current stable. Native ESM, fast HMR. |
| typescript | 5.9.x | Type safety | Matches backend. Locked by CONTEXT.md. |
| mapbox-gl | 3.20.0 | Map rendering | WebGL vector maps. Locked by CONTEXT.md. |
| react-map-gl | 8.1.0 | React Mapbox wrapper | Declarative `<Map>`, `<Source>`, `<Layer>`. Locked. |
| @tanstack/react-query | 5.91.2 | Server state | Auto-refetch, stale-while-revalidate. Locked. |
| zustand | 5.0.12 | UI state | Lightweight store for selectedCorridor, incidentsVisible. Locked. |
| tailwindcss | 4.2.2 | Styling | Utility-first CSS. v4 uses `@tailwindcss/vite` plugin. Locked. |
| @tailwindcss/vite | 4.2.2 | Vite plugin for Tailwind v4 | First-party Vite integration. Required for Tailwind v4. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @types/mapbox-gl | latest | TypeScript types for mapbox-gl | Required for TS compilation |
| @testing-library/react | 16.3.2 | Component testing | All component tests |
| vitest | 4.1.0 | Test runner | Locked by CONTEXT.md |
| jsdom | latest | DOM environment for tests | Required by vitest for React component tests |
| date-fns | 4.1.x | Date formatting | "Updated 2 min ago" relative time display |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `<Marker>` for incidents | Symbol layer with `addImage` | Symbol layers perform better with 100+ markers, but require PNG/canvas rendering (no SVG). `<Marker>` is simpler for <50 incidents and supports React JSX children directly. |
| Zustand | React Context | Context causes full-subtree re-renders on state change. Zustand provides fine-grained subscriptions. Locked decision. |
| Tailwind CSS v4 | Tailwind CSS v3 | v4 uses `@import "tailwindcss"` in CSS (no `tailwind.config.js`). Breaking change from v3 patterns. Use v4 as locked. |

**Installation:**
```bash
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install mapbox-gl react-map-gl @tanstack/react-query zustand tailwindcss @tailwindcss/vite date-fns
npm install -D @types/mapbox-gl @testing-library/react @testing-library/jest-dom jsdom
```

## Architecture Patterns

### Recommended Project Structure
```
frontend/
├── src/
│   ├── main.tsx                 # Entry point, QueryClientProvider
│   ├── App.tsx                  # Map + Panel layout
│   ├── index.css                # @import "tailwindcss"
│   ├── data/
│   │   └── corridors.ts         # GeoJSON FeatureCollection for 6 corridors
│   ├── components/
│   │   ├── MapView.tsx           # <Map> + <Source> + <Layer> + incident markers
│   │   ├── CorridorPanel.tsx     # Floating side/bottom panel
│   │   ├── IncidentMarker.tsx    # Individual incident <Marker> + icon
│   │   ├── IncidentPopup.tsx     # Popup content for clicked incident
│   │   └── __tests__/
│   │       ├── CorridorPanel.test.tsx
│   │       └── IncidentPopup.test.tsx
│   ├── hooks/
│   │   ├── useCorridorSpeeds.ts  # TanStack Query hook for corridor speeds
│   │   └── useIncidents.ts       # TanStack Query hook for incidents
│   ├── store/
│   │   └── mapStore.ts           # Zustand: selectedCorridorId, incidentsVisible, lastUpdated
│   ├── types/
│   │   └── api.ts                # TypeScript interfaces for API responses
│   └── lib/
│       └── api.ts                # fetch wrapper with VITE_API_URL base
├── .env.development              # VITE_MAPBOX_TOKEN, VITE_API_URL
├── vite.config.ts
├── tsconfig.json
└── package.json
```

### Pattern 1: Data-Driven Corridor Line Colors
**What:** Single GeoJSON source with color property per feature, rendered with `['get', 'color']` expression.
**When to use:** When each line feature needs independent color based on data.
**Example:**
```typescript
// Source: https://docs.mapbox.com/mapbox-gl-js/example/data-driven-lines/
// corridors.ts - GeoJSON FeatureCollection
import type { FeatureCollection } from 'geojson';

export const CONGESTION_COLORS = {
  free_flow: '#10b981',
  moderate: '#f59e0b',
  heavy: '#ef4444',
  unknown: '#6b7280',
} as const;

export type CongestionLevel = keyof typeof CONGESTION_COLORS;

export function createCorridorFeatureCollection(
  corridorData: Array<{ id: string; congestionLevel: CongestionLevel }>
): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: corridorData.map(c => ({
      type: 'Feature',
      properties: {
        corridorId: c.id,
        color: CONGESTION_COLORS[c.congestionLevel],
      },
      geometry: CORRIDOR_GEOMETRIES[c.id], // pre-defined LineString coordinates
    })),
  };
}
```

```tsx
// MapView.tsx
import { Source, Layer } from 'react-map-gl/mapbox';
import type { LineLayer } from 'mapbox-gl';

const corridorLayer: LineLayer = {
  id: 'corridors',
  type: 'line',
  paint: {
    'line-color': ['get', 'color'],
    'line-width': 6,
    'line-opacity': 0.6,  // default; selected corridor gets 1.0
  },
  layout: {
    'line-cap': 'round',
    'line-join': 'round',
  },
};

// Inside MapView component:
<Source id="corridors" type="geojson" data={corridorGeoJSON}>
  <Layer {...corridorLayer} />
</Source>
```

### Pattern 2: Corridor Selection with Opacity Highlight
**What:** Use `interactiveLayerIds` on `<Map>` to detect clicks, then update paint expression for selected corridor.
**When to use:** Click-to-select pattern on map features.
**Example:**
```tsx
// Source: https://visgl.github.io/react-map-gl/docs/get-started/adding-custom-data
<Map
  interactiveLayerIds={['corridors']}
  onClick={(e) => {
    const feature = e.features?.[0];
    if (feature?.properties?.corridorId) {
      setSelectedCorridor(feature.properties.corridorId);
    }
  }}
>
```

To highlight the selected corridor, use a `case` expression for `line-opacity`:
```typescript
'line-opacity': selectedCorridorId
  ? ['case',
      ['==', ['get', 'corridorId'], selectedCorridorId], 1.0,
      0.6
    ]
  : 0.8,
```

### Pattern 3: React Markers for Incidents (not Symbol Layer)
**What:** Use `<Marker>` components for incidents instead of symbol layers.
**When to use:** Small number of markers (<50) where custom React content is needed.
**Why:** Mapbox GL JS `addImage()` does NOT support SVG at runtime (only PNG/JPG/WebP). Using `<Marker>` with JSX children allows inline SVG without conversion.
**Example:**
```tsx
// Source: https://visgl.github.io/react-map-gl/docs/api-reference/mapbox/marker
import { Marker, Popup } from 'react-map-gl/mapbox';

{incidents.map(incident => (
  <Marker
    key={incident.incident_id}
    longitude={incident.longitude}
    latitude={incident.latitude}
    onClick={(e) => {
      e.originalEvent.stopPropagation();
      setSelectedIncident(incident);
    }}
  >
    <IncidentIcon type={incident.incident_type} />
  </Marker>
))}

{selectedIncident && (
  <Popup
    longitude={selectedIncident.longitude}
    latitude={selectedIncident.latitude}
    onClose={() => setSelectedIncident(null)}
    closeOnClick={false}
  >
    <IncidentPopup incident={selectedIncident} />
  </Popup>
)}
```

### Pattern 4: Tailwind CSS v4 Setup (Breaking Change from v3)
**What:** Tailwind v4 uses a Vite plugin and CSS `@import` instead of `tailwind.config.js`.
**When to use:** All new Tailwind v4 projects.
**Example:**
```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
});
```

```css
/* src/index.css */
@import "tailwindcss";
```

**No `tailwind.config.js` needed.** Tailwind v4 auto-detects content files. Custom theme values use CSS variables in `index.css` with `@theme` directive if needed.

### Pattern 5: TanStack Query for Auto-Refresh
**What:** `useQuery` with `refetchInterval` for live speed data.
**Example:**
```typescript
// hooks/useCorridorSpeeds.ts
import { useQueries } from '@tanstack/react-query';

const CORRIDOR_IDS = ['us-101', 'i-280', 'bay-bridge', 'van-ness', '19th-ave', 'market-st'];

export function useCorridorSpeeds() {
  return useQueries({
    queries: CORRIDOR_IDS.map(id => ({
      queryKey: ['corridor-speed', id],
      queryFn: () => fetchCorridorSpeed(id),
      refetchInterval: 5 * 60 * 1000,
      staleTime: 4 * 60 * 1000,
    })),
  });
}
```

### Anti-Patterns to Avoid
- **Imperative Mapbox API in React:** Do NOT call `map.addSource()`, `map.addLayer()` directly. Use react-map-gl's declarative `<Source>` and `<Layer>` components -- they handle the lifecycle correctly.
- **Multiple Sources for one dataset:** Do NOT create a separate `<Source>` per corridor. Use one GeoJSON FeatureCollection with all corridors as features, one `<Source>`, and data-driven styling.
- **Symbol layer for small icon sets:** Do NOT use symbol layers with `addImage()` for incident icons when you need SVG. Use `<Marker>` components with JSX children instead. Symbol layers require raster images.
- **Tailwind v3 config pattern:** Do NOT create `tailwind.config.js` -- Tailwind v4 uses the Vite plugin and CSS `@import "tailwindcss"` directly. No PostCSS config needed either.
- **Context API for global state:** Do NOT use React Context for selectedCorridor or incidentsVisible. Context triggers full subtree re-renders. Zustand is locked.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Server state caching | Custom fetch + useState + useEffect | TanStack Query | Handles refetch intervals, stale-while-revalidate, deduplication, error retries automatically |
| GeoJSON rendering on Mapbox | Imperative `map.addSource/addLayer` | react-map-gl `<Source>` + `<Layer>` | Declarative components handle React lifecycle (mount/unmount/update) correctly |
| Relative time display | Custom "X min ago" logic | date-fns `formatDistanceToNow()` | Handles edge cases (seconds, minutes, hours) and localization |
| API base URL management | String concatenation | Vite `import.meta.env.VITE_API_URL` | Environment-specific, build-time replacement |
| Map interaction state | Custom event handlers + refs | `interactiveLayerIds` + `onClick` on `<Map>` | react-map-gl handles hit testing, feature detection automatically |

**Key insight:** The frontend stack (react-map-gl, TanStack Query, Zustand) was chosen specifically because these libraries handle the complex state management that would otherwise require hundreds of lines of custom code.

## Common Pitfalls

### Pitfall 1: Mapbox GL CSS Not Imported
**What goes wrong:** Map renders as a gray box or has missing controls/labels.
**Why it happens:** `mapbox-gl` requires its CSS stylesheet to be imported separately.
**How to avoid:** Add `import 'mapbox-gl/dist/mapbox-gl.css'` in `main.tsx` or `App.tsx` before any map components.
**Warning signs:** Map container is visible but tiles don't render, or controls are unstyled.

### Pitfall 2: Mapbox Access Token Not Set
**What goes wrong:** Map shows "Unauthorized" error or blank tiles.
**Why it happens:** Mapbox GL JS requires an access token set before first render.
**How to avoid:** Set `mapboxAccessToken` prop on `<Map>` component using `import.meta.env.VITE_MAPBOX_TOKEN`. Add `.env.development` to `.gitignore`.
**Warning signs:** Console error about missing or invalid access token.

### Pitfall 3: react-map-gl Import Path for Mapbox
**What goes wrong:** TypeScript errors or wrong map library loaded.
**Why it happens:** react-map-gl v8 has separate entry points: `react-map-gl/mapbox` for mapbox-gl v3, `react-map-gl/maplibre` for MapLibre GL.
**How to avoid:** Always import from `react-map-gl/mapbox` (NOT bare `react-map-gl`).
**Warning signs:** Import errors, unexpected MapLibre behavior, or missing Mapbox-specific features.

### Pitfall 4: GeoJSON Data Reference Stability
**What goes wrong:** Map re-renders every frame, extreme performance degradation.
**Why it happens:** Passing a new GeoJSON object literal to `<Source data={...}>` on every render causes Mapbox to re-parse the entire source.
**How to avoid:** Memoize GeoJSON data with `useMemo`. Only create a new object when corridor speed data actually changes.
**Warning signs:** High CPU usage, janky map interactions, React DevTools showing constant re-renders.

### Pitfall 5: Tailwind v4 No Config File
**What goes wrong:** Custom classes not working, utilities not generated.
**Why it happens:** Developer creates a `tailwind.config.js` (v3 pattern) which is ignored by Tailwind v4.
**How to avoid:** Tailwind v4 uses `@import "tailwindcss"` in CSS and `@tailwindcss/vite` plugin. Custom theme values go in CSS with `@theme` directive. No JS config file.
**Warning signs:** Tailwind utilities not applied, build warnings about config.

### Pitfall 6: Corridor ID Mismatch
**What goes wrong:** Frontend fetches corridor data but gets 404s from the API.
**Why it happens:** CONTEXT.md specifies directional IDs (`us-101-n`, `us-101-s`) but the database (migration 004) and ML code use non-directional IDs (`us-101`, `i-280`, etc.).
**How to avoid:** The frontend MUST use the canonical corridor IDs from the database: `us-101`, `i-280`, `bay-bridge`, `van-ness`, `19th-ave`, `market-st`. See Open Questions section.
**Warning signs:** 404 errors from `/api/corridors/:id/current`.

### Pitfall 7: Vite Path Alias Requires tsconfig Update
**What goes wrong:** TypeScript compiler cannot resolve `@/` imports.
**Why it happens:** Vite's `resolve.alias` only affects the bundler, not `tsc`. TypeScript needs matching `paths` in `tsconfig.json`.
**How to avoid:** Add `"paths": { "@/*": ["./src/*"] }` to `tsconfig.json` `compilerOptions` alongside the Vite alias.

## Code Examples

### Backend: New Incidents Endpoint (MAP-03)
```typescript
// Source: Pattern derived from existing corridors.ts router
// backend/src/api/incidents.ts
import { Router } from 'express';
import { query } from '../db/connection.js';

export const incidentsRouter = Router();

incidentsRouter.get('/', async (_req, res) => {
  const result = await query(
    `SELECT incident_id, incident_type, severity, latitude, longitude,
            short_desc, long_desc, delay_from_typical_min, recorded_at, status
     FROM incidents
     WHERE recorded_at > NOW() - INTERVAL '24 hours'
       AND status != 'Cleared'
     ORDER BY recorded_at DESC
     LIMIT 100`,
    []
  );
  res.json({ incidents: result.rows });
});
```

Mount in `api/index.ts`:
```typescript
import { incidentsRouter } from './incidents.js';
app.use('/api/incidents', incidentsRouter);
```

### Frontend: Zustand Store
```typescript
// Source: Zustand v5 pattern (store with selectors)
// src/store/mapStore.ts
import { create } from 'zustand';

interface MapState {
  selectedCorridorId: string | null;
  incidentsVisible: boolean;
  lastUpdated: Date | null;
  selectCorridor: (id: string | null) => void;
  toggleIncidents: () => void;
  setLastUpdated: (date: Date) => void;
}

export const useMapStore = create<MapState>((set) => ({
  selectedCorridorId: null,
  incidentsVisible: true,
  lastUpdated: null,
  selectCorridor: (id) => set({ selectedCorridorId: id }),
  toggleIncidents: () => set((s) => ({ incidentsVisible: !s.incidentsVisible })),
  setLastUpdated: (date) => set({ lastUpdated: date }),
}));
```

### Frontend: Map Component with Corridors
```tsx
// Source: react-map-gl docs + Mapbox data-driven styling
// src/components/MapView.tsx
import Map, { Source, Layer, Popup } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { LineLayer } from 'mapbox-gl';

const corridorLineLayer: LineLayer = {
  id: 'corridor-lines',
  type: 'line',
  paint: {
    'line-color': ['get', 'color'],
    'line-width': 6,
    'line-opacity': 0.8,
  },
  layout: {
    'line-cap': 'round',
    'line-join': 'round',
  },
};

export function MapView() {
  return (
    <Map
      mapboxAccessToken={import.meta.env.VITE_MAPBOX_TOKEN}
      initialViewState={{
        longitude: -122.4194,
        latitude: 37.7749,
        zoom: 12,
      }}
      style={{ width: '100vw', height: '100vh' }}
      mapStyle="mapbox://styles/mapbox/dark-v11"
      interactiveLayerIds={['corridor-lines']}
      onClick={handleMapClick}
    >
      <Source id="corridors" type="geojson" data={corridorGeoJSON}>
        <Layer {...corridorLineLayer} />
      </Source>
      {/* Incident markers rendered here */}
    </Map>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Tailwind v3 + PostCSS + tailwind.config.js | Tailwind v4 + `@tailwindcss/vite` + `@import "tailwindcss"` | Jan 2025 (v4.0) | No config file, no PostCSS. Vite plugin handles everything. |
| react-map-gl bare import | `react-map-gl/mapbox` entry point | react-map-gl 8.x | Separate entry points for mapbox-gl vs maplibre |
| Create React App | Vite | 2023 (CRA deprecated) | Vite is the uncontested default |
| Redux for all state | TanStack Query (server) + Zustand (UI) | 2023-2024 | Separation of server state from UI state eliminates most Redux use cases |

**Deprecated/outdated:**
- `tailwind.config.js` -- replaced by CSS `@theme` directive in Tailwind v4
- Bare `import from 'react-map-gl'` -- use `react-map-gl/mapbox` for mapbox-gl v3
- `mapbox-gl` v2 -- v3 is current, react-map-gl 8.x requires v3

## Open Questions

1. **Corridor ID Mismatch**
   - What we know: Database has `us-101`, `i-280`, `bay-bridge`, `van-ness`, `19th-ave`, `market-st` (6 non-directional). CONTEXT.md specifies `us-101-n`, `us-101-s`, `i-280-n`, `i-280-s`, `bay-bridge-w`, `van-ness-n` (6 directional).
   - What's unclear: Whether the CONTEXT.md intended to replace the database IDs or just describe visual segments.
   - Recommendation: Use the **existing database IDs** (`us-101`, `i-280`, etc.) since the API already works with these. The GeoJSON can represent the visual path of each corridor without changing IDs. If directional corridors are needed later, that's a migration + API change that should be a separate task. The planner should use the 6 existing IDs.

2. **Incident Type Mapping**
   - What we know: INRIX incident_type is a SMALLINT (1=Construction, 2=Event, 3=Flow, 4=Incident). CONTEXT.md mentions three icon categories: crash, construction, congestion.
   - Recommendation: Map type 4 (Incident) -> crash icon, type 1 (Construction) -> construction icon, type 3 (Flow) -> congestion icon, type 2 (Event) -> congestion icon. This mapping should be defined in a shared constant.

3. **Refresh Now Button**
   - Claude's discretion area. Recommendation: Add a small "Refresh now" button next to the timestamp. It's trivial to implement (one TanStack Query `refetch()` call) and gives users agency. Cost is ~5 lines of code.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.0 + React Testing Library 16.3.2 |
| Config file | `frontend/vitest.config.ts` (Wave 0 -- needs creation) |
| Quick run command | `cd frontend && npx vitest run --reporter=verbose` |
| Full suite command | `cd frontend && npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MAP-01 | Map renders with correct initial viewport and corridor source | unit | `cd frontend && npx vitest run src/components/__tests__/MapView.test.tsx -x` | No -- Wave 0 |
| MAP-01 | Corridor GeoJSON has 6 features with valid LineString geometries | unit | `cd frontend && npx vitest run src/data/__tests__/corridors.test.ts -x` | No -- Wave 0 |
| MAP-02 | Speed data mapped to correct congestion colors | unit | `cd frontend && npx vitest run src/hooks/__tests__/useCorridorSpeeds.test.ts -x` | No -- Wave 0 |
| MAP-02 | Panel displays corridor list with congestion badges | unit | `cd frontend && npx vitest run src/components/__tests__/CorridorPanel.test.tsx -x` | No -- Wave 0 |
| MAP-03 | Incident popup shows type, description, delay, timestamp | unit | `cd frontend && npx vitest run src/components/__tests__/IncidentPopup.test.tsx -x` | No -- Wave 0 |
| MAP-03 | Backend incidents endpoint returns recent non-cleared incidents | unit | `cd backend && npx vitest run src/api/__tests__/incidents.test.ts -x` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `cd frontend && npx vitest run --reporter=verbose`
- **Per wave merge:** `cd frontend && npx vitest run && cd ../backend && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `frontend/vitest.config.ts` -- Vitest configuration with jsdom environment, path aliases
- [ ] `frontend/src/test/setup.ts` -- Test setup file (import `@testing-library/jest-dom`)
- [ ] `frontend/tsconfig.json` -- Must include path alias `@/*` -> `./src/*`
- [ ] `frontend/src/components/__tests__/CorridorPanel.test.tsx` -- covers MAP-01, MAP-02
- [ ] `frontend/src/components/__tests__/IncidentPopup.test.tsx` -- covers MAP-03
- [ ] `frontend/src/data/__tests__/corridors.test.ts` -- covers MAP-01 GeoJSON validation
- [ ] `backend/src/api/__tests__/incidents.test.ts` -- covers MAP-03 endpoint
- [ ] `backend/src/api/incidents.ts` -- new endpoint needed

## Sources

### Primary (HIGH confidence)
- npm registry -- all package versions verified via `npm view` on 2026-03-19 (react 19.2.4, mapbox-gl 3.20.0, react-map-gl 8.1.0, @tanstack/react-query 5.91.2, zustand 5.0.12, tailwindcss 4.2.2, vite 8.0.1, vitest 4.1.0, @testing-library/react 16.3.2)
- [Mapbox GL JS data-driven lines example](https://docs.mapbox.com/mapbox-gl-js/example/data-driven-lines/) -- `['get', 'color']` expression pattern
- [react-map-gl Adding Custom Data](https://visgl.github.io/react-map-gl/docs/get-started/adding-custom-data) -- `<Source>` + `<Layer>` component API
- [react-map-gl Marker API](https://visgl.github.io/react-map-gl/docs/api-reference/mapbox/marker) -- Marker props (longitude, latitude, onClick, children)
- [Mapbox addImage generated example](https://docs.mapbox.com/mapbox-gl-js/example/add-image-generated/) -- confirmed addImage requires ImageData, not SVG

### Secondary (MEDIUM confidence)
- [Tailwind CSS v4 official blog](https://tailwindcss.com/blog/tailwindcss-v4) -- v4 setup pattern with Vite plugin
- [Tailwind CSS Vite installation](https://tailwindcss.com/docs) -- official installation guide
- Existing project codebase (`backend/src/api/`, `backend/src/db/migrations/`, `ml/src/corridors.py`) -- canonical corridor IDs and API patterns

### Tertiary (LOW confidence)
- None -- all findings verified against primary or secondary sources

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all versions verified via npm registry, locked by CONTEXT.md
- Architecture: HIGH -- patterns verified via official docs (Mapbox, react-map-gl, Tailwind v4)
- Pitfalls: HIGH -- SVG limitation confirmed via Mapbox docs, corridor ID mismatch confirmed via codebase inspection

**Research date:** 2026-03-19
**Valid until:** 2026-04-19 (stable libraries, low churn)
