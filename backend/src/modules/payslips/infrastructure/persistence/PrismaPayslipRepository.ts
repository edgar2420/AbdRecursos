import { Prisma, PayslipStatus as PrismaPayslipStatus } from '@prisma/client';
import { prisma } from '../../../../shared/infrastructure/database/prisma';
import { buildMeta, Paginated } from '../../../../shared/domain/pagination';
import { searchTokensWhere } from '../../../../shared/infrastructure/http/query';
import {
  NewPayslip,
  Payslip,
  PayslipLine,
  PayslipStatus,
} from '../../domain/entities/Payslip';
import {
  EmployeeBonusRecord,
  PayslipFilters,
  PayslipRepository,
} from '../../domain/repositories/PayslipRepository';

const include = {
  employee: {
    select: {
      firstName: true,
      lastName: true,
      employeeCode: true,
      department: { select: { name: true } },
    },
  },
  details: { orderBy: { orderIndex: 'asc' } },
} satisfies Prisma.PayslipInclude;

type Row = Prisma.PayslipGetPayload<{ include: typeof include }>;

/** Nombre de quien emitio cada boleta, resuelto en bloque (evita N+1). */
async function resolverNombres(ids: (string | null)[]): Promise<Map<string, string>> {
  const limpios = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (limpios.length === 0) return new Map();
  const usuarios = await prisma.user.findMany({
    where: { id: { in: limpios } },
    select: { id: true, email: true, employee: { select: { firstName: true, lastName: true } } },
  });
  return new Map(
    usuarios.map((u) => [u.id, u.employee ? `${u.employee.firstName} ${u.employee.lastName}` : u.email]),
  );
}

function toDomain(row: Row, nombres: Map<string, string>): Payslip {
  return {
    id: row.id,
    employeeId: row.employeeId,
    employeeName: `${row.employee.firstName} ${row.employee.lastName}`,
    employeeCode: row.employee.employeeCode,
    departmentName: row.employee.department?.name ?? null,
    periodYear: row.periodYear,
    periodMonth: row.periodMonth,
    status: row.status as PayslipStatus,
    workedDays: Number(row.workedDays),
    baseSalary: Number(row.baseSalary),
    totalEarnings: Number(row.totalEarnings),
    totalDeductions: Number(row.totalDeductions),
    netPay: Number(row.netPay),
    issuedAt: row.issuedAt,
    issuedByName: row.issuedBy ? nombres.get(row.issuedBy) ?? null : null,
    createdAt: row.createdAt,
    details: row.details.map((d) => ({
      type: d.type as PayslipLine['type'],
      code: d.code,
      concept: d.concept,
      quantity: d.quantity === null ? null : Number(d.quantity),
      amount: Number(d.amount),
      orderIndex: d.orderIndex,
    })),
  };
}

async function unaFila(row: Row): Promise<Payslip> {
  const nombres = await resolverNombres([row.issuedBy]);
  return toDomain(row, nombres);
}

async function variasFilas(rows: Row[]): Promise<Payslip[]> {
  const nombres = await resolverNombres(rows.map((r) => r.issuedBy));
  return rows.map((r) => toDomain(r, nombres));
}

function detailData(details: PayslipLine[]) {
  return details.map((d) => ({
    type: d.type as never,
    code: d.code,
    concept: d.concept,
    quantity: d.quantity === null ? null : new Prisma.Decimal(d.quantity),
    amount: new Prisma.Decimal(d.amount),
    orderIndex: d.orderIndex,
  }));
}

function payslipData(data: NewPayslip) {
  return {
    employeeId: data.employeeId,
    periodYear: data.periodYear,
    periodMonth: data.periodMonth,
    workedDays: new Prisma.Decimal(data.workedDays),
    baseSalary: new Prisma.Decimal(data.baseSalary),
    totalEarnings: new Prisma.Decimal(data.totalEarnings),
    totalDeductions: new Prisma.Decimal(data.totalDeductions),
    netPay: new Prisma.Decimal(data.netPay),
    parametersSnapshot: data.parametersSnapshot as unknown as Prisma.InputJsonValue,
  };
}

