import { Router } from 'express';
import { asyncHandler } from '../../../../shared/infrastructure/http/middlewares/async-handler';
import { requireRole } from '../../../../shared/infrastructure/http/middlewares/require-role';
import { validate } from '../../../../shared/infrastructure/http/middlewares/validate';
import { ScheduleController } from './schedule.controller';
import {
  assignScheduleSchema,
  createScheduleSchema,
  endAssignmentSchema,
  listAssignmentsSchema,
  listSchedulesSchema,
  scheduleIdParamSchema,
  updateScheduleSchema,
} from './schedule.validators';

export function scheduleRoutes(controller: ScheduleController): Router {
  const router = Router();

  router.get('/assignments', validate(listAssignmentsSchema, 'query'), asyncHandler(controller.listAssignments));
  router.post(
    '/assignments',
    requireRole('HR', 'ADMIN'),
    validate(assignScheduleSchema),
    asyncHandler(controller.assign),
  );
  router.patch(
    '/assignments/:id/end',
    requireRole('HR', 'ADMIN'),
    validate(scheduleIdParamSchema, 'params'),
    validate(endAssignmentSchema),
    asyncHandler(controller.endAssignment),
  );

  router.get('/', validate(listSchedulesSchema, 'query'), asyncHandler(controller.list));
  router.post('/', requireRole('HR', 'ADMIN'), validate(createScheduleSchema), asyncHandler(controller.create));
  router.patch(
    '/:id',
    requireRole('HR', 'ADMIN'),
    validate(scheduleIdParamSchema, 'params'),
    validate(updateScheduleSchema),
    asyncHandler(controller.update),
  );

  return router;
}
