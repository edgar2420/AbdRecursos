import { BusinessRuleError } from '../../../../shared/domain/errors';
import { isoWeekDay, startOfDay, toDateOnlyString } from '../../../../shared/domain/dates';
import { LEGAL_KEYS } from '../../../legal-parameters/domain/parameter-keys';
import { LegalParameterSet } from '../../../legal-parameters/domain/services/LegalParameterSet';

export interface Gestion {
  numero: number;
  etiqueta: string;
  inicio: Date;
  fin: Date;
  diasOtorgados: number;
  cumplida: boolean;
}

export class VacationCalculator {
  constructor(private readonly params: LegalParameterSet) {}

  diasDeGestion(numeroGestion: number): number {
    const tier2 = this.params.number(LEGAL_KEYS.VACATION_TIER2_MIN_YEARS, 5);
    const tier3 = this.params.number(LEGAL_KEYS.VACATION_TIER3_MIN_YEARS, 10);

    if (numeroGestion > tier3) return this.params.number(LEGAL_KEYS.VACATION_TIER3_DAYS, 30);
    if (numeroGestion > tier2) return this.params.number(LEGAL_KEYS.VACATION_TIER2_DAYS, 20);
    return this.params.number(LEGAL_KEYS.VACATION_TIER1_DAYS, 15);
  }

  gestiones(hireDate: Date, at: Date = new Date()): Gestion[] {
    const lista: Gestion[] = [];
    let numero = 1;

    while (numero <= 60) {
      const inicio = new Date(hireDate);
      inicio.setFullYear(hireDate.getFullYear() + numero - 1);
      if (inicio > at) break;

      const fin = new Date(hireDate);
      fin.setFullYear(hireDate.getFullYear() + numero);
      fin.setDate(fin.getDate() - 1);

      lista.push({
        numero,
        etiqueta: `${inicio.getFullYear()}-${inicio.getFullYear() + 1}`,
        inicio,
        fin,
        diasOtorgados: this.diasDeGestion(numero),
        cumplida: fin <= at,
      });
      numero++;
    }

    return lista;
  }

  entitledDays(hireDate: Date, at: Date = new Date()): number {
    const lista = this.gestiones(hireDate, at);
    if (lista.length === 0) return 0;
    return lista[lista.length - 1].diasOtorgados;
  }

  workingDays(start: Date, end: Date, holidays: Date[]): number {
    const countSaturday = this.params.boolean(LEGAL_KEYS.VACATION_COUNT_SATURDAY, false);
    const holidaySet = new Set(holidays.map((h) => toDateOnlyString(h)));

    let days = 0;
    const cursor = startOfDay(start);
    const last = startOfDay(end);
    while (cursor <= last) {
      const weekDay = isoWeekDay(cursor);
      const isSunday = weekDay === 7;
      const isSaturday = weekDay === 6;
      const isHoliday = holidaySet.has(toDateOnlyString(cursor));
      if (!isSunday && !isHoliday && (countSaturday || !isSaturday)) days++;
      cursor.setDate(cursor.getDate() + 1);
    }
    return days;
  }

  acreditaAlIniciarGestion(): boolean {
    return this.params.boolean(LEGAL_KEYS.VACATION_CREDIT_ON_GESTION_START, false);
  }

  requiresHrApproval(): boolean {
    return this.params.boolean(LEGAL_KEYS.VACATION_REQUIRE_HR_APPROVAL, true);
  }

  assertValidRange(start: Date, end: Date): void {
    if (end < start) throw new BusinessRuleError('La fecha final no puede ser anterior a la inicial');
    const maxRangeDays = 366;
    const diff = (startOfDay(end).getTime() - startOfDay(start).getTime()) / 86400000;
    if (diff > maxRangeDays) throw new BusinessRuleError('El rango solicitado es demasiado extenso');
  }

  assertEnoughBalance(requestedDays: number, availableDays: number): void {
    if (requestedDays <= 0) {
      throw new BusinessRuleError('El rango seleccionado no contiene dias habiles');
    }
    if (requestedDays > availableDays) {
      throw new BusinessRuleError(
        `Saldo insuficiente: solicita ${requestedDays} dias habiles y dispone de ${availableDays}`,
      );
    }
  }
}
