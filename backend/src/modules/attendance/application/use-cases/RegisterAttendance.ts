import { AuditLoggerPort } from '../../../../shared/application/AuditLogger';
import { BusinessRuleError, ForbiddenError } from '../../../../shared/domain/errors';
import { startOfDay } from '../../../../shared/domain/dates';
import { AccessActor, EmployeeAccessPolicy } from '../../../employees/domain/services/EmployeeAccessPolicy';
import { GetLegalParameters } from '../../../legal-parameters/application/use-cases/GetLegalParameters';
import { ScheduleRepository } from '../../../schedules/domain/repositories/ScheduleRepository';
import { AttendanceRecord, AttendanceSource, AttendanceType } from '../../domain/entities/AttendanceRecord';
import { AttendanceRepository } from '../../domain/repositories/AttendanceRepository';
import { AttendanceCalculator } from '../../domain/services/AttendanceCalculator';

export interface RegisterAttendanceInput {
  type: AttendanceType;
  employeeId?: string;
  timestamp?: Date;
  source?: AttendanceSource;
  latitude?: number;
  longitude?: number;
  notes?: string;
}

/**
 * Marcacion manual de RRHH o Administracion para otro empleado (olvido de marcar, falla del reloj).
 * La asistencia diaria se marca en el biometrico: ya no se marca desde la web.
 */
export class RegisterAttendance {
  constructor(
    private readonly attendance: AttendanceRepository,
    private readonly schedules: ScheduleRepository,
    private readonly parameters: GetLegalParameters,
    private readonly policy: EmployeeAccessPolicy,
    private readonly audit: AuditLoggerPort,
  ) {}

  async execute(actor: AccessActor, input: RegisterAttendanceInput): Promise<AttendanceRecord> {
    const employeeId = input.employeeId;
    if (!employeeId || employeeId === actor.employeeId) {
      throw new ForbiddenError(
        employeeId
          ? 'No puede registrar sus propias marcaciones: pida a otra persona de RRHH que lo haga'
          : 'La asistencia se marca en el biometrico; RRHH puede agregar una marcacion faltante desde Asistencia',
      );
    }
    this.policy.assertCanManage(actor);

    const timestamp = input.timestamp ?? new Date();

    const last = await this.attendance.lastRecordOfDay(employeeId, startOfDay(timestamp));
    if (last && last.type === input.type) {
      throw new BusinessRuleError(
        input.type === 'CHECK_IN'
          ? 'Ya registro su entrada. Marque la salida antes de volver a entrar.'
          : 'Ya registro su salida.',
      );
    }
    if (!last && input.type === 'CHECK_OUT') {
      throw new BusinessRuleError('No hay una entrada registrada hoy para marcar la salida');
    }

    const assignment = await this.schedules.findActiveForEmployee(employeeId, timestamp);
    const calculator = new AttendanceCalculator(await this.parameters.execute(timestamp));
    const lateMinutes =
      input.type === 'CHECK_IN'
        ? calculator.lateMinutesFor(
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
          )
        : 0;

    if (input.type === 'CHECK_IN' && lateMinutes > 0 && !input.notes?.trim()) {
      throw new BusinessRuleError('Debe indicar el motivo de la tardanza');
    }

    const record = await this.attendance.create({
      employeeId,
      timestamp,
      type: input.type,
      source: input.source ?? 'MANUAL_HR',
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      notes: input.notes ?? null,
      lateMinutes,
    });

    await this.audit.log({
      userId: actor.userId,
      action: 'ATTENDANCE_REGISTERED_BY_HR',
      entity: 'AttendanceRecord',
      entityId: record.id,
      changes: { employeeId, type: input.type, timestamp, notes: input.notes ?? null },
    });
    return record;
  }
}
