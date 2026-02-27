-- migration_v13_data.sql — Migrar dados existentes para BrandLegacy Academy
-- Rodar DEPOIS de migration_v13.sql (que adiciona a coluna category + tabela leads)
--
-- Problema: módulos criados antes da v13 não têm category preenchido,
-- fazendo com que não apareçam nos carrosséis da Academy.
--
-- Esta migration resolve: atribui category com base no content_type existente.

-- 1. Módulos do tipo 'course' (sem category ou category=mentoria) → mentoria
UPDATE modules
SET category = 'mentoria'
WHERE content_type = 'course'
  AND (category IS NULL OR category = 'mentoria');

-- 2. Módulos do tipo 'masterclass' → masterclass
UPDATE modules
SET category = 'masterclass'
WHERE content_type = 'masterclass'
  AND (category IS NULL OR category = 'masterclass');

-- 3. Módulos legados do tipo 'webinar' → masterclass (migração de tipo antigo)
UPDATE modules
SET category = 'masterclass'
WHERE content_type = 'webinar'
  AND (category IS NULL);

-- 4. Catch-all: qualquer módulo restante sem category → mentoria
UPDATE modules
SET category = 'mentoria'
WHERE category IS NULL;

-- Verificação: listar todos os módulos com suas categorias
-- SELECT id, title, content_type, category, is_published FROM modules ORDER BY order_index;
