import { AuditLoggerPort } from '../../../../shared/application/AuditLogger';
import { BusinessRuleError, ForbiddenError, NotFoundError } from '../../../../shared/domain/errors';
import { EmployeeRepository } from '../../../employees/domain/repositories/EmployeeRepository';
import { AccessActor, EmployeeAccessPolicy } from '../../../employees/domain/services/EmployeeAccessPolicy';
import { GetLegalParameters } from '../../../legal-parameters/application/use-cases/GetLegalParameters';
import { VacationRequest } from '../../domain/entities/VacationRequest';
import { HolidayRepository, VacationRepository } from '../../domain/repositories/VacationRepository';
import { VacationCalculator } from '../../domain/services/VacationCalculator';
import { NotifierPort } from '../ports/NotifierPort';
import { GetVacationBalance } from './GetVacationBalance';

export interface RequestVacationInput {
  employeeId?: string;
  startDate: Date;
  endDate: Date;
  reason?: string;
}

export class RequestVacation {
  constructor(
    private readonly employees: EmployeeRepository,
    private readonly vacations: VacationRepository,
    private readonly holidays: HolidayRepository,
    private readonly parameters: GetLegalParameters,
    private readonly policy: EmployeeAccessPolicy,
    private readonly balance: GetVacationBalance,
    private readonly audit: AuditLoggerPort,
    private readonly notifier: NotifierPort,
  ) {}

  async execute(actor: AccessActor, input: RequestVacationInput): Promise<VacationRequest> {
    // Por defecto uno solicita para si mismo; RRHH puede registrar por un tercero.
    const employeeId = input.employeeId ?? actor.employeeId;
    if (!employeeId) throw new ForbiddenError('Su usuario no esta vinculado a un empleado');
    if (employeeId !== actor.employeeId && !this.policy.isPrivileged(actor)) {
      throw new ForbiddenError('Solo puede solicitar vacaciones para usted');
    }

    const employee = await this.employees.findById(employeeId);
    if (!employee) throw new NotFoundError('Empleado');

    const calculator = new VacationCalculator(await this.parameters.execute(new Date()));
    calculator.assertValidRange(input.startDate, input.endDate);

    if (await this.vacations.hasOverlap(employeeId, input.startDate, input.endDate)) {
      throw new BusinessRuleError('Ya existe una solicitud que se cruza con esas fechas');
    }

    const holidays = await this.holidays.listBetween(input.startDate, input.endDate);
    const workingDays = calculator.workingDays(input.startDate, input.endDate, holidays);
    const current = await this.balance.execute(actor, employeeId, input.startDate.getFullYear());
    calculator.assertEnoughBalance(workingDays, current.availableDays);

    // Siempre arranca en el paso del supervisor, tenga o no uno asignado: si
    // no tiene, nadie puede cerrar ese paso como "el supervisor real" (ver
    // ApproveVacation.esAprobacionDeEmergencia), y RRHH lo cierra como
    // aprobacion de emergencia, con motivo obligatorio. Saltarselo directo a
    // RRHH perderia esa auditoria justo en el caso mas expuesto: el empleado
    // que ni siquiera tiene quien lo apruebe normalmente.
    const created = await this.vacations.create({
      employeeId,
      startDate: input.startDate,
      endDate: input.endDate,
      workingDays,
      reason: input.reason ?? null,
      status: 'PENDING_SUPERVISOR',
    });

    await this.audit.log({
      userId: actor.userId,
      action: 'VACATION_REQUESTED',
      entity: 'VacationRequest',
      entityId: created.id,
      changes: { employeeId, workingDays, startDate: input.startDate, endDate: input.endDate },
    });
    await this.notifier.notify({
      type: 'VACATION_REQUESTED',
      employeeId,
      title: 'Nueva solicitud de vacaciones',
      message: `${employee.fullName} solicito ${workingDays} dias habiles`,
      referenceId: created.id,
    });
    return created;
  }
}
