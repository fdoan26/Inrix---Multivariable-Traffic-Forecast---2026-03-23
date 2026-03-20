#!/usr/bin/env python
"""Train XGBoost quantile regression model for SF corridor travel time forecasting."""
import click
import logging
import numpy as np

from src.db import get_conn, close_pool
from src.forecast import fetch_historical_speeds
from src.features import build_feature_row, FEATURE_COLUMNS
from src.model import train_quantile_model, save_model, evaluate_model
from src.corridors import CORRIDORS

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s"
)
logger = logging.getLogger(__name__)


@click.command()
@click.option(
    "--corridor", type=str, default=None, help="Specific corridor ID (default: all)"
)
@click.option("--version", type=str, default="v1", help="Model version tag")
def main(corridor: str | None, version: str):
    """Train XGBoost quantile regression model for corridors."""
    corridors = [corridor] if corridor else list(CORRIDORS.keys())
    try:
        with get_conn() as conn:
            for cid in corridors:
                logger.info("Training model for %s", cid)
                hist = fetch_historical_speeds(conn, cid)
                if hist.empty:
                    logger.warning("No data for %s, skipping", cid)
                    continue
                X, y = _prepare_training_data(conn, cid, hist)
                if len(y) < 100:
                    logger.warning(
                        "Insufficient data for %s (%d rows), skipping", cid, len(y)
                    )
                    continue
                model = train_quantile_model(X, y)
                # Evaluate on last 20% of data
                split_idx = int(len(y) * 0.8)
                metrics = evaluate_model(model, X[split_idx:], y[split_idx:])
                logger.info("Evaluation for %s: %s", cid, metrics)
                path = save_model(model, cid, version)
                logger.info("Saved model to %s", path)
    finally:
        close_pool()


def _prepare_training_data(conn, corridor_id, hist):
    """Build feature matrix from historical speeds + weather + calendar."""
    from src.baseline import compute_baseline

    baseline = compute_baseline(hist)
    features = []
    targets = []
    for _, row in hist.iterrows():
        dow = row["recorded_at"].weekday()
        hour = row["recorded_at"].hour
        bl_match = baseline[
            (baseline["day_of_week"] == dow) & (baseline["hour"] == hour)
        ]
        hist_avg = (
            float(bl_match.iloc[0]["p50_minutes"]) if not bl_match.empty else 20.0
        )
        feat = build_feature_row(
            hour_of_day=hour,
            day_of_week=dow,
            is_school_day=True,
            has_event=False,
            event_type=None,
            temp_c=15.0,
            precip_mm=0.0,
            visibility_m=10000.0,
            weather_code=0,
            historical_avg_minutes=hist_avg,
        )
        features.append([feat[col] for col in FEATURE_COLUMNS])
        targets.append(row["travel_time_min"])
    return np.array(features), np.array(targets)


if __name__ == "__main__":
    main()
