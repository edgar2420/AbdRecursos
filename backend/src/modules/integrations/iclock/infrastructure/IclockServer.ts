import http from 'node:http';
import express, { Request, Response } from 'express';
import { logger } from '../../../../shared/infrastructure/logger/logger';
import { RegistradorMarcacionesBiometrico } from '../../../attendance/infrastructure/persistence/RegistradorMarcacionesBiometrico';
import { leerAttlog, opcionesParaReloj } from '../domain/protocolo';

export interface IclockConfig {
  puerto: number;
  /** Numeros de serie autorizados; vacio = cualquiera. */
  seriesPermitidas: string[];
  /** Si existe, todo lo que manda el reloj se reenvia aqui (p. ej. ZKBio Time) y su respuesta vuelve al reloj. */
  relayUrl?: string;
  zonaHoraria: number;
}

export interface EstadoReloj {
  serie: string;
  ip: string | null;
  ultimaConexion: string;
  ultimaMarcacion: string | null;
  marcacionesRecibidas: number;
  marcacionesNuevas: number;
  relayOk: boolean | null;
}

const TIEMPO_RELAY_MS = 15_000;

export class IclockServer {
  private readonly relojes = new Map<string, EstadoReloj>();
  private servidor?: http.Server;

  constructor(
    private readonly config: IclockConfig,
    private readonly registrador: RegistradorMarcacionesBiometrico,
  ) {}

  estado(): { activo: boolean; puerto: number; relay: string | null; relojes: EstadoReloj[] } {
    return {
      activo: !!this.servidor?.listening,
      puerto: this.config.puerto,
      relay: this.config.relayUrl ?? null,
      relojes: [...this.relojes.values()],
    };
  }

  iniciar(): void {
    const app = express();
    app.disable('x-powered-by');
    app.use(express.text({ type: '*/*', limit: '10mb' }));
    app.all('/iclock/:accion', (req, res) => void this.atender(req, res));
    app.use((_req, res) => res.status(404).send('Not Found'));

    this.servidor = http.createServer(app);
    this.servidor.listen(this.config.puerto, () =>
      logger.info(
        { puerto: this.config.puerto, relay: this.config.relayUrl ?? null, series: this.config.seriesPermitidas },
        'Receptor del biometrico (iclock) escuchando',
      ),
    );
  }

  detener(): void {
    this.servidor?.close();
  }

  private async atender(req: Request, res: Response): Promise<void> {
    const serie = String(req.query.SN ?? '').trim();
    if (!serie || (this.config.seriesPermitidas.length > 0 && !this.config.seriesPermitidas.includes(serie))) {
      logger.warn({ serie, ip: req.ip }, 'Reloj no autorizado intento conectarse');
      res.status(403).type('text/plain').send('Unauthorized');
      return;
    }

    const estado = this.registrarVisita(serie, req.ip ?? null);
    const accion = req.params.accion;
    const cuerpo = typeof req.body === 'string' ? req.body : '';

    let respuestaLocal = 'OK';
    let esEnvioDeMarcaciones = false;
    try {
      if (accion === 'cdata' && req.method === 'GET') {
        respuestaLocal = opcionesParaReloj(serie, this.config.zonaHoraria);
      } else if (accion === 'cdata' && req.method === 'POST' && String(req.query.table).toUpperCase() === 'ATTLOG') {
        esEnvioDeMarcaciones = true;
        const marcaciones = leerAttlog(cuerpo);
        const r = await this.registrador.registrar(
          marcaciones.map((m) => ({ ...m, origen: `iclock:${serie}`, nota: `Reloj ${serie}` })),
        );
        estado.marcacionesRecibidas += r.recibidas;
        estado.marcacionesNuevas += r.nuevas;
        if (marcaciones.length) estado.ultimaMarcacion = new Date().toISOString();
        if (r.nuevas || r.sinEmpleado) logger.info({ serie, ...r }, 'Marcaciones recibidas del reloj');
        respuestaLocal = `OK: ${marcaciones.length}`;
      }
    } catch (error) {
      // Si no se pudo guardar, no se confirma al reloj: lo reenviara mas tarde.
      logger.error({ err: error, serie }, 'No se pudieron guardar las marcaciones del reloj');
      res.status(500).type('text/plain').send('ERROR');
      return;
    }

    if (!this.config.relayUrl) {
      res.type('text/plain').send(respuestaLocal);
      return;
    }

    try {
      const relay = await fetch(`${this.config.relayUrl}${req.originalUrl}`, {
        method: req.method,
        headers: { 'Content-Type': String(req.headers['content-type'] ?? 'text/plain') },
        body: req.method === 'GET' || req.method === 'HEAD' ? undefined : cuerpo,
        signal: AbortSignal.timeout(TIEMPO_RELAY_MS),
      });
      estado.relayOk = relay.ok;
      res.status(relay.status).type(relay.headers.get('content-type') ?? 'text/plain').send(await relay.text());
    } catch (error) {
      estado.relayOk = false;
      if (esEnvioDeMarcaciones) {
        // El SGRH ya guardo su copia, pero si se confirma al reloj, el relay (ZKBio Time) las perderia.
        // Sin confirmacion el reloj las reintenta y el SGRH descarta el duplicado.
        logger.warn({ err: error, serie }, 'Relay caido: no se confirman las marcaciones para que el reloj las reintente');
        res.status(503).type('text/plain').send('ERROR');
        return;
      }
      logger.warn({ err: error, serie }, 'No se pudo reenviar al servidor relay; se responde localmente');
      res.type('text/plain').send(respuestaLocal);
    }
  }

  private registrarVisita(serie: string, ip: string | null): EstadoReloj {
    const actual = this.relojes.get(serie) ?? {
      serie,
      ip,
      ultimaConexion: '',
      ultimaMarcacion: null,
      marcacionesRecibidas: 0,
      marcacionesNuevas: 0,
      relayOk: null,
    };
    actual.ip = ip;
    actual.ultimaConexion = new Date().toISOString();
    this.relojes.set(serie, actual);
    return actual;
  }
}
