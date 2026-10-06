import { Prisma } from '@prisma/client';
import { prisma } from '../../../../shared/infrastructure/database/prisma';
import { FieldCipher } from '../../../../shared/infrastructure/security/FieldCipher';
import { startOfDay, toDateOnlyString } from '../../../../shared/domain/dates';
import { AuditLoggerPort } from '../../../../shared/application/AuditLogger';
import { ScheduleRepository } from '../../../schedules/domain/repositories/ScheduleRepository';
import { GetLegalParameters } from '../../../legal-parameters/application/use-cases/GetLegalParameters';
import { AttendanceCalculator } from '../../../attendance/domain/services/AttendanceCalculator';
import { fechaHoraLocal, nombreDesdeZk, tipoDeMarcacion } from '../domain/nombres';
import { ZkBioTimeClient } from './ZkBioTimeClient';

/** Codigo de la ficha tecnica del administrador del sistema: no existe en ZKBio Time y nunca se sincroniza. */
export const CODIGO_ADMIN_SISTEMA = 'ADMIN';

export interface ResultadoPersonal {
  leidos: number;
  creados: number;
  actualizados: number;
  nombresACorregir: number;
  departamentosCreados: number;
}

export interface ResultadoMarcaciones {
  desde: string;
  hasta: string;
  leidas: number;
  nuevas: number;
  repetidas: number;
  sinEmpleado: number;
}

const PREFIJO_ID = 'zkbio:';

