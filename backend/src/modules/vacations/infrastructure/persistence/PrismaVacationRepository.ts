import { Prisma, VacationStatus as PrismaVacationStatus } from '@prisma/client';
import { prisma } from '../../../../shared/infrastructure/database/prisma';
import { buildMeta, Paginated } from '../../../../shared/domain/pagination';
import { safeSort } from '../../../../shared/infrastructure/http/query';
import {
  NewVacationRequest,
  VacationRequest,
  VacationStatus,
} from '../../domain/entities/VacationRequest';
import {
  HolidayRepository,
  VacationFilters,
  VacationRepository,
} from '../../domain/repositories/VacationRepository';

const include = {
  employee: {
    select: {
      firstName: true,
      lastName: true,
      supervisorId: true,
      department: { select: { name: true } },
    },
  },
} satisfies Prisma.VacationRequestInclude;

type Row = Prisma.VacationRequestGetPayload<{ include: typeof include }>;

const SORTABLE = ['startDate', 'endDate', 'createdAt', 'status'] as const;

interface Aprobador {
  nombre: string;
  rol: string;
}

/**
 * Resuelve en bloque quien aprobo/rechazo cada solicitud, para poder decir
 * "aprobado por Fulano de Tal" en vez de dejarlo como un identificador interno.
 * El rol viaja junto al nombre: es lo que permite distinguir una aprobacion
 * normal del supervisor de una aprobacion de emergencia hecha por RRHH.
 */
async function resolverAprobadores(ids: (string | null)[]): Promise<Map<string, Aprobador>> {
  const limpios = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (limpios.length === 0) return new Map();
  const usuarios = await prisma.user.findMany({
    where: { id: { in: limpios } },
    select: { id: true, email: true, role: true, employee: { select: { firstName: true, lastName: true } } },
  });
  return new Map(
    usuarios.map((u) => [
      u.id,
      { nombre: u.employee ? `${u.employee.firstName} ${u.employee.lastName}` : u.email, rol: u.role },
    ]),
  );
}

function toDomain(row: Row, aprobadores: Map<string, Aprobador>): VacationRequest {
  const supervisor = row.supervisorApprovedBy ? aprobadores.get(row.supervisorApprovedBy) : undefined;
  const hr = row.hrApprovedBy ? aprobadores.get(row.hrApprovedBy) : undefined;
  const rechazo = row.rejectedBy ? aprobadores.get(row.rejectedBy) : undefined;

  return {
    id: row.id,
    employeeId: row.employeeId,
    employeeName: `${row.employee.firstName} ${row.employee.lastName}`,
    departmentName: row.employee.department?.name ?? null,
    supervisorId: row.employee.supervisorId,
    startDate: row.startDate,
    endDate: row.endDate,
    workingDays: Number(row.workingDays),
    reason: row.reason,
    status: row.status as VacationStatus,
    supervisorApprovedAt: row.supervisorApprovedAt,
    supervisorApprovedByName: supervisor?.nombre ?? null,
    // Si quien cerro el paso del supervisor tiene rol HR, fue una aprobacion
    // de emergencia (solo RRHH puede sustituir al supervisor real).
    supervisorApprovalIsEmergency: supervisor?.rol === 'HR',
    emergencyReason: row.emergencyReason,
    hrApprovedAt: row.hrApprovedAt,
    hrApprovedByName: hr?.nombre ?? null,
    rejectedAt: row.rejectedAt,
    rejectedByName: rechazo?.nombre ?? null,
    rejectionReason: row.rejectionReason,
    createdAt: row.createdAt,
  };
}

async function unaFila(row: Row): Promise<VacationRequest> {
  const aprobadores = await resolverAprobadores([row.supervisorApprovedBy, row.hrApprovedBy, row.rejectedBy]);
  return toDomain(row, aprobadores);
}

async function variasFilas(rows: Row[]): Promise<VacationRequest[]> {
  const aprobadores = await resolverAprobadores(
    rows.flatMap((r) => [r.supervisorApprovedBy, r.hrApprovedBy, r.rejectedBy]),
  );
  return rows.map((r) => toDomain(r, aprobadores));
}

