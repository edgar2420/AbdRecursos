import { ImportStatus as PrismaImportStatus, ImportType as PrismaImportType, Prisma } from '@prisma/client';
import { prisma } from '../../../../shared/infrastructure/database/prisma';
import { buildMeta, Paginated, PageQuery } from '../../../../shared/domain/pagination';
import {
  ImportLog,
  ImportRow,
  ImportStatus,
  ImportType,
} from '../../domain/entities/ImportLog';
import { ImportRepository } from '../../domain/repositories/ImportRepository';

type Row = Prisma.ImportLogGetPayload<object> & { rows?: { rowNumber: number; isValid: boolean; errors: string[]; data: unknown }[] };

function toDomain(row: Row): ImportLog {
  return {
    id: row.id,
    type: row.type as ImportType,
    fileName: row.fileName,
    status: row.status as ImportStatus,
    totalRows: row.totalRows,
    validRows: row.validRows,
    errorRows: row.errorRows,
    processedRows: row.processedRows,
    uploadedBy: row.uploadedBy,
    processedAt: row.processedAt,
    createdAt: row.createdAt,
    rows: row.rows?.map((r) => ({
      rowNumber: r.rowNumber,
      isValid: r.isValid,
      errors: r.errors,
      data: r.data as Record<string, unknown>,
    })),
  };
}

export class PrismaImportRepository implements ImportRepository {
  async create(data: {
    type: ImportType;
    fileName: string;
    uploadedBy: string;
    totalRows: number;
    validRows: number;
    errorRows: number;
    rows: ImportRow[];
  }): Promise<ImportLog> {
    const row = await prisma.importLog.create({
      data: {
        type: data.type as PrismaImportType,
        fileName: data.fileName,
        uploadedBy: data.uploadedBy,
        status: 'VALIDATED',
        totalRows: data.totalRows,
        validRows: data.validRows,
        errorRows: data.errorRows,
        rows: {
          create: data.rows.map((r) => ({
            rowNumber: r.rowNumber,
            isValid: r.isValid,
            errors: r.errors,
            data: r.data as Prisma.InputJsonValue,
          })),
        },
      },
    });
    return toDomain(row);
  }

  async findById(id: string, withRows = false): Promise<ImportLog | null> {
    const row = await prisma.importLog.findUnique({
      where: { id },
      include: withRows ? { rows: { orderBy: { rowNumber: 'asc' } } } : undefined,
    });
    return row ? toDomain(row as Row) : null;
  }

  async list(query: PageQuery & { type?: ImportType; status?: ImportStatus }): Promise<Paginated<ImportLog>> {
    const where: Prisma.ImportLogWhereInput = {
      ...(query.type ? { type: query.type as PrismaImportType } : {}),
      ...(query.status ? { status: query.status as PrismaImportStatus } : {}),
      ...(query.search ? { fileName: { contains: query.search, mode: 'insensitive' } } : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.importLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      prisma.importLog.count({ where }),
    ]);
    return { data: rows.map(toDomain), meta: buildMeta(total, query.page, query.limit) };
  }

  async markProcessed(id: string, processedRows: number, status: ImportStatus): Promise<ImportLog> {
    const row = await prisma.importLog.update({
      where: { id },
      data: { processedRows, status: status as PrismaImportStatus, processedAt: new Date() },
    });
    return toDomain(row);
  }

  async validRows(id: string): Promise<ImportRow[]> {
    const rows = await prisma.importLogRow.findMany({
      where: { importLogId: id, isValid: true },
      orderBy: { rowNumber: 'asc' },
    });
    return rows.map((r) => ({
      rowNumber: r.rowNumber,
      isValid: r.isValid,
      errors: r.errors,
      data: r.data as Record<string, unknown>,
    }));
  }

  async allRows(id: string): Promise<ImportRow[]> {
    const rows = await prisma.importLogRow.findMany({
      where: { importLogId: id },
      orderBy: { rowNumber: 'asc' },
    });
    return rows.map((r) => ({
      rowNumber: r.rowNumber,
      isValid: r.isValid,
      errors: r.errors,
      data: r.data as Record<string, unknown>,
    }));
  }
}
