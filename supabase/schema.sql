-- ============================================================
-- BrandLegacy Members — Schema Completo do Supabase
-- Execute este arquivo no SQL Editor do Supabase
-- ============================================================

-- ============================================================
-- EXTENSÕES
-- ============================================================
create extension if not exists "uuid-ossp";

-- ============================================================
-- TABELA: profiles
-- Estende auth.users com dados do aluno/admin
-- ============================================================
create table public.profiles (
  id          uuid        references auth.users(id) on delete cascade primary key,
  name        text        not null,
  email       text        not null,
  role        text        not null default 'student' check (role in ('student', 'admin')),
  avatar_url  text,
  is_active   boolean     not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.profiles is 'Perfis de alunos e admins da mentoria BrandLegacy';

-- ============================================================
-- TABELA: modules
-- Módulos do curso (ex: "Branding Estratégico", "Identidade Visual")
-- ============================================================
create table public.modules (
  id            uuid        primary key default uuid_generate_v4(),
  title         text        not null,
  description   text,
  thumbnail_url text,
  order_index   integer     not null default 0,
  is_published  boolean     not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.modules is 'Módulos do curso';

-- ============================================================
-- TABELA: lessons
-- Aulas dentro de cada módulo
-- ============================================================
create table public.lessons (
  id               uuid        primary key default uuid_generate_v4(),
  module_id        uuid        not null references public.modules(id) on delete cascade,
  title            text        not null,
  description      text,
  video_url        text,
  video_type       text        check (video_type in ('youtube', 'panda')) default 'youtube',
  duration_minutes integer     not null default 0,
  order_index      integer     not null default 0,
  is_published     boolean     not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

comment on table public.lessons is 'Aulas de cada módulo';

-- ============================================================
-- TABELA: materials
-- Materiais para download (PDFs) vinculados a aulas ou módulos
-- ============================================================
create table public.materials (
  id           uuid        primary key default uuid_generate_v4(),
  lesson_id    uuid        references public.lessons(id) on delete cascade,
  module_id    uuid        references public.modules(id) on delete cascade,
  title        text        not null,
  file_url     text        not null,
  file_size_kb integer,
  created_at   timestamptz not null default now()
);

comment on table public.materials is 'Materiais para download (PDFs)';

-- ============================================================
-- TABELA: lesson_progress
-- Tracking de progresso: quais aulas o aluno concluiu
-- ============================================================
create table public.lesson_progress (
  id           uuid        primary key default uuid_generate_v4(),
  user_id      uuid        not null references auth.users(id) on delete cascade,
  lesson_id    uuid        not null references public.lessons(id) on delete cascade,
  completed_at timestamptz not null default now(),
  unique(user_id, lesson_id)
);

comment on table public.lesson_progress is 'Progresso do aluno nas aulas';

-- ============================================================
-- FUNÇÃO AUXILIAR: is_admin()
-- Verifica se o usuário atual é admin (security definer = bypassa RLS)
-- ============================================================
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

-- ============================================================
-- FUNÇÃO: handle_new_user()
-- Cria automaticamente o perfil quando um novo usuário se cadastra
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email
  );
  return new;
end;
$$;

-- Trigger: criar perfil ao registrar novo usuário
create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- FUNÇÃO: update_updated_at()
-- Atualiza o campo updated_at automaticamente
-- ============================================================
create or replace function public.update_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Triggers de updated_at
create trigger update_profiles_updated_at
  before update on public.profiles
  for each row execute function public.update_updated_at();

create trigger update_modules_updated_at
  before update on public.modules
  for each row execute function public.update_updated_at();

create trigger update_lessons_updated_at
  before update on public.lessons
  for each row execute function public.update_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

alter table public.profiles        enable row level security;
alter table public.modules         enable row level security;
alter table public.lessons         enable row level security;
alter table public.materials       enable row level security;
alter table public.lesson_progress enable row level security;

-- ---- PROFILES ----
-- Usuário vê/edita apenas o próprio perfil
create policy "profiles: usuario ve o proprio"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles: usuario edita o proprio"
  on public.profiles for update
  using (auth.uid() = id);

-- Admin vê todos os perfis
create policy "profiles: admin ve todos"
  on public.profiles for select
  using (public.is_admin());

-- Admin atualiza qualquer perfil (ex: desativar aluno)
create policy "profiles: admin atualiza todos"
  on public.profiles for update
  using (public.is_admin());

-- ---- MODULES ----
-- Alunos veem apenas módulos publicados
create policy "modules: aluno ve publicados"
  on public.modules for select
  using (is_published = true);

-- Admin vê e gerencia tudo
create policy "modules: admin gerencia tudo"
  on public.modules for all
  using (public.is_admin());

-- ---- LESSONS ----
-- Alunos veem apenas aulas publicadas
create policy "lessons: aluno ve publicadas"
  on public.lessons for select
  using (is_published = true);

-- Admin vê e gerencia tudo
create policy "lessons: admin gerencia tudo"
  on public.lessons for all
  using (public.is_admin());

-- ---- MATERIALS ----
-- Qualquer usuário autenticado pode baixar materiais
create policy "materials: autenticado baixa"
  on public.materials for select
  using (auth.uid() is not null);

-- Admin gerencia materiais
create policy "materials: admin gerencia"
  on public.materials for all
  using (public.is_admin());

-- ---- LESSON_PROGRESS ----
-- Aluno vê apenas o próprio progresso
create policy "progress: usuario ve o proprio"
  on public.lesson_progress for select
  using (auth.uid() = user_id);

-- Aluno insere o próprio progresso
create policy "progress: usuario insere o proprio"
  on public.lesson_progress for insert
  with check (auth.uid() = user_id);

-- Aluno remove o próprio progresso (desmarcar como concluído)
create policy "progress: usuario remove o proprio"
  on public.lesson_progress for delete
  using (auth.uid() = user_id);

-- Admin vê todo o progresso
create policy "progress: admin ve tudo"
  on public.lesson_progress for select
  using (public.is_admin());

-- ============================================================
-- STORAGE: Bucket para materiais (PDFs)
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'materials',
  'materials',
  false,
  52428800, -- 50MB
  array['application/pdf', 'application/zip', 'image/png', 'image/jpeg']
)
on conflict (id) do nothing;

-- Usuário autenticado pode fazer download
create policy "storage materials: autenticado baixa"
  on storage.objects for select
  using (bucket_id = 'materials' and auth.uid() is not null);

-- Admin faz upload
create policy "storage materials: admin upload"
  on storage.objects for insert
  with check (bucket_id = 'materials' and public.is_admin());

-- Admin deleta
create policy "storage materials: admin deleta"
  on storage.objects for delete
  using (bucket_id = 'materials' and public.is_admin());

-- ============================================================
-- DADOS INICIAIS: Criar primeiro admin
-- Substitua 'SEU_EMAIL@EMAIL.COM' pelo seu email
-- Execute DEPOIS de criar sua conta no Supabase Auth
-- ============================================================
-- update public.profiles
-- set role = 'admin'
-- where email = 'SEU_EMAIL@EMAIL.COM';

-- ============================================================
-- EXEMPLO: Módulo e aula de teste (opcional)
-- ============================================================
-- insert into public.modules (title, description, order_index, is_published)
-- values ('Bem-vindo ao BrandLegacy', 'Introdução à mentoria e ao método', 1, true);
