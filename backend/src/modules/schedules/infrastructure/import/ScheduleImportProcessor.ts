import { ColumnSpec } from '../../../../shared/infrastructure/excel/ExcelService';
import { ImportRow, ImportType } from '../../../imports/domain/entities/ImportLog';
import { ImportProcessor, RowValidation } from '../../../imports/domain/ports/ImportProcessor';
import { EmployeeRepository } from '../../../employees/domain/repositories/EmployeeRepository';
import { text } from '../../../employees/infrastructure/import/EmployeeImportProcessor';
import { ScheduleRepository } from '../../domain/repositories/ScheduleRepository';

export const SCHEDULE_IMPORT_COLUMNS: ColumnSpec[] = [
  { key: 'employeeCode', header: 'Codigo empleado', required: true, example: 'EMP-0001' },
  {
    key: 'scheduleName',
    header: 'Horario',
    required: true,
    example: 'Administrativo 08:30-17:00',
    note: 'El horario debe existir previamente en el modulo de Horarios',
  },
  { key: 'validFrom', header: 'Vigente desde', required: true, example: '2026-01-01', note: 'Formato AAAA-MM-DD' },
  { key: 'validUntil', header: 'Vigente hasta', example: '2026-12-31', note: 'Opcional: vacio = sin fecha de fin' },
];

function parseDay(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value).trim());
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : null;
}

export class ScheduleImportProcessor implements ImportProcessor {
  readonly type: ImportType = 'SCHEDULES';
  readonly sheetName = 'Horarios';
  readonly columns = SCHEDULE_IMPORT_COLUMNS;

  private employeesByCode = new Map<string, string>();
  private schedulesByName = new Map<string, string>();

  constructor(
    private readonly schedules: ScheduleRepository,
    private readonly employees: EmployeeRepository,
  ) {}

  async prepare(): Promise<void> {
    const [roster, schedules] = await Promise.all([
      this.employees.listAll({ isActive: true }),
      this.schedules.list({ page: 1, limit: 200, order: 'asc', isActive: true }),
    ]);
    this.employeesByCode = new Map(roster.map((e) => [e.employeeCode.toLowerCase(), e.id]));
    this.schedulesByName = new Map(schedules.data.map((s) => [s.name.toLowerCase(), s.id]));
  }

  async validateRow(raw: Record<string, unknown>): Promise<RowValidation> {
    const errors: string[] = [];
    const data: Record<string, unknown> = {};

    const code = text(raw.employeeCode);
    if (!code) {
      errors.push('Codigo de empleado es obligatorio');
    } else {
      const employeeId = this.employeesByCode.get(code.toLowerCase());
      if (!employeeId) errors.push(`No existe un empleado activo con codigo ${code}`);
      data.employeeId = employeeId ?? null;
    }

    const scheduleName = text(raw.scheduleName);
    if (!scheduleName) {
      errors.push('El horario es obligatorio');
    } else {
      const scheduleId = this.schedulesByName.get(scheduleName.toLowerCase());
      if (!scheduleId) errors.push(`El horario "${scheduleName}" no existe`);
      data.scheduleId = scheduleId ?? null;
    }

    const validFrom = parseDay(raw.validFrom);
    if (!validFrom) errors.push('Fecha de inicio invalida (use AAAA-MM-DD)');
    data.validFrom = validFrom ? validFrom.toISOString() : null;

    const validUntil = parseDay(raw.validUntil);
    if (raw.validUntil && !validUntil) errors.push('Fecha de fin invalida (use AAAA-MM-DD)');
    if (validFrom && validUntil && validUntil < validFrom) {
      errors.push('La fecha de fin no puede ser anterior al inicio');
    }
    data.validUntil = validUntil ? validUntil.toISOString() : null;

    if (data.employeeId && validFrom) {
      const overlaps = await this.schedules.hasOverlappingAssignment(
        String(data.employeeId),
        validFrom,
        validUntil,
      );
      if (overlaps) errors.push('El empleado ya tiene un horario vigente en ese rango');
    }

    return { isValid: errors.length === 0, errors, data };
  }

  async processRows(rows: ImportRow[]): Promise<{ processed: number; errors: string[] }> {
    let processed = 0;
    const errors: string[] = [];

    for (const row of rows) {
      try {
        await this.schedules.assign({
          scheduleId: String(row.data.scheduleId),
          employeeId: String(row.data.employeeId),
          validFrom: new Date(String(row.data.validFrom)),
          validUntil: row.data.validUntil ? new Date(String(row.data.validUntil)) : null,
        });
        processed++;
      } catch (error) {
        errors.push(`Fila ${row.rowNumber}: ${(error as Error).message}`);
      }
    }

    return { processed, errors };
  }
}
