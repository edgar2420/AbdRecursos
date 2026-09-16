import { describe, expect, it } from 'vitest';
import { LegalParameter } from '../../../legal-parameters/domain/entities/LegalParameter';
import { LegalParameterSet } from '../../../legal-parameters/domain/services/LegalParameterSet';
import { Papeleta } from '../entities/Papeleta';
import { PapeletaRules } from './PapeletaRules';

function params(): LegalParameterSet {
  const base: Record<string, string> = {
    WORK_HOURS_PER_DAY: '8',
    OVERTIME_DAY_SURCHARGE: '100',
    OVERTIME_NIGHT_SURCHARGE: '200',
    OVERTIME_HOLIDAY_SURCHARGE: '200',
  };
  const list: LegalParameter[] = Object.entries(base).map(([key, value]) => ({
    id: key, key, value, valueType: 'number', description: null, unit: null,
    validFrom: new Date('2026-01-01'), validUntil: null,
  }));
  return new LegalParameterSet(list, new Date('2026-09-09'));
}

const rules = new PapeletaRules(params());

function papeleta(estado: Papeleta['estado']): Papeleta {
  return {
    id: 'p1', numero: 'HE-2026-0001', tipo: 'HORAS_EXTRAS', estado,
    employeeId: 'e1', employeeNombre: 'Empleado', employeeCodigo: 'ABD-0001',
    area: 'PRODUCCION', fecha: new Date('2026-09-09'),
    trabajoRealizado: 'Cierre de lote', desde: null, hasta: null, totalHoras: 3,
    recargo: 'DIURNA', salidaMotivo: null, motivo: null, tiempoSolicitado: null,
    horaSalida: null, horaRetorno: null, attachmentUrl: null, firmaArea: null, firmaRrhh: null,
    motivoRechazo: null, rechazadaAt: null, createdAt: new Date(),
  };
}

describe('PapeletaRules - horas extras', () => {
  it('calcula las horas del rango declarado', () => {
    expect(rules.calcularHoras(new Date('2026-09-09T18:00'), new Date('2026-09-09T21:30'))).toBe(3.5);
  });

  it('rechaza un rango invertido', () => {
    expect(() => rules.calcularHoras(new Date('2026-09-09T20:00'), new Date('2026-09-09T18:00'))).toThrow();
  });

  it('no admite una jornada extra desmedida', () => {
    expect(() => rules.calcularHoras(new Date('2026-09-09T06:00'), new Date('2026-09-10T04:00'))).toThrow(
      /no puede declarar mas de/,
    );
  });

  it('toma el recargo de los parametros legales', () => {
    expect(rules.porcentajeRecargo('DIURNA')).toBe(100);
    expect(rules.porcentajeRecargo('NOCTURNA')).toBe(200);
    expect(rules.porcentajeRecargo('FERIADO')).toBe(200);
  });
});

describe('PapeletaRules - circuito de firmas', () => {
  it('arranca esperando al jefe de area', () => {
    expect(rules.estadoInicial()).toBe('PENDIENTE_JEFE_AREA');
    expect(rules.firmantePendiente('PENDIENTE_JEFE_AREA')).toBe('JEFE_AREA');
  });

  it('tras el jefe de area pasa a Recursos Humanos', () => {
    expect(rules.estadoTrasFirmar('PENDIENTE_JEFE_AREA')).toBe('PENDIENTE_RRHH');
  });

  it('la firma de Recursos Humanos la aprueba', () => {
    expect(rules.estadoTrasFirmar('PENDIENTE_RRHH')).toBe('APROBADA');
  });

  it('RRHH no puede firmar antes que el jefe de area', () => {
    expect(() => rules.assertPuedeFirmar(papeleta('PENDIENTE_JEFE_AREA'), 'RRHH')).toThrow(
      /Falta la firma del jefe de area/,
    );
  });

  it('el jefe de area no vuelve a firmar una que ya paso por el', () => {
    expect(() => rules.assertPuedeFirmar(papeleta('PENDIENTE_RRHH'), 'JEFE_AREA')).toThrow(
      /ya paso por el jefe de area/,
    );
  });

  it('una papeleta aprobada no admite mas firmas', () => {
    expect(() => rules.assertPuedeFirmar(papeleta('APROBADA'), 'RRHH')).toThrow(/ya esta aprobada/);
    expect(() => rules.estadoTrasFirmar('APROBADA')).toThrow();
  });

  it('una rechazada sale de circulacion', () => {
    expect(() => rules.assertPuedeFirmar(papeleta('RECHAZADA'), 'JEFE_AREA')).toThrow(/circulacion/);
  });
});

describe('PapeletaRules - salida', () => {
  it('exige que el retorno sea posterior a la salida', () => {
    expect(() => rules.validarSalida('10:00', '09:00')).toThrow(/posterior/);
  });

  it('admite una salida sin retorno', () => {
    expect(() => rules.validarSalida('16:00')).not.toThrow();
  });
});
