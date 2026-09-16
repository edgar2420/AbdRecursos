import crypto from 'node:crypto';
import { env } from '../../../shared/infrastructure/config/env';
import { Papeleta } from '../domain/entities/Papeleta';
import { contenidoFirmable, SelloDeFirmaPort } from '../domain/services/SelloDeFirma';

/**
 * Sello HMAC-SHA256 sobre el contenido de la papeleta + quien firma + cuando.
 *
 * La clave del HMAC es un secreto del servidor, asi que el sello no se puede
 * fabricar desde afuera: si alguien edita la papeleta en la base, el sello
 * guardado deja de verificar y la alteracion queda a la vista.
 */
export class HmacSelloDeFirma implements SelloDeFirmaPort {
  sellar(papeleta: Papeleta, userId: string, fecha: Date): string {
    return crypto
      .createHmac('sha256', env.JWT_REFRESH_SECRET)
      .update(`${contenidoFirmable(papeleta)}::${userId}::${fecha.toISOString()}`)
      .digest('hex')
      .slice(0, 32)
      .toUpperCase();
  }

  verificar(papeleta: Papeleta, userId: string, fecha: Date, sello: string): boolean {
    const esperado = this.sellar(papeleta, userId, fecha);
    // Comparacion en tiempo constante: no filtra cuanto coincide.
    const a = Buffer.from(esperado);
    const b = Buffer.from(sello);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }
}
