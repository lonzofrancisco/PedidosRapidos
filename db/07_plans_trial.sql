-- =====================================================================
-- Migracion: campos de plan / suscripcion en tenants
-- =====================================================================
-- - plan_status: 'trial' (15 dias) | 'active' (pagando) | 'expired'
-- - trial_ends_at: timestamp en el que termina la prueba (solo plan trial)
-- - paid_until:    hasta cuando esta paga la suscripcion (plan active)
--
-- Tenants ya existentes en la BD se marcan como 'active' con paid_until
-- bien lejos en el futuro, para que el demo y cualquier tenant cargado a
-- mano no quede bloqueado por la nueva regla.
-- =====================================================================

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS plan_status   TEXT NOT NULL DEFAULT 'trial',
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS paid_until    TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tenants_plan_status_check'
  ) THEN
    ALTER TABLE tenants
      ADD CONSTRAINT tenants_plan_status_check
      CHECK (plan_status IN ('trial','active','expired'));
  END IF;
END $$;

-- Tenants existentes -> grandfathered en plan active hasta el 2099.
UPDATE tenants
   SET plan_status = 'active',
       paid_until  = COALESCE(paid_until, TIMESTAMPTZ '2099-12-31 23:59:59+00')
 WHERE plan_status = 'trial' AND trial_ends_at IS NULL AND paid_until IS NULL;
