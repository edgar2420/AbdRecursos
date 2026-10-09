import rateLimit from 'express-rate-limit';
import { env } from '../../config/env';
import { PostgresRateLimitStore } from './PostgresRateLimitStore';

/** Limite general por servidor (en memoria): frena abusos sin escribir en la base en cada peticion. */
export const globalRateLimit = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Demasiadas solicitudes, intente mas tarde' } },
});

/** Intentos de acceso: el contador vive en la base y es el mismo para todos los servidores. */
export const loginRateLimit = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  store: new PostgresRateLimitStore('login:'),
  passOnStoreError: true,
  max: env.LOGIN_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    error: { code: 'RATE_LIMITED', message: 'Demasiados intentos de acceso. Espere unos minutos.' },
  },
});
