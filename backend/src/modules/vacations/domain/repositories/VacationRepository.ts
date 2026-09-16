import { Paginated, PageQuery } from '../../../../shared/domain/pagination';
import { NewVacationRequest, VacationRequest, VacationStatus } from '../entities/VacationRequest';

export interface VacationFilters extends PageQuery {
  employeeIds?: string[];
  employeeId?: string;
  departmentId?: string;
  status?: VacationStatus;
  dateFrom?: Date;
  dateTo?: Date;
}

export interface VacationRepository {
  findById(id: string): Promise<VacationRequest | null>;
  list(filters: VacationFilters): Promise<Paginated<VacationRequest>>;
  listInRange(from: Date, to: Date, employeeIds?: string[]): Promise<VacationRequest[]>;
  create(data: NewVacationRequest): Promise<VacationRequest>;
  updateStatus(
    id: string,
    data: {
      status: VacationStatus;
      supervisorApprovedBy?: string | null;
      hrApprovedBy?: string | null;
      rejectedBy?: string | null;
      rejectionReason?: string | null;
      emergencyReason?: string | null;
    },
  ): Promise<VacationRequest>;
  /** Dias ya tomados (aprobados) y en tramite, para el calculo del saldo. */
  sumDays(employeeId: string, year: number): Promise<{ approved: number; pending: number }>;
  /**
   * Solicitudes del empleado que consumen saldo (aprobadas o en tramite), para
   * imputar cada una a la gestion que corresponde segun su fecha de inicio.
   */
  listConsuming(employeeId: string): Promise<VacationRequest[]>;
  /**
   * Historico migrado del cuadro de RR.HH.: dias otorgados y tomados por
   * gestion antes de que el sistema existiera.
   */
  historicalGestiones(
    employeeId: string,
  ): Promise<{ periodYear: number; entitledDays: number; takenDays: number }[]>;
  hasOverlap(employeeId: string, from: Date, to: Date, excludeId?: string): Promise<boolean>;
  countPending(employeeIds?: string[]): Promise<number>;
}

export interface HolidayRepository {
  listBetween(from: Date, to: Date): Promise<Date[]>;
}
