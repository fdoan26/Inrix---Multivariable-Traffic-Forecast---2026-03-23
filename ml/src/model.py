"""XGBoost quantile regression model: training, prediction, evaluation, and serialization."""

import xgboost as xgb
import numpy as np
import joblib
from pathlib import Path
from src.config import MODEL_DIR

QUANTILES = np.array([0.1, 0.5, 0.9])


def train_quantile_model(X_train: np.ndarray, y_train: np.ndarray) -> xgb.XGBRegressor:
    """Train a single XGBoost model that predicts p10, p50, p90 simultaneously."""
    model = xgb.XGBRegressor(
        objective="reg:quantileerror",
        quantile_alpha=QUANTILES,
        tree_method="hist",
        n_estimators=200,
        max_depth=6,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=42,
    )
    model.fit(X_train, y_train)
    return model


def predict_quantiles(
    model: xgb.XGBRegressor, X: np.ndarray
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Returns (p10, p50, p90) arrays with quantile crossing guard."""
    preds = model.predict(X)  # shape: (n_samples, 3)
    p10, p50, p90 = preds[:, 0], preds[:, 1], preds[:, 2]
    # Guard against quantile crossing
    p10 = np.minimum(p10, p50)
    p90 = np.maximum(p90, p50)
    return p10, p50, p90


def evaluate_model(
    model: xgb.XGBRegressor, X_val: np.ndarray, y_val: np.ndarray
) -> dict:
    """Evaluate model using pinball loss.

    Returns dict with pinball_loss_p10, pinball_loss_p50, pinball_loss_p90 keys.
    """
    p10, p50, p90 = predict_quantiles(model, X_val)

    def pinball_loss(y_true, y_pred, quantile):
        errors = y_true - y_pred
        return float(
            np.mean(np.where(errors >= 0, quantile * errors, (quantile - 1) * errors))
        )

    return {
        "pinball_loss_p10": pinball_loss(y_val, p10, 0.1),
        "pinball_loss_p50": pinball_loss(y_val, p50, 0.5),
        "pinball_loss_p90": pinball_loss(y_val, p90, 0.9),
    }


def save_model(
    model: xgb.XGBRegressor, corridor_id: str, version: str = "v1"
) -> Path:
    """Save model to disk as .pkl file."""
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    path = MODEL_DIR / f"{corridor_id}_{version}.pkl"
    joblib.dump(model, path)
    return path


def load_model(corridor_id: str, version: str = "v1") -> xgb.XGBRegressor:
    """Load model from disk. Raises FileNotFoundError if not found."""
    path = MODEL_DIR / f"{corridor_id}_{version}.pkl"
    if not path.exists():
        raise FileNotFoundError(f"No model at {path}")
    return joblib.load(path)


def model_exists(corridor_id: str, version: str = "v1") -> bool:
    """Check if a trained model exists for the given corridor."""
    return (MODEL_DIR / f"{corridor_id}_{version}.pkl").exists()
