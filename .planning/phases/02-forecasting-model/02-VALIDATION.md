---
phase: 2
slug: forecasting-model
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-19
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework (Node.js)** | vitest (existing from Phase 1) |
| **Framework (Python)** | pytest 8.x |
| **Config file** | `jest.config.js` (existing), `ml/pyproject.toml` (Wave 0 installs) |
| **Quick run command (Node)** | `cd backend && npx vitest run --reporter=verbose` |
| **Quick run command (Python)** | `cd ml && python -m pytest -q` |
| **Full suite command** | `cd backend && npx vitest run && cd ../ml && python -m pytest` |
| **Estimated runtime** | ~45 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick command for the relevant language
- **After every plan wave:** Run full suite command
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 45 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 2-01-01 | 02-01 | 1 | FORE-01, FORE-06 | unit | `cd ml && python -m pytest tests/test_baseline.py -v` | ❌ W0 | ⬜ pending |
| 2-01-02 | 02-01 | 1 | FORE-02, FORE-03, FORE-04 | unit | `cd ml && python -m pytest tests/test_features.py -v` | ❌ W0 | ⬜ pending |
| 2-02-01 | 02-02 | 2 | FORE-05, FORE-07 | unit | `cd ml && python -m pytest tests/test_forecast_writer.py -v` | ❌ W0 | ⬜ pending |
| 2-02-02 | 02-02 | 2 | FORE-08 | unit | `cd ml && python -m pytest tests/test_scheduler.py -v` | ❌ W0 | ⬜ pending |
| 2-03-01 | 02-03 | 3 | FORE-01, FORE-06 | integration | `cd ml && python -m pytest tests/test_model.py -v` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `ml/pyproject.toml` — Python project with xgboost, scikit-learn, pandas, psycopg2-binary, pytest deps
- [ ] `ml/tests/__init__.py` — test package init
- [ ] `ml/tests/test_baseline.py` — stubs for FORE-01, FORE-06 (baseline model + p10/p50/p90)
- [ ] `ml/tests/test_features.py` — stubs for FORE-02, FORE-03, FORE-04 (weather/event/school modifiers)
- [ ] `ml/tests/test_forecast_writer.py` — stubs for FORE-05, FORE-07 (forecast table writes, corridor coverage)
- [ ] `ml/tests/test_scheduler.py` — stubs for FORE-08 (refresh cadence)
- [ ] `ml/tests/test_model.py` — integration stubs for FORE-01, FORE-06 (full pipeline)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Forecasts written to forecasts hypertable for all 6 corridors | FORE-05 | Requires live TimescaleDB | Run forecast script, query `SELECT DISTINCT corridor_id FROM forecasts` — should return 6 rows |
| Short-term 0-2hr INRIX Duration forecast stored | FORE-07 | Requires live INRIX credentials | Check speed_readings.duration_minutes is non-null for recent rows |
| Weather modifier visibly affects predictions (rainy vs clear day) | FORE-02 | Requires data with weather variation | Compare p50 for same corridor/hour on rainy vs clear day — rainy should be higher |
| 6-hour refresh cycle runs automatically | FORE-08 | Requires cron execution | Check job_log has forecast_refresh entries ≥4 per day after cron is active |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 45s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
