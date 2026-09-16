import { ForbiddenError, NotFoundError } from '../../../../shared/domain/errors';
import { Paginated } from '../../../../shared/domain/pagination';
import { AccessActor, EmployeeAccessPolicy } from '../../../employees/domain/services/EmployeeAccessPolicy';
import { VacationRequest } from '../../domain/entities/VacationRequest';
import { VacationFilters, VacationRepository } from '../../domain/repositories/VacationRepository';

export class ListVacationRequests {
  constructor(
    private readonly vacations: VacationRepository,
    private readonly policy: EmployeeAccessPolicy,
  ) {}

  async execute(actor: AccessActor, filters: VacationFilters): Promise<Paginated<VacationRequest>> {
    const scope = await this.policy.scopeFor(actor);
    if (scope.all) return this.vacations.list(filters);
    if (scope.employeeIds.length === 0) {
      return { data: [], meta: { total: 0, page: filters.page, limit: filters.limit, totalPages: 1 } };
    }
    // Un supervisor solo ve su equipo aunque pida otro employeeId por query.
    const requested = filters.employeeId;
    if (requested && !scope.employeeIds.includes(requested)) {
      throw new ForbiddenError('No tiene acceso a las solicitudes de ese empleado');
    }
    return this.vacations.list({ ...filters, employeeIds: scope.employeeIds });
  }
}

export class GetVacationRequest {
  constructor(
    private readonly vacations: VacationRepository,
    private readonly policy: EmployeeAccessPolicy,
  ) {}

  async execute(actor: AccessActor, id: string): Promise<VacationRequest> {
    const request = await this.vacations.findById(id);
    if (!request) throw new NotFoundError('Solicitud de vacaciones');
    // Ownership check explicito en el caso de uso (8.2).
    await this.policy.assertCanView(actor, request.employeeId);
    return request;
  }
}
