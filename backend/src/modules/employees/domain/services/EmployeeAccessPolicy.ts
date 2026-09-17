import { ForbiddenError } from '../../../../shared/domain/errors';
import { EmployeeRepository } from '../repositories/EmployeeRepository';

export interface AccessActor {
  userId: string;
  role: 'EMPLOYEE' | 'SUPERVISOR' | 'HR' | 'ADMIN';
  employeeId: string | null;
}

export class EmployeeAccessPolicy {
  constructor(private readonly employees: EmployeeRepository) {}

  isPrivileged(actor: AccessActor): boolean {
    return actor.role === 'HR' || actor.role === 'ADMIN';
  }

  isSelf(actor: AccessActor, employeeId: string): boolean {
    return actor.employeeId !== null && actor.employeeId === employeeId;
  }

  async canView(actor: AccessActor, employeeId: string): Promise<boolean> {
    if (this.isPrivileged(actor)) return true;
    if (this.isSelf(actor, employeeId)) return true;
    if (actor.role === 'SUPERVISOR' && actor.employeeId) {
      return this.employees.isSupervisorOf(actor.employeeId, employeeId);
    }
    return false;
  }

  async assertCanView(actor: AccessActor, employeeId: string): Promise<void> {
    if (!(await this.canView(actor, employeeId))) {
      throw new ForbiddenError('No tiene permisos sobre este empleado');
    }
  }

  assertCanManage(actor: AccessActor): void {
    if (!this.isPrivileged(actor)) {
      throw new ForbiddenError('Solo RRHH o Administracion pueden modificar empleados');
    }
  }

  async scopeFor(actor: AccessActor): Promise<{ all: boolean; employeeIds: string[] }> {
    if (this.isPrivileged(actor)) return { all: true, employeeIds: [] };
    if (actor.role === 'SUPERVISOR' && actor.employeeId) {
      const team = await this.employees.listTeamIds(actor.employeeId);
      return { all: false, employeeIds: [...new Set([...team, actor.employeeId])] };
    }
    return { all: false, employeeIds: actor.employeeId ? [actor.employeeId] : [] };
  }
}
