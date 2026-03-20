-- Add duration_minutes column for INRIX Duration short-term forecast (0-2hr)
ALTER TABLE speed_readings ADD COLUMN IF NOT EXISTS duration_minutes REAL;
