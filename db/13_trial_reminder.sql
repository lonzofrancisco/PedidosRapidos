-- =====================================================================
-- Marca de envio del aviso de "tu prueba esta por vencer"
-- =====================================================================
-- Evita mandar el email de recordatorio mas de una vez por tienda. El job
-- src/jobs/trialReminders.js lo setea al enviar. Idempotente.
-- =====================================================================

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS trial_reminder_sent_at TIMESTAMPTZ;
