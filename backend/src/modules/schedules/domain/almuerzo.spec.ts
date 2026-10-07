import { describe, expect, it } from 'vitest';
import { minutosDeAlmuerzo, problemaConAlmuerzo } from './almuerzo';

const jornada = { startTime: '08:30', endTime: '17:00' };

describe('ventana de almuerzo', () => {
  it('calcula los minutos', () => {
    expect(minutosDeAlmuerzo('12:00', '13:00')).toBe(60);
    expect(minutosDeAlmuerzo('12:00', '14:00')).toBe(120);
    expect(minutosDeAlmuerzo(null, null)).toBeNull();
  });

  it('acepta un horario sin almuerzo', () => {
    expect(problemaConAlmuerzo(jornada, null, null)).toBeNull();
  });

  it('exige inicio y fin', () => {
    expect(problemaConAlmuerzo(jornada, '12:00', null)).toMatch(/inicio y de fin/);
  });

  it('rechaza un fin anterior al inicio', () => {
    expect(problemaConAlmuerzo(jornada, '13:00', '12:00')).toMatch(/posterior/);
  });

  it('rechaza un almuerzo fuera de la jornada', () => {
    expect(problemaConAlmuerzo(jornada, '07:00', '08:00')).toMatch(/dentro del horario/);
    expect(problemaConAlmuerzo(jornada, '12:00', '13:00')).toBeNull();
  });
});
