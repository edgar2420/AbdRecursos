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
  supervisorApprovalIsEmergency: boolean;
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

export interface GestionBalance {
  numero: number;
  etiqueta: string;
  inicio: Date;
  fin: Date;
  cumplida: boolean;
  diasOtorgados: number;
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
  availableDays: number;
  yearsOfService: number;
  gestiones: GestionBalance[];
  gestionEnCurso: { etiqueta: string; fin: Date; diasQueOtorgara: number } | null;
}
