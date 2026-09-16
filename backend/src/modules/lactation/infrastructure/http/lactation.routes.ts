import { Router } from 'express';
import { asyncHandler } from '../../../../shared/infrastructure/http/middlewares/async-handler';
import { requireRole } from '../../../../shared/infrastructure/http/middlewares/require-role';
import { validate } from '../../../../shared/infrastructure/http/middlewares/validate';
import { LactationController } from './lactation.controller';
import {
  createLactationSchema,
  expiringQuerySchema,
  lactationIdParamSchema,
  listLactationSchema,
  updateLactationSchema,
} from './lactation.validators';

export function lactationRoutes(controller: LactationController): Router {
  const router = Router();

  router.get(
    '/expiring',
    requireRole('HR', 'ADMIN'),
    validate(expiringQuerySchema, 'query'),
    asyncHandler(controller.expiring),
  );
  router.get('/', validate(listLactationSchema, 'query'), asyncHandler(controller.list));
  router.post(
    '/',
    requireRole('HR', 'ADMIN'),
    validate(createLactationSchema),
    asyncHandler(controller.create),
  );
  router.patch(
    '/:id',
    requireRole('HR', 'ADMIN'),
    validate(lactationIdParamSchema, 'params'),
    validate(updateLactationSchema),
    asyncHandler(controller.update),
  );

  return router;
}
