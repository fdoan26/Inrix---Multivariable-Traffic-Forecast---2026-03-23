"""Tests for XGBoost quantile regression model module."""

import numpy as np
import pytest
from pathlib import Path


@pytest.fixture
def training_data():
    """Synthetic training data for XGBoost."""
    rng = np.random.default_rng(42)
    n = 500
    X = rng.standard_normal((n, 11))
    # Target is a noisy linear combination
    y = 20.0 + 2.0 * X[:, 0] - 1.5 * X[:, 1] + rng.normal(0, 2, n)
    return X, y


class TestTrainQuantileModel:
    def test_returns_xgbregressor(self, training_data):
        from src.model import train_quantile_model
        X, y = training_data
        model = train_quantile_model(X, y)
        import xgboost as xgb
        assert isinstance(model, xgb.XGBRegressor)

    def test_objective_is_quantile_error(self, training_data):
        from src.model import train_quantile_model
        X, y = training_data
        model = train_quantile_model(X, y)
        assert model.get_params()["objective"] == "reg:quantileerror"


class TestPredictQuantiles:
    def test_returns_three_arrays(self, training_data):
        from src.model import train_quantile_model, predict_quantiles
        X, y = training_data
        model = train_quantile_model(X, y)
        p10, p50, p90 = predict_quantiles(model, X[:10])
        assert len(p10) == 10
        assert len(p50) == 10
        assert len(p90) == 10

    def test_quantile_ordering(self, training_data):
        """p10 <= p50 <= p90 after post-processing."""
        from src.model import train_quantile_model, predict_quantiles
        X, y = training_data
        model = train_quantile_model(X, y)
        p10, p50, p90 = predict_quantiles(model, X)
        assert np.all(p10 <= p50 + 1e-6), "p10 should be <= p50"
        assert np.all(p50 <= p90 + 1e-6), "p50 should be <= p90"


class TestSaveLoadModel:
    def test_save_creates_pkl_file(self, training_data, tmp_path, monkeypatch):
        from src import model as model_mod
        monkeypatch.setattr(model_mod, "MODEL_DIR", tmp_path)
        from src.model import train_quantile_model, save_model
        X, y = training_data
        m = train_quantile_model(X, y)
        path = save_model(m, "us-101", "v1")
        assert path.exists()
        assert path.suffix == ".pkl"

    def test_load_roundtrip(self, training_data, tmp_path, monkeypatch):
        from src import model as model_mod
        monkeypatch.setattr(model_mod, "MODEL_DIR", tmp_path)
        from src.model import train_quantile_model, save_model, load_model, predict_quantiles
        X, y = training_data
        m = train_quantile_model(X, y)
        save_model(m, "us-101", "v1")
        loaded = load_model("us-101", "v1")
        p10a, p50a, p90a = predict_quantiles(m, X[:5])
        p10b, p50b, p90b = predict_quantiles(loaded, X[:5])
        np.testing.assert_array_almost_equal(p50a, p50b)


class TestEvaluateModel:
    def test_returns_pinball_loss_keys(self, training_data):
        from src.model import train_quantile_model, evaluate_model
        X, y = training_data
        model = train_quantile_model(X, y)
        metrics = evaluate_model(model, X[:100], y[:100])
        assert "pinball_loss_p10" in metrics
        assert "pinball_loss_p50" in metrics
        assert "pinball_loss_p90" in metrics
        for v in metrics.values():
            assert isinstance(v, float)
