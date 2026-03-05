-- migration_v18: Manual costs table for ML marketplace

CREATE TABLE IF NOT EXISTS ml_manual_costs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL,
  month DATE NOT NULL,
  ml_ads_cost NUMERIC(10,2) DEFAULT 0,
  ml_fulfillment_cost NUMERIC(10,2) DEFAULT 0,
  ml_return_fee NUMERIC(10,2) DEFAULT 0,
  ml_other_fees NUMERIC(10,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, month)
);
ALTER TABLE ml_manual_costs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "manual_costs_workspace" ON ml_manual_costs FOR ALL USING (
  workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
);
