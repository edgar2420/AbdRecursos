import { ForbiddenError } from '../../../../shared/domain/errors';
import { Paginated } from '../../../../shared/domain/pagination';
import { AccessActor } from '../../../employees/domain/services/EmployeeAccessPolicy';
import { AuditLogEntry } from '../../domain/entities/AuditLogEntry';
import { AuditLogFilters, AuditLogRepository } from '../../domain/repositories/AuditLogRepository';

export class ListAuditLogs {
  constructor(private readonly logs: AuditLogRepository) {}

  async execute(actor: AccessActor, filters: AuditLogFilters): Promise<Paginated<AuditLogEntry>> {
    if (actor.role !== 'ADMIN') {
      throw new ForbiddenError('Solo Administracion puede ver el registro de auditoria');
    }
    return this.logs.list(filters);
  }
}
