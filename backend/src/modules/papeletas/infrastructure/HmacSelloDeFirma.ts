import crypto from 'node:crypto';
import { env } from '../../../shared/infrastructure/config/env';
import { Papeleta } from '../domain/entities/Papeleta';
import { contenidoFirmable, SelloDeFirmaPort } from '../domain/services/SelloDeFirma';

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
    const a = Buffer.from(esperado);
    const b = Buffer.from(sello);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }
}
