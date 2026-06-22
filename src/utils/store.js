// Utilities for store operations (hours, open/closed logic)

export function isOpenNow(tenant) {
  // Si no hay horarios configurados, siempre está abierta
  if (!tenant.opening_hours) return true;

  // Obtener día actual en zona horaria AR (America/Argentina/Buenos_Aires)
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('es-AR', {
    weekday: 'long',
    timeZone: 'America/Argentina/Buenos_Aires'
  });
  const dayName = formatter.format(now).toLowerCase(); // "lunes", "martes", ...

  // Obtener hora actual en formato HH:MM
  const timeFormatter = new Intl.DateTimeFormat('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Argentina/Buenos_Aires',
    hour12: false
  });
  const timeStr = timeFormatter.format(now); // "14:30"

  // Buscar rango para hoy
  const daySchedule = tenant.opening_hours[dayName];
  if (!daySchedule) return false; // Cerrado hoy (null en la config)

  const { open, close } = daySchedule;
  return timeStr >= open && timeStr < close;
}

export function getNextOpenTime(tenant) {
  // Devuelve string "Abre a las 09:00 el lunes" o null si está abierta
  // Utilizado para mostrar al usuario cuando abre nuevamente
  if (isOpenNow(tenant)) return null;
  // Lógica compleja de cálculo de próximo horario
  // Por ahora: devolver null (puede expandirse después)
  return null;
}