export class PrismaPayslipRepository implements PayslipRepository {
  async findById(id: string): Promise<Payslip | null> {
    const row = await prisma.payslip.findUnique({ where: { id }, include });
    return row ? unaFila(row) : null;
  }

  async findByPeriod(employeeId: string, year: number, month: number): Promise<Payslip | null> {
    const row = await prisma.payslip.findUnique({
      where: { employeeId_periodYear_periodMonth: { employeeId, periodYear: year, periodMonth: month } },
      include,
    });
    return row ? unaFila(row) : null;
  }

  async list(filters: PayslipFilters): Promise<Paginated<Payslip>> {
    const where: Prisma.PayslipWhereInput = {
      ...(filters.employeeId ? { employeeId: filters.employeeId } : {}),
      ...(filters.employeeIds ? { employeeId: { in: filters.employeeIds } } : {}),
      ...(filters.periodYear ? { periodYear: filters.periodYear } : {}),
      ...(filters.periodMonth ? { periodMonth: filters.periodMonth } : {}),
      ...(filters.status
        ? { status: filters.status as PrismaPayslipStatus }
        : filters.excludeDraft
          ? { status: { not: 'DRAFT' } }
          : {}),
      ...(filters.departmentId ? { employee: { departmentId: filters.departmentId } } : {}),
      ...(filters.search
        ? searchTokensWhere(filters.search, (t) => [
            { employee: { firstName: { contains: t, mode: 'insensitive' as const } } },
            { employee: { lastName: { contains: t, mode: 'insensitive' as const } } },
            { employee: { employeeCode: { contains: t, mode: 'insensitive' as const } } },
          ])
        : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.payslip.findMany({
        where,
        include,
        orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }],
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
      }),
      prisma.payslip.count({ where }),
    ]);
    return { data: await variasFilas(rows), meta: buildMeta(total, filters.page, filters.limit) };
  }

  async listByPeriod(year: number, month: number, employeeIds?: string[]): Promise<Payslip[]> {
    const rows = await prisma.payslip.findMany({
      where: {
        periodYear: year,
        periodMonth: month,
        status: { not: 'CANCELLED' },
        ...(employeeIds ? { employeeId: { in: employeeIds } } : {}),
      },
      include,
      orderBy: { employee: { lastName: 'asc' } },
    });
    return variasFilas(rows);
  }

  async create(data: NewPayslip): Promise<Payslip> {
    const row = await prisma.payslip.create({
      data: { ...payslipData(data), details: { create: detailData(data.details) } },
      include,
    });
    return unaFila(row);
  }

  /** Regenerar un borrador reemplaza sus lineas dentro de una transaccion. */
  async replace(id: string, data: NewPayslip): Promise<Payslip> {
    const row = await prisma.$transaction(async (tx) => {
      await tx.payslipDetail.deleteMany({ where: { payslipId: id } });
      return tx.payslip.update({
        where: { id },
        data: { ...payslipData(data), details: { create: detailData(data.details) } },
        include,
      });
    });
    return unaFila(row);
  }

  async issue(ids: string[], issuedBy: string): Promise<number> {
    const result = await prisma.payslip.updateMany({
      where: { id: { in: ids }, status: 'DRAFT' },
      data: { status: 'ISSUED', issuedAt: new Date(), issuedBy },
    });
    return result.count;
  }

  async cancel(id: string): Promise<Payslip> {
    const row = await prisma.payslip.update({
      where: { id },
      data: { status: 'CANCELLED' },
      include,
    });
    return unaFila(row);
  }

  async countByPeriod(year: number, month: number): Promise<number> {
    return prisma.payslip.count({
      where: { periodYear: year, periodMonth: month, status: { not: 'CANCELLED' } },
    });
  }

  async activeBonuses(employeeIds: string[], at: Date): Promise<EmployeeBonusRecord[]> {
    const rows = await prisma.employeeBonus.findMany({
      where: {
        employeeId: { in: employeeIds },
        isActive: true,
        validFrom: { lte: at },
        OR: [{ validUntil: null }, { validUntil: { gte: at } }],
      },
    });
    return rows.map((r) => ({
      employeeId: r.employeeId,
      concept: r.concept,
      amount: r.amount === null ? null : Number(r.amount),
      percentage: r.percentage === null ? null : Number(r.percentage),
    }));
  }
}
