import { Request } from 'express';
import { AccessTokenPayload } from '../security/JwtService';

/** Identidad del solicitante que viaja hasta el caso de uso para el ownership check (8.2). */
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
