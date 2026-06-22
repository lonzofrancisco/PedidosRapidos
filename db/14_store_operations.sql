-- Store operations: open/closed, shipping cost, minimum order amount, opening hours
ALTER TABLE tenants
  ADD COLUMN is_open BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN shipping_cost DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN min_order_amount DECIMAL(10,2),
  ADD COLUMN opening_hours JSONB;
