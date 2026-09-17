import { Prisma } from '@prisma/client';
import { prisma } from '../../../../shared/infrastructure/database/prisma';
import { endOfDay, startOfDay } from '../../../../shared/domain/dates';
import { round2 } from '../../../../shared/domain/money';
import {
  DashboardCounters,
  HeadcountByGroup,
  ReportFilters,
  ReportRepository,
} from '../../domain/repositories/ReportRepository';

function employeeScope(employeeIds?: string[], departmentId?: string): Prisma.EmployeeWhereInput {
  return {
    isActive: true,
    ...(employeeIds ? { id: { in: employeeIds } } : {}),
    ...(departmentId ? { departmentId } : {}),
  };
}

export class PrismaReportRepository implements ReportRepository {
  async counters(filters: ReportFilters): Promise<DashboardCounters> {
    const { from, to, departmentId, employeeIds } = filters;
    const scope = employeeScope(employeeIds, departmentId);
    const employeeFilter = employeeIds ? { employeeId: { in: employeeIds } } : {};
    const now = new Date();

    const [
      headcount,
      hiresInPeriod,
      terminationsInPeriod,
      pendingVacations,
      approvedVacations,
      lactationActive,
      lactationExpiringSoon,
      payslipsThisMonth,
      attendanceLateCount,
      openJustifications,
      justifiedAbsences,
    ] = await Promise.all([
      prisma.employee.count({ where: scope }),
      prisma.employee.count({ where: { ...scope, hireDate: { gte: from, lte: to } } }),
      prisma.employee.count({
        where: {
          ...(employeeIds ? { id: { in: employeeIds } } : {}),
          ...(departmentId ? { departmentId } : {}),
          terminationDate: { gte: from, lte: to },
        },
      }),
      prisma.vacationRequest.count({
        where: { ...employeeFilter, status: { in: ['PENDING_SUPERVISOR', 'PENDING_HR'] } },
      }),
      prisma.vacationRequest.aggregate({
        _sum: { workingDays: true },
        where: { ...employeeFilter, status: 'APPROVED', startDate: { gte: from, lte: to } },
      }),
      prisma.lactationPermit.count({ where: { ...employeeFilter, isActive: true, endDate: { gte: now } } }),
      prisma.lactationPermit.count({
        where: {
          ...employeeFilter,
          isActive: true,
          endDate: { gte: now, lte: new Date(now.getTime() + 30 * 86400000) },
        },
      }),
      prisma.payslip.aggregate({
        _count: { _all: true },
        _sum: { netPay: true },
        where: {
          ...employeeFilter,
          periodYear: now.getFullYear(),
          periodMonth: now.getMonth() + 1,
          status: { not: 'CANCELLED' },
        },
      }),
      prisma.attendanceRecord.count({
        where: {
          ...employeeFilter,
          type: 'CHECK_IN',
          lateMinutes: { gt: 0 },
          timestamp: { gte: startOfDay(from), lte: endOfDay(to) },
        },
      }),
      prisma.attendanceJustification.count({ where: { ...employeeFilter, status: 'PENDING' } }),
      prisma.attendanceJustification.count({
        where: {
          ...employeeFilter,
          status: 'APPROVED',
          date: { gte: startOfDay(from), lte: endOfDay(to) },
        },
      }),
    ]);

    const attendanceAbsenceCount = await this.countAbsences(from, to, headcount, employeeIds, departmentId);

    return {
      headcount,
      hiresInPeriod,
      terminationsInPeriod,
      pendingVacations,
      approvedVacationDays: Number(approvedVacations._sum.workingDays ?? 0),
      lactationActive,
      lactationExpiringSoon,
      payslipsThisMonth: payslipsThisMonth._count._all,
      payslipsNetTotal: round2(Number(payslipsThisMonth._sum.netPay ?? 0)),
      attendanceLateCount,
      attendanceAbsenceCount: Math.max(0, attendanceAbsenceCount - justifiedAbsences),
      openJustifications,
    };
  }

