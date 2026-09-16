import { BusinessRuleError } from '../../../../shared/domain/errors';
import { isoWeekDay, startOfDay, toDateOnlyString } from '../../../../shared/domain/dates';
import { LEGAL_KEYS } from '../../../legal-parameters/domain/parameter-keys';
import { LegalParameterSet } from '../../../legal-parameters/domain/services/LegalParameterSet';

/** Una gestion de vacaciones: el anio de servicio que corre entre aniversarios. */
export interface Gestion {
  /** Numero de gestion contado desde el ingreso: la primera es la 1. */
  numero: number;
  /** Etiqueta como la usa RRHH en la planilla: "2024-2025". */
  etiqueta: string;
  inicio: Date;
  fin: Date;
  /** Dias que otorga la gestion segun el tramo de antiguedad. */
  diasOtorgados: number;
  /** Una gestion en curso todavia no acredita dias: se ganan al cumplirla. */
  cumplida: boolean;
}

/**
 * Reglas de vacaciones (seccion 6.1), modeladas como las lleva Recursos
 * Humanos: por GESTION, es decir el anio de servicio que va de aniversario a
 * aniversario de la fecha de ingreso, no por anio calendario.
 *
 * Cada gestion otorga dias segun el tramo de antiguedad, se acreditan al
 * cumplirla, y lo que no se toma NO se pierde: se acumula en el saldo.
 * Referencia por defecto (Ley General del Trabajo):
 *   gestiones 1 a 5   -> 15 dias habiles
 *   gestiones 6 a 10  -> 20 dias habiles
 *   gestion 11 en adelante -> 30 dias habiles
 *
 * Los tramos y los dias son parametros legales, no constantes del codigo.
 */
export class VacationCalculator {
  constructor(private readonly params: LegalParameterSet) {}

  /**
   * Dias que otorga la enesima gestion. La gestion 1 -la del primer anio- ya
   * otorga el primer tramo: los dias se ganan al cumplir el anio de servicio.
   */
  diasDeGestion(numeroGestion: number): number {
    const tier2 = this.params.number(LEGAL_KEYS.VACATION_TIER2_MIN_YEARS, 5);
    const tier3 = this.params.number(LEGAL_KEYS.VACATION_TIER3_MIN_YEARS, 10);

    if (numeroGestion > tier3) return this.params.number(LEGAL_KEYS.VACATION_TIER3_DAYS, 30);
    if (numeroGestion > tier2) return this.params.number(LEGAL_KEYS.VACATION_TIER2_DAYS, 20);
    return this.params.number(LEGAL_KEYS.VACATION_TIER1_DAYS, 15);
  }

  /**
   * Construye la escalera de gestiones desde el ingreso hasta hoy, incluida la
   * gestion en curso (marcada como no cumplida).
   */
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

  /** Dias que otorga la gestion en curso del empleado (tramo vigente). */
  entitledDays(hireDate: Date, at: Date = new Date()): number {
    const lista = this.gestiones(hireDate, at);
    if (lista.length === 0) return 0;
    return lista[lista.length - 1].diasOtorgados;
  }

  /**
   * Dias habiles de un rango: se excluye el domingo (descanso dominical, 6.5),
   * los feriados y -si el parametro lo indica- tambien el sabado.
   */
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

  /**
   * Convencion de acreditacion. Por defecto los dias se ganan al CUMPLIR la
   * gestion, que es como lo entiende la Ley General del Trabajo. Algunas
   * empresas los acreditan al inicio, para que la gente pueda planificar: eso
   * se activa con este parametro.
   */
  acreditaAlIniciarGestion(): boolean {
    return this.params.boolean(LEGAL_KEYS.VACATION_CREDIT_ON_GESTION_START, false);
  }

  /** El flujo puede requerir una sola aprobacion (supervisor) o dos (supervisor + RRHH). */
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
