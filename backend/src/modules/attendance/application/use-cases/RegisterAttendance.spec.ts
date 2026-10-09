import { describe, expect, it, vi } from 'vitest';
import { ForbiddenError } from '../../../../shared/domain/errors';
import { EmployeeAccessPolicy } from '../../../employees/domain/services/EmployeeAccessPolicy';
import { GetLegalParameters } from '../../../legal-parameters/application/use-cases/GetLegalParameters';
import { ScheduleRepository } from '../../../schedules/domain/repositories/ScheduleRepository';
import { AttendanceRepository } from '../../domain/repositories/AttendanceRepository';
import { RegisterAttendance } from './RegisterAttendance';

const rrhh = { userId: 'u-rrhh', role: 'HR', employeeId: 'e-rrhh' } as never;

function armar() {
  const attendance = {
    lastRecordOfDay: vi.fn(async () => null),
    create: vi.fn(async (data: Record<string, unknown>) => ({ id: 'a1', ...data })),
  } as unknown as AttendanceRepository;
  const schedules = { findActiveForEmployee: vi.fn(async () => null) } as unknown as ScheduleRepository;
  const parameters = { execute: vi.fn(async () => ({})) } as unknown as GetLegalParameters;
  const policy = { assertCanManage: vi.fn(), isPrivileged: vi.fn(() => true) } as unknown as EmployeeAccessPolicy;
  const audit = { log: vi.fn(async () => undefined) };
  return { attendance, policy, audit, uc: new RegisterAttendance(attendance, schedules, parameters, policy, audit) };
}

describe('marcacion manual (la asistencia diaria va por el biometrico)', () => {
  it('ya no se puede marcar la propia asistencia desde la web', async () => {
    const m = armar();
    await expect(m.uc.execute(rrhh, { type: 'CHECK_IN' })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(m.uc.execute(rrhh, { type: 'CHECK_IN', employeeId: 'e-rrhh' })).rejects.toThrow('sus propias marcaciones');
    expect(m.attendance.create).not.toHaveBeenCalled();
  });

  it('RRHH agrega la marcacion de otro empleado como manual y queda en auditoria', async () => {
    const m = armar();
    const cuando = new Date(2026, 9, 9, 8, 0);
    await m.uc.execute(rrhh, { type: 'CHECK_IN', employeeId: 'e-2', timestamp: cuando, notes: 'Olvido marcar' });
    expect(m.policy.assertCanManage).toHaveBeenCalledWith(rrhh);
    expect(m.attendance.create).toHaveBeenCalledWith(expect.objectContaining({ employeeId: 'e-2', source: 'MANUAL_HR', timestamp: cuando }));
    expect(m.audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'ATTENDANCE_REGISTERED_BY_HR' }));
  });
});