function texto(fecha: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${toDateOnlyString(fecha)} ${p(fecha.getHours())}:${p(fecha.getMinutes())}:${p(fecha.getSeconds())}`;
}

export class ZkBioSync {
  private readonly cipher = new FieldCipher();
  private enCurso = false;

  constructor(
    private readonly client: ZkBioTimeClient,
    private readonly schedules: ScheduleRepository,
    private readonly parameters: GetLegalParameters,
    private readonly audit: AuditLoggerPort,
  ) {}

  async sincronizarPersonal(actorId: string | null = null): Promise<ResultadoPersonal> {
    const zk = await this.client.empleados();

    const departamentos = new Map(
      (await prisma.department.findMany({ select: { id: true, name: true } })).map((d) => [d.name, d.id]),
    );
    let departamentosCreados = 0;
    for (const nombre of new Set(zk.map((e) => e.department?.dept_name?.trim()).filter((n): n is string => !!n))) {
      if (departamentos.has(nombre)) continue;
      const nuevo = await prisma.department.create({ data: { name: nombre } });
      departamentos.set(nombre, nuevo.id);
      departamentosCreados++;
    }

    const existentes = new Map(
      (await prisma.employee.findMany({ select: { id: true, employeeCode: true, firstName: true } })).map((e) => [
        e.employeeCode,
        e,
      ]),
    );

    let creados = 0;
    let actualizados = 0;
    let nombresACorregir = 0;

    for (const e of zk) {
      const codigo = String(e.emp_code).trim();
      if (!codigo || codigo === CODIGO_ADMIN_SISTEMA) continue;
      const nombre = nombreDesdeZk(codigo, e.first_name, e.last_name);
      if (nombre.aCorregir) nombresACorregir++;
      const departmentId = departamentos.get(e.department?.dept_name?.trim() ?? '') ?? null;
      const actual = existentes.get(codigo);

      if (!actual) {
        await prisma.employee.create({
          data: {
            employeeCode: codigo,
            firstName: nombre.firstName,
            lastName: nombre.lastName,
            ci: this.cipher.cifrar(`SIN-CI-${codigo}`) ?? '',
            hireDate: e.hire_date ? fechaHoraLocal(e.hire_date) : startOfDay(new Date()),
            baseSalary: new Prisma.Decimal(0),
            gender: e.gender || null,
            email: e.email || null,
            departmentId,
          },
        });
        creados++;
        continue;
      }

      // Un nombre danado en ZKBio Time no pisa el que RRHH ya corrigio en el SGRH.
      const data: Prisma.EmployeeUpdateInput = {
        department: departmentId ? { connect: { id: departmentId } } : { disconnect: true },
        isActive: true,
      };
      if (!nombre.aCorregir) {
        data.firstName = nombre.firstName;
        data.lastName = nombre.lastName;
      }
      await prisma.employee.update({ where: { id: actual.id }, data });
      actualizados++;
    }

    const resultado = { leidos: zk.length, creados, actualizados, nombresACorregir, departamentosCreados };
    await this.audit.log({
      userId: actorId,
      action: 'ZKBIO_SYNC_EMPLOYEES',
      entity: 'Employee',
      entityId: null,
      changes: { ...resultado },
    });
    return resultado;
  }

  /** Trae marcaciones del rango (por defecto, desde la ultima importada) y las guarda sin duplicar. */
  async sincronizarMarcaciones(
    rango: { desde?: Date; hasta?: Date } = {},
    actorId: string | null = null,
  ): Promise<ResultadoMarcaciones | null> {
    if (this.enCurso) return null;
    this.enCurso = true;
    try {
      const hasta = rango.hasta ?? new Date();
      const desde = rango.desde ?? (await this.desdeUltimaImportada(hasta));
      const marcaciones = await this.client.marcaciones(texto(desde), texto(hasta));

      const empleados = new Map(
        (await prisma.employee.findMany({ select: { id: true, employeeCode: true } })).map((e) => [e.employeeCode, e.id]),
      );
      const ids = marcaciones.map((m) => `${PREFIJO_ID}${m.id}`);
      const yaGuardadas = new Set(
        (
          await prisma.attendanceRecord.findMany({
            where: { source: 'BIOMETRIC', deviceId: { in: ids } },
            select: { deviceId: true },
          })
        ).map((r) => r.deviceId),
      );

      const pendientes = marcaciones.filter((m) => !yaGuardadas.has(`${PREFIJO_ID}${m.id}`));
      const conEmpleado = pendientes.filter((m) => empleados.has(String(m.emp_code).trim()));

      const empleadoIds = [...new Set(conEmpleado.map((m) => empleados.get(String(m.emp_code).trim())!))];
      const horarios = new Map(
        (await this.schedules.findActiveForEmployees(empleadoIds, hasta)).map((a) => [a.employeeId, a]),
      );
      const calculadora = new AttendanceCalculator(await this.parameters.execute(hasta));

      const filas: Prisma.AttendanceRecordCreateManyInput[] = conEmpleado.map((m) => {
        const employeeId = empleados.get(String(m.emp_code).trim())!;
        const timestamp = fechaHoraLocal(m.punch_time);
        const type = tipoDeMarcacion(m.punch_state);
        const h = horarios.get(employeeId);
        const lateMinutes =
          type === 'CHECK_IN' && h
            ? calculadora.lateMinutesFor(timestamp, {
                startTime: h.startTime,
                endTime: h.endTime,
                toleranceMinutes: h.toleranceMinutes,
                breakMinutes: 0,
                weekDays: h.weekDays,
              })
            : 0;
        return {
          employeeId,
          timestamp,
          type,
          source: 'BIOMETRIC',
          deviceId: `${PREFIJO_ID}${m.id}`,
          notes: m.terminal_alias ? `Reloj ${m.terminal_alias}` : null,
          lateMinutes,
        };
      });

      for (let i = 0; i < filas.length; i += 1000) {
        await prisma.attendanceRecord.createMany({ data: filas.slice(i, i + 1000) });
      }

      const resultado: ResultadoMarcaciones = {
        desde: texto(desde),
        hasta: texto(hasta),
        leidas: marcaciones.length,
        nuevas: filas.length,
        repetidas: marcaciones.length - pendientes.length,
        sinEmpleado: pendientes.length - conEmpleado.length,
      };
      if (filas.length > 0 || actorId) {
        await this.audit.log({
          userId: actorId,
          action: 'ZKBIO_SYNC_ATTENDANCE',
          entity: 'AttendanceRecord',
          entityId: null,
          changes: { ...resultado },
        });
      }
      return resultado;
    } finally {
      this.enCurso = false;
    }
  }

  private async desdeUltimaImportada(hasta: Date): Promise<Date> {
    const ultima = await prisma.attendanceRecord.findFirst({
      where: { source: 'BIOMETRIC' },
      orderBy: { timestamp: 'desc' },
      select: { timestamp: true },
    });
    if (ultima) return new Date(ultima.timestamp.getTime() - 60 * 60 * 1000);
    return new Date(hasta.getFullYear(), hasta.getMonth() - 1, 1);
  }
}
