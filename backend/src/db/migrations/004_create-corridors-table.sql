-- Migration 004: Corridor-to-segment mapping table

CREATE TABLE corridors (
  corridor_id  TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  segment_ids  TEXT[] NOT NULL
);

INSERT INTO corridors (corridor_id, display_name, segment_ids) VALUES
  ('us-101',      'US-101',              ARRAY['TMC_PLACEHOLDER']),
  ('i-280',       'I-280',               ARRAY['TMC_PLACEHOLDER']),
  ('bay-bridge',  'Bay Bridge Approach',  ARRAY['TMC_PLACEHOLDER']),
  ('van-ness',    'Van Ness Ave',         ARRAY['TMC_PLACEHOLDER']),
  ('19th-ave',    '19th Ave',             ARRAY['TMC_PLACEHOLDER']),
  ('market-st',   'Market St',            ARRAY['TMC_PLACEHOLDER']);
