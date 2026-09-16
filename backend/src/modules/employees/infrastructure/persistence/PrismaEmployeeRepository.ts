import { ContractType as PrismaContractType, EmployeeStatus as PrismaStatus, Prisma } from '@prisma/client';
import { prisma } from '../../../../shared/infrastructure/database/prisma';
import { buildMeta, Paginated, PageQuery } from '../../../../shared/domain/pagination';
import { safeSort, searchTokensWhere } from '../../../../shared/infrastructure/http/query';
import {
  ContractType,
  Employee,
  EmployeeHistoryEntry,
  EmployeeStatus,
  NewEmployee,
  UpdateEmployeeData,
} from '../../domain/entities/Employee';
import { EmployeeFilters, EmployeeRepository } from '../../domain/repositories/EmployeeRepository';
import { FieldCipher } from '../../../../shared/infrastructure/security/FieldCipher';

/**
 * La C.I. y la cuenta bancaria se guardan cifradas (AES-256-GCM) y se descifran
 * al mapear a dominio, de modo que quien mire la base directamente no las lee.
 */
const cipher = new FieldCipher();

const include = {
  department: { select: { id: true, name: true } },
  position: { select: { id: true, name: true } },
  supervisor: { select: { id: true, firstName: true, lastName: true } },
} satisfies Prisma.EmployeeInclude;

type Row = Prisma.EmployeeGetPayload<{ include: typeof include }>;

const SORTABLE = ['lastName', 'firstName', 'hireDate', 'baseSalary', 'employeeCode', 'createdAt'] as const;

/** Mapeo explicito Prisma -> dominio: la entidad de dominio no conoce Prisma (5.2). */
function toDomain(row: Row): Employee {
  return {
    id: row.id,
    employeeCode: row.employeeCode,
    firstName: row.firstName,
    lastName: row.lastName,
    fullName: `${row.firstName} ${row.lastName}`,
    ci: cipher.descifrar(row.ci) ?? '',
    ciExtension: row.ciExtension,
    birthDate: row.birthDate,
    gender: row.gender,
    email: row.email,
    phone: row.phone,
    address: row.address,
    photoUrl: row.photoUrl,
    hireDate: row.hireDate,
    terminationDate: row.terminationDate,
    contractType: row.contractType as ContractType,
    baseSalary: Number(row.baseSalary),
    bankName: row.bankName,
    bankAccount: cipher.descifrar(row.bankAccount),
    afpName: row.afpName,
    afpNumber: row.afpNumber,
    status: row.status as EmployeeStatus,
    isActive: row.isActive,
    jobProtection: row.jobProtection,
    jobProtectionUntil: row.jobProtectionUntil,
    emergencyContactName: row.emergencyContactName,
    emergencyContactPhone: row.emergencyContactPhone,
    emergencyContactRelation: row.emergencyContactRelation,
    departmentId: row.departmentId,
    departmentName: row.department?.name ?? null,
    positionId: row.positionId,
    positionName: row.position?.name ?? null,
    supervisorId: row.supervisorId,
    supervisorName: row.supervisor ? `${row.supervisor.firstName} ${row.supervisor.lastName}` : null,
    createdAt: row.createdAt,
  };
}

function buildWhere(filters: Partial<EmployeeFilters>): Prisma.EmployeeWhereInput {
  return {
    ...(filters.ids ? { id: { in: filters.ids } } : {}),
    ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
    ...(filters.positionId ? { positionId: filters.positionId } : {}),
    ...(filters.supervisorId ? { supervisorId: filters.supervisorId } : {}),
    ...(filters.status ? { status: filters.status as PrismaStatus } : {}),
    ...(filters.contractType ? { contractType: filters.contractType as PrismaContractType } : {}),
    ...(filters.isActive !== undefined ? { isActive: filters.isActive } : {}),
    ...(filters.hiredFrom || filters.hiredTo
      ? { hireDate: { ...(filters.hiredFrom ? { gte: filters.hiredFrom } : {}), ...(filters.hiredTo ? { lte: filters.hiredTo } : {}) } }
      : {}),
    ...(filters.search
      ? {
          OR: [
            // Nombre y apellido por separado ("Maria Quispe" exige ambas palabras,
            // en cualquier orden, sin importar en que campo caiga cada una).
            searchTokensWhere(filters.search, (t) => [
              { firstName: { contains: t, mode: 'insensitive' } },
              { lastName: { contains: t, mode: 'insensitive' } },
              { employeeCode: { contains: t, mode: 'insensitive' } },
              { email: { contains: t, mode: 'insensitive' } },
            ]),
            // La C.I. esta cifrada: solo se puede buscar por coincidencia exacta
            // via su huella (HMAC), nunca por fragmento.
            { ciHuella: cipher.huella(filters.search.trim()) },
          ],
        }
      : {}),
  };
}

