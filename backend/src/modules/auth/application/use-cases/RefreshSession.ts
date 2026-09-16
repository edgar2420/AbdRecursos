import { UnauthorizedError } from '../../../../shared/domain/errors';
import { env } from '../../../../shared/infrastructure/config/env';
import { TokenServicePort } from '../../../../shared/infrastructure/security/JwtService';
import { RefreshTokenRepository } from '../../domain/repositories/RefreshTokenRepository';
import { UserRepository } from '../../domain/repositories/UserRepository';

export interface RefreshResult {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
}

/**
 * Rotacion de refresh token: cada uso emite uno nuevo y revoca el anterior (8.1).
 *
 * Ademas corta por INACTIVIDAD: si la sesion no se usa durante
 * SESSION_IDLE_MINUTES minutos, se revoca aunque el token todavia no haya
 * expirado. Asi una sesion abierta y olvidada en una maquina compartida deja de
 * servir a los 15 minutos.
 */
export class RefreshSession {
  constructor(
    private readonly users: UserRepository,
    private readonly refreshTokens: RefreshTokenRepository,
    private readonly tokens: TokenServicePort,
  ) {}

  async execute(rawToken: string, context: { ip?: string | null; userAgent?: string | null }): Promise<RefreshResult> {
    if (!rawToken) throw new UnauthorizedError('Falta el refresh token');
    const stored = await this.refreshTokens.findByHash(this.tokens.hashRefreshToken(rawToken));
    if (!stored) throw new UnauthorizedError('Sesion invalida');

    if (stored.revokedAt) {
      // Reuso de un token ya rotado: se asume robo y se cierran todas las sesiones.
      await this.refreshTokens.revokeAllForUser(stored.userId);
      throw new UnauthorizedError('Sesion invalidada por seguridad. Vuelva a iniciar sesion.');
    }
    const ahora = new Date();
    if (stored.expiresAt < ahora) throw new UnauthorizedError('Sesion expirada');

    const inactividadMs = ahora.getTime() - stored.lastUsedAt.getTime();
    if (inactividadMs > env.SESSION_IDLE_MINUTES * 60_000) {
      await this.refreshTokens.revoke(stored.id, null);
      throw new UnauthorizedError(
        `Sesion cerrada por ${env.SESSION_IDLE_MINUTES} minutos de inactividad`,
      );
    }

    const user = await this.users.findById(stored.userId);
    if (!user || !user.isActive) throw new UnauthorizedError('Sesion invalida');

    const next = this.tokens.generateRefreshToken();
    const saved = await this.refreshTokens.save({
      userId: user.id,
      tokenHash: next.tokenHash,
      expiresAt: next.expiresAt,
      ip: context.ip,
      userAgent: context.userAgent,
    });
    await this.refreshTokens.revoke(stored.id, saved.id);

    return {
      accessToken: this.tokens.signAccessToken({
        sub: user.id,
        role: user.role,
        employeeId: user.employeeId,
        email: user.email,
      }),
      refreshToken: next.token,
      refreshExpiresAt: next.expiresAt,
    };
  }
}
