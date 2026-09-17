import crypto from 'node:crypto';
import { env } from '../config/env';

const ALGORITMO = 'aes-256-gcm';
const PREFIJO = 'enc:v1:';

export class FieldCipher {
  private readonly key: Buffer;

  constructor(secret: string = env.FIELD_ENCRYPTION_KEY) {
    this.key = crypto.createHash('sha256').update(secret).digest();
  }

  cifrar(valor: string | null | undefined): string | null {
    if (valor === null || valor === undefined || valor === '') return null;
    if (this.estaCifrado(valor)) return valor;

    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGORITMO, this.key, iv);
    const cifrado = Buffer.concat([cipher.update(valor, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    return `${PREFIJO}${iv.toString('base64')}:${tag.toString('base64')}:${cifrado.toString('base64')}`;
  }

  descifrar(valor: string | null | undefined): string | null {
    if (valor === null || valor === undefined || valor === '') return null;
    if (!this.estaCifrado(valor)) return valor; 

    const [, , ivB64, tagB64, datoB64] = valor.split(':');
    try {
      const decipher = crypto.createDecipheriv(ALGORITMO, this.key, Buffer.from(ivB64, 'base64'));
      decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
      return Buffer.concat([
        decipher.update(Buffer.from(datoB64, 'base64')),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      return null;
    }
  }

  estaCifrado(valor: string): boolean {
    return valor.startsWith(PREFIJO);
  }

  huella(valor: string): string {
    return crypto.createHmac('sha256', this.key).update(valor.trim().toUpperCase()).digest('hex');
  }
}
