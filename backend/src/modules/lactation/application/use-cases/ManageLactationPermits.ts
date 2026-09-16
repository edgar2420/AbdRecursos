import { AuditLoggerPort } from '../../../../shared/application/AuditLogger';
import { BusinessRuleError, NotFoundError } from '../../../../shared/domain/errors';
import { Paginated } from '../../../../shared/domain/pagination';
import { EmployeeRepository } from '../../../employees/domain/repositories/EmployeeRepository';
import { AccessActor, EmployeeAccessPolicy } from '../../../employees/domain/services/EmployeeAccessPolicy';
import { GetLegalParameters } from '../../../legal-parameters/application/use-cases/GetLegalParameters';
import { LactationPermit } from '../../domain/entities/LactationPermit';
import { LactationFilters, LactationRepository } from '../../domain/repositories/LactationRepository';
import { LactationRules } from '../../domain/services/LactationRules';

export interface RegisterLactationInput {
  employeeId: string;
  birthDate: Date;
  childName?: string;
  startDate?: Date;
  slot1Start?: string;
  slot1End?: string;
  slot2Start?: string;
  slot2End?: string;
  documentUrl?: string;
  notes?: string;
}

/** Registrar un permiso de lactancia es exclusivo de RRHH/Admin (seccion 3). */
export class RegisterLactationPermit {
  constructor(
    private readonly permits: LactationRepository,
    private readonly employees: EmployeeRepository,
    private readonly parameters: GetLegalParameters,
    private readonly policy: EmployeeAccessPolicy,
    private readonly audit: AuditLoggerPort,
  ) {}

  async execute(actor: AccessActor, input: RegisterLactationInput): Promise<LactationPermit> {
    this.policy.assertCanManage(actor);
    const employee = await this.employees.findById(input.employeeId);
    if (!employee) throw new NotFoundError('Empleado');

    const rules = new LactationRules(await this.parameters.execute(new Date()));
    rules.assertNotExpired(input.birthDate);

    if (await this.permits.findActiveByEmployee(input.employeeId)) {
      throw new BusinessRuleError('La empleada ya tiene un permiso de lactancia vigente');
    }

    const dailyMinutes = rules.dailyMinutes();
    rules.assertValidSlots(
      [
        { start: input.slot1Start, end: input.slot1End },
        { start: input.slot2Start, end: input.slot2End },
      ],
      dailyMinutes,
    );

    const permit = await this.permits.create({
      employeeId: input.employeeId,
      birthDate: input.birthDate,
      childName: input.childName ?? null,
      startDate: input.startDate ?? new Date(),
      endDate: rules.endDateFor(input.birthDate),
      dailyMinutes,
      slot1Start: input.slot1Start ?? null,
      slot1End: input.slot1End ?? null,
      slot2Start: input.slot2Start ?? null,
      slot2End: input.slot2End ?? null,
      documentUrl: input.documentUrl ?? null,
      notes: input.notes ?? null,
    });

    // Inamovilidad laboral: se marca en el perfil como dato informativo (6.2).
    await this.employees.update(input.employeeId, {
      jobProtection: true,
      jobProtectionUntil: rules.jobProtectionUntil(input.birthDate),
    });

    await this.audit.log({
      userId: actor.userId,
      action: 'LACTATION_PERMIT_CREATED',
      entity: 'LactationPermit',
      entityId: permit.id,
      changes: { employeeId: input.employeeId, endDate: permit.endDate },
    });
    return permit;
  }
}

export class ListLactationPermits {
  constructor(
    private readonly permits: LactationRepository,
    private readonly policy: EmployeeAccessPolicy,
  ) {}

  async execute(actor: AccessActor, filters: LactationFilters): Promise<Paginated<LactationPermit>> {
    // Los datos de lactancia son sensibles: RRHH/Admin ven todo, el resto solo lo propio.
    if (this.policy.isPrivileged(actor)) return this.permits.list(filters);
    if (!actor.employeeId) {
      return { data: [], meta: { total: 0, page: filters.page, limit: filters.limit, totalPages: 1 } };
    }
    return this.permits.list({ ...filters, employeeId: actor.employeeId });
  }
}

export class UpdateLactationPermit {
  constructor(
    private readonly permits: LactationRepository,
    private readonly parameters: GetLegalParameters,
    private readonly policy: EmployeeAccessPolicy,
    private readonly audit: AuditLoggerPort,
  ) {}

  async execute(
    actor: AccessActor,
    id: string,
    data: {
      childName?: string;
      slot1Start?: string;
      slot1End?: string;
      slot2Start?: string;
      slot2End?: string;
      notes?: string;
      isActive?: boolean;
    },
  ): Promise<LactationPermit> {
    this.policy.assertCanManage(actor);
    const permit = await this.permits.findById(id);
    if (!permit) throw new NotFoundError('Permiso de lactancia');

    const rules = new LactationRules(await this.parameters.execute(new Date()));
    rules.assertValidSlots(
      [
        { start: data.slot1Start ?? permit.slot1Start, end: data.slot1End ?? permit.slot1End },
        { start: data.slot2Start ?? permit.slot2Start, end: data.slot2End ?? permit.slot2End },
      ],
      permit.dailyMinutes,
    );

    const updated = await this.permits.update(id, data);
    await this.audit.log({
      userId: actor.userId,
      action: 'LACTATION_PERMIT_UPDATED',
      entity: 'LactationPermit',
      entityId: id,
      changes: { fields: Object.keys(data) },
    });
    return updated;
  }
}

/** Alertas de vencimiento proximo del beneficio (2.4). */
export class GetExpiringLactationPermits {
  constructor(
    private readonly permits: LactationRepository,
    private readonly parameters: GetLegalParameters,
    private readonly policy: EmployeeAccessPolicy,
  ) {}

  async execute(actor: AccessActor, days?: number): Promise<LactationPermit[]> {
    this.policy.assertCanManage(actor);
    const rules = new LactationRules(await this.parameters.execute(new Date()));
    const threshold = days ?? rules.alertThresholdDays();
    const before = new Date();
    before.setDate(before.getDate() + threshold);

    const page = await this.permits.list({
      page: 1,
      limit: 100,
      order: 'asc',
      isActive: true,
      expiringBefore: before,
    });
    return page.data;
  }
}
