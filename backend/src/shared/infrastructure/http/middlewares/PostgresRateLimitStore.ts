import type { IncrementResponse, Options, Store } from 'express-rate-limit';
import { prisma } from '../../database/prisma';

/**
 * Contador de express-rate-limit guardado en PostgreSQL, para que el limite de intentos
 * de acceso sea el mismo en todos los servidores (en memoria, cada servidor contaria por su lado).
 */
export class PostgresRateLimitStore implements Store {
  private ventanaMs = 15 * 60_000;

  constructor(readonly prefix: string) {}

  init(options: Options): void {
    this.ventanaMs = options.windowMs;
  }

  async increment(key: string): Promise<IncrementResponse> {
    const clave = this.prefix + key;
    const [fila] = await prisma.$queryRaw<{ intentos: number; reinicio: Date }[]>`
      INSERT INTO limites_acceso (clave, intentos, reinicio)
      VALUES (${clave}, 1, now() + (${this.ventanaMs} * interval '1 millisecond'))
      ON CONFLICT (clave) DO UPDATE SET
        intentos = CASE WHEN limites_acceso.reinicio < now() THEN 1 ELSE limites_acceso.intentos + 1 END,
        reinicio = CASE WHEN limites_acceso.reinicio < now() THEN EXCLUDED.reinicio ELSE limites_acceso.reinicio END
      RETURNING intentos, reinicio`;
    return { totalHits: fila.intentos, resetTime: fila.reinicio };
  }

  async decrement(key: string): Promise<void> {
    await prisma.$executeRaw`
      UPDATE limites_acceso SET intentos = GREATEST(intentos - 1, 0) WHERE clave = ${this.prefix + key}`;
  }

  async resetKey(key: string): Promise<void> {
    await prisma.$executeRaw`DELETE FROM limites_acceso WHERE clave = ${this.prefix + key}`;
  }
}

/** Borra contadores vencidos (lo corre una tarea periodica). */
export async function limpiarLimitesVencidos(): Promise<number> {
  return prisma.$executeRaw`DELETE FROM limites_acceso WHERE reinicio < now()`;
}