  private async countAbsences(
    from: Date,
    to: Date,
    headcount: number,
    employeeIds?: string[],
    departmentId?: string,
  ): Promise<number> {
    if (headcount === 0) return 0;
    const rows = await prisma.attendanceRecord.findMany({
      where: {
        type: 'CHECK_IN',
        timestamp: { gte: startOfDay(from), lte: endOfDay(to) },
        ...(employeeIds ? { employeeId: { in: employeeIds } } : {}),
        ...(departmentId ? { employee: { departmentId } } : {}),
      },
      select: { employeeId: true, timestamp: true },
    });
    const presentDays = new Set(
      rows.map((r) => `${r.employeeId}:${r.timestamp.toISOString().slice(0, 10)}`),
    ).size;

    let workingDays = 0;
    const cursor = new Date(startOfDay(from));
    while (cursor <= to) {
      if (cursor.getDay() !== 0 && cursor.getDay() !== 6) workingDays++;
      cursor.setDate(cursor.getDate() + 1);
    }
    return Math.max(0, headcount * workingDays - presentDays);
  }

  async headcountByDepartment(employeeIds?: string[]): Promise<HeadcountByGroup[]> {
    const grouped = await prisma.employee.groupBy({
      by: ['departmentId'],
      where: employeeScope(employeeIds),
      _count: { _all: true },
    });
    const departments = await prisma.department.findMany({ select: { id: true, name: true } });
    const names = new Map(departments.map((d) => [d.id, d.name]));
    return grouped
      .map((g) => ({
        groupId: g.departmentId,
        groupName: g.departmentId ? names.get(g.departmentId) ?? 'Sin departamento' : 'Sin departamento',
        total: g._count._all,
      }))
      .sort((a, b) => b.total - a.total);
  }

  async headcountByContractType(employeeIds?: string[]): Promise<HeadcountByGroup[]> {
    const grouped = await prisma.employee.groupBy({
      by: ['contractType'],
      where: employeeScope(employeeIds),
      _count: { _all: true },
    });
    return grouped
      .map((g) => ({ groupId: g.contractType, groupName: g.contractType, total: g._count._all }))
      .sort((a, b) => b.total - a.total);
  }

  async payrollByMonth(
    year: number,
    employeeIds?: string[],
  ): Promise<{ month: number; total: number; count: number }[]> {
    const grouped = await prisma.payslip.groupBy({
      by: ['periodMonth'],
      where: {
        periodYear: year,
        status: { not: 'CANCELLED' },
        ...(employeeIds ? { employeeId: { in: employeeIds } } : {}),
      },
      _sum: { netPay: true },
      _count: { _all: true },
    });
    return Array.from({ length: 12 }, (_, index) => {
      const month = index + 1;
      const found = grouped.find((g) => g.periodMonth === month);
      return {
        month,
        total: round2(Number(found?._sum.netPay ?? 0)),
        count: found?._count._all ?? 0,
      };
    });
  }

  async turnoverByMonth(year: number): Promise<{ month: number; hires: number; terminations: number }[]> {
    const [hires, terminations] = await Promise.all([
      prisma.employee.findMany({
        where: { hireDate: { gte: new Date(year, 0, 1), lte: new Date(year, 11, 31, 23, 59, 59) } },
        select: { hireDate: true },
      }),
      prisma.employee.findMany({
        where: { terminationDate: { gte: new Date(year, 0, 1), lte: new Date(year, 11, 31, 23, 59, 59) } },
        select: { terminationDate: true },
      }),
    ]);
    return Array.from({ length: 12 }, (_, index) => ({
      month: index + 1,
      hires: hires.filter((h) => h.hireDate.getMonth() === index).length,
      terminations: terminations.filter((t) => t.terminationDate?.getMonth() === index).length,
    }));
  }
}
