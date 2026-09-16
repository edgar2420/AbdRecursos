import { BusinessRuleError } from '../../../../shared/domain/errors';
import { round2 } from '../../../../shared/domain/money';
import { timeToMinutes } from '../../../../shared/domain/dates';
import { LEGAL_KEYS } from '../../../legal-parameters/domain/parameter-keys';
import { LegalParameterSet } from '../../../legal-parameters/domain/services/LegalParameterSet';
import { Papeleta, PapeletaEstado, RecargoHoraExtra } from '../entities/Papeleta';

/** Quien debe firmar en cada paso, tal como en la papeleta de papel. */
export type Firmante = 'JEFE_AREA' | 'RRHH';

/**
 * Reglas de las papeletas del Departamento de RR.HH.
 *
 * El circuito de firmas es el mismo que en papel: primero el jefe del area del
 * empleado y despues Recursos Humanos. Ninguno de los dos puede firmar dos
 * veces ni saltarse el turno del otro, y nadie firma su propia papeleta.
 */
export class PapeletaRules {
  constructor(private readonly params: LegalParameterSet) {}

  /** Horas de una papeleta de horas extras, con dos decimales. */
  calcularHoras(desde: Date, hasta: Date): number {
    if (hasta <= desde) {
      throw new BusinessRuleError('La hora final debe ser posterior a la inicial');
    }
    const horas = (hasta.getTime() - desde.getTime()) / 3_600_000;
    const maximo = this.params.number(LEGAL_KEYS.WORK_HOURS_PER_DAY, 8);
    if (horas > maximo * 2) {
      throw new BusinessRuleError(
        `Una papeleta no puede declarar mas de ${maximo * 2} horas extra seguidas`,
      );
    }
    return round2(horas);
  }

  /** Recargo que corresponde a esas horas extra, segun los parametros legales. */
  porcentajeRecargo(recargo: RecargoHoraExtra): number {
    if (recargo === 'NOCTURNA') return this.params.number(LEGAL_KEYS.OVERTIME_NIGHT_SURCHARGE, 200);
    if (recargo === 'FERIADO') return this.params.number(LEGAL_KEYS.OVERTIME_HOLIDAY_SURCHARGE, 200);
    return this.params.number(LEGAL_KEYS.OVERTIME_DAY_SURCHARGE, 100);
  }

  /** La papeleta de salida declara una hora de salida y, si vuelve, una de retorno. */
  validarSalida(horaSalida: string, horaRetorno?: string | null): void {
    if (!horaRetorno) return;
    if (timeToMinutes(horaRetorno) <= timeToMinutes(horaSalida)) {
      throw new BusinessRuleError('La hora de retorno debe ser posterior a la de salida');
    }
  }

  /** Estado inicial: siempre empieza esperando la firma del jefe de area. */
  estadoInicial(): PapeletaEstado {
    return 'PENDIENTE_JEFE_AREA';
  }

  /** A quien le toca firmar ahora. */
  firmantePendiente(estado: PapeletaEstado): Firmante | null {
    if (estado === 'PENDIENTE_JEFE_AREA') return 'JEFE_AREA';
    if (estado === 'PENDIENTE_RRHH') return 'RRHH';
    return null;
  }

  /** Estado que queda despues de que firme quien corresponde. */
  estadoTrasFirmar(estado: PapeletaEstado): PapeletaEstado {
    if (estado === 'PENDIENTE_JEFE_AREA') return 'PENDIENTE_RRHH';
    if (estado === 'PENDIENTE_RRHH') return 'APROBADA';
    throw new BusinessRuleError('La papeleta ya no admite firmas');
  }

  assertPuedeFirmar(papeleta: Papeleta, firmante: Firmante): void {
    if (papeleta.estado === 'APROBADA') {
      throw new BusinessRuleError('La papeleta ya esta aprobada');
    }
    if (papeleta.estado === 'RECHAZADA' || papeleta.estado === 'ANULADA') {
      throw new BusinessRuleError('La papeleta ya no esta en circulacion');
    }
    const pendiente = this.firmantePendiente(papeleta.estado);
    if (pendiente !== firmante) {
      throw new BusinessRuleError(
        firmante === 'RRHH'
          ? 'Falta la firma del jefe de area antes de que pueda firmar Recursos Humanos'
          : 'Esta papeleta ya paso por el jefe de area',
      );
    }
  }

  assertPuedeAnular(papeleta: Papeleta): void {
    if (papeleta.estado === 'APROBADA') {
      throw new BusinessRuleError('Una papeleta aprobada no se anula: debe reversarla Recursos Humanos');
    }
    if (papeleta.estado === 'ANULADA') {
      throw new BusinessRuleError('La papeleta ya estaba anulada');
    }
  }
}
