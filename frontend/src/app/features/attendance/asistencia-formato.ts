import { AttendanceRecord } from '../../core/models/api.models';

export type EstadoDia = 'PRESENT' | 'LATE' | 'ABSENT' | 'INCOMPLETE' | 'REST' | 'JUSTIFIED';

export const ETIQUETA_ESTADO: Record<EstadoDia, string> = {
  PRESENT: 'Puntual',
  LATE: 'Tarde',
  ABSENT: 'Falta',
  INCOMPLETE: 'Sin salida',
  REST: 'Descanso',
  JUSTIFIED: 'Justificada',
};

/** 48.52 -> "48 h 31 min" */
export function formatoHoras(horas: number): string {
  if (!horas) return '—';
  const total = Math.round(horas * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export function formatoMinutos(minutos: number): string {
  if (!minutos) return '—';
  return formatoHoras(minutos / 60);
}

export function horaLocal(fecha: string | Date | null): string {
  if (!fecha) return '';
  const d = new Date(fecha);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function claveDia(fecha: string | Date): string {
  const d = new Date(fecha);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const DIA = new Intl.DateTimeFormat('es-BO', { weekday: 'short', day: '2-digit', month: '2-digit' });

export function etiquetaDia(fecha: string | Date): string {
  return DIA.format(new Date(fecha)).replace('.', '');
}

/** Fecha "AAAA-MM-DD" + hora "HH:mm" en hora local -> ISO para la API. */
export function aIsoLocal(dia: string, hora: string): string {
  const [y, m, d] = dia.split('-').map(Number);
  const [hh, mm] = hora.split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm, 0).toISOString();
}

export interface MarcacionesDelDia {
  entrada: AttendanceRecord | null;
  salida: AttendanceRecord | null;
  otras: AttendanceRecord[];
}

/** Primera entrada y ultima salida del dia; el resto queda como "otras". */
export function agruparPorDia(registros: AttendanceRecord[]): Map<string, MarcacionesDelDia> {
  const mapa = new Map<string, MarcacionesDelDia>();
  const ordenados = [...registros].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  for (const r of ordenados) {
    const clave = claveDia(r.timestamp);
    const dia = mapa.get(clave) ?? { entrada: null, salida: null, otras: [] };
    if (r.type === 'CHECK_IN' && !dia.entrada) dia.entrada = r;
    else if (r.type === 'CHECK_OUT') {
      if (dia.salida) dia.otras.push(dia.salida);
      dia.salida = r;
    } else dia.otras.push(r);
    mapa.set(clave, dia);
  }
  return mapa;
}
