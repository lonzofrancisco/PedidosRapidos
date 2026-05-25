-- =====================================================================
-- Indices extra para queries multi-tenant (F6)
-- =====================================================================
-- getOrder() y los listados arrancan filtrando por tenant_id; estos indices
-- compuestos evitan scans cuando crecen las tablas de items.
-- Idempotentes: se pueden correr sobre una DB existente sin romper nada.
-- =====================================================================

CREATE INDEX IF NOT EXISTS idx_order_items_tenant_order
  ON order_items(tenant_id, order_id);

CREATE INDEX IF NOT EXISTS idx_order_item_options_tenant
  ON order_item_options(tenant_id, order_item_id);
