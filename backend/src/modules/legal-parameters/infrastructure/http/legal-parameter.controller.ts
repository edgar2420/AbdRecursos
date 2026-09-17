import { Response } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest, requireActor } from '../../../../shared/infrastructure/http/types';
import { validated } from '../../../../shared/infrastructure/http/middlewares/validate';
import { GetLegalParameters } from '../../application/use-cases/GetLegalParameters';
import {
  CreateLegalParameterVersion,
  ListLegalParameters,
  UpdateLegalParameter,
} from '../../application/use-cases/ManageLegalParameters';
import { listLegalParametersSchema, createLegalParameterSchema } from './legal-parameter.validators';

export class LegalParameterController {
  constructor(
    private readonly listUseCase: ListLegalParameters,
    private readonly createUseCase: CreateLegalParameterVersion,
    private readonly updateUseCase: UpdateLegalParameter,
    private readonly getParameters: GetLegalParameters,
  ) {}

  list = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const query = validated<z.infer<typeof listLegalParametersSchema>>(req, 'query');
    res.json(await this.listUseCase.execute(query));
  };

  effective = async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
    const set = await this.getParameters.execute(new Date());
    res.json({ data: set.snapshot(), meta: { effectiveAt: set.effectiveAt } });
  };

  create = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const body = req.body as z.infer<typeof createLegalParameterSchema>;
    const created = await this.createUseCase.execute(body, actor.userId);
    res.status(201).json({ data: created });
  };

  update = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const updated = await this.updateUseCase.execute(req.params.id, req.body, actor.userId);
    res.json({ data: updated });
  };
}
