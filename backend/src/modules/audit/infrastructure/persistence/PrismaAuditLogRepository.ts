import { Prisma } from '@prisma/client';
import { prisma } from '../../../../shared/infrastructure/database/prisma';
import { buildMeta, Paginated } from '../../../../shared/domain/pagination';
import { AuditLogEntry } from '../../domain/entities/AuditLogEntry';
import { AuditLogFilters, AuditLogRepository } from '../../domain/repositories/AuditLogRepository';

const include = {
  user: { select: { email: true, employee: { select: { firstName: true, lastName: true } } } },
} satisfies Prisma.AuditLogInclude;

type Row = Prisma.AuditLogGetPayload<{ include: typeof include }>;

function toDomain(row: Row): AuditLogEntry {
  const userName = row.user
    ? row.user.employee
      ? `${row.user.employee.firstName} ${row.user.employee.lastName}`
      : row.user.email
    : null;
  return {
    id: row.id,
    userId: row.userId,
    userName,
    action: row.action,
    entity: row.entity,
    entityId: row.entityId,
    changes: row.changes,
    ip: row.ip,
    userAgent: row.userAgent,
    createdAt: row.createdAt,
  };
}

export class PrismaAuditLogRepository implements AuditLogRepository {
  async list(filters: AuditLogFilters): Promise<Paginated<AuditLogEntry>> {
    const where: Prisma.AuditLogWhereInput = {
      ...(filters.entity ? { entity: filters.entity } : {}),
      ...(filters.action ? { action: filters.action } : {}),
      ...(filters.userId ? { userId: filters.userId } : {}),
      ...(filters.dateFrom || filters.dateTo
        ? {
            createdAt: {
              ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
              ...(filters.dateTo ? { lte: filters.dateTo } : {}),
            },
          }
        : {}),
      ...(filters.search
        ? {
            OR: [
              { action: { contains: filters.search, mode: 'insensitive' } },
              { entity: { contains: filters.search, mode: 'insensitive' } },
              { user: { email: { contains: filters.search, mode: 'insensitive' } } },
              { user: { employee: { firstName: { contains: filters.search, mode: 'insensitive' } } } },
              { user: { employee: { lastName: { contains: filters.search, mode: 'insensitive' } } } },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include,
        orderBy: { createdAt: 'desc' },
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
      }),
      prisma.auditLog.count({ where }),
    ]);
    return { data: rows.map(toDomain), meta: buildMeta(total, filters.page, filters.limit) };
  }
}
