import { Response } from 'express';
import path from 'node:path';
import { ValidationError, NotFoundError } from '../../domain/errors';
import { LocalFileStorage } from '../storage/LocalFileStorage';
import { AuthenticatedRequest, requireActor } from './types';

const CONTENT_TYPE: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  pdf: 'application/pdf',
};

/** Solo el nombre que nosotros mismos generamos: bloquea path traversal y nombres inventados. */
const NOMBRE_ARCHIVO = /^[a-f0-9-]+\.\w+$/;

/**
 * Adjuntos genericos (certificado medico de una salida, foto de una
 * justificacion, etc.). Requiere sesion valida para subir y para leer: no son
 * archivos publicos, pueden contener datos de salud del empleado.
 */
export class UploadController {
  constructor(private readonly storage: LocalFileStorage) {}

  subir = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    requireActor(req);
    const file = (req as unknown as { file?: Express.Multer.File }).file;
    if (!file) throw new ValidationError('Debe adjuntar un archivo');
    const nombre = await this.storage.guardar(file.buffer, file.originalname);
    res.status(201).json({ data: { url: `/uploads/${nombre}` } });
  };

  obtener = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    requireActor(req);
    const nombre = req.params.nombre;
    if (!NOMBRE_ARCHIVO.test(nombre)) throw new NotFoundError('Archivo');
    try {
      const buffer = await this.storage.leer(nombre);
      const ext = path.extname(nombre).replace('.', '').toLowerCase();
      res.setHeader('Content-Type', CONTENT_TYPE[ext] ?? 'application/octet-stream');
      res.send(buffer);
    } catch {
      throw new NotFoundError('Archivo');
    }
  };
}
