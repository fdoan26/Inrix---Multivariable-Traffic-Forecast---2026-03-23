"""Tests for forecast orchestrator module."""

import pytest
import numpy as np
import pandas as pd
from unittest.mock import MagicMock, patch, call
from datetime import datetime, timedelta, timezone


@pytest.fixture
def mock_conn():
    """Mock psycopg2 connection for DB tests."""
    conn = MagicMock()
    cursor = MagicMock()
    conn.cursor.return_value.__enter__ = MagicMock(return_value=cursor)
    conn.cursor.return_value.__exit__ = MagicMock(return_value=False)
    return conn


def _make_historical_df(n_weeks=4):
    """Create synthetic historical speed data."""
    rng = np.random.default_rng(42)
    rows = []
    start = datetime(2026, 1, 5)
    for day in range(n_weeks * 7):
        dt = start + timedelta(days=day)
        for hour in range(24):
            recorded_at = dt.replace(hour=hour, minute=0, second=0)
            travel_time = 20.0 + rng.normal(0, 2.0)
            rows.append({
                "corridor_id": "us-101",
                "recorded_at": pd.Timestamp(recorded_at),
                "travel_time_min": max(5.0, round(travel_time, 2)),
            })
    return pd.DataFrame(rows)


class TestCountDataWeeks:
    def test_returns_zero_when_no_data(self, mock_conn):
        cursor = mock_conn.cursor.return_value.__enter__.return_value
        cursor.fetchone.return_value = (None,)
        from src.forecast import count_data_weeks
        result = count_data_weeks(mock_conn, "us-101")
        assert result == 0.0

    def test_returns_weeks_from_epoch_diff(self, mock_conn):
        cursor = mock_conn.cursor.return_value.__enter__.return_value
        # 2 weeks = 2 * 604800 seconds = 1209600 / 604800 = 2.0
        cursor.fetchone.return_value = (2.0,)
        from src.forecast import count_data_weeks
        result = count_data_weeks(mock_conn, "us-101")
        assert result == 2.0


class TestRunForecast:
    @patch("src.forecast.fetch_calendar_for_range", return_value={})
    @patch("src.forecast.fetch_weather_for_range", return_value={})
    @patch("src.forecast.write_forecasts")
    @patch("src.forecast.fetch_historical_speeds")
    @patch("src.forecast.count_data_weeks")
    def test_dispatches_to_baseline_when_insufficient_data(
        self, mock_weeks, mock_hist, mock_write, mock_weather, mock_cal, mock_conn
    ):
        mock_weeks.return_value = 1.0  # < MIN_WEEKS_FOR_XGBOOST
        mock_hist.return_value = _make_historical_df(1)
        from src.forecast import run_forecast
        count = run_forecast(mock_conn, "us-101")
        assert count > 0
        mock_write.assert_called_once()

    @patch("src.forecast.fetch_calendar_for_range", return_value={})
    @patch("src.forecast.fetch_weather_for_range", return_value={})
    @patch("src.forecast.write_forecasts")
    @patch("src.forecast.model_exists", return_value=True)
    @patch("src.forecast.load_model")
    @patch("src.forecast.fetch_historical_speeds")
    @patch("src.forecast.count_data_weeks")
    def test_dispatches_to_xgboost_when_sufficient_data_and_model(
        self, mock_weeks, mock_hist, mock_load, mock_exists, mock_write, mock_weather, mock_cal, mock_conn
    ):
        mock_weeks.return_value = 3.0  # >= MIN_WEEKS_FOR_XGBOOST
        mock_hist.return_value = _make_historical_df(3)
        # Mock model predict to return 3-column array
        mock_model = MagicMock()
        mock_model.predict.return_value = np.column_stack([
            np.full(168, 18.0), np.full(168, 20.0), np.full(168, 25.0)
        ])
        mock_load.return_value = mock_model
        from src.forecast import run_forecast
        count = run_forecast(mock_conn, "us-101")
        assert count == 168

    @patch("src.forecast.fetch_calendar_for_range", return_value={})
    @patch("src.forecast.fetch_weather_for_range", return_value={})
    @patch("src.forecast.write_forecasts")
    @patch("src.forecast.fetch_historical_speeds")
    @patch("src.forecast.count_data_weeks")
    def test_generates_168_hourly_slots(
        self, mock_weeks, mock_hist, mock_write, mock_weather, mock_cal, mock_conn
    ):
        mock_weeks.return_value = 1.0
        mock_hist.return_value = _make_historical_df(4)
        from src.forecast import run_forecast
        count = run_forecast(mock_conn, "us-101")
        assert count == 168


class TestWriteForecasts:
    def test_calls_executemany_with_insert(self, mock_conn):
        cursor = mock_conn.cursor.return_value.__enter__.return_value
        now = datetime(2026, 3, 1, tzinfo=timezone.utc)
        forecasts = [
            {
                "corridor_id": "us-101",
                "forecast_for": now + timedelta(hours=i),
                "predicted_minutes": 20.0,
                "p10_minutes": 15.0,
                "p50_minutes": 20.0,
                "p90_minutes": 25.0,
                "model_version": "baseline-v1",
                "weather_modifier": 1.0,
                "event_modifier": 1.0,
                "school_modifier": 1.0,
            }
            for i in range(5)
        ]
        from src.forecast import write_forecasts
        write_forecasts(mock_conn, forecasts)
        cursor.executemany.assert_called_once()
        sql = cursor.executemany.call_args[0][0]
        assert "INSERT INTO forecasts" in sql

    def test_deletes_existing_before_insert(self, mock_conn):
        cursor = mock_conn.cursor.return_value.__enter__.return_value
        now = datetime(2026, 3, 1, tzinfo=timezone.utc)
        forecasts = [
            {
                "corridor_id": "us-101",
                "forecast_for": now,
                "predicted_minutes": 20.0,
                "p10_minutes": 15.0,
                "p50_minutes": 20.0,
                "p90_minutes": 25.0,
                "model_version": "baseline-v1",
                "weather_modifier": 1.0,
                "event_modifier": 1.0,
                "school_modifier": 1.0,
            }
        ]
        from src.forecast import write_forecasts
        write_forecasts(mock_conn, forecasts)
        # First call should be DELETE
        delete_call = cursor.execute.call_args_list[0]
        assert "DELETE FROM forecasts" in delete_call[0][0]

    def test_forecast_rows_have_all_required_keys(self, mock_conn):
        """Generated forecast rows should have all required keys."""
        required_keys = {
            "corridor_id", "forecast_for", "predicted_minutes",
            "p10_minutes", "p50_minutes", "p90_minutes",
            "model_version", "weather_modifier", "event_modifier", "school_modifier",
        }
        now = datetime(2026, 3, 1, tzinfo=timezone.utc)
        forecasts = [
            {
                "corridor_id": "us-101",
                "forecast_for": now,
                "predicted_minutes": 20.0,
                "p10_minutes": 15.0,
                "p50_minutes": 20.0,
                "p90_minutes": 25.0,
                "model_version": "baseline-v1",
                "weather_modifier": 1.0,
                "event_modifier": 1.0,
                "school_modifier": 1.0,
            }
        ]
        for f in forecasts:
            assert required_keys.issubset(f.keys())
