import { ForbiddenError, NotFoundError } from '../../../../shared/domain/errors';
import { Paginated } from '../../../../shared/domain/pagination';
import { AccessActor, EmployeeAccessPolicy } from '../../../employees/domain/services/EmployeeAccessPolicy';
import { Papeleta } from '../../domain/entities/Papeleta';
import { PapeletaFilters, PapeletaRepository } from '../../domain/repositories/PapeletaRepository';

export class ListarPapeletas {
  constructor(
    private readonly papeletas: PapeletaRepository,
    private readonly policy: EmployeeAccessPolicy,
  ) {}

  async execute(actor: AccessActor, filters: PapeletaFilters): Promise<Paginated<Papeleta>> {
    const scope = await this.policy.scopeFor(actor);
    if (scope.all) return this.papeletas.list(filters);

    if (filters.employeeId && !scope.employeeIds.includes(filters.employeeId)) {
      throw new ForbiddenError('No tiene acceso a las papeletas de ese empleado');
    }
    if (scope.employeeIds.length === 0) {
      return { data: [], meta: { total: 0, page: filters.page, limit: filters.limit, totalPages: 1 } };
    }
    return this.papeletas.list({ ...filters, employeeIds: scope.employeeIds });
  }
}

export class ObtenerPapeleta {
  constructor(
    private readonly papeletas: PapeletaRepository,
    private readonly policy: EmployeeAccessPolicy,
  ) {}

  async execute(actor: AccessActor, id: string): Promise<Papeleta> {
    const papeleta = await this.papeletas.findById(id);
    if (!papeleta) throw new NotFoundError('Papeleta');
    await this.policy.assertCanView(actor, papeleta.employeeId);
    return papeleta;
  }
}

export class AnularPapeleta {
  constructor(
    private readonly papeletas: PapeletaRepository,
    private readonly policy: EmployeeAccessPolicy,
  ) {}

  async execute(actor: AccessActor, id: string): Promise<Papeleta> {
    const papeleta = await this.papeletas.findById(id);
    if (!papeleta) throw new NotFoundError('Papeleta');

    const esPropia = papeleta.employeeId === actor.employeeId;
    if (!esPropia && !this.policy.isPrivileged(actor)) {
      throw new ForbiddenError('Solo puede anular sus propias papeletas');
    }
    if (papeleta.estado === 'APROBADA') {
      throw new ForbiddenError('Una papeleta aprobada no se anula desde aqui');
    }
    return this.papeletas.anular(id);
  }
}
