/** Motivos de desvinculacion que se usan en Bolivia (afectan el finiquito: desahucio, indemnizacion). */
export const MOTIVOS_BAJA = [
  'RENUNCIA',
  'FIN_CONTRATO',
  'RETIRO_EMPRESA',
  'DESPIDO_CAUSA',
  'MUTUO_ACUERDO',
  'ABANDONO',
  'JUBILACION',
  'FALLECIMIENTO',
  'OTRO',
] as const;

export type MotivoBaja = (typeof MOTIVOS_BAJA)[number];

export const ETIQUETA_MOTIVO_BAJA: Record<MotivoBaja, string> = {
  RENUNCIA: 'Renuncia voluntaria',
  FIN_CONTRATO: 'Fin de contrato',
  RETIRO_EMPRESA: 'Retiro por decision de la empresa',
  DESPIDO_CAUSA: 'Despido con causa justificada',
  MUTUO_ACUERDO: 'Mutuo acuerdo',
  ABANDONO: 'Abandono de trabajo',
  JUBILACION: 'Jubilacion',
  FALLECIMIENTO: 'Fallecimiento',
  OTRO: 'Otro motivo',
};

/** Hasta cuantos dias adelante se acepta una baja programada (p. ej. renuncia con preaviso). */
export const DIAS_MAXIMOS_BAJA_FUTURA = 31;

function soloDia(fecha: Date): number {
  return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()).getTime();
}

/** Devuelve el problema de la fecha de retiro, o null si es valida. */
export function problemaFechaBaja(retiro: Date, ingreso: Date, hoy: Date = new Date()): string | null {
  if (Number.isNaN(retiro.getTime())) return 'La fecha de retiro no es valida';
  if (soloDia(retiro) < soloDia(ingreso)) return 'La fecha de retiro no puede ser anterior a la fecha de ingreso';
  const limite = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + DIAS_MAXIMOS_BAJA_FUTURA);
  if (soloDia(retiro) > limite.getTime()) {
    return `La fecha de retiro no puede pasar de ${DIAS_MAXIMOS_BAJA_FUTURA} dias desde hoy`;
  }
  return null;
}

/** Texto para el historial: "Renuncia voluntaria: presento carta el 01/10". */
export function notaDeBaja(motivo: MotivoBaja | null | undefined, notas: string | null | undefined): string | null {
  const etiqueta = motivo ? ETIQUETA_MOTIVO_BAJA[motivo] : null;
  const texto = notas?.trim() || null;
  if (etiqueta && texto) return `${etiqueta}: ${texto}`;
  return etiqueta ?? texto;
}
