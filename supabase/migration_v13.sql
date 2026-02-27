-- migration_v13.sql — BrandLegacy Academy
-- 1. Adicionar categoria aos módulos (mentoria, masterclass, free_class)
-- 2. Tabela de leads para aulas gravadas

-- Categoria no módulo
ALTER TABLE modules ADD COLUMN IF NOT EXISTS category text DEFAULT 'mentoria';
-- category: 'mentoria' | 'masterclass' | 'free_class'

-- Migrar dados existentes com base no content_type
UPDATE modules SET category = 'mentoria' WHERE content_type = 'course' AND (category IS NULL OR category = 'mentoria');
UPDATE modules SET category = 'masterclass' WHERE content_type = 'masterclass';

-- Tabela de leads para aulas gravadas (captura pública)
CREATE TABLE IF NOT EXISTS leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  module_id uuid REFERENCES modules(id),
  utm_source text,
  utm_campaign text,
  created_at timestamptz DEFAULT now()
);

-- Criar índice único para evitar leads duplicados por email+módulo
CREATE UNIQUE INDEX IF NOT EXISTS leads_email_module_idx ON leads(email, module_id);

ALTER TABLE leads DISABLE ROW LEVEL SECURITY;
