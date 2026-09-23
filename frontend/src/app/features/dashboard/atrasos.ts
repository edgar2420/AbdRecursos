import { AttendanceReportRow } from '../../core/models/api.models';

export type Metrica = 'tardanzas' | 'minutos';

export interface Rango {
  from: string;
  to: string;
}

export interface Totales {
  tardanzas: number;
  minutos: number;
  personas: number;
}

export interface Variacion {
  /** 'peor' = subieron los atrasos. */
  tono: 'peor' | 'mejor' | 'igual' | 'nuevo';
  texto: string;
}

const DIA_MS = 86_400_000;

function aFecha(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function aIso(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

export function diasDelRango(rango: Rango): Date[] {
  const inicio = aFecha(rango.from).getTime();
  const fin = aFecha(rango.to).getTime();
  const dias: Date[] = [];
  for (let t = inicio; t <= fin; t += DIA_MS) dias.push(new Date(t));
  return dias;
}

/** Periodo de la misma duracion inmediatamente anterior. */
export function rangoPrevio(rango: Rango): Rango {
  const n = diasDelRango(rango).length;
  const hasta = new Date(aFecha(rango.from).getTime() - DIA_MS);
  const desde = new Date(hasta.getTime() - (n - 1) * DIA_MS);
  return { from: aIso(desde), to: aIso(hasta) };
}

export function serieDiaria(filas: AttendanceReportRow[], n: number): Record<Metrica, number[]> {
  const tardanzas = new Array<number>(n).fill(0);
  const minutos = new Array<number>(n).fill(0);
  for (const fila of filas) {
    for (let i = 0; i < n; i++) {
      const tarde = fila.days?.[i]?.lateMinutes ?? 0;
      if (tarde > 0) {
        tardanzas[i]++;
        minutos[i] += tarde;
      }
    }
  }
  return { tardanzas, minutos };
}

export function totales(filas: AttendanceReportRow[]): Totales {
  return {
    tardanzas: filas.reduce((acc, f) => acc + f.daysLate, 0),
    minutos: filas.reduce((acc, f) => acc + f.totalLateMinutes, 0),
    personas: filas.length,
  };
}

export function variacion(actual: number, previo: number, formato: (v: number) => string): Variacion {
  if (actual === previo) return { tono: 'igual', texto: actual === 0 ? 'Sin atrasos en ambos periodos' : 'Igual que antes' };
  if (previo === 0) return { tono: 'nuevo', texto: 'Antes no hubo atrasos' };
  const diferencia = actual - previo;
  const porcentaje = Math.round((Math.abs(diferencia) / previo) * 100);
  const signo = diferencia > 0 ? '+' : '−';
  const extra = porcentaje < 1000 ? ` (${signo}${porcentaje}%)` : '';
  return {
    tono: diferencia > 0 ? 'peor' : 'mejor',
    texto: `${signo}${formato(Math.abs(diferencia))}${extra}`,
  };
}

export function formatoMinutos(total: number): string {
  const redondo = Math.round(total);
  if (redondo < 60) return `${redondo} min`;
  const horas = Math.floor(redondo / 60);
  const resto = redondo % 60;
  return resto ? `${horas} h ${resto} min` : `${horas} h`;
}

const MES_CORTO = new Intl.DateTimeFormat('es-BO', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const DIA_SEMANA = new Intl.DateTimeFormat('es-BO', { weekday: 'short', timeZone: 'UTC' });

export function etiquetaRango(rango: Rango): string {
  return `${MES_CORTO.format(aFecha(rango.from))} – ${MES_CORTO.format(aFecha(rango.to))}`;
}

export function etiquetaCorta(fecha: Date): string {
  return `${String(fecha.getUTCDate()).padStart(2, '0')}/${String(fecha.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function etiquetaLarga(fecha: Date): string {
  return `${DIA_SEMANA.format(fecha).replace('.', '')} ${etiquetaCorta(fecha)}`;
}
