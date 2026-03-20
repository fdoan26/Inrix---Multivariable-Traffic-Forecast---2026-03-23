# Phase 2: Forecasting Model - Research

**Researched:** 2026-03-19
**Domain:** Python ML forecasting pipeline (XGBoost, TimescaleDB, cron-based batch inference)
**Confidence:** HIGH

## Summary

Phase 2 builds a Python forecasting pipeline in a new `ml/` directory at the repo root. The pipeline reads from Phase 1's existing TimescaleDB tables (speed_readings, weather_forecasts, calendar_flags), generates week-ahead corridor-level travel time forecasts with p10/p50/p90 confidence intervals, and writes results back to a new `forecasts` hypertable. A separate cron script refreshes forecasts every 6 hours.

The cold-start strategy is two-tier: a historical average baseline (day-of-week x hour x corridor) ships immediately with no training data required, computing confidence intervals from historical variance. When 2+ weeks of speed_readings accumulate, XGBoost with native quantile regression (`reg:quantileerror` objective) takes over, producing p10/p50/p90 predictions from a single model. The Node.js backend also gains two new API endpoints (API-01: current corridor speeds, API-02: week-ahead forecast) that read directly from the database.

**Primary recommendation:** Use XGBoost 3.2's native multi-quantile regression (`quantile_alpha=[0.1, 0.5, 0.9]`) to produce confidence intervals from a single model, avoiding the complexity of training separate models or implementing bootstrap methods.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Deploy historical average baseline immediately (day-of-week x hour x corridor) -- no training data needed, ships on day 1
- Upgrade to XGBoost (scikit-learn wrapper) when 2+ weeks of speed_readings data has accumulated
- Python microservice owns all feature assembly -- weather/events/school joined in Python before training/inference
- Weekly manual retrain for MVP -- trigger script, no automated scheduler
- Node <-> Python communication via shared TimescaleDB -- Python reads raw data tables, writes to forecasts table; Node only reads forecasts table. No HTTP between services.
- Script-based Python service -- cron-invoked scripts (not a long-running FastAPI server) for MVP simplicity
- Model artifacts stored on local filesystem in `ml/models/` directory (.pkl files)
- `ml/` directory at repo root, peer to `backend/`, with own `requirements.txt` and `pyproject.toml`
- Bootstrap method from historical variance (day x hour x corridor) for baseline confidence intervals
- 80% prediction interval (p10 to p90)
- Store p10_minutes, p50_minutes, p90_minutes as separate columns in forecasts table
- Forecasts table columns: corridor_id, forecast_for (timestamp), predicted_minutes (= p50), p10_minutes, p50_minutes, p90_minutes, model_version, weather_modifier, event_modifier, school_modifier, created_at
- Forecast refresh: separate Python cron script every 6 hours
- INRIX Duration (short-term 0-2hr): called from Node.js collector at collection time, duration_minutes stored in speed_readings table
- API-01 (current corridor speeds) and API-02 (week-ahead forecast) both built in Phase 2

### Claude's Discretion
- Specific XGBoost hyperparameter defaults
- Python script entry points and CLI argument structure
- Exact corridor_id format (string slug vs integer)
- Walk-forward validation split ratio for model evaluation
- TimescaleDB migration numbering (003+)

