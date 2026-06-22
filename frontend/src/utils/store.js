// Utilities for store operations (hours, open/closed logic)

export function isOpenNow(tenant) {
  if (!tenant?.opening_hours) return true;

  const now = new Date();
  const dayIndex = now.getDay(); // 0=domingo, 1=lunes...
  const days = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const dayName = days[dayIndex];

  const timeStr = String(now.getHours()).padStart(2, '0') + ':' +
                  String(now.getMinutes()).padStart(2, '0');

  const daySchedule = tenant.opening_hours[dayName];
  if (!daySchedule) return false;

  return timeStr >= daySchedule.open && timeStr < daySchedule.close;
}

export function getNextOpenTime(tenant) {
  if (isOpenNow(tenant)) return null;
  // Expandible: lógica para encontrar próximo día abierto
  return null;
}

// Formato default de horarios para nueva tienda
export const DEFAULT_OPENING_HOURS = {
  lunes: { open: '09:00', close: '22:00' },
  martes: { open: '09:00', close: '22:00' },
  miércoles: { open: '09:00', close: '22:00' },
  jueves: { open: '09:00', close: '22:00' },
  viernes: { open: '09:00', close: '22:00' },
  sábado: { open: '10:00', close: '23:00' },
  domingo: null,
};

export const DAYS_OF_WEEK = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
export const DAY_LABELS = {
  lunes: 'Lunes',
  martes: 'Martes',
  miércoles: 'Miércoles',
  jueves: 'Jueves',
  viernes: 'Viernes',
  sábado: 'Sábado',
  domingo: 'Domingo',
};
