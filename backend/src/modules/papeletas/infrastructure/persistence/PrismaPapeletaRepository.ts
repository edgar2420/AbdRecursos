import { Prisma } from '@prisma/client';
import { prisma } from '../../../../shared/infrastructure/database/prisma';
import { buildMeta, Paginated } from '../../../../shared/domain/pagination';
import {
  NuevaPapeletaHorasExtras,
  NuevaPapeletaSalida,
  Papeleta,
  PapeletaEstado,
  PapeletaTipo,
  RecargoHoraExtra,
  SalidaMotivo,
} from '../../domain/entities/Papeleta';
import { PapeletaFilters, PapeletaRepository } from '../../domain/repositories/PapeletaRepository';

const include = {
  employee: { select: { firstName: true, lastName: true, employeeCode: true, departmentId: true } },
} satisfies Prisma.PapeletaInclude;

type Row = Prisma.PapeletaGetPayload<{ include: typeof include }>;

/** Nombres de los firmantes, resueltos en bloque para no consultar de a uno. */
async function nombresDeUsuarios(ids: (string | null)[]): Promise<Map<string, string>> {
  const limpios = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (limpios.length === 0) return new Map();
  const usuarios = await prisma.user.findMany({
    where: { id: { in: limpios } },
    select: { id: true, email: true, employee: { select: { firstName: true, lastName: true } } },
  });
  return new Map(
    usuarios.map((u) => [
      u.id,
      u.employee ? `${u.employee.firstName} ${u.employee.lastName}` : u.email,
    ]),
  );
}

function toDomain(row: Row, nombres: Map<string, string>): Papeleta {
  return {
    id: row.id,
    numero: row.numero,
    tipo: row.tipo as PapeletaTipo,
    estado: row.estado as PapeletaEstado,
    employeeId: row.employeeId,
    employeeNombre: `${row.employee.firstName} ${row.employee.lastName}`,
    employeeCodigo: row.employee.employeeCode,
    area: row.area,
    fecha: row.fecha,
    trabajoRealizado: row.trabajoRealizado,
    desde: row.desde,
    hasta: row.hasta,
    totalHoras: row.totalHoras === null ? null : Number(row.totalHoras),
    recargo: (row.recargo as RecargoHoraExtra | null) ?? null,
    salidaMotivo: (row.salidaMotivo as SalidaMotivo | null) ?? null,
    motivo: row.motivo,
    tiempoSolicitado: row.tiempoSolicitado,
    horaSalida: row.horaSalida,
    horaRetorno: row.horaRetorno,
    attachmentUrl: row.attachmentUrl,
    firmaArea:
      row.firmaAreaBy && row.firmaAreaAt
        ? {
            userId: row.firmaAreaBy,
            nombre: nombres.get(row.firmaAreaBy) ?? null,
            fecha: row.firmaAreaAt,
            sello: row.firmaAreaHash ?? '',
          }
        : null,
    firmaRrhh:
      row.firmaRrhhBy && row.firmaRrhhAt
        ? {
            userId: row.firmaRrhhBy,
            nombre: nombres.get(row.firmaRrhhBy) ?? null,
            fecha: row.firmaRrhhAt,
            sello: row.firmaRrhhHash ?? '',
          }
        : null,
    motivoRechazo: row.motivoRechazo,
    rechazadaAt: row.rechazadaAt,
    createdAt: row.createdAt,
  };
}

async function unaFila(row: Row): Promise<Papeleta> {
  const nombres = await nombresDeUsuarios([row.firmaAreaBy, row.firmaRrhhBy]);
  return toDomain(row, nombres);
}

export class PrismaPapeletaRepository implements PapeletaRepository {
  async findById(id: string): Promise<Papeleta | null> {
    const row = await prisma.papeleta.findUnique({ where: { id }, include });
    return row ? unaFila(row) : null;
  }

