import { Response } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest, requireActor } from '../../../../shared/infrastructure/http/types';
import { validated } from '../../../../shared/infrastructure/http/middlewares/validate';
import {
  GetExpiringLactationPermits,
  ListLactationPermits,
  RegisterLactationPermit,
  UpdateLactationPermit,
} from '../../application/use-cases/ManageLactationPermits';
import { expiringQuerySchema, listLactationSchema } from './lactation.validators';

export class LactationController {
  constructor(
    private readonly listUseCase: ListLactationPermits,
    private readonly registerUseCase: RegisterLactationPermit,
    private readonly updateUseCase: UpdateLactationPermit,
    private readonly expiringUseCase: GetExpiringLactationPermits,
  ) {}

  list = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const query = validated<z.infer<typeof listLactationSchema>>(req, 'query');
    res.json(await this.listUseCase.execute(requireActor(req), query));
  };

  create = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    res.status(201).json({ data: await this.registerUseCase.execute(requireActor(req), req.body) });
  };

  update = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    res.json({ data: await this.updateUseCase.execute(requireActor(req), req.params.id, req.body) });
  };

  expiring = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { days } = validated<z.infer<typeof expiringQuerySchema>>(req, 'query');
    res.json({ data: await this.expiringUseCase.execute(requireActor(req), days) });
  };
}
