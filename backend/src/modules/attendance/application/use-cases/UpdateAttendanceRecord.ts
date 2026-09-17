import { AuditLoggerPort } from '../../../../shared/application/AuditLogger';
import { BusinessRuleError, ForbiddenError, NotFoundError } from '../../../../shared/domain/errors';
import { AccessActor, EmployeeAccessPolicy } from '../../../employees/domain/services/EmployeeAccessPolicy';
import { GetLegalParameters } from '../../../legal-parameters/application/use-cases/GetLegalParameters';
import { ScheduleRepository } from '../../../schedules/domain/repositories/ScheduleRepository';
import { AttendanceRecord } from '../../domain/entities/AttendanceRecord';
import { AttendanceRepository } from '../../domain/repositories/AttendanceRepository';
import { AttendanceCalculator } from '../../domain/services/AttendanceCalculator';

export interface UpdateAttendanceRecordInput {
  timestamp?: Date;
  notes?: string;
  reason: string;
}

export class UpdateAttendanceRecord {
  constructor(
    private readonly attendance: AttendanceRepository,
    private readonly schedules: ScheduleRepository,
    private readonly parameters: GetLegalParameters,
    private readonly policy: EmployeeAccessPolicy,
    private readonly audit: AuditLoggerPort,
  ) {}

  async execute(actor: AccessActor, id: string, input: UpdateAttendanceRecordInput): Promise<AttendanceRecord> {
    if (!this.policy.isPrivileged(actor)) {
      throw new ForbiddenError('Solo RRHH o Administracion pueden modificar una marcacion');
    }
    if (!input.reason?.trim()) {
      throw new BusinessRuleError('Debe indicar el motivo de la modificacion');
    }

    const existing = await this.attendance.findById(id);
    if (!existing) throw new NotFoundError('Marcacion');

    const timestamp = input.timestamp ?? existing.timestamp;
    let lateMinutes = existing.lateMinutes;
    if (existing.type === 'CHECK_IN' && input.timestamp) {
      const assignment = await this.schedules.findActiveForEmployee(existing.employeeId, timestamp);
      const calculator = new AttendanceCalculator(await this.parameters.execute(timestamp));
      lateMinutes = calculator.lateMinutesFor(
        timestamp,
        assignment
          ? {
              startTime: assignment.startTime,
              endTime: assignment.endTime,
              toleranceMinutes: assignment.toleranceMinutes,
              breakMinutes: 0,
              weekDays: assignment.weekDays,
            }
          : null,
      );
    }

    const updated = await this.attendance.update(id, {
      timestamp: input.timestamp,
      notes: input.notes !== undefined ? input.notes : undefined,
      lateMinutes,
    });

    await this.audit.log({
      userId: actor.userId,
      action: 'ATTENDANCE_RECORD_UPDATED',
      entity: 'AttendanceRecord',
      entityId: id,
      changes: {
        reason: input.reason,
        before: { timestamp: existing.timestamp, notes: existing.notes, lateMinutes: existing.lateMinutes },
        after: { timestamp: updated.timestamp, notes: updated.notes, lateMinutes: updated.lateMinutes },
      },
    });

    return updated;
  }
}
