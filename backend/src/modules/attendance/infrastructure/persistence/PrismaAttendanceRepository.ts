import { AttendanceSource as PrismaSource, AttendanceType as PrismaType, Prisma } from '@prisma/client';
import { prisma } from '../../../../shared/infrastructure/database/prisma';
import { buildMeta, Paginated, PageQuery } from '../../../../shared/domain/pagination';
import { endOfDay, startOfDay } from '../../../../shared/domain/dates';
import {
  AttendanceJustification,
  AttendanceRecord,
  AttendanceSource,
  AttendanceType,
  JustificationStatus,
  NewAttendanceRecord,
} from '../../domain/entities/AttendanceRecord';
import { AttendanceFilters, AttendanceRepository } from '../../domain/repositories/AttendanceRepository';

const include = {
  employee: {
    select: { firstName: true, lastName: true, department: { select: { name: true } } },
  },
} satisfies Prisma.AttendanceRecordInclude;

type Row = Prisma.AttendanceRecordGetPayload<{ include: typeof include }>;

function toDomain(row: Row): AttendanceRecord {
  return {
    id: row.id,
    employeeId: row.employeeId,
    employeeName: `${row.employee.firstName} ${row.employee.lastName}`,
    departmentName: row.employee.department?.name ?? null,
    timestamp: row.timestamp,
    type: row.type as AttendanceType,
    source: row.source as AttendanceSource,
    deviceId: row.deviceId,
    notes: row.notes,
    lateMinutes: row.lateMinutes,
  };
}

type JustificationRow = Prisma.AttendanceJustificationGetPayload<{
  include: { employee: { select: { firstName: true; lastName: true } } };
}>;

function toJustification(row: JustificationRow): AttendanceJustification {
  return {
    id: row.id,
    employeeId: row.employeeId,
    employeeName: `${row.employee.firstName} ${row.employee.lastName}`,
    date: row.date,
    reason: row.reason,
    attachmentUrl: row.attachmentUrl,
    status: row.status as JustificationStatus,
    reviewedAt: row.reviewedAt,
    reviewNotes: row.reviewNotes,
    createdAt: row.createdAt,
  };
}

export class PrismaAttendanceRepository implements AttendanceRepository {
  async create(data: NewAttendanceRecord): Promise<AttendanceRecord> {
    const row = await prisma.attendanceRecord.create({
      data: {
        employeeId: data.employeeId,
        timestamp: data.timestamp,
        type: data.type as PrismaType,
        source: data.source as PrismaSource,
        deviceId: data.deviceId ?? null,
        latitude: data.latitude != null ? new Prisma.Decimal(data.latitude) : null,
        longitude: data.longitude != null ? new Prisma.Decimal(data.longitude) : null,
        notes: data.notes ?? null,
        lateMinutes: data.lateMinutes ?? 0,
      },
      include,
    });
    return toDomain(row);
  }

  async createMany(data: NewAttendanceRecord[]): Promise<number> {
    const result = await prisma.attendanceRecord.createMany({
      data: data.map((d) => ({
        employeeId: d.employeeId,
        timestamp: d.timestamp,
        type: d.type as PrismaType,
        source: d.source as PrismaSource,
        deviceId: d.deviceId ?? null,
        notes: d.notes ?? null,
        lateMinutes: d.lateMinutes ?? 0,
      })),
      skipDuplicates: true,
    });
    return result.count;
  }

