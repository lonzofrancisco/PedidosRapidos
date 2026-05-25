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
  // Separador de miles y, si el monto es entero, sin decimales (mas natural
  // para ARS: "$ 15.000" en vez de "$ 15000.00").
  const hasCents = Math.abs(n % 1) > 0.0001;
  const formatted = new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(n);
  return `${symbol} ${formatted}`;
}

export function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString();
}
