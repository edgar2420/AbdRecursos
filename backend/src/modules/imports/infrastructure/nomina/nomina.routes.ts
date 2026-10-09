import { Response, Router } from 'express';
import multer from 'multer';
import { env } from '../../../../shared/infrastructure/config/env';
import { ValidationError } from '../../../../shared/domain/errors';
import { asyncHandler } from '../../../../shared/infrastructure/http/middlewares/async-handler';
import { requireRole } from '../../../../shared/infrastructure/http/middlewares/require-role';
import { AuthenticatedRequest, requireActor } from '../../../../shared/infrastructure/http/types';
import { ArchivoNomina, NominaBiometrico } from '../../application/NominaBiometrico';

const subirNomina = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.UPLOAD_MAX_MB * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!/\.(xlsx|csv)$/i.test(file.originalname)) {
      cb(new ValidationError('Suba la nomina en Excel (.xlsx) o .csv'));
      return;
    }
    cb(null, true);
  },
});

function archivo(req: AuthenticatedRequest): ArchivoNomina {
  if (!req.file) throw new ValidationError('Adjunte el archivo de la nomina');
  return { contenido: req.file.buffer, nombre: req.file.originalname };
}

export function nominaRoutes(nomina: NominaBiometrico): Router {
  const router = Router();
  router.use(requireRole('HR', 'ADMIN'));

  router.post(
    '/revisar',
    subirNomina.single('file'),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      res.json({ data: await nomina.revisar(requireActor(req), archivo(req)) });
    }),
  );

  router.post(
    '/aplicar',
    subirNomina.single('file'),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      res.json({ data: await nomina.aplicar(requireActor(req), archivo(req)) });
    }),
  );

  return router;
}
