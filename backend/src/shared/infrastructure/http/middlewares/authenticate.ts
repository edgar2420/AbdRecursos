import { NextFunction, Response } from 'express';
import { TokenServicePort } from '../../security/JwtService';
import { ForbiddenError, UnauthorizedError } from '../../../domain/errors';
import { AuthenticatedRequest } from '../types';

export function authenticate(tokens: TokenServicePort, options?: { allowMustChangePassword?: boolean }) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    const header = req.header('authorization');
    if (!header || !header.startsWith('Bearer ')) {
      return next(new UnauthorizedError('Falta el token de acceso'));
    }
    try {
      const payload = tokens.verifyAccessToken(header.slice(7));
      if (payload.mustChangePassword && !options?.allowMustChangePassword) {
        return next(new ForbiddenError('Debe cambiar su contrasena antes de continuar'));
      }
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
