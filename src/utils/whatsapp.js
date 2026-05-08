/**
 * Construye un deeplink wa.me con el resumen del pedido para que el cliente
 * lo envie al numero del tenant.
 *
 * Formato del numero: codigo de pais + numero, sin '+' ni espacios.
 *   ej: "5215512345678"
 */
export function buildWhatsappLink({ tenant, order, items }) {
  const lines = [];
  lines.push(`*Nuevo pedido #${order.short_code}* - ${tenant.name}`);
  lines.push('');
  lines.push(`Cliente: ${order.customer_name}`);
  lines.push(`Telefono: ${order.customer_phone}`);
  if (order.customer_address) lines.push(`Direccion: ${order.customer_address}`);
  lines.push('');
  lines.push('*Pedido:*');

  for (const item of items) {
    lines.push(`${item.quantity}x ${item.product_name} - ${formatMoney(item.subtotal, order.currency)}`);
    for (const opt of item.options ?? []) {
      lines.push(`  - ${opt.group_name}: ${opt.option_name}`);
    }
    if (item.notes) lines.push(`  _Nota: ${item.notes}_`);
  }

  lines.push('');
  lines.push(`*Total: ${formatMoney(order.total, order.currency)}*`);
  if (order.notes) {
    lines.push('');
    lines.push(`Notas: ${order.notes}`);
  }

  const text = encodeURIComponent(lines.join('\n'));
  return `https://wa.me/${tenant.whatsapp_number}?text=${text}`;
}

function formatMoney(amount, currency = 'MXN') {
  const n = Number(amount);
  return `${currency} ${n.toFixed(2)}`;
}
