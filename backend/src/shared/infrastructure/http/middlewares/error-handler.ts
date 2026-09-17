import { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import {
  BusinessRuleError,
  ConflictError,
  DomainError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../../../domain/errors';
import { logger } from '../../logger/logger';
import { env } from '../../config/env';
import { AuthenticatedRequest } from '../types';

function statusFor(error: unknown): number {
  if (error instanceof ValidationError) return 400;
  if (error instanceof UnauthorizedError) return 401;
  if (error instanceof ForbiddenError) return 403;
  if (error instanceof NotFoundError) return 404;
  if (error instanceof ConflictError) return 409;
  if (error instanceof BusinessRuleError) return 422;
  return 500;
}

export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const requestId = (req as AuthenticatedRequest).requestId;

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      const target = (error.meta?.target as string[] | undefined)?.join(', ') ?? 'registro';
      res.status(409).json({
        error: { code: 'CONFLICT', message: `Ya existe un registro con ese ${target}`, requestId },
      });
      return;
    }
    if (error.code === 'P2025') {
      res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Recurso no encontrado', requestId },
      });
      return;
    }
  }

  const status = statusFor(error);

  if (status >= 500) {
    logger.error({ err: error, requestId, path: req.path }, 'Error no controlado');
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Ocurrio un error interno',
        requestId,
        ...(env.isProduction ? {} : { detail: (error as Error)?.message }),
      },
    });
    return;
  }

  const domainError = error as DomainError;
  logger.warn({ requestId, code: domainError.code, path: req.path }, domainError.message);
  res.status(status).json({
    error: {
      code: domainError.code,
      message: domainError.message,
      requestId,
      ...(error instanceof ValidationError && error.details ? { details: error.details } : {}),
    },
  });
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: `Ruta no encontrada: ${req.method} ${req.path}` },
  });
}
