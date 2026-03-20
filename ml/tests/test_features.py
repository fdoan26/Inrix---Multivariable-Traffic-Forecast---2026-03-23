import pytest

from src.features import (
    apply_modifiers,
    build_feature_row,
    compute_event_modifier,
    compute_school_modifier,
    compute_weather_modifier,
    FEATURE_COLUMNS,
)


class TestWeatherModifier:
    def test_rain_increases_modifier(self):
        result = apply_modifiers(
            precip_mm=5.0, visibility_m=10000.0, weather_code=61,
            has_event=False, event_type=None, is_school_day=False, hour=12,
        )
        assert result["weather_modifier"] > 1.0

    def test_fog_increases_modifier(self):
        result = apply_modifiers(
            precip_mm=0.0, visibility_m=500.0, weather_code=45,
            has_event=False, event_type=None, is_school_day=False, hour=12,
        )
        assert result["weather_modifier"] > 1.0


class TestEventModifier:
    def test_giants_event_increases_modifier(self):
        result = apply_modifiers(
            precip_mm=0.0, visibility_m=10000.0, weather_code=0,
            has_event=True, event_type="giants", is_school_day=False, hour=19,
        )
        assert result["event_modifier"] > 1.0


class TestSchoolModifier:
    def test_school_day_morning_increases_modifier(self):
        result = apply_modifiers(
            precip_mm=0.0, visibility_m=10000.0, weather_code=0,
            has_event=False, event_type=None, is_school_day=True, hour=8,
        )
        assert result["school_modifier"] > 1.0

    def test_school_break_morning_no_modifier(self):
        result = apply_modifiers(
            precip_mm=0.0, visibility_m=10000.0, weather_code=0,
            has_event=False, event_type=None, is_school_day=False, hour=8,
        )
        assert result["school_modifier"] == 1.0


class TestAllClear:
    def test_clear_weather_no_event_no_school_all_1(self):
        result = apply_modifiers(
            precip_mm=0.0, visibility_m=10000.0, weather_code=0,
            has_event=False, event_type=None, is_school_day=False, hour=12,
        )
        assert result["weather_modifier"] == 1.0
        assert result["event_modifier"] == 1.0
        assert result["school_modifier"] == 1.0


class TestBuildFeatureRow:
    def test_has_all_feature_columns(self):
        row = build_feature_row(
            hour_of_day=8, day_of_week=1, is_school_day=True,
            has_event=False, event_type=None, temp_c=15.0,
            precip_mm=0.0, visibility_m=10000.0, weather_code=0,
            historical_avg_minutes=22.0,
        )
        for col in FEATURE_COLUMNS:
            assert col in row, f"Missing feature column: {col}"
