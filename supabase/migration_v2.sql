-- ============================================================
-- BrandLegacy Members — Migration v2
-- Execute no SQL Editor do Supabase APÓS o schema.sql inicial
-- ============================================================
-- ORDEM DE EXECUÇÃO:
-- 1. Expandir profiles.role
-- 2. Novos campos em modules
-- 3. workspaces + workspace_members
-- 4. content_access + user_can_access_module()
-- 5. mentoring_contracts + financial_records
-- 6. kanban_boards + kanban_columns + kanban_cards + card_comments
-- 7. internal_contacts
-- 8. RLS policies (todas as novas tabelas + atualizar modules)
-- ============================================================

-- ============================================================
-- BLOCO 1: Expandir profiles.role
-- Verificar nome exato da constraint ANTES de rodar:
-- SELECT conname FROM pg_constraint
--   WHERE conrelid = 'public.profiles'::regclass AND contype = 'c';
-- ============================================================

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('student', 'admin', 'cx', 'financial', 'mentor'));

-- Funções auxiliares para novas roles
CREATE OR REPLACE FUNCTION public.is_internal_team()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'cx', 'financial', 'mentor')
  );
$$;

CREATE OR REPLACE FUNCTION public.has_role(check_role text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = check_role
  );
$$;

CREATE OR REPLACE FUNCTION public.is_workspace_member(ws_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = ws_id
      AND user_id = auth.uid()
      AND is_active = true
  );
$$;

