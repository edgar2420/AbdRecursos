import { AuditLoggerPort } from '../../../../shared/application/AuditLogger';
import { ForbiddenError, NotFoundError } from '../../../../shared/domain/errors';
import { EmployeeRepository } from '../../../employees/domain/repositories/EmployeeRepository';
import { AccessActor, EmployeeAccessPolicy } from '../../../employees/domain/services/EmployeeAccessPolicy';
import { GetLegalParameters } from '../../../legal-parameters/application/use-cases/GetLegalParameters';
import { Papeleta, RecargoHoraExtra, SalidaMotivo } from '../../domain/entities/Papeleta';
import { PapeletaRepository } from '../../domain/repositories/PapeletaRepository';
import { PapeletaRules } from '../../domain/services/PapeletaRules';
import { NotifierPort } from '../../../vacations/application/ports/NotifierPort';

export interface CrearHorasExtrasInput {
  employeeId?: string;
  fecha: Date;
  trabajoRealizado: string;
  desde: Date;
  hasta: Date;
  recargo: RecargoHoraExtra;
}

export interface CrearSalidaInput {
  employeeId?: string;
  fecha: Date;
  salidaMotivo: SalidaMotivo;
  motivo: string;
  tiempoSolicitado: string;
  horaSalida: string;
  horaRetorno?: string;
  /** Certificado o foto adjunta, ya subida via /uploads (ver UploadAttachment). */
  attachmentUrl?: string;
}

/**
 * Emision de una papeleta. Por defecto cada quien emite la suya; RRHH puede
 * registrarla por un tercero, igual que cuando llenaba el formulario en papel.
 *
 * El area y el codigo salen de la ficha del empleado: no se escriben a mano
 * para que no puedan declararse de otra area que la propia.
 */
export class CrearPapeleta {
  constructor(
    private readonly papeletas: PapeletaRepository,
    private readonly employees: EmployeeRepository,
    private readonly parameters: GetLegalParameters,
    private readonly policy: EmployeeAccessPolicy,
    private readonly audit: AuditLoggerPort,
    private readonly notifier: NotifierPort,
  ) {}

  async horasExtras(actor: AccessActor, input: CrearHorasExtrasInput): Promise<Papeleta> {
    const employee = await this.resolverEmpleado(actor, input.employeeId);
    const rules = new PapeletaRules(await this.parameters.execute(input.fecha));
    const totalHoras = rules.calcularHoras(input.desde, input.hasta);

    const numero = await this.papeletas.siguienteNumero('HORAS_EXTRAS', input.fecha.getFullYear());
    const papeleta = await this.papeletas.crearHorasExtras({
      employeeId: employee.id,
      area: employee.departmentName ?? 'Sin area',
      fecha: input.fecha,
      trabajoRealizado: input.trabajoRealizado,
      desde: input.desde,
      hasta: input.hasta,
      recargo: input.recargo,
      numero,
      totalHoras,
    });

    await this.registrar(actor, papeleta, employee.fullName, 'PAPELETA_HORAS_EXTRAS_CREADA');
    return papeleta;
  }

  async salida(actor: AccessActor, input: CrearSalidaInput): Promise<Papeleta> {
    const employee = await this.resolverEmpleado(actor, input.employeeId);
    const rules = new PapeletaRules(await this.parameters.execute(input.fecha));
    rules.validarSalida(input.horaSalida, input.horaRetorno);

    const numero = await this.papeletas.siguienteNumero('SALIDA', input.fecha.getFullYear());
    const papeleta = await this.papeletas.crearSalida({
      employeeId: employee.id,
      area: employee.departmentName ?? 'Sin area',
      fecha: input.fecha,
      salidaMotivo: input.salidaMotivo,
      motivo: input.motivo,
      tiempoSolicitado: input.tiempoSolicitado,
      horaSalida: input.horaSalida,
      horaRetorno: input.horaRetorno ?? null,
      attachmentUrl: input.attachmentUrl ?? null,
      numero,
    });

    await this.registrar(actor, papeleta, employee.fullName, 'PAPELETA_SALIDA_CREADA');
    return papeleta;
  }

  private async resolverEmpleado(actor: AccessActor, employeeId?: string) {
    const id = employeeId ?? actor.employeeId;
    if (!id) throw new ForbiddenError('Su usuario no esta vinculado a un empleado');
    if (id !== actor.employeeId && !this.policy.isPrivileged(actor)) {
      throw new ForbiddenError('Solo puede emitir papeletas a su nombre');
    }
    const employee = await this.employees.findById(id);
    if (!employee) throw new NotFoundError('Empleado');
    return employee;
  }

  private async registrar(
    actor: AccessActor,
    papeleta: Papeleta,
    nombre: string,
    accion: string,
  ): Promise<void> {
    await this.audit.log({
      userId: actor.userId,
      action: accion,
      entity: 'Papeleta',
      entityId: papeleta.id,
      changes: { numero: papeleta.numero, employeeId: papeleta.employeeId },
    });
    await this.notifier.notify({
      type: accion,
      employeeId: papeleta.employeeId,
      title: `Papeleta ${papeleta.numero} pendiente de firma`,
      message: `${nombre} emitio una papeleta que espera la firma del jefe de area`,
      referenceId: papeleta.id,
    });
  }
}
