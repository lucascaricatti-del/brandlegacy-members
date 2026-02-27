-- ============================================================
-- Migration v11: financial_info + tasks table
-- ============================================================

-- 1. Tabela financial_info (informações financeiras por workspace)
--    Nota: mentoring_contracts continua existindo separadamente
CREATE TABLE IF NOT EXISTS financial_info (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  plan_name text,
  status text DEFAULT 'active' CHECK (status IN ('active', 'inadimplente', 'cancelled', 'completed')),
  total_value numeric(10,2),
  installments int,
  entry_value numeric(10,2) DEFAULT 0,
  installment_value numeric(10,2),
  first_payment_date date,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(workspace_id)
);

ALTER TABLE financial_info DISABLE ROW LEVEL SECURITY;

-- 2. Tabela tasks (substitui kanban para task flow)
CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  session_id uuid REFERENCES sessions(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  responsible text,
  assignee_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  due_date date,
  priority text DEFAULT 'media' CHECK (priority IN ('baixa', 'media', 'alta', 'urgente')),
  status text DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_andamento', 'concluida')),
  is_archived boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE tasks DISABLE ROW LEVEL SECURITY;

-- Index para queries comuns
CREATE INDEX IF NOT EXISTS idx_tasks_workspace ON tasks(workspace_id, is_archived, status);
CREATE INDEX IF NOT EXISTS idx_tasks_session ON tasks(session_id);
