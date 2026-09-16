import { AuditLoggerPort } from '../../../../shared/application/AuditLogger';
import { NotFoundError, UnauthorizedError, ValidationError } from '../../../../shared/domain/errors';
import { PasswordHasherPort } from '../../../../shared/infrastructure/security/PasswordHasher';
import { RefreshTokenRepository } from '../../domain/repositories/RefreshTokenRepository';
import { UserRepository } from '../../domain/repositories/UserRepository';

export class ChangePassword {
  constructor(
    private readonly users: UserRepository,
    private readonly refreshTokens: RefreshTokenRepository,
    private readonly hasher: PasswordHasherPort,
    private readonly audit: AuditLoggerPort,
  ) {}

  async execute(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.users.findById(userId);
    if (!user) throw new NotFoundError('Usuario');

    const valid = await this.hasher.compare(currentPassword, user.passwordHash);
    if (!valid) throw new UnauthorizedError('La contrasena actual no es correcta');
    if (currentPassword === newPassword) {
      throw new ValidationError('La nueva contrasena debe ser distinta de la actual');
    }

    await this.users.updatePassword(userId, await this.hasher.hash(newPassword));
    // Al cambiar la contrasena se cierran las demas sesiones.
    await this.refreshTokens.revokeAllForUser(userId);
    await this.audit.log({ userId, action: 'PASSWORD_CHANGED', entity: 'User', entityId: userId });
  }
}
