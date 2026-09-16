import { Paginated, PageQuery } from '../../../../shared/domain/pagination';
import { EmployeeHistoryEntry } from '../../domain/entities/Employee';
import { EmployeeRepository } from '../../domain/repositories/EmployeeRepository';
import { AccessActor, EmployeeAccessPolicy } from '../../domain/services/EmployeeAccessPolicy';

export class GetEmployeeHistory {
  constructor(
    private readonly employees: EmployeeRepository,
    private readonly policy: EmployeeAccessPolicy,
  ) {}

  async execute(
    actor: AccessActor,
    employeeId: string,
    query: PageQuery,
  ): Promise<Paginated<EmployeeHistoryEntry>> {
    await this.policy.assertCanView(actor, employeeId);
    return this.employees.history(employeeId, query);
  }
}
