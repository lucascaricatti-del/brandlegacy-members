-- migration_v29_realizado_manual.sql
-- Add is_realizado column for manual "realizado" (actuals) input alongside "previsto" (forecast)

-- 1. Add column to media_plan_metrics
ALTER TABLE media_plan_metrics ADD COLUMN IF NOT EXISTS is_realizado BOOLEAN DEFAULT FALSE;
UPDATE media_plan_metrics SET is_realizado = FALSE WHERE is_realizado IS NULL;

-- 2. Add column to sales_forecast
ALTER TABLE sales_forecast ADD COLUMN IF NOT EXISTS is_realizado BOOLEAN DEFAULT FALSE;
UPDATE sales_forecast SET is_realizado = FALSE WHERE is_realizado IS NULL;

-- 3. Update unique constraints to include is_realizado
-- media_plan_metrics: (media_plan_id, metric_key, month) → (media_plan_id, metric_key, month, is_realizado)
ALTER TABLE media_plan_metrics DROP CONSTRAINT IF EXISTS media_plan_metrics_media_plan_id_metric_key_month_key;
ALTER TABLE media_plan_metrics
  ADD CONSTRAINT media_plan_metrics_plan_key_month_real_key
  UNIQUE (media_plan_id, metric_key, month, is_realizado);

-- sales_forecast: (workspace_id, year, month, channel) → (workspace_id, year, month, channel, is_realizado)
ALTER TABLE sales_forecast DROP CONSTRAINT IF EXISTS sales_forecast_workspace_id_year_month_channel_key;
ALTER TABLE sales_forecast
  ADD CONSTRAINT sales_forecast_ws_year_month_ch_real_key
  UNIQUE (workspace_id, year, month, channel, is_realizado);
