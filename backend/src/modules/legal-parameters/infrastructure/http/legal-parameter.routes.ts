import { Router } from 'express';
import { asyncHandler } from '../../../../shared/infrastructure/http/middlewares/async-handler';
import { requireRole } from '../../../../shared/infrastructure/http/middlewares/require-role';
import { validate } from '../../../../shared/infrastructure/http/middlewares/validate';
import { LegalParameterController } from './legal-parameter.controller';
import {
  createLegalParameterSchema,
  idParamSchema,
  listLegalParametersSchema,
  updateLegalParameterSchema,
} from './legal-parameter.validators';

export function legalParameterRoutes(controller: LegalParameterController): Router {
  const router = Router();

  router.get('/effective', asyncHandler(controller.effective));
  router.get(
    '/',
    requireRole('HR', 'ADMIN'),
    validate(listLegalParametersSchema, 'query'),
    asyncHandler(controller.list),
  );
  router.post(
    '/',
    requireRole('HR', 'ADMIN'),
    validate(createLegalParameterSchema),
    asyncHandler(controller.create),
  );
  router.patch(
    '/:id',
    requireRole('HR', 'ADMIN'),
    validate(idParamSchema, 'params'),
    validate(updateLegalParameterSchema),
    asyncHandler(controller.update),
  );

  return router;
}
