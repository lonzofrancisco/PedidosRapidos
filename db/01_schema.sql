-- =====================================================================
-- Pedidos Rapidos - Schema (multi-tenant por tenant_id)
-- =====================================================================
-- Convenciones:
--  * Toda tabla "de tenant" lleva tenant_id NOT NULL.
--  * Toda query de la app DEBE filtrar por tenant_id (ver middleware/tenant.js).
--  * Los precios se guardan en NUMERIC(12,2) para evitar errores de float.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ----- Tenants ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS tenants (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  whatsapp_number TEXT NOT NULL,        -- formato internacional sin '+', ej: 5491112345678
  currency        TEXT NOT NULL DEFAULT 'ARS',
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----- Admin users (login JWT) ----------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email         TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'admin',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, email)
);
CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);

-- ----- Categorias ------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  position   INT  NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_categories_tenant ON categories(tenant_id);

-- ----- Productos -------------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  name        TEXT NOT NULL,
  description TEXT,
  price       NUMERIC(12,2) NOT NULL CHECK (price >= 0),
  image_url   TEXT,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_products_tenant ON products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_products_tenant_active ON products(tenant_id, active);

-- ----- Grupos de opciones (cards dinamicas) ---------------------------
-- type:
--   'single'   = radio  (1 opcion exacta, qty siempre 1)
--   'multi'    = checkbox (varias opciones, qty siempre 1 c/u)
--   'quantity' = empanada-style (varias opciones, cada una con su cantidad)
-- min_select / max_select aplican a la cantidad TOTAL del grupo:
--   single   -> 0..1
--   multi    -> count(opciones)
--   quantity -> sum(qty)
CREATE TABLE IF NOT EXISTS product_option_groups (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  type       TEXT NOT NULL CHECK (type IN ('single','multi','quantity')),
  required   BOOLEAN NOT NULL DEFAULT FALSE,
  min_select INT NOT NULL DEFAULT 0,
  max_select INT NOT NULL DEFAULT 1,
  position   INT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_pog_product ON product_option_groups(product_id);

-- ----- Opciones individuales ------------------------------------------
CREATE TABLE IF NOT EXISTS product_options (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  group_id     UUID NOT NULL REFERENCES product_option_groups(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  price_delta  NUMERIC(12,2) NOT NULL DEFAULT 0,
  position     INT NOT NULL DEFAULT 0,
  active       BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX IF NOT EXISTS idx_po_group ON product_options(group_id);

-- ----- Pedidos ---------------------------------------------------------
-- Sin login: guardamos los datos del cliente en el propio pedido.
CREATE TABLE IF NOT EXISTS orders (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  short_code       TEXT NOT NULL,           -- codigo corto para mostrar al cliente
  customer_name    TEXT NOT NULL,
  customer_phone   TEXT NOT NULL,
  customer_address TEXT,
  notes            TEXT,
  status           TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','confirmed','preparing','ready','delivered','cancelled')),
  total            NUMERIC(12,2) NOT NULL CHECK (total >= 0),
  currency         TEXT NOT NULL DEFAULT 'ARS',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, short_code)
);
CREATE INDEX IF NOT EXISTS idx_orders_tenant_created ON orders(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_tenant_status ON orders(tenant_id, status);

-- ----- Items del pedido ------------------------------------------------
-- Guardamos snapshots de nombre y precio para que el historial sea inmutable
-- aunque el admin edite el catalogo despues.
CREATE TABLE IF NOT EXISTS order_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_id        UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id      UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name    TEXT NOT NULL,           -- snapshot
  unit_price      NUMERIC(12,2) NOT NULL,  -- precio base + opciones, snapshot
  quantity        INT NOT NULL CHECK (quantity > 0),
  subtotal        NUMERIC(12,2) NOT NULL,
  notes           TEXT
);
CREATE INDEX IF NOT EXISTS idx_oi_order ON order_items(order_id);

-- ----- Opciones elegidas en cada item ---------------------------------
CREATE TABLE IF NOT EXISTS order_item_options (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  order_item_id   UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  option_id       UUID REFERENCES product_options(id) ON DELETE SET NULL,
  group_name      TEXT NOT NULL,           -- snapshot
  option_name     TEXT NOT NULL,           -- snapshot
  price_delta     NUMERIC(12,2) NOT NULL,  -- snapshot
  quantity        INT NOT NULL DEFAULT 1 CHECK (quantity > 0)
);
CREATE INDEX IF NOT EXISTS idx_oio_item ON order_item_options(order_item_id);
