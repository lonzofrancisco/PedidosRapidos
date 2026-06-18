-- =====================================================================
-- Pagos de suscripcion (Mercado Pago)
-- =====================================================================
-- Registro de pagos aprobados, para idempotencia del webhook: mp_payment_id es
-- UNIQUE, asi una misma notificacion no extiende el plan dos veces. Idempotente.
-- =====================================================================

CREATE TABLE IF NOT EXISTS billing_payments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider      TEXT NOT NULL DEFAULT 'mercadopago',
  mp_payment_id TEXT NOT NULL UNIQUE,
  status        TEXT NOT NULL,
  amount        NUMERIC(12,2),
  currency      TEXT,
  raw           JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_billing_payments_tenant ON billing_payments(tenant_id);