function buildWhere(filters: VacationFilters): Prisma.VacationRequestWhereInput {
  return {
    ...(filters.employeeId ? { employeeId: filters.employeeId } : {}),
    ...(filters.employeeIds ? { employeeId: { in: filters.employeeIds } } : {}),
    ...(filters.status ? { status: filters.status as PrismaVacationStatus } : {}),
    ...(filters.departmentId ? { employee: { departmentId: filters.departmentId } } : {}),
    ...(filters.dateFrom ? { endDate: { gte: filters.dateFrom } } : {}),
    ...(filters.dateTo ? { startDate: { lte: filters.dateTo } } : {}),
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
}

export class PrismaVacationRepository implements VacationRepository {
  async findById(id: string): Promise<VacationRequest | null> {
    const row = await prisma.vacationRequest.findUnique({ where: { id }, include });
    return row ? unaFila(row) : null;
  }

  async list(filters: VacationFilters): Promise<Paginated<VacationRequest>> {
    const where = buildWhere(filters);
    const sort = safeSort(filters.sort, SORTABLE, 'createdAt');
    const [rows, total] = await Promise.all([
      prisma.vacationRequest.findMany({
        where,
        include,
        orderBy: { [sort]: filters.order ?? 'desc' },
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
      }),
      prisma.vacationRequest.count({ where }),
    ]);
    return { data: await variasFilas(rows), meta: buildMeta(total, filters.page, filters.limit) };
  }

  async listInRange(from: Date, to: Date, employeeIds?: string[]): Promise<VacationRequest[]> {
    const rows = await prisma.vacationRequest.findMany({
      where: {
        startDate: { lte: to },
        endDate: { gte: from },
        ...(employeeIds ? { employeeId: { in: employeeIds } } : {}),
      },
      include,
      orderBy: { startDate: 'asc' },
    });
    return variasFilas(rows);
  }

  async create(data: NewVacationRequest): Promise<VacationRequest> {
    const row = await prisma.vacationRequest.create({
      data: {
        employeeId: data.employeeId,
        startDate: data.startDate,
        endDate: data.endDate,
        workingDays: new Prisma.Decimal(data.workingDays),
        reason: data.reason ?? null,
        status: data.status as PrismaVacationStatus,
      },
      include,
    });
    return unaFila(row);
  }

  async updateStatus(
    id: string,
    data: {
      status: VacationStatus;
      supervisorApprovedBy?: string | null;
      hrApprovedBy?: string | null;
      rejectedBy?: string | null;
      rejectionReason?: string | null;
      emergencyReason?: string | null;
    },
  ): Promise<VacationRequest> {
    const now = new Date();
    const row = await prisma.vacationRequest.update({
      where: { id },
      data: {
        status: data.status as PrismaVacationStatus,
        ...(data.supervisorApprovedBy
          ? {
              supervisorApprovedBy: data.supervisorApprovedBy,
              supervisorApprovedAt: now,
              emergencyReason: data.emergencyReason ?? null,
            }
          : {}),
        ...(data.hrApprovedBy ? { hrApprovedBy: data.hrApprovedBy, hrApprovedAt: now } : {}),
        ...(data.rejectedBy
          ? { rejectedBy: data.rejectedBy, rejectedAt: now, rejectionReason: data.rejectionReason ?? null }
          : {}),
      },
      include,
    });
    return unaFila(row);
  }

  /** Aprobadas = dias consumidos; en tramite = dias comprometidos (aun no descontados). */
  async sumDays(employeeId: string, year: number): Promise<{ approved: number; pending: number }> {
    const range = { gte: new Date(year, 0, 1), lte: new Date(year, 11, 31, 23, 59, 59) };
    const [approved, pending] = await Promise.all([
      prisma.vacationRequest.aggregate({
        _sum: { workingDays: true },
        where: { employeeId, status: 'APPROVED', startDate: range },
      }),
      prisma.vacationRequest.aggregate({
        _sum: { workingDays: true },
        where: { employeeId, status: { in: ['PENDING_SUPERVISOR', 'PENDING_HR'] }, startDate: range },
      }),
    ]);
    return {
      approved: Number(approved._sum.workingDays ?? 0),
      pending: Number(pending._sum.workingDays ?? 0),
    };
  }

  async listConsuming(employeeId: string): Promise<VacationRequest[]> {
    const rows = await prisma.vacationRequest.findMany({
      where: {
        employeeId,
        status: { in: ['PENDING_SUPERVISOR', 'PENDING_HR', 'APPROVED'] },
      },
      include,
      orderBy: { startDate: 'asc' },
    });
    return variasFilas(rows);
  }

  async historicalGestiones(
    employeeId: string,
  ): Promise<{ periodYear: number; entitledDays: number; takenDays: number }[]> {
    const rows = await prisma.vacationBalance.findMany({
      where: { employeeId },
      orderBy: { periodYear: 'asc' },
    });
    return rows.map((r) => ({
      periodYear: r.periodYear,
      entitledDays: Number(r.entitledDays),
      takenDays: Number(r.takenDays),
    }));
  }

  async hasOverlap(employeeId: string, from: Date, to: Date, excludeId?: string): Promise<boolean> {
    const found = await prisma.vacationRequest.findFirst({
      where: {
        employeeId,
        status: { in: ['PENDING_SUPERVISOR', 'PENDING_HR', 'APPROVED'] },
        startDate: { lte: to },
        endDate: { gte: from },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
    return found !== null;
  }

  async countPending(employeeIds?: string[]): Promise<number> {
    return prisma.vacationRequest.count({
      where: {
        status: { in: ['PENDING_SUPERVISOR', 'PENDING_HR'] },
        ...(employeeIds ? { employeeId: { in: employeeIds } } : {}),
      },
    });
  }
}

export class PrismaHolidayRepository implements HolidayRepository {
  async listBetween(from: Date, to: Date): Promise<Date[]> {
    const rows = await prisma.holiday.findMany({
      where: { date: { gte: from, lte: to } },
      select: { date: true },
    });
    return rows.map((r) => r.date);
  }
}
