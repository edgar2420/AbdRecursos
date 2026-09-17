import { Router } from 'express';
import { asyncHandler } from '../../../../shared/infrastructure/http/middlewares/async-handler';
import { requireRole } from '../../../../shared/infrastructure/http/middlewares/require-role';
import { validate } from '../../../../shared/infrastructure/http/middlewares/validate';
import { AuditController } from './audit.controller';
import { listAuditLogsSchema } from './audit.validators';

export function auditRoutes(controller: AuditController): Router {
  const router = Router();

  router.get('/', requireRole('ADMIN'), validate(listAuditLogsSchema, 'query'), asyncHandler(controller.list));

  return router;
}
