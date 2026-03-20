-- Migration 003: Create forecasts hypertable

CREATE TABLE forecasts (
  corridor_id      TEXT        NOT NULL,
  forecast_for     TIMESTAMPTZ NOT NULL,
  predicted_minutes REAL       NOT NULL,
  p10_minutes      REAL        NOT NULL,
  p50_minutes      REAL        NOT NULL,
  p90_minutes      REAL        NOT NULL,
  model_version    TEXT        NOT NULL,
  weather_modifier REAL,
  event_modifier   REAL,
  school_modifier  REAL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

SELECT create_hypertable('forecasts', 'forecast_for',
  chunk_time_interval => INTERVAL '7 days'
);

CREATE INDEX idx_forecasts_corridor_time
  ON forecasts (corridor_id, forecast_for DESC);

ALTER TABLE forecasts SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'corridor_id',
  timescaledb.compress_orderby = 'forecast_for DESC'
);

SELECT add_compression_policy('forecasts', INTERVAL '30 days');
