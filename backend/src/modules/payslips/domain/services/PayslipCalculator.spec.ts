import { describe, expect, it } from 'vitest';
import { LegalParameterSet } from '../../../legal-parameters/domain/services/LegalParameterSet';
import { LegalParameter } from '../../../legal-parameters/domain/entities/LegalParameter';
import { PayslipCalculator } from './PayslipCalculator';

/** Los parametros llegan como datos: el calculo no depende de constantes. */
function params(overrides: Record<string, string> = {}): LegalParameterSet {
  const base: Record<string, string> = {
    WORK_DAYS_PER_MONTH: '30',
    WORK_HOURS_PER_DAY: '8',
    AFP_EMPLOYEE_RATE: '12.71',
    RCIVA_RATE: '13',
    RCIVA_EXEMPT_MINIMUM_WAGES: '4',
    MINIMUM_WAGE: '2750',
    OVERTIME_DAY_SURCHARGE: '100',
    OVERTIME_NIGHT_SURCHARGE: '200',
    OVERTIME_HOLIDAY_SURCHARGE: '200',
    ...overrides,
  };
  const list: LegalParameter[] = Object.entries(base).map(([key, value]) => ({
    id: key,
    key,
    value,
    valueType: 'number',
    description: null,
    unit: null,
    validFrom: new Date('2026-01-01'),
    validUntil: null,
  }));
  return new LegalParameterSet(list, new Date('2026-03-31'));
}

describe('PayslipCalculator', () => {
  it('prorratea el haber basico por dias trabajados', () => {
    const result = new PayslipCalculator(params()).calculate({ baseSalary: 6000, workedDays: 15 });
    const basic = result.lines.find((l) => l.code === 'HABER_BASICO');

    expect(basic?.amount).toBe(3000);
    expect(result.totalEarnings).toBe(3000);
  });

  it('descuenta AFP sobre el total ganado con la tasa parametrizada', () => {
    const result = new PayslipCalculator(params()).calculate({ baseSalary: 5000, workedDays: 30 });
    const afp = result.lines.find((l) => l.code === 'AFP');

    expect(afp?.amount).toBe(635.5); // 5000 * 12.71%
    expect(result.netPay).toBe(5000 - 635.5);
  });

  it('no aplica RC-IVA cuando el neto no supera el minimo no imponible', () => {
    // 4 salarios minimos = 11000; un sueldo de 5000 queda exento.
    const result = new PayslipCalculator(params()).calculate({ baseSalary: 5000, workedDays: 30 });

    expect(result.lines.some((l) => l.code === 'RC_IVA')).toBe(false);
  });

  it('aplica RC-IVA sobre el excedente y descuenta el credito fiscal de facturas', () => {
    const calculator = new PayslipCalculator(params());
    const sinFacturas = calculator.calculate({ baseSalary: 20000, workedDays: 30 });
    const conFacturas = calculator.calculate({ baseSalary: 20000, workedDays: 30, fiscalCredit: 3000 });
    const conMuchasFacturas = calculator.calculate({
      baseSalary: 20000,
      workedDays: 30,
      fiscalCredit: 20000,
    });

    const rcivaSin = sinFacturas.lines.find((l) => l.code === 'RC_IVA')?.amount ?? 0;
    const rcivaCon = conFacturas.lines.find((l) => l.code === 'RC_IVA')?.amount ?? 0;

    // Base: 20000 - 2542 (AFP) - 11000 (4 salarios minimos) = 6458 -> 13% = 839.54
    expect(rcivaSin).toBe(839.54);
    expect(rcivaCon).toBe(round(839.54 - 3000 * 0.13));
    // Con suficiente credito fiscal el descuento se anula, nunca queda negativo.
    expect(conMuchasFacturas.lines.some((l) => l.code === 'RC_IVA')).toBe(false);
  });

  it('paga la hora extra diurna con el recargo configurado', () => {
    const result = new PayslipCalculator(params()).calculate({
      baseSalary: 4800,
      workedDays: 30,
      overtime: { dayHours: 2 },
    });
    const extra = result.lines.find((l) => l.code === 'HE_DIURNA');

    // Hora = 4800 / (30 * 8) = 20 Bs; con 100% de recargo = 40 Bs por hora.
    expect(extra?.amount).toBe(80);
    expect(extra?.quantity).toBe(2);
  });

  it('respeta un cambio de la tasa de AFP sin tocar el codigo', () => {
    const result = new PayslipCalculator(params({ AFP_EMPLOYEE_RATE: '10' })).calculate({
      baseSalary: 5000,
      workedDays: 30,
    });

    expect(result.lines.find((l) => l.code === 'AFP')?.amount).toBe(500);
  });

  it('suma bonos por monto fijo y por porcentaje del haber basico', () => {
    const result = new PayslipCalculator(params()).calculate({
      baseSalary: 5000,
      workedDays: 30,
      bonuses: [
        { concept: 'Bono de antiguedad', percentage: 10 },
        { concept: 'Bono de produccion', amount: 300 },
      ],
    });

    expect(result.totalEarnings).toBe(5000 + 500 + 300);
  });

  it('nunca deja el liquido pagable descuadrado', () => {
    const result = new PayslipCalculator(params()).calculate({
      baseSalary: 15000,
      workedDays: 28,
      bonuses: [{ concept: 'Bono', amount: 500 }],
      otherDeductions: [{ concept: 'Anticipo', amount: 1000 }],
    });

    expect(result.netPay).toBe(round(result.totalEarnings - result.totalDeductions));
  });
});

function round(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
