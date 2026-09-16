export type PapeletaTipo = 'HORAS_EXTRAS' | 'SALIDA';
export type SalidaMotivo = 'PARTICULAR' | 'OFICIAL' | 'MEDICA';
export type RecargoHoraExtra = 'DIURNA' | 'NOCTURNA' | 'FERIADO';

export type PapeletaEstado =
  | 'PENDIENTE_JEFE_AREA'
  | 'PENDIENTE_RRHH'
  | 'APROBADA'
  | 'RECHAZADA'
  | 'ANULADA';

/** Una firma registrada sobre la papeleta: quien, cuando y sobre que contenido. */
export interface Firma {
  userId: string;
  nombre: string | null;
  fecha: Date;
  /** Sello de integridad del contenido al momento de firmar. */
  sello: string;
}

export interface Papeleta {
  id: string;
  numero: string;
  tipo: PapeletaTipo;
  estado: PapeletaEstado;

  employeeId: string;
  employeeNombre: string;
  employeeCodigo: string;
  area: string;
  fecha: Date;

  // --- horas extras ---
  trabajoRealizado: string | null;
  desde: Date | null;
  hasta: Date | null;
  totalHoras: number | null;
  recargo: RecargoHoraExtra | null;

  // --- salida ---
  salidaMotivo: SalidaMotivo | null;
  motivo: string | null;
  tiempoSolicitado: string | null;
  horaSalida: string | null;
  horaRetorno: string | null;
  /** Certificado o foto adjunta (tipico de la salida MEDICA). */
  attachmentUrl: string | null;

  // --- firmas ---
  firmaArea: Firma | null;
  firmaRrhh: Firma | null;
  motivoRechazo: string | null;
  rechazadaAt: Date | null;

  createdAt: Date;
}

export interface NuevaPapeletaHorasExtras {
  employeeId: string;
  area: string;
  fecha: Date;
  trabajoRealizado: string;
  desde: Date;
  hasta: Date;
  recargo: RecargoHoraExtra;
}

export interface NuevaPapeletaSalida {
  employeeId: string;
  area: string;
  fecha: Date;
  salidaMotivo: SalidaMotivo;
  motivo: string;
  tiempoSolicitado: string;
  horaSalida: string;
  horaRetorno?: string | null;
  attachmentUrl?: string | null;
}
