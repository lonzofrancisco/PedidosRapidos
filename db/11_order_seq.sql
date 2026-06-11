-- =====================================================================
-- Numeracion de pedidos secuencial por tienda (#1, #2, ...)
-- =====================================================================
-- Antes short_code era un codigo aleatorio (ABC123). Ahora cada tienda
-- lleva su propio contador order_seq y los pedidos se numeran 1,2,3...
-- El contador se incrementa atomicamente al crear cada pedido (ver
-- orders.service.js: UPDATE tenants SET order_seq = order_seq + 1 ... RETURNING).
-- Idempotente: se puede correr sobre una DB existente sin romper nada.
-- =====================================================================

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS order_seq INT NOT NULL DEFAULT 0;

-- Renumerar los pedidos existentes por tienda en orden cronologico.
-- Los codigos viejos eran alfanumericos (6 chars), nunca chocan con 1..N.
WITH numbered AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY tenant_id ORDER BY created_at, id) AS n
    FROM orders
)
UPDATE orders o
   SET short_code = numbered.n::text
  FROM numbered
 WHERE numbered.id = o.id;

-- Dejar el contador de cada tienda en su cantidad actual de pedidos.
UPDATE tenants t
   SET order_seq = COALESCE((SELECT COUNT(*) FROM orders o WHERE o.tenant_id = t.id), 0);
