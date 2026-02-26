-- Migration v6: Adiciona labels e attachments (JSONB) nos kanban_cards
-- Rodar APÓS migration_v5.sql

ALTER TABLE kanban_cards
  ADD COLUMN IF NOT EXISTS labels jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS attachments jsonb DEFAULT '[]'::jsonb;

-- labels: array de { id: string, text: string, color: string }
-- attachments: array de { id: string, title: string, url: string, created_at: string }
