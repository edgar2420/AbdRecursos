import { TokenServicePort } from '../../../../shared/infrastructure/security/JwtService';
import { RefreshTokenRepository } from '../../domain/repositories/RefreshTokenRepository';

export class Logout {
  constructor(
    private readonly refreshTokens: RefreshTokenRepository,
    private readonly tokens: TokenServicePort,
  ) {}

  async execute(rawToken?: string): Promise<void> {
    if (!rawToken) return;
    const stored = await this.refreshTokens.findByHash(this.tokens.hashRefreshToken(rawToken));
    if (stored && !stored.revokedAt) await this.refreshTokens.revoke(stored.id, null);
  }
}
