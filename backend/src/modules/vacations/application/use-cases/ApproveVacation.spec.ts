import { describe, expect, it, vi } from 'vitest';
import { UserRepository } from '../../../auth/domain/repositories/UserRepository';
import { EmployeeRepository } from '../../../employees/domain/repositories/EmployeeRepository';
import { AccessActor, EmployeeAccessPolicy } from '../../../employees/domain/services/EmployeeAccessPolicy';
import { GetLegalParameters } from '../../../legal-parameters/application/use-cases/GetLegalParameters';
import { LegalParameter } from '../../../legal-parameters/domain/entities/LegalParameter';
import { LegalParameterSet } from '../../../legal-parameters/domain/services/LegalParameterSet';
import { VacationRequest } from '../../domain/entities/VacationRequest';
import { VacationRepository } from '../../domain/repositories/VacationRepository';
import { ApproveVacation } from './ApproveVacation';

/**
 * Verifica el punto que motivo este archivo: el paso del supervisor solo lo
 * puede resolver el supervisor real del equipo o, en su ausencia, Recursos
 * Humanos como aprobacion de emergencia. Un Administrador queda excluido: no
 * debe poder aprobar vacaciones saltandose a RRHH.
 */

const SOLICITUD_BASE: VacationRequest = {
  id: 'req-1',
  employeeId: 'emp-empleado',
  employeeName: 'Maria Elena Quispe',
  departmentName: 'Operaciones',
  supervisorId: 'emp-supervisor',
  startDate: new Date('2026-10-05'),
  endDate: new Date('2026-10-09'),
  workingDays: 4,
  reason: null,
  status: 'PENDING_SUPERVISOR',
  supervisorApprovedAt: null,
  supervisorApprovedByName: null,
  supervisorApprovalIsEmergency: false,
  emergencyReason: null,
  hrApprovedAt: null,
  hrApprovedByName: null,
  rejectedAt: null,
  rejectedByName: null,
  rejectionReason: null,
  createdAt: new Date('2026-09-01'),
};

function legalParameters(overrides: Record<string, string> = {}): GetLegalParameters {
  const base: Record<string, string> = { VACATION_REQUIRE_HR_APPROVAL: 'true', ...overrides };
  const lista: LegalParameter[] = Object.entries(base).map(([key, value]) => ({
    id: key,
    key,
    value,
    valueType: 'boolean',
    description: null,
    unit: null,
    validFrom: new Date('2026-01-01'),
    validUntil: null,
  }));
  const set = new LegalParameterSet(lista, new Date());
  return { execute: async () => set } as unknown as GetLegalParameters;
}

function vacationRepoStub(overrides: Partial<VacationRepository> = {}): VacationRepository {
  return {
    findById: async () => SOLICITUD_BASE,
    updateStatus: async (_id: string, data: { status: VacationRequest['status'] }) => ({
      ...SOLICITUD_BASE,
      status: data.status,
    }),
    ...overrides,
  } as unknown as VacationRepository;
}

/** equipo: mapa supervisor (employeeId) -> ids de su equipo. */
function employeeRepoStub(equipo: Record<string, string[]>): EmployeeRepository {
  return {
    isSupervisorOf: async (supervisorId: string, employeeId: string) =>
      (equipo[supervisorId] ?? []).includes(employeeId),
    findById: async (id: string) => ({ id, fullName: `Empleado ${id}` }) as never,
  } as unknown as EmployeeRepository;
}

function userRepoStub(): UserRepository {
  return { findById: async (id: string) => ({ id, email: `${id}@empresa.bo` }) as never } as unknown as UserRepository;
}

const AUDIT = { log: vi.fn().mockResolvedValue(undefined) };
const NOTIFIER = { notify: vi.fn().mockResolvedValue(undefined) };

function crearCaso(equipo: Record<string, string[]> = { 'emp-supervisor': ['emp-empleado'] }) {
  const employees = employeeRepoStub(equipo);
  const policy = new EmployeeAccessPolicy(employees);
  AUDIT.log.mockClear();
  NOTIFIER.notify.mockClear();
  return new ApproveVacation(
    vacationRepoStub(),
    employees,
    userRepoStub(),
    legalParameters(),
    policy,
    AUDIT,
    NOTIFIER,
  );
}

const SUPERVISOR_REAL: AccessActor = { userId: 'u-sup', role: 'SUPERVISOR', employeeId: 'emp-supervisor' };
const SUPERVISOR_AJENO: AccessActor = { userId: 'u-otro', role: 'SUPERVISOR', employeeId: 'emp-otro' };
const HR: AccessActor = { userId: 'u-hr', role: 'HR', employeeId: 'emp-hr' };
const ADMIN: AccessActor = { userId: 'u-admin', role: 'ADMIN', employeeId: 'emp-admin' };