### Deferred Ideas (OUT OF SCOPE)
- Automated XGBoost retraining pipeline -- manual trigger sufficient for MVP; automation is v2
- FastAPI server for Python ML service -- script-based cron is sufficient for MVP
- MLflow experiment tracking -- overkill for MVP
- Real-time model drift detection -- v2 feature
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FORE-01 | Baseline forecast from historical average speed (corridor x day-of-week x hour) | Historical average baseline module; SQL aggregation from speed_readings; corridor-to-segment mapping |
| FORE-02 | Weather modifier applied -- rain/fog reduce predicted speed | Weather feature join from weather_forecasts table; modifier multiplier stored per forecast row |
| FORE-03 | Event modifier applied -- flagged event days shift speeds | Calendar_flags join; event_type feature encoding; modifier stored per forecast row |
| FORE-04 | School calendar modifier -- school days vs breaks shift morning rush | Calendar_flags school_day boolean feature; modifier stored per forecast row |
| FORE-05 | Week-ahead forecast for 6 major SF corridors | 6 corridors x 168 hourly slots = 1,008 forecast rows per refresh; corridors table or config mapping segments to corridors |
| FORE-06 | Confidence intervals (p10/p50/p90) displayed as range + most-likely | Baseline: bootstrap from historical variance; XGBoost: native quantile regression (reg:quantileerror) |
| FORE-07 | Short-term (0-2hr) forecast uses INRIX Duration parameter | Node.js collector stores duration_minutes in speed_readings; API-01 returns this for short-term window |
| FORE-08 | Forecast refreshed every 6 hours minimum | Python cron script entry point; cron schedule `0 */6 * * *` |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Python | 3.14.x | Runtime | Installed on system; XGBoost 3.2, scikit-learn 1.8, pandas 3.0 all have Python 3.14 wheels |
| XGBoost | 3.2.0 | Gradient boosting with native quantile regression | `reg:quantileerror` objective with `quantile_alpha` produces p10/p50/p90 from a single model. Best tabular ML for this data scale. |
| scikit-learn | 1.8.0 | ML utilities (preprocessing, TimeSeriesSplit, metrics) | Standard ML glue; XGBoost 3.x implements sklearn estimator API |
| pandas | 3.0.1 | Feature engineering, data manipulation | Standard for tabular data wrangling; merge speed/weather/calendar by timestamp |
| numpy | 2.4.3 | Numerical computing | Required by pandas/sklearn/xgboost; used for bootstrap variance calculations |
| psycopg2-binary | 2.9.11 | PostgreSQL driver | Direct DB access matching Node.js pg pattern; ThreadedConnectionPool for connection reuse |
| joblib | 1.5.3 | Model serialization | Standard for sklearn-compatible model persistence (.pkl files) |
| click | 8.3.1 | CLI argument parsing | Clean entry points for scripts (forecast, train, backfill) |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| ruff | latest | Linting/formatting | All Python files; replaces flake8+black+isort |
| pytest | latest | Testing | Unit tests for feature engineering, model prediction, DB queries |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Bootstrap CI (baseline) | Quantile regression for baseline too | Bootstrap is simpler when you have no model -- just percentiles of historical data |
| XGBoost quantile regression | 3 separate XGBRegressor models (one per quantile) | Single model with `quantile_alpha=[0.1, 0.5, 0.9]` is cleaner and faster than 3 models |
| psycopg2 | psycopg3 (psycopg) | psycopg3 is newer but psycopg2 is proven, matches project STACK.md, simpler for script-based usage |
| click | argparse | click is cleaner for multi-command CLI; argparse is stdlib but verbose |
| joblib | pickle | joblib handles numpy arrays more efficiently; standard for sklearn model serialization |

**Installation:**
```bash
cd ml/
python -m venv .venv
pip install xgboost==3.2.0 scikit-learn==1.8.0 pandas==3.0.1 numpy==2.4.3 psycopg2-binary==2.9.11 joblib==1.5.3 click==8.3.1
pip install pytest ruff
```

## Architecture Patterns

### Recommended Project Structure
```
ml/
├── pyproject.toml            # Project metadata, dependencies
├── requirements.txt          # Pinned dependencies for reproducibility
├── src/
│   ├── __init__.py
│   ├── config.py             # Corridor definitions, DB URL, hyperparams
│   ├── db.py                 # psycopg2 connection pool, query helpers
│   ├── corridors.py          # Segment-to-corridor mapping (6 corridors)
│   ├── features.py           # Feature engineering pipeline
│   ├── baseline.py           # Historical average baseline model
│   ├── model.py              # XGBoost training + quantile prediction
│   ├── forecast.py           # Orchestrator: assemble features -> predict -> write
│   └── confidence.py         # Bootstrap CI for baseline; quantile CI for XGBoost
├── scripts/
│   ├── run_forecast.py       # CLI entry point: `python -m scripts.run_forecast`
│   ├── train_model.py        # CLI entry point: manual retrain trigger
│   └── backfill_baseline.py  # One-time: compute baseline from existing data
├── models/                   # Serialized model artifacts (.pkl)
│   └── .gitkeep
└── tests/
    ├── __init__.py
    ├── conftest.py           # Fixtures: sample DataFrames, mock DB
    ├── test_features.py      # Feature engineering unit tests
    ├── test_baseline.py      # Baseline forecast tests
    ├── test_model.py         # XGBoost model tests
    ├── test_forecast.py      # Integration: forecast pipeline
    └── test_confidence.py    # Confidence interval tests
```

