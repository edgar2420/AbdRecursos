import { AuditLoggerPort } from '../../../shared/application/AuditLogger';
import { PublicadorEventos, sinEventos } from '../../../shared/application/Eventos';
import { BusinessRuleError } from '../../../shared/domain/errors';
import { AccessActor, EmployeeAccessPolicy } from '../../employees/domain/services/EmployeeAccessPolicy';
import { NominaRepository } from '../domain/NominaRepository';
import { CambioFicha, FilaNomina, PlanNomina, planificarNomina } from '../domain/nominaBiometrico';

export interface ArchivoNomina {
  contenido: Buffer;
  nombre: string;
}

/** Lo que ve RRHH: el plan sin los datos crudos que se van a guardar. */
export type VistaNomina = Omit<PlanNomina, 'cambios'> & { cambios: Omit<CambioFicha, 'datos'>[] };

/**
 * Nomina para el biometrico: RRHH sube el archivo, revisa los cambios ficha por ficha
 * y los aplica. Al aplicar se vuelve a leer el archivo y se recalcula el plan contra
 * los datos del momento, para no guardar una vista previa vieja.
 */
export class NominaBiometrico {
  constructor(
    private readonly repo: NominaRepository,
    private readonly huella: (ci: string) => string,
    private readonly leer: (contenido: Buffer, nombre: string) => Promise<FilaNomina[]>,
    private readonly policy: EmployeeAccessPolicy,
    private readonly audit: AuditLoggerPort,
    private readonly eventos: PublicadorEventos = sinEventos,
  ) {}

  async revisar(actor: AccessActor, archivo: ArchivoNomina): Promise<VistaNomina> {
    this.policy.assertCanManage(actor);
    const plan = await this.planificar(archivo);
    return { ...plan, cambios: plan.cambios.map(({ datos: _datos, ...resto }) => resto) };
  }

  async aplicar(actor: AccessActor, archivo: ArchivoNomina): Promise<{ fichas: number; cargosNuevos: number }> {
    this.policy.assertCanManage(actor);
    const plan = await this.planificar(archivo);
    if (plan.cambios.length === 0) return { fichas: 0, cargosNuevos: 0 };

    await this.repo.aplicar(plan.cambios, plan.cargosNuevos);
    await this.audit.log({
      userId: actor.userId,
      action: 'IMPORT_NOMINA_BIOMETRICO',
      entity: 'Employee',
      changes: {
        archivo: archivo.nombre,
        fichas: plan.cambios.length,
        ...plan.resumen,
        cargosNuevos: plan.cargosNuevos,
        codigos: plan.cambios.map((c) => c.codigo),
      },
    });
    this.eventos.publicar('empleados');
    return { fichas: plan.cambios.length, cargosNuevos: plan.cargosNuevos.length };
  }

  private async planificar(archivo: ArchivoNomina): Promise<PlanNomina> {
    const filas = await this.leer(archivo.contenido, archivo.nombre);
    if (filas.length === 0) {
      throw new BusinessRuleError('No se encontraron empleados: el archivo debe tener la columna CODIGO y las filas de la nomina debajo');
    }
    const [fichas, cargos] = await Promise.all([this.repo.fichas(), this.repo.cargos()]);
    try {
      return planificarNomina(filas, fichas, cargos, this.huella);
    } catch (error) {
      throw new BusinessRuleError(error instanceof Error ? error.message : String(error));
    }
  }
}
