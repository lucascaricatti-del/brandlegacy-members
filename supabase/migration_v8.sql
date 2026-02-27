-- Migration v8: Logs de agentes automatizados
-- Rodar APÓS migration_v7.sql

CREATE TABLE IF NOT EXISTS agent_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id),
  agent_type text DEFAULT 'overdue_checker',
  summary text,
  cards_found int DEFAULT 0,
  email_sent boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE agent_logs DISABLE ROW LEVEL SECURITY;
