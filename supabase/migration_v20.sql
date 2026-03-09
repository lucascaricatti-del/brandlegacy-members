-- migration_v20: Add missing columns to ml_inventory for rich item data

ALTER TABLE ml_inventory ADD COLUMN IF NOT EXISTS sold_qty INTEGER DEFAULT 0;
ALTER TABLE ml_inventory ADD COLUMN IF NOT EXISTS price NUMERIC(10,2) DEFAULT 0;
ALTER TABLE ml_inventory ADD COLUMN IF NOT EXISTS inventory_id TEXT;
ALTER TABLE ml_inventory ADD COLUMN IF NOT EXISTS logistic_type TEXT;
ALTER TABLE ml_inventory ADD COLUMN IF NOT EXISTS health NUMERIC(4,3);
ALTER TABLE ml_inventory ADD COLUMN IF NOT EXISTS listing_type_id TEXT;
ALTER TABLE ml_inventory ADD COLUMN IF NOT EXISTS thumbnail TEXT;
ALTER TABLE ml_inventory ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
