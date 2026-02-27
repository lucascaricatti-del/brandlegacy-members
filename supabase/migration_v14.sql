-- migration_v14.sql — CRM Comercial BrandLegacy

-- Funis de venda
CREATE TABLE IF NOT EXISTS funnels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  product text NOT NULL,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Leads do CRM (diferente da tabela 'leads' usada para aulas gratuitas)
CREATE TABLE IF NOT EXISTS crm_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funnel_id uuid REFERENCES funnels(id),
  name text NOT NULL,
  email text NOT NULL,
  whatsapp text,
  revenue_range text,
  business_segment text,
  status text DEFAULT 'novo',
  assigned_to uuid REFERENCES profiles(id),
  utm_source text,
  utm_medium text,
  utm_campaign text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Notas/histórico de interações com leads
CREATE TABLE IF NOT EXISTS crm_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES crm_leads(id) ON DELETE CASCADE,
  author_id uuid REFERENCES profiles(id),
  content text NOT NULL,
  contact_type text DEFAULT 'note',
  created_at timestamptz DEFAULT now()
);

-- Desabilitar RLS (admin-only via service role)
ALTER TABLE funnels DISABLE ROW LEVEL SECURITY;
ALTER TABLE crm_leads DISABLE ROW LEVEL SECURITY;
ALTER TABLE crm_notes DISABLE ROW LEVEL SECURITY;

-- Funil padrão
INSERT INTO funnels (name, slug, product, description) VALUES
  ('Funil Imersão', 'imersao', 'imersao', 'Leads interessados na Imersão BrandLegacy');
