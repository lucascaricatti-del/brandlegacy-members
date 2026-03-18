-- migration_v32: Marketplace Consolidated — manual metrics + tax config on workspaces

-- 1. Table: marketplace_manual_metrics (daily entries per marketplace)
CREATE TABLE IF NOT EXISTS marketplace_manual_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  marketplace TEXT NOT NULL,
  date DATE NOT NULL,
  revenue DECIMAL(12,2) DEFAULT 0,
  orders INTEGER DEFAULT 0,
  tax_rate_percent DECIMAL(5,2) DEFAULT 0,
  shipping_rate_percent DECIMAL(5,2) DEFAULT 0,
  ads_investment DECIMAL(12,2) DEFAULT 0,
  other_costs DECIMAL(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, marketplace, date)
);

CREATE INDEX IF NOT EXISTS idx_manual_metrics_ws_date
  ON marketplace_manual_metrics (workspace_id, date);

-- 2. Add marketplace_tax_config JSONB column to workspaces
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS
  marketplace_tax_config JSONB DEFAULT '{}';

-- 3. RLS
ALTER TABLE marketplace_manual_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_access_marketplace" ON marketplace_manual_metrics
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND is_active = true
    )
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    OR auth.role() = 'service_role'
  );
