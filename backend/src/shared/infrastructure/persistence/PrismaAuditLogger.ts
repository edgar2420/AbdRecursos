import { AuditEvent, AuditLoggerPort } from '../../application/AuditLogger';
import { prisma } from '../database/prisma';
import { logger } from '../logger/logger';

export class PrismaAuditLogger implements AuditLoggerPort {
  async log(event: AuditEvent): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          userId: event.userId ?? null,
          action: event.action,
          entity: event.entity,
          entityId: event.entityId ?? null,
          changes: (event.changes ?? undefined) as never,
          ip: event.ip ?? null,
          userAgent: event.userAgent ?? null,
        },
      });
    } catch (error) {
      logger.error({ err: error, event }, 'No se pudo escribir el registro de auditoria');
    }
  }
}
