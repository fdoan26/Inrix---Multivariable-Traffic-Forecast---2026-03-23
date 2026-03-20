---
phase: 5
slug: departure-planner-and-week-ahead-view
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-19
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.0 + React Testing Library 16.3.2 |
| **Config file** | `frontend/vitest.config.ts` (existing) |
| **Quick run command** | `cd frontend && npx vitest run --reporter=verbose` |
| **Full suite command** | `cd frontend && npx vitest run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd frontend && npx vitest run --reporter=verbose`
- **After every plan wave:** Run `cd frontend && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 5-01-01 | 05-01 | 1 | MAP-04 | unit | `cd frontend && npx vitest run src/lib/__tests__/congestion.test.ts src/lib/__tests__/heatmap.test.ts --reporter=verbose` | no (W0) | ⬜ pending |
| 5-01-02 | 05-01 | 1 | MAP-04, MAP-05 | unit | `cd frontend && npx vitest run src/components/__tests__/WeekHeatmap.test.tsx --reporter=verbose` | no (W0) | ⬜ pending |
| 5-01-03 | 05-01 | 1 | MAP-04 | unit | `cd frontend && npx vitest run src/components/__tests__/CorridorPanel.test.tsx --reporter=verbose` | yes (extend) | ⬜ pending |
| 5-02-01 | 05-02 | 2 | PLAN-01 | unit | `cd frontend && npx vitest run src/components/__tests__/DeparturePlannerForm.test.tsx --reporter=verbose` | no (W0) | ⬜ pending |
| 5-02-02 | 05-02 | 2 | PLAN-02, PLAN-03 | unit | `cd frontend && npx vitest run src/components/__tests__/DepartureResults.test.tsx --reporter=verbose` | no (W0) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `frontend/src/lib/__tests__/congestion.test.ts` — tests for deriveCongestionLevel (p50/p10 ratio thresholds: <=1.2 free_flow, <=1.5 moderate, >1.5 heavy)
- [ ] `frontend/src/lib/__tests__/heatmap.test.ts` — tests for forecastToGridCoord (ISO → dayIndex/hour mapping) and buildHeatmapGrid (sparse data, out-of-range filtering)
- [ ] `frontend/src/components/__tests__/WeekHeatmap.test.tsx` — tests for MAP-04 grid rendering (7 day columns, 17 hour rows), MAP-05 title tooltip content
- [ ] `frontend/src/components/__tests__/DeparturePlannerForm.test.tsx` — tests for PLAN-01 form fields (corridor dropdown, date input, time input), Zod validation error display
- [ ] `frontend/src/components/__tests__/DepartureResults.test.tsx` — tests for PLAN-02 result list rendering, PLAN-03 best result amber highlight and reason text

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Heatmap colors visually match corridor map polyline colors | MAP-04 | Requires browser + live data | `cd frontend && npm run dev`, select corridor, verify heatmap cell colors match the map polyline color for same congestion level |
| Tooltip appears on heatmap cell hover | MAP-05 | Requires browser interaction | Hover over populated heatmap cell, verify native browser tooltip shows "p10: Xm \| p50: Ym \| p90: Zm" |
| Departure planner returns real results from live backend | PLAN-02 | Requires live DB with forecast data | Submit planner form with valid corridor + future arrival time, verify ordered departure windows appear |
| Reason text matches actual modifier data | PLAN-03 | Requires live modifiers in DB | Submit during a period with known weather/event modifier, verify reason text appears |
| Mobile layout: Plan tab usable on 375px screen | PLAN-01 | Requires browser resize | Resize to 375px wide, switch to Plan tab, verify form fields are full-width and readable |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
