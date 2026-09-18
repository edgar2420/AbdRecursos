import { AuditLoggerPort } from '../../../../shared/application/AuditLogger';
import { ConflictError, ForbiddenError, NotFoundError } from '../../../../shared/domain/errors';
import { Paginated, PageQuery } from '../../../../shared/domain/pagination';
import { PasswordHasherPort } from '../../../../shared/infrastructure/security/PasswordHasher';
import { Role, User } from '../../domain/entities/User';
import { RefreshTokenRepository } from '../../domain/repositories/RefreshTokenRepository';
import { UserRepository } from '../../domain/repositories/UserRepository';

export class ListUsers {
  constructor(private readonly users: UserRepository) {}

  execute(query: PageQuery & { role?: Role; isActive?: boolean }): Promise<Paginated<User>> {
    return this.users.list(query);
  }
}

export class CreateUser {
  constructor(
    private readonly users: UserRepository,
    private readonly hasher: PasswordHasherPort,
    private readonly audit: AuditLoggerPort,
  ) {}

  async execute(
    input: { email: string; password: string; role: Role; employeeId?: string | null },
    actorId: string,
  ): Promise<User> {
    const email = input.email.toLowerCase();
    if (await this.users.findByEmail(email)) {
      throw new ConflictError('Ya existe un usuario con ese correo');
    }
    const user = await this.users.create({
      email,
      passwordHash: await this.hasher.hash(input.password),
      role: input.role,
      employeeId: input.employeeId ?? null,
    });
    await this.audit.log({
      userId: actorId,
      action: 'USER_CREATED',
      entity: 'User',
      entityId: user.id,
      changes: { email, role: input.role },
    });
    return user;
  }
}

export class UpdateUserRole {
  constructor(
    private readonly users: UserRepository,
    private readonly refreshTokens: RefreshTokenRepository,
    private readonly audit: AuditLoggerPort,
  ) {}

  async execute(userId: string, role: Role, actorId: string): Promise<User> {
    const target = await this.users.findById(userId);
    if (!target) throw new NotFoundError('Usuario');
    if (target.id === actorId) throw new ForbiddenError('No puede cambiar su propio rol');

    const updated = await this.users.updateRole(userId, role);
    await this.refreshTokens.revokeAllForUser(userId);
    await this.audit.log({
      userId: actorId,
      action: 'USER_ROLE_CHANGED',
      entity: 'User',
      entityId: userId,
      changes: { from: target.role, to: role },
    });
    return updated;
  }
}

export class SetUserActive {
  constructor(
    private readonly users: UserRepository,
    private readonly refreshTokens: RefreshTokenRepository,
    private readonly audit: AuditLoggerPort,
  ) {}

  async execute(userId: string, isActive: boolean, actorId: string): Promise<User> {
    const target = await this.users.findById(userId);
    if (!target) throw new NotFoundError('Usuario');
    if (target.id === actorId) throw new ForbiddenError('No puede desactivar su propia cuenta');

    const updated = await this.users.setActive(userId, isActive);
    if (!isActive) await this.refreshTokens.revokeAllForUser(userId);
    await this.audit.log({
      userId: actorId,
      action: isActive ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
      entity: 'User',
      entityId: userId,
    });
    return updated;
  }
}

export class ResetUserPassword {
  constructor(
    private readonly users: UserRepository,
    private readonly refreshTokens: RefreshTokenRepository,
    private readonly hasher: PasswordHasherPort,
    private readonly audit: AuditLoggerPort,
  ) {}

  async execute(userId: string, newPassword: string, actorId: string): Promise<void> {
    const target = await this.users.findById(userId);
    if (!target) throw new NotFoundError('Usuario');
    await this.users.updatePassword(userId, await this.hasher.hash(newPassword), true);
    await this.refreshTokens.revokeAllForUser(userId);
    await this.audit.log({
      userId: actorId,
      action: 'USER_PASSWORD_RESET',
      entity: 'User',
      entityId: userId,
    });
  }
}
