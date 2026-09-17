import { Paginated } from '../../../../shared/domain/pagination';
import { Employee } from '../../domain/entities/Employee';
import { EmployeeFilters, EmployeeRepository } from '../../domain/repositories/EmployeeRepository';
import { AccessActor, EmployeeAccessPolicy } from '../../domain/services/EmployeeAccessPolicy';

export class ListEmployees {
  constructor(
    private readonly employees: EmployeeRepository,
    private readonly policy: EmployeeAccessPolicy,
  ) {}

  async execute(actor: AccessActor, filters: EmployeeFilters): Promise<Paginated<Employee>> {
    const scope = await this.policy.scopeFor(actor);
    if (scope.all) return this.employees.list(filters);
    if (scope.employeeIds.length === 0) {
      return { data: [], meta: { total: 0, page: filters.page, limit: filters.limit, totalPages: 1 } };
    }
    return this.employees.list({ ...filters, ids: scope.employeeIds });
  }
}
