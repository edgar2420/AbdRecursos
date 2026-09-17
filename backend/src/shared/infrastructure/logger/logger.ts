import pino from 'pino';
import { env } from '../config/env';

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
