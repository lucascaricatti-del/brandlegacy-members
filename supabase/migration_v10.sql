-- ============================================================
-- Migration v10: Integrações com plataformas externas
-- ============================================================

-- Tabela de integrações (tokens e configs por workspace/plataforma)
CREATE TABLE IF NOT EXISTS integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN ('meta_ads', 'google_ads', 'ga4', 'shopify')),
  access_token text NOT NULL,
  refresh_token text,
  account_id text,
  extra_config jsonb DEFAULT '{}'::jsonb,
  is_active boolean DEFAULT true,
  last_sync timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(workspace_id, platform)
);

-- Tabela de métricas coletadas
CREATE TABLE IF NOT EXISTS integration_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN ('meta_ads', 'google_ads', 'ga4', 'shopify')),
  metric_date date NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  UNIQUE(workspace_id, platform, metric_date)
);

-- Index para queries de métricas por período
CREATE INDEX IF NOT EXISTS idx_integration_metrics_lookup
  ON integration_metrics(workspace_id, platform, metric_date DESC);

-- RLS desabilitado (mesmo padrão das outras tabelas — acesso via adminClient)
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_metrics ENABLE ROW LEVEL SECURITY;
