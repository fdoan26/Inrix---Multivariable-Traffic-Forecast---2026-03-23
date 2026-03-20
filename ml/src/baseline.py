import numpy as np
import pandas as pd


def compute_baseline(df: pd.DataFrame) -> pd.DataFrame:
    """
    Compute baseline forecast from historical speed_readings.

    Input df columns: corridor_id, recorded_at, travel_time_min
    Output: corridor_id, day_of_week, hour, p10_minutes, p50_minutes, p90_minutes, predicted_minutes
    """
    df = df.copy()
    df["day_of_week"] = df["recorded_at"].dt.dayofweek
    df["hour"] = df["recorded_at"].dt.hour

    baseline = (
        df.groupby(["corridor_id", "day_of_week", "hour"])["travel_time_min"]
        .agg(
            p10=lambda x: np.percentile(x, 10),
            p50=lambda x: np.percentile(x, 50),
            p90=lambda x: np.percentile(x, 90),
        )
        .reset_index()
    )

    baseline.rename(
        columns={"p10": "p10_minutes", "p50": "p50_minutes", "p90": "p90_minutes"},
        inplace=True,
    )
    baseline["predicted_minutes"] = baseline["p50_minutes"]
    return baseline
