import archiver from 'archiver';
import { PassThrough } from 'node:stream';

export interface ZipEntry {
  name: string;
  content: Buffer;
}

/** Empaquetado de boletas masivas en ZIP (seccion 2.3). */
export class ZipService {
  build(entries: ZipEntry[]): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const archive = archiver('zip', { zlib: { level: 9 } });
      const stream = new PassThrough();
      const chunks: Buffer[] = [];
      stream.on('data', (c: Buffer) => chunks.push(c));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      archive.on('error', reject);
      archive.pipe(stream);
      entries.forEach((e) => archive.append(e.content, { name: e.name }));
      void archive.finalize();
    });
  }
}
