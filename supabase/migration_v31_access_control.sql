-- ============================================================
-- Migration v31: Access Control — Roles, Permissions, Invites
-- ============================================================

-- 1. Migrate old roles to new set
UPDATE workspace_members SET role = 'mentee' WHERE role = 'viewer';
UPDATE workspace_members SET role = 'manager' WHERE role = 'admin';

-- 2. Drop old constraint, add new
ALTER TABLE workspace_members DROP CONSTRAINT IF EXISTS workspace_members_role_check;
ALTER TABLE workspace_members ADD CONSTRAINT workspace_members_role_check
  CHECK (role IN ('owner', 'manager', 'collaborator', 'mentee'));

-- 3. New columns on workspace_members
ALTER TABLE workspace_members
  ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;

-- 4. Create workspace_invites table
CREATE TABLE IF NOT EXISTS workspace_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'mentee' CHECK (role IN ('manager', 'collaborator', 'mentee')),
  permissions JSONB DEFAULT '{}',
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  invited_by UUID NOT NULL REFERENCES profiles(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'cancelled', 'expired')),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  created_at TIMESTAMPTZ DEFAULT now(),
  accepted_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_workspace_invites_workspace ON workspace_invites(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_invites_email ON workspace_invites(email);
CREATE INDEX IF NOT EXISTS idx_workspace_invites_token ON workspace_invites(token);

-- 5. RLS for workspace_invites
ALTER TABLE workspace_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_invites: admin/internal full access"
  ON workspace_invites FOR ALL
  USING (is_admin() OR is_internal_team());

CREATE POLICY "workspace_invites: member can view own workspace invites"
  ON workspace_invites FOR SELECT
  USING (is_workspace_member(workspace_id));

-- 6. Seed: existing owners keep owner role (no-op, just ensuring)
-- All existing members without explicit role stay as-is after migration above
