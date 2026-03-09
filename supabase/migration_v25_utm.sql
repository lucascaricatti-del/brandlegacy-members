-- Migration v25: UTM tracking columns on influencers
-- Run AFTER migration_v24

ALTER TABLE influencers
  ADD COLUMN IF NOT EXISTS utm_url TEXT,
  ADD COLUMN IF NOT EXISTS utm_source TEXT,
  ADD COLUMN IF NOT EXISTS utm_medium TEXT DEFAULT 'influencer',
  ADD COLUMN IF NOT EXISTS utm_campaign TEXT,
  ADD COLUMN IF NOT EXISTS utm_full_url TEXT;
