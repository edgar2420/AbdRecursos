import { z } from 'zod';

/**
 * Lee "AAAA-MM-DD" como medianoche en la hora local del servidor.
 * z.coerce.date() lo toma como medianoche UTC, que en Bolivia (UTC-4) cae el dia anterior
 * y desplaza un dia los rangos que luego se recortan con startOfDay/endOfDay locales.
 */
export const fechaLocal = z.preprocess((valor) => {
  if (typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    const [y, m, d] = valor.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  return valor;
}, z.coerce.date());