-- Hierarquia de roles: viewer < collaborator < manager < admin < owner
CREATE OR REPLACE FUNCTION public.workspace_role_gte(ws_id uuid, min_role text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH role_order(role_name, ord) AS (
    VALUES
      ('viewer', 1),
      ('collaborator', 2),
      ('manager', 3),
      ('admin', 4),
      ('owner', 5)
  )
  SELECT EXISTS (
    SELECT 1
    FROM public.workspace_members wm
    JOIN role_order ro ON ro.role_name = wm.role
    WHERE wm.workspace_id = ws_id
      AND wm.user_id = auth.uid()
      AND wm.is_active = true
      AND ro.ord >= (SELECT ord FROM role_order WHERE role_name = min_role)
  );
$$;

-- ============================================================
-- BLOCO 2: Novos campos em modules
-- Defaults seguros: content_type='course', min_plan='free'
-- Módulos existentes continuam visíveis para alunos sem plano
-- ============================================================

ALTER TABLE public.modules
  ADD COLUMN IF NOT EXISTS content_type text NOT NULL DEFAULT 'course'
    CHECK (content_type IN ('course', 'masterclass', 'webinar')),
  ADD COLUMN IF NOT EXISTS min_plan text NOT NULL DEFAULT 'free'
    CHECK (min_plan IN ('free', 'tracao', 'club')),
  ADD COLUMN IF NOT EXISTS webinar_open_to_all boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.modules.content_type IS 'Tipo: course (acesso por plano), masterclass (liberado manualmente por workspace), webinar (todos ou específicos)';
COMMENT ON COLUMN public.modules.min_plan IS 'Plano mínimo para acesso (apenas para content_type=course)';
COMMENT ON COLUMN public.modules.webinar_open_to_all IS 'Se false, admin restringe o webinar via content_access';

-- ============================================================
-- BLOCO 3: Workspaces e membros
-- ============================================================

CREATE TABLE public.workspaces (
  id          uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        text        NOT NULL,
  slug        text        NOT NULL UNIQUE,
  plan_type   text        NOT NULL DEFAULT 'free'
    CHECK (plan_type IN ('free', 'tracao', 'club')),
  logo_url    text,
  is_active   boolean     NOT NULL DEFAULT true,
  created_by  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.workspaces IS 'Empresa/cliente da BrandLegacy. É a unidade central de acesso e mentorado.';

CREATE TRIGGER update_workspaces_updated_at
  BEFORE UPDATE ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.workspace_members (
  id           uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id uuid        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role         text        NOT NULL DEFAULT 'viewer'
    CHECK (role IN ('owner', 'admin', 'manager', 'collaborator', 'viewer')),
  is_active    boolean     NOT NULL DEFAULT true,
  invited_by   uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  joined_at    timestamptz NOT NULL DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, user_id)
);

COMMENT ON TABLE public.workspace_members IS 'Membros do time de cada workspace (mentorado + equipe da empresa).';

CREATE INDEX idx_workspace_members_user ON public.workspace_members(user_id);
CREATE INDEX idx_workspace_members_workspace ON public.workspace_members(workspace_id);

-- ============================================================
-- BLOCO 4: Content Access + função de verificação de acesso
-- ============================================================

CREATE TABLE public.content_access (
  id           uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id uuid        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  module_id    uuid        NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
  granted_by   uuid        NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  granted_at   timestamptz NOT NULL DEFAULT now(),
  revoked_at   timestamptz,
  notes        text,
  UNIQUE(workspace_id, module_id)
);

COMMENT ON TABLE public.content_access IS 'Liberação manual de masterclasses (e webinars restritos) por workspace.';

CREATE INDEX idx_content_access_workspace ON public.content_access(workspace_id);
CREATE INDEX idx_content_access_module ON public.content_access(module_id);

-- Função central: decide se o usuário pode acessar um módulo
CREATE OR REPLACE FUNCTION public.user_can_access_module(mod_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_module           RECORD;
  v_user_plan        text;
  v_plan_order       int;
  v_required_order   int;
BEGIN
  -- Equipe interna sempre tem acesso total
  IF public.is_internal_team() THEN
    RETURN true;
  END IF;

  -- Busca dados do módulo
  SELECT content_type, min_plan, webinar_open_to_all, is_published
  INTO v_module
  FROM public.modules
  WHERE id = mod_id;

  IF NOT FOUND OR NOT v_module.is_published THEN
    RETURN false;
  END IF;

  -- Webinar aberto a todos autenticados
  IF v_module.content_type = 'webinar' AND v_module.webinar_open_to_all THEN
    RETURN true;
  END IF;

  -- Busca o maior plano do usuário entre todos os workspaces ativos
  SELECT ws.plan_type INTO v_user_plan
  FROM public.workspace_members wm
  JOIN public.workspaces ws ON ws.id = wm.workspace_id
  WHERE wm.user_id = auth.uid()
    AND wm.is_active = true
    AND ws.is_active = true
  ORDER BY
    CASE ws.plan_type
      WHEN 'club'   THEN 3
      WHEN 'tracao' THEN 2
      WHEN 'free'   THEN 1
    END DESC
  LIMIT 1;

  -- Usuário sem workspace = free (só webinar_open_to_all)
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Masterclass: verificar liberação manual
  IF v_module.content_type = 'masterclass' THEN
    RETURN EXISTS (
      SELECT 1
      FROM public.content_access ca
      JOIN public.workspace_members wm ON wm.workspace_id = ca.workspace_id
      WHERE ca.module_id = mod_id
        AND wm.user_id = auth.uid()
        AND wm.is_active = true
        AND ca.revoked_at IS NULL
    );
  END IF;

  -- Webinar restrito: mesma lógica da masterclass
  IF v_module.content_type = 'webinar' AND NOT v_module.webinar_open_to_all THEN
    RETURN EXISTS (
      SELECT 1
      FROM public.content_access ca
      JOIN public.workspace_members wm ON wm.workspace_id = ca.workspace_id
      WHERE ca.module_id = mod_id
        AND wm.user_id = auth.uid()
        AND wm.is_active = true
        AND ca.revoked_at IS NULL
    );
  END IF;

  -- Curso: verificar plano mínimo
  v_plan_order := CASE v_user_plan
    WHEN 'club'   THEN 3
    WHEN 'tracao' THEN 2
    ELSE 1
  END;

  v_required_order := CASE v_module.min_plan
    WHEN 'club'   THEN 3
    WHEN 'tracao' THEN 2
    ELSE 1
  END;

  RETURN v_plan_order >= v_required_order;
END;
$$;

-- ============================================================
-- BLOCO 5: Contratos de Mentoria e Registros Financeiros
-- ============================================================

CREATE TABLE public.mentoring_contracts (
  id                        uuid          PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id              uuid          NOT NULL REFERENCES public.workspaces(id) ON DELETE RESTRICT,
  -- Produto
  plan_type                 text          NOT NULL CHECK (plan_type IN ('tracao', 'club')),
  -- Financeiro
  contract_value_brl        numeric(12,2) NOT NULL DEFAULT 0,
  installments              integer       NOT NULL DEFAULT 1,
  -- Datas
  start_date                date          NOT NULL,
  duration_months           integer       NOT NULL DEFAULT 6,
  renewal_date              date,
  -- Status
  status                    text          NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'cancelled', 'completed', 'renewing')),
  -- Deliverables (configurável por contrato — não hardcode)
  total_deliveries_promised integer       NOT NULL DEFAULT 0,
  deliveries_completed      integer       NOT NULL DEFAULT 0,
  -- Notas internas
  notes                     text,
  created_by                uuid          REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at                timestamptz   NOT NULL DEFAULT now(),
  updated_at                timestamptz   NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.mentoring_contracts IS 'Contrato de mentoria por workspace. Deliverables configuráveis — não hardcode.';

CREATE TRIGGER update_contracts_updated_at
  BEFORE UPDATE ON public.mentoring_contracts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE INDEX idx_contracts_workspace ON public.mentoring_contracts(workspace_id);
CREATE INDEX idx_contracts_status ON public.mentoring_contracts(status);
CREATE INDEX idx_contracts_renewal ON public.mentoring_contracts(renewal_date);

CREATE TABLE public.financial_records (
  id             uuid          PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id   uuid          NOT NULL REFERENCES public.workspaces(id) ON DELETE RESTRICT,
  contract_id    uuid          REFERENCES public.mentoring_contracts(id) ON DELETE SET NULL,
  type           text          NOT NULL CHECK (type IN ('payment', 'refund', 'credit', 'charge')),
  amount_brl     numeric(12,2) NOT NULL,
  description    text,
  due_date       date,
  paid_at        date,
  status         text          NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
  payment_method text,
  notes          text,
  created_by     uuid          REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     timestamptz   NOT NULL DEFAULT now(),
  updated_at     timestamptz   NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.financial_records IS 'Pagamentos, cobranças e reembolsos por workspace.';

CREATE TRIGGER update_financial_records_updated_at
  BEFORE UPDATE ON public.financial_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE INDEX idx_financial_workspace ON public.financial_records(workspace_id);
CREATE INDEX idx_financial_status ON public.financial_records(status);
CREATE INDEX idx_financial_due_date ON public.financial_records(due_date);

-- ============================================================
-- BLOCO 6: Kanban
-- ============================================================

CREATE TABLE public.kanban_boards (
  id           uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id uuid        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title        text        NOT NULL DEFAULT 'Board Principal',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id)
);

COMMENT ON TABLE public.kanban_boards IS '1 board por workspace na v1. Criado automaticamente via trigger.';

CREATE TRIGGER update_kanban_boards_updated_at
  BEFORE UPDATE ON public.kanban_boards
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.kanban_columns (
  id          uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  board_id    uuid        NOT NULL REFERENCES public.kanban_boards(id) ON DELETE CASCADE,
  title       text        NOT NULL,
  order_index integer     NOT NULL DEFAULT 0,
  color       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER update_kanban_columns_updated_at
  BEFORE UPDATE ON public.kanban_columns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE INDEX idx_kanban_columns_board ON public.kanban_columns(board_id, order_index);

CREATE TABLE public.kanban_cards (
  id          uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  column_id   uuid        NOT NULL REFERENCES public.kanban_columns(id) ON DELETE CASCADE,
  title       text        NOT NULL,
  description text,
  assignee_id uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  due_date    date,
  priority    text        NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  order_index integer     NOT NULL DEFAULT 0,
  is_archived boolean     NOT NULL DEFAULT false,
  created_by  uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.kanban_cards IS 'Cards do kanban com assignee, prazo e prioridade.';

CREATE TRIGGER update_kanban_cards_updated_at
  BEFORE UPDATE ON public.kanban_cards
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE INDEX idx_kanban_cards_column ON public.kanban_cards(column_id, order_index);
CREATE INDEX idx_kanban_cards_assignee ON public.kanban_cards(assignee_id);

CREATE TABLE public.card_comments (
  id         uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  card_id    uuid        NOT NULL REFERENCES public.kanban_cards(id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content    text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER update_card_comments_updated_at
  BEFORE UPDATE ON public.card_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE INDEX idx_card_comments_card ON public.card_comments(card_id);

-- Trigger: criar board e colunas padrão automaticamente ao criar workspace
CREATE OR REPLACE FUNCTION public.create_workspace_board()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_board_id uuid;
BEGIN
  INSERT INTO public.kanban_boards (workspace_id, title)
  VALUES (NEW.id, 'Board Principal')
  RETURNING id INTO v_board_id;

  -- Colunas padrão
  INSERT INTO public.kanban_columns (board_id, title, order_index) VALUES
    (v_board_id, 'A fazer', 1),
    (v_board_id, 'Em andamento', 2),
    (v_board_id, 'Em revisão', 3),
    (v_board_id, 'Concluído', 4);

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_workspace_created_create_board
  AFTER INSERT ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.create_workspace_board();

-- ============================================================
-- BLOCO 7: Internal Contacts (log CX)
-- ============================================================

CREATE TABLE public.internal_contacts (
  id               uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id     uuid        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  recorded_by      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  contact_type     text        NOT NULL
    CHECK (contact_type IN ('call', 'email', 'whatsapp', 'meeting', 'note')),
  subject          text,
  content          text        NOT NULL,
  contact_date     timestamptz NOT NULL DEFAULT now(),
  next_action      text,
  next_action_date date,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.internal_contacts IS 'Log de interações CX com os workspaces. Rastreia último contato e próxima ação.';

CREATE TRIGGER update_internal_contacts_updated_at
  BEFORE UPDATE ON public.internal_contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE INDEX idx_internal_contacts_workspace ON public.internal_contacts(workspace_id);
CREATE INDEX idx_internal_contacts_date ON public.internal_contacts(contact_date DESC);

-- ============================================================
-- BLOCO 8: RLS — Habilitar e criar policies para novas tabelas
-- ============================================================

ALTER TABLE public.workspaces        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_access    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mentoring_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kanban_boards     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kanban_columns    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kanban_cards      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.card_comments     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internal_contacts ENABLE ROW LEVEL SECURITY;

-- ---- WORKSPACES ----
CREATE POLICY "workspaces: membro ve o proprio"
  ON public.workspaces FOR SELECT
  USING (public.is_workspace_member(id) OR public.is_internal_team());

CREATE POLICY "workspaces: interno cria"
  ON public.workspaces FOR INSERT
  WITH CHECK (public.is_internal_team());

CREATE POLICY "workspaces: interno ou owner atualiza"
  ON public.workspaces FOR UPDATE
  USING (public.is_admin() OR public.workspace_role_gte(id, 'owner'));

CREATE POLICY "workspaces: admin deleta"
  ON public.workspaces FOR DELETE
  USING (public.is_admin());

-- ---- WORKSPACE_MEMBERS ----
CREATE POLICY "workspace_members: membro ve"
  ON public.workspace_members FOR SELECT
  USING (public.is_workspace_member(workspace_id) OR public.is_internal_team());

CREATE POLICY "workspace_members: admin adiciona"
  ON public.workspace_members FOR INSERT
  WITH CHECK (public.is_internal_team() OR public.workspace_role_gte(workspace_id, 'admin'));

CREATE POLICY "workspace_members: admin atualiza"
  ON public.workspace_members FOR UPDATE
  USING (public.is_internal_team() OR public.workspace_role_gte(workspace_id, 'admin'));

CREATE POLICY "workspace_members: admin remove"
  ON public.workspace_members FOR DELETE
  USING (public.is_internal_team() OR public.workspace_role_gte(workspace_id, 'admin'));

-- ---- CONTENT_ACCESS ----
CREATE POLICY "content_access: membro ve"
  ON public.content_access FOR SELECT
  USING (public.is_workspace_member(workspace_id) OR public.is_internal_team());

CREATE POLICY "content_access: admin libera"
  ON public.content_access FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "content_access: admin revoga"
  ON public.content_access FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "content_access: admin deleta"
  ON public.content_access FOR DELETE
  USING (public.is_admin());

-- ---- MENTORING_CONTRACTS ----
CREATE POLICY "contracts: equipe interna ve"
  ON public.mentoring_contracts FOR SELECT
  USING (public.is_internal_team());

CREATE POLICY "contracts: admin gerencia"
  ON public.mentoring_contracts FOR ALL
  USING (public.is_admin());

-- ---- FINANCIAL_RECORDS ----
CREATE POLICY "financial: equipe financeiro ve"
  ON public.financial_records FOR SELECT
  USING (public.is_admin() OR public.has_role('financial'));

CREATE POLICY "financial: equipe financeiro gerencia"
  ON public.financial_records FOR ALL
  USING (public.is_admin() OR public.has_role('financial'));

-- ---- KANBAN_BOARDS ----
CREATE POLICY "kanban_boards: membro ve"
  ON public.kanban_boards FOR SELECT
  USING (public.is_workspace_member(workspace_id) OR public.is_internal_team());

CREATE POLICY "kanban_boards: interno gerencia"
  ON public.kanban_boards FOR ALL
  USING (public.is_internal_team());

-- ---- KANBAN_COLUMNS ----
CREATE POLICY "kanban_columns: membro ve"
  ON public.kanban_columns FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.kanban_boards kb
      WHERE kb.id = board_id
        AND (public.is_workspace_member(kb.workspace_id) OR public.is_internal_team())
    )
  );

CREATE POLICY "kanban_columns: admin workspace gerencia"
  ON public.kanban_columns FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.kanban_boards kb
      WHERE kb.id = board_id
        AND (public.workspace_role_gte(kb.workspace_id, 'admin') OR public.is_internal_team())
    )
  );

-- ---- KANBAN_CARDS ----
CREATE POLICY "kanban_cards: membro ve"
  ON public.kanban_cards FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.kanban_columns kc
      JOIN public.kanban_boards kb ON kb.id = kc.board_id
      WHERE kc.id = column_id
        AND (public.is_workspace_member(kb.workspace_id) OR public.is_internal_team())
    )
  );

