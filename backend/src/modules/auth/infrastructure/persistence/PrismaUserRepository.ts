import { Prisma, Role as PrismaRole } from '@prisma/client';
import { prisma } from '../../../../shared/infrastructure/database/prisma';
import { buildMeta, Paginated, PageQuery } from '../../../../shared/domain/pagination';
import { NewUser, Role, User, UserWithSecret } from '../../domain/entities/User';
import { UserRepository } from '../../domain/repositories/UserRepository';

type Row = Prisma.UserGetPayload<object>;

function toDomain(row: Row): User {
  return {
    id: row.id,
    email: row.email,
    role: row.role as Role,
    isActive: row.isActive,
    employeeId: row.employeeId,
    lastLoginAt: row.lastLoginAt,
    createdAt: row.createdAt,
  };
}

function toDomainWithSecret(row: Row): UserWithSecret {
  return { ...toDomain(row), passwordHash: row.passwordHash };
}

export class PrismaUserRepository implements UserRepository {
  async findByEmail(email: string): Promise<UserWithSecret | null> {
    const row = await prisma.user.findUnique({ where: { email } });
    return row ? toDomainWithSecret(row) : null;
  }

  async findById(id: string): Promise<UserWithSecret | null> {
    const row = await prisma.user.findUnique({ where: { id } });
    return row ? toDomainWithSecret(row) : null;
  }

  async findByEmployeeId(employeeId: string): Promise<User | null> {
    const row = await prisma.user.findUnique({ where: { employeeId } });
    return row ? toDomain(row) : null;
  }

  async list(query: PageQuery & { role?: Role; isActive?: boolean }): Promise<Paginated<User>> {
    const where: Prisma.UserWhereInput = {
      ...(query.role ? { role: query.role as PrismaRole } : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      ...(query.search ? { email: { contains: query.search, mode: 'insensitive' } } : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: query.order ?? 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: { employee: { select: { firstName: true, lastName: true, employeeCode: true } } },
      }),
      prisma.user.count({ where }),
    ]);
    const data = rows.map((row) => ({
      ...toDomain(row),
      employeeName: row.employee ? `${row.employee.firstName} ${row.employee.lastName}` : null,
    }));
    return { data, meta: buildMeta(total, query.page, query.limit) };
  }

  async create(data: NewUser): Promise<User> {
    const row = await prisma.user.create({
      data: {
        email: data.email,
        passwordHash: data.passwordHash,
        role: data.role as PrismaRole,
        employeeId: data.employeeId ?? null,
      },
    });
    return toDomain(row);
  }

  async updatePassword(id: string, passwordHash: string): Promise<void> {
    await prisma.user.update({ where: { id }, data: { passwordHash } });
  }

  async updateRole(id: string, role: Role): Promise<User> {
    const row = await prisma.user.update({ where: { id }, data: { role: role as PrismaRole } });
    return toDomain(row);
  }

  async setActive(id: string, isActive: boolean): Promise<User> {
    const row = await prisma.user.update({ where: { id }, data: { isActive } });
    return toDomain(row);
  }

  async touchLastLogin(id: string): Promise<void> {
    await prisma.user.update({ where: { id }, data: { lastLoginAt: new Date() } });
  }
}
