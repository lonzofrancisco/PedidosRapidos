import { query } from '../../config/db.js';
import { notFound } from '../../utils/httpError.js';

const TENANT_COLUMNS = `
  id, slug, name, whatsapp_number, currency, image_url, background_url, active,
  plan_status, trial_ends_at, paid_until, is_open, shipping_cost, min_order_amount, opening_hours, created_at
`;

export async function getTenant(tenantId) {
  const { rows } = await query(
    `SELECT ${TENANT_COLUMNS} FROM tenants WHERE id = $1`,
    [tenantId]
  );
  if (rows.length === 0) throw notFound('Tenant no encontrado');
  return rows[0];
}

const UPDATABLE_FIELDS = [
  'name', 'whatsapp_number', 'image_url', 'background_url',
  'is_open', 'shipping_cost', 'min_order_amount', 'opening_hours'
];

export async function updateTenant(tenantId, patch) {
  // Validations
  if (Object.prototype.hasOwnProperty.call(patch, 'shipping_cost') && patch.shipping_cost !== null) {
    const sc = Number(patch.shipping_cost);
    if (isNaN(sc) || sc < 0) throw new Error('El costo de envío no puede ser negativo');
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'min_order_amount') && patch.min_order_amount !== null) {
    const moa = Number(patch.min_order_amount);
    if (isNaN(moa) || moa < 0) throw new Error('El mínimo de compra no puede ser negativo');
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'opening_hours') && patch.opening_hours !== null) {
    if (typeof patch.opening_hours !== 'object') throw new Error('Los horarios deben ser un objeto JSON válido');

    const dias = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
    for (const [day, schedule] of Object.entries(patch.opening_hours)) {
      if (!dias.includes(day)) throw new Error(`Día inválido: ${day}`);
      if (schedule !== null) {
        if (!schedule.open || !schedule.close) throw new Error(`Horarios incompletos para ${day}`);
        if (!/^\d{2}:\d{2}$/.test(schedule.open) || !/^\d{2}:\d{2}$/.test(schedule.close)) {
          throw new Error(`Formato de hora inválido para ${day}. Use HH:MM`);
        }
      }
    }
  }

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
