import { Request, Response, Router } from 'express';
import { EventosPostgres } from './EventosPostgres';

const LATIDO_MS = 25_000;

/**
 * Canal de avisos (Server-Sent Events). La pantalla mantiene la conexion abierta y recibe
 * "event: marcaciones" cuando algo cambia; entonces vuelve a pedir sus datos por la API.
 */
export function eventosRoutes(eventos: EventosPostgres): Router {
  const router = Router();

  router.get('/', (req: Request, res: Response) => {
    res.status(200).set({
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders();
    res.write('retry: 5000\n\n');

    const desuscribir = eventos.suscribir((tipo) => res.write(`event: ${tipo}\ndata: {}\n\n`));
    const latido = setInterval(() => res.write(': latido\n\n'), LATIDO_MS);

    req.on('close', () => {
      clearInterval(latido);
      desuscribir();
    });
  });

  return router;
}
