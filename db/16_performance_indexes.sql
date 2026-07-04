-- Performance indexes for common queries
-- Applied: Phase 1 resource optimization

-- Composite index for order_item_options queries (attachItems, order views)
CREATE INDEX IF NOT EXISTS idx_oio_tenant_item
  ON order_item_options(tenant_id, order_item_id);

-- Index for trial reminder job (high cardinality filter)
CREATE INDEX IF NOT EXISTS idx_tenants_trial
  ON tenants(plan_status, trial_ends_at DESC, trial_reminder_sent_at)
  WHERE plan_status = 'trial';

-- Index for orders listing (pagination, filtering by date)
CREATE INDEX IF NOT EXISTS idx_orders_tenant_created
  ON orders(tenant_id, created_at DESC);

-- Index for products by active status (storefront listing)
CREATE INDEX IF NOT EXISTS idx_products_tenant_active
  ON products(tenant_id, active DESC)
  WHERE active = TRUE;

-- Index for option groups by product (product detail view)
CREATE INDEX IF NOT EXISTS idx_option_groups_product
  ON product_option_groups(tenant_id, product_id, "position");
