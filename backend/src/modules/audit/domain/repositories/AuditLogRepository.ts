import { Paginated, PageQuery } from '../../../../shared/domain/pagination';
import { AuditLogEntry } from '../entities/AuditLogEntry';

export interface AuditLogFilters extends PageQuery {
  entity?: string;
  action?: string;
  userId?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

export interface AuditLogRepository {
  list(filters: AuditLogFilters): Promise<Paginated<AuditLogEntry>>;
}
