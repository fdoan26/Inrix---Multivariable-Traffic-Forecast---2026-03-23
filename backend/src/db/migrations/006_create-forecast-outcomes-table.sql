-- Migration 006: Create forecast_outcomes table for validation tracking

CREATE TABLE IF NOT EXISTS forecast_outcomes (
  id                SERIAL PRIMARY KEY,
  corridor_id       TEXT NOT NULL,
  forecast_for      TIMESTAMPTZ NOT NULL,
  predicted_minutes FLOAT NOT NULL,
  actual_minutes    FLOAT NOT NULL,
  p10_minutes       FLOAT,
  p50_minutes       FLOAT,
  p90_minutes       FLOAT,
  abs_error_minutes FLOAT GENERATED ALWAYS AS (ABS(actual_minutes - predicted_minutes)) STORED,
  abs_pct_error     FLOAT GENERATED ALWAYS AS (
    CASE WHEN predicted_minutes > 0
      THEN ABS(actual_minutes - predicted_minutes) / predicted_minutes * 100.0
      ELSE NULL
    END
  ) STORED,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(corridor_id, forecast_for)
);

CREATE INDEX IF NOT EXISTS idx_forecast_outcomes_corridor
  ON forecast_outcomes (corridor_id, forecast_for DESC);
