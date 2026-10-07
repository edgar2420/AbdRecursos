import { prisma } from '../../../../shared/infrastructure/database/prisma';
import { endOfDay, startOfDay } from '../../../../shared/domain/dates';
import { GetLegalParameters } from '../../../legal-parameters/application/use-cases/GetLegalParameters';
import { TardanzaRecalculator } from '../../../schedules/application/ports/TardanzaRecalculator';
import { AttendanceCalculator } from '../../domain/services/AttendanceCalculator';

const LOTE = 500;

export class PrismaTardanzaRecalculator implements TardanzaRecalculator {
  constructor(private readonly parameters: GetLegalParameters) {}

  async recalcularHorario(scheduleId: string): Promise<number> {
    const asignaciones = await prisma.scheduleAssignment.findMany({
      where: { scheduleId, isActive: true },
      select: { employeeId: true, validFrom: true },
    });
    if (asignaciones.length === 0) return 0;
    const desde = new Date(Math.min(...asignaciones.map((a) => a.validFrom.getTime())));
    return this.recalcularEmpleados([...new Set(asignaciones.map((a) => a.employeeId))], desde);
  }

  async recalcularEmpleados(employeeIds: string[], desde: Date): Promise<number> {
    if (employeeIds.length === 0) return 0;
    const calculadora = new AttendanceCalculator(await this.parameters.execute(new Date()));

    const asignaciones = await prisma.scheduleAssignment.findMany({
      where: { employeeId: { in: employeeIds }, isActive: true, schedule: { isActive: true } },
      include: { schedule: true },
      orderBy: { validFrom: 'desc' },
    });

    let cambiadas = 0;
    for (let i = 0; i < employeeIds.length; i += LOTE) {
      const lote = employeeIds.slice(i, i + LOTE);
      const marcaciones = await prisma.attendanceRecord.findMany({
        where: { employeeId: { in: lote }, type: 'CHECK_IN', timestamp: { gte: startOfDay(desde) } },
        select: { id: true, employeeId: true, timestamp: true, lateMinutes: true },
      });

      const cambios = marcaciones
        .map((m) => {
          const vigente = asignaciones.find(
            (a) =>
              a.employeeId === m.employeeId &&
              startOfDay(a.validFrom) <= m.timestamp &&
              (!a.validUntil || m.timestamp <= endOfDay(a.validUntil)),
          );
          const tarde = vigente
            ? calculadora.lateMinutesFor(m.timestamp, {
                startTime: vigente.schedule.startTime,
                endTime: vigente.schedule.endTime,
                toleranceMinutes: vigente.schedule.toleranceMinutes,
                breakMinutes: 0,
                weekDays: vigente.schedule.weekDays,
              })
            : 0;
          return { id: m.id, antes: m.lateMinutes, tarde };
        })
        .filter((c) => c.tarde !== c.antes);

      for (let j = 0; j < cambios.length; j += LOTE) {
        await prisma.$transaction(
          cambios
            .slice(j, j + LOTE)
            .map((c) => prisma.attendanceRecord.update({ where: { id: c.id }, data: { lateMinutes: c.tarde } })),
        );
      }
      cambiadas += cambios.length;
    }
    return cambiadas;
  }
}
