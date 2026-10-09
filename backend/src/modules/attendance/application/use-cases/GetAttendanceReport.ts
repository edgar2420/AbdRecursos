import { ForbiddenError } from '../../../../shared/domain/errors';
import { addDays, daysBetween, startOfDay, toDateOnlyString } from '../../../../shared/domain/dates';
import { round2 } from '../../../../shared/domain/money';
import { Employee } from '../../../employees/domain/entities/Employee';
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
  /** Dias con marcacion pero sin entrada o sin salida. */
  daysIncomplete: number;
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
    input: {
      from: Date;
      to: Date;
      employeeId?: string;
      departmentId?: string;
      search?: string;
      page?: number;
      limit?: number;
      includeDays?: boolean;
      /** 'late': solo empleados con atrasos, ordenados de mas a menos. */
      sortBy?: 'name' | 'late';
    },
  ): Promise<{ rows: AttendanceReportRow[]; total: number }> {
    if (daysBetween(input.from, input.to) > MAX_RANGE_DAYS) {
      throw new ForbiddenError(`El rango maximo del reporte es de ${MAX_RANGE_DAYS} dias`);
    }

    const scope = await this.policy.scopeFor(actor);
    if (!scope.all && input.employeeId && !scope.employeeIds.includes(input.employeeId)) {
      throw new ForbiddenError('No tiene acceso a la asistencia de ese empleado');
    }
    const restringidos = input.employeeId ? [input.employeeId] : scope.all ? undefined : scope.employeeIds;
    const filtros = {
      isActive: true,
      ...(input.departmentId ? { departmentId: input.departmentId } : {}),
      ...(input.search ? { search: input.search } : {}),
      ...(restringidos ? { ids: restringidos } : {}),
    };

    // Solo se calcula a quien hace falta: la paginacion y el filtro de atrasos los resuelve la base.
    const porAtrasos = input.sortBy === 'late';
    let roster: Employee[];
    let total: number;
    if (porAtrasos) {
      const conAtraso = await this.attendance.empleadosConAtraso(input.from, input.to, restringidos);
      if (conAtraso.length === 0) return { rows: [], total: 0 };
      roster = await this.employees.listAll({ ...filtros, ids: conAtraso });
      total = roster.length;
    } else if (input.page && input.limit) {
      const pagina = await this.employees.list({ ...filtros, page: input.page, limit: input.limit });
      roster = pagina.data;
      total = pagina.meta.total;
    } else {
      roster = await this.employees.listAll(filtros);
      total = roster.length;
    }
    if (roster.length === 0) return { rows: [], total };

    const employeeIds = roster.map((e) => e.id);
    const [records, assignments, justified, params] = await Promise.all([
      this.attendance.listBetween(input.from, input.to, employeeIds),
      this.schedules.findActiveForEmployees(employeeIds, input.to),
      this.attendance.approvedJustificationDates(employeeIds, input.from, input.to),
      this.parameters.execute(input.to),
    ]);

    const calculator = new AttendanceCalculator(params);
    const horarioDe = new Map(assignments.map((a) => [a.employeeId, a]));
    const justifiedSet = new Set(justified.map((j) => `${j.employeeId}:${toDateOnlyString(j.date)}`));
    const recordsByDay = new Map<string, typeof records>();
    for (const record of records) {
      const key = `${record.employeeId}:${toDateOnlyString(record.timestamp)}`;
      const list = recordsByDay.get(key);
      if (list) list.push(record);
      else recordsByDay.set(key, [record]);
    }

    const rows = roster.map((employee) => {
      const assignment = horarioDe.get(employee.id) ?? null;
      const schedule = assignment
        ? {
            startTime: assignment.startTime,
            endTime: assignment.endTime,
            toleranceMinutes: assignment.toleranceMinutes,
            breakMinutes: assignment.breakMinutes,
            weekDays: assignment.weekDays,
          }
        : null;

      const days: DaySummary[] = [];
      let cursor = startOfDay(input.from);
      const last = startOfDay(input.to);
      while (cursor <= last) {
        const key = toDateOnlyString(cursor);
        const dayRecords = recordsByDay.get(`${employee.id}:${key}`) ?? [];
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
        daysLate: days.filter((d) => d.lateMinutes > 0).length,
        daysIncomplete: days.filter((d) => d.status === 'INCOMPLETE').length,
        totalLateMinutes: days.reduce((acc, d) => acc + d.lateMinutes, 0),
        workedHours: round2(days.reduce((acc, d) => acc + d.workedHours, 0)),
        overtimeHours: round2(days.reduce((acc, d) => acc + d.overtimeHours, 0)),
        days: input.includeDays ? days : [],
      };
    });

    if (!porAtrasos) return { rows, total };

    const ranking = rows
      .filter((row) => row.daysLate > 0)
      .sort((a, b) => b.daysLate - a.daysLate || b.totalLateMinutes - a.totalLateMinutes);
    total = ranking.length;
    if (input.page && input.limit) {
      const start = (input.page - 1) * input.limit;
      return { rows: ranking.slice(start, start + input.limit), total };
    }
    return { rows: ranking, total };
  }
}
