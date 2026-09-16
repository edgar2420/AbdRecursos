import { AccessActor, EmployeeAccessPolicy } from '../../../employees/domain/services/EmployeeAccessPolicy';
import { HeadcountByGroup, ReportRepository } from '../../domain/repositories/ReportRepository';

export class GetHeadcountReport {
  constructor(
    private readonly reports: ReportRepository,
    private readonly policy: EmployeeAccessPolicy,
  ) {}

  async execute(
    actor: AccessActor,
  ): Promise<{ byDepartment: HeadcountByGroup[]; byContractType: HeadcountByGroup[] }> {
    const scope = await this.policy.scopeFor(actor);
    const employeeIds = scope.all ? undefined : scope.employeeIds;
    const [byDepartment, byContractType] = await Promise.all([
      this.reports.headcountByDepartment(employeeIds),
      this.reports.headcountByContractType(employeeIds),
    ]);
    return { byDepartment, byContractType };
  }
}

/** El costo de la nomina es informacion global: solo RRHH/Admin. */
export class GetPayrollReport {
  constructor(
    private readonly reports: ReportRepository,
    private readonly policy: EmployeeAccessPolicy,
  ) {}

  async execute(actor: AccessActor, year: number) {
    this.policy.assertCanManage(actor);
    const [payroll, turnover] = await Promise.all([
      this.reports.payrollByMonth(year),
      this.reports.turnoverByMonth(year),
    ]);
    return { year, payroll, turnover };
  }
}
