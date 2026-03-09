-- migration_v21: Influencers table for coupon-based tracking

CREATE TABLE IF NOT EXISTS influencers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL,
  name TEXT NOT NULL,
  instagram TEXT,
  category TEXT,
  coupon_code TEXT NOT NULL,
  fee_type TEXT NOT NULL DEFAULT 'fixed',
  monthly_fee NUMERIC(10,2) DEFAULT 0,
  commission_pct NUMERIC(5,2) DEFAULT 0,
  start_date DATE,
  notes TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, coupon_code)
);

ALTER TABLE influencers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "influencers_workspace" ON influencers FOR ALL USING (
  workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
);
