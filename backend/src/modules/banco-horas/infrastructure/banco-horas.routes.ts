import { Response, Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../../shared/infrastructure/http/middlewares/async-handler';
import { requireRole } from '../../../shared/infrastructure/http/middlewares/require-role';
import { validate, validated } from '../../../shared/infrastructure/http/middlewares/validate';
import { AuthenticatedRequest, requireActor } from '../../../shared/infrastructure/http/types';
import { ConsultarBancoHoras, RegistrarAjusteBanco } from '../application/BancoHoras';

const saldosSchema = z.object({
  ids: z
    .string()
    .transform((v) => v.split(',').map((x) => x.trim()).filter(Boolean))
    .pipe(z.array(z.string().uuid()).max(500)),
});
const empleadoSchema = z.object({ employeeId: z.string().uuid() });
const ajusteSchema = z.object({
  minutos: z.coerce.number().int().min(-100000).max(100000),
  motivo: z.string().trim().min(5, 'Indique el motivo del ajuste').max(300),
});

export function bancoHorasRoutes(consultar: ConsultarBancoHoras, ajustar: RegistrarAjusteBanco): Router {
  const router = Router();

  router.get(
    '/saldos',
    validate(saldosSchema, 'query'),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const { ids } = validated<z.infer<typeof saldosSchema>>(req, 'query');
      res.json({ data: await consultar.saldos(requireActor(req), ids) });
    }),
  );

  router.get(
    '/:employeeId',
    validate(empleadoSchema, 'params'),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      res.json({ data: await consultar.detalle(requireActor(req), req.params.employeeId) });
    }),
  );

  router.post(
    '/:employeeId/ajustes',
    requireRole('HR', 'ADMIN'),
    validate(empleadoSchema, 'params'),
    validate(ajusteSchema),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const { minutos, motivo } = validated<z.infer<typeof ajusteSchema>>(req, 'body');
      res.status(201).json({ data: await ajustar.execute(requireActor(req), req.params.employeeId, minutos, motivo) });
    }),
  );

  return router;
}
