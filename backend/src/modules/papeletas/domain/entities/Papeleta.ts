export type PapeletaTipo = 'HORAS_EXTRAS' | 'SALIDA';
export type SalidaMotivo = 'PARTICULAR' | 'OFICIAL' | 'MEDICA';
export type RecargoHoraExtra = 'DIURNA' | 'NOCTURNA' | 'FERIADO';

export type PapeletaEstado =
  | 'PENDIENTE_JEFE_AREA'
  | 'PENDIENTE_RRHH'
  | 'APROBADA'
  | 'RECHAZADA'
  | 'ANULADA';

export interface Firma {
  userId: string;
  nombre: string | null;
  fecha: Date;
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

  trabajoRealizado: string | null;
  desde: Date | null;
  hasta: Date | null;
  totalHoras: number | null;
  recargo: RecargoHoraExtra | null;

  salidaMotivo: SalidaMotivo | null;
  motivo: string | null;
  tiempoSolicitado: string | null;
  horaSalida: string | null;
  horaRetorno: string | null;
  attachmentUrl: string | null;

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
