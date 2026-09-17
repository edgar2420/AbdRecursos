import express, { Express, Router } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import swaggerUi from 'swagger-ui-express';
import { env } from '../config/env';
import { logger } from '../logger/logger';
import { requestId } from './middlewares/request-id';
import { globalRateLimit } from './middlewares/rate-limit';
import { errorHandler, notFoundHandler } from './middlewares/error-handler';
import { ForbiddenError } from '../../domain/errors';
import { openApiDocument } from './openapi';
import { isOriginAllowed } from './cors-origin';
import { AuthenticatedRequest } from './types';

export function createApp(apiRouter: Router): Express {
  const app = express();

  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' } }));
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || isOriginAllowed(origin)) return callback(null, true);
        callback(new ForbiddenError('Origen no permitido por CORS'));
      },
      credentials: true,
      exposedHeaders: ['Content-Disposition', 'x-request-id'],
    }),
  );
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use(requestId);
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => (req as AuthenticatedRequest).requestId ?? '',
      autoLogging: { ignore: (req) => req.url === '/health' },
    }),
  );
  app.use(globalRateLimit);

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'sgrh-api', timestamp: new Date().toISOString() });
  });

  app.use(env.API_PREFIX, apiRouter);
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiDocument));
  app.get('/openapi.json', (_req, res) => res.json(openApiDocument));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