export class PrismaEmployeeRepository implements EmployeeRepository {
  async findById(id: string): Promise<Employee | null> {
    const row = await prisma.employee.findUnique({ where: { id }, include });
    return row ? toDomain(row) : null;
  }

  async findByCode(code: string): Promise<Employee | null> {
    const row = await prisma.employee.findUnique({ where: { employeeCode: code }, include });
    return row ? toDomain(row) : null;
  }

  async findByCI(ci: string): Promise<Employee | null> {
    // Se busca por la huella: el valor cifrado cambia en cada guardado.
    const row = await prisma.employee.findUnique({ where: { ciHuella: cipher.huella(ci) }, include });
    return row ? toDomain(row) : null;
  }

  async list(filters: EmployeeFilters): Promise<Paginated<Employee>> {
    const where = buildWhere(filters);
    const sort = safeSort(filters.sort, SORTABLE, 'lastName');
    const [rows, total] = await Promise.all([
      prisma.employee.findMany({
        where,
        include,
        orderBy: { [sort]: filters.order ?? 'asc' },
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
      }),
      prisma.employee.count({ where }),
    ]);
    return { data: rows.map(toDomain), meta: buildMeta(total, filters.page, filters.limit) };
  }

  async listAll(filters: Omit<EmployeeFilters, 'page' | 'limit'>): Promise<Employee[]> {
    const rows = await prisma.employee.findMany({
      where: buildWhere(filters),
      include,
      orderBy: { lastName: 'asc' },
    });
    return rows.map(toDomain);
  }

  async create(data: NewEmployee): Promise<Employee> {
    const row = await prisma.employee.create({
      data: {
        employeeCode: data.employeeCode,
        firstName: data.firstName,
        lastName: data.lastName,
        ci: cipher.cifrar(data.ci) ?? '',
        ciHuella: cipher.huella(data.ci),
        ciExtension: data.ciExtension ?? null,
        birthDate: data.birthDate ?? null,
        gender: data.gender ?? null,
        email: data.email ?? null,
        phone: data.phone ?? null,
        address: data.address ?? null,
        photoUrl: data.photoUrl ?? null,
        hireDate: data.hireDate,
        contractType: data.contractType as PrismaContractType,
        baseSalary: new Prisma.Decimal(data.baseSalary),
        bankName: data.bankName ?? null,
        bankAccount: cipher.cifrar(data.bankAccount),
        afpName: data.afpName ?? null,
        afpNumber: data.afpNumber ?? null,
        emergencyContactName: data.emergencyContactName ?? null,
        emergencyContactPhone: data.emergencyContactPhone ?? null,
        emergencyContactRelation: data.emergencyContactRelation ?? null,
        departmentId: data.departmentId ?? null,
        positionId: data.positionId ?? null,
        supervisorId: data.supervisorId ?? null,
      },
      include,
    });
    return toDomain(row);
  }

