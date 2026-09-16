import { Router } from 'express';
import { asyncHandler } from '../../../../shared/infrastructure/http/middlewares/async-handler';
import { requireRole } from '../../../../shared/infrastructure/http/middlewares/require-role';
import { validate } from '../../../../shared/infrastructure/http/middlewares/validate';
import { VacationController } from './vacation.controller';
import {
  balanceQuerySchema,
  calendarQuerySchema,
  createVacationSchema,
  employeeIdParamSchema,
  listVacationsSchema,
  rejectVacationSchema,
  vacationIdParamSchema,
} from './vacation.validators';

export function vacationRoutes(controller: VacationController): Router {
  const router = Router();

  router.get('/calendar', validate(calendarQuerySchema, 'query'), asyncHandler(controller.calendar));
  router.get('/balance/me', validate(balanceQuerySchema, 'query'), asyncHandler(controller.myBalance));
  router.get(
    '/balance/:employeeId',
    validate(employeeIdParamSchema, 'params'),
    validate(balanceQuerySchema, 'query'),
    asyncHandler(controller.balance),
  );

  router.get('/requests', validate(listVacationsSchema, 'query'), asyncHandler(controller.list));
  router.post('/requests', validate(createVacationSchema), asyncHandler(controller.create));
  router.get('/requests/:id', validate(vacationIdParamSchema, 'params'), asyncHandler(controller.get));

  // La verificacion fina (supervisor del equipo / RRHH) ocurre dentro del caso de uso.
  router.post(
    '/requests/:id/approve',
    requireRole('SUPERVISOR', 'HR', 'ADMIN'),
    validate(vacationIdParamSchema, 'params'),
    asyncHandler(controller.approve),
  );
  router.post(
    '/requests/:id/reject',
    requireRole('SUPERVISOR', 'HR', 'ADMIN'),
    validate(vacationIdParamSchema, 'params'),
    validate(rejectVacationSchema),
    asyncHandler(controller.reject),
  );
  router.post(
    '/requests/:id/cancel',
    validate(vacationIdParamSchema, 'params'),
    asyncHandler(controller.cancel),
  );

  return router;
}
