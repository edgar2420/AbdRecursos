import { AuditLoggerPort } from '../../../../shared/application/AuditLogger';
import { BusinessRuleError, ForbiddenError, NotFoundError } from '../../../../shared/domain/errors';
import { UserRepository } from '../../../auth/domain/repositories/UserRepository';
import { EmployeeRepository } from '../../../employees/domain/repositories/EmployeeRepository';
import { AccessActor, EmployeeAccessPolicy } from '../../../employees/domain/services/EmployeeAccessPolicy';
import { GetLegalParameters } from '../../../legal-parameters/application/use-cases/GetLegalParameters';
import { VacationRequest } from '../../domain/entities/VacationRequest';
import { VacationRepository } from '../../domain/repositories/VacationRepository';
import { VacationCalculator } from '../../domain/services/VacationCalculator';
import { NotifierPort } from '../ports/NotifierPort';

const ROL_LEGIBLE: Record<AccessActor['role'], string> = {
  EMPLOYEE: 'Empleado',
  SUPERVISOR: 'su supervisor',
  HR: 'Recursos Humanos',
  ADMIN: 'Administracion',
};

export class ApproveVacation {
  constructor(
    private readonly vacations: VacationRepository,
    private readonly employees: EmployeeRepository,
    private readonly users: UserRepository,
    private readonly parameters: GetLegalParameters,
    private readonly policy: EmployeeAccessPolicy,
    private readonly audit: AuditLoggerPort,
    private readonly notifier: NotifierPort,
  ) {}

  async execute(actor: AccessActor, requestId: string, emergencyReason?: string): Promise<VacationRequest> {
    const request = await this.vacations.findById(requestId);
    if (!request) throw new NotFoundError('Solicitud de vacaciones');
    if (request.status === 'APPROVED') throw new BusinessRuleError('La solicitud ya fue aprobada');
    if (request.status === 'REJECTED' || request.status === 'CANCELLED') {
      throw new BusinessRuleError('La solicitud ya no esta en tramite');
    }
    if (request.employeeId === actor.employeeId) {
      throw new ForbiddenError('No puede aprobar su propia solicitud');
    }

    const calculator = new VacationCalculator(await this.parameters.execute(new Date()));

    if (request.status === 'PENDING_SUPERVISOR') {
      const emergencia = await this.esAprobacionDeEmergencia(actor, request.employeeId);
      if (emergencia && (emergencyReason ?? '').trim().length < 5) {
        throw new BusinessRuleError(
          'Para aprobar de emergencia en ausencia del supervisor debe indicar el motivo (minimo 5 caracteres)',
        );
      }
      const nextStatus = calculator.requiresHrApproval() ? 'PENDING_HR' : 'APPROVED';
      return this.finish(
        actor,
        request,
        nextStatus,
        { supervisorApprovedBy: actor.userId, emergencyReason: emergencia ? emergencyReason!.trim() : null },
        emergencia,
      );
    }

    if (!this.policy.isPrivileged(actor)) {
      throw new ForbiddenError('La aprobacion final corresponde a RRHH');
    }
    return this.finish(actor, request, 'APPROVED', { hrApprovedBy: actor.userId }, false);
  }

  private async esAprobacionDeEmergencia(actor: AccessActor, employeeId: string): Promise<boolean> {
    if (actor.role === 'SUPERVISOR' && actor.employeeId) {
      const esElSupervisorDelEquipo = await this.employees.isSupervisorOf(actor.employeeId, employeeId);
      if (esElSupervisorDelEquipo) return false;
    }
    if (actor.role === 'HR') return true;

    throw new ForbiddenError(
      actor.role === 'ADMIN'
        ? 'Un administrador no puede aprobar vacaciones en lugar del supervisor. Esa aprobacion de emergencia le corresponde a Recursos Humanos.'
        : 'Solo el supervisor del equipo puede aprobar. Si no esta disponible, la aprobacion de emergencia le corresponde a Recursos Humanos.',
    );
  }

  private async finish(
    actor: AccessActor,
    request: VacationRequest,
    status: 'PENDING_HR' | 'APPROVED',
    approvals: { supervisorApprovedBy?: string; hrApprovedBy?: string; emergencyReason?: string | null },
    emergencia: boolean,
  ): Promise<VacationRequest> {
    const updated = await this.vacations.updateStatus(request.id, { status, ...approvals });
    const aprobadoPor = await this.nombreDelActor(actor);

    await this.audit.log({
      userId: actor.userId,
      action: emergencia
        ? 'VACATION_APPROVED_EMERGENCY'
        : status === 'APPROVED'
          ? 'VACATION_APPROVED'
          : 'VACATION_APPROVED_SUPERVISOR',
      entity: 'VacationRequest',
      entityId: request.id,
      changes: {
        from: request.status,
        to: status,
        aprobadoPor,
        rol: actor.role,
        emergencia,
        ...(emergencia ? { motivo: approvals.emergencyReason } : {}),
      },
    });

    const responsable = emergencia
      ? `${aprobadoPor} (Recursos Humanos, aprobacion de emergencia por ausencia del supervisor: "${approvals.emergencyReason}")`
      : `${aprobadoPor} (${ROL_LEGIBLE[actor.role]})`;

    await this.notifier.notify({
      type: emergencia ? 'VACATION_APPROVED_EMERGENCY' : status === 'APPROVED' ? 'VACATION_APPROVED' : 'VACATION_PENDING_HR',
      employeeId: request.employeeId,
      title: status === 'APPROVED' ? 'Vacaciones aprobadas' : 'Solicitud enviada a RRHH',
      message: `Aprobado por ${responsable}: ${request.workingDays} dias habiles del ${request.startDate.toLocaleDateString('es-BO')}`,
      referenceId: request.id,
    });
    return updated;
  }

  private async nombreDelActor(actor: AccessActor): Promise<string> {
    if (actor.employeeId) {
      const empleado = await this.employees.findById(actor.employeeId);
      if (empleado) return empleado.fullName;
    }
    const usuario = await this.users.findById(actor.userId);
    return usuario?.email ?? 'un usuario del sistema';
  }
}
