import { describe, expect, it, vi } from 'vitest';
import { AuditoriaConEventos } from './AuditoriaConEventos';

describe('auditoria que avisa en tiempo real', () => {
  it('registra la auditoria y avisa segun la entidad que cambio', async () => {
    const auditoria = { log: vi.fn(async () => undefined) };
    const eventos = { publicar: vi.fn() };
    const a = new AuditoriaConEventos(auditoria, eventos);

    await a.log({ action: 'VACATION_APPROVED', entity: 'VacationRequest' });
    await a.log({ action: 'PAPELETA_FIRMADA', entity: 'Papeleta' });
    await a.log({ action: 'LOGIN', entity: 'User' });

    expect(auditoria.log).toHaveBeenCalledTimes(3);
    expect(eventos.publicar.mock.calls).toEqual([['vacaciones'], ['papeletas']]);
  });
});
