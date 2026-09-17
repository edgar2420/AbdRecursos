import { Prisma } from '@prisma/client';
import { prisma } from '../../../../shared/infrastructure/database/prisma';
import { buildMeta, Paginated, PageQuery } from '../../../../shared/domain/pagination';
import {
  LegalParameter,
  LegalValueType,
  NewLegalParameter,
} from '../../domain/entities/LegalParameter';
import { LegalParameterRepository } from '../../domain/repositories/LegalParameterRepository';

type Row = Prisma.LegalParameterGetPayload<object>;

function toDomain(row: Row): LegalParameter {
  return {
    id: row.id,
    key: row.key,
    value: row.value,
    valueType: row.valueType as LegalValueType,
    description: row.description,
    unit: row.unit,
    validFrom: row.validFrom,
    validUntil: row.validUntil,
  };
}

export class PrismaLegalParameterRepository implements LegalParameterRepository {
  async findEffective(at: Date): Promise<LegalParameter[]> {
    const rows = await prisma.legalParameter.findMany({
      where: {
        validFrom: { lte: at },
        OR: [{ validUntil: null }, { validUntil: { gt: at } }],
      },
      orderBy: { validFrom: 'desc' },
    });
    const byKey = new Map<string, Row>();
    rows.forEach((row) => {
      if (!byKey.has(row.key)) byKey.set(row.key, row);
    });
    return [...byKey.values()].map(toDomain);
  }

  async findByKey(key: string): Promise<LegalParameter[]> {
    const rows = await prisma.legalParameter.findMany({ where: { key }, orderBy: { validFrom: 'desc' } });
    return rows.map(toDomain);
  }

  async findById(id: string): Promise<LegalParameter | null> {
    const row = await prisma.legalParameter.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }

  async list(query: PageQuery & { key?: string }): Promise<Paginated<LegalParameter>> {
    const where: Prisma.LegalParameterWhereInput = {
      ...(query.key ? { key: query.key } : {}),
      ...(query.search
        ? {
            OR: [
              { key: { contains: query.search, mode: 'insensitive' } },
              { description: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.legalParameter.findMany({
        where,
        orderBy: [{ key: 'asc' }, { validFrom: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      prisma.legalParameter.count({ where }),
    ]);
    return { data: rows.map(toDomain), meta: buildMeta(total, query.page, query.limit) };
  }

  async create(data: NewLegalParameter): Promise<LegalParameter> {
    const row = await prisma.legalParameter.create({
      data: {
        key: data.key,
        value: data.value,
        valueType: data.valueType,
        description: data.description ?? null,
        unit: data.unit ?? null,
        validFrom: data.validFrom,
        validUntil: data.validUntil ?? null,
        createdBy: data.createdBy ?? null,
      },
    });
    return toDomain(row);
  }

  async update(id: string, data: Partial<NewLegalParameter>): Promise<LegalParameter> {
    const row = await prisma.legalParameter.update({
      where: { id },
      data: {
        value: data.value,
        valueType: data.valueType,
        description: data.description,
        unit: data.unit,
        validUntil: data.validUntil,
      },
    });
    return toDomain(row);
  }

  async closeValidity(key: string, until: Date): Promise<void> {
    await prisma.legalParameter.updateMany({
      where: { key, validUntil: null, validFrom: { lt: until } },
      data: { validUntil: until },
    });
  }
}
