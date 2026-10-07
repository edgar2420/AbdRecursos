import { describe, expect, it } from 'vitest';
import { AssignScheduleBulk } from './AssignScheduleBulk';

type Asignacion = { id: string; scheduleId: string; employeeId: string; validFrom: Date; validUntil: Date | null };

function escenario(existentes: Asignacion[]) {
  const asignaciones = [...existentes];
  const vigente = (a: Asignacion, desde: Date, hasta: Date | null) =>
    (a.validUntil === null || a.validUntil >= desde) && (hasta === null || a.validFrom <= hasta);

  const schedules = {
    findById: async (id: string) => (id === 'h-nuevo' || id === 'h-viejo' ? { id } : null),
    hasOverlappingAssignment: async (employeeId: string, desde: Date, hasta: Date | null) =>
      asignaciones.some((a) => a.employeeId === employeeId && vigente(a, desde, hasta)),
    findActiveForEmployee: async (employeeId: string, at: Date) =>
      asignaciones.find((a) => a.employeeId === employeeId && a.validFrom <= at && (a.validUntil === null || a.validUntil >= at)) ?? null,
    endAssignment: async (id: string, validUntil: Date) => {
      const a = asignaciones.find((x) => x.id === id)!;
      a.validUntil = validUntil;
      return a;
    },
    assign: async (n: Omit<Asignacion, 'id'>) => {
      const nueva = { ...n, id: `a${asignaciones.length + 1}` };
      asignaciones.push(nueva);
      return nueva;
    },
  };
  const employees = {
    listAll: async (f: { departmentId?: string; positionId?: string }) =>
      f.departmentId === 'produccion' ? [{ id: 'e1' }, { id: 'e2' }, { id: 'e3' }] : f.positionId === 'operario' ? [{ id: 'e3' }, { id: 'e4' }] : [],
  };
  const policy = { assertCanManage: () => undefined };
  const audit = { log: async () => undefined };
  const recalculados: string[][] = [];
  const tardanzas = { recalcularEmpleados: async (ids: string[]) => (recalculados.push(ids), ids.length), recalcularHorario: async () => 0 };

  const uc = new AssignScheduleBulk(schedules as never, employees as never, policy as never, audit, tardanzas);
  return { uc, asignaciones, recalculados };
}

const actor = { userId: 'u1', role: 'HR', employeeId: null } as never;
const desde = new Date(2026, 9, 12);

describe('AssignScheduleBulk', () => {
  it('une departamentos y cargos sin repetir empleados y recalcula sus tardanzas', async () => {
    const { uc, recalculados } = escenario([]);
    const r = await uc.execute(actor, { scheduleId: 'h-nuevo', departmentIds: ['produccion'], positionIds: ['operario'], validFrom: desde, reemplazar: false });
    expect(r).toMatchObject({ empleados: 4, asignados: 4, omitidos: 0 });
    expect(recalculados[0]).toHaveLength(4);
  });

  it('no duplica a quien ya tiene ese mismo horario', async () => {
    const { uc } = escenario([{ id: 'x', scheduleId: 'h-nuevo', employeeId: 'e1', validFrom: new Date(2026, 8, 1), validUntil: null }]);
    const r = await uc.execute(actor, { scheduleId: 'h-nuevo', departmentIds: ['produccion'], positionIds: [], validFrom: desde, reemplazar: true });
    expect(r).toMatchObject({ asignados: 2, yaLoTenian: 1 });
  });

  it('sin reemplazar, omite a quien ya tiene otro horario', async () => {
    const { uc } = escenario([{ id: 'x', scheduleId: 'h-viejo', employeeId: 'e2', validFrom: new Date(2026, 8, 1), validUntil: null }]);
    const r = await uc.execute(actor, { scheduleId: 'h-nuevo', departmentIds: ['produccion'], positionIds: [], validFrom: desde, reemplazar: false });
    expect(r).toMatchObject({ asignados: 2, omitidos: 1, reemplazados: 0 });
  });

  it('al reemplazar, cierra el horario anterior el dia previo', async () => {
    const { uc, asignaciones } = escenario([{ id: 'x', scheduleId: 'h-viejo', employeeId: 'e2', validFrom: new Date(2026, 8, 1), validUntil: null }]);
    const r = await uc.execute(actor, { scheduleId: 'h-nuevo', departmentIds: ['produccion'], positionIds: [], validFrom: desde, reemplazar: true });
    expect(r).toMatchObject({ asignados: 3, reemplazados: 1, omitidos: 0 });
    expect(asignaciones.find((a) => a.id === 'x')!.validUntil!.getDate()).toBe(11);
  });

  it('exige elegir al menos un departamento o cargo', async () => {
    const { uc } = escenario([]);
    await expect(uc.execute(actor, { scheduleId: 'h-nuevo', departmentIds: [], positionIds: [], validFrom: desde, reemplazar: false })).rejects.toThrow(
      'Elija al menos un departamento o un cargo',
    );
  });
});