  async update(id: string, data: UpdateEmployeeData): Promise<Employee> {
    const row = await prisma.employee.update({
      where: { id },
      data: {
        ...(data.firstName !== undefined ? { firstName: data.firstName } : {}),
        ...(data.lastName !== undefined ? { lastName: data.lastName } : {}),
        ...(data.ci !== undefined ? { ci: cipher.cifrar(data.ci) ?? '', ciHuella: cipher.huella(data.ci) } : {}),
        ...(data.ciExtension !== undefined ? { ciExtension: data.ciExtension } : {}),
        ...(data.birthDate !== undefined ? { birthDate: data.birthDate } : {}),
        ...(data.gender !== undefined ? { gender: data.gender } : {}),
        ...(data.email !== undefined ? { email: data.email } : {}),
        ...(data.phone !== undefined ? { phone: data.phone } : {}),
        ...(data.address !== undefined ? { address: data.address } : {}),
        ...(data.photoUrl !== undefined ? { photoUrl: data.photoUrl } : {}),
        ...(data.hireDate !== undefined ? { hireDate: data.hireDate } : {}),
        ...(data.contractType !== undefined ? { contractType: data.contractType as PrismaContractType } : {}),
        ...(data.baseSalary !== undefined ? { baseSalary: new Prisma.Decimal(data.baseSalary) } : {}),
        ...(data.bankName !== undefined ? { bankName: data.bankName } : {}),
        ...(data.bankAccount !== undefined ? { bankAccount: cipher.cifrar(data.bankAccount) } : {}),
        ...(data.afpName !== undefined ? { afpName: data.afpName } : {}),
        ...(data.afpNumber !== undefined ? { afpNumber: data.afpNumber } : {}),
        ...(data.emergencyContactName !== undefined ? { emergencyContactName: data.emergencyContactName } : {}),
        ...(data.emergencyContactPhone !== undefined ? { emergencyContactPhone: data.emergencyContactPhone } : {}),
        ...(data.emergencyContactRelation !== undefined
          ? { emergencyContactRelation: data.emergencyContactRelation }
          : {}),
        ...(data.departmentId !== undefined ? { departmentId: data.departmentId } : {}),
        ...(data.positionId !== undefined ? { positionId: data.positionId } : {}),
        ...(data.supervisorId !== undefined ? { supervisorId: data.supervisorId } : {}),
        ...(data.status !== undefined ? { status: data.status as PrismaStatus } : {}),
        ...(data.terminationDate !== undefined ? { terminationDate: data.terminationDate } : {}),
        ...(data.jobProtection !== undefined ? { jobProtection: data.jobProtection } : {}),
        ...(data.jobProtectionUntil !== undefined ? { jobProtectionUntil: data.jobProtectionUntil } : {}),
      },
      include,
    });
    return toDomain(row);
  }

  async setActive(id: string, isActive: boolean): Promise<Employee> {
    const row = await prisma.employee.update({ where: { id }, data: { isActive }, include });
    return toDomain(row);
  }

  async isSupervisorOf(supervisorEmployeeId: string, employeeId: string): Promise<boolean> {
    const found = await prisma.employee.findFirst({
      where: { id: employeeId, supervisorId: supervisorEmployeeId },
      select: { id: true },
    });
    return found !== null;
  }

  async listTeamIds(supervisorEmployeeId: string): Promise<string[]> {
    const rows = await prisma.employee.findMany({
      where: { supervisorId: supervisorEmployeeId },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }

  async addHistory(entry: {
    employeeId: string;
    changeType: string;
    field?: string | null;
    oldValue?: string | null;
    newValue?: string | null;
    effectiveDate: Date;
    notes?: string | null;
    changedBy?: string | null;
  }): Promise<void> {
    await prisma.employeeHistory.create({
      data: {
        employeeId: entry.employeeId,
        changeType: entry.changeType as never,
        field: entry.field ?? null,
        oldValue: entry.oldValue ?? null,
        newValue: entry.newValue ?? null,
        effectiveDate: entry.effectiveDate,
        notes: entry.notes ?? null,
        changedBy: entry.changedBy ?? null,
      },
    });
  }

  async history(employeeId: string, query: PageQuery): Promise<Paginated<EmployeeHistoryEntry>> {
    const where = { employeeId };
    const [rows, total] = await Promise.all([
      prisma.employeeHistory.findMany({
        where,
        orderBy: { effectiveDate: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      prisma.employeeHistory.count({ where }),
    ]);
    const data: EmployeeHistoryEntry[] = rows.map((row) => ({
      id: row.id,
      employeeId: row.employeeId,
      changeType: row.changeType as EmployeeHistoryEntry['changeType'],
      field: row.field,
      oldValue: row.oldValue,
      newValue: row.newValue,
      effectiveDate: row.effectiveDate,
      notes: row.notes,
      createdAt: row.createdAt,
    }));
    return { data, meta: buildMeta(total, query.page, query.limit) };
  }

  /** Correlativo EMP-0001. El UUID sigue siendo el identificador publico (8.2). */
  async nextEmployeeCode(): Promise<string> {
    const last = await prisma.employee.findFirst({
      where: { employeeCode: { startsWith: 'EMP-' } },
      orderBy: { employeeCode: 'desc' },
      select: { employeeCode: true },
    });
    const lastNumber = last ? Number(last.employeeCode.replace('EMP-', '')) : 0;
    return `EMP-${String(lastNumber + 1).padStart(4, '0')}`;
  }

  async countActive(): Promise<number> {
    return prisma.employee.count({ where: { isActive: true } });
  }
}
