import { Client } from 'pg';
import { PublicadorEventos, TipoEvento } from '../../application/Eventos';
import { prisma } from '../database/prisma';
import { logger } from '../logger/logger';

const CANAL = 'sgrh_eventos';
/** Varios cambios seguidos del mismo tipo se avisan una sola vez cada este tiempo. */
const AGRUPAR_MS = 1500;

type Oyente = (tipo: TipoEvento) => void;

/**
 * Bus de eventos con LISTEN/NOTIFY de PostgreSQL: un aviso publicado en cualquier servidor
 * llega a todos los servidores, y cada uno lo reenvia a sus pantallas conectadas.
 */
export class EventosPostgres implements PublicadorEventos {
  private cliente: Client | null = null;
  private readonly oyentes = new Set<Oyente>();
  private readonly pendientes = new Map<TipoEvento, ReturnType<typeof setTimeout>>();
  private detenido = false;
  private espera = 1000;

  constructor(private readonly urlBase: string) {}

  publicar(tipo: TipoEvento): void {
    if (this.pendientes.has(tipo)) return;
    this.pendientes.set(
      tipo,
      setTimeout(() => {
        this.pendientes.delete(tipo);
        prisma.$executeRaw`SELECT pg_notify(${CANAL}, ${tipo})`.catch((error) =>
          logger.warn({ err: error, tipo }, 'No se pudo publicar el aviso en tiempo real'),
        );
      }, AGRUPAR_MS),
    );
  }

  suscribir(oyente: Oyente): () => void {
    this.oyentes.add(oyente);
    return () => this.oyentes.delete(oyente);
  }

  get conectados(): number {
    return this.oyentes.size;
  }

  async iniciar(): Promise<void> {
    if (this.detenido) return;
    const cliente = new Client({ connectionString: this.urlBase });
    cliente.on('notification', (n) => {
      if (n.channel !== CANAL || !n.payload) return;
      for (const oyente of this.oyentes) oyente(n.payload as TipoEvento);
    });
    cliente.on('error', (error) => {
      logger.warn({ err: error }, 'Se corto la escucha de avisos en tiempo real; reconectando');
      void this.reconectar();
    });
    try {
      await cliente.connect();
      await cliente.query(`LISTEN ${CANAL}`);
      this.cliente = cliente;
      this.espera = 1000;
      logger.info('Avisos en tiempo real activos (LISTEN/NOTIFY)');
    } catch (error) {
      logger.warn({ err: error }, 'No se pudo escuchar los avisos en tiempo real; reintentando');
      await cliente.end().catch(() => undefined);
      await this.reconectar();
    }
  }

  async detener(): Promise<void> {
    this.detenido = true;
    this.pendientes.forEach((t) => clearTimeout(t));
    await this.cliente?.end().catch(() => undefined);
  }

  private async reconectar(): Promise<void> {
    const anterior = this.cliente;
    this.cliente = null;
    await anterior?.end().catch(() => undefined);
    if (this.detenido) return;
    const espera = this.espera;
    this.espera = Math.min(this.espera * 2, 30_000);
    setTimeout(() => void this.iniciar(), espera).unref();
  }
}

/** Prisma acepta parametros propios en la URL (?schema=...) que el driver pg no entiende. */
export function urlParaPg(databaseUrl: string): string {
  const url = new URL(databaseUrl);
  url.searchParams.delete('schema');
  url.searchParams.delete('connection_limit');
  url.searchParams.delete('pool_timeout');
  return url.toString();
}
