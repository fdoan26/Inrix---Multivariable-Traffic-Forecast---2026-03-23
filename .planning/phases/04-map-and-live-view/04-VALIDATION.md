---
phase: 4
slug: map-and-live-view
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-19
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework (Frontend)** | Vitest 4.1.0 + React Testing Library 16.3.2 |
| **Framework (Backend)** | Vitest 4.1.0 (existing) |
| **Config file** | `frontend/vitest.config.ts` (Wave 0), `backend/vitest.config.ts` (existing) |
| **Quick run command (frontend)** | `cd frontend && npx vitest run --reporter=verbose` |
| **Quick run command (backend)** | `cd backend && npx vitest run src/api/__tests__/incidents.test.ts --reporter=verbose` |
| **Full suite command** | `cd frontend && npx vitest run && cd ../backend && npx vitest run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick command for the relevant project
- **After every plan wave:** Run full suite command
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 4-01-01 | 04-01 | 1 | MAP-01 | unit | `cd frontend && npx vitest run src/data/__tests__/corridors.test.ts --reporter=verbose` | no (W0) | ⬜ pending |
| 4-01-02 | 04-01 | 1 | MAP-02 | unit | `cd frontend && npx vitest run src/hooks/__tests__/useCorridorSpeeds.test.ts --reporter=verbose` | no (W0) | ⬜ pending |
| 4-01-03 | 04-01 | 1 | MAP-01, MAP-02 | unit | `cd frontend && npx vitest run src/components/__tests__/CorridorPanel.test.tsx --reporter=verbose` | no (W0) | ⬜ pending |
| 4-02-01 | 04-02 | 2 | MAP-03 | unit | `cd backend && npx vitest run src/api/__tests__/incidents.test.ts --reporter=verbose` | no (W0) | ⬜ pending |
| 4-02-02 | 04-02 | 2 | MAP-03 | unit | `cd frontend && npx vitest run src/components/__tests__/IncidentPopup.test.tsx --reporter=verbose` | no (W0) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `frontend/vitest.config.ts` — Vitest config with jsdom environment and path aliases
- [ ] `frontend/src/test/setup.ts` — Test setup file importing `@testing-library/jest-dom`
- [ ] `frontend/src/data/__tests__/corridors.test.ts` — tests for MAP-01 GeoJSON validation (6 features, valid LineStrings, correct IDs)
- [ ] `frontend/src/hooks/__tests__/useCorridorSpeeds.test.ts` — tests for MAP-02 hook behavior (6 queries, CORRIDOR_IDS keys, refetchInterval)
- [ ] `frontend/src/components/__tests__/CorridorPanel.test.tsx` — tests for MAP-01 corridor list rendering, MAP-02 congestion badge colors
- [ ] `frontend/src/components/__tests__/IncidentPopup.test.tsx` — tests for MAP-03 popup content
- [ ] `backend/src/api/__tests__/incidents.test.ts` — tests for new incidents endpoint
- [ ] `backend/src/api/incidents.ts` — new backend incidents endpoint

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Map renders with Mapbox tiles in browser | MAP-01 | Requires MAPBOX_TOKEN + browser | `cd frontend && npm run dev`, open localhost:5173, verify map loads with dark style |
| Corridor polylines appear on map | MAP-01, MAP-02 | Requires Mapbox rendering | Verify 6 colored lines visible on SF map |
| Speed colors update after 5 minutes | MAP-02 | Requires live DB + 5-min wait | Check panel "Updated X min ago" cycles, verify color changes when congestion changes |
| Incident markers appear and popup works | MAP-03 | Requires live INRIX incidents data | Verify markers on map, click one to see popup with type + description |
| Mobile layout works on small screen | MAP-01 | Requires browser resize | Resize to 375px wide, verify panel slides to bottom, map fills screen |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
