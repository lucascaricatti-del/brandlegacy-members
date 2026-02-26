-- ============================================================
-- BrandLegacy Members — Migration v4
-- Adiciona coluna link_call em deliveries
-- Execute no SQL Editor do Supabase APÓS migration_v3.sql
-- ============================================================

ALTER TABLE public.deliveries ADD COLUMN link_call text;

COMMENT ON COLUMN public.deliveries.link_call IS
  'Link da call (Google Meet, Zoom, etc.) para o agendamento da entrega. Preenchido pelo admin.';
