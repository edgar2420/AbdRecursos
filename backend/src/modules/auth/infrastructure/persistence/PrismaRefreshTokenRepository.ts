import { prisma } from '../../../../shared/infrastructure/database/prisma';
import {
  RefreshTokenRepository,
  StoredRefreshToken,
} from '../../domain/repositories/RefreshTokenRepository';

export class PrismaRefreshTokenRepository implements RefreshTokenRepository {
  async save(data: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    userAgent?: string | null;
    ip?: string | null;
  }): Promise<StoredRefreshToken> {
    const row = await prisma.refreshToken.create({
      data: {
        userId: data.userId,
        tokenHash: data.tokenHash,
        expiresAt: data.expiresAt,
        userAgent: data.userAgent ?? null,
        ip: data.ip ?? null,
      },
    });
    return row;
  }

  async findByHash(tokenHash: string): Promise<StoredRefreshToken | null> {
    return prisma.refreshToken.findUnique({ where: { tokenHash } });
  }

  async revoke(id: string, replacedBy?: string | null): Promise<void> {
    await prisma.refreshToken.update({
      where: { id },
      data: { revokedAt: new Date(), replacedBy: replacedBy ?? null },
    });
  }

  async touch(id: string, at: Date): Promise<void> {
    await prisma.refreshToken.update({ where: { id }, data: { lastUsedAt: at } });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async deleteExpired(): Promise<number> {
    const result = await prisma.refreshToken.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    return result.count;
  }
}
