import { AuditLoggerPort } from '../../../../shared/application/AuditLogger';
import { NotFoundError } from '../../../../shared/domain/errors';
import { CI } from '../../domain/value-objects/CI';
import { Salary } from '../../domain/value-objects/Salary';
import { Employee, UpdateEmployeeData } from '../../domain/entities/Employee';
import { EmployeeRepository } from '../../domain/repositories/EmployeeRepository';
import { AccessActor, EmployeeAccessPolicy } from '../../domain/services/EmployeeAccessPolicy';

/** Campos que un empleado puede editar de su propio perfil. */
const SELF_EDITABLE: (keyof UpdateEmployeeData)[] = [
  'phone',
  'address',
  'email',
  'emergencyContactName',
  'emergencyContactPhone',
  'emergencyContactRelation',
  'photoUrl',
];

export class UpdateEmployee {
  constructor(
    private readonly employees: EmployeeRepository,
    private readonly policy: EmployeeAccessPolicy,
    private readonly audit: AuditLoggerPort,
  ) {}

  async execute(actor: AccessActor, id: string, input: UpdateEmployeeData): Promise<Employee> {
    const current = await this.employees.findById(id);
    if (!current) throw new NotFoundError('Empleado');

    const data = this.policy.isPrivileged(actor)
      ? this.normalize(input)
      : this.restrictToSelf(actor, id, input);

    const updated = await this.employees.update(id, data);
    await this.recordHistory(actor, current, updated, data);

    await this.audit.log({
      userId: actor.userId,
      action: 'EMPLOYEE_UPDATED',
      entity: 'Employee',
      entityId: id,
      changes: { fields: Object.keys(data) },
    });
    return updated;
  }

  private normalize(input: UpdateEmployeeData): UpdateEmployeeData {
    const data: UpdateEmployeeData = { ...input };
    if (input.ci !== undefined) data.ci = CI.create(input.ci).value;
    if (input.baseSalary !== undefined) data.baseSalary = Salary.create(input.baseSalary).amount;
    return data;
  }

  /** Un empleado no privilegiado solo toca su propio perfil, y solo datos de contacto. */
  private restrictToSelf(actor: AccessActor, id: string, input: UpdateEmployeeData): UpdateEmployeeData {
    if (!this.policy.isSelf(actor, id)) this.policy.assertCanManage(actor);
    const data: UpdateEmployeeData = {};
    SELF_EDITABLE.forEach((field) => {
      if (input[field] !== undefined) {
        (data as Record<string, unknown>)[field] = input[field];
      }
    });
    return data;
  }

  /** Ascensos, cambios de salario y de departamento quedan en el historial (2.1). */
  private async recordHistory(
    actor: AccessActor,
    before: Employee,
    after: Employee,
    data: UpdateEmployeeData,
  ): Promise<void> {
    const effectiveDate = new Date();
    const entries: { changeType: string; field: string; oldValue: string; newValue: string }[] = [];

    if (data.baseSalary !== undefined && before.baseSalary !== after.baseSalary) {
      entries.push({
        changeType: 'SALARY_CHANGE',
        field: 'baseSalary',
        oldValue: String(before.baseSalary),
        newValue: String(after.baseSalary),
      });
    }
    if (data.departmentId !== undefined && before.departmentId !== after.departmentId) {
      entries.push({
        changeType: 'DEPARTMENT_CHANGE',
        field: 'departmentId',
        oldValue: before.departmentName ?? '-',
        newValue: after.departmentName ?? '-',
      });
    }
    if (data.positionId !== undefined && before.positionId !== after.positionId) {
      entries.push({
        changeType: 'POSITION_CHANGE',
        field: 'positionId',
        oldValue: before.positionName ?? '-',
        newValue: after.positionName ?? '-',
      });
    }
    if (data.contractType !== undefined && before.contractType !== after.contractType) {
      entries.push({
        changeType: 'CONTRACT_CHANGE',
        field: 'contractType',
        oldValue: before.contractType,
        newValue: after.contractType,
      });
    }

    for (const entry of entries) {
      await this.employees.addHistory({
        employeeId: after.id,
        changeType: entry.changeType,
        field: entry.field,
        oldValue: entry.oldValue,
        newValue: entry.newValue,
        effectiveDate,
        changedBy: actor.userId,
      });
    }
  }
}
