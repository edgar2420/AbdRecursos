import { Prisma } from '@prisma/client';
import { prisma } from '../../../../shared/infrastructure/database/prisma';
import { buildMeta, Paginated, PageQuery } from '../../../../shared/domain/pagination';
import {
  NewSchedule,
  NewScheduleAssignment,
  Schedule,
  ScheduleAssignment,
} from '../../domain/entities/Schedule';
import { ScheduleRepository } from '../../domain/repositories/ScheduleRepository';

type ScheduleRow = Prisma.ScheduleGetPayload<{ include: { _count: { select: { assignments: true } } } }>;

const assignmentInclude = {
  schedule: true,
  employee: {
    select: { firstName: true, lastName: true, department: { select: { name: true } } },
  },
} satisfies Prisma.ScheduleAssignmentInclude;

type AssignmentRow = Prisma.ScheduleAssignmentGetPayload<{ include: typeof assignmentInclude }>;

function toSchedule(row: ScheduleRow): Schedule {
  return {
    id: row.id,
    name: row.name,
    startTime: row.startTime,
    endTime: row.endTime,
    breakMinutes: row.breakMinutes,
    toleranceMinutes: row.toleranceMinutes,
    weekDays: row.weekDays,
    isNightShift: row.isNightShift,
    isActive: row.isActive,
    assignedCount: row._count?.assignments,
  };
}

function toAssignment(row: AssignmentRow): ScheduleAssignment {
  return {
    id: row.id,
    scheduleId: row.scheduleId,
    scheduleName: row.schedule.name,
    startTime: row.schedule.startTime,
    endTime: row.schedule.endTime,
    toleranceMinutes: row.schedule.toleranceMinutes,
    weekDays: row.schedule.weekDays,
    employeeId: row.employeeId,
    employeeName: `${row.employee.firstName} ${row.employee.lastName}`,
    departmentName: row.employee.department?.name ?? null,
    validFrom: row.validFrom,
    validUntil: row.validUntil,
    isActive: row.isActive,
  };
}

export class PrismaScheduleRepository implements ScheduleRepository {
  async findById(id: string): Promise<Schedule | null> {
    const row = await prisma.schedule.findUnique({
      where: { id },
      include: { _count: { select: { assignments: true } } },
    });
    return row ? toSchedule(row) : null;
  }

  async list(query: PageQuery & { isActive?: boolean }): Promise<Paginated<Schedule>> {
    const where: Prisma.ScheduleWhereInput = {
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      ...(query.search ? { name: { contains: query.search, mode: 'insensitive' } } : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.schedule.findMany({
        where,
        include: { _count: { select: { assignments: true } } },
        orderBy: { name: 'asc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      prisma.schedule.count({ where }),
    ]);
    return { data: rows.map(toSchedule), meta: buildMeta(total, query.page, query.limit) };
  }

  async create(data: NewSchedule): Promise<Schedule> {
    const row = await prisma.schedule.create({
      data: {
        name: data.name,
        startTime: data.startTime,
        endTime: data.endTime,
        breakMinutes: data.breakMinutes,
        toleranceMinutes: data.toleranceMinutes,
        weekDays: data.weekDays,
        isNightShift: data.isNightShift ?? false,
      },
      include: { _count: { select: { assignments: true } } },
    });
    return toSchedule(row);
  }

  async update(id: string, data: Partial<NewSchedule> & { isActive?: boolean }): Promise<Schedule> {
    const row = await prisma.schedule.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.startTime !== undefined ? { startTime: data.startTime } : {}),
        ...(data.endTime !== undefined ? { endTime: data.endTime } : {}),
        ...(data.breakMinutes !== undefined ? { breakMinutes: data.breakMinutes } : {}),
        ...(data.toleranceMinutes !== undefined ? { toleranceMinutes: data.toleranceMinutes } : {}),
        ...(data.weekDays !== undefined ? { weekDays: data.weekDays } : {}),
        ...(data.isNightShift !== undefined ? { isNightShift: data.isNightShift } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
      include: { _count: { select: { assignments: true } } },
    });
    return toSchedule(row);
  }

  async listAssignments(
    query: PageQuery & { employeeId?: string; scheduleId?: string; departmentId?: string; at?: Date },
  ): Promise<Paginated<ScheduleAssignment>> {
    const where: Prisma.ScheduleAssignmentWhereInput = {
      ...(query.employeeId ? { employeeId: query.employeeId } : {}),
      ...(query.scheduleId ? { scheduleId: query.scheduleId } : {}),
      ...(query.departmentId ? { employee: { departmentId: query.departmentId } } : {}),
      ...(query.at
        ? {
            isActive: true,
            validFrom: { lte: query.at },
            OR: [{ validUntil: null }, { validUntil: { gte: query.at } }],
          }
        : {}),
      ...(query.search
        ? {
            employee: {
              OR: [
                { firstName: { contains: query.search, mode: 'insensitive' } },
                { lastName: { contains: query.search, mode: 'insensitive' } },
              ],
            },
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.scheduleAssignment.findMany({
        where,
        include: assignmentInclude,
        orderBy: { validFrom: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      prisma.scheduleAssignment.count({ where }),
    ]);
    return { data: rows.map(toAssignment), meta: buildMeta(total, query.page, query.limit) };
  }

  async assign(data: NewScheduleAssignment): Promise<ScheduleAssignment> {
    const row = await prisma.scheduleAssignment.create({
      data: {
        scheduleId: data.scheduleId,
        employeeId: data.employeeId,
        validFrom: data.validFrom,
        validUntil: data.validUntil ?? null,
      },
      include: assignmentInclude,
    });
    return toAssignment(row);
  }

  async endAssignment(id: string, validUntil: Date): Promise<ScheduleAssignment> {
    const row = await prisma.scheduleAssignment.update({
      where: { id },
      data: { validUntil, isActive: false },
      include: assignmentInclude,
    });
    return toAssignment(row);
  }

  async findActiveForEmployee(employeeId: string, at: Date): Promise<ScheduleAssignment | null> {
    const row = await prisma.scheduleAssignment.findFirst({
      where: {
        employeeId,
        isActive: true,
        validFrom: { lte: at },
        OR: [{ validUntil: null }, { validUntil: { gte: at } }],
      },
      include: assignmentInclude,
      orderBy: { validFrom: 'desc' },
    });
    return row ? toAssignment(row) : null;
  }

  async findActiveForEmployees(employeeIds: string[], at: Date): Promise<ScheduleAssignment[]> {
    const rows = await prisma.scheduleAssignment.findMany({
      where: {
        employeeId: { in: employeeIds },
        isActive: true,
        validFrom: { lte: at },
        OR: [{ validUntil: null }, { validUntil: { gte: at } }],
      },
      include: assignmentInclude,
      orderBy: { validFrom: 'desc' },
    });
    return rows.map(toAssignment);
  }

  async hasOverlappingAssignment(employeeId: string, from: Date, to: Date | null): Promise<boolean> {
    const found = await prisma.scheduleAssignment.findFirst({
      where: {
        employeeId,
        isActive: true,
        validFrom: to ? { lte: to } : undefined,
        OR: [{ validUntil: null }, { validUntil: { gte: from } }],
      },
      select: { id: true },
    });
    return found !== null;
  }
}
