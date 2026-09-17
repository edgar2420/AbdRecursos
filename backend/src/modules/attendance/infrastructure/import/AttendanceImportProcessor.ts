import { ColumnSpec } from '../../../../shared/infrastructure/excel/ExcelService';
import { ImportRow, ImportType } from '../../../imports/domain/entities/ImportLog';
import { ImportProcessor, RowValidation } from '../../../imports/domain/ports/ImportProcessor';
import { EmployeeRepository } from '../../../employees/domain/repositories/EmployeeRepository';
import { text } from '../../../employees/infrastructure/import/EmployeeImportProcessor';
import { AttendanceRepository } from '../../domain/repositories/AttendanceRepository';

export const ATTENDANCE_IMPORT_COLUMNS: ColumnSpec[] = [
  {
    key: 'employeeCode',
    header: 'Codigo empleado',
    required: true,
    example: 'EMP-0001',
    note: 'Codigo del empleado tal como figura en el sistema',
  },
  { key: 'date', header: 'Fecha', required: true, example: '2026-03-15', note: 'Formato AAAA-MM-DD' },
  { key: 'checkIn', header: 'Hora entrada', example: '08:05', note: 'Formato HH:mm (24 horas)' },
  { key: 'checkOut', header: 'Hora salida', example: '17:00', note: 'Formato HH:mm (24 horas)' },
  { key: 'deviceId', header: 'Dispositivo', example: 'RELOJ-01', note: 'Opcional: identificador del reloj biometrico' },
  { key: 'notes', header: 'Observacion', width: 30 },
];

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

function parseTime(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) {
    const p = (n: number) => String(n).padStart(2, '0');
    return `${p(value.getHours())}:${p(value.getMinutes())}`;
  }
  const raw = String(value).trim().slice(0, 5);
  return TIME_PATTERN.test(raw) ? raw : null;
}

function parseDay(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value).trim());
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : null;
}

export class AttendanceImportProcessor implements ImportProcessor {
  readonly type: ImportType = 'ATTENDANCE';
  readonly sheetName = 'Asistencia';
  readonly columns = ATTENDANCE_IMPORT_COLUMNS;

  private employeesByCode = new Map<string, string>();

  constructor(
    private readonly attendance: AttendanceRepository,
    private readonly employees: EmployeeRepository,
  ) {}

  async prepare(): Promise<void> {
    const roster = await this.employees.listAll({ isActive: true });
    this.employeesByCode = new Map(roster.map((e) => [e.employeeCode.toLowerCase(), e.id]));
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
      data.employeeCode = code;
    }

    const day = parseDay(raw.date);
    if (!day) errors.push('Fecha invalida (use AAAA-MM-DD)');
    if (day && day > new Date()) errors.push('La fecha no puede ser futura');
    data.date = day ? day.toISOString() : null;

    const checkIn = parseTime(raw.checkIn);
    const checkOut = parseTime(raw.checkOut);
    if (raw.checkIn && !checkIn) errors.push('Hora de entrada invalida (use HH:mm)');
    if (raw.checkOut && !checkOut) errors.push('Hora de salida invalida (use HH:mm)');
    if (!checkIn && !checkOut) errors.push('Indique al menos una hora de entrada o salida');
    if (checkIn && checkOut && checkOut <= checkIn) {
      errors.push('La salida debe ser posterior a la entrada');
    }
    data.checkIn = checkIn;
    data.checkOut = checkOut;
    data.deviceId = text(raw.deviceId);
    data.notes = text(raw.notes);

    return { isValid: errors.length === 0, errors, data };
  }

  async processRows(rows: ImportRow[]): Promise<{ processed: number; errors: string[] }> {
    const records = [];
    const errors: string[] = [];

    for (const row of rows) {
      const data = row.data;
      const day = new Date(String(data.date));
      const employeeId = String(data.employeeId);

      for (const [field, type] of [
        ['checkIn', 'CHECK_IN'],
        ['checkOut', 'CHECK_OUT'],
      ] as const) {
        const time = data[field] as string | null;
        if (!time) continue;
        const [hours, minutes] = time.split(':').map(Number);
        const timestamp = new Date(day);
        timestamp.setHours(hours, minutes, 0, 0);
        records.push({
          employeeId,
          timestamp,
          type,
          source: 'IMPORT' as const,
          deviceId: (data.deviceId as string) ?? null,
          notes: (data.notes as string) ?? null,
        });
      }
    }

    const processed = await this.attendance.createMany(records);
    if (processed < records.length) {
      errors.push(`${records.length - processed} marcaciones ya existian y se omitieron`);
    }
    return { processed, errors };
  }
}
