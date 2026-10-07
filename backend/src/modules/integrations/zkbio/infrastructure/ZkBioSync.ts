import { Prisma } from '@prisma/client';
import { prisma } from '../../../../shared/infrastructure/database/prisma';
import { FieldCipher } from '../../../../shared/infrastructure/security/FieldCipher';
import { startOfDay, toDateOnlyString } from '../../../../shared/domain/dates';
import { AuditLoggerPort } from '../../../../shared/application/AuditLogger';
import { RegistradorMarcacionesBiometrico } from '../../../attendance/infrastructure/persistence/RegistradorMarcacionesBiometrico';
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
    private readonly registrador: RegistradorMarcacionesBiometrico,
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

      const r = await this.registrador.registrar(
        marcaciones.map((m) => ({
          codigo: String(m.emp_code),
          timestamp: fechaHoraLocal(m.punch_time),
          type: tipoDeMarcacion(m.punch_state),
          origen: `${PREFIJO_ID}${m.id}`,
          nota: m.terminal_alias ? `Reloj ${m.terminal_alias}` : null,
        })),
      );

      const resultado: ResultadoMarcaciones = {
        desde: texto(desde),
        hasta: texto(hasta),
        leidas: r.recibidas,
        nuevas: r.nuevas,
        repetidas: r.repetidas,
        sinEmpleado: r.sinEmpleado,
      };
      if (r.nuevas > 0 || actorId) {
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
