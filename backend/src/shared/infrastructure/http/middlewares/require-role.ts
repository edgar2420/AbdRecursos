import { NextFunction, Response } from 'express';
import { ForbiddenError, UnauthorizedError } from '../../../domain/errors';
import { AuthenticatedRequest } from '../types';
import { UserRole } from '../../security/JwtService';

export function requireRole(...roles: UserRole[]) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    if (!req.actor) return next(new UnauthorizedError());
    if (!roles.includes(req.actor.role)) return next(new ForbiddenError());
    next();
  };
}
