import { describe, expect, it } from 'vitest';
import { LegalParameter } from '../../../legal-parameters/domain/entities/LegalParameter';
import { LegalParameterSet } from '../../../legal-parameters/domain/services/LegalParameterSet';
import { VacationCalculator } from './VacationCalculator';

function params(overrides: Record<string, string> = {}): LegalParameterSet {
  const base: Record<string, string> = {
    VACATION_TIER1_MIN_YEARS: '1',
    VACATION_TIER1_DAYS: '15',
    VACATION_TIER2_MIN_YEARS: '5',
    VACATION_TIER2_DAYS: '20',
    VACATION_TIER3_MIN_YEARS: '10',
    VACATION_TIER3_DAYS: '30',
    VACATION_REQUIRE_HR_APPROVAL: 'true',
    VACATION_COUNT_SATURDAY: 'false',
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
  return new LegalParameterSet(list, new Date('2026-06-01'));
}

const AT = new Date('2026-06-01');

describe('VacationCalculator - gestiones y tramos (6.1)', () => {
  const calculator = new VacationCalculator(params());

  it('la gestion 1 ya otorga 15 dias: se ganan al cumplir el anio de servicio', () => {
    expect(calculator.diasDeGestion(1)).toBe(15);
  });

  it('mantiene 15 dias hasta la quinta gestion', () => {
    expect(calculator.diasDeGestion(5)).toBe(15);
  });

  it('pasa a 20 dias desde la sexta gestion', () => {
    expect(calculator.diasDeGestion(6)).toBe(20);
    expect(calculator.diasDeGestion(10)).toBe(20);
  });

  it('pasa a 30 dias desde la gestion once', () => {
    expect(calculator.diasDeGestion(11)).toBe(30);
    expect(calculator.diasDeGestion(20)).toBe(30);
  });

  it('reproduce la escalera real de un empleado de la planilla de RRHH', () => {
    // Caso tomado de "VACACIONES DEL PERSONAL": ingreso 15-sept-2012,
    // 13 gestiones cargadas con 15,15,15,15,15,20,20,20,20,20,30,30,30.
    const gestiones = calculator.gestiones(new Date(2012, 8, 15), new Date(2025, 11, 31));
    const otorgados = gestiones.slice(0, 13).map((g) => g.diasOtorgados);

    expect(otorgados).toEqual([15, 15, 15, 15, 15, 20, 20, 20, 20, 20, 30, 30, 30]);
    expect(gestiones[0].etiqueta).toBe('2012-2013');
    expect(gestiones[10].etiqueta).toBe('2022-2023');
  });

  it('la gestion va de aniversario a aniversario, no por anio calendario', () => {
    const [primera] = calculator.gestiones(new Date(2024, 3, 26), new Date(2026, 0, 1));

    expect(primera.inicio.getMonth()).toBe(3);
    expect(primera.inicio.getDate()).toBe(26);
    expect(primera.fin.getFullYear()).toBe(2025);
    expect(primera.fin.getMonth()).toBe(3);
    expect(primera.fin.getDate()).toBe(25);
  });

  it('marca como no cumplida la gestion en curso', () => {
    const gestiones = calculator.gestiones(new Date(2024, 0, 10), new Date(2025, 5, 1));

    expect(gestiones).toHaveLength(2);
    expect(gestiones[0].cumplida).toBe(true);
    expect(gestiones[1].cumplida).toBe(false);
  });

  it('toma los tramos de los parametros legales, no del codigo', () => {
    const custom = new VacationCalculator(params({ VACATION_TIER1_DAYS: '18' }));
    expect(custom.diasDeGestion(1)).toBe(18);
  });
});

describe('VacationCalculator - dias habiles del rango', () => {
  it('excluye domingos', () => {
    // Lunes 1 a domingo 7 de junio de 2026 -> 6 dias sin contar sabado ni domingo...
    const calculator = new VacationCalculator(params());
    const days = calculator.workingDays(new Date(2026, 5, 1), new Date(2026, 5, 7), []);
    expect(days).toBe(5); // lunes a viernes
  });

  it('cuenta el sabado si el parametro lo indica', () => {
    const calculator = new VacationCalculator(params({ VACATION_COUNT_SATURDAY: 'true' }));
    const days = calculator.workingDays(new Date(2026, 5, 1), new Date(2026, 5, 7), []);
    expect(days).toBe(6); // lunes a sabado
  });

  it('excluye feriados', () => {
    const calculator = new VacationCalculator(params());
    const days = calculator.workingDays(new Date(2026, 5, 1), new Date(2026, 5, 5), [new Date(2026, 5, 3)]);
    expect(days).toBe(4);
  });
});

describe('VacationCalculator - validaciones', () => {
  const calculator = new VacationCalculator(params());

  it('rechaza un rango invertido', () => {
    expect(() => calculator.assertValidRange(new Date('2026-06-10'), new Date('2026-06-01'))).toThrow();
  });

  it('rechaza una solicitud sin saldo suficiente', () => {
    expect(() => calculator.assertEnoughBalance(10, 5)).toThrow(/Saldo insuficiente/);
  });

  it('acepta una solicitud dentro del saldo', () => {
    expect(() => calculator.assertEnoughBalance(5, 15)).not.toThrow();
  });

  it('lee del parametro si el flujo requiere aprobacion de RRHH', () => {
    expect(calculator.requiresHrApproval()).toBe(true);
    expect(new VacationCalculator(params({ VACATION_REQUIRE_HR_APPROVAL: 'false' })).requiresHrApproval()).toBe(false);
  });
});
