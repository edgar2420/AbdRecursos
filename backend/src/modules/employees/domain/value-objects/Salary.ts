import { ValidationError } from '../../../../shared/domain/errors';
import { round2 } from '../../../../shared/domain/money';

/** Salario en bolivianos: no negativo, dos decimales. */
export class Salary {
  private constructor(public readonly amount: number) {}

  static create(raw: number | string): Salary {
    const value = typeof raw === 'string' ? Number(raw.replace(/,/g, '')) : raw;
    if (Number.isNaN(value)) throw new ValidationError(`Salario invalido: "${raw}"`);
    if (value < 0) throw new ValidationError('El salario no puede ser negativo');
    if (value > 9_999_999) throw new ValidationError('El salario excede el maximo permitido');
    return new Salary(round2(value));
  }

  /** Valor diario tomando la base de dias/mes de los parametros legales. */
  perDay(workDaysPerMonth: number): number {
    return round2(this.amount / workDaysPerMonth);
  }

  perHour(workDaysPerMonth: number, hoursPerDay: number): number {
    return round2(this.amount / (workDaysPerMonth * hoursPerDay));
  }
}
