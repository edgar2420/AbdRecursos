import crypto from 'node:crypto';
import { env } from '../config/env';

const ALGORITMO = 'aes-256-gcm';
const PREFIJO = 'enc:v1:';

/**
 * Cifrado de campos sensibles en reposo (seccion 8.4): cedula de identidad y
 * cuenta bancaria.
 *
 * AES-256-GCM con IV aleatorio por valor y etiqueta de autenticacion, de modo
 * que el dato no solo queda ilegible sino que tampoco se puede alterar sin que
 * el descifrado falle. El formato guardado es:
 *
 *     enc:v1:<iv en base64>:<tag en base64>:<cifrado en base64>
 *
 * El prefijo permite convivir con datos todavia en claro durante la migracion:
 * lo que no empieza con "enc:v1:" se devuelve tal cual.
 */
export class FieldCipher {
  private readonly key: Buffer;

  constructor(secret: string = env.FIELD_ENCRYPTION_KEY) {
    // La clave se deriva del secreto para admitir cualquier longitud de entrada.
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
    if (!this.estaCifrado(valor)) return valor; // dato heredado, aun en claro

    const [, , ivB64, tagB64, datoB64] = valor.split(':');
    try {
      const decipher = crypto.createDecipheriv(ALGORITMO, this.key, Buffer.from(ivB64, 'base64'));
      decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
      return Buffer.concat([
        decipher.update(Buffer.from(datoB64, 'base64')),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      // Clave equivocada o dato manipulado: no se devuelve basura.
      return null;
    }
  }

  estaCifrado(valor: string): boolean {
    return valor.startsWith(PREFIJO);
  }

  /**
   * Huella determinista para poder buscar por C.I. sin descifrar toda la tabla.
   * No es reversible: solo sirve para comparar igualdad exacta.
   */
  huella(valor: string): string {
    return crypto.createHmac('sha256', this.key).update(valor.trim().toUpperCase()).digest('hex');
  }
}
