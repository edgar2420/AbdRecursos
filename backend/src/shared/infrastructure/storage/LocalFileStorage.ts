import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { env } from '../config/env';

const EXTENSIONES_PERMITIDAS = new Set(['jpg', 'jpeg', 'png', 'webp', 'pdf']);

function extensionSegura(nombreOriginal: string): string {
  const ext = path.extname(nombreOriginal).replace('.', '').toLowerCase();
  return EXTENSIONES_PERMITIDAS.has(ext) ? ext : 'bin';
}

/**
 * Adjuntos guardados en disco con nombre generado (UUID): nunca se conserva
 * el nombre original ni se arma la ruta a partir de datos del usuario, para
 * no abrir la puerta a path traversal ni a colisiones de nombre.
 */
export class LocalFileStorage {
  private readonly dir = path.resolve(env.UPLOAD_DIR);

  async guardar(buffer: Buffer, nombreOriginal: string): Promise<string> {
    await mkdir(this.dir, { recursive: true });
    const nombre = `${randomUUID()}.${extensionSegura(nombreOriginal)}`;
    await writeFile(path.join(this.dir, nombre), buffer);
    return nombre;
  }

  async leer(nombreArchivo: string): Promise<Buffer> {
    return readFile(path.join(this.dir, nombreArchivo));
  }
}
