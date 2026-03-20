---
phase: 02-forecasting-model
plan: 01
subsystem: ml
tags: [python, pandas, numpy, psycopg2, timescaledb, forecasting, baseline]

# Dependency graph
requires:
  - phase: 01-data-pipeline
    provides: speed_readings, weather_forecasts, calendar_flags tables in TimescaleDB
provides:
  - ml/ Python package with baseline forecast (p10/p50/p90)
  - Weather, event, and school multiplicative modifiers
  - Bootstrap confidence interval computation
  - Corridor-to-segment mapping for 6 SF corridors
  - DB migrations for forecasts and corridors tables
affects: [02-forecasting-model, 03-api-layer]

# Tech tracking
tech-stack:
  added: [pandas, numpy, psycopg2-binary, pytest]
  patterns: [ThreadedConnectionPool context manager, empirical percentile baseline, multiplicative modifiers]

key-files:
  created:
    - ml/pyproject.toml
    - ml/src/baseline.py
    - ml/src/features.py
    - ml/src/confidence.py
    - ml/src/corridors.py
    - ml/src/db.py
    - ml/src/config.py
    - ml/tests/conftest.py
    - ml/tests/test_baseline.py
    - ml/tests/test_features.py
    - ml/tests/test_confidence.py
    - backend/src/db/migrations/003_create-forecasts-table.sql
    - backend/src/db/migrations/004_create-corridors-table.sql
  modified: []

key-decisions:
  - "Lazy DATABASE_URL evaluation in config.py to allow module import without DB connection"
  - "Multiplicative modifiers (e.g., 1.15 = 15% slowdown) rather than additive deltas"
  - "TMC_PLACEHOLDER segment IDs to be replaced when Phase 1 data is collected"

patterns-established:
  - "Corridor config: frozen dataclass with id/name/segment_ids tuple"
  - "DB module: ThreadedConnectionPool with get_conn() context manager"
  - "Modifiers: compute_*_modifier() functions returning float multipliers"
  - "Baseline: groupby (corridor, day_of_week, hour) with np.percentile for p10/p50/p90"

requirements-completed: [FORE-01, FORE-02, FORE-03, FORE-04, FORE-06]

# Metrics
duration: 5min
completed: 2026-03-20
---

# Phase 02 Plan 01: ML Scaffold Summary

**Historical-average baseline forecast with p10/p50/p90 percentiles, weather/event/school modifiers, and bootstrap CI in Python ml/ package**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-20T05:25:07Z
- **Completed:** 2026-03-20T05:30:00Z
- **Tasks:** 2
- **Files modified:** 17

## Accomplishments
- Python ml/ project scaffold with pyproject.toml, requirements, and 6-corridor configuration
- Baseline forecast computing p10/p50/p90 travel times from historical percentiles per (corridor, day_of_week, hour)
- Weather (rain/fog), event (Giants/Warriors/concerts), and school calendar modifiers as multiplicative factors
- Bootstrap confidence interval module with monotonicity enforcement
- DB migrations for forecasts hypertable and corridors lookup table
- 16 unit tests covering baseline output, modifier behavior, and CI properties

## Task Commits

Each task was committed atomically:

1. **Task 1: Python project scaffold, DB migrations, corridor config, and database module** - `d6b1a3b` (feat)
2. **Task 2 RED: Failing tests for baseline, features, confidence** - `1261bcc` (test)
3. **Task 2 GREEN: Implement baseline, features, confidence modules** - `6d2bf9c` (feat)

## Files Created/Modified
- `ml/pyproject.toml` - Project metadata with Python 3.12+ and ML dependencies
- `ml/requirements.txt` - Pinned dependency versions
- `ml/src/config.py` - Lazy DB URL, forecast horizon (168h), model dir configuration
- `ml/src/db.py` - psycopg2 ThreadedConnectionPool with context manager
- `ml/src/corridors.py` - 6 SF corridor definitions with segment_ids placeholder tuples
- `ml/src/baseline.py` - compute_baseline() producing p10/p50/p90 from historical data
- `ml/src/features.py` - Weather/event/school modifiers and feature row builder
- `ml/src/confidence.py` - bootstrap_ci() with quantile crossing prevention
- `ml/tests/conftest.py` - Shared fixtures: 4-week speed data, weather, calendar, mock DB
- `ml/tests/test_baseline.py` - 5 tests: columns, p50=predicted, monotonicity, 168 rows, peak vs off-peak
- `ml/tests/test_features.py` - 7 tests: rain, fog, event, school, clear, feature row completeness
- `ml/tests/test_confidence.py` - 4 tests: return type, monotonicity, narrow/wide intervals
- `backend/src/db/migrations/003_create-forecasts-table.sql` - Forecasts hypertable with compression
- `backend/src/db/migrations/004_create-corridors-table.sql` - Corridors lookup with 6 rows

## Decisions Made
- Made DATABASE_URL evaluation lazy (function call) instead of module-level check, so config.py can be imported for constants without requiring a live database connection
- Used multiplicative modifiers (1.15 = 15% slowdown) per RESEARCH.md recommendation for explainability
- TMC_PLACEHOLDER values in corridors will be replaced when actual INRIX segment IDs are available from Phase 1 data collection

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Lazy DATABASE_URL in config.py**
- **Found during:** Task 1 (verification step)
- **Issue:** Plan specified eager DATABASE_URL check at import time, but verification command imports config without DB
- **Fix:** Changed to get_database_url() function for lazy evaluation
- **Files modified:** ml/src/config.py
- **Verification:** All imports succeed without DATABASE_URL set
- **Committed in:** d6b1a3b (Task 1 commit)

**2. [Rule 3 - Blocking] Installed missing Python packages**
- **Found during:** Task 1 (verification step)
- **Issue:** psycopg2-binary, pandas, numpy, pytest not installed in system Python
- **Fix:** pip install psycopg2-binary pandas numpy pytest
- **Verification:** All module imports succeed
- **Committed in:** N/A (runtime dependency, not committed)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both fixes necessary for imports to work. No scope creep.

## Issues Encountered
None beyond the auto-fixed items above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Baseline forecast module ready for integration into forecast orchestrator (Plan 02-02)
- XGBoost model training module needed next (Plan 02-02)
- Corridor segment IDs need population from Phase 1 INRIX data
- All 16 tests green, providing regression safety for future work

## Self-Check: PASSED

- All 17 files verified present
- All 3 commits verified (d6b1a3b, 1261bcc, 6d2bf9c)

---
*Phase: 02-forecasting-model*
*Completed: 2026-03-20*
