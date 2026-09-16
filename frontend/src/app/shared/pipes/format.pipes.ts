import { Pipe, PipeTransform } from '@angular/core';

/** Montos en bolivianos con separador de miles y dos decimales. */
@Pipe({ name: 'bs', standalone: true })
export class BolivianosPipe implements PipeTransform {
  transform(value: number | string | null | undefined, withSymbol = true): string {
    const amount = Number(value ?? 0);
    const formatted = amount.toLocaleString('es-BO', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return withSymbol ? `Bs ${formatted}` : formatted;
  }
}

/** Fecha corta en formato boliviano (dd/mm/aaaa). */
@Pipe({ name: 'fecha', standalone: true })
export class FechaPipe implements PipeTransform {
  transform(value: string | Date | null | undefined, withTime = false): string {
    if (!value) return '-';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    const p = (n: number) => String(n).padStart(2, '0');
    const base = `${p(date.getDate())}/${p(date.getMonth() + 1)}/${date.getFullYear()}`;
    return withTime ? `${base} ${p(date.getHours())}:${p(date.getMinutes())}` : base;
  }
}

const LABELS: Record<string, string> = {
  // Roles
  EMPLOYEE: 'Empleado',
  SUPERVISOR: 'Supervisor',
  HR: 'Recursos Humanos',
  ADMIN: 'Administrador',
  // Empleado
  ACTIVE: 'Activo',
  ON_LEAVE: 'Con licencia',
  TERMINATED: 'Desvinculado',
  INDEFINIDO: 'Indefinido',
  PLAZO_FIJO: 'Plazo fijo',
  EVENTUAL: 'Eventual',
  CONSULTORIA: 'Consultoria',
  // Vacaciones
  PENDING_SUPERVISOR: 'Pendiente supervisor',
  PENDING_HR: 'Pendiente RRHH',
  APPROVED: 'Aprobada',
  REJECTED: 'Rechazada',
  CANCELLED: 'Cancelada',
  // Boletas
  DRAFT: 'Borrador',
  ISSUED: 'Emitida',
  // Asistencia
  CHECK_IN: 'Entrada',
  CHECK_OUT: 'Salida',
  PRESENT: 'Presente',
  LATE: 'Con retraso',
  ABSENT: 'Falta',
  INCOMPLETE: 'Incompleta',
  REST: 'Descanso',
  JUSTIFIED: 'Justificada',
  PENDING: 'Pendiente',
  // Importaciones
  VALIDATED: 'Validada',
  PROCESSED: 'Procesada',
  FAILED: 'Fallida',
  EMPLOYEES: 'Empleados',
  ATTENDANCE: 'Asistencia',
  SCHEDULES: 'Horarios',
  // Papeletas
  PENDIENTE_JEFE_AREA: 'Pendiente jefe de area',
  PENDIENTE_RRHH: 'Pendiente RRHH',
  APROBADA: 'Aprobada',
  RECHAZADA: 'Rechazada',
  ANULADA: 'Anulada',
  HORAS_EXTRAS: 'Horas extras',
  SALIDA: 'Salida',
  PARTICULAR: 'Particular',
  OFICIAL: 'Oficial',
  MEDICA: 'Medica',
  DIURNA: 'Diurna',
  NOCTURNA: 'Nocturna',
  FERIADO: 'Feriado',
  // Historial
  HIRE: 'Alta',
  PROMOTION: 'Ascenso',
  SALARY_CHANGE: 'Cambio de salario',
  DEPARTMENT_CHANGE: 'Cambio de departamento',
  POSITION_CHANGE: 'Cambio de cargo',
  CONTRACT_CHANGE: 'Cambio de contrato',
  TERMINATION: 'Desvinculacion',
  REACTIVATION: 'Reactivacion',
};

/** Traduce los enums de la API a etiquetas legibles. */
@Pipe({ name: 'etiqueta', standalone: true })
export class EtiquetaPipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    if (!value) return '-';
    return LABELS[value] ?? value;
  }
}

const BADGE_CLASSES: Record<string, string> = {
  ACTIVE: 'badge-ok',
  APPROVED: 'badge-ok',
  ISSUED: 'badge-ok',
  PRESENT: 'badge-ok',
  PROCESSED: 'badge-ok',
  PENDING_SUPERVISOR: 'badge-warn',
  PENDING_HR: 'badge-warn',
  PENDING: 'badge-warn',
  DRAFT: 'badge-warn',
  LATE: 'badge-warn',
  INCOMPLETE: 'badge-warn',
  ON_LEAVE: 'badge-info',
  VALIDATED: 'badge-info',
  JUSTIFIED: 'badge-info',
  REJECTED: 'badge-danger',
  PENDIENTE_JEFE_AREA: 'badge-warn',
  PENDIENTE_RRHH: 'badge-warn',
  APROBADA: 'badge-ok',
  RECHAZADA: 'badge-danger',
  ANULADA: 'badge-neutral',
  CANCELLED: 'badge-neutral',
  TERMINATED: 'badge-danger',
  ABSENT: 'badge-danger',
  FAILED: 'badge-danger',
  REST: 'badge-neutral',
};

/** Clase de color del badge segun el estado. */
@Pipe({ name: 'badgeClase', standalone: true })
export class BadgeClasePipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    return `badge ${BADGE_CLASSES[value ?? ''] ?? 'badge-neutral'}`;
  }
}
