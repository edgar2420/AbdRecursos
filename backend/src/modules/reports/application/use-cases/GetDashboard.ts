import { round2 } from '../../../../shared/domain/money';
import { AccessActor, EmployeeAccessPolicy } from '../../../employees/domain/services/EmployeeAccessPolicy';
import { DashboardCounters, ReportRepository } from '../../domain/repositories/ReportRepository';

export interface DashboardResult extends DashboardCounters {
  turnoverRate: number;
  absenteeismRate: number;
  scope: 'GLOBAL' | 'TEAM' | 'SELF';
  period: { from: Date; to: Date };
}

export class GetDashboard {
  constructor(
    private readonly reports: ReportRepository,
    private readonly policy: EmployeeAccessPolicy,
  ) {}

  async execute(
    actor: AccessActor,
    input: { from: Date; to: Date; departmentId?: string },
  ): Promise<DashboardResult> {
    const scope = await this.policy.scopeFor(actor);
    const counters = await this.reports.counters({
      from: input.from,
      to: input.to,
      departmentId: input.departmentId,
      employeeIds: scope.all ? undefined : scope.employeeIds,
    });

    const workingDays = this.estimateWorkingDays(input.from, input.to);
    const denominator = counters.headcount * workingDays;

    return {
      ...counters,
      turnoverRate:
        counters.headcount > 0 ? round2((counters.terminationsInPeriod / counters.headcount) * 100) : 0,
      absenteeismRate: denominator > 0 ? round2((counters.attendanceAbsenceCount / denominator) * 100) : 0,
      scope: scope.all ? 'GLOBAL' : actor.role === 'SUPERVISOR' ? 'TEAM' : 'SELF',
      period: { from: input.from, to: input.to },
    };
  }

  private estimateWorkingDays(from: Date, to: Date): number {
    let days = 0;
    const cursor = new Date(from);
    while (cursor <= to) {
      const day = cursor.getDay();
      if (day !== 0) days++;
      cursor.setDate(cursor.getDate() + 1);
    }
    return days;
  }
}
