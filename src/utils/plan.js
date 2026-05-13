/**
 * Calcula el estado efectivo del plan de un tenant:
 *   - 'trial'   y trial_ends_at >  now -> 'trial'   (activo, dias restantes)
 *   - 'trial'   y trial_ends_at <= now -> 'expired'
 *   - 'active'  y paid_until    >  now -> 'active'
 *   - 'active'  y paid_until    <= now -> 'expired'
 *   - 'expired'                        -> 'expired'
 *
 * Devuelve un objeto con info util para mostrar en la UI:
 *   { status, isActive, isExpired, isTrial, daysLeft, expiresAt }
 */
export function computePlanInfo(tenant, now = new Date()) {
  const trial = tenant.trial_ends_at ? new Date(tenant.trial_ends_at) : null;
  const paid  = tenant.paid_until    ? new Date(tenant.paid_until)    : null;

  let status = tenant.plan_status;
  let expiresAt = null;

  if (status === 'trial') {
    expiresAt = trial;
    if (!trial || trial <= now) status = 'expired';
  } else if (status === 'active') {
    expiresAt = paid;
    if (!paid || paid <= now) status = 'expired';
  }

  const isActive  = status === 'trial' || status === 'active';
  const isExpired = status === 'expired';
  const isTrial   = status === 'trial';

  const daysLeft = expiresAt
    ? Math.max(0, Math.ceil((expiresAt - now) / 86_400_000))
    : null;

  return { status, isActive, isExpired, isTrial, daysLeft, expiresAt };
}
