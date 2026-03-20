import numpy as np
import pandas as pd
import pytest

from src.baseline import compute_baseline


class TestComputeBaseline:
    def test_returns_expected_columns(self, sample_speed_df):
        result = compute_baseline(sample_speed_df)
        expected_cols = {
            "corridor_id", "day_of_week", "hour",
            "p10_minutes", "p50_minutes", "p90_minutes", "predicted_minutes",
        }
        assert set(result.columns) == expected_cols

    def test_p50_equals_predicted(self, sample_speed_df):
        result = compute_baseline(sample_speed_df)
        assert (result["p50_minutes"] == result["predicted_minutes"]).all()

    def test_no_quantile_crossing(self, sample_speed_df):
        result = compute_baseline(sample_speed_df)
        assert (result["p10_minutes"] <= result["p50_minutes"]).all()
        assert (result["p50_minutes"] <= result["p90_minutes"]).all()

    def test_168_rows_per_corridor(self, sample_speed_df):
        result = compute_baseline(sample_speed_df)
        # 7 days x 24 hours = 168 rows for the single corridor
        assert len(result) == 168

    def test_peak_hours_higher_than_offpeak(self, sample_speed_df):
        result = compute_baseline(sample_speed_df)
        # Weekday (day 0=Monday) morning peak hour 8
        peak = result[(result["day_of_week"] == 0) & (result["hour"] == 8)]
        # Late night hour 2
        offpeak = result[(result["day_of_week"] == 0) & (result["hour"] == 2)]
        assert peak["p50_minutes"].values[0] > offpeak["p50_minutes"].values[0]
