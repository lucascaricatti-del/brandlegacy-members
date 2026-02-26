-- migration_v5.sql
-- Remove a policy de RLS que filtra módulos por plano no banco de dados.
-- A filtragem agora é feita no código Next.js (server-side) usando adminClient,
-- permitindo que as páginas /modulos e /masterclasses carreguem todos os módulos
-- publicados e filtrem por plano do usuário no código.

DROP POLICY IF EXISTS "modules: aluno acessa com plano" ON public.modules;
