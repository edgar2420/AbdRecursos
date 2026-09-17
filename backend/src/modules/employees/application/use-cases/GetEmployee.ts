import { NotFoundError } from '../../../../shared/domain/errors';
import { Employee } from '../../domain/entities/Employee';
import { EmployeeRepository } from '../../domain/repositories/EmployeeRepository';
import { AccessActor, EmployeeAccessPolicy } from '../../domain/services/EmployeeAccessPolicy';

export class GetEmployee {
  constructor(
    private readonly employees: EmployeeRepository,
    private readonly policy: EmployeeAccessPolicy,
  ) {}

  async execute(actor: AccessActor, id: string): Promise<Employee> {
    await this.policy.assertCanView(actor, id);
    const employee = await this.employees.findById(id);
    if (!employee) throw new NotFoundError('Empleado');
    return this.maskSensitive(actor, employee);
  }

  private maskSensitive(actor: AccessActor, employee: Employee): Employee {
    if (this.policy.isPrivileged(actor) || this.policy.isSelf(actor, employee.id)) return employee;
    return { ...employee, bankAccount: null, afpNumber: null, baseSalary: 0, address: null };
  }
}
