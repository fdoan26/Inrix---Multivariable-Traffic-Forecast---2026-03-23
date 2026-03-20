import pandas as pd
import numpy as np
import pytest
from unittest.mock import MagicMock
from datetime import datetime, timedelta


@pytest.fixture
def sample_speed_df():
    """4 weeks of synthetic speed_readings for 'us-101' corridor.

    Travel times vary by hour: peak ~35min (7-9am weekdays), off-peak ~15min (11pm-5am).
    """
    rng = np.random.default_rng(42)
    rows = []
    start = datetime(2026, 1, 5)  # Monday

    for day_offset in range(28):  # 4 weeks
        dt = start + timedelta(days=day_offset)
        day_of_week = dt.weekday()

        for hour in range(24):
            recorded_at = dt.replace(hour=hour, minute=0, second=0)

            # Base travel time varies by hour and day
            if day_of_week < 5 and hour in (7, 8):
                base = 35.0  # Weekday morning peak
            elif day_of_week < 5 and hour in (17, 18):
                base = 30.0  # Weekday evening peak
            elif hour >= 23 or hour <= 4:
                base = 15.0  # Late night / early morning
            else:
                base = 22.0  # Midday / weekend

            # Add noise
            travel_time = base + rng.normal(0, 2.0)
            travel_time = max(5.0, travel_time)

            rows.append({
                "corridor_id": "us-101",
                "recorded_at": pd.Timestamp(recorded_at),
                "travel_time_min": round(travel_time, 2),
                "segment_id": "TMC_PLACEHOLDER",
            })

    return pd.DataFrame(rows)


@pytest.fixture
def sample_weather_df():
    """Weather forecast data with rainy and foggy hours."""
    start = datetime(2026, 1, 5)
    rows = []

    for hour_offset in range(168):  # 1 week
        forecast_hour = start + timedelta(hours=hour_offset)

        if hour_offset % 24 < 6:
            # Rainy hours (first 6 hours of each day)
            precip = 5.0
            visibility = 5000.0
            weather_code = 61  # Rain
        elif hour_offset % 24 < 10:
            # Foggy hours
            precip = 0.0
            visibility = 500.0
            weather_code = 45  # Fog
        else:
            # Clear
            precip = 0.0
            visibility = 10000.0
            weather_code = 0

        rows.append({
            "forecast_hour": pd.Timestamp(forecast_hour),
            "temperature_c": 15.0,
            "precipitation_mm": precip,
            "visibility_m": visibility,
            "weather_code": weather_code,
        })

    return pd.DataFrame(rows)


@pytest.fixture
def sample_calendar_df():
    """Calendar flags with school days, breaks, and events."""
    start = datetime(2026, 1, 5)
    rows = []

    for day_offset in range(28):
        flag_date = (start + timedelta(days=day_offset)).date()
        day_of_week = (start + timedelta(days=day_offset)).weekday()

        # School days are weekdays in first 2 weeks, break in weeks 3-4
        school_day = day_of_week < 5 and day_offset < 14

        # Events on specific days
        event_name = None
        event_type = None
        if day_offset == 3:  # Thursday week 1
            event_name = "Giants vs Dodgers"
            event_type = "giants"
        elif day_offset == 10:  # Thursday week 2
            event_name = "Coldplay Concert"
            event_type = "concert"

        rows.append({
            "flag_date": flag_date,
            "school_day": school_day,
            "event_name": event_name,
            "event_type": event_type,
        })

    return pd.DataFrame(rows)


@pytest.fixture
def mock_conn():
    """Mock psycopg2 connection for DB tests."""
    conn = MagicMock()
    cursor = MagicMock()
    conn.cursor.return_value.__enter__ = MagicMock(return_value=cursor)
    conn.cursor.return_value.__exit__ = MagicMock(return_value=False)
    return conn
