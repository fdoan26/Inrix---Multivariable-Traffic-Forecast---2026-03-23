-- Migration 001: Create TimescaleDB extension and core tables

CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Speed readings hypertable
CREATE TABLE speed_readings (
  segment_id    TEXT        NOT NULL,
  recorded_at   TIMESTAMPTZ NOT NULL,
  speed         REAL,           -- current speed (mph)
  free_flow_speed REAL,         -- INRIX reference speed
  historical_avg  REAL,         -- INRIX average for this time/day
  congestion_score SMALLINT,    -- speedBucket 0-3
  travel_time_min  REAL,        -- travelTimeMinutes from INRIX
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

SELECT create_hypertable('speed_readings', 'recorded_at',
  chunk_time_interval => INTERVAL '1 day'
);

CREATE INDEX idx_speed_segment_time ON speed_readings (segment_id, recorded_at DESC);

-- Incidents table
CREATE TABLE incidents (
  incident_id   TEXT        NOT NULL,
  recorded_at   TIMESTAMPTZ NOT NULL,
  incident_type SMALLINT,       -- 1=Construction, 2=Event, 3=Flow, 4=Incident
  severity      SMALLINT,       -- 0-4
  latitude      REAL,
  longitude     REAL,
  short_desc    TEXT,
  long_desc     TEXT,
  direction     TEXT,
  impacting     BOOLEAN,
  delay_from_typical_min REAL,
  delay_from_freeflow_min REAL,
  status        TEXT,           -- Active/Cleared/Inactive
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

SELECT create_hypertable('incidents', 'recorded_at',
  chunk_time_interval => INTERVAL '1 day'
);

CREATE INDEX idx_incident_time ON incidents (recorded_at DESC);

-- Weather forecasts table
CREATE TABLE weather_forecasts (
  forecast_hour   TIMESTAMPTZ NOT NULL,  -- the hour being forecast
  fetched_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  temperature_c   REAL,
  precipitation_mm REAL,
  visibility_m    REAL,
  weather_code    SMALLINT,    -- WMO code (45/48 = fog)
  wind_speed_kmh  REAL,
  UNIQUE (forecast_hour)
);

SELECT create_hypertable('weather_forecasts', 'forecast_hour',
  chunk_time_interval => INTERVAL '7 days'
);

-- Calendar flags table (regular table, not hypertable)
CREATE TABLE calendar_flags (
  flag_date     DATE        PRIMARY KEY,
  school_day    BOOLEAN     NOT NULL DEFAULT TRUE,
  event_name    TEXT,
  event_type    TEXT         -- 'giants', 'warriors', 'concert', 'festival', etc.
);

-- API call budget log
CREATE TABLE api_call_log (
  id            SERIAL      PRIMARY KEY,
  service       TEXT        NOT NULL,   -- 'inrix_speeds', 'inrix_incidents', 'weather'
  endpoint      TEXT,
  called_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status        TEXT        NOT NULL DEFAULT 'pending',  -- pending/success/error
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
  status        TEXT        NOT NULL DEFAULT 'running',  -- running/success/error/skipped
  records_processed INTEGER DEFAULT 0,
  error_message TEXT
);
