import { AuditLoggerPort } from '../../../../shared/application/AuditLogger';
import { BusinessRuleError, NotFoundError } from '../../../../shared/domain/errors';
import { Employee } from '../../domain/entities/Employee';
import { MotivoBaja, notaDeBaja, problemaFechaBaja } from '../../domain/motivosBaja';
import { AccesoEmpleadoPort } from '../../domain/ports/AccesoEmpleadoPort';
import { EmployeeRepository } from '../../domain/repositories/EmployeeRepository';
import { AccessActor, EmployeeAccessPolicy } from '../../domain/services/EmployeeAccessPolicy';

export interface ResultadoBaja {
  employee: Employee;
  /** true si el empleado tenia usuario y quedo bloqueado (o habilitado, al reactivar). */
  usuarioAfectado: boolean;
}

/**
 * Baja logica: el empleado queda inactivo con fecha y motivo de retiro, se conserva todo su
 * historial y su usuario se bloquea (con las sesiones abiertas cerradas).
 */
export class DeactivateEmployee {
  constructor(
    private readonly employees: EmployeeRepository,
    private readonly policy: EmployeeAccessPolicy,
    private readonly audit: AuditLoggerPort,
    private readonly acceso: AccesoEmpleadoPort,
  ) {}

  async execute(
    actor: AccessActor,
    id: string,
    options: { terminationDate?: Date; motivo?: MotivoBaja; notes?: string } = {},
  ): Promise<ResultadoBaja> {
    this.policy.assertCanManage(actor);
    const current = await this.employees.findById(id);
    if (!current) throw new NotFoundError('Empleado');
    if (!current.isActive) throw new BusinessRuleError('El empleado ya esta dado de baja');

    const terminationDate = options.terminationDate ?? new Date();
    const problema = problemaFechaBaja(terminationDate, current.hireDate);
    if (problema) throw new BusinessRuleError(problema);

    const notas = options.notes?.trim() || null;
    await this.employees.update(id, {
      status: 'TERMINATED',
      terminationDate,
      terminationReason: options.motivo ?? null,
      terminationNotes: notas,
    });
    const employee = await this.employees.setActive(id, false);
    const usuarioAfectado = await this.acceso.bloquear(id);

    await this.employees.addHistory({
      employeeId: id,
      changeType: 'TERMINATION',
      effectiveDate: terminationDate,
      oldValue: current.status,
      newValue: 'TERMINATED',
      notes: notaDeBaja(options.motivo, notas),
      changedBy: actor.userId,
    });
    await this.audit.log({
      userId: actor.userId,
      action: 'EMPLOYEE_DEACTIVATED',
      entity: 'Employee',
      entityId: id,
      changes: { terminationDate, motivo: options.motivo ?? null, notes: notas, usuarioBloqueado: usuarioAfectado },
    });
    return { employee, usuarioAfectado };
  }
}

/** Reingreso de alguien dado de baja: vuelve a activo y su usuario se habilita de nuevo. */
export class ReactivateEmployee {
  constructor(
    private readonly employees: EmployeeRepository,
    private readonly policy: EmployeeAccessPolicy,
    private readonly audit: AuditLoggerPort,
    private readonly acceso: AccesoEmpleadoPort,
  ) {}

  async execute(actor: AccessActor, id: string, options: { notes?: string } = {}): Promise<ResultadoBaja> {
    this.policy.assertCanManage(actor);
    const current = await this.employees.findById(id);
    if (!current) throw new NotFoundError('Empleado');
    if (current.isActive) throw new BusinessRuleError('El empleado ya esta activo');

    const notas = options.notes?.trim() || null;
    await this.employees.update(id, {
      status: 'ACTIVE',
      terminationDate: null,
      terminationReason: null,
      terminationNotes: null,
    });
    const employee = await this.employees.setActive(id, true);
    const usuarioAfectado = await this.acceso.habilitar(id);

    await this.employees.addHistory({
      employeeId: id,
      changeType: 'REACTIVATION',
      effectiveDate: new Date(),
      oldValue: current.status,
      newValue: 'ACTIVE',
      notes: notas,
      changedBy: actor.userId,
    });
    await this.audit.log({
      userId: actor.userId,
      action: 'EMPLOYEE_REACTIVATED',
      entity: 'Employee',
      entityId: id,
      changes: {
        bajaAnterior: current.terminationDate,
        motivoAnterior: current.terminationReason,
        notes: notas,
        usuarioHabilitado: usuarioAfectado,
      },
    });
    return { employee, usuarioAfectado };
  }
}
