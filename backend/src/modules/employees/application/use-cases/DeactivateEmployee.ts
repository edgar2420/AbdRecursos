import { AuditLoggerPort } from '../../../../shared/application/AuditLogger';
import { NotFoundError } from '../../../../shared/domain/errors';
import { Employee } from '../../domain/entities/Employee';
import { EmployeeRepository } from '../../domain/repositories/EmployeeRepository';
import { AccessActor, EmployeeAccessPolicy } from '../../domain/services/EmployeeAccessPolicy';

/**
 * Baja logica (is_active = false): nunca se borra un empleado, porque sus boletas
 * y su historial deben seguir existiendo (seccion 9).
 */
export class DeactivateEmployee {
  constructor(
    private readonly employees: EmployeeRepository,
    private readonly policy: EmployeeAccessPolicy,
    private readonly audit: AuditLoggerPort,
  ) {}

  async execute(
    actor: AccessActor,
    id: string,
    options: { terminationDate?: Date; notes?: string } = {},
  ): Promise<Employee> {
    this.policy.assertCanManage(actor);
    const current = await this.employees.findById(id);
    if (!current) throw new NotFoundError('Empleado');

    const terminationDate = options.terminationDate ?? new Date();
    await this.employees.update(id, { status: 'TERMINATED', terminationDate });
    const updated = await this.employees.setActive(id, false);

    await this.employees.addHistory({
      employeeId: id,
      changeType: 'TERMINATION',
      effectiveDate: terminationDate,
      oldValue: current.status,
      newValue: 'TERMINATED',
      notes: options.notes ?? null,
      changedBy: actor.userId,
    });
    await this.audit.log({
      userId: actor.userId,
      action: 'EMPLOYEE_DEACTIVATED',
      entity: 'Employee',
      entityId: id,
      changes: { terminationDate, notes: options.notes },
    });
    return updated;
  }
}

export class ReactivateEmployee {
  constructor(
    private readonly employees: EmployeeRepository,
    private readonly policy: EmployeeAccessPolicy,
    private readonly audit: AuditLoggerPort,
  ) {}

  async execute(actor: AccessActor, id: string): Promise<Employee> {
    this.policy.assertCanManage(actor);
    const current = await this.employees.findById(id);
    if (!current) throw new NotFoundError('Empleado');

    await this.employees.update(id, { status: 'ACTIVE', terminationDate: null });
    const updated = await this.employees.setActive(id, true);
    await this.employees.addHistory({
      employeeId: id,
      changeType: 'REACTIVATION',
      effectiveDate: new Date(),
      oldValue: current.status,
      newValue: 'ACTIVE',
      changedBy: actor.userId,
    });
    await this.audit.log({
      userId: actor.userId,
      action: 'EMPLOYEE_REACTIVATED',
      entity: 'Employee',
      entityId: id,
    });
    return updated;
  }
}
