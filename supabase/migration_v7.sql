-- Migration v7: Sessões de Análise de Transcrição com IA
-- Rodar APÓS migration_v6.sql

-- ============================================================
-- SESSIONS — sessões de mentoria com transcrições
-- ============================================================
CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  title text NOT NULL,
  session_date date,
  transcript text,
  summary text,
  decisions text,
  risks text,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- SESSION_TASKS — tarefas extraídas pela IA
-- ============================================================
CREATE TABLE IF NOT EXISTS session_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES sessions(id) ON DELETE CASCADE,
  workspace_id uuid REFERENCES workspaces(id),
  title text NOT NULL,
  responsible text,
  due_date date,
  priority text DEFAULT 'media',
  kanban_card_id uuid REFERENCES kanban_cards(id),
  created_at timestamptz DEFAULT now()
);

-- Desabilita RLS (acesso via adminClient — bypass)
ALTER TABLE sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE session_tasks DISABLE ROW LEVEL SECURITY;
