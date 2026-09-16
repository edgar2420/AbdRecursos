import { AuditLoggerPort } from '../../../../shared/application/AuditLogger';
import { ConflictError } from '../../../../shared/domain/errors';
import { CI } from '../../domain/value-objects/CI';
import { Salary } from '../../domain/value-objects/Salary';
import { Employee, NewEmployee } from '../../domain/entities/Employee';
import { EmployeeRepository } from '../../domain/repositories/EmployeeRepository';
import { AccessActor, EmployeeAccessPolicy } from '../../domain/services/EmployeeAccessPolicy';

export class CreateEmployee {
  constructor(
    private readonly employees: EmployeeRepository,
    private readonly policy: EmployeeAccessPolicy,
    private readonly audit: AuditLoggerPort,
  ) {}

  async execute(actor: AccessActor, input: NewEmployee): Promise<Employee> {
    this.policy.assertCanManage(actor);

    const ci = CI.create(input.ci);
    const salary = Salary.create(input.baseSalary);

    if (await this.employees.findByCI(ci.value)) {
      throw new ConflictError(`Ya existe un empleado con C.I. ${ci.value}`);
    }
    const code = input.employeeCode?.trim() || (await this.employees.nextEmployeeCode());
    if (await this.employees.findByCode(code)) {
      throw new ConflictError(`Ya existe un empleado con el codigo ${code}`);
    }

    const employee = await this.employees.create({
      ...input,
      employeeCode: code,
      ci: ci.value,
      baseSalary: salary.amount,
    });

    await this.employees.addHistory({
      employeeId: employee.id,
      changeType: 'HIRE',
      effectiveDate: employee.hireDate,
      newValue: `${employee.fullName} - ${employee.positionName ?? 'sin cargo'}`,
      changedBy: actor.userId,
    });
    await this.audit.log({
      userId: actor.userId,
      action: 'EMPLOYEE_CREATED',
      entity: 'Employee',
      entityId: employee.id,
      changes: { employeeCode: employee.employeeCode, ci: '[REDACTADO]' },
    });
    return employee;
  }
}
