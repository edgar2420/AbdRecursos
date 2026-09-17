import { Router } from 'express';
import { asyncHandler } from '../../../../shared/infrastructure/http/middlewares/async-handler';
import { requireRole } from '../../../../shared/infrastructure/http/middlewares/require-role';
import { uploadExcel } from '../../../../shared/infrastructure/http/middlewares/upload';
import { validate } from '../../../../shared/infrastructure/http/middlewares/validate';
import { ImportController } from './import.controller';
import {
  importIdParamSchema,
  listImportsSchema,
  templateQuerySchema,
  uploadImportSchema,
} from './import.validators';

export function importRoutes(controller: ImportController): Router {
  const router = Router();
  router.use(requireRole('HR', 'ADMIN'));

  router.get('/template', validate(templateQuerySchema, 'query'), asyncHandler(controller.template));
  router.get('/', validate(listImportsSchema, 'query'), asyncHandler(controller.list));
  router.post(
    '/',
    uploadExcel.single('file'),
    validate(uploadImportSchema),
    asyncHandler(controller.upload),
  );
  router.get('/:id', validate(importIdParamSchema, 'params'), asyncHandler(controller.preview));
  router.post('/:id/confirm', validate(importIdParamSchema, 'params'), asyncHandler(controller.confirm));
  router.get('/:id/log', validate(importIdParamSchema, 'params'), asyncHandler(controller.log));

  return router;
}
