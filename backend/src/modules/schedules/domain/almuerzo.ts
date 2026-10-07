import { timeToMinutes } from '../../../shared/domain/dates';

/** Minutos de la ventana de almuerzo "12:00"-"13:00" -> 60. Sin ventana completa devuelve null. */
export function minutosDeAlmuerzo(inicio?: string | null, fin?: string | null): number | null {
  if (!inicio || !fin) return null;
  return timeToMinutes(fin) - timeToMinutes(inicio);
}

/** Devuelve el motivo si la ventana no es valida para la jornada; null si esta bien. */
export function problemaConAlmuerzo(
  jornada: { startTime: string; endTime: string; isNightShift?: boolean },
  inicio?: string | null,
  fin?: string | null,
): string | null {
  if (!inicio && !fin) return null;
  if (!inicio || !fin) return 'Indique la hora de inicio y de fin del almuerzo';
  const minutos = minutosDeAlmuerzo(inicio, fin)!;
  if (minutos <= 0) return 'El fin del almuerzo debe ser posterior al inicio';
  if (!jornada.isNightShift) {
    const entrada = timeToMinutes(jornada.startTime);
    const salida = timeToMinutes(jornada.endTime);
    if (timeToMinutes(inicio) < entrada || timeToMinutes(fin) > salida) {
      return 'El almuerzo debe estar dentro del horario de trabajo';
    }
  }
  return null;
}
