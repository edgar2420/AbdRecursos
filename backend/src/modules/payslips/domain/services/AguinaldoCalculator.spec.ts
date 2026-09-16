import { describe, expect, it } from 'vitest';
import { LegalParameter } from '../../../legal-parameters/domain/entities/LegalParameter';
import { LegalParameterSet } from '../../../legal-parameters/domain/services/LegalParameterSet';
import { AguinaldoCalculator } from './AguinaldoCalculator';

function params(overrides: Record<string, string> = {}): LegalParameterSet {
  const base: Record<string, string> = {
    AGUINALDO_MIN_MONTHS: '3',
    DOUBLE_AGUINALDO: 'false',
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
  return new LegalParameterSet(list, new Date('2026-12-20'));
}

describe('AguinaldoCalculator (6.3)', () => {
  it('paga un sueldo completo con el anio trabajado', () => {
    const result = new AguinaldoCalculator(params()).calculate(6000, new Date(2020, 0, 15), 2026);

    expect(result.entitled).toBe(true);
    expect(result.monthsWorked).toBe(12);
    expect(result.amount).toBe(6000);
  });

  it('paga proporcional a los meses trabajados', () => {
    // Ingreso el 1 de julio: julio a diciembre = 6 meses de la gestion.
    const result = new AguinaldoCalculator(params()).calculate(6000, new Date(2026, 6, 1), 2026);

    expect(result.monthsWorked).toBe(6);
    expect(result.amount).toBe(3000);
  });

  it('no genera derecho por debajo del minimo de meses', () => {
    const result = new AguinaldoCalculator(params()).calculate(6000, new Date(2026, 10, 1), 2026);

    expect(result.entitled).toBe(false);
    expect(result.amount).toBe(0);
  });

  it('duplica el monto cuando RRHH activa el doble aguinaldo', () => {
    const result = new AguinaldoCalculator(params({ DOUBLE_AGUINALDO: 'true' })).calculate(
      6000,
      new Date(2020, 0, 15),
      2026,
    );

    expect(result.doubleAguinaldo).toBe(true);
    expect(result.amount).toBe(12000);
  });

  it('respeta un minimo de meses distinto sin tocar el codigo', () => {
    const result = new AguinaldoCalculator(params({ AGUINALDO_MIN_MONTHS: '8' })).calculate(
      6000,
      new Date(2026, 6, 1),
      2026,
    );

    expect(result.entitled).toBe(false);
  });
});
