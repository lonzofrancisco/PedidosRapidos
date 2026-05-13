/**
 * Construye un deeplink wa.me con un mensaje corto desde el cliente hacia la
 * tienda. La tienda abre la URL del pedido para ver el detalle completo.
 *
 * Formato del numero del tenant: codigo de pais + numero, sin '+' ni espacios.
 *   ej: "5215512345678"
 */
export function buildWhatsappLink({ tenant, order, orderUrl }) {
  const lines = [`Hola! Te paso mi pedido Numero ${order.short_code}`];
  if (orderUrl) lines.push(`Este es mi pedido: ${orderUrl}`);

  const text = encodeURIComponent(lines.join('\n'));
  return `https://wa.me/${tenant.whatsapp_number}?text=${text}`;
}
