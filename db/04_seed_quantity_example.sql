-- =====================================================================
-- Seed adicional: producto "Docena de empanadas" con un grupo tipo
-- 'quantity'. El cliente arma su docena eligiendo cuantas de cada sabor.
-- Idempotente: usa ON CONFLICT DO NOTHING via verificacion previa.
-- =====================================================================

DO $$
DECLARE
  v_tenant_id  UUID;
  v_cat_id     UUID;
  v_product_id UUID;
  v_group_id   UUID;
BEGIN
  SELECT id INTO v_tenant_id FROM tenants WHERE slug = 'burger-demo';
  IF v_tenant_id IS NULL THEN
    RAISE NOTICE 'tenant burger-demo no existe, salto el seed';
    RETURN;
  END IF;

  -- Si ya existe el producto, salir.
  IF EXISTS (
    SELECT 1 FROM products WHERE tenant_id = v_tenant_id AND name = 'Docena de empanadas'
  ) THEN
    RETURN;
  END IF;

  SELECT id INTO v_cat_id FROM categories WHERE tenant_id = v_tenant_id LIMIT 1;

  INSERT INTO products (tenant_id, category_id, name, description, price)
  VALUES (
    v_tenant_id, v_cat_id,
    'Docena de empanadas',
    'Arma tu docena: elige cuantas de cada sabor.',
    0.00  -- precio base 0, todo se calcula por las opciones
  )
  RETURNING id INTO v_product_id;

  INSERT INTO product_option_groups
    (tenant_id, product_id, name, type, required, min_select, max_select, position)
  VALUES
    (v_tenant_id, v_product_id, 'Sabores', 'quantity', TRUE, 12, 12, 1)
  RETURNING id INTO v_group_id;

  INSERT INTO product_options (tenant_id, group_id, name, price_delta, position) VALUES
    (v_tenant_id, v_group_id, 'Carne',          50.00, 1),
    (v_tenant_id, v_group_id, 'Pollo',          50.00, 2),
    (v_tenant_id, v_group_id, 'Jamon y queso',  45.00, 3),
    (v_tenant_id, v_group_id, 'Champinones',    55.00, 4),
    (v_tenant_id, v_group_id, 'Espinaca',       55.00, 5);
END $$;
