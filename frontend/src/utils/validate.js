// Validaciones simples reutilizables para formularios del frontend.

/** Email con formato razonable (no RFC completo, pero ataja typos comunes). */
export function isEmail(str) {
  if (typeof str !== 'string') return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str.trim());
}

/**
 * Numero de WhatsApp en formato internacional sin '+': solo digitos, con
 * codigo de pais. Acepta espacios/guiones que se ignoran. 8 a 15 digitos
 * (rango E.164).
 */
export function isWhatsapp(str) {
  if (typeof str !== 'string') return false;
  const digits = str.replace(/[\s-]/g, '');
  return /^\d{8,15}$/.test(digits);
}

/** Telefono de contacto del cliente: mas permisivo (puede ser local). */
export function isPhone(str) {
  if (typeof str !== 'string') return false;
  const digits = str.replace(/[\s\-()]/g, '');
  return /^\+?\d{6,15}$/.test(digits);
}
