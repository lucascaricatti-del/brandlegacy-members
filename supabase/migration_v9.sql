-- Migration v9: Sistema de 3 agentes IA por workspace
-- SUBSTITUI a migration_v9 anterior. Rodar APÓS migration_v8.sql.
-- Se já rodou a v9 anterior, rode os DROPs primeiro.

-- ============================================================
-- LIMPA tabelas anteriores (v9 antiga)
-- ============================================================
DROP TABLE IF EXISTS agent_templates CASCADE;
ALTER TABLE sessions DROP COLUMN IF EXISTS agent_template_id;

-- Drop agent_configs antigo (tinha campo context)
DROP TABLE IF EXISTS agent_configs CASCADE;

-- ============================================================
-- WORKSPACE_CONTEXT — contexto do negócio por workspace
-- ============================================================
CREATE TABLE IF NOT EXISTS workspace_context (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE UNIQUE,
  business_type text,
  business_description text,
  monthly_revenue text,
  team_size text,
  main_goal text,
  main_challenge text,
  mentorship_stage text DEFAULT 'inicio',
  extra_context text,
  updated_at timestamptz DEFAULT now()
);

-- ============================================================
-- AGENT_CONFIGS — prompt customizado por agente por workspace
-- ============================================================
CREATE TABLE IF NOT EXISTS agent_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  agent_type text NOT NULL,
  system_prompt text NOT NULL,
  is_active boolean DEFAULT true,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(workspace_id, agent_type)
);

-- ============================================================
-- Novos campos em sessions
-- ============================================================
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS agent_type text DEFAULT 'mentoring',
  ADD COLUMN IF NOT EXISTS diagnosis_session_id uuid REFERENCES sessions(id),
  ADD COLUMN IF NOT EXISTS result_json text;

ALTER TABLE workspace_context DISABLE ROW LEVEL SECURITY;
ALTER TABLE agent_configs DISABLE ROW LEVEL SECURITY;
