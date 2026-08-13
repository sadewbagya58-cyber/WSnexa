-- Phase 24: Launch Readiness Migration
-- Adds pilot demo tracking column to businesses and ensures RLS status

ALTER TABLE businesses 
ADD COLUMN IF NOT EXISTS is_pilot_demo BOOLEAN DEFAULT FALSE;

-- Create index for pilot demo filtering if not exists
CREATE INDEX IF NOT EXISTS idx_businesses_is_pilot_demo ON businesses(is_pilot_demo) WHERE is_pilot_demo = TRUE;
