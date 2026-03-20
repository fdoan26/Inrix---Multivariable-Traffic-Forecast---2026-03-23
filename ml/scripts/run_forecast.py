#!/usr/bin/env python
"""Generate week-ahead forecasts for SF corridors.

Cron schedule for FORE-08 (6-hour refresh):
    0 */6 * * * cd /path/to/ml && python -m scripts.run_forecast >> logs/forecast.log 2>&1
"""
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
@click.option(
    "--corridor", type=str, default=None, help="Specific corridor ID (default: all)"
)
@click.option(
    "--horizon", type=int, default=168, help="Forecast horizon in hours (default: 168)"
)
def main(corridor: str | None, horizon: int):
    """Generate week-ahead forecasts for SF corridors."""
    corridors = [corridor] if corridor else list(CORRIDORS.keys())
    total = 0
    try:
        with get_conn() as conn:
            for cid in corridors:
                logger.info("Forecasting %s (%d hours)", cid, horizon)
                count = run_forecast(conn, cid, horizon)
                total += count
                logger.info("Wrote %d forecast rows for %s", count, cid)
        logger.info("Total: %d forecast rows for %d corridors", total, len(corridors))
    finally:
        close_pool()


if __name__ == "__main__":
    main()