### Pattern 1: Corridor-to-Segment Mapping

**What:** A configuration mapping that groups INRIX TMC segment IDs into the 6 named corridors.
**When to use:** Every query that aggregates speed_readings by corridor.

```python
# src/corridors.py
from dataclasses import dataclass

@dataclass(frozen=True)
class Corridor:
    id: str          # slug: "us-101", "i-280", "bay-bridge", "van-ness", "19th-ave", "market-st"
    name: str        # display: "US-101", "I-280", etc.
    segment_ids: tuple[str, ...]  # INRIX TMC codes belonging to this corridor

CORRIDORS: dict[str, Corridor] = {
    "us-101": Corridor(id="us-101", name="US-101", segment_ids=("TMC1", "TMC2", ...)),
    "i-280": Corridor(id="i-280", name="I-280", segment_ids=("TMC3", "TMC4", ...)),
    "bay-bridge": Corridor(id="bay-bridge", name="Bay Bridge Approach", segment_ids=(...)),
    "van-ness": Corridor(id="van-ness", name="Van Ness Ave", segment_ids=(...)),
    "19th-ave": Corridor(id="19th-ave", name="19th Ave", segment_ids=(...)),
    "market-st": Corridor(id="market-st", name="Market St", segment_ids=(...)),
}
```

**Recommendation for corridor_id format:** Use lowercase slug strings (`"us-101"`, `"bay-bridge"`) -- human-readable, URL-safe, and easy to use as config keys. Avoid integers because they carry no semantic meaning.

### Pattern 2: Two-Tier Forecast Strategy

**What:** The system checks data availability and dispatches to either the baseline model or XGBoost.
**When to use:** Every forecast run.

```python
# src/forecast.py
import logging
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

MIN_WEEKS_FOR_XGBOOST = 2

def run_forecast(conn, corridor_id: str, horizon_hours: int = 168):
    """Generate forecasts for a corridor. Uses baseline or XGBoost based on data availability."""
    data_weeks = count_data_weeks(conn, corridor_id)

    if data_weeks >= MIN_WEEKS_FOR_XGBOOST and model_exists(corridor_id):
        logger.info("Using XGBoost model (%.1f weeks of data)", data_weeks)
        forecasts = predict_xgboost(conn, corridor_id, horizon_hours)
    else:
        logger.info("Using baseline model (%.1f weeks of data)", data_weeks)
        forecasts = predict_baseline(conn, corridor_id, horizon_hours)

    write_forecasts(conn, forecasts)
    return len(forecasts)
```

### Pattern 3: Historical Average Baseline with Bootstrap CI

**What:** For each (corridor, day_of_week, hour), compute the median travel time from speed_readings and derive p10/p90 from the empirical distribution of historical observations.
**When to use:** Cold-start period before XGBoost is trained.

```python
# src/baseline.py
import numpy as np
import pandas as pd

def compute_baseline(df: pd.DataFrame) -> pd.DataFrame:
    """
    Compute baseline forecast from historical speed_readings.

    Input df columns: corridor_id, recorded_at, travel_time_min
    Output: corridor_id, day_of_week, hour, p10_minutes, p50_minutes, p90_minutes
    """
    df = df.copy()
    df["day_of_week"] = df["recorded_at"].dt.dayofweek
    df["hour"] = df["recorded_at"].dt.hour

    baseline = df.groupby(["corridor_id", "day_of_week", "hour"])["travel_time_min"].agg(
        p10=lambda x: np.percentile(x, 10),
        p50=lambda x: np.percentile(x, 50),
        p90=lambda x: np.percentile(x, 90),
    ).reset_index()

    baseline.rename(columns={"p10": "p10_minutes", "p50": "p50_minutes", "p90": "p90_minutes"}, inplace=True)
    baseline["predicted_minutes"] = baseline["p50_minutes"]
    return baseline
```

### Pattern 4: XGBoost Native Quantile Regression

**What:** A single XGBRegressor with `objective="reg:quantileerror"` and `quantile_alpha=[0.1, 0.5, 0.9]` that outputs p10/p50/p90 predictions in one pass.
**When to use:** After 2+ weeks of data accumulate.

