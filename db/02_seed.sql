-- =====================================================================
-- Seed de demo: 1 tenant ("burger-demo") + admin + 2 productos con cards
-- =====================================================================
-- Login admin de demo:
--   email:    admin@burger-demo.test
--   password: admin123
-- (hash bcrypt de "admin123" generado con $2a$10$...)
-- =====================================================================

DO $$
DECLARE
  v_tenant_id   UUID;
  v_cat_id      UUID;
  v_product_id  UUID;
  v_group_id    UUID;
BEGIN
  -- Tenant demo
  INSERT INTO tenants (slug, name, whatsapp_number, currency)
  VALUES ('burger-demo', 'Burger Demo', '5215512345678', 'ARS')
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO v_tenant_id;

  IF v_tenant_id IS NULL THEN
    SELECT id INTO v_tenant_id FROM tenants WHERE slug = 'burger-demo';
  END IF;

  -- Admin user (bcrypt de 'admin123')
  INSERT INTO users (tenant_id, email, password_hash, role)
  VALUES (
    v_tenant_id,
    'admin@burger-demo.test',
    '$2a$10$jdtn0ciVAzQW0x12ijCKqeelxd3JeQtTlVrBO.Bk76U7Bc7.ZsA4e',
    'admin'
  ) ON CONFLICT DO NOTHING;

  -- Categoria
  INSERT INTO categories (tenant_id, name, position)
  VALUES (v_tenant_id, 'Hamburguesas', 1)
  RETURNING id INTO v_cat_id;

  -- Producto 1: Hamburguesa Clasica con grupo "Tamano" (single, required) y "Extras" (multi)
  INSERT INTO products (tenant_id, category_id, name, description, price, image_url)
  VALUES (
    v_tenant_id, v_cat_id,
    'Hamburguesa Clasica',
    'Carne 150g, queso cheddar, lechuga, tomate y salsa de la casa.',
    120.00,
    NULL
  )
  RETURNING id INTO v_product_id;

  -- Grupo "Tamano"
  INSERT INTO product_option_groups (tenant_id, product_id, name, type, required, min_select, max_select, position)
  VALUES (v_tenant_id, v_product_id, 'Tamano', 'single', TRUE, 1, 1, 1)
  RETURNING id INTO v_group_id;

  INSERT INTO product_options (tenant_id, group_id, name, price_delta, position) VALUES
    (v_tenant_id, v_group_id, 'Sencilla',  0.00, 1),
    (v_tenant_id, v_group_id, 'Doble',    35.00, 2),
    (v_tenant_id, v_group_id, 'Triple',   65.00, 3);

  -- Grupo "Extras"
  INSERT INTO product_option_groups (tenant_id, product_id, name, type, required, min_select, max_select, position)
  VALUES (v_tenant_id, v_product_id, 'Extras', 'multi', FALSE, 0, 5, 2)
  RETURNING id INTO v_group_id;

  INSERT INTO product_options (tenant_id, group_id, name, price_delta, position) VALUES
    (v_tenant_id, v_group_id, 'Tocino',          15.00, 1),
    (v_tenant_id, v_group_id, 'Queso extra',     10.00, 2),
    (v_tenant_id, v_group_id, 'Aguacate',        12.00, 3),
    (v_tenant_id, v_group_id, 'Cebolla caramelizada', 8.00, 4);

  -- Producto 2: Papas
  INSERT INTO products (tenant_id, category_id, name, description, price)
  VALUES (
    v_tenant_id, v_cat_id,
    'Papas a la francesa',
    'Orden de papas crujientes.',
    55.00
  )
  RETURNING id INTO v_product_id;

  INSERT INTO product_option_groups (tenant_id, product_id, name, type, required, min_select, max_select, position)
  VALUES (v_tenant_id, v_product_id, 'Tamano', 'single', TRUE, 1, 1, 1)
  RETURNING id INTO v_group_id;

  INSERT INTO product_options (tenant_id, group_id, name, price_delta, position) VALUES
    (v_tenant_id, v_group_id, 'Chica',   0.00, 1),
    (v_tenant_id, v_group_id, 'Grande', 20.00, 2);
END $$;
