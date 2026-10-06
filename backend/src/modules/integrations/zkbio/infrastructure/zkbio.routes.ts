import { Response, Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../../../shared/infrastructure/http/middlewares/async-handler';
import { requireRole } from '../../../../shared/infrastructure/http/middlewares/require-role';
import { validate, validated } from '../../../../shared/infrastructure/http/middlewares/validate';
import { fechaLocal } from '../../../../shared/infrastructure/http/fecha-local';
import { AuthenticatedRequest, requireActor } from '../../../../shared/infrastructure/http/types';
import { addDays } from '../../../../shared/domain/dates';
import { ZkBioSync } from './ZkBioSync';

const syncMarcacionesSchema = z.object({
  desde: fechaLocal.optional(),
  hasta: fechaLocal.optional(),
});

export function zkbioRoutes(sync: ZkBioSync | null): Router {
  const router = Router();
  router.use(requireRole('HR', 'ADMIN'));

  router.get('/estado', (_req, res) => {
    res.json({ data: { configurado: sync !== null } });
  });

  router.post(
    '/personal',
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      if (!sync) {
        res.status(503).json({ error: { code: 'ZKBIO_NOT_CONFIGURED', message: 'ZKBio Time no esta configurado en el servidor' } });
        return;
      }
      res.json({ data: await sync.sincronizarPersonal(requireActor(req).userId) });
    }),
  );

  router.post(
    '/marcaciones',
    validate(syncMarcacionesSchema),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      if (!sync) {
        res.status(503).json({ error: { code: 'ZKBIO_NOT_CONFIGURED', message: 'ZKBio Time no esta configurado en el servidor' } });
        return;
      }
      const { desde, hasta } = validated<z.infer<typeof syncMarcacionesSchema>>(req, 'body');
      const resultado = await sync.sincronizarMarcaciones(
        { desde, hasta: hasta ? addDays(hasta, 1) : undefined },
        requireActor(req).userId,
      );
      if (!resultado) {
        res.status(409).json({ error: { code: 'ZKBIO_SYNC_RUNNING', message: 'Ya hay una sincronizacion en curso, intente en unos segundos' } });
        return;
      }
      res.json({ data: resultado });
    }),
  );

  return router;
}