```python
# src/model.py
# Source: https://xgboost.readthedocs.io/en/stable/python/examples/quantile_regression.html
import xgboost as xgb
import numpy as np

QUANTILES = np.array([0.1, 0.5, 0.9])

def train_quantile_model(X_train, y_train) -> xgb.XGBRegressor:
    """Train a single XGBoost model that predicts p10, p50, p90 simultaneously."""
    model = xgb.XGBRegressor(
        objective="reg:quantileerror",
        quantile_alpha=QUANTILES,
        tree_method="hist",
        n_estimators=200,
        max_depth=6,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=42,
    )
    model.fit(X_train, y_train)
    return model

def predict_quantiles(model: xgb.XGBRegressor, X: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Returns (p10, p50, p90) arrays."""
    preds = model.predict(X)  # shape: (n_samples, 3)
    return preds[:, 0], preds[:, 1], preds[:, 2]
```

### Pattern 5: Feature Assembly from TimescaleDB

**What:** Python reads speed_readings + weather_forecasts + calendar_flags, joins by timestamp, and produces a feature matrix.
**When to use:** Before every training or inference run.

```python
# src/features.py
FEATURE_COLUMNS = [
    "hour_of_day",
    "day_of_week",
    "is_weekend",
    "is_school_day",
    "has_event",
    "event_type_encoded",
    "temp_c",
    "precip_mm",
    "visibility_m",
    "weather_code",
    "historical_avg_minutes",  # INRIX baseline as a feature
]

def build_features(conn, corridor_id: str, start: datetime, end: datetime) -> pd.DataFrame:
    """Assemble feature matrix by joining speed, weather, calendar data."""
    speeds = fetch_corridor_speeds(conn, corridor_id, start, end)
    weather = fetch_weather(conn, start, end)
    calendar = fetch_calendar(conn, start, end)

    # Merge on hourly buckets
    df = speeds.merge(weather, on="hour_bucket", how="left")
    df = df.merge(calendar, left_on="date", right_on="flag_date", how="left")

    # Encode time features
    df["hour_of_day"] = df["hour_bucket"].dt.hour
    df["day_of_week"] = df["hour_bucket"].dt.dayofweek
    df["is_weekend"] = df["day_of_week"].isin([5, 6]).astype(int)

    # Fill missing modifiers
    df["is_school_day"] = df["school_day"].fillna(True).astype(int)
    df["has_event"] = df["event_name"].notna().astype(int)

    return df
```

### Anti-Patterns to Avoid

- **Training 3 separate XGBoost models for p10/p50/p90:** XGBoost 3.x supports `quantile_alpha` as a list, producing all quantiles from one model. Separate models risk quantile crossing (p10 > p50) and triple the training/inference cost.
- **Computing features at prediction time via complex SQL joins:** Assemble features in Python with pandas, not in SQL. SQL joins across hypertables with time bucketing are hard to debug and maintain. Let SQL do simple aggregations; let Python do feature engineering.
- **Storing model artifacts in the database:** Use the filesystem (`ml/models/`). Models are binary blobs that change infrequently. Database storage adds serialization complexity for no benefit.
- **Running the forecast script as root or with unbounded DB connections:** Use a connection pool with `maxconn=5` for the cron script. It only needs a few connections.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Quantile prediction intervals | Bootstrap resampling for XGBoost predictions | XGBoost `reg:quantileerror` with `quantile_alpha` | Native implementation handles edge cases; single model avoids quantile crossing |
| Time-series train/test split | Manual date filtering | `sklearn.model_selection.TimeSeriesSplit` | Prevents data leakage; walk-forward validation built in |
| Model serialization | Custom pickle wrapper | `joblib.dump` / `joblib.load` | Handles numpy arrays efficiently; standard for sklearn pipelines |
| Connection pooling | Manual connect/disconnect per query | `psycopg2.pool.ThreadedConnectionPool` | Thread-safe, handles connection lifecycle |
| CLI argument parsing | sys.argv manual parsing | `click` decorators | Clean multi-command CLI, type validation, help text |
| Feature scaling | Manual normalization code | `sklearn.preprocessing.StandardScaler` | XGBoost does not require scaling, but if added later for other models, use sklearn |

**Key insight:** XGBoost 3.x's native quantile regression eliminates the biggest hand-rolling risk (bootstrap CI for XGBoost). The baseline model still uses empirical percentiles from historical data, which is straightforward and appropriate.