  async list(filters: AttendanceFilters): Promise<Paginated<AttendanceRecord>> {
    const where: Prisma.AttendanceRecordWhereInput = {
      ...(filters.employeeId ? { employeeId: filters.employeeId } : {}),
      ...(filters.employeeIds ? { employeeId: { in: filters.employeeIds } } : {}),
      ...(filters.type ? { type: filters.type as PrismaType } : {}),
      ...(filters.departmentId ? { employee: { departmentId: filters.departmentId } } : {}),
      ...(filters.dateFrom || filters.dateTo
        ? {
            timestamp: {
              ...(filters.dateFrom ? { gte: startOfDay(filters.dateFrom) } : {}),
              ...(filters.dateTo ? { lte: endOfDay(filters.dateTo) } : {}),
            },
          }
        : {}),
      ...(filters.search
        ? {
            employee: {
              OR: [
                { firstName: { contains: filters.search, mode: 'insensitive' } },
                { lastName: { contains: filters.search, mode: 'insensitive' } },
                { employeeCode: { contains: filters.search, mode: 'insensitive' } },
              ],
            },
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.attendanceRecord.findMany({
        where,
        include,
        orderBy: { timestamp: filters.order ?? 'desc' },
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
      }),
      prisma.attendanceRecord.count({ where }),
    ]);
    return { data: rows.map(toDomain), meta: buildMeta(total, filters.page, filters.limit) };
  }

  async listBetween(from: Date, to: Date, employeeIds?: string[]): Promise<AttendanceRecord[]> {
    const rows = await prisma.attendanceRecord.findMany({
      where: {
        timestamp: { gte: startOfDay(from), lte: endOfDay(to) },
        ...(employeeIds ? { employeeId: { in: employeeIds } } : {}),
      },
      include,
      orderBy: { timestamp: 'asc' },
    });
    return rows.map(toDomain);
  }

  async lastRecordOfDay(employeeId: string, date: Date): Promise<AttendanceRecord | null> {
    const row = await prisma.attendanceRecord.findFirst({
      where: { employeeId, timestamp: { gte: startOfDay(date), lte: endOfDay(date) } },
      include,
      orderBy: { timestamp: 'desc' },
    });
    return row ? toDomain(row) : null;
  }

  async findById(id: string): Promise<AttendanceRecord | null> {
    const row = await prisma.attendanceRecord.findUnique({ where: { id }, include });
    return row ? toDomain(row) : null;
  }

  async update(
    id: string,
    data: { timestamp?: Date; notes?: string | null; lateMinutes?: number },
  ): Promise<AttendanceRecord> {
    const row = await prisma.attendanceRecord.update({
      where: { id },
      data: {
        ...(data.timestamp ? { timestamp: data.timestamp } : {}),
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
        ...(data.lateMinutes !== undefined ? { lateMinutes: data.lateMinutes } : {}),
      },
      include,
    });
    return toDomain(row);
  }

  async countLateInMonth(employeeIds: string[], year: number, month: number): Promise<number> {
    return prisma.attendanceRecord.count({
      where: {
        ...(employeeIds.length ? { employeeId: { in: employeeIds } } : {}),
        type: 'CHECK_IN',
        lateMinutes: { gt: 0 },
        timestamp: { gte: new Date(year, month - 1, 1), lte: new Date(year, month, 0, 23, 59, 59) },
      },
    });
  }

  async createJustification(data: {
    employeeId: string;
    date: Date;
    reason: string;
    attachmentUrl?: string | null;
  }): Promise<AttendanceJustification> {
    const row = await prisma.attendanceJustification.create({
      data: {
        employeeId: data.employeeId,
        date: startOfDay(data.date),
        reason: data.reason,
        attachmentUrl: data.attachmentUrl ?? null,
      },
      include: { employee: { select: { firstName: true, lastName: true } } },
    });
    return toJustification(row);
  }

  async listJustifications(
    filters: PageQuery & {
      employeeIds?: string[];
      status?: JustificationStatus;
      dateFrom?: Date;
      dateTo?: Date;
    },
  ): Promise<Paginated<AttendanceJustification>> {
    const where: Prisma.AttendanceJustificationWhereInput = {
      ...(filters.employeeIds ? { employeeId: { in: filters.employeeIds } } : {}),
      ...(filters.status ? { status: filters.status as never } : {}),
      ...(filters.dateFrom || filters.dateTo
        ? {
            date: {
              ...(filters.dateFrom ? { gte: startOfDay(filters.dateFrom) } : {}),
              ...(filters.dateTo ? { lte: endOfDay(filters.dateTo) } : {}),
            },
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.attendanceJustification.findMany({
        where,
        include: { employee: { select: { firstName: true, lastName: true } } },
        orderBy: { date: 'desc' },
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
      }),
      prisma.attendanceJustification.count({ where }),
    ]);
    return { data: rows.map(toJustification), meta: buildMeta(total, filters.page, filters.limit) };
  }

  async findJustification(id: string): Promise<AttendanceJustification | null> {
    const row = await prisma.attendanceJustification.findUnique({
      where: { id },
      include: { employee: { select: { firstName: true, lastName: true } } },
    });
    return row ? toJustification(row) : null;
  }

  async reviewJustification(
    id: string,
    data: { status: JustificationStatus; reviewedBy: string; reviewNotes?: string | null },
  ): Promise<AttendanceJustification> {
    const row = await prisma.attendanceJustification.update({
      where: { id },
      data: {
        status: data.status as never,
        reviewedBy: data.reviewedBy,
        reviewedAt: new Date(),
        reviewNotes: data.reviewNotes ?? null,
      },
      include: { employee: { select: { firstName: true, lastName: true } } },
    });
    return toJustification(row);
  }

  async approvedJustificationDates(
    employeeIds: string[],
    from: Date,
    to: Date,
  ): Promise<{ employeeId: string; date: Date }[]> {
    const rows = await prisma.attendanceJustification.findMany({
      where: {
        employeeId: { in: employeeIds },
        status: 'APPROVED',
        date: { gte: startOfDay(from), lte: endOfDay(to) },
      },
      select: { employeeId: true, date: true },
    });
    return rows;
  }
}
