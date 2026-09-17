import { daysBetween } from '../../../../shared/domain/dates';
import { round2 } from '../../../../shared/domain/money';
import { LEGAL_KEYS } from '../../../legal-parameters/domain/parameter-keys';
import { LegalParameterSet } from '../../../legal-parameters/domain/services/LegalParameterSet';

export interface AguinaldoResult {
  monthsWorked: number;
  entitled: boolean;
  amount: number;
  doubleAguinaldo: boolean;
  detail: string;
}

export class AguinaldoCalculator {
  constructor(private readonly params: LegalParameterSet) {}

  calculate(baseSalary: number, hireDate: Date, year: number): AguinaldoResult {
    const minMonths = this.params.number(LEGAL_KEYS.AGUINALDO_MIN_MONTHS, 3);
    const isDouble = this.params.boolean(LEGAL_KEYS.DOUBLE_AGUINALDO, false);
    const monthsWorked = this.monthsWorked(hireDate, year);

    if (monthsWorked < minMonths) {
      return {
        monthsWorked,
        entitled: false,
        amount: 0,
        doubleAguinaldo: isDouble,
        detail: `Requiere ${minMonths} meses trabajados; lleva ${monthsWorked}`,
      };
    }

    const proportional = round2((baseSalary / 12) * monthsWorked);
    const amount = isDouble ? round2(proportional * 2) : proportional;
    return {
      monthsWorked,
      entitled: true,
      amount,
      doubleAguinaldo: isDouble,
      detail:
        monthsWorked === 12
          ? isDouble
            ? 'Doble aguinaldo completo'
            : 'Aguinaldo completo'
          : `Proporcional a ${monthsWorked} de 12 meses`,
    };
  }

  private monthsWorked(hireDate: Date, year: number): number {
    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year, 11, 31);
    const from = hireDate > yearStart ? hireDate : yearStart;
    if (from > yearEnd) return 0;
    const days = daysBetween(from, yearEnd) + 1;
    return Math.min(12, Math.floor(days / 30));
  }
}