## Common Pitfalls

### Pitfall 1: Data Leakage in Time-Series Split
**What goes wrong:** Using random train/test split leaks future data into training. Model appears accurate but fails in production.
**Why it happens:** `sklearn.train_test_split` defaults to `shuffle=True`. Most tutorials show random splits.
**How to avoid:** Always use `TimeSeriesSplit` or manual chronological cutoffs. Train on weeks 1-N, validate on week N+1. Never shuffle time-series data.
**Warning signs:** R-squared > 0.95 on first evaluation; dramatic accuracy drop on first live day.

### Pitfall 2: Quantile Crossing in Predictions
**What goes wrong:** Model predicts p10 > p50 or p50 > p90 for some rows, producing nonsensical intervals like "best case 40 min, worst case 35 min."
**Why it happens:** Quantile regression models can produce crossing quantiles, especially with insufficient training data or extrapolation.
**How to avoid:** Post-process predictions: `p10 = min(p10, p50)`, `p90 = max(p50, p90)`. XGBoost's native multi-quantile reduces crossing but does not eliminate it.
**Warning signs:** Negative interval widths (p90 - p10 < 0) in forecast output.

### Pitfall 3: Segment-to-Corridor Aggregation Errors
**What goes wrong:** Averaging speeds across corridor segments instead of summing travel times. Speed averaging gives wrong travel times for corridors with varying segment lengths.
**Why it happens:** It is intuitive to average speeds, but a corridor's total travel time is the sum of segment travel times (distance/speed per segment), not distance/(average speed).
**How to avoid:** Use `travel_time_min` from speed_readings (already computed by INRIX) and SUM across segments in a corridor. Never average speeds to derive travel time.
**Warning signs:** Predicted corridor travel times that are unrealistically low or high relative to individual segment times.

### Pitfall 4: Missing Data in Feature Joins
**What goes wrong:** Left joins between speed_readings and weather_forecasts produce NaN rows when weather data is missing for some hours. Model training fails or produces garbage predictions.
**Why it happens:** Weather forecasts may not cover all hours, or there is a timing mismatch between speed collection and forecast fetch.
**How to avoid:** Fill missing weather with the most recent available forecast (forward-fill). Fill missing calendar flags with defaults (school_day=True during school year, event=None). Log and monitor null rates.
**Warning signs:** High NaN percentage in feature matrix; model accuracy drops when weather module has collection issues.

### Pitfall 5: Forgetting to Map future Forecast Hours to Features
**What goes wrong:** The model is trained on historical data where all features (speed, weather, events) are observed. At prediction time for future hours, historical speed is not available -- only weather forecasts and calendar data.
**Why it happens:** Training features include observed speed averages which are not available for future time slots.
**How to avoid:** For the XGBoost model, use ONLY forward-looking features at prediction time: hour_of_day, day_of_week, is_weekend, weather forecast, calendar flags, and the historical average for that (corridor, day, hour) slot. Do not include any features that require observed speed data for the prediction hour.
**Warning signs:** Model works on backtest but throws errors or returns NaN for future dates.

### Pitfall 6: Cron Script Fails Silently
**What goes wrong:** The 6-hourly forecast cron fails (DB connection timeout, missing model file) but nobody notices because cron swallows stderr.
**Why it happens:** Cron jobs run unattended. Python exceptions go to stderr which cron discards by default.
**How to avoid:** Log to a file (`ml/logs/forecast.log`). Write a status row to `job_log` table (already exists from Phase 1) at start and end of each run. Set up a simple staleness check: if `forecasts` table has no rows newer than 12 hours, something is wrong.
**Warning signs:** Stale forecasts served to users; `job_log` shows no recent forecast runs.

## Code Examples

### Database Connection Pattern (matching Node.js pattern)

```python
# src/db.py
import os
from contextlib import contextmanager
from psycopg2.pool import ThreadedConnectionPool

_pool: ThreadedConnectionPool | None = None

def get_pool() -> ThreadedConnectionPool:
    global _pool
    if _pool is None:
        _pool = ThreadedConnectionPool(
            minconn=1,
            maxconn=5,
            dsn=os.environ["DATABASE_URL"],
        )
    return _pool

@contextmanager
def get_conn():
    """Get a connection from the pool, return it when done."""
    pool = get_pool()
    conn = pool.getconn()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        pool.putconn(conn)
```

