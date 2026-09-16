import { Prisma } from '@prisma/client';
import { prisma } from '../../../../shared/infrastructure/database/prisma';
import { buildMeta, Paginated, PageQuery } from '../../../../shared/domain/pagination';
import { CatalogItem, CatalogRepository } from '../../domain/repositories/CatalogRepository';

type Row = { id: string; name: string; description: string | null; isActive: boolean; _count?: { employees: number } };

function toDomain(row: Row): CatalogItem {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    isActive: row.isActive,
    employeeCount: row._count?.employees,
  };
}

export class PrismaCatalogRepository implements CatalogRepository {
  async listDepartments(query: PageQuery & { isActive?: boolean }): Promise<Paginated<CatalogItem>> {
    const where: Prisma.DepartmentWhereInput = {
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      ...(query.search ? { name: { contains: query.search, mode: 'insensitive' } } : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.department.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: { _count: { select: { employees: true } } },
      }),
      prisma.department.count({ where }),
    ]);
    return { data: rows.map(toDomain), meta: buildMeta(total, query.page, query.limit) };
  }

  async createDepartment(data: { name: string; description?: string | null }): Promise<CatalogItem> {
    return toDomain(await prisma.department.create({ data: { name: data.name, description: data.description ?? null } }));
  }

  async updateDepartment(id: string, data: Partial<CatalogItem>): Promise<CatalogItem> {
    return toDomain(
      await prisma.department.update({
        where: { id },
        data: { name: data.name, description: data.description, isActive: data.isActive },
      }),
    );
  }

  async listPositions(query: PageQuery & { isActive?: boolean }): Promise<Paginated<CatalogItem>> {
    const where: Prisma.PositionWhereInput = {
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      ...(query.search ? { name: { contains: query.search, mode: 'insensitive' } } : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.position.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: { _count: { select: { employees: true } } },
      }),
      prisma.position.count({ where }),
    ]);
    return { data: rows.map(toDomain), meta: buildMeta(total, query.page, query.limit) };
  }

  async createPosition(data: { name: string; description?: string | null }): Promise<CatalogItem> {
    return toDomain(await prisma.position.create({ data: { name: data.name, description: data.description ?? null } }));
  }

  async updatePosition(id: string, data: Partial<CatalogItem>): Promise<CatalogItem> {
    return toDomain(
      await prisma.position.update({
        where: { id },
        data: { name: data.name, description: data.description, isActive: data.isActive },
      }),
    );
  }

  async findDepartmentByName(name: string): Promise<CatalogItem | null> {
    const row = await prisma.department.findFirst({ where: { name: { equals: name, mode: 'insensitive' } } });
    return row ? toDomain(row) : null;
  }

  async findPositionByName(name: string): Promise<CatalogItem | null> {
    const row = await prisma.position.findFirst({ where: { name: { equals: name, mode: 'insensitive' } } });
    return row ? toDomain(row) : null;
  }
}
