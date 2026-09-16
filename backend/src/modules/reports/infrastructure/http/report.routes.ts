import { Router } from 'express';
import { asyncHandler } from '../../../../shared/infrastructure/http/middlewares/async-handler';
import { requireRole } from '../../../../shared/infrastructure/http/middlewares/require-role';
import { validate } from '../../../../shared/infrastructure/http/middlewares/validate';
import { ReportController } from './report.controller';
import { dashboardQuerySchema, payrollQuerySchema } from './report.validators';

export function reportRoutes(controller: ReportController): Router {
  const router = Router();

  // El alcance (empresa o equipo) lo resuelve el caso de uso segun el rol.
  router.get('/dashboard', validate(dashboardQuerySchema, 'query'), asyncHandler(controller.dashboard));
  router.get('/headcount', requireRole('SUPERVISOR', 'HR', 'ADMIN'), asyncHandler(controller.headcount));
  router.get(
    '/payroll',
    requireRole('HR', 'ADMIN'),
    validate(payrollQuerySchema, 'query'),
    asyncHandler(controller.payroll),
  );

  return router;
}
