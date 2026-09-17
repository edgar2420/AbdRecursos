import { BusinessRuleError } from '../../../../shared/domain/errors';
import { addMonths, daysBetween, timeToMinutes } from '../../../../shared/domain/dates';
import { LEGAL_KEYS } from '../../../legal-parameters/domain/parameter-keys';
import { LegalParameterSet } from '../../../legal-parameters/domain/services/LegalParameterSet';

export class LactationRules {
  constructor(private readonly params: LegalParameterSet) {}

  dailyMinutes(): number {
    return this.params.number(LEGAL_KEYS.LACTATION_DAILY_MINUTES, 60);
  }

  endDateFor(birthDate: Date): Date {
    const months = this.params.number(LEGAL_KEYS.LACTATION_MONTHS, 12);
    return addMonths(birthDate, months);
  }

  jobProtectionUntil(birthDate: Date): Date {
    const months = this.params.number(LEGAL_KEYS.JOB_PROTECTION_MONTHS_AFTER_BIRTH, 12);
    return addMonths(birthDate, months);
  }

  alertThresholdDays(): number {
    return this.params.number(LEGAL_KEYS.LACTATION_ALERT_DAYS, 30);
  }

  daysRemaining(endDate: Date, at: Date = new Date()): number {
    return Math.max(0, daysBetween(at, endDate));
  }

  assertValidSlots(
    slots: { start?: string | null; end?: string | null }[],
    dailyMinutes: number,
  ): void {
    const declared = slots.filter((s) => s.start && s.end);
    if (declared.length === 0) return;

    let total = 0;
    for (const slot of declared) {
      const minutes = timeToMinutes(slot.end as string) - timeToMinutes(slot.start as string);
      if (minutes <= 0) throw new BusinessRuleError('Cada tramo debe terminar despues de empezar');
      total += minutes;
    }
    if (total > dailyMinutes) {
      throw new BusinessRuleError(
        `Los tramos suman ${total} minutos y el permiso diario es de ${dailyMinutes} minutos`,
      );
    }
  }

  assertNotExpired(birthDate: Date, at: Date = new Date()): void {
    if (this.endDateFor(birthDate) < at) {
      throw new BusinessRuleError('El beneficio de lactancia ya vencio para esa fecha de parto');
    }
  }
}
