import { describe, expect, it, vi } from 'vitest';
import { BusinessRuleError } from '../../../../shared/domain/errors';
import { Employee } from '../../domain/entities/Employee';
import { notaDeBaja, problemaFechaBaja } from '../../domain/motivosBaja';
import { EmployeeRepository } from '../../domain/repositories/EmployeeRepository';
import { EmployeeAccessPolicy } from '../../domain/services/EmployeeAccessPolicy';
import { DeactivateEmployee, ReactivateEmployee } from './DeactivateEmployee';

const actor = { userId: 'u-rrhh', role: 'HR', employeeId: null } as never;

function armar(empleado: Partial<Employee>, tieneUsuario = true) {
  let actual = { id: 'e1', status: 'ACTIVE', isActive: true, hireDate: new Date(2020, 0, 15), terminationDate: null, terminationReason: null, ...empleado } as Employee;
  const employees = {
    findById: vi.fn(async () => actual),
    update: vi.fn(async (_id: string, data: Partial<Employee>) => (actual = { ...actual, ...data })),
    setActive: vi.fn(async (_id: string, isActive: boolean) => (actual = { ...actual, isActive })),
    addHistory: vi.fn(async () => undefined),
  } as unknown as EmployeeRepository;
  const policy = { assertCanManage: vi.fn() } as unknown as EmployeeAccessPolicy;
  const audit = { log: vi.fn(async () => undefined) };
  const acceso = { bloquear: vi.fn(async () => tieneUsuario), habilitar: vi.fn(async () => tieneUsuario) };
  return { employees, policy, audit, acceso, actual: () => actual };
}

describe('baja de empleados', () => {
  it('guarda fecha y motivo, bloquea el usuario y deja el motivo en el historial', async () => {
    const m = armar({});
    const baja = new DeactivateEmployee(m.employees, m.policy, m.audit, m.acceso);
    const r = await baja.execute(actor, 'e1', { terminationDate: new Date(2026, 9, 1), motivo: 'RENUNCIA', notes: ' presento carta ' });

    expect(r.usuarioAfectado).toBe(true);
    expect(m.acceso.bloquear).toHaveBeenCalledWith('e1');
    expect(m.actual()).toMatchObject({ status: 'TERMINATED', isActive: false, terminationReason: 'RENUNCIA', terminationNotes: 'presento carta' });
    expect(m.employees.addHistory).toHaveBeenCalledWith(expect.objectContaining({ changeType: 'TERMINATION', notes: 'Renuncia voluntaria: presento carta' }));
  });

  it('no da de baja dos veces ni con fecha anterior al ingreso', async () => {
    const yaBaja = armar({ isActive: false, status: 'TERMINATED' });
    await expect(new DeactivateEmployee(yaBaja.employees, yaBaja.policy, yaBaja.audit, yaBaja.acceso).execute(actor, 'e1', { motivo: 'OTRO' })).rejects.toThrow(
      'ya esta dado de baja',
    );

    const m = armar({});
    await expect(
      new DeactivateEmployee(m.employees, m.policy, m.audit, m.acceso).execute(actor, 'e1', { terminationDate: new Date(2019, 11, 31), motivo: 'OTRO' }),
    ).rejects.toBeInstanceOf(BusinessRuleError);
    expect(m.acceso.bloquear).not.toHaveBeenCalled();
  });

  it('al reactivar limpia la baja y habilita el usuario', async () => {
    const m = armar({ isActive: false, status: 'TERMINATED', terminationDate: new Date(2026, 7, 31), terminationReason: 'ABANDONO', terminationNotes: 'x' });
    const r = await new ReactivateEmployee(m.employees, m.policy, m.audit, m.acceso).execute(actor, 'e1', { notes: 'Reingreso' });

    expect(r.usuarioAfectado).toBe(true);
    expect(m.actual()).toMatchObject({ status: 'ACTIVE', isActive: true, terminationDate: null, terminationReason: null, terminationNotes: null });
    expect(m.employees.addHistory).toHaveBeenCalledWith(expect.objectContaining({ changeType: 'REACTIVATION', notes: 'Reingreso' }));
  });

  it('no reactiva a quien ya esta activo', async () => {
    const m = armar({});
    await expect(new ReactivateEmployee(m.employees, m.policy, m.audit, m.acceso).execute(actor, 'e1')).rejects.toThrow('ya esta activo');
  });

  it('valida la fecha de retiro', () => {
    const hoy = new Date(2026, 9, 9);
    const ingreso = new Date(2020, 0, 15);
    expect(problemaFechaBaja(new Date(2026, 9, 9), ingreso, hoy)).toBeNull();
    expect(problemaFechaBaja(new Date(2026, 10, 9), ingreso, hoy)).toBeNull();
    expect(problemaFechaBaja(new Date(2026, 10, 10), ingreso, hoy)).toContain('31 dias');
    expect(problemaFechaBaja(new Date(2020, 0, 14), ingreso, hoy)).toContain('anterior a la fecha de ingreso');
    expect(notaDeBaja(null, ' ')).toBeNull();
    expect(notaDeBaja('FIN_CONTRATO', null)).toBe('Fin de contrato');
  });
});