  async list(filters: PapeletaFilters): Promise<Paginated<Papeleta>> {
    const where: Prisma.PapeletaWhereInput = {
      ...(filters.tipo ? { tipo: filters.tipo as never } : {}),
      ...(filters.estado ? { estado: filters.estado as never } : {}),
      ...(filters.employeeId ? { employeeId: filters.employeeId } : {}),
      ...(filters.employeeIds ? { employeeId: { in: filters.employeeIds } } : {}),
      ...(filters.departmentId ? { employee: { departmentId: filters.departmentId } } : {}),
      ...(filters.dateFrom || filters.dateTo
        ? {
            fecha: {
              ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
              ...(filters.dateTo ? { lte: filters.dateTo } : {}),
            },
          }
        : {}),
      ...(filters.search
        ? {
            OR: [
              { numero: { contains: filters.search, mode: 'insensitive' } },
              { employee: { firstName: { contains: filters.search, mode: 'insensitive' } } },
              { employee: { lastName: { contains: filters.search, mode: 'insensitive' } } },
              { employee: { employeeCode: { contains: filters.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.papeleta.findMany({
        where,
        include,
        orderBy: [{ fecha: 'desc' }, { createdAt: 'desc' }],
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
      }),
      prisma.papeleta.count({ where }),
    ]);

    const nombres = await nombresDeUsuarios(rows.flatMap((r) => [r.firmaAreaBy, r.firmaRrhhBy]));
    return {
      data: rows.map((r) => toDomain(r, nombres)),
      meta: buildMeta(total, filters.page, filters.limit),
    };
  }

  async crearHorasExtras(
    data: NuevaPapeletaHorasExtras & { numero: string; totalHoras: number },
  ): Promise<Papeleta> {
    const row = await prisma.papeleta.create({
      data: {
        numero: data.numero,
        tipo: 'HORAS_EXTRAS',
        employeeId: data.employeeId,
        area: data.area,
        fecha: data.fecha,
        trabajoRealizado: data.trabajoRealizado,
        desde: data.desde,
        hasta: data.hasta,
        totalHoras: new Prisma.Decimal(data.totalHoras),
        recargo: data.recargo as never,
      },
      include,
    });
    return unaFila(row);
  }

  async crearSalida(data: NuevaPapeletaSalida & { numero: string }): Promise<Papeleta> {
    const row = await prisma.papeleta.create({
      data: {
        numero: data.numero,
        tipo: 'SALIDA',
        employeeId: data.employeeId,
        area: data.area,
        fecha: data.fecha,
        salidaMotivo: data.salidaMotivo as never,
        motivo: data.motivo,
        tiempoSolicitado: data.tiempoSolicitado,
        horaSalida: data.horaSalida,
        horaRetorno: data.horaRetorno ?? null,
        attachmentUrl: data.attachmentUrl ?? null,
      },
      include,
    });
    return unaFila(row);
  }

  async registrarFirma(
    id: string,
    data: {
      firmante: 'JEFE_AREA' | 'RRHH';
      userId: string;
      fecha: Date;
      sello: string;
      estado: PapeletaEstado;
    },
  ): Promise<Papeleta> {
    const row = await prisma.papeleta.update({
      where: { id },
      data: {
        estado: data.estado as never,
        ...(data.firmante === 'JEFE_AREA'
          ? { firmaAreaBy: data.userId, firmaAreaAt: data.fecha, firmaAreaHash: data.sello }
          : { firmaRrhhBy: data.userId, firmaRrhhAt: data.fecha, firmaRrhhHash: data.sello }),
      },
      include,
    });
    return unaFila(row);
  }

  async rechazar(id: string, data: { userId: string; motivo: string }): Promise<Papeleta> {
    const row = await prisma.papeleta.update({
      where: { id },
      data: {
        estado: 'RECHAZADA',
        rechazadaBy: data.userId,
        rechazadaAt: new Date(),
        motivoRechazo: data.motivo,
      },
      include,
    });
    return unaFila(row);
  }

  async anular(id: string): Promise<Papeleta> {
    const row = await prisma.papeleta.update({ where: { id }, data: { estado: 'ANULADA' }, include });
    return unaFila(row);
  }

  async siguienteNumero(tipo: PapeletaTipo, anio: number): Promise<string> {
    const prefijo = tipo === 'HORAS_EXTRAS' ? 'HE' : 'PS';
    const inicio = `${prefijo}-${anio}-`;
    const ultima = await prisma.papeleta.findFirst({
      where: { numero: { startsWith: inicio } },
      orderBy: { numero: 'desc' },
      select: { numero: true },
    });
    const correlativo = ultima ? Number(ultima.numero.slice(inicio.length)) + 1 : 1;
    return `${inicio}${String(correlativo).padStart(4, '0')}`;
  }

  async horasAprobadasEnPeriodo(
    employeeIds: string[],
    desde: Date,
    hasta: Date,
  ): Promise<{ employeeId: string; recargo: string; horas: number }[]> {
    const rows = await prisma.papeleta.findMany({
      where: {
        tipo: 'HORAS_EXTRAS',
        estado: 'APROBADA',
        employeeId: { in: employeeIds },
        fecha: { gte: desde, lte: hasta },
      },
      select: { employeeId: true, recargo: true, totalHoras: true },
    });
    return rows.map((r) => ({
      employeeId: r.employeeId,
      recargo: String(r.recargo ?? 'DIURNA'),
      horas: Number(r.totalHoras ?? 0),
    }));
  }
}
