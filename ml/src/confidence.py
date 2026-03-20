"""Bootstrap confidence interval computation for travel time forecasting."""

import numpy as np


def bootstrap_ci(
    values: np.ndarray,
    lower_pct: float = 10.0,
    upper_pct: float = 90.0,
) -> tuple[float, float, float]:
    """
    Compute confidence interval from empirical distribution.

    Returns (p_lower, median, p_upper) where p_lower <= median <= p_upper.
    Uses percentiles of the observed values as the interval bounds.
    """
    if len(values) == 0:
        raise ValueError("Cannot compute CI from empty array")

    p_lower = float(np.percentile(values, lower_pct))
    median = float(np.percentile(values, 50.0))
    p_upper = float(np.percentile(values, upper_pct))

    # Enforce monotonicity (prevent quantile crossing)
    p_lower = min(p_lower, median)
    p_upper = max(p_upper, median)

    return (p_lower, median, p_upper)
