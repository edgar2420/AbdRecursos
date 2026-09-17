import { Paginated, PageQuery } from '../../../../shared/domain/pagination';
import { NewPayslip, Payslip, PayslipStatus } from '../entities/Payslip';

export interface PayslipFilters extends PageQuery {
  employeeId?: string;
  employeeIds?: string[];
  departmentId?: string;
  periodYear?: number;
  periodMonth?: number;
  status?: PayslipStatus;
  excludeDraft?: boolean;
}

export interface EmployeeBonusRecord {
  employeeId: string;
  concept: string;
  amount: number | null;
  percentage: number | null;
}

export interface PayslipRepository {
  findById(id: string): Promise<Payslip | null>;
  findByPeriod(employeeId: string, year: number, month: number): Promise<Payslip | null>;
  list(filters: PayslipFilters): Promise<Paginated<Payslip>>;
  listByPeriod(year: number, month: number, employeeIds?: string[]): Promise<Payslip[]>;
  create(data: NewPayslip): Promise<Payslip>;
  replace(id: string, data: NewPayslip): Promise<Payslip>;
  issue(ids: string[], issuedBy: string): Promise<number>;
  cancel(id: string): Promise<Payslip>;
  countByPeriod(year: number, month: number): Promise<number>;
  activeBonuses(employeeIds: string[], at: Date): Promise<EmployeeBonusRecord[]>;
}
