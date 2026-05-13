import { query } from '../../config/db.js';
import { notFound } from '../../utils/httpError.js';

const TENANT_COLUMNS = `
  id, slug, name, whatsapp_number, currency, image_url, active,
  plan_status, trial_ends_at, paid_until, created_at
`;

export async function getTenant(tenantId) {
  const { rows } = await query(
    `SELECT ${TENANT_COLUMNS} FROM tenants WHERE id = $1`,
    [tenantId]
  );
  if (rows.length === 0) throw notFound('Tenant no encontrado');
  return rows[0];
}

const UPDATABLE_FIELDS = ['name', 'whatsapp_number', 'image_url'];

export async function updateTenant(tenantId, patch) {
  const fields = [];
  const values = [];
  for (const key of UPDATABLE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(patch, key)) {
      values.push(patch[key]);
      fields.push(`${key} = $${values.length}`);
    }
  }
  if (fields.length === 0) return getTenant(tenantId);

  values.push(tenantId);
  const { rowCount } = await query(
    `UPDATE tenants SET ${fields.join(', ')} WHERE id = $${values.length}`,
    values
  );
  if (rowCount === 0) throw notFound('Tenant no encontrado');

  return getTenant(tenantId);
}
