-- =====================================================================
-- Auditoria de acciones del superadmin (dueno del sistema)
-- =====================================================================
-- Registra cada accion sensible hecha desde /superAdmin: crear/eliminar
-- tenant, extender plan, dar de baja, resetear contrasena, etc.
-- No lleva FK a tenants: cuando se elimina un tenant igual queremos
-- conservar el registro de que paso (con su slug guardado en texto).
-- =====================================================================

CREATE TABLE IF NOT EXISTS superadmin_audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action      TEXT NOT NULL,        -- create_tenant | delete_tenant | extend | set_active | reset_password | update_plan
  tenant_id   UUID,                 -- puede quedar "huerfano" tras un delete (a proposito)
  tenant_slug TEXT,
  actor       TEXT NOT NULL,        -- email del superadmin que ejecuto la accion
  detail      JSONB,                -- payload contextual (dias, nuevo estado, etc.)
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_created ON superadmin_audit_log(created_at DESC);
