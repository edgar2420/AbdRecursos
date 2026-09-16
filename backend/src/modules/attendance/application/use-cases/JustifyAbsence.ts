import { AuditLoggerPort } from '../../../../shared/application/AuditLogger';
import { ForbiddenError, NotFoundError } from '../../../../shared/domain/errors';
import { Paginated, PageQuery } from '../../../../shared/domain/pagination';
import { AccessActor, EmployeeAccessPolicy } from '../../../employees/domain/services/EmployeeAccessPolicy';
import { AttendanceJustification, JustificationStatus } from '../../domain/entities/AttendanceRecord';
import { AttendanceRepository } from '../../domain/repositories/AttendanceRepository';

/** Justificacion de faltas/tardanzas con adjunto (2.5). */
export class JustifyAbsence {
  constructor(
    private readonly attendance: AttendanceRepository,
    private readonly policy: EmployeeAccessPolicy,
    private readonly audit: AuditLoggerPort,
  ) {}

  async execute(
    actor: AccessActor,
    input: { employeeId?: string; date: Date; reason: string; attachmentUrl?: string },
  ): Promise<AttendanceJustification> {
    const employeeId = input.employeeId ?? actor.employeeId;
    if (!employeeId) throw new ForbiddenError('Su usuario no esta vinculado a un empleado');
    if (employeeId !== actor.employeeId) this.policy.assertCanManage(actor);

    const justification = await this.attendance.createJustification({
      employeeId,
      date: input.date,
      reason: input.reason,
      attachmentUrl: input.attachmentUrl ?? null,
    });
    await this.audit.log({
      userId: actor.userId,
      action: 'ATTENDANCE_JUSTIFICATION_CREATED',
      entity: 'AttendanceJustification',
      entityId: justification.id,
      changes: { employeeId, date: input.date },
    });
    return justification;
  }
}

export class ListJustifications {
  constructor(
    private readonly attendance: AttendanceRepository,
    private readonly policy: EmployeeAccessPolicy,
  ) {}

  async execute(
    actor: AccessActor,
    filters: PageQuery & { status?: JustificationStatus; dateFrom?: Date; dateTo?: Date },
  ): Promise<Paginated<AttendanceJustification>> {
    const scope = await this.policy.scopeFor(actor);
    if (scope.all) return this.attendance.listJustifications(filters);
    if (scope.employeeIds.length === 0) {
      return { data: [], meta: { total: 0, page: filters.page, limit: filters.limit, totalPages: 1 } };
    }
    return this.attendance.listJustifications({ ...filters, employeeIds: scope.employeeIds });
  }
}

/** Revisar (aprobar/rechazar) corresponde al supervisor del equipo o a RRHH. */
export class ReviewJustification {
  constructor(
    private readonly attendance: AttendanceRepository,
    private readonly policy: EmployeeAccessPolicy,
    private readonly audit: AuditLoggerPort,
  ) {}

  async execute(
    actor: AccessActor,
    id: string,
    status: 'APPROVED' | 'REJECTED',
    reviewNotes?: string,
  ): Promise<AttendanceJustification> {
    const justification = await this.attendance.findJustification(id);
    if (!justification) throw new NotFoundError('Justificacion');
    await this.policy.assertCanView(actor, justification.employeeId);
    if (this.policy.isSelf(actor, justification.employeeId) && !this.policy.isPrivileged(actor)) {
      throw new ForbiddenError('No puede revisar su propia justificacion');
    }

    const updated = await this.attendance.reviewJustification(id, {
      status,
      reviewedBy: actor.userId,
      reviewNotes: reviewNotes ?? null,
    });
    await this.audit.log({
      userId: actor.userId,
      action: `ATTENDANCE_JUSTIFICATION_${status}`,
      entity: 'AttendanceJustification',
      entityId: id,
      changes: { reviewNotes },
    });
    return updated;
  }
}
