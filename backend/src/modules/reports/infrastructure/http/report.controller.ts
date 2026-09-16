import { Response } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest, requireActor } from '../../../../shared/infrastructure/http/types';
import { validated } from '../../../../shared/infrastructure/http/middlewares/validate';
import { GetDashboard } from '../../application/use-cases/GetDashboard';
import { GetHeadcountReport, GetPayrollReport } from '../../application/use-cases/GetReports';
import { dashboardQuerySchema, payrollQuerySchema } from './report.validators';

export class ReportController {
  constructor(
    private readonly dashboardUseCase: GetDashboard,
    private readonly headcountUseCase: GetHeadcountReport,
    private readonly payrollUseCase: GetPayrollReport,
  ) {}

  dashboard = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const query = validated<z.infer<typeof dashboardQuerySchema>>(req, 'query');
    const now = new Date();
    const from = query.from ?? new Date(now.getFullYear(), now.getMonth(), 1);
    const to = query.to ?? now;
    const data = await this.dashboardUseCase.execute(requireActor(req), {
      from,
      to,
      departmentId: query.departmentId,
    });
    res.json({ data });
  };

  headcount = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    res.json({ data: await this.headcountUseCase.execute(requireActor(req)) });
  };

  payroll = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { year } = validated<z.infer<typeof payrollQuerySchema>>(req, 'query');
    res.json({ data: await this.payrollUseCase.execute(requireActor(req), year) });
  };
}
