import { Response } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest, requireActor } from '../../../../shared/infrastructure/http/types';
import { validated } from '../../../../shared/infrastructure/http/middlewares/validate';
import { GeneratePayslips } from '../../application/use-cases/GeneratePayslips';
import { GetPayslip, ListPayslips } from '../../application/use-cases/GetPayslip';
import { DownloadPayslipPdf } from '../../application/use-cases/DownloadPayslipPdf';
import { BulkPayslipsZip } from '../../application/use-cases/BulkPayslipsZip';
import { CancelPayslip, IssuePayslips } from '../../application/use-cases/IssuePayslips';
import { CalculateAguinaldo } from '../../application/use-cases/CalculateAguinaldo';
import { aguinaldoQuerySchema, listPayslipsSchema, periodQuerySchema } from './payslip.validators';

export class PayslipController {
  constructor(
    private readonly generateUseCase: GeneratePayslips,
    private readonly getUseCase: GetPayslip,
    private readonly listUseCase: ListPayslips,
    private readonly pdfUseCase: DownloadPayslipPdf,
    private readonly zipUseCase: BulkPayslipsZip,
    private readonly issueUseCase: IssuePayslips,
    private readonly cancelUseCase: CancelPayslip,
    private readonly aguinaldoUseCase: CalculateAguinaldo,
  ) {}

  list = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const query = validated<z.infer<typeof listPayslipsSchema>>(req, 'query');
    res.json(await this.listUseCase.execute(requireActor(req), query));
  };

  get = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    res.json({ data: await this.getUseCase.execute(requireActor(req), req.params.id) });
  };

  generate = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const result = await this.generateUseCase.execute(requireActor(req), req.body);
    res.status(201).json({ data: result.generated, meta: { skipped: result.skipped } });
  };

  pdf = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { buffer, fileName } = await this.pdfUseCase.execute(requireActor(req), req.params.id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(buffer);
  };

  bulkPdf = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { periodYear, periodMonth } = validated<z.infer<typeof periodQuerySchema>>(req, 'query');
    const result = await this.zipUseCase.execute(requireActor(req), periodYear, periodMonth);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${result.fileName}"`);
    res.setHeader('X-Payslip-Count', String(result.count));
    res.send(result.buffer);
  };

  issue = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    res.json({ data: await this.issueUseCase.execute(requireActor(req), req.body.ids) });
  };

  cancel = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    res.json({ data: await this.cancelUseCase.execute(requireActor(req), req.params.id) });
  };

  aguinaldo = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { year, employeeId } = validated<z.infer<typeof aguinaldoQuerySchema>>(req, 'query');
    res.json({ data: await this.aguinaldoUseCase.execute(requireActor(req), year, employeeId) });
  };
}
