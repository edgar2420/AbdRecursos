import { AuditLoggerPort } from '../../../../shared/application/AuditLogger';
import { BusinessRuleError } from '../../../../shared/domain/errors';
import { EmployeeRepository } from '../../../employees/domain/repositories/EmployeeRepository';
import { AccessActor, EmployeeAccessPolicy } from '../../../employees/domain/services/EmployeeAccessPolicy';
import { GetLegalParameters } from '../../../legal-parameters/application/use-cases/GetLegalParameters';
import { LEGAL_KEYS } from '../../../legal-parameters/domain/parameter-keys';
import { Payslip } from '../../domain/entities/Payslip';
import { PayslipRepository } from '../../domain/repositories/PayslipRepository';
import { AguinaldoCalculator } from '../../domain/services/AguinaldoCalculator';
import { PayslipCalculator } from '../../domain/services/PayslipCalculator';

export interface PayslipOverride {
  employeeId: string;
  workedDays?: number;
  overtimeDayHours?: number;
  overtimeNightHours?: number;
  overtimeHolidayHours?: number;
  fiscalCredit?: number;
  extraEarnings?: { concept: string; amount: number }[];
  otherDeductions?: { concept: string; amount: number }[];
}

export interface GeneratePayslipsInput {
  periodYear: number;
  periodMonth: number;
  employeeIds?: string[];
  includeAguinaldo?: boolean;
  /** Ajustes que RRHH captura por empleado (anticipos, horas extra, facturas). */
  overrides?: PayslipOverride[];
  /** Regenera las boletas en borrador que ya existan para el periodo. */
  overwriteDrafts?: boolean;
}

export interface GeneratePayslipsResult {
  generated: Payslip[];
  skipped: { employeeId: string; reason: string }[];
}

export class GeneratePayslips {
  constructor(
    private readonly payslips: PayslipRepository,
    private readonly employees: EmployeeRepository,
    private readonly parameters: GetLegalParameters,
    private readonly policy: EmployeeAccessPolicy,
    private readonly audit: AuditLoggerPort,
  ) {}

  async execute(actor: AccessActor, input: GeneratePayslipsInput): Promise<GeneratePayslipsResult> {
    this.policy.assertCanManage(actor);
    if (input.periodMonth < 1 || input.periodMonth > 12) {
      throw new BusinessRuleError('El mes del periodo debe estar entre 1 y 12');
    }

    // Los parametros se resuelven al ultimo dia del periodo: una boleta de marzo
    // se calcula con las tasas vigentes en marzo, no con las de hoy.
    const periodEnd = new Date(input.periodYear, input.periodMonth, 0, 23, 59, 59);
    const params = await this.parameters.execute(periodEnd);
    const calculator = new PayslipCalculator(params);
    const aguinaldo = new AguinaldoCalculator(params);
    const workDaysPerMonth = params.number(LEGAL_KEYS.WORK_DAYS_PER_MONTH, 30);

    const roster = await this.employees.listAll({
      isActive: true,
      ...(input.employeeIds ? { ids: input.employeeIds } : {}),
    });
    if (roster.length === 0) throw new BusinessRuleError('No hay empleados activos para ese periodo');

    const bonuses = await this.payslips.activeBonuses(roster.map((e) => e.id), periodEnd);
    const overrides = new Map((input.overrides ?? []).map((o) => [o.employeeId, o]));

    const generated: Payslip[] = [];
    const skipped: { employeeId: string; reason: string }[] = [];

    for (const employee of roster) {
      if (employee.hireDate > periodEnd) {
        skipped.push({ employeeId: employee.id, reason: 'Ingreso posterior al periodo' });
        continue;
      }
      const existing = await this.payslips.findByPeriod(employee.id, input.periodYear, input.periodMonth);
      if (existing && (existing.status !== 'DRAFT' || !input.overwriteDrafts)) {
        skipped.push({
          employeeId: employee.id,
          reason: existing.status === 'DRAFT' ? 'Ya existe un borrador' : 'Ya tiene boleta emitida',
        });
        continue;
      }

      const override = overrides.get(employee.id);
      const workedDays = override?.workedDays ?? this.defaultWorkedDays(employee.hireDate, input, workDaysPerMonth);

      const result = calculator.calculate({
        baseSalary: employee.baseSalary,
        workedDays,
        bonuses: bonuses.filter((b) => b.employeeId === employee.id),
        overtime: {
          dayHours: override?.overtimeDayHours,
          nightHours: override?.overtimeNightHours,
          holidayHours: override?.overtimeHolidayHours,
        },
        extraEarnings: override?.extraEarnings,
        otherDeductions: override?.otherDeductions,
        fiscalCredit: override?.fiscalCredit,
        aguinaldo: input.includeAguinaldo
          ? aguinaldo.calculate(employee.baseSalary, employee.hireDate, input.periodYear).amount
          : 0,
      });

      const payload = {
        employeeId: employee.id,
        periodYear: input.periodYear,
        periodMonth: input.periodMonth,
        workedDays: result.workedDays,
        baseSalary: result.baseSalary,
        totalEarnings: result.totalEarnings,
        totalDeductions: result.totalDeductions,
        netPay: result.netPay,
        parametersSnapshot: params.snapshot(),
        details: result.lines,
      };
      const payslip = existing
        ? await this.payslips.replace(existing.id, payload)
        : await this.payslips.create(payload);
      generated.push(payslip);
    }

    await this.audit.log({
      userId: actor.userId,
      action: 'PAYSLIPS_GENERATED',
      entity: 'Payslip',
      changes: {
        period: `${input.periodYear}-${String(input.periodMonth).padStart(2, '0')}`,
        generated: generated.length,
        skipped: skipped.length,
      },
    });
    return { generated, skipped };
  }

  /** Un empleado que ingreso a mitad de mes cobra solo los dias trabajados. */
  private defaultWorkedDays(hireDate: Date, input: GeneratePayslipsInput, workDaysPerMonth: number): number {
    const periodStart = new Date(input.periodYear, input.periodMonth - 1, 1);
    if (hireDate <= periodStart) return workDaysPerMonth;
    const daysInMonth = new Date(input.periodYear, input.periodMonth, 0).getDate();
    const workedCalendarDays = daysInMonth - hireDate.getDate() + 1;
    return Math.min(workDaysPerMonth, Math.round((workedCalendarDays * workDaysPerMonth) / daysInMonth));
  }
}
