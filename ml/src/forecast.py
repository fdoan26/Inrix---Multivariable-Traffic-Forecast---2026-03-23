"""Forecast orchestrator: assemble features, predict, apply modifiers, write to DB."""

import logging
from datetime import datetime, timedelta, timezone

import numpy as np
import pandas as pd

from src.corridors import CORRIDORS, get_corridor
from src.baseline import compute_baseline
from src.features import apply_modifiers
from src.model import model_exists, load_model, predict_quantiles
from src.config import FORECAST_HORIZON_HOURS, MIN_WEEKS_FOR_XGBOOST

logger = logging.getLogger(__name__)


def count_data_weeks(conn, corridor_id: str) -> float:
    """Count how many weeks of speed_readings data exist for a corridor."""
    corridor = get_corridor(corridor_id)
    with conn.cursor() as cur:
        cur.execute(
            "SELECT EXTRACT(EPOCH FROM (MAX(recorded_at) - MIN(recorded_at))) / 604800.0 "
            "FROM speed_readings WHERE segment_id = ANY(%s)",
            (list(corridor.segment_ids),),
        )
        row = cur.fetchone()
        return float(row[0]) if row and row[0] else 0.0


def fetch_historical_speeds(conn, corridor_id: str) -> pd.DataFrame:
    """Fetch historical speed_readings aggregated by corridor."""
    corridor = get_corridor(corridor_id)
    with conn.cursor() as cur:
        cur.execute(
            "SELECT %s AS corridor_id, recorded_at, SUM(travel_time_min) AS travel_time_min "
            "FROM speed_readings WHERE segment_id = ANY(%s) "
            "GROUP BY recorded_at ORDER BY recorded_at",
            (corridor_id, list(corridor.segment_ids)),
        )
        rows = cur.fetchall()
    if not rows:
        return pd.DataFrame(columns=["corridor_id", "recorded_at", "travel_time_min"])
    return pd.DataFrame(rows, columns=["corridor_id", "recorded_at", "travel_time_min"])


def fetch_weather_for_range(conn, start: datetime, end: datetime) -> dict:
    """Returns dict keyed by hour -> (precip_mm, visibility_m, weather_code)."""
    with conn.cursor() as cur:
        cur.execute(
            "SELECT forecast_hour, precipitation_mm, visibility_m, weather_code "
            "FROM weather_forecasts WHERE forecast_hour BETWEEN %s AND %s",
            (start, end),
        )
        rows = cur.fetchall()
    result = {}
    for row in rows:
        result[row[0]] = (row[1] or 0.0, row[2] or 10000.0, row[3] or 0)
    return result


def fetch_calendar_for_range(conn, start: datetime, end: datetime) -> dict:
    """Returns dict keyed by date -> (school_day, event_name, event_type)."""
    with conn.cursor() as cur:
        cur.execute(
            "SELECT flag_date, school_day, event_name, event_type "
            "FROM calendar_flags WHERE flag_date BETWEEN %s AND %s",
            (start.date(), end.date()),
        )
        rows = cur.fetchall()
    result = {}
    for row in rows:
        result[row[0]] = (row[1], row[2], row[3])
    return result


def run_forecast(
    conn, corridor_id: str, horizon_hours: int = FORECAST_HORIZON_HOURS
) -> int:
    """Generate forecasts for a corridor. Uses baseline or XGBoost based on data availability."""
    data_weeks = count_data_weeks(conn, corridor_id)
    now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    end = now + timedelta(hours=horizon_hours)

    # Fetch context data
    weather = fetch_weather_for_range(conn, now, end)
    calendar = fetch_calendar_for_range(conn, now, end)

    if data_weeks >= MIN_WEEKS_FOR_XGBOOST and model_exists(corridor_id):
        logger.info("Using XGBoost model (%.1f weeks of data)", data_weeks)
        forecasts = _predict_xgboost(conn, corridor_id, now, end, weather, calendar)
    else:
        logger.info(
            "Using baseline model (%.1f weeks of data, need %.1f)",
            data_weeks,
            MIN_WEEKS_FOR_XGBOOST,
        )
        forecasts = _predict_baseline(conn, corridor_id, now, end, weather, calendar)

    write_forecasts(conn, forecasts)
    return len(forecasts)


