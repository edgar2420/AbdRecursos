import { describe, expect, it } from 'vitest';
import { fechaLocal } from './fecha-local';
import { startOfDay, toDateOnlyString } from '../../domain/dates';

describe('fechaLocal', () => {
  it('lee AAAA-MM-DD como ese mismo dia en hora local', () => {
    const fecha = fechaLocal.parse('2026-09-01');
    expect(toDateOnlyString(fecha)).toBe('2026-09-01');
    expect(fecha.getHours()).toBe(0);
  });

  it('startOfDay no retrocede al dia anterior', () => {
    expect(toDateOnlyString(startOfDay(fechaLocal.parse('2026-09-01')))).toBe('2026-09-01');
  });

  it('respeta fechas con hora explicita', () => {
    const iso = '2026-09-01T15:30:00.000Z';
    expect(fechaLocal.parse(iso).toISOString()).toBe(iso);
  });

  it('rechaza texto que no es fecha', () => {
    expect(fechaLocal.safeParse('no-es-fecha').success).toBe(false);
  });
});
