"""Feature engineering: weather, event, and school modifiers for travel time forecasting."""

WEATHER_RAIN_THRESHOLD_MM = 2.0
WEATHER_FOG_VISIBILITY_M = 1000.0
RAIN_MODIFIER = 1.15  # 15% slowdown for rain
FOG_MODIFIER = 1.10  # 10% slowdown for fog
HEAVY_RAIN_MODIFIER = 1.25  # 25% slowdown for heavy rain (>10mm)

EVENT_MODIFIER_MAP = {
    "giants": 1.20,
    "warriors": 1.15,
    "concert": 1.10,
    "festival": 1.25,
}
DEFAULT_EVENT_MODIFIER = 1.10

SCHOOL_MORNING_MODIFIER = 1.08  # 8% slowdown 7-9am on school days
SCHOOL_MORNING_HOURS = (7, 8)

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
    "historical_avg_minutes",
]


def compute_weather_modifier(precip_mm: float, visibility_m: float, weather_code: int) -> float:
    """Compute multiplicative weather modifier for travel time."""
    modifier = 1.0
    if precip_mm > 10.0:
        modifier = max(modifier, HEAVY_RAIN_MODIFIER)
    elif precip_mm > WEATHER_RAIN_THRESHOLD_MM:
        modifier = max(modifier, RAIN_MODIFIER)
    if visibility_m < WEATHER_FOG_VISIBILITY_M:
        modifier = max(modifier, FOG_MODIFIER)
    return round(modifier, 3)


def compute_event_modifier(has_event: bool, event_type: str | None) -> float:
    """Compute multiplicative event modifier for travel time."""
    if not has_event:
        return 1.0
    return EVENT_MODIFIER_MAP.get(event_type or "", DEFAULT_EVENT_MODIFIER)


def compute_school_modifier(is_school_day: bool, hour: int) -> float:
    """Compute multiplicative school modifier for morning rush travel time."""
    if is_school_day and hour in SCHOOL_MORNING_HOURS:
        return SCHOOL_MORNING_MODIFIER
    return 1.0


def apply_modifiers(
    precip_mm: float,
    visibility_m: float,
    weather_code: int,
    has_event: bool,
    event_type: str | None,
    is_school_day: bool,
    hour: int,
) -> dict:
    """Compute all modifiers and return as a dict."""
    return {
        "weather_modifier": compute_weather_modifier(precip_mm, visibility_m, weather_code),
        "event_modifier": compute_event_modifier(has_event, event_type),
        "school_modifier": compute_school_modifier(is_school_day, hour),
    }


def build_feature_row(
    hour_of_day: int,
    day_of_week: int,
    is_school_day: bool,
    has_event: bool,
    event_type: str | None,
    temp_c: float,
    precip_mm: float,
    visibility_m: float,
    weather_code: int,
    historical_avg_minutes: float,
) -> dict:
    """Build a single feature row dict with all FEATURE_COLUMNS keys."""
    EVENT_TYPE_ENCODING = {"giants": 1, "warriors": 2, "concert": 3, "festival": 4}
    return {
        "hour_of_day": hour_of_day,
        "day_of_week": day_of_week,
        "is_weekend": int(day_of_week in (5, 6)),
        "is_school_day": int(is_school_day),
        "has_event": int(has_event),
        "event_type_encoded": EVENT_TYPE_ENCODING.get(event_type or "", 0),
        "temp_c": temp_c,
        "precip_mm": precip_mm,
        "visibility_m": visibility_m,
        "weather_code": weather_code,
        "historical_avg_minutes": historical_avg_minutes,
    }
