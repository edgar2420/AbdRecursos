import { Response } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest, requireActor } from '../../../../shared/infrastructure/http/types';
import { validated } from '../../../../shared/infrastructure/http/middlewares/validate';
import {
  AssignSchedule,
  CreateSchedule,
  EndScheduleAssignment,
  ListScheduleAssignments,
  ListSchedules,
  UpdateSchedule,
} from '../../application/use-cases/ManageSchedules';
import { listAssignmentsSchema, listSchedulesSchema } from './schedule.validators';

export class ScheduleController {
  constructor(
    private readonly listUseCase: ListSchedules,
    private readonly createUseCase: CreateSchedule,
    private readonly updateUseCase: UpdateSchedule,
    private readonly assignUseCase: AssignSchedule,
    private readonly listAssignmentsUseCase: ListScheduleAssignments,
    private readonly endAssignmentUseCase: EndScheduleAssignment,
  ) {}

  list = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const query = validated<z.infer<typeof listSchedulesSchema>>(req, 'query');
    res.json(await this.listUseCase.execute(query));
  };

  create = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    res.status(201).json({ data: await this.createUseCase.execute(requireActor(req), req.body) });
  };

  update = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    res.json({ data: await this.updateUseCase.execute(requireActor(req), req.params.id, req.body) });
  };

  listAssignments = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const query = validated<z.infer<typeof listAssignmentsSchema>>(req, 'query');
    res.json(await this.listAssignmentsUseCase.execute(requireActor(req), query));
  };

  assign = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    res.status(201).json({ data: await this.assignUseCase.execute(requireActor(req), req.body) });
  };

  endAssignment = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const data = await this.endAssignmentUseCase.execute(
      requireActor(req),
      req.params.id,
      req.body.validUntil,
    );
    res.json({ data });
  };
}
