-- =====================================================================
-- Migracion: agrega tipo 'quantity' a product_option_groups y columna
-- quantity a order_item_options. Idempotente, puede correrse N veces.
-- =====================================================================
-- Postgres solo ejecuta los scripts de /docker-entrypoint-initdb.d
-- la PRIMERA vez que crea el volumen, asi que para BDs ya existentes
-- hay que aplicar esta migracion manualmente:
--   docker exec -i pedidos_db psql -U pedidos -d pedidos < db/03_migrate_quantity.sql
-- =====================================================================

-- 1) Permitir 'quantity' en el CHECK de tipo
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'product_option_groups_type_check'
  ) THEN
    ALTER TABLE product_option_groups DROP CONSTRAINT product_option_groups_type_check;
  END IF;
END $$;

ALTER TABLE product_option_groups
  ADD CONSTRAINT product_option_groups_type_check
  CHECK (type IN ('single','multi','quantity'));

-- 2) Columna quantity en order_item_options (default 1, > 0)
ALTER TABLE order_item_options
  ADD COLUMN IF NOT EXISTS quantity INT NOT NULL DEFAULT 1;

-- check constraint solo si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'order_item_options_quantity_check'
  ) THEN
    ALTER TABLE order_item_options
      ADD CONSTRAINT order_item_options_quantity_check CHECK (quantity > 0);
  END IF;
END $$;