describe('ApproveVacation - quien puede cerrar el paso del supervisor', () => {
  it('el supervisor real del equipo aprueba sin que sea una emergencia', async () => {
    const useCase = crearCaso();
    await useCase.execute(SUPERVISOR_REAL, 'req-1');

    const evento = AUDIT.log.mock.calls[0][0];
    expect(evento.action).toBe('VACATION_APPROVED_SUPERVISOR');
    expect(evento.changes.emergencia).toBe(false);
  });

  it('RRHH puede cerrar el paso si el supervisor no esta disponible: es una aprobacion de emergencia, con motivo', async () => {
    const useCase = crearCaso();
    const resultado = await useCase.execute(HR, 'req-1', 'El supervisor esta de licencia medica');

    expect(resultado.status).toBe('PENDING_HR');
    const evento = AUDIT.log.mock.calls[0][0];
    expect(evento.action).toBe('VACATION_APPROVED_EMERGENCY');
    expect(evento.changes.emergencia).toBe(true);
    expect(evento.changes.rol).toBe('HR');
    expect(evento.changes.motivo).toBe('El supervisor esta de licencia medica');
  });

  it('el motivo es obligatorio para una aprobacion de emergencia de RRHH: sin motivo, rechaza', async () => {
    const useCase = crearCaso();
    await expect(useCase.execute(HR, 'req-1')).rejects.toThrow(/motivo/);
    expect(AUDIT.log).not.toHaveBeenCalled();
  });

  it('el motivo de la aprobacion de emergencia no puede ser un texto muy corto', async () => {
    const useCase = crearCaso();
    await expect(useCase.execute(HR, 'req-1', 'ok')).rejects.toThrow(/motivo/);
    expect(AUDIT.log).not.toHaveBeenCalled();
  });

  it('el supervisor real NO necesita motivo: no es una aprobacion de emergencia', async () => {
    const useCase = crearCaso();
    await expect(useCase.execute(SUPERVISOR_REAL, 'req-1')).resolves.toBeDefined();
  });

  it('la notificacion de una aprobacion de emergencia nombra a quien la hizo, el motivo y dice que fue de emergencia', async () => {
    const useCase = crearCaso();
    await useCase.execute(HR, 'req-1', 'El supervisor esta de licencia medica');

    const notificacion = NOTIFIER.notify.mock.calls[0][0];
    expect(notificacion.message).toContain('Recursos Humanos');
    expect(notificacion.message).toContain('emergencia');
    expect(notificacion.message).toContain('El supervisor esta de licencia medica');
  });

  it('un Administrador NO puede aprobar en lugar del supervisor: debe pasar por RRHH', async () => {
    const useCase = crearCaso();
    await expect(useCase.execute(ADMIN, 'req-1')).rejects.toThrow(/Recursos Humanos/);
    expect(AUDIT.log).not.toHaveBeenCalled();
  });

  it('un supervisor que no es el del equipo tampoco puede aprobar', async () => {
    const useCase = crearCaso();
    await expect(useCase.execute(SUPERVISOR_AJENO, 'req-1')).rejects.toThrow();
  });

  it('nadie puede aprobar su propia solicitud, ni siquiera RRHH', async () => {
    const useCase = crearCaso();
    const propia: AccessActor = { userId: 'u-x', role: 'HR', employeeId: 'emp-empleado' };
    await expect(useCase.execute(propia, 'req-1')).rejects.toThrow(/propia solicitud/);
  });
});

describe('ApproveVacation - cierre final del lado de RRHH', () => {
  const solicitudEnRRHH: VacationRequest = { ...SOLICITUD_BASE, status: 'PENDING_HR' };

  function casoEnRRHH() {
    const employees = employeeRepoStub({});
    const policy = new EmployeeAccessPolicy(employees);
    AUDIT.log.mockClear();
    return new ApproveVacation(
      vacationRepoStub({ findById: async () => solicitudEnRRHH } as Partial<VacationRepository>),
      employees,
      userRepoStub(),
      legalParameters(),
      policy,
      AUDIT,
      NOTIFIER,
    );
  }

  it('RRHH aprueba y queda en estado normal (no de emergencia)', async () => {
    const useCase = casoEnRRHH();
    const resultado = await useCase.execute(HR, 'req-1');

    expect(resultado.status).toBe('APPROVED');
    expect(AUDIT.log.mock.calls[0][0].action).toBe('VACATION_APPROVED');
  });

  it('un supervisor no puede dar el cierre final que corresponde a RRHH', async () => {
    const useCase = casoEnRRHH();
    await expect(useCase.execute(SUPERVISOR_REAL, 'req-1')).rejects.toThrow(/corresponde a RRHH/);
  });
});
