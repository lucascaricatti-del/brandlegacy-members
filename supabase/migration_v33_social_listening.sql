-- migration_v33: Social Listening — mentions tracking and config

-- 1. Table: social_mentions
CREATE TABLE IF NOT EXISTS social_mentions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  media_id TEXT NOT NULL,
  media_type TEXT,
  media_url TEXT,
  thumbnail_url TEXT,
  permalink TEXT,
  caption TEXT,
  username TEXT,
  mention_type TEXT, -- 'tag' | 'hashtag' | 'comment'
  hashtag TEXT,
  like_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  timestamp TIMESTAMPTZ,
  status TEXT DEFAULT 'new',
  claude_analysis JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, platform, media_id)
);

CREATE INDEX IF NOT EXISTS idx_social_mentions_ws_platform
  ON social_mentions (workspace_id, platform, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_social_mentions_ws_status
  ON social_mentions (workspace_id, status);

-- 2. Table: social_listening_config
CREATE TABLE IF NOT EXISTS social_listening_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE UNIQUE,
  ig_hashtags TEXT[] DEFAULT '{}',
  tiktok_hashtags TEXT[] DEFAULT '{}',
  last_sync_mentions TIMESTAMPTZ,
  last_sync_hashtags TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. RLS policies
ALTER TABLE social_mentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_listening_config ENABLE ROW LEVEL SECURITY;

-- social_mentions policies
CREATE POLICY "mentions_member_select" ON social_mentions
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "mentions_member_insert" ON social_mentions
  FOR INSERT WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "mentions_member_update" ON social_mentions
  FOR UPDATE USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "mentions_admin_all" ON social_mentions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "mentions_service_role" ON social_mentions
  FOR ALL USING (auth.role() = 'service_role');

-- social_listening_config policies
CREATE POLICY "config_member_select" ON social_listening_config
  FOR SELECT USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "config_member_insert" ON social_listening_config
  FOR INSERT WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "config_member_update" ON social_listening_config
  FOR UPDATE USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "config_admin_all" ON social_listening_config
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "config_service_role" ON social_listening_config
  FOR ALL USING (auth.role() = 'service_role');
