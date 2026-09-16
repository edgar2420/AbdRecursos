import { Paginated, PageQuery } from '../../../../shared/domain/pagination';
import {
  Employee,
  EmployeeHistoryEntry,
  NewEmployee,
  UpdateEmployeeData,
} from '../entities/Employee';

export interface EmployeeFilters extends PageQuery {
  departmentId?: string;
  positionId?: string;
  supervisorId?: string;
  status?: string;
  contractType?: string;
  isActive?: boolean;
  hiredFrom?: Date;
  hiredTo?: Date;
  /** Restringe el listado al alcance del rol (equipo del supervisor, o el mismo). */
  ids?: string[];
}

export interface EmployeeRepository {
  findById(id: string): Promise<Employee | null>;
  findByCode(code: string): Promise<Employee | null>;
  findByCI(ci: string): Promise<Employee | null>;
  list(filters: EmployeeFilters): Promise<Paginated<Employee>>;
  listAll(filters: Omit<EmployeeFilters, 'page' | 'limit'>): Promise<Employee[]>;
  create(data: NewEmployee): Promise<Employee>;
  update(id: string, data: UpdateEmployeeData): Promise<Employee>;
  setActive(id: string, isActive: boolean): Promise<Employee>;
  /** Soporte del ownership check de supervisores (8.2). */
  isSupervisorOf(supervisorEmployeeId: string, employeeId: string): Promise<boolean>;
  listTeamIds(supervisorEmployeeId: string): Promise<string[]>;
  addHistory(entry: {
    employeeId: string;
    changeType: string;
    field?: string | null;
    oldValue?: string | null;
    newValue?: string | null;
    effectiveDate: Date;
    notes?: string | null;
    changedBy?: string | null;
  }): Promise<void>;
  history(employeeId: string, query: PageQuery): Promise<Paginated<EmployeeHistoryEntry>>;
  nextEmployeeCode(): Promise<string>;
  countActive(): Promise<number>;
}
