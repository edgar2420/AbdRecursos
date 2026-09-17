import { AuditLoggerPort } from '../../../../shared/application/AuditLogger';
import { BusinessRuleError } from '../../../../shared/domain/errors';
import { AccessActor, EmployeeAccessPolicy } from '../../../employees/domain/services/EmployeeAccessPolicy';
import { PayslipRepository } from '../../domain/repositories/PayslipRepository';

export class IssuePayslips {
  constructor(
    private readonly payslips: PayslipRepository,
    private readonly policy: EmployeeAccessPolicy,
    private readonly audit: AuditLoggerPort,
  ) {}

  async execute(actor: AccessActor, ids: string[]): Promise<{ issued: number }> {
    this.policy.assertCanManage(actor);
    if (ids.length === 0) throw new BusinessRuleError('Seleccione al menos una boleta');
    const issued = await this.payslips.issue(ids, actor.userId);
    await this.audit.log({
      userId: actor.userId,
      action: 'PAYSLIPS_ISSUED',
      entity: 'Payslip',
      changes: { count: issued, ids },
    });
    return { issued };
  }
}

export class CancelPayslip {
  constructor(
    private readonly payslips: PayslipRepository,
    private readonly policy: EmployeeAccessPolicy,
    private readonly audit: AuditLoggerPort,
  ) {}

  async execute(actor: AccessActor, id: string) {
    this.policy.assertCanManage(actor);
    const cancelled = await this.payslips.cancel(id);
    await this.audit.log({
      userId: actor.userId,
      action: 'PAYSLIP_CANCELLED',
      entity: 'Payslip',
      entityId: id,
    });
    return cancelled;
  }
}
