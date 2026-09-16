import { AuditLoggerPort } from '../../../../shared/application/AuditLogger';
import { NotFoundError } from '../../../../shared/domain/errors';
import { EmployeeRepository } from '../../../employees/domain/repositories/EmployeeRepository';
import { AccessActor } from '../../../employees/domain/services/EmployeeAccessPolicy';
import { PayslipPdfPort, PayslipView } from '../../../../shared/infrastructure/pdf/PayslipPdfGenerator';
import { Payslip } from '../../domain/entities/Payslip';
import { GetPayslip } from './GetPayslip';

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export class DownloadPayslipPdf {
  constructor(
    private readonly getPayslip: GetPayslip,
    private readonly employees: EmployeeRepository,
    private readonly pdf: PayslipPdfPort,
    private readonly audit: AuditLoggerPort,
  ) {}

  async execute(actor: AccessActor, id: string): Promise<{ buffer: Buffer; fileName: string }> {
    const payslip = await this.getPayslip.execute(actor, id);
    const buffer = await this.pdf.render(await this.toView(payslip));

    await this.audit.log({
      userId: actor.userId,
      action: 'PAYSLIP_DOWNLOADED',
      entity: 'Payslip',
      entityId: id,
    });
    const period = `${payslip.periodYear}-${String(payslip.periodMonth).padStart(2, '0')}`;
    return { buffer, fileName: `boleta-${payslip.employeeCode}-${period}.pdf` };
  }

  async toView(payslip: Payslip): Promise<PayslipView> {
    const employee = await this.employees.findById(payslip.employeeId);
    if (!employee) throw new NotFoundError('Empleado');
    return {
      periodLabel: `${MONTHS[payslip.periodMonth - 1]} ${payslip.periodYear}`,
      employee: {
        fullName: employee.fullName,
        ci: `${employee.ci}${employee.ciExtension ? ' ' + employee.ciExtension : ''}`,
        employeeCode: employee.employeeCode,
        position: employee.positionName ?? '-',
        department: employee.departmentName ?? '-',
        hireDate: employee.hireDate.toLocaleDateString('es-BO'),
        afpName: employee.afpName ?? '-',
        bankAccount: employee.bankAccount ?? '-',
      },
      workedDays: payslip.workedDays,
      earnings: payslip.details
        .filter((d) => d.type === 'EARNING')
        .map((d) => ({ concept: d.concept, quantity: d.quantity, amount: d.amount })),
      deductions: payslip.details
        .filter((d) => d.type === 'DEDUCTION')
        .map((d) => ({ concept: d.concept, quantity: d.quantity, amount: d.amount })),
      totalEarnings: payslip.totalEarnings,
      totalDeductions: payslip.totalDeductions,
      netPay: payslip.netPay,
    };
  }
}
