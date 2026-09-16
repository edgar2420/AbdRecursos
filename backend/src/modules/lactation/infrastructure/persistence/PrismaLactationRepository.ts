import { Prisma } from '@prisma/client';
import { prisma } from '../../../../shared/infrastructure/database/prisma';
import { buildMeta, Paginated } from '../../../../shared/domain/pagination';
import { daysBetween } from '../../../../shared/domain/dates';
import { LactationPermit, NewLactationPermit } from '../../domain/entities/LactationPermit';
import { LactationFilters, LactationRepository } from '../../domain/repositories/LactationRepository';

const include = {
  employee: {
    select: { firstName: true, lastName: true, department: { select: { name: true } } },
  },
} satisfies Prisma.LactationPermitInclude;

type Row = Prisma.LactationPermitGetPayload<{ include: typeof include }>;

function toDomain(row: Row): LactationPermit {
  return {
    id: row.id,
    employeeId: row.employeeId,
    employeeName: `${row.employee.firstName} ${row.employee.lastName}`,
    departmentName: row.employee.department?.name ?? null,
    birthDate: row.birthDate,
    childName: row.childName,
    startDate: row.startDate,
    endDate: row.endDate,
    dailyMinutes: row.dailyMinutes,
    slot1Start: row.slot1Start,
    slot1End: row.slot1End,
    slot2Start: row.slot2Start,
    slot2End: row.slot2End,
    documentUrl: row.documentUrl,
    isActive: row.isActive,
    notes: row.notes,
    daysRemaining: Math.max(0, daysBetween(new Date(), row.endDate)),
  };
}

export class PrismaLactationRepository implements LactationRepository {
  async findById(id: string): Promise<LactationPermit | null> {
    const row = await prisma.lactationPermit.findUnique({ where: { id }, include });
    return row ? toDomain(row) : null;
  }

  async findActiveByEmployee(employeeId: string): Promise<LactationPermit | null> {
    const row = await prisma.lactationPermit.findFirst({
      where: { employeeId, isActive: true, endDate: { gte: new Date() } },
      include,
    });
    return row ? toDomain(row) : null;
  }

  async list(filters: LactationFilters): Promise<Paginated<LactationPermit>> {
    const where: Prisma.LactationPermitWhereInput = {
      ...(filters.employeeId ? { employeeId: filters.employeeId } : {}),
      ...(filters.isActive !== undefined ? { isActive: filters.isActive } : {}),
      ...(filters.departmentId ? { employee: { departmentId: filters.departmentId } } : {}),
      ...(filters.expiringBefore ? { endDate: { lte: filters.expiringBefore, gte: new Date() } } : {}),
      ...(filters.search
        ? {
            employee: {
              OR: [
                { firstName: { contains: filters.search, mode: 'insensitive' } },
                { lastName: { contains: filters.search, mode: 'insensitive' } },
              ],
            },
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.lactationPermit.findMany({
        where,
        include,
        orderBy: { endDate: filters.order ?? 'asc' },
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
      }),
      prisma.lactationPermit.count({ where }),
    ]);
    return { data: rows.map(toDomain), meta: buildMeta(total, filters.page, filters.limit) };
  }

  async create(data: NewLactationPermit): Promise<LactationPermit> {
    const row = await prisma.lactationPermit.create({
      data: {
        employeeId: data.employeeId,
        birthDate: data.birthDate,
        childName: data.childName ?? null,
        startDate: data.startDate,
        endDate: data.endDate,
        dailyMinutes: data.dailyMinutes,
        slot1Start: data.slot1Start ?? null,
        slot1End: data.slot1End ?? null,
        slot2Start: data.slot2Start ?? null,
        slot2End: data.slot2End ?? null,
        documentUrl: data.documentUrl ?? null,
        notes: data.notes ?? null,
      },
      include,
    });
    return toDomain(row);
  }

  async update(
    id: string,
    data: Partial<NewLactationPermit> & { isActive?: boolean },
  ): Promise<LactationPermit> {
    const row = await prisma.lactationPermit.update({
      where: { id },
      data: {
        ...(data.childName !== undefined ? { childName: data.childName } : {}),
        ...(data.slot1Start !== undefined ? { slot1Start: data.slot1Start } : {}),
        ...(data.slot1End !== undefined ? { slot1End: data.slot1End } : {}),
        ...(data.slot2Start !== undefined ? { slot2Start: data.slot2Start } : {}),
        ...(data.slot2End !== undefined ? { slot2End: data.slot2End } : {}),
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
        ...(data.documentUrl !== undefined ? { documentUrl: data.documentUrl } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
      include,
    });
    return toDomain(row);
  }

  async countExpiring(before: Date): Promise<number> {
    return prisma.lactationPermit.count({
      where: { isActive: true, endDate: { gte: new Date(), lte: before } },
    });
  }
}
