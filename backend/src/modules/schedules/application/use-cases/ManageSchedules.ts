import { AuditLoggerPort } from '../../../../shared/application/AuditLogger';
import { BusinessRuleError, NotFoundError } from '../../../../shared/domain/errors';
import { Paginated, PageQuery } from '../../../../shared/domain/pagination';
import { AccessActor, EmployeeAccessPolicy } from '../../../employees/domain/services/EmployeeAccessPolicy';
import {
  NewSchedule,
  NewScheduleAssignment,
  Schedule,
  ScheduleAssignment,
} from '../../domain/entities/Schedule';
import { ScheduleRepository } from '../../domain/repositories/ScheduleRepository';
import { TardanzaRecalculator } from '../ports/TardanzaRecalculator';
import { minutosDeAlmuerzo, problemaConAlmuerzo } from '../../domain/almuerzo';

export class ListSchedules {
  constructor(private readonly schedules: ScheduleRepository) {}

  execute(query: PageQuery & { isActive?: boolean }): Promise<Paginated<Schedule>> {
    return this.schedules.list(query);
  }
}

export class CreateSchedule {
  constructor(
    private readonly schedules: ScheduleRepository,
    private readonly policy: EmployeeAccessPolicy,
    private readonly audit: AuditLoggerPort,
  ) {}

  async execute(actor: AccessActor, data: NewSchedule): Promise<Schedule> {
    this.policy.assertCanManage(actor);
    if (data.weekDays.length === 0) {
      throw new BusinessRuleError('Seleccione al menos un dia de la semana');
    }
    const problema = problemaConAlmuerzo(data, data.lunchStart, data.lunchEnd);
    if (problema) throw new BusinessRuleError(problema);
    const minutos = minutosDeAlmuerzo(data.lunchStart, data.lunchEnd);
    const schedule = await this.schedules.create({ ...data, breakMinutes: minutos ?? data.breakMinutes });
    await this.audit.log({
      userId: actor.userId,
      action: 'SCHEDULE_CREATED',
      entity: 'Schedule',
      entityId: schedule.id,
      changes: { name: data.name, startTime: data.startTime, endTime: data.endTime },
    });
    return schedule;
  }
}

export class UpdateSchedule {
  constructor(
    private readonly schedules: ScheduleRepository,
    private readonly policy: EmployeeAccessPolicy,
    private readonly audit: AuditLoggerPort,
    private readonly tardanzas?: TardanzaRecalculator,
  ) {}

  async execute(
    actor: AccessActor,
    id: string,
    data: Partial<NewSchedule> & { isActive?: boolean },
  ): Promise<Schedule> {
    this.policy.assertCanManage(actor);
    const actual = await this.schedules.findById(id);
    if (!actual) throw new NotFoundError('Horario');
    const final = { ...actual, ...data };
    const problema = problemaConAlmuerzo(final, final.lunchStart, final.lunchEnd);
    if (problema) throw new BusinessRuleError(problema);
    const minutos = minutosDeAlmuerzo(final.lunchStart, final.lunchEnd);
    const updated = await this.schedules.update(id, minutos !== null ? { ...data, breakMinutes: minutos } : data);
    await this.tardanzas?.recalcularHorario(id);
    await this.audit.log({
      userId: actor.userId,
      action: 'SCHEDULE_UPDATED',
      entity: 'Schedule',
      entityId: id,
      changes: { fields: Object.keys(data) },
    });
    return updated;
  }
}

export class AssignSchedule {
  constructor(
    private readonly schedules: ScheduleRepository,
    private readonly policy: EmployeeAccessPolicy,
    private readonly audit: AuditLoggerPort,
    private readonly tardanzas?: TardanzaRecalculator,
  ) {}

  async execute(
    actor: AccessActor,
    input: { scheduleId: string; employeeIds: string[]; validFrom: Date; validUntil?: Date | null },
  ): Promise<ScheduleAssignment[]> {
    this.policy.assertCanManage(actor);
    const schedule = await this.schedules.findById(input.scheduleId);
    if (!schedule) throw new NotFoundError('Horario');

    const created: ScheduleAssignment[] = [];
    for (const employeeId of input.employeeIds) {
      const overlaps = await this.schedules.hasOverlappingAssignment(
        employeeId,
        input.validFrom,
        input.validUntil ?? null,
      );
      if (overlaps) {
        throw new BusinessRuleError(
          'Un empleado seleccionado ya tiene un horario vigente en ese rango. Cierre la asignacion anterior primero.',
        );
      }
      const assignment: NewScheduleAssignment = {
        scheduleId: input.scheduleId,
        employeeId,
        validFrom: input.validFrom,
        validUntil: input.validUntil ?? null,
      };
      created.push(await this.schedules.assign(assignment));
    }
    await this.tardanzas?.recalcularEmpleados(input.employeeIds, input.validFrom);

    await this.audit.log({
      userId: actor.userId,
      action: 'SCHEDULE_ASSIGNED',
      entity: 'ScheduleAssignment',
      entityId: input.scheduleId,
      changes: { employees: input.employeeIds.length, validFrom: input.validFrom },
    });
    return created;
  }
}

export class ListScheduleAssignments {
  constructor(
    private readonly schedules: ScheduleRepository,
    private readonly policy: EmployeeAccessPolicy,
  ) {}

  async execute(
    actor: AccessActor,
    query: PageQuery & { employeeId?: string; scheduleId?: string; departmentId?: string; at?: Date },
  ): Promise<Paginated<ScheduleAssignment>> {
    if (this.policy.isPrivileged(actor)) return this.schedules.listAssignments(query);
    const scope = await this.policy.scopeFor(actor);
    const page = await this.schedules.listAssignments(query);
    return {
      ...page,
      data: page.data.filter((a) => scope.employeeIds.includes(a.employeeId)),
    };
  }
}

export class EndScheduleAssignment {
  constructor(
    private readonly schedules: ScheduleRepository,
    private readonly policy: EmployeeAccessPolicy,
    private readonly audit: AuditLoggerPort,
    private readonly tardanzas?: TardanzaRecalculator,
  ) {}

  async execute(actor: AccessActor, id: string, validUntil: Date): Promise<ScheduleAssignment> {
    this.policy.assertCanManage(actor);
    const updated = await this.schedules.endAssignment(id, validUntil);
    await this.tardanzas?.recalcularEmpleados([updated.employeeId], updated.validFrom);
    await this.audit.log({
      userId: actor.userId,
      action: 'SCHEDULE_ASSIGNMENT_ENDED',
      entity: 'ScheduleAssignment',
      entityId: id,
      changes: { validUntil },
    });
    return updated;
  }
}
