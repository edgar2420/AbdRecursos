import { NextFunction, Response } from 'express';
import { TokenServicePort } from '../../security/JwtService';
import { UnauthorizedError } from '../../../domain/errors';
import { AuthenticatedRequest } from '../types';

/** Verifica el access token y publica el actor en el request. */
export function authenticate(tokens: TokenServicePort) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    const header = req.header('authorization');
    if (!header || !header.startsWith('Bearer ')) {
      return next(new UnauthorizedError('Falta el token de acceso'));
    }
    try {
      const payload = tokens.verifyAccessToken(header.slice(7));
      req.actor = {
        userId: payload.sub,
        role: payload.role,
        employeeId: payload.employeeId,
        email: payload.email,
      };
      next();
    } catch (error) {
      next(error);
    }
  };
}
