export function formatMoney(amount, currency = 'MXN') {
  const n = Number(amount ?? 0);
  return `${currency} ${n.toFixed(2)}`;
}

export function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString();
}
