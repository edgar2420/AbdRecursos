import { prisma } from '../../../shared/infrastructure/database/prisma';
import { AjusteBanco, BancoHorasRepository, PapeletaParaBanco } from '../domain/BancoHorasRepository';

export class PrismaBancoHorasRepository implements BancoHorasRepository {
  async papeletasQueCuentan(employeeIds: string[]): Promise<PapeletaParaBanco[]> {
    const filas = await prisma.papeleta.findMany({
      where: {
        employeeId: { in: employeeIds },
        estado: 'APROBADA',
        OR: [{ tipo: 'HORAS_EXTRAS' }, { tipo: 'SALIDA', salidaMotivo: 'PARTICULAR' }],
      },
      orderBy: { fecha: 'asc' },
    });
    return filas.map((p) => ({
      employeeId: p.employeeId,
      numero: p.numero,
      tipo: p.tipo,
      fecha: p.fecha,
      totalHoras: p.totalHoras === null ? null : Number(p.totalHoras),
      recargo: p.recargo,
      trabajoRealizado: p.trabajoRealizado,
      salidaMotivo: p.salidaMotivo,
      motivo: p.motivo,
      horaSalida: p.horaSalida,
      horaRetorno: p.horaRetorno,
      tiempoSolicitado: p.tiempoSolicitado,
    }));
  }

  async ajustes(employeeIds: string[]): Promise<AjusteBanco[]> {
    return prisma.bancoHorasAjuste.findMany({
      where: { employeeId: { in: employeeIds } },
      select: { id: true, employeeId: true, minutos: true, motivo: true, fecha: true },
      orderBy: { fecha: 'asc' },
    });
  }

  async crearAjuste(data: { employeeId: string; minutos: number; motivo: string; creadoPor: string }): Promise<AjusteBanco> {
    return prisma.bancoHorasAjuste.create({
      data,
      select: { id: true, employeeId: true, minutos: true, motivo: true, fecha: true },
    });
  }
}
