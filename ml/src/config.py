import os
from pathlib import Path


def get_database_url() -> str:
    """Get DATABASE_URL from environment. Raises KeyError if not set."""
    url = os.environ.get("DATABASE_URL", "")
    if not url:
        raise KeyError("DATABASE_URL environment variable is required")
    return url


FORECAST_HORIZON_HOURS = 168  # 7 days
REFRESH_INTERVAL_HOURS = 6
MIN_WEEKS_FOR_XGBOOST = 2
MODEL_DIR = Path(__file__).parent.parent / "models"

from src.corridors import CORRIDORS  # noqa: E402, F401
