import { round2, sum } from '../../../../shared/domain/money';
import { LEGAL_KEYS } from '../../../legal-parameters/domain/parameter-keys';
import { LegalParameterSet } from '../../../legal-parameters/domain/services/LegalParameterSet';
import { PayslipLine } from '../entities/Payslip';

export interface BonusInput {
  concept: string;
  amount?: number | null;
  percentage?: number | null;
}

export interface OvertimeInput {
  dayHours?: number;
  nightHours?: number;
  holidayHours?: number;
}

export interface ExtraLine {
  concept: string;
  amount: number;
}

export interface PayslipInput {
  baseSalary: number;
  workedDays: number;
  bonuses?: BonusInput[];
  overtime?: OvertimeInput;
  extraEarnings?: ExtraLine[];
  otherDeductions?: ExtraLine[];
  /** Monto de facturas presentadas para el credito fiscal del RC-IVA. */
  fiscalCredit?: number;
  aguinaldo?: number;
}

export interface PayslipResult {
  workedDays: number;
  baseSalary: number;
  totalEarnings: number;
  totalDeductions: number;
  netPay: number;
  lines: PayslipLine[];
}

/**
 * Calculo de la boleta de pago (seccion 6.4).
 * Ningun porcentaje esta escrito aqui: la tasa de AFP, la del RC-IVA, el salario
 * minimo y los recargos de horas extra vienen de los parametros legales, que
 * RRHH edita por gestion.
 */
export class PayslipCalculator {
  constructor(private readonly params: LegalParameterSet) {}

  calculate(input: PayslipInput): PayslipResult {
    const workDaysPerMonth = this.params.number(LEGAL_KEYS.WORK_DAYS_PER_MONTH, 30);
    const hoursPerDay = this.params.number(LEGAL_KEYS.WORK_HOURS_PER_DAY, 8);

    const hourlyWage = round2(input.baseSalary / (workDaysPerMonth * hoursPerDay));
    const workedDays = Math.min(input.workedDays, workDaysPerMonth);

    const earnings: PayslipLine[] = [];
    let order = 0;

    // Se prorratea sobre el sueldo completo (no sobre el valor dia redondeado):
    // asi un mes completo paga exactamente el haber basico, sin centavos de arrastre.
    const basic =
      workedDays >= workDaysPerMonth
        ? round2(input.baseSalary)
        : round2((input.baseSalary * workedDays) / workDaysPerMonth);
    earnings.push(this.line('EARNING', 'HABER_BASICO', 'Haber basico', workedDays, basic, order++));

    // Bonos configurables por empleado: monto fijo o porcentaje del haber basico.
    for (const bonus of input.bonuses ?? []) {
      const amount = bonus.amount != null && bonus.amount > 0
        ? round2(bonus.amount)
        : round2((basic * (bonus.percentage ?? 0)) / 100);
      if (amount > 0) {
        earnings.push(this.line('EARNING', 'BONO', bonus.concept, null, amount, order++));
      }
    }

    // Horas extra con recargo configurable (diurno / nocturno / feriado).
    const overtime = input.overtime ?? {};
    const overtimeLines: [string, string, number, number][] = [
      ['HE_DIURNA', 'Horas extra diurnas', overtime.dayHours ?? 0, this.params.number(LEGAL_KEYS.OVERTIME_DAY_SURCHARGE, 100)],
      ['HE_NOCTURNA', 'Horas extra nocturnas', overtime.nightHours ?? 0, this.params.number(LEGAL_KEYS.OVERTIME_NIGHT_SURCHARGE, 200)],
      ['HE_FERIADO', 'Horas extra en feriado', overtime.holidayHours ?? 0, this.params.number(LEGAL_KEYS.OVERTIME_HOLIDAY_SURCHARGE, 200)],
    ];
    for (const [code, concept, hours, surcharge] of overtimeLines) {
      if (hours > 0) {
        const amount = round2(hours * hourlyWage * (1 + surcharge / 100));
        earnings.push(this.line('EARNING', code, concept, hours, amount, order++));
      }
    }

    for (const extra of input.extraEarnings ?? []) {
      if (extra.amount > 0) {
        earnings.push(this.line('EARNING', 'OTRO_HABER', extra.concept, null, round2(extra.amount), order++));
      }
    }

    if (input.aguinaldo && input.aguinaldo > 0) {
      earnings.push(this.line('EARNING', 'AGUINALDO', 'Aguinaldo', null, round2(input.aguinaldo), order++));
    }

    const totalEarnings = sum(earnings.map((e) => e.amount));

    // --- descuentos ---
    const deductions: PayslipLine[] = [];
    const afpRate = this.params.number(LEGAL_KEYS.AFP_EMPLOYEE_RATE);
    const afp = round2((totalEarnings * afpRate) / 100);
    deductions.push(
      this.line('DEDUCTION', 'AFP', `Aporte laboral AFP (${afpRate}%)`, null, afp, order++),
    );

    const rciva = this.calculateRciva(totalEarnings, afp, input.fiscalCredit ?? 0);
    if (rciva.amount > 0) {
      deductions.push(this.line('DEDUCTION', 'RC_IVA', 'RC-IVA', null, rciva.amount, order++));
    }

    for (const other of input.otherDeductions ?? []) {
      if (other.amount > 0) {
        deductions.push(this.line('DEDUCTION', 'OTRO_DESC', other.concept, null, round2(other.amount), order++));
      }
    }

    const totalDeductions = sum(deductions.map((d) => d.amount));

    return {
      workedDays,
      baseSalary: input.baseSalary,
      totalEarnings,
      totalDeductions,
      netPay: round2(totalEarnings - totalDeductions),
      lines: [...earnings, ...deductions],
    };
  }

  /**
   * RC-IVA: se aplica sobre el excedente del minimo no imponible
   * (N salarios minimos, parametrizable) despues del aporte laboral, y se
   * descuenta el credito fiscal de las facturas presentadas.
   */
  private calculateRciva(
    totalEarnings: number,
    afp: number,
    fiscalCreditInvoices: number,
  ): { amount: number; taxableBase: number } {
    const rate = this.params.number(LEGAL_KEYS.RCIVA_RATE);
    const minimumWage = this.params.number(LEGAL_KEYS.MINIMUM_WAGE);
    const exemptWages = this.params.number(LEGAL_KEYS.RCIVA_EXEMPT_MINIMUM_WAGES);

    const netTaxable = round2(totalEarnings - afp);
    const exempt = round2(minimumWage * exemptWages);
    const taxableBase = round2(Math.max(0, netTaxable - exempt));
    if (taxableBase === 0) return { amount: 0, taxableBase: 0 };

    const tax = round2((taxableBase * rate) / 100);
    const credit = round2((fiscalCreditInvoices * rate) / 100);
    return { amount: round2(Math.max(0, tax - credit)), taxableBase };
  }

  private line(
    type: 'EARNING' | 'DEDUCTION',
    code: string,
    concept: string,
    quantity: number | null,
    amount: number,
    orderIndex: number,
  ): PayslipLine {
    return { type, code, concept, quantity, amount, orderIndex };
  }
}
