import { Router } from 'express';
import { asyncHandler } from '../../../../shared/infrastructure/http/middlewares/async-handler';
import { requireRole } from '../../../../shared/infrastructure/http/middlewares/require-role';
import { validate } from '../../../../shared/infrastructure/http/middlewares/validate';
import { PayslipController } from './payslip.controller';
import {
  aguinaldoQuerySchema,
  generatePayslipsSchema,
  issuePayslipsSchema,
  listPayslipsSchema,
  payslipIdParamSchema,
  periodQuerySchema,
} from './payslip.validators';

export function payslipRoutes(controller: PayslipController): Router {
  const router = Router();

  router.get(
    '/bulk-pdf',
    requireRole('HR', 'ADMIN'),
    validate(periodQuerySchema, 'query'),
    asyncHandler(controller.bulkPdf),
  );
  router.get(
    '/aguinaldo',
    requireRole('HR', 'ADMIN'),
    validate(aguinaldoQuerySchema, 'query'),
    asyncHandler(controller.aguinaldo),
  );

  router.get('/', validate(listPayslipsSchema, 'query'), asyncHandler(controller.list));
  router.post(
    '/generate',
    requireRole('HR', 'ADMIN'),
    validate(generatePayslipsSchema),
    asyncHandler(controller.generate),
  );
  router.post(
    '/issue',
    requireRole('HR', 'ADMIN'),
    validate(issuePayslipsSchema),
    asyncHandler(controller.issue),
  );

  // El control de propiedad de la boleta vive en el caso de uso, no aqui (8.2).
  router.get('/:id', validate(payslipIdParamSchema, 'params'), asyncHandler(controller.get));
  router.get('/:id/pdf', validate(payslipIdParamSchema, 'params'), asyncHandler(controller.pdf));
  router.post(
    '/:id/cancel',
    requireRole('HR', 'ADMIN'),
    validate(payslipIdParamSchema, 'params'),
    asyncHandler(controller.cancel),
  );

  return router;
}
