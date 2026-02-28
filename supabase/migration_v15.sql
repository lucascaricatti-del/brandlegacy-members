-- ============================================================
-- Migration v15 — Tasks: checklist, comments, new columns
-- ============================================================

-- Novas colunas na tabela tasks
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed_at timestamptz;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS start_date date;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS tags text[];
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS order_index integer DEFAULT 0;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS file_url text;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS file_name text;

-- Checklist de subitens
CREATE TABLE IF NOT EXISTS task_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  title text NOT NULL,
  is_done boolean DEFAULT false,
  order_index integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE task_checklist_items DISABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_checklist_task ON task_checklist_items(task_id, order_index);

-- Comentários por tarefa
CREATE TABLE IF NOT EXISTS task_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE task_comments DISABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_comments_task ON task_comments(task_id, created_at);

-- ============================================================
-- Planejador Anual de Mídia
-- ============================================================

CREATE TABLE IF NOT EXISTS media_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  year integer NOT NULL,
  name text NOT NULL DEFAULT 'Planejamento Principal',
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(workspace_id, year)
);
ALTER TABLE media_plans DISABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_media_plans_ws ON media_plans(workspace_id, year);

CREATE TABLE IF NOT EXISTS media_plan_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  media_plan_id uuid NOT NULL REFERENCES media_plans(id) ON DELETE CASCADE,
  metric_key text NOT NULL,
  month integer NOT NULL CHECK (month >= 1 AND month <= 12),
  value_numeric numeric,
  delta_pct numeric,
  input_mode text NOT NULL DEFAULT 'value' CHECK (input_mode IN ('value', 'delta_pct')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(media_plan_id, metric_key, month)
);
ALTER TABLE media_plan_metrics DISABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_media_plan_metrics_plan ON media_plan_metrics(media_plan_id, metric_key);
