import { AuditLoggerPort } from '../../../../shared/application/AuditLogger';
import { addDays } from '../../../../shared/domain/dates';
import { BusinessRuleError, NotFoundError } from '../../../../shared/domain/errors';
import { EmployeeRepository } from '../../../employees/domain/repositories/EmployeeRepository';
import { AccessActor, EmployeeAccessPolicy } from '../../../employees/domain/services/EmployeeAccessPolicy';
import { ScheduleRepository } from '../../domain/repositories/ScheduleRepository';
import { TardanzaRecalculator } from '../ports/TardanzaRecalculator';

export interface AsignacionEnBloque {
  scheduleId: string;
  departmentIds: string[];
  positionIds: string[];
  validFrom: Date;
  /** Si es true, a quien ya tiene horario se le cierra el actual el dia anterior. */
  reemplazar: boolean;
}

export interface ResultadoEnBloque {
  empleados: number;
  asignados: number;
  reemplazados: number;
  yaLoTenian: number;
  omitidos: number;
}

/** Asigna un horario a todos los empleados activos de uno o varios departamentos y/o cargos. */
export class AssignScheduleBulk {
  constructor(
    private readonly schedules: ScheduleRepository,
    private readonly employees: EmployeeRepository,
    private readonly policy: EmployeeAccessPolicy,
    private readonly audit: AuditLoggerPort,
    private readonly tardanzas?: TardanzaRecalculator,
  ) {}

  async execute(actor: AccessActor, input: AsignacionEnBloque): Promise<ResultadoEnBloque> {
    this.policy.assertCanManage(actor);
    if (input.departmentIds.length === 0 && input.positionIds.length === 0) {
      throw new BusinessRuleError('Elija al menos un departamento o un cargo');
    }
    if (!(await this.schedules.findById(input.scheduleId))) throw new NotFoundError('Horario');

    const seleccion = new Map<string, true>();
    for (const departmentId of input.departmentIds) {
      for (const e of await this.employees.listAll({ isActive: true, departmentId })) seleccion.set(e.id, true);
    }
    for (const positionId of input.positionIds) {
      for (const e of await this.employees.listAll({ isActive: true, positionId })) seleccion.set(e.id, true);
    }
    const ids = [...seleccion.keys()];
    if (ids.length === 0) throw new BusinessRuleError('No hay empleados activos en la seleccion');

    const resultado: ResultadoEnBloque = { empleados: ids.length, asignados: 0, reemplazados: 0, yaLoTenian: 0, omitidos: 0 };
    const afectados: string[] = [];

    for (const employeeId of ids) {
      if (await this.schedules.hasOverlappingAssignment(employeeId, input.validFrom, null)) {
        const actual = await this.schedules.findActiveForEmployee(employeeId, input.validFrom);
        if (actual?.scheduleId === input.scheduleId) {
          resultado.yaLoTenian++;
          continue;
        }
        if (!input.reemplazar || !actual || actual.validFrom >= input.validFrom) {
          resultado.omitidos++;
          continue;
        }
        await this.schedules.endAssignment(actual.id, addDays(input.validFrom, -1));
        if (await this.schedules.hasOverlappingAssignment(employeeId, input.validFrom, null)) {
          resultado.omitidos++;
          continue;
        }
        resultado.reemplazados++;
      }
      await this.schedules.assign({ scheduleId: input.scheduleId, employeeId, validFrom: input.validFrom, validUntil: null });
      resultado.asignados++;
      afectados.push(employeeId);
    }

    await this.tardanzas?.recalcularEmpleados(afectados, input.validFrom);
    await this.audit.log({
      userId: actor.userId,
      action: 'SCHEDULE_ASSIGNED_BULK',
      entity: 'ScheduleAssignment',
      entityId: input.scheduleId,
      changes: {
        ...resultado,
        departamentos: input.departmentIds.length,
        cargos: input.positionIds.length,
        validFrom: input.validFrom,
        reemplazar: input.reemplazar,
      },
    });
    return resultado;
  }
}
