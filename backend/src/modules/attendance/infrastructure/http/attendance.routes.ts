import { Router } from 'express';
import { asyncHandler } from '../../../../shared/infrastructure/http/middlewares/async-handler';
import { requireRole } from '../../../../shared/infrastructure/http/middlewares/require-role';
import { validate } from '../../../../shared/infrastructure/http/middlewares/validate';
import { AttendanceController } from './attendance.controller';
import {
  attendanceIdParamSchema,
  createJustificationSchema,
  listAttendanceSchema,
  listJustificationsSchema,
  punchSchema,
  reportQuerySchema,
  reviewJustificationSchema,
  updateAttendanceSchema,
} from './attendance.validators';

export function attendanceRoutes(controller: AttendanceController): Router {
  const router = Router();

  router.post('/check-in', validate(punchSchema), asyncHandler(controller.checkIn));
  router.post('/check-out', validate(punchSchema), asyncHandler(controller.checkOut));
  router.get('/report', validate(reportQuerySchema, 'query'), asyncHandler(controller.report));

  router.patch(
    '/:id',
    requireRole('HR', 'ADMIN'),
    validate(attendanceIdParamSchema, 'params'),
    validate(updateAttendanceSchema),
    asyncHandler(controller.update),
  );

  router.get(
    '/justifications',
    validate(listJustificationsSchema, 'query'),
    asyncHandler(controller.listJustifications),
  );
  router.post(
    '/justifications',
    validate(createJustificationSchema),
    asyncHandler(controller.createJustification),
  );
  router.patch(
    '/justifications/:id/review',
    requireRole('SUPERVISOR', 'HR', 'ADMIN'),
    validate(attendanceIdParamSchema, 'params'),
    validate(reviewJustificationSchema),
    asyncHandler(controller.reviewJustification),
  );

  router.get('/', validate(listAttendanceSchema, 'query'), asyncHandler(controller.list));

  return router;
}
