import { Request } from 'express';
import { AccessTokenPayload } from '../security/JwtService';

export interface Actor {
  userId: string;
  role: AccessTokenPayload['role'];
  employeeId: string | null;
  email: string;
}

export interface AuthenticatedRequest extends Request {
  actor?: Actor;
  requestId?: string;
}

export function requireActor(req: AuthenticatedRequest): Actor {
  if (!req.actor) throw new Error('Actor ausente: falta el middleware de autenticacion');
  return req.actor;
}
