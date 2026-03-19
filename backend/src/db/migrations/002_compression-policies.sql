-- Migration 002: Enable compression (run after initial data collection begins)

ALTER TABLE speed_readings SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'segment_id',
  timescaledb.compress_orderby = 'recorded_at DESC'
);

-- Compress chunks older than 7 days
SELECT add_compression_policy('speed_readings', INTERVAL '7 days');

ALTER TABLE incidents SET (
  timescaledb.compress,
  timescaledb.compress_orderby = 'recorded_at DESC'
);

SELECT add_compression_policy('incidents', INTERVAL '7 days');
