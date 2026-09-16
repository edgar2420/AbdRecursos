import { AuditLoggerPort } from '../../../../shared/application/AuditLogger';
import { BusinessRuleError } from '../../../../shared/domain/errors';
import { AccessActor, EmployeeAccessPolicy } from '../../../employees/domain/services/EmployeeAccessPolicy';
import { PayslipPdfPort } from '../../../../shared/infrastructure/pdf/PayslipPdfGenerator';
import { ZipService } from '../../../../shared/infrastructure/storage/ZipService';
import { PayslipRepository } from '../../domain/repositories/PayslipRepository';
import { DownloadPayslipPdf } from './DownloadPayslipPdf';

/**
 * Descarga masiva en ZIP (2.3). Para nominas grandes esto deberia moverse a una
 * cola de trabajos (BullMQ) como indica la seccion 5.5; el limite evita bloquear
 * el request mientras tanto.
 */
const MAX_PAYSLIPS_PER_ZIP = 300;

export class BulkPayslipsZip {
  constructor(
    private readonly payslips: PayslipRepository,
    private readonly pdfBuilder: DownloadPayslipPdf,
    private readonly pdf: PayslipPdfPort,
    private readonly zip: ZipService,
    private readonly policy: EmployeeAccessPolicy,
    private readonly audit: AuditLoggerPort,
  ) {}

  async execute(
    actor: AccessActor,
    year: number,
    month: number,
  ): Promise<{ buffer: Buffer; fileName: string; count: number }> {
    this.policy.assertCanManage(actor);
    const payslips = await this.payslips.listByPeriod(year, month);
    if (payslips.length === 0) throw new BusinessRuleError('No hay boletas generadas para ese periodo');
    if (payslips.length > MAX_PAYSLIPS_PER_ZIP) {
      throw new BusinessRuleError(
        `El periodo tiene ${payslips.length} boletas; el maximo por descarga es ${MAX_PAYSLIPS_PER_ZIP}. Filtre por departamento.`,
      );
    }

    const entries = [];
    for (const payslip of payslips) {
      const view = await this.pdfBuilder.toView(payslip);
      entries.push({
        name: `boleta-${payslip.employeeCode}-${year}-${String(month).padStart(2, '0')}.pdf`,
        content: await this.pdf.render(view),
      });
    }

    await this.audit.log({
      userId: actor.userId,
      action: 'PAYSLIPS_BULK_DOWNLOADED',
      entity: 'Payslip',
      changes: { period: `${year}-${month}`, count: entries.length },
    });

    return {
      buffer: await this.zip.build(entries),
      fileName: `boletas-${year}-${String(month).padStart(2, '0')}.zip`,
      count: entries.length,
    };
  }
}
