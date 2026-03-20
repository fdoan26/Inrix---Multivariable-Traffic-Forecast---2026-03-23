---
phase: 02-forecasting-model
plan: 02
subsystem: ml
tags: [python, xgboost, quantile-regression, forecast-pipeline, click-cli, joblib]

# Dependency graph
requires:
  - phase: 02-forecasting-model/plan-01
    provides: baseline.py, features.py, corridors.py, config.py, db.py, conftest.py
provides:
  - Forecast orchestrator with two-tier dispatch (baseline vs XGBoost)
  - XGBoost quantile regression model (reg:quantileerror with p10/p50/p90)
  - CLI scripts for forecast refresh, model training, and baseline backfill
  - write_forecasts batch INSERT via cursor.executemany
affects: [02-forecasting-model, 03-api-layer]

# Tech tracking
tech-stack:
  added: [xgboost, joblib, click, scikit-learn]
  patterns: [two-tier forecast dispatch, quantile crossing guard, pinball loss evaluation, batch DELETE+INSERT for forecast writes]

key-files:
  created:
    - ml/src/forecast.py
    - ml/src/model.py
    - ml/scripts/__init__.py
    - ml/scripts/run_forecast.py
    - ml/scripts/train_model.py
    - ml/scripts/backfill_baseline.py
    - ml/tests/test_forecast.py
    - ml/tests/test_model.py
  modified: []

key-decisions:
  - "Two-tier dispatch: baseline when data < 2 weeks, XGBoost when model exists and data >= 2 weeks"
  - "Placeholder forecasts (20min default) generated when no historical data exists for a corridor"
  - "XGBoost modifier columns set to None (modifiers baked into ML features, not explicit multipliers)"

patterns-established:
  - "Forecast dispatch: count_data_weeks + model_exists determines baseline vs XGBoost path"
  - "write_forecasts: DELETE existing corridor+time range then executemany INSERT"
  - "CLI scripts: click command with close_pool() in finally block"
  - "Model serialization: joblib dump/load to MODEL_DIR/{corridor}_{version}.pkl"

requirements-completed: [FORE-05, FORE-08]

# Metrics
duration: 7min
completed: 2026-03-20
---

# Phase 02 Plan 02: Forecast Pipeline Summary

**Two-tier forecast orchestrator (baseline/XGBoost) with quantile regression, batch DB writes, and CLI scripts for 6-hour cron refresh**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-20T05:32:34Z
- **Completed:** 2026-03-20T05:39:25Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- Forecast orchestrator dispatching to baseline or XGBoost based on data availability (2-week threshold)
- XGBoost model with native quantile regression (reg:quantileerror, quantile_alpha=[0.1, 0.5, 0.9]) producing p10/p50/p90
- Quantile crossing guard ensuring p10 <= p50 <= p90 in all predictions
- Pinball loss evaluation for model quality assessment
- 168 hourly forecast rows per corridor per refresh cycle (7 days x 24 hours)
- Three CLI scripts (run_forecast, train_model, backfill_baseline) with click, all runnable via python -m
- 15 new tests (8 forecast + 7 model) all passing, 31 total suite green

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Failing tests for forecast and model** - `4ff0e29` (test)
2. **Task 1 GREEN: Implement forecast orchestrator and model module** - `d64405d` (feat)
3. **Task 2: CLI scripts for forecast refresh, training, backfill** - `90768ed` (feat)

## Files Created/Modified
- `ml/src/forecast.py` - Forecast orchestrator: run_forecast, write_forecasts, count_data_weeks, fetch helpers
- `ml/src/model.py` - XGBoost training, quantile prediction, save/load, evaluate with pinball loss
- `ml/tests/test_forecast.py` - 8 tests: count_data_weeks, dispatch, 168 slots, write/delete, required keys
- `ml/tests/test_model.py` - 7 tests: train, predict quantiles, ordering, save/load, evaluate
- `ml/scripts/__init__.py` - Package init
- `ml/scripts/run_forecast.py` - CLI entry point with --corridor/--horizon, cron schedule documented
- `ml/scripts/train_model.py` - CLI entry point with --corridor/--version, evaluate_model after training
- `ml/scripts/backfill_baseline.py` - One-time baseline computation for all corridors

## Decisions Made
- Two-tier dispatch checks both data_weeks >= MIN_WEEKS_FOR_XGBOOST AND model file exists before using XGBoost
- Placeholder forecasts (20min default) generated when no historical data exists, preventing empty forecast tables
- XGBoost path sets weather/event/school_modifier to None since modifiers are baked into ML features rather than applied as explicit multipliers

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed missing Python packages**
- **Found during:** Task 1 (before test execution)
- **Issue:** xgboost, joblib, click, scikit-learn not installed in system Python
- **Fix:** pip install xgboost joblib click scikit-learn
- **Verification:** All module imports succeed
- **Committed in:** N/A (runtime dependency, not committed)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Package installation necessary for XGBoost functionality. No scope creep.

## Issues Encountered
None beyond the auto-fixed item above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Complete forecast pipeline ready for API integration (Plan 02-03)
- run_forecast CLI ready for cron scheduling (0 */6 * * *)
- XGBoost model training available via train_model CLI when sufficient data accumulates
- All 31 tests green, providing regression safety for API endpoint development

## Self-Check: PASSED

- All 8 files verified present
- All 3 commits verified (4ff0e29, d64405d, 90768ed)

---
*Phase: 02-forecasting-model*
*Completed: 2026-03-20*
