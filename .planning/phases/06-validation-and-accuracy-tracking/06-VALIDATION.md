---
phase: 6
slug: validation-and-accuracy-tracking
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-20
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework (Backend)** | Vitest 4.1.0 (existing) |
| **Framework (Frontend)** | Vitest 4.1.0 + React Testing Library 16.3.2 (existing) |
| **Config file (Backend)** | `backend/vitest.config.ts` |
| **Config file (Frontend)** | `frontend/vitest.config.ts` |
| **Quick run command (backend)** | `cd backend && npx vitest run --reporter=verbose` |
| **Quick run command (frontend)** | `cd frontend && npx vitest run --reporter=verbose` |
| **Full suite command** | `cd backend && npx vitest run && cd ../frontend && npx vitest run` |
| **Estimated runtime** | ~45 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick command for the relevant project (backend or frontend)
- **After every plan wave:** Run full suite command
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 45 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 6-01-01 | 06-01 | 1 | VAL-01 | unit | `cd backend && npx vitest run src/collectors/__tests__/outcome-logger.test.ts --reporter=verbose` | no (W0) | ⬜ pending |
| 6-01-02 | 06-01 | 1 | VAL-02 | integration | `cd backend && npx vitest run src/api/__tests__/accuracy.test.ts --reporter=verbose` | no (W0) | ⬜ pending |
| 6-01-03 | 06-01 | 2 | VAL-02 | unit | `cd frontend && npx vitest run src/components/__tests__/AccuracyDashboard.test.tsx src/components/__tests__/CorridorPanel.test.tsx --reporter=verbose` | no (W0) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/src/collectors/__tests__/outcome-logger.test.ts` — stubs for VAL-01: computes outcomes, idempotent upsert, empty speed_readings handling
- [ ] `backend/src/api/__tests__/accuracy.test.ts` — stubs for VAL-02: GET /api/accuracy response shape, corridor_id filter, empty state (no outcomes), cache hit
- [ ] `frontend/src/components/__tests__/AccuracyDashboard.test.tsx` — stubs for VAL-02 UI: corridor rows render, empty state message, expand/collapse day-of-week
- [ ] Extend `frontend/src/components/__tests__/CorridorPanel.test.tsx` — add Accuracy tab render test

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Outcome logger populates forecast_outcomes with real data | VAL-01 | Requires live DB with accumulated speed_readings and forecasts | `npx tsx backend/src/collectors/outcome-logger.ts`, then `SELECT COUNT(*) FROM forecast_outcomes` — verify count > 0 |
| Accuracy dashboard shows real metrics in browser | VAL-02 | Requires live DB with forecast_outcomes rows | `cd frontend && npm run dev`, open localhost:5173, click Accuracy tab, verify corridor rows with MAE/MAPE values |
| Trend labels update after 7+ days of outcomes | VAL-02 | Requires 7 days of accumulated data | After 7 days: verify trend shows "Improving"/"Degrading"/"Stable" based on recent vs prior MAPE |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 45s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
