import { Response } from 'express';
import path from 'node:path';
import { z } from 'zod';
import { AuthenticatedRequest, requireActor } from '../../../../shared/infrastructure/http/types';
import { validated } from '../../../../shared/infrastructure/http/middlewares/validate';
import { PapeletaPdfGenerator, PapeletaView } from '../../../../shared/infrastructure/pdf/PapeletaPdfGenerator';
import { LocalFileStorage } from '../../../../shared/infrastructure/storage/LocalFileStorage';
import { CrearPapeleta } from '../../application/use-cases/CrearPapeleta';
import { FirmarPapeleta, RechazarPapeleta } from '../../application/use-cases/FirmarPapeleta';
import {
  AnularPapeleta,
  ListarPapeletas,
  ObtenerPapeleta,
} from '../../application/use-cases/ConsultarPapeletas';
import { Papeleta } from '../../domain/entities/Papeleta';
import { listPapeletasSchema } from './papeleta.validators';

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

function hhmm(fecha: Date | null): string | null {
  if (!fecha) return null;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(fecha.getHours())}:${p(fecha.getMinutes())}`;
}

export function aVista(papeleta: Papeleta): PapeletaView {
  const ahora = new Date();
  return {
    numero: papeleta.numero,
    tipo: papeleta.tipo,
    estado: papeleta.estado.replace(/_/g, ' ').toLowerCase(),
    empleado: papeleta.employeeNombre,
    codigo: papeleta.employeeCodigo,
    area: papeleta.area,
    fechaTexto: `${ahora.getDate()} de ${MESES[ahora.getMonth()]} del ${ahora.getFullYear()}`,
    trabajoRealizado: papeleta.trabajoRealizado,
    desde: hhmm(papeleta.desde),
    hasta: hhmm(papeleta.hasta),
    totalHoras: papeleta.totalHoras === null ? null : `${papeleta.totalHoras} h`,
    recargo: papeleta.recargo,
    salidaMotivo: papeleta.salidaMotivo,
    motivo: papeleta.motivo,
    tiempoSolicitado: papeleta.tiempoSolicitado,
    horaSalida: papeleta.horaSalida,
    horaRetorno: papeleta.horaRetorno,
    attachmentUrl: papeleta.attachmentUrl,
    firmas: [
      papeleta.firmaArea && {
        rol: 'Jefe de Area',
        nombre: papeleta.firmaArea.nombre ?? 'Jefe de area',
        fecha: papeleta.firmaArea.fecha.toLocaleString('es-BO'),
        sello: papeleta.firmaArea.sello,
      },
      papeleta.firmaRrhh && {
        rol: papeleta.tipo === 'SALIDA' ? 'Enc. Personal / RRHH' : 'Jefe de RRHH',
        nombre: papeleta.firmaRrhh.nombre ?? 'Recursos Humanos',
        fecha: papeleta.firmaRrhh.fecha.toLocaleString('es-BO'),
        sello: papeleta.firmaRrhh.sello,
      },
    ].filter((f2): f2 is NonNullable<typeof f2> => f2 !== null),
  };
}

export class PapeletaController {
  constructor(
    private readonly crear: CrearPapeleta,
    private readonly firmar: FirmarPapeleta,
    private readonly rechazar: RechazarPapeleta,
    private readonly listar: ListarPapeletas,
    private readonly obtener: ObtenerPapeleta,
    private readonly anular: AnularPapeleta,
    private readonly pdf: PapeletaPdfGenerator,
    private readonly storage: LocalFileStorage,
  ) {}

  list = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const query = validated<z.infer<typeof listPapeletasSchema>>(req, 'query');
    res.json(await this.listar.execute(requireActor(req), query));
  };

  get = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    res.json({ data: await this.obtener.execute(requireActor(req), req.params.id) });
  };

  crearHorasExtras = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const papeleta = await this.crear.horasExtras(requireActor(req), req.body);
    res.status(201).json({ data: papeleta });
  };

  crearSalida = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const papeleta = await this.crear.salida(requireActor(req), req.body);
    res.status(201).json({ data: papeleta });
  };

  firmarPapeleta = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    res.json({ data: await this.firmar.execute(requireActor(req), req.params.id) });
  };

  rechazarPapeleta = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    res.json({ data: await this.rechazar.execute(requireActor(req), req.params.id, req.body.motivo) });
  };

  anularPapeleta = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    res.json({ data: await this.anular.execute(requireActor(req), req.params.id) });
  };

  descargarPdf = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const papeleta = await this.obtener.execute(requireActor(req), req.params.id);
    const vista = aVista(papeleta);

    if (papeleta.attachmentUrl) {
      const nombreArchivo = papeleta.attachmentUrl.split('/').pop() ?? '';
      const esImagen = ['.jpg', '.jpeg', '.png', '.webp'].includes(path.extname(nombreArchivo).toLowerCase());
      if (esImagen) {
        try {
          vista.attachmentImage = await this.storage.leer(nombreArchivo);
        } catch {}
      }
    }

    const buffer = await this.pdf.render(vista);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="papeleta-${papeleta.numero}.pdf"`);
    res.send(buffer);
  };
}
