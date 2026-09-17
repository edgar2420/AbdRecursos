import { Response } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest, requireActor } from '../../../../shared/infrastructure/http/types';
import { validated } from '../../../../shared/infrastructure/http/middlewares/validate';
import { ListAuditLogs } from '../../application/use-cases/ListAuditLogs';
import { listAuditLogsSchema } from './audit.validators';

export class AuditController {
  constructor(private readonly listUseCase: ListAuditLogs) {}

  list = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const query = validated<z.infer<typeof listAuditLogsSchema>>(req, 'query');
    res.json(await this.listUseCase.execute(requireActor(req), query));
  };
}
