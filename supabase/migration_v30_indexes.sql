-- migration_v30_indexes.sql
-- Performance indexes for common query patterns

-- yampi_orders: workspace + date (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_yampi_orders_workspace_date
  ON yampi_orders (workspace_id, date);

-- yampi_orders: workspace + date + status (filtered queries)
CREATE INDEX IF NOT EXISTS idx_yampi_orders_workspace_date_status
  ON yampi_orders (workspace_id, date, status);

-- yampi_orders: workspace + coupon (influencer performance)
CREATE INDEX IF NOT EXISTS idx_yampi_orders_workspace_coupon
  ON yampi_orders (workspace_id, coupon_code) WHERE coupon_code IS NOT NULL;

-- ads_metrics: workspace + provider + date
CREATE INDEX IF NOT EXISTS idx_ads_metrics_workspace_provider_date
  ON ads_metrics (workspace_id, provider, date);

-- ga4_metrics: workspace + date
CREATE INDEX IF NOT EXISTS idx_ga4_metrics_workspace_date
  ON ga4_metrics (workspace_id, date);

-- influencer_sequences: influencer_id
CREATE INDEX IF NOT EXISTS idx_influencer_sequences_influencer
  ON influencer_sequences (influencer_id);

-- influencers: workspace + active
CREATE INDEX IF NOT EXISTS idx_influencers_workspace_active
  ON influencers (workspace_id, is_active);

-- yampi_metrics: workspace + date
CREATE INDEX IF NOT EXISTS idx_yampi_metrics_workspace_date
  ON yampi_metrics (workspace_id, date);

-- workspace_integrations: workspace + provider
CREATE INDEX IF NOT EXISTS idx_workspace_integrations_provider
  ON workspace_integrations (workspace_id, provider);
