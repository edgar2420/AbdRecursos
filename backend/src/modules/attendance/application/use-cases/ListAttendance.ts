import { ForbiddenError } from '../../../../shared/domain/errors';
import { Paginated } from '../../../../shared/domain/pagination';
import { AccessActor, EmployeeAccessPolicy } from '../../../employees/domain/services/EmployeeAccessPolicy';
import { AttendanceRecord } from '../../domain/entities/AttendanceRecord';
import { AttendanceFilters, AttendanceRepository } from '../../domain/repositories/AttendanceRepository';

export class ListAttendance {
  constructor(
    private readonly attendance: AttendanceRepository,
    private readonly policy: EmployeeAccessPolicy,
  ) {}

  async execute(actor: AccessActor, filters: AttendanceFilters): Promise<Paginated<AttendanceRecord>> {
    const scope = await this.policy.scopeFor(actor);
    if (scope.all) return this.attendance.list(filters);
    if (filters.employeeId && !scope.employeeIds.includes(filters.employeeId)) {
      throw new ForbiddenError('No tiene acceso a la asistencia de ese empleado');
    }
    if (scope.employeeIds.length === 0) {
      return { data: [], meta: { total: 0, page: filters.page, limit: filters.limit, totalPages: 1 } };
    }
    return this.attendance.list({ ...filters, employeeIds: scope.employeeIds });
  }
}
