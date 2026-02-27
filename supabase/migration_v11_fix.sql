-- ============================================================
-- Migration v11 FIX: Garante que financial_info + tasks existam
-- Consolida v11 + v12 (start_date, renewal_date)
-- Rodar no Supabase SQL Editor
-- ============================================================

-- 1. Tabela financial_info (informações financeiras por workspace)
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
  start_date date,
  renewal_date date,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(workspace_id)
);

ALTER TABLE financial_info DISABLE ROW LEVEL SECURITY;

-- 2. Tabela tasks (task flow por workspace)
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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tasks_workspace ON tasks(workspace_id, is_archived, status);
CREATE INDEX IF NOT EXISTS idx_tasks_session ON tasks(session_id);
CREATE INDEX IF NOT EXISTS idx_financial_info_workspace ON financial_info(workspace_id);

-- Colunas v12 (caso tabela já exista sem elas)
ALTER TABLE financial_info ADD COLUMN IF NOT EXISTS start_date date;
ALTER TABLE financial_info ADD COLUMN IF NOT EXISTS renewal_date date;
