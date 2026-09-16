import { NextFunction, Response } from 'express';
import { ForbiddenError, UnauthorizedError } from '../../../domain/errors';
import { AuthenticatedRequest } from '../types';
import { UserRole } from '../../security/JwtService';

/**
 * Primera capa de autorizacion (rol). La segunda capa -verificar la propiedad
 * del recurso- vive dentro del caso de uso, nunca solo aqui (seccion 8.2).
 */
export function requireRole(...roles: UserRole[]) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    if (!req.actor) return next(new UnauthorizedError());
    if (!roles.includes(req.actor.role)) return next(new ForbiddenError());
    next();
  };
}
