// Mapa de codigos ISO a simbolo mostrable. Los que no esten aca caen al
// codigo ISO crudo (ej: "BRL 100.00").
const CURRENCY_SYMBOLS = {
  ARS: '$',
  USD: 'US$',
  MXN: 'MX$',
  EUR: '€',
};

export function formatMoney(amount, currency = 'ARS') {
  const n = Number(amount ?? 0);
  const symbol = CURRENCY_SYMBOLS[currency] ?? currency;
  return `${symbol} ${n.toFixed(2)}`;
}

export function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString();
}
