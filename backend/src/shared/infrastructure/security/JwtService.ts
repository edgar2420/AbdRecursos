import crypto from 'node:crypto';
import jwt, { SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';
import { UnauthorizedError } from '../../domain/errors';

export type UserRole = 'EMPLOYEE' | 'SUPERVISOR' | 'HR' | 'ADMIN';

export interface AccessTokenPayload {
  sub: string;
  role: UserRole;
  employeeId: string | null;
  email: string;
  mustChangePassword: boolean;
}

export interface TokenServicePort {
  signAccessToken(payload: AccessTokenPayload): string;
  verifyAccessToken(token: string): AccessTokenPayload;
  generateRefreshToken(): { token: string; tokenHash: string; expiresAt: Date };
  hashRefreshToken(token: string): string;
}

export class JwtService implements TokenServicePort {
  signAccessToken(payload: AccessTokenPayload): string {
    const options: SignOptions = { expiresIn: env.JWT_ACCESS_EXPIRES_IN as SignOptions['expiresIn'] };
    return jwt.sign(payload, env.JWT_ACCESS_SECRET, options);
  }

  verifyAccessToken(token: string): AccessTokenPayload {
    try {
      const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as jwt.JwtPayload;
      return {
        sub: String(decoded.sub),
        role: decoded.role as UserRole,
        employeeId: (decoded.employeeId as string | null) ?? null,
        email: String(decoded.email),
        mustChangePassword: Boolean(decoded.mustChangePassword),
      };
    } catch {
      throw new UnauthorizedError('Token invalido o expirado');
    }
  }

  generateRefreshToken(): { token: string; tokenHash: string; expiresAt: Date } {
    const token = crypto.randomBytes(48).toString('hex');
    return {
      token,
      tokenHash: this.hashRefreshToken(token),
      expiresAt: new Date(Date.now() + parseDuration(env.JWT_REFRESH_EXPIRES_IN)),
    };
  }

  hashRefreshToken(token: string): string {
    return crypto.createHmac('sha256', env.JWT_REFRESH_SECRET).update(token).digest('hex');
  }
}

export function parseDuration(value: string): number {
  const match = /^(\d+)([smhd])$/.exec(value.trim());
  if (!match) throw new Error(`Duracion invalida: ${value}`);
  const amount = Number(match[1]);
  const unit = match[2];
  const factor = unit === 's' ? 1000 : unit === 'm' ? 60000 : unit === 'h' ? 3600000 : 86400000;
  return amount * factor;
}