### Forecasts Table Migration (003)

```sql
-- Migration 003: Create forecasts hypertable
CREATE TABLE forecasts (
  corridor_id      TEXT        NOT NULL,
  forecast_for     TIMESTAMPTZ NOT NULL,
  predicted_minutes REAL       NOT NULL,  -- = p50
  p10_minutes      REAL        NOT NULL,
  p50_minutes      REAL        NOT NULL,
  p90_minutes      REAL        NOT NULL,
  model_version    TEXT        NOT NULL,  -- 'baseline-v1', 'xgboost-v1', etc.
  weather_modifier REAL,                  -- multiplicative factor applied (e.g., 1.15 for rain)
  event_modifier   REAL,                  -- multiplicative factor for events
  school_modifier  REAL,                  -- multiplicative factor for school days
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

SELECT create_hypertable('forecasts', 'forecast_for',
  chunk_time_interval => INTERVAL '7 days'
);

CREATE INDEX idx_forecasts_corridor_time
  ON forecasts (corridor_id, forecast_for DESC);

-- Compression for forecasts older than 30 days
ALTER TABLE forecasts SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'corridor_id',
  timescaledb.compress_orderby = 'forecast_for DESC'
);

SELECT add_compression_policy('forecasts', INTERVAL '30 days');
```

### Corridors Configuration Table Migration (004)

```sql
-- Migration 004: Corridor-to-segment mapping table
CREATE TABLE corridors (
  corridor_id  TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  segment_ids  TEXT[] NOT NULL  -- array of INRIX TMC segment IDs
);

INSERT INTO corridors (corridor_id, display_name, segment_ids) VALUES
  ('us-101',      'US-101',              ARRAY['TMC_PLACEHOLDER']),
  ('i-280',       'I-280',               ARRAY['TMC_PLACEHOLDER']),
  ('bay-bridge',  'Bay Bridge Approach',  ARRAY['TMC_PLACEHOLDER']),
  ('van-ness',    'Van Ness Ave',         ARRAY['TMC_PLACEHOLDER']),
  ('19th-ave',    '19th Ave',             ARRAY['TMC_PLACEHOLDER']),
  ('market-st',   'Market St',            ARRAY['TMC_PLACEHOLDER']);
```

Note: TMC segment IDs must be populated from actual INRIX data collected in Phase 1. Query `SELECT DISTINCT segment_id FROM speed_readings` to find available segments, then map them to corridors.

### CLI Entry Point Pattern

```python
# scripts/run_forecast.py
import click
import logging
from src.db import get_conn
from src.forecast import run_forecast
from src.config import CORRIDORS

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

@click.command()
@click.option("--corridor", type=str, default=None, help="Specific corridor ID (default: all)")
@click.option("--horizon", type=int, default=168, help="Forecast horizon in hours (default: 168 = 7 days)")
def main(corridor: str | None, horizon: int):
    """Generate forecasts for SF corridors."""
    corridors = [corridor] if corridor else list(CORRIDORS.keys())

    with get_conn() as conn:
        for cid in corridors:
            logger.info("Forecasting %s (%d hours)", cid, horizon)
            count = run_forecast(conn, cid, horizon)
            logger.info("Wrote %d forecast rows for %s", count, cid)

if __name__ == "__main__":
    main()
```

### Writing Forecasts to TimescaleDB

```python
# src/forecast.py (partial -- write function)
def write_forecasts(conn, forecasts: list[dict]):
    """Batch insert forecast rows, replacing existing forecasts for the same corridor/time."""
    if not forecasts:
        return

    with conn.cursor() as cur:
        # Delete existing forecasts for this corridor and time range
        corridor_id = forecasts[0]["corridor_id"]
        min_time = min(f["forecast_for"] for f in forecasts)
        max_time = max(f["forecast_for"] for f in forecasts)

        cur.execute(
            "DELETE FROM forecasts WHERE corridor_id = %s AND forecast_for BETWEEN %s AND %s",
            (corridor_id, min_time, max_time),
        )

        # Batch insert
        args = []
        for f in forecasts:
            args.append((
                f["corridor_id"], f["forecast_for"],
                f["predicted_minutes"], f["p10_minutes"], f["p50_minutes"], f["p90_minutes"],
                f["model_version"], f.get("weather_modifier"), f.get("event_modifier"), f.get("school_modifier"),
            ))

        cur.executemany(
            """INSERT INTO forecasts
            (corridor_id, forecast_for, predicted_minutes, p10_minutes, p50_minutes, p90_minutes,
             model_version, weather_modifier, event_modifier, school_modifier)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
            args,
        )
```

