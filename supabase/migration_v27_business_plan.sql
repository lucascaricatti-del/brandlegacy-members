-- Migration v27: Business Plan enhancements
-- Run AFTER migration_v26

-- Add imported_from_midia_plan flag to sales_forecast
ALTER TABLE sales_forecast
  ADD COLUMN IF NOT EXISTS imported_from_midia_plan BOOLEAN DEFAULT FALSE;
