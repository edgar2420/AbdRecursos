import { AccessActor, EmployeeAccessPolicy } from '../../../employees/domain/services/EmployeeAccessPolicy';
import { VacationRepository } from '../../domain/repositories/VacationRepository';

export interface CalendarEntry {
  requestId: string;
  employeeId: string;
  employeeName: string;
  departmentName: string | null;
  startDate: Date;
  endDate: Date;
  workingDays: number;
  status: string;
}

export class GetTeamCalendar {
  constructor(
    private readonly vacations: VacationRepository,
    private readonly policy: EmployeeAccessPolicy,
  ) {}

  async execute(actor: AccessActor, from: Date, to: Date): Promise<CalendarEntry[]> {
    const scope = await this.policy.scopeFor(actor);
    const requests = await this.vacations.listInRange(
      from,
      to,
      scope.all ? undefined : scope.employeeIds,
    );
    return requests
      .filter((r) => r.status !== 'REJECTED' && r.status !== 'CANCELLED')
      .map((r) => ({
        requestId: r.id,
        employeeId: r.employeeId,
        employeeName: r.employeeName,
        departmentName: r.departmentName,
        startDate: r.startDate,
        endDate: r.endDate,
        workingDays: r.workingDays,
        status: r.status,
      }));
  }
}
