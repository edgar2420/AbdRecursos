import { AuditLoggerPort } from '../../../../shared/application/AuditLogger';
import { BusinessRuleError, ForbiddenError, NotFoundError } from '../../../../shared/domain/errors';
import { EmployeeRepository } from '../../../employees/domain/repositories/EmployeeRepository';
import { AccessActor, EmployeeAccessPolicy } from '../../../employees/domain/services/EmployeeAccessPolicy';
import { VacationRequest } from '../../domain/entities/VacationRequest';
import { VacationRepository } from '../../domain/repositories/VacationRepository';
import { NotifierPort } from '../ports/NotifierPort';

export class RejectVacation {
  constructor(
    private readonly vacations: VacationRepository,
    private readonly employees: EmployeeRepository,
    private readonly policy: EmployeeAccessPolicy,
    private readonly audit: AuditLoggerPort,
    private readonly notifier: NotifierPort,
  ) {}

  async execute(actor: AccessActor, requestId: string, reason: string): Promise<VacationRequest> {
    const request = await this.vacations.findById(requestId);
    if (!request) throw new NotFoundError('Solicitud de vacaciones');
    if (request.status === 'APPROVED' || request.status === 'REJECTED' || request.status === 'CANCELLED') {
      throw new BusinessRuleError('La solicitud ya no esta en tramite');
    }

    if (!this.policy.isPrivileged(actor)) {
      if (actor.role !== 'SUPERVISOR' || !actor.employeeId) {
        throw new ForbiddenError('No tiene permisos para rechazar esta solicitud');
      }
      const isSupervisor = await this.employees.isSupervisorOf(actor.employeeId, request.employeeId);
      if (!isSupervisor) throw new ForbiddenError('El empleado no pertenece a su equipo');
    }

    const updated = await this.vacations.updateStatus(requestId, {
      status: 'REJECTED',
      rejectedBy: actor.userId,
      rejectionReason: reason,
    });
    await this.audit.log({
      userId: actor.userId,
      action: 'VACATION_REJECTED',
      entity: 'VacationRequest',
      entityId: requestId,
      changes: { reason },
    });
    await this.notifier.notify({
      type: 'VACATION_REJECTED',
      employeeId: request.employeeId,
      title: 'Solicitud de vacaciones rechazada',
      message: reason,
      referenceId: requestId,
    });
    return updated;
  }
}

/**
 * Cancelar solo mientras la solicitud siga EN TRAMITE. Una vez aprobada queda
 * firme: ya se comprometio el saldo, se aviso al equipo y se planifico la
 * ausencia, asi que nadie -ni RRHH- la cancela desde aca. Si hay que revertir
 * unas vacaciones ya aprobadas, eso es una decision administrativa que debe
 * quedar documentada aparte, no un boton que deshace el tramite en silencio.
 */
export class CancelVacation {
  constructor(
    private readonly vacations: VacationRepository,
    private readonly policy: EmployeeAccessPolicy,
    private readonly audit: AuditLoggerPort,
  ) {}

  async execute(actor: AccessActor, requestId: string): Promise<VacationRequest> {
    const request = await this.vacations.findById(requestId);
    if (!request) throw new NotFoundError('Solicitud de vacaciones');
    if (!this.policy.isSelf(actor, request.employeeId) && !this.policy.isPrivileged(actor)) {
      throw new ForbiddenError('Solo puede cancelar sus propias solicitudes');
    }
    if (request.status === 'CANCELLED') return request;
    if (request.status === 'APPROVED') {
      throw new BusinessRuleError('Las vacaciones ya aprobadas no se pueden cancelar');
    }
    if (request.status === 'REJECTED') {
      throw new BusinessRuleError('La solicitud ya fue rechazada');
    }

    const updated = await this.vacations.updateStatus(requestId, { status: 'CANCELLED' });
    await this.audit.log({
      userId: actor.userId,
      action: 'VACATION_CANCELLED',
      entity: 'VacationRequest',
      entityId: requestId,
    });
    return updated;
  }
}
