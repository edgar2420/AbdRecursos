/** Utilidades de fecha sin dependencias externas (el dominio no importa librerias). */
export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

export function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

export function addYears(d: Date, years: number): Date {
  const x = new Date(d);
  x.setFullYear(x.getFullYear() + years);
  return x;
}

export function addMonths(d: Date, months: number): Date {
  const x = new Date(d);
  x.setMonth(x.getMonth() + months);
  return x;
}

export function daysBetween(a: Date, b: Date): number {
  const ms = startOfDay(b).getTime() - startOfDay(a).getTime();
  return Math.round(ms / 86400000);
}

/** Antiguedad en anios completos a una fecha de referencia. */
export function yearsOfService(hireDate: Date, at: Date = new Date()): number {
  let years = at.getFullYear() - hireDate.getFullYear();
  const monthDiff = at.getMonth() - hireDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && at.getDate() < hireDate.getDate())) years--;
  return Math.max(0, years);
}

/** 1=lunes ... 7=domingo (ISO). */
export function isoWeekDay(d: Date): number {
  const day = d.getDay();
  return day === 0 ? 7 : day;
}

export function toDateOnlyString(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

/** "HH:mm" -> minutos desde medianoche. */
export function timeToMinutes(hhmm: string): number {
  const parts = hhmm.split(':').map(Number);
  return parts[0] * 60 + (parts[1] || 0);
}

export function minutesToTime(total: number): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return p(Math.floor(total / 60)) + ':' + p(total % 60);
}
