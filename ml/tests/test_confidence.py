import numpy as np
import pytest

from src.confidence import bootstrap_ci


class TestBootstrapCI:
    def test_returns_three_values(self):
        values = np.array([20.0, 21.0, 19.0, 22.0, 18.0, 20.5, 19.5, 21.5])
        p10, p50, p90 = bootstrap_ci(values)
        assert isinstance(p10, float)
        assert isinstance(p50, float)
        assert isinstance(p90, float)

    def test_monotonicity(self):
        rng = np.random.default_rng(42)
        values = rng.normal(25.0, 5.0, size=100)
        p10, p50, p90 = bootstrap_ci(values)
        assert p10 <= p50
        assert p50 <= p90

    def test_low_variance_narrow_interval(self):
        rng = np.random.default_rng(42)
        values = rng.normal(20.0, 0.5, size=200)
        p10, p50, p90 = bootstrap_ci(values)
        assert (p90 - p10) < 5.0

    def test_high_variance_wide_interval(self):
        rng = np.random.default_rng(42)
        values = rng.uniform(10.0, 50.0, size=200)
        p10, p50, p90 = bootstrap_ci(values)
        assert (p90 - p10) > 10.0