### Walk-Forward Validation

```python
# src/model.py (partial -- validation)
from sklearn.model_selection import TimeSeriesSplit

def evaluate_model(X, y, n_splits=3):
    """Walk-forward cross-validation. Returns pinball loss per fold."""
    tscv = TimeSeriesSplit(n_splits=n_splits)
    fold_losses = []

    for fold, (train_idx, val_idx) in enumerate(tscv.split(X)):
        X_train, X_val = X[train_idx], X[val_idx]
        y_train, y_val = y[train_idx], y[val_idx]

        model = train_quantile_model(X_train, y_train)
        p10, p50, p90 = predict_quantiles(model, X_val)

        # Pinball loss for each quantile
        loss_10 = pinball_loss(y_val, p10, quantile=0.1)
        loss_50 = pinball_loss(y_val, p50, quantile=0.5)
        loss_90 = pinball_loss(y_val, p90, quantile=0.9)

        fold_losses.append({"fold": fold, "p10_loss": loss_10, "p50_loss": loss_50, "p90_loss": loss_90})

    return fold_losses

def pinball_loss(y_true, y_pred, quantile):
    """Pinball (quantile) loss -- proper scoring rule for quantile regression."""
    errors = y_true - y_pred
    return np.mean(np.where(errors >= 0, quantile * errors, (quantile - 1) * errors))
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 3 separate models for p10/p50/p90 | Single model with `quantile_alpha` list | XGBoost 2.0 (2023) | Simpler training, reduced quantile crossing |
| Pinball loss via custom objective | Built-in `reg:quantileerror` objective | XGBoost 2.0 (2023) | No custom loss function needed |
| psycopg2 only option for PostgreSQL | psycopg3 available (async, pipeline mode) | 2021+ | psycopg2 still preferred for simple script-based usage |
| pandas 1.x with numpy 1.x | pandas 3.0 requires numpy 2.x | 2024 | Do not pin numpy to 1.x |
| sklearn HistGradientBoosting for quantiles | XGBoost native quantile is more flexible | 2023+ | XGBoost allows multi-quantile in one model |

**Deprecated/outdated:**
- `sklearn.model_selection.train_test_split` with shuffle for time series -- always use TimeSeriesSplit
- XGBoost custom quantile loss via `obj` parameter -- replaced by `reg:quantileerror`
- `pickle.dump` for model persistence -- use `joblib.dump` (handles numpy arrays better)

## Open Questions

1. **Actual INRIX TMC segment IDs for each corridor**
   - What we know: Phase 1 collects speed_readings with segment_id values from INRIX bounding-box queries
   - What's unclear: Which specific segment_ids map to which corridors. Need to query `SELECT DISTINCT segment_id FROM speed_readings` to discover available segments.
   - Recommendation: First task should query existing data and create the corridor mapping. If no data exists yet, use placeholder mapping that is updated once Phase 1 runs.

2. **Travel time computation from segments**
   - What we know: `travel_time_min` is stored per segment in speed_readings (from INRIX)
   - What's unclear: Whether summing segment travel times gives a reasonable corridor-level travel time, or if INRIX provides corridor-level times directly.
   - Recommendation: Sum `travel_time_min` across segments per corridor per time bucket. Validate against intuition (e.g., US-101 through SF should be ~15-40 min depending on time).

3. **Modifier column semantics**
   - What we know: Forecasts table has weather_modifier, event_modifier, school_modifier columns
   - What's unclear: Whether these are multiplicative factors (e.g., 1.15 = 15% slowdown) or additive deltas (e.g., +3 minutes)
   - Recommendation: Use multiplicative factors. Baseline travel time * weather_modifier * event_modifier * school_modifier = adjusted prediction. Store the modifier value for explainability ("Slow due to: rain +15%").

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest (latest) |
| Config file | `ml/pyproject.toml` [tool.pytest.ini_options] |
| Quick run command | `cd ml && python -m pytest tests/ -x -q` |
| Full suite command | `cd ml && python -m pytest tests/ -v --tb=short` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FORE-01 | Baseline forecast from historical averages | unit | `cd ml && python -m pytest tests/test_baseline.py -x` | Wave 0 |
| FORE-02 | Weather modifier applied to predictions | unit | `cd ml && python -m pytest tests/test_features.py::test_weather_modifier -x` | Wave 0 |
| FORE-03 | Event modifier applied to predictions | unit | `cd ml && python -m pytest tests/test_features.py::test_event_modifier -x` | Wave 0 |
| FORE-04 | School calendar modifier applied | unit | `cd ml && python -m pytest tests/test_features.py::test_school_modifier -x` | Wave 0 |
| FORE-05 | Week-ahead forecast for 6 corridors (168 slots each) | integration | `cd ml && python -m pytest tests/test_forecast.py::test_full_corridor_forecast -x` | Wave 0 |
| FORE-06 | Confidence intervals (p10/p50/p90) | unit | `cd ml && python -m pytest tests/test_confidence.py -x` | Wave 0 |
| FORE-07 | Short-term INRIX Duration in API-01 | unit (Node) | `cd backend && npx vitest run src/api/__tests__/corridors.test.ts` | Wave 0 |
| FORE-08 | Forecast refresh mechanism | integration | `cd ml && python -m pytest tests/test_forecast.py::test_forecast_refresh -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `cd ml && python -m pytest tests/ -x -q` (quick Python) + `cd backend && npx vitest run` (quick Node)
- **Per wave merge:** Both full suites
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `ml/pyproject.toml` -- project config with pytest settings
- [ ] `ml/tests/conftest.py` -- shared fixtures (sample DataFrames, mock DB connection)
- [ ] `ml/tests/test_baseline.py` -- covers FORE-01, FORE-06 (baseline CI)
- [ ] `ml/tests/test_features.py` -- covers FORE-02, FORE-03, FORE-04
- [ ] `ml/tests/test_model.py` -- covers XGBoost training/prediction
- [ ] `ml/tests/test_forecast.py` -- covers FORE-05, FORE-08
- [ ] `ml/tests/test_confidence.py` -- covers FORE-06 (quantile CI)
- [ ] `backend/src/api/__tests__/corridors.test.ts` -- covers FORE-07, API-01, API-02
- [ ] Framework install: `cd ml && pip install pytest ruff`

