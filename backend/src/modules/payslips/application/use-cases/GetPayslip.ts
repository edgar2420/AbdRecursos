import { ForbiddenError, NotFoundError } from '../../../../shared/domain/errors';
import { Paginated } from '../../../../shared/domain/pagination';
import { AccessActor, EmployeeAccessPolicy } from '../../../employees/domain/services/EmployeeAccessPolicy';
import { Payslip } from '../../domain/entities/Payslip';
import { PayslipFilters, PayslipRepository } from '../../domain/repositories/PayslipRepository';

export class GetPayslip {
  constructor(
    private readonly payslips: PayslipRepository,
    private readonly policy: EmployeeAccessPolicy,
  ) {}

  async execute(actor: AccessActor, id: string): Promise<Payslip> {
    const payslip = await this.payslips.findById(id);
    if (!payslip) throw new NotFoundError('Boleta de pago');

    if (this.policy.isPrivileged(actor)) return payslip;
    if (this.policy.isSelf(actor, payslip.employeeId)) {
      if (payslip.status === 'DRAFT') throw new NotFoundError('Boleta de pago');
      return payslip;
    }
    throw new ForbiddenError('Solo puede consultar sus propias boletas');
  }
}

export class ListPayslips {
  constructor(
    private readonly payslips: PayslipRepository,
    private readonly policy: EmployeeAccessPolicy,
  ) {}

  async execute(actor: AccessActor, filters: PayslipFilters): Promise<Paginated<Payslip>> {
    if (this.policy.isPrivileged(actor)) return this.payslips.list(filters);
    if (!actor.employeeId) {
      return { data: [], meta: { total: 0, page: filters.page, limit: filters.limit, totalPages: 1 } };
    }
    return this.payslips.list({
      ...filters,
      employeeId: actor.employeeId,
      employeeIds: undefined,
      status: filters.status === 'DRAFT' ? undefined : filters.status,
      excludeDraft: true,
    });
  }
}
