import { Response } from 'express';
import { z } from 'zod';
import { ForbiddenError } from '../../../../shared/domain/errors';
import { AuthenticatedRequest, requireActor } from '../../../../shared/infrastructure/http/types';
import { validated } from '../../../../shared/infrastructure/http/middlewares/validate';
import { RequestVacation } from '../../application/use-cases/RequestVacation';
import { ApproveVacation } from '../../application/use-cases/ApproveVacation';
import { CancelVacation, RejectVacation } from '../../application/use-cases/RejectVacation';
import { GetVacationRequest, ListVacationRequests } from '../../application/use-cases/ListVacationRequests';
import { GetVacationBalance } from '../../application/use-cases/GetVacationBalance';
import { GetTeamCalendar } from '../../application/use-cases/GetTeamCalendar';
import { listVacationsSchema, calendarQuerySchema, balanceQuerySchema } from './vacation.validators';

export class VacationController {
  constructor(
    private readonly requestUseCase: RequestVacation,
    private readonly approveUseCase: ApproveVacation,
    private readonly rejectUseCase: RejectVacation,
    private readonly cancelUseCase: CancelVacation,
    private readonly listUseCase: ListVacationRequests,
    private readonly getUseCase: GetVacationRequest,
    private readonly balanceUseCase: GetVacationBalance,
    private readonly calendarUseCase: GetTeamCalendar,
  ) {}

  list = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const query = validated<z.infer<typeof listVacationsSchema>>(req, 'query');
    res.json(await this.listUseCase.execute(requireActor(req), query));
  };

  get = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    res.json({ data: await this.getUseCase.execute(requireActor(req), req.params.id) });
  };

  create = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const created = await this.requestUseCase.execute(requireActor(req), req.body);
    res.status(201).json({ data: created });
  };

  approve = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const data = await this.approveUseCase.execute(requireActor(req), req.params.id, req.body?.reason);
    res.json({ data });
  };

  reject = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    res.json({ data: await this.rejectUseCase.execute(requireActor(req), req.params.id, req.body.reason) });
  };

  cancel = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    res.json({ data: await this.cancelUseCase.execute(requireActor(req), req.params.id) });
  };

  balance = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const actor = requireActor(req);
    const { year } = validated<z.infer<typeof balanceQuerySchema>>(req, 'query');
    res.json({ data: await this.balanceUseCase.execute(actor, req.params.employeeId, year) });
  };

  myBalance = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const actor = requireActor(req);
    if (!actor.employeeId) throw new ForbiddenError('Su usuario no esta vinculado a un empleado');
    const { year } = validated<z.infer<typeof balanceQuerySchema>>(req, 'query');
    res.json({ data: await this.balanceUseCase.execute(actor, actor.employeeId, year) });
  };

  calendar = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { from, to } = validated<z.infer<typeof calendarQuerySchema>>(req, 'query');
    res.json({ data: await this.calendarUseCase.execute(requireActor(req), from, to) });
  };
}
