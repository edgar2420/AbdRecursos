import { describe, expect, it } from 'vitest';
import { EmployeeRepository } from '../repositories/EmployeeRepository';
import { AccessActor, EmployeeAccessPolicy } from './EmployeeAccessPolicy';

/** Repositorio mockeado: el dominio se prueba sin base de datos (seccion 11). */
function repositoryStub(team: Record<string, string[]>): EmployeeRepository {
  return {
    isSupervisorOf: async (supervisorId: string, employeeId: string) =>
      (team[supervisorId] ?? []).includes(employeeId),
    listTeamIds: async (supervisorId: string) => team[supervisorId] ?? [],
  } as unknown as EmployeeRepository;
}

const HR: AccessActor = { userId: 'u-hr', role: 'HR', employeeId: 'e-hr' };
const SUPERVISOR: AccessActor = { userId: 'u-sup', role: 'SUPERVISOR', employeeId: 'e-sup' };
const EMPLOYEE: AccessActor = { userId: 'u-emp', role: 'EMPLOYEE', employeeId: 'e-emp' };

describe('EmployeeAccessPolicy (proteccion contra IDOR, 8.2)', () => {
  const policy = new EmployeeAccessPolicy(repositoryStub({ 'e-sup': ['e-emp'] }));

  it('RRHH puede ver cualquier empleado', async () => {
    await expect(policy.assertCanView(HR, 'e-otro')).resolves.toBeUndefined();
  });

  it('un empleado puede ver su propio perfil', async () => {
    await expect(policy.assertCanView(EMPLOYEE, 'e-emp')).resolves.toBeUndefined();
  });

  it('un empleado NO puede ver el perfil de otro cambiando el id de la URL', async () => {
    await expect(policy.assertCanView(EMPLOYEE, 'e-otro')).rejects.toThrow(/permisos/i);
  });

  it('un supervisor puede ver a los miembros de su equipo', async () => {
    await expect(policy.assertCanView(SUPERVISOR, 'e-emp')).resolves.toBeUndefined();
  });

  it('un supervisor NO puede ver a alguien fuera de su equipo', async () => {
    await expect(policy.assertCanView(SUPERVISOR, 'e-ajeno')).rejects.toThrow();
  });

  it('solo RRHH y Admin pueden gestionar empleados', () => {
    expect(() => policy.assertCanManage(HR)).not.toThrow();
    expect(() => policy.assertCanManage(SUPERVISOR)).toThrow();
    expect(() => policy.assertCanManage(EMPLOYEE)).toThrow();
  });

  it('el alcance del listado depende del rol', async () => {
    await expect(policy.scopeFor(HR)).resolves.toEqual({ all: true, employeeIds: [] });
    await expect(policy.scopeFor(SUPERVISOR)).resolves.toEqual({
      all: false,
      employeeIds: ['e-emp', 'e-sup'],
    });
    await expect(policy.scopeFor(EMPLOYEE)).resolves.toEqual({ all: false, employeeIds: ['e-emp'] });
  });

  it('un usuario sin empleado vinculado no accede a nada', async () => {
    const orphan: AccessActor = { userId: 'u-x', role: 'EMPLOYEE', employeeId: null };
    await expect(policy.scopeFor(orphan)).resolves.toEqual({ all: false, employeeIds: [] });
    await expect(policy.assertCanView(orphan, 'e-emp')).rejects.toThrow();
  });
});