def _predict_baseline(conn, corridor_id, start, end, weather, calendar) -> list[dict]:
    """Generate forecasts using historical average baseline."""
    hist = fetch_historical_speeds(conn, corridor_id)
    if hist.empty:
        logger.warning(
            "No historical data for %s, generating placeholder forecasts", corridor_id
        )
        return _generate_placeholder_forecasts(corridor_id, start, end)

    baseline = compute_baseline(hist)
    forecasts = []
    current = start
    while current < end:
        dow = current.weekday()
        hour = current.hour
        row = baseline[(baseline["day_of_week"] == dow) & (baseline["hour"] == hour)]
        if row.empty:
            current += timedelta(hours=1)
            continue
        r = row.iloc[0]
        # Apply modifiers
        w = weather.get(current, (0.0, 10000.0, 0))
        cal_date = current.date()
        c = calendar.get(cal_date, (True, None, None))
        mods = apply_modifiers(
            w[0], w[1], w[2], c[1] is not None, c[2], c[0], hour
        )
        total_modifier = (
            mods["weather_modifier"] * mods["event_modifier"] * mods["school_modifier"]
        )
        forecasts.append(
            {
                "corridor_id": corridor_id,
                "forecast_for": current,
                "predicted_minutes": round(r["p50_minutes"] * total_modifier, 2),
                "p10_minutes": round(r["p10_minutes"] * total_modifier, 2),
                "p50_minutes": round(r["p50_minutes"] * total_modifier, 2),
                "p90_minutes": round(r["p90_minutes"] * total_modifier, 2),
                "model_version": "baseline-v1",
                "weather_modifier": mods["weather_modifier"],
                "event_modifier": mods["event_modifier"],
                "school_modifier": mods["school_modifier"],
            }
        )
        current += timedelta(hours=1)
    return forecasts


def _predict_xgboost(conn, corridor_id, start, end, weather, calendar) -> list[dict]:
    """Generate forecasts using XGBoost quantile regression model."""
    from src.features import build_feature_row, FEATURE_COLUMNS

    model = load_model(corridor_id)
    hist = fetch_historical_speeds(conn, corridor_id)
    baseline = compute_baseline(hist) if not hist.empty else None

    features_list = []
    timestamps = []
    current = start
    while current < end:
        dow = current.weekday()
        hour = current.hour
        w = weather.get(current, (0.0, 10000.0, 0))
        cal_date = current.date()
        c = calendar.get(cal_date, (True, None, None))
        hist_avg = 20.0  # default
        if baseline is not None:
            match = baseline[
                (baseline["day_of_week"] == dow) & (baseline["hour"] == hour)
            ]
            if not match.empty:
                hist_avg = float(match.iloc[0]["p50_minutes"])
        feat = build_feature_row(
            hour,
            dow,
            c[0],
            c[1] is not None,
            c[2],
            w[0] if len(w) > 0 else 0.0,
            w[0],
            w[1],
            w[2] if len(w) > 2 else 0,
            hist_avg,
        )
        features_list.append([feat[col] for col in FEATURE_COLUMNS])
        timestamps.append(current)
        current += timedelta(hours=1)

    X = np.array(features_list)
    p10, p50, p90 = predict_quantiles(model, X)
    forecasts = []
    for i, ts in enumerate(timestamps):
        forecasts.append(
            {
                "corridor_id": corridor_id,
                "forecast_for": ts,
                "predicted_minutes": round(float(p50[i]), 2),
                "p10_minutes": round(float(p10[i]), 2),
                "p50_minutes": round(float(p50[i]), 2),
                "p90_minutes": round(float(p90[i]), 2),
                "model_version": "xgboost-v1",
                "weather_modifier": None,
                "event_modifier": None,
                "school_modifier": None,
            }
        )
    return forecasts


def _generate_placeholder_forecasts(corridor_id, start, end) -> list[dict]:
    """Generate placeholder forecasts with default 20-min travel time when no data exists."""
    forecasts = []
    current = start
    while current < end:
        forecasts.append(
            {
                "corridor_id": corridor_id,
                "forecast_for": current,
                "predicted_minutes": 20.0,
                "p10_minutes": 15.0,
                "p50_minutes": 20.0,
                "p90_minutes": 30.0,
                "model_version": "placeholder-v1",
                "weather_modifier": 1.0,
                "event_modifier": 1.0,
                "school_modifier": 1.0,
            }
        )
        current += timedelta(hours=1)
    return forecasts


def write_forecasts(conn, forecasts: list[dict]):
    """Batch insert forecast rows, replacing existing forecasts for the same corridor/time range."""
    if not forecasts:
        return
    with conn.cursor() as cur:
        corridor_id = forecasts[0]["corridor_id"]
        min_time = min(f["forecast_for"] for f in forecasts)
        max_time = max(f["forecast_for"] for f in forecasts)
        cur.execute(
            "DELETE FROM forecasts WHERE corridor_id = %s AND forecast_for BETWEEN %s AND %s",
            (corridor_id, min_time, max_time),
        )
        insert_sql = (
            "INSERT INTO forecasts (corridor_id, forecast_for, predicted_minutes, "
            "p10_minutes, p50_minutes, p90_minutes, model_version, "
            "weather_modifier, event_modifier, school_modifier) "
            "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)"
        )
        rows = [
            (
                f["corridor_id"],
                f["forecast_for"],
                f["predicted_minutes"],
                f["p10_minutes"],
                f["p50_minutes"],
                f["p90_minutes"],
                f["model_version"],
                f.get("weather_modifier"),
                f.get("event_modifier"),
                f.get("school_modifier"),
            )
            for f in forecasts
        ]
        cur.executemany(insert_sql, rows)
