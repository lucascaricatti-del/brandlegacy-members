-- GA4 Metrics table
CREATE TABLE IF NOT EXISTS ga4_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL,
  date DATE NOT NULL,
  sessions INTEGER DEFAULT 0,
  organic_sessions INTEGER DEFAULT 0,
  paid_sessions INTEGER DEFAULT 0,
  direct_sessions INTEGER DEFAULT 0,
  social_sessions INTEGER DEFAULT 0,
  users INTEGER DEFAULT 0,
  new_users INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, date)
);

ALTER TABLE ga4_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ga4_metrics_workspace" ON ga4_metrics FOR ALL USING (
  workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
);
