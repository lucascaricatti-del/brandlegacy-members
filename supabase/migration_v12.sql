-- migration_v12.sql
-- 1. admin_role em profiles (níveis de admin)
-- 2. start_date e renewal_date em financial_info

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS admin_role text DEFAULT 'admin';
ALTER TABLE financial_info ADD COLUMN IF NOT EXISTS start_date date;
ALTER TABLE financial_info ADD COLUMN IF NOT EXISTS renewal_date date;
