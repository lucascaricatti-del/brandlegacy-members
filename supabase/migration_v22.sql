-- Migration v22: Influencer sequences, renewals, expanded fields

-- Expand influencers table
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'micro';
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS end_date DATE;
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS contract_status TEXT DEFAULT 'active';
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS followers_count INTEGER;
ALTER TABLE influencers ADD COLUMN IF NOT EXISTS niche TEXT;

-- Sequences table (3 content deliveries per contract)
CREATE TABLE IF NOT EXISTS influencer_sequences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  influencer_id UUID NOT NULL REFERENCES influencers(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL,
  sequence_number INTEGER NOT NULL,
  scheduled_date DATE NOT NULL,
  content_type TEXT,
  description TEXT,
  status TEXT DEFAULT 'pending',
  published_at DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE influencer_sequences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sequences_workspace" ON influencer_sequences FOR ALL USING (
  workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
);

-- Renewals table
CREATE TABLE IF NOT EXISTS influencer_renewals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  influencer_id UUID NOT NULL REFERENCES influencers(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL,
  renewal_number INTEGER NOT NULL DEFAULT 1,
  start_date DATE NOT NULL,
  end_date DATE,
  fee_type TEXT NOT NULL DEFAULT 'fixed',
  monthly_fee NUMERIC(10,2) DEFAULT 0,
  commission_pct NUMERIC(5,2) DEFAULT 0,
  notes TEXT,
  is_current BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE influencer_renewals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "renewals_workspace" ON influencer_renewals FOR ALL USING (
  workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
);
