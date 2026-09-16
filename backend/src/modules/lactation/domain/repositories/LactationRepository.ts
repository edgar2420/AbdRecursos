import { Paginated, PageQuery } from '../../../../shared/domain/pagination';
import { LactationPermit, NewLactationPermit } from '../entities/LactationPermit';

export interface LactationFilters extends PageQuery {
  employeeId?: string;
  departmentId?: string;
  isActive?: boolean;
  expiringBefore?: Date;
}

export interface LactationRepository {
  findById(id: string): Promise<LactationPermit | null>;
  findActiveByEmployee(employeeId: string): Promise<LactationPermit | null>;
  list(filters: LactationFilters): Promise<Paginated<LactationPermit>>;
  create(data: NewLactationPermit): Promise<LactationPermit>;
  update(id: string, data: Partial<NewLactationPermit> & { isActive?: boolean }): Promise<LactationPermit>;
  countExpiring(before: Date): Promise<number>;
}