## Sources

### Primary (HIGH confidence)
- [XGBoost 3.2.0 quantile regression docs](https://xgboost.readthedocs.io/en/stable/python/examples/quantile_regression.html) -- `reg:quantileerror` with `quantile_alpha` for multi-quantile prediction
- [XGBoost Parameters](https://xgboost.readthedocs.io/en/stable/parameter.html) -- objective and quantile_alpha configuration
- [scikit-learn 1.8.0 TimeSeriesSplit](https://scikit-learn.org/stable/auto_examples/ensemble/plot_gradient_boosting_quantile.html) -- time-series cross-validation
- PyPI registry -- all Python package versions verified 2026-03-19 (xgboost 3.2.0, scikit-learn 1.8.0, pandas 3.0.1, numpy 2.4.3, psycopg2-binary 2.9.11, joblib 1.5.3, click 8.3.1)

### Secondary (MEDIUM confidence)
- [psycopg2 connection pooling docs](https://www.psycopg.org/docs/pool.html) -- ThreadedConnectionPool API
- Existing project codebase (Phase 1 migration 001, connection.ts, speed-readings.ts) -- schema and patterns to match

### Tertiary (LOW confidence)
- Modifier column semantics (multiplicative vs additive) -- needs validation during implementation
- Actual TMC segment-to-corridor mapping -- depends on Phase 1 collected data

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all versions verified via PyPI, Python 3.14 compatibility confirmed
- Architecture: HIGH -- patterns align with locked decisions (cron scripts, shared DB, no HTTP)
- Pitfalls: HIGH -- time-series leakage and quantile crossing are well-documented, verified against sklearn/xgboost docs
- XGBoost quantile regression: HIGH -- verified in official XGBoost 3.2.0 documentation

**Research date:** 2026-03-19
**Valid until:** 2026-04-19 (stable libraries, 30-day validity)
