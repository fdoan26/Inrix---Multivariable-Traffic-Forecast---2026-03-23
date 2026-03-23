-- Migration 001: Create core tables (plain Postgres, no TimescaleDB)

-- Speed readings table
CREATE TABLE speed_readings (
  segment_id    TEXT        NOT NULL,
  recorded_at   TIMESTAMPTZ NOT NULL,
  speed         REAL,
  free_flow_speed REAL,
  historical_avg  REAL,
  congestion_score SMALLINT,
  travel_time_min  REAL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_speed_segment_time ON speed_readings (segment_id, recorded_at DESC);

-- Incidents table
CREATE TABLE incidents (
  incident_id   TEXT        NOT NULL,
  recorded_at   TIMESTAMPTZ NOT NULL,
  incident_type SMALLINT,
  severity      SMALLINT,
  latitude      REAL,
  longitude     REAL,
  short_desc    TEXT,
  long_desc     TEXT,
  direction     TEXT,
  impacting     BOOLEAN,
  delay_from_typical_min REAL,
  delay_from_freeflow_min REAL,
  status        TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_incident_time ON incidents (recorded_at DESC);

-- Weather forecasts table
CREATE TABLE weather_forecasts (
  forecast_hour   TIMESTAMPTZ NOT NULL,
  fetched_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  temperature_c   REAL,
  precipitation_mm REAL,
  visibility_m    REAL,
  weather_code    SMALLINT,
  wind_speed_kmh  REAL,
  UNIQUE (forecast_hour)
);

-- Calendar flags table
CREATE TABLE calendar_flags (
  flag_date     DATE        PRIMARY KEY,
  school_day    BOOLEAN     NOT NULL DEFAULT TRUE,
  event_name    TEXT,
  event_type    TEXT
);

-- API call budget log
CREATE TABLE api_call_log (
  id            SERIAL      PRIMARY KEY,
  service       TEXT        NOT NULL,
  endpoint      TEXT,
  called_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status        TEXT        NOT NULL DEFAULT 'pending',
  status_code   SMALLINT,
  response_time_ms INTEGER,
  error_message TEXT
);

CREATE INDEX idx_call_log_service_time ON api_call_log (service, called_at DESC);

-- Job execution log
CREATE TABLE job_log (
  id            SERIAL      PRIMARY KEY,
  job_name      TEXT        NOT NULL,
  started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at   TIMESTAMPTZ,
  status        TEXT        NOT NULL DEFAULT 'running',
  records_processed INTEGER DEFAULT 0,
  error_message TEXT
);
