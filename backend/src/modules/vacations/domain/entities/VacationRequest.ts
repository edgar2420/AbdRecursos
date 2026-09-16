export type VacationStatus =
  | 'PENDING_SUPERVISOR'
  | 'PENDING_HR'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED';

export interface VacationRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  departmentName: string | null;
  supervisorId: string | null;
  startDate: Date;
  endDate: Date;
  workingDays: number;
  reason: string | null;
  status: VacationStatus;
  supervisorApprovedAt: Date | null;
  supervisorApprovedByName: string | null;
  /** true si quien cerro el paso del supervisor fue RRHH (aprobacion de emergencia). */
  supervisorApprovalIsEmergency: boolean;
  /** Motivo que dio RRHH al aprobar de emergencia en ausencia del supervisor. */
  emergencyReason: string | null;
  hrApprovedAt: Date | null;
  hrApprovedByName: string | null;
  rejectedAt: Date | null;
  rejectedByName: string | null;
  rejectionReason: string | null;
  createdAt: Date;
}

export interface NewVacationRequest {
  employeeId: string;
  startDate: Date;
  endDate: Date;
  workingDays: number;
  reason?: string | null;
  status: VacationStatus;
}

/** Una fila del cuadro de vacaciones: lo que otorgo y lo que quedo de una gestion. */
export interface GestionBalance {
  numero: number;
  etiqueta: string;
  inicio: Date;
  fin: Date;
  cumplida: boolean;
  /** Dias del tramo que corresponde a esa gestion. */
  diasOtorgados: number;
  /** Acreditados de verdad: una gestion en curso todavia no acredita nada. */
  diasAcreditados: number;
  takenDays: number;
  pendingDays: number;
  saldoGestion: number;
}

export interface VacationBalance {
  employeeId: string;
  periodYear: number;
  entitledDays: number;
  takenDays: number;
  pendingDays: number;
  /** Saldo acumulado: suma de lo pendiente de todas las gestiones cumplidas. */
  availableDays: number;
  yearsOfService: number;
  gestiones: GestionBalance[];
  gestionEnCurso: { etiqueta: string; fin: Date; diasQueOtorgara: number } | null;
}
