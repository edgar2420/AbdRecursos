import { Prisma } from '@prisma/client';
import { prisma } from '../../../../shared/infrastructure/database/prisma';
import { PublicadorEventos, sinEventos } from '../../../../shared/application/Eventos';
import { GetLegalParameters } from '../../../legal-parameters/application/use-cases/GetLegalParameters';
import { ScheduleRepository } from '../../../schedules/domain/repositories/ScheduleRepository';
import { AttendanceCalculator } from '../../domain/services/AttendanceCalculator';

export interface MarcacionBiometrica {
  /** Codigo del empleado en el reloj (= employeeCode en el SGRH). */
  codigo: string;
  timestamp: Date;
  type: 'CHECK_IN' | 'CHECK_OUT';
  /** Identificador de origen para auditoria, p. ej. "zkbio:123" o "iclock:JYP...". */
  origen: string;
  nota?: string | null;
}

export interface ResultadoRegistro {
  recibidas: number;
  nuevas: number;
  repetidas: number;
  sinEmpleado: number;
}

/**
 * Guarda marcaciones del biometrico sin duplicar. La misma marcacion puede llegar por dos vias
 * (directo del reloj y desde ZKBio Time), por eso el duplicado se detecta por empleado + hora exacta.
 */
export class RegistradorMarcacionesBiometrico {
  constructor(
    private readonly schedules: ScheduleRepository,
    private readonly parameters: GetLegalParameters,
    private readonly eventos: PublicadorEventos = sinEventos,
  ) {}

  async registrar(marcaciones: MarcacionBiometrica[]): Promise<ResultadoRegistro> {
    const resultado: ResultadoRegistro = { recibidas: marcaciones.length, nuevas: 0, repetidas: 0, sinEmpleado: 0 };
    if (marcaciones.length === 0) return resultado;

    const codigos = [...new Set(marcaciones.map((m) => m.codigo.trim()))];
    const empleados = new Map(
      (
        await prisma.employee.findMany({ where: { employeeCode: { in: codigos } }, select: { id: true, employeeCode: true } })
      ).map((e) => [e.employeeCode, e.id]),
    );

    const conEmpleado = marcaciones.filter((m) => empleados.has(m.codigo.trim()));
    resultado.sinEmpleado = marcaciones.length - conEmpleado.length;
    if (conEmpleado.length === 0) return resultado;

    const tiempos = conEmpleado.map((m) => m.timestamp.getTime());
    const existentes = await prisma.attendanceRecord.findMany({
      where: {
        employeeId: { in: [...new Set(conEmpleado.map((m) => empleados.get(m.codigo.trim())!))] },
        timestamp: { gte: new Date(Math.min(...tiempos)), lte: new Date(Math.max(...tiempos)) },
      },
      select: { employeeId: true, timestamp: true },
    });
    const vistas = new Set(existentes.map((r) => `${r.employeeId}|${r.timestamp.getTime()}`));

    const nuevas: Array<MarcacionBiometrica & { employeeId: string }> = [];
    for (const m of conEmpleado) {
      const employeeId = empleados.get(m.codigo.trim())!;
      const clave = `${employeeId}|${m.timestamp.getTime()}`;
      if (vistas.has(clave)) {
        resultado.repetidas++;
        continue;
      }
      vistas.add(clave);
      nuevas.push({ ...m, employeeId });
    }
    if (nuevas.length === 0) return resultado;

    const masReciente = new Date(Math.max(...nuevas.map((m) => m.timestamp.getTime())));
    const horarios = new Map(
      (await this.schedules.findActiveForEmployees([...new Set(nuevas.map((m) => m.employeeId))], masReciente)).map(
        (a) => [a.employeeId, a],
      ),
    );
    const calculadora = new AttendanceCalculator(await this.parameters.execute(masReciente));

    const filas: Prisma.AttendanceRecordCreateManyInput[] = nuevas.map((m) => {
      const h = horarios.get(m.employeeId);
      const lateMinutes =
        m.type === 'CHECK_IN' && h
          ? calculadora.lateMinutesFor(m.timestamp, {
              startTime: h.startTime,
              endTime: h.endTime,
              toleranceMinutes: h.toleranceMinutes,
              breakMinutes: 0,
              weekDays: h.weekDays,
            })
          : 0;
      return {
        employeeId: m.employeeId,
        timestamp: m.timestamp,
        type: m.type,
        source: 'BIOMETRIC',
        deviceId: m.origen,
        notes: m.nota ?? null,
        lateMinutes,
      };
    });

    // skipDuplicates: si otro servidor guardo la misma marcacion al mismo tiempo, el indice unico la descarta.
    let guardadas = 0;
    for (let i = 0; i < filas.length; i += 1000) {
      guardadas += (await prisma.attendanceRecord.createMany({ data: filas.slice(i, i + 1000), skipDuplicates: true })).count;
    }
    resultado.nuevas = guardadas;
    resultado.repetidas += filas.length - guardadas;
    if (guardadas > 0) this.eventos.publicar('marcaciones');
    return resultado;
  }
}
