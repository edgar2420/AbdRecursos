import { Router } from 'express';
import { asyncHandler } from '../../../../shared/infrastructure/http/middlewares/async-handler';
import { requireRole } from '../../../../shared/infrastructure/http/middlewares/require-role';
import { validate } from '../../../../shared/infrastructure/http/middlewares/validate';
import { PapeletaController } from './papeleta.controller';
import {
  crearHorasExtrasSchema,
  crearSalidaSchema,
  listPapeletasSchema,
  papeletaIdParamSchema,
  rechazarSchema,
} from './papeleta.validators';

export function papeletaRoutes(controller: PapeletaController): Router {
  const router = Router();

  router.get('/', validate(listPapeletasSchema, 'query'), asyncHandler(controller.list));
  router.post('/horas-extras', validate(crearHorasExtrasSchema), asyncHandler(controller.crearHorasExtras));
  router.post('/salidas', validate(crearSalidaSchema), asyncHandler(controller.crearSalida));

  router.get('/:id', validate(papeletaIdParamSchema, 'params'), asyncHandler(controller.get));
  router.get('/:id/pdf', validate(papeletaIdParamSchema, 'params'), asyncHandler(controller.descargarPdf));

  router.post(
    '/:id/firmar',
    requireRole('SUPERVISOR', 'HR', 'ADMIN'),
    validate(papeletaIdParamSchema, 'params'),
    asyncHandler(controller.firmarPapeleta),
  );
  router.post(
    '/:id/rechazar',
    requireRole('SUPERVISOR', 'HR', 'ADMIN'),
    validate(papeletaIdParamSchema, 'params'),
    validate(rechazarSchema),
    asyncHandler(controller.rechazarPapeleta),
  );
  router.post('/:id/anular', validate(papeletaIdParamSchema, 'params'), asyncHandler(controller.anularPapeleta));

  return router;
}
