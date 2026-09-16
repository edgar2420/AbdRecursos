import { AuditLoggerPort } from '../../../../shared/application/AuditLogger';
import { UnauthorizedError } from '../../../../shared/domain/errors';
import { PasswordHasherPort } from '../../../../shared/infrastructure/security/PasswordHasher';
import { TokenServicePort } from '../../../../shared/infrastructure/security/JwtService';
import { RefreshTokenRepository } from '../../domain/repositories/RefreshTokenRepository';
import { UserRepository } from '../../domain/repositories/UserRepository';
import { User } from '../../domain/entities/User';

export interface LoginInput {
  email: string;
  password: string;
  ip?: string | null;
  userAgent?: string | null;
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
  user: User;
}

export class Login {
  constructor(
    private readonly users: UserRepository,
    private readonly refreshTokens: RefreshTokenRepository,
    private readonly hasher: PasswordHasherPort,
    private readonly tokens: TokenServicePort,
    private readonly audit: AuditLoggerPort,
  ) {}

  async execute(input: LoginInput): Promise<LoginResult> {
    const user = await this.users.findByEmail(input.email.toLowerCase());

    // Mismo mensaje y mismo costo aproximado exista o no el usuario: no se filtra
    // que correos estan registrados.
    if (!user) {
      await this.hasher.compare(input.password, '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv');
      throw new UnauthorizedError('Credenciales invalidas');
    }
    const valid = await this.hasher.compare(input.password, user.passwordHash);
    if (!valid) {
      await this.audit.log({
        userId: user.id,
        action: 'LOGIN_FAILED',
        entity: 'User',
        entityId: user.id,
        ip: input.ip,
        userAgent: input.userAgent,
      });
      throw new UnauthorizedError('Credenciales invalidas');
    }
    if (!user.isActive) throw new UnauthorizedError('La cuenta esta desactivada');

    const accessToken = this.tokens.signAccessToken({
      sub: user.id,
      role: user.role,
      employeeId: user.employeeId,
      email: user.email,
    });
    const refresh = this.tokens.generateRefreshToken();
    await this.refreshTokens.save({
      userId: user.id,
      tokenHash: refresh.tokenHash,
      expiresAt: refresh.expiresAt,
      ip: input.ip,
      userAgent: input.userAgent,
    });
    await this.users.touchLastLogin(user.id);
    await this.audit.log({
      userId: user.id,
      action: 'LOGIN',
      entity: 'User',
      entityId: user.id,
      ip: input.ip,
      userAgent: input.userAgent,
    });

    const { passwordHash: _omit, ...safeUser } = user;
    return {
      accessToken,
      refreshToken: refresh.token,
      refreshExpiresAt: refresh.expiresAt,
      user: safeUser,
    };
  }
}
