import { Router } from 'express';
import { requireRole } from '../../../../shared/infrastructure/http/middlewares/require-role';
import { IclockServer } from './IclockServer';

/** Estado del receptor directo del reloj, para la pantalla de administracion. */
export function iclockRoutes(servidor: IclockServer | null): Router {
  const router = Router();
  router.use(requireRole('HR', 'ADMIN'));
  router.get('/estado', (_req, res) => {
    res.json({ data: servidor ? { configurado: true, ...servidor.estado() } : { configurado: false } });
  });
  return router;
}
