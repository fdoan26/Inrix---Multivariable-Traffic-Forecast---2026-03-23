---
phase: 1
slug: data-pipeline
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-19
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest (Node.js worker) + pytest (Python, if any ML stubs) |
| **Config file** | jest.config.js (Wave 0 installs) |
| **Quick run command** | `npm test -- --testPathPattern=unit` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --testPathPattern=unit`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 1 | DATA-01, DATA-02 | unit | `npm test -- --testPathPattern=collector` | ❌ W0 | ⬜ pending |
| 1-01-02 | 01 | 1 | DATA-03 | unit | `npm test -- --testPathPattern=schema` | ❌ W0 | ⬜ pending |
| 1-02-01 | 02 | 1 | DATA-04 | unit | `npm test -- --testPathPattern=incidents` | ❌ W0 | ⬜ pending |
| 1-02-02 | 02 | 1 | DATA-05 | unit | `npm test -- --testPathPattern=weather` | ❌ W0 | ⬜ pending |
| 1-03-01 | 03 | 2 | DATA-06, DATA-07 | unit | `npm test -- --testPathPattern=calendar` | ❌ W0 | ⬜ pending |
| 1-03-02 | 03 | 2 | DATA-02 | integration | `npm run test:budget` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/src/workers/__tests__/collector.test.js` — stubs for DATA-01, DATA-02
- [ ] `backend/src/db/__tests__/schema.test.js` — stubs for DATA-03
- [ ] `backend/src/workers/__tests__/incidents.test.js` — stubs for DATA-04
- [ ] `backend/src/workers/__tests__/weather.test.js` — stubs for DATA-05
- [ ] `backend/src/workers/__tests__/calendar.test.js` — stubs for DATA-06, DATA-07
- [ ] `backend/src/workers/__tests__/budget.test.js` — budget tracker integration for DATA-02
- [ ] `jest.config.js` — root Jest config
- [ ] `package.json` — test script `"test": "jest"`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| INRIX API responds with segment speeds for SF bounding box | DATA-01 | Requires live INRIX trial credentials | Run collector once manually, inspect DB row count and field completeness |
| Budget tracker hard-stops at 1600 calls | DATA-02 | Requires simulating weekly quota state | Set `weekly_calls_used = 1601` in DB, trigger job, confirm it aborts with logged reason |
| Incidents stored separately from speed readings | DATA-04 | Requires live INRIX incidents API call | Trigger incident collection, verify rows appear in `traffic_incidents` table, not `segment_speeds` |
| Open-Meteo weather stored with fog/visibility fields | DATA-05 | Requires live Open-Meteo call | Inspect `weather_forecasts` table for `visibility_m` and `weather_code` columns populated |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
