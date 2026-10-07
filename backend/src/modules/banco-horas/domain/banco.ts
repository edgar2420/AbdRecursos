import { timeToMinutes } from '../../../shared/domain/dates';

/**
 * Banco de horas (acumulado, sin reinicio):
 *  + horas extra con papeleta APROBADA
 *  - salidas PARTICULARES con papeleta APROBADA
 *  +/- ajustes manuales de RRHH (pago de horas, compensacion con dia libre, etc.)
 */
export type TipoMovimiento = 'HORAS_EXTRAS' | 'SALIDA' | 'AJUSTE';

export interface Movimiento {
  fecha: Date;
  tipo: TipoMovimiento;
  /** Positivo suma al saldo, negativo resta. */
  minutos: number;
  detalle: string;
  referencia: string | null;
  /** true cuando la duracion de la salida se dedujo del texto "tiempo solicitado". */
  estimado: boolean;
}

export interface MovimientoConSaldo extends Movimiento {
  saldo: number;
}

const JORNADA_MINUTOS = 8 * 60;

/** "2 horas", "1 h 30 min", "30 minutos", "media jornada", "1.5 h" -> minutos. */
export function minutosDeTexto(texto: string | null | undefined): number | null {
  if (!texto) return null;
  const t = texto.toLowerCase().replace(',', '.').trim();
  if (/media\s+jornada|medio\s+dia/.test(t)) return JORNADA_MINUTOS / 2;
  if (/jornada|dia\s+completo|todo\s+el\s+dia/.test(t)) return JORNADA_MINUTOS;

  let total = 0;
  let encontro = false;
  const horas = t.match(/(\d+(?:\.\d+)?)\s*(?:horas?|hrs?|h)\b/);
  if (horas) {
    total += Math.round(parseFloat(horas[1]) * 60);
    encontro = true;
  }
  const minutos = t.match(/(\d+)\s*(?:minutos?|mins?|m)\b/);
  if (minutos) {
    total += parseInt(minutos[1], 10);
    encontro = true;
  }
  if (!encontro) {
    const solo = t.match(/^(\d+(?:\.\d+)?)$/);
    if (solo) return Math.round(parseFloat(solo[1]) * 60);
  }
  return encontro ? total : null;
}

/** Duracion de una salida: por horas de salida/retorno si existen; si no, por el texto solicitado. */
export function minutosDeSalida(
  horaSalida: string | null,
  horaRetorno: string | null,
  tiempoSolicitado: string | null,
): { minutos: number; estimado: boolean } {
  if (horaSalida && horaRetorno) {
    const diferencia = timeToMinutes(horaRetorno) - timeToMinutes(horaSalida);
    if (diferencia > 0) return { minutos: diferencia, estimado: false };
  }
  return { minutos: minutosDeTexto(tiempoSolicitado) ?? 0, estimado: true };
}

/** Ordena por fecha y agrega el saldo acumulado despues de cada movimiento. */
export function conSaldoAcumulado(movimientos: Movimiento[]): MovimientoConSaldo[] {
  let saldo = 0;
  return [...movimientos]
    .sort((a, b) => a.fecha.getTime() - b.fecha.getTime())
    .map((m) => {
      saldo += m.minutos;
      return { ...m, saldo };
    });
}

export function saldoDe(movimientos: Movimiento[]): number {
  return movimientos.reduce((acc, m) => acc + m.minutos, 0);
}