CREATE POLICY "kanban_cards: collaborator cria e edita"
  ON public.kanban_cards FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.kanban_columns kc
      JOIN public.kanban_boards kb ON kb.id = kc.board_id
      WHERE kc.id = column_id
        AND (public.workspace_role_gte(kb.workspace_id, 'collaborator') OR public.is_internal_team())
    )
  );

-- ---- CARD_COMMENTS ----
CREATE POLICY "card_comments: membro ve"
  ON public.card_comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.kanban_cards kca
      JOIN public.kanban_columns kc ON kc.id = kca.column_id
      JOIN public.kanban_boards kb ON kb.id = kc.board_id
      WHERE kca.id = card_id
        AND (public.is_workspace_member(kb.workspace_id) OR public.is_internal_team())
    )
  );

CREATE POLICY "card_comments: membro comenta"
  ON public.card_comments FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.kanban_cards kca
      JOIN public.kanban_columns kc ON kc.id = kca.column_id
      JOIN public.kanban_boards kb ON kb.id = kc.board_id
      WHERE kca.id = card_id
        AND (public.is_workspace_member(kb.workspace_id) OR public.is_internal_team())
    )
  );

CREATE POLICY "card_comments: usuario edita proprio"
  ON public.card_comments FOR UPDATE
  USING (auth.uid() = user_id OR public.is_internal_team());

