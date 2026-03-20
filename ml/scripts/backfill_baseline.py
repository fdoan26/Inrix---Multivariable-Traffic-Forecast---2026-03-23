#!/usr/bin/env python
"""One-time script to compute and store baseline forecasts from existing speed_readings data."""
import click
import logging

from src.db import get_conn, close_pool
from src.forecast import run_forecast
from src.corridors import CORRIDORS

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s"
)
logger = logging.getLogger(__name__)


@click.command()
def main():
    """Backfill baseline forecasts for all corridors using existing historical data."""
    try:
        with get_conn() as conn:
            for cid in CORRIDORS:
                logger.info("Backfilling baseline for %s", cid)
                count = run_forecast(conn, cid)
                logger.info("Generated %d forecasts for %s", count, cid)
    finally:
        close_pool()


if __name__ == "__main__":
    main()
