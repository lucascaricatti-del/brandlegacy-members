-- ============================================================
-- BrandLegacy Members — Migration v3
-- Tabelas: deliveries, delivery_materials
-- Execute no SQL Editor do Supabase APÓS migration_v2.sql
-- ============================================================
-- ORDEM DE EXECUÇÃO:
-- 1. Tabela deliveries
-- 2. Tabela delivery_materials
-- 3. RLS policies
-- 4. Comentários de seed (rodar manualmente por workspace)
-- ============================================================

-- ============================================================
-- BLOCO 1: Tabela deliveries
-- ============================================================

CREATE TABLE public.deliveries (
  id             uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id   uuid        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  contract_id    uuid        REFERENCES public.mentoring_contracts(id) ON DELETE SET NULL,
  title          text        NOT NULL,
  order_index    integer     NOT NULL DEFAULT 0,
  status         text        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'scheduled', 'completed')),
  scheduled_date date,
  completed_date date,
  notes          text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.deliveries IS 'Entregas do contrato de mentoria por workspace. Criadas pelo admin de acordo com o plano.';
COMMENT ON COLUMN public.deliveries.status IS 'pending=aguardando agendamento, scheduled=data marcada, completed=entregue';

CREATE TRIGGER update_deliveries_updated_at
  BEFORE UPDATE ON public.deliveries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE INDEX idx_deliveries_workspace ON public.deliveries(workspace_id, order_index);
CREATE INDEX idx_deliveries_contract  ON public.deliveries(contract_id);
CREATE INDEX idx_deliveries_status    ON public.deliveries(status);

-- ============================================================
-- BLOCO 2: Tabela delivery_materials
-- ============================================================

CREATE TABLE public.delivery_materials (
  id          uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  delivery_id uuid        NOT NULL REFERENCES public.deliveries(id) ON DELETE CASCADE,
  title       text        NOT NULL,
  type        text        NOT NULL CHECK (type IN ('video', 'material')),
  url         text,        -- link YouTube / Panda (type=video) ou link externo (type=material)
  file_url    text,        -- link direto de PDF / arquivo (type=material)
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.delivery_materials IS 'Materiais e vídeos vinculados a cada entrega. Videos são embutidos; PDFs são baixados.';
COMMENT ON COLUMN public.delivery_materials.type IS 'video=embed YouTube/Panda; material=PDF/link para download';
COMMENT ON COLUMN public.delivery_materials.url IS 'Para vídeos: link YouTube/Panda a ser embutido. Para materiais: link externo.';
COMMENT ON COLUMN public.delivery_materials.file_url IS 'Para PDFs/arquivos: URL de download direto.';

CREATE INDEX idx_delivery_materials_delivery ON public.delivery_materials(delivery_id);

-- ============================================================
-- BLOCO 3: RLS
-- ============================================================

ALTER TABLE public.deliveries         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_materials ENABLE ROW LEVEL SECURITY;

-- ---- DELIVERIES ----

CREATE POLICY "deliveries: membro ve"
  ON public.deliveries FOR SELECT
  USING (public.is_workspace_member(workspace_id) OR public.is_internal_team());

CREATE POLICY "deliveries: admin gerencia"
  ON public.deliveries FOR ALL
  USING (public.is_admin());

-- ---- DELIVERY_MATERIALS ----

CREATE POLICY "delivery_materials: membro ve"
  ON public.delivery_materials FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.deliveries d
      WHERE d.id = delivery_id
        AND (public.is_workspace_member(d.workspace_id) OR public.is_internal_team())
    )
  );

CREATE POLICY "delivery_materials: admin gerencia"
  ON public.delivery_materials FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.deliveries d
      WHERE d.id = delivery_id
        AND public.is_admin()
    )
  );

-- ============================================================
-- BLOCO 4: Seeds (descomentar e substituir IDs para usar)
-- ============================================================

-- Plano Club (6 entregas) — substitua <workspace_id> e <contract_id>:
-- INSERT INTO public.deliveries (workspace_id, contract_id, title, order_index) VALUES
--   ('<workspace_id>', '<contract_id>', 'Diagnóstico Estratégico', 1),
--   ('<workspace_id>', '<contract_id>', 'Plano de Ação',           2),
--   ('<workspace_id>', '<contract_id>', 'Mentoria 1',              3),
--   ('<workspace_id>', '<contract_id>', 'Mentoria 2',              4),
--   ('<workspace_id>', '<contract_id>', 'Mentoria 3',              5),
--   ('<workspace_id>', '<contract_id>', 'Mentoria 4',              6);

-- Plano Tração (3 entregas) — substitua <workspace_id> e <contract_id>:
-- INSERT INTO public.deliveries (workspace_id, contract_id, title, order_index) VALUES
--   ('<workspace_id>', '<contract_id>', 'Diagnóstico Estratégico', 1),
--   ('<workspace_id>', '<contract_id>', 'Plano de Ação',           2),
--   ('<workspace_id>', '<contract_id>', 'Mentoria 1',              3);
