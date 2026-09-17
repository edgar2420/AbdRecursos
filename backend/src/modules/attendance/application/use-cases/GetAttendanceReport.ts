import { ForbiddenError } from '../../../../shared/domain/errors';
import { addDays, daysBetween, startOfDay, toDateOnlyString } from '../../../../shared/domain/dates';
import { round2 } from '../../../../shared/domain/money';
import { EmployeeRepository } from '../../../employees/domain/repositories/EmployeeRepository';
import { AccessActor, EmployeeAccessPolicy } from '../../../employees/domain/services/EmployeeAccessPolicy';
import { GetLegalParameters } from '../../../legal-parameters/application/use-cases/GetLegalParameters';
import { ScheduleRepository } from '../../../schedules/domain/repositories/ScheduleRepository';
import { AttendanceRepository } from '../../domain/repositories/AttendanceRepository';
import { AttendanceCalculator, DaySummary } from '../../domain/services/AttendanceCalculator';

export interface AttendanceReportRow {
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  departmentName: string | null;
  scheduleName: string | null;
  daysPresent: number;
  daysAbsent: number;
  daysJustified: number;
  daysLate: number;
  totalLateMinutes: number;
  workedHours: number;
  overtimeHours: number;
  days: DaySummary[];
}

const MAX_RANGE_DAYS = 92;

export class GetAttendanceReport {
  constructor(
    private readonly attendance: AttendanceRepository,
    private readonly employees: EmployeeRepository,
    private readonly schedules: ScheduleRepository,
    private readonly parameters: GetLegalParameters,
    private readonly policy: EmployeeAccessPolicy,
  ) {}

  async execute(
    actor: AccessActor,
    input: { from: Date; to: Date; employeeId?: string; departmentId?: string; includeDays?: boolean },
  ): Promise<AttendanceReportRow[]> {
    if (daysBetween(input.from, input.to) > MAX_RANGE_DAYS) {
      throw new ForbiddenError(`El rango maximo del reporte es de ${MAX_RANGE_DAYS} dias`);
    }

    const scope = await this.policy.scopeFor(actor);
    const roster = await this.employees.listAll({
      isActive: true,
      ...(input.departmentId ? { departmentId: input.departmentId } : {}),
      ...(input.employeeId ? { ids: [input.employeeId] } : {}),
      ...(scope.all ? {} : { ids: input.employeeId ? [input.employeeId] : scope.employeeIds }),
    });
    if (!scope.all && input.employeeId && !scope.employeeIds.includes(input.employeeId)) {
      throw new ForbiddenError('No tiene acceso a la asistencia de ese empleado');
    }
    if (roster.length === 0) return [];

    const employeeIds = roster.map((e) => e.id);
    const [records, assignments, justified, params] = await Promise.all([
      this.attendance.listBetween(input.from, input.to, employeeIds),
      this.schedules.findActiveForEmployees(employeeIds, input.to),
      this.attendance.approvedJustificationDates(employeeIds, input.from, input.to),
      this.parameters.execute(input.to),
    ]);

    const calculator = new AttendanceCalculator(params);
    const justifiedSet = new Set(justified.map((j) => `${j.employeeId}:${toDateOnlyString(j.date)}`));

    return roster.map((employee) => {
      const assignment = assignments.find((a) => a.employeeId === employee.id) ?? null;
      const schedule = assignment
        ? {
            startTime: assignment.startTime,
            endTime: assignment.endTime,
            toleranceMinutes: assignment.toleranceMinutes,
            breakMinutes: 0,
            weekDays: assignment.weekDays,
          }
        : null;

      const days: DaySummary[] = [];
      let cursor = startOfDay(input.from);
      const last = startOfDay(input.to);
      while (cursor <= last) {
        const key = toDateOnlyString(cursor);
        const dayRecords = records.filter(
          (r) => r.employeeId === employee.id && toDateOnlyString(r.timestamp) === key,
        );
        days.push(
          calculator.summarizeDay(new Date(cursor), dayRecords, schedule, {
            isJustified: justifiedSet.has(`${employee.id}:${key}`),
          }),
        );
        cursor = addDays(cursor, 1);
      }

      return {
        employeeId: employee.id,
        employeeName: employee.fullName,
        employeeCode: employee.employeeCode,
        departmentName: employee.departmentName,
        scheduleName: assignment?.scheduleName ?? null,
        daysPresent: days.filter((d) => d.status === 'PRESENT' || d.status === 'LATE').length,
        daysAbsent: days.filter((d) => d.status === 'ABSENT').length,
        daysJustified: days.filter((d) => d.status === 'JUSTIFIED').length,
        daysLate: days.filter((d) => d.status === 'LATE').length,
        totalLateMinutes: days.reduce((acc, d) => acc + d.lateMinutes, 0),
        workedHours: round2(days.reduce((acc, d) => acc + d.workedHours, 0)),
        overtimeHours: round2(days.reduce((acc, d) => acc + d.overtimeHours, 0)),
        days: input.includeDays ? days : [],
      };
    });
  }
}
