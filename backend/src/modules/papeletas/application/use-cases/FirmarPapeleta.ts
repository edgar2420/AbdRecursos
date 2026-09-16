import { AuditLoggerPort } from '../../../../shared/application/AuditLogger';
import { BusinessRuleError, ForbiddenError, NotFoundError } from '../../../../shared/domain/errors';
import { EmployeeRepository } from '../../../employees/domain/repositories/EmployeeRepository';
import { AccessActor, EmployeeAccessPolicy } from '../../../employees/domain/services/EmployeeAccessPolicy';
import { GetLegalParameters } from '../../../legal-parameters/application/use-cases/GetLegalParameters';
import { NotifierPort } from '../../../vacations/application/ports/NotifierPort';
import { Papeleta } from '../../domain/entities/Papeleta';
import { PapeletaRepository } from '../../domain/repositories/PapeletaRepository';
import { Firmante, PapeletaRules } from '../../domain/services/PapeletaRules';
import { SelloDeFirmaPort } from '../../domain/services/SelloDeFirma';

/**
 * Firma digital de una papeleta. Reemplaza las dos firmas manuscritas del
 * formulario: la del jefe de area y la de Recursos Humanos.
 *
 * Quien firma no se elige: se deduce del rol y del vinculo con el empleado.
 * El jefe de area solo puede firmar papeletas de su propio equipo.
 */
export class FirmarPapeleta {
  constructor(
    private readonly papeletas: PapeletaRepository,
    private readonly employees: EmployeeRepository,
    private readonly parameters: GetLegalParameters,
    private readonly policy: EmployeeAccessPolicy,
    private readonly sello: SelloDeFirmaPort,
    private readonly audit: AuditLoggerPort,
    private readonly notifier: NotifierPort,
  ) {}

  async execute(actor: AccessActor, id: string): Promise<Papeleta> {
    const papeleta = await this.papeletas.findById(id);
    if (!papeleta) throw new NotFoundError('Papeleta');

    if (papeleta.employeeId === actor.employeeId) {
      throw new ForbiddenError('No puede firmar su propia papeleta');
    }

    const rules = new PapeletaRules(await this.parameters.execute(papeleta.fecha));
    const firmante = await this.resolverFirmante(actor, papeleta);
    rules.assertPuedeFirmar(papeleta, firmante);

    const fecha = new Date();
    const estado = rules.estadoTrasFirmar(papeleta.estado);
    const actualizada = await this.papeletas.registrarFirma(id, {
      firmante,
      userId: actor.userId,
      fecha,
      sello: this.sello.sellar(papeleta, actor.userId, fecha),
      estado,
    });

    await this.audit.log({
      userId: actor.userId,
      action: firmante === 'JEFE_AREA' ? 'PAPELETA_FIRMADA_JEFE_AREA' : 'PAPELETA_FIRMADA_RRHH',
      entity: 'Papeleta',
      entityId: id,
      changes: { numero: papeleta.numero, estado },
    });
    await this.notifier.notify({
      type: estado === 'APROBADA' ? 'PAPELETA_APROBADA' : 'PAPELETA_PENDIENTE_RRHH',
      employeeId: papeleta.employeeId,
      title:
        estado === 'APROBADA'
          ? `Papeleta ${papeleta.numero} aprobada`
          : `Papeleta ${papeleta.numero} paso a Recursos Humanos`,
      message: firmante === 'JEFE_AREA' ? 'Firmo el jefe de area' : 'Firmo Recursos Humanos',
      referenceId: id,
    });

    return actualizada;
  }

  /**
   * El rol determina en que casilla firma. Un ADMIN puede cubrir cualquiera de
   * las dos, porque es quien destraba el circuito cuando falta alguien.
   */
  private async resolverFirmante(actor: AccessActor, papeleta: Papeleta): Promise<Firmante> {
    if (actor.role === 'HR') return 'RRHH';

    if (actor.role === 'SUPERVISOR') {
      if (!actor.employeeId) throw new ForbiddenError('Su usuario no esta vinculado a un empleado');
      const esSuEquipo = await this.employees.isSupervisorOf(actor.employeeId, papeleta.employeeId);
      if (!esSuEquipo) {
        throw new ForbiddenError('Solo puede firmar papeletas de su equipo');
      }
      return 'JEFE_AREA';
    }

    if (actor.role === 'ADMIN') {
      const pendiente = new PapeletaRules(
        await this.parameters.execute(papeleta.fecha),
      ).firmantePendiente(papeleta.estado);
      if (!pendiente) throw new BusinessRuleError('La papeleta ya no admite firmas');
      return pendiente;
    }

    throw new ForbiddenError('Su rol no firma papeletas');
  }
}

/** Rechazo: corta el circuito y deja constancia del motivo. */
export class RechazarPapeleta {
  constructor(
    private readonly papeletas: PapeletaRepository,
    private readonly employees: EmployeeRepository,
    private readonly policy: EmployeeAccessPolicy,
    private readonly audit: AuditLoggerPort,
    private readonly notifier: NotifierPort,
  ) {}

  async execute(actor: AccessActor, id: string, motivo: string): Promise<Papeleta> {
    const papeleta = await this.papeletas.findById(id);
    if (!papeleta) throw new NotFoundError('Papeleta');
    if (papeleta.estado === 'APROBADA' || papeleta.estado === 'RECHAZADA') {
      throw new BusinessRuleError('La papeleta ya no esta en circulacion');
    }
    if (papeleta.employeeId === actor.employeeId) {
      throw new ForbiddenError('No puede rechazar su propia papeleta');
    }

    if (!this.policy.isPrivileged(actor)) {
      if (actor.role !== 'SUPERVISOR' || !actor.employeeId) {
        throw new ForbiddenError('Su rol no puede rechazar papeletas');
      }
      const esSuEquipo = await this.employees.isSupervisorOf(actor.employeeId, papeleta.employeeId);
      if (!esSuEquipo) throw new ForbiddenError('Solo puede rechazar papeletas de su equipo');
    }

    const actualizada = await this.papeletas.rechazar(id, { userId: actor.userId, motivo });
    await this.audit.log({
      userId: actor.userId,
      action: 'PAPELETA_RECHAZADA',
      entity: 'Papeleta',
      entityId: id,
      changes: { numero: papeleta.numero, motivo },
    });
    await this.notifier.notify({
      type: 'PAPELETA_RECHAZADA',
      employeeId: papeleta.employeeId,
      title: `Papeleta ${papeleta.numero} rechazada`,
      message: motivo,
      referenceId: id,
    });
    return actualizada;
  }
}
