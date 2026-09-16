import pino from 'pino';
import { env } from '../config/env';

/** Logging estructurado con redaccion de campos sensibles (8.1: nunca password en logs). */
export const logger = pino({
  level: env.isProduction ? 'info' : 'debug',
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.body.password',
      'req.body.newPassword',
      'req.body.currentPassword',
      'password',
      'passwordHash',
      'ci',
      'bankAccount',
    ],
    censor: '[REDACTADO]',
  },
  transport: env.isProduction
    ? undefined
    : { target: 'pino/file', options: { destination: 1 } },
});