CREATE POLICY "card_comments: usuario deleta proprio"
  ON public.card_comments FOR DELETE
  USING (auth.uid() = user_id OR public.is_internal_team());

-- ---- INTERNAL_CONTACTS ----
CREATE POLICY "internal_contacts: equipe ve"
  ON public.internal_contacts FOR SELECT
  USING (public.is_internal_team());

CREATE POLICY "internal_contacts: equipe gerencia"
  ON public.internal_contacts FOR ALL
  USING (public.is_internal_team());

-- ---- ATUALIZAR MODULES: Substituir policy de visibilidade ----
DROP POLICY IF EXISTS "modules: aluno ve publicados" ON public.modules;

CREATE POLICY "modules: aluno acessa com plano"
  ON public.modules FOR SELECT
  USING (
    is_published = true
    AND public.user_can_access_module(id)
  );

CREATE POLICY "modules: equipe interna ve tudo"
  ON public.modules FOR SELECT
  USING (public.is_internal_team());

-- ============================================================
-- BLOCO 9: Instruções pós-migração
-- ============================================================

-- 1. Definir roles para equipe interna (substitua os emails):
-- UPDATE public.profiles SET role = 'cx'        WHERE email = 'cx@brandlegacy.com.br';
-- UPDATE public.profiles SET role = 'financial'  WHERE email = 'financeiro@brandlegacy.com.br';
-- UPDATE public.profiles SET role = 'mentor'     WHERE email = 'mentor@brandlegacy.com.br';

-- 2. Para cada aluno existente, criar um workspace e adicioná-lo:
-- INSERT INTO public.workspaces (name, slug, plan_type, created_by)
-- VALUES ('Empresa do Aluno', 'empresa-aluno', 'club', '<admin_user_id>');
-- INSERT INTO public.workspace_members (workspace_id, user_id, role)
-- VALUES ('<workspace_id>', '<user_id>', 'owner');

-- 3. Módulos existentes têm content_type='course' e min_plan='free' por padrão.
--    Para tornar um módulo exclusivo Club:
-- UPDATE public.modules SET min_plan = 'club' WHERE id = '<module_id>';
