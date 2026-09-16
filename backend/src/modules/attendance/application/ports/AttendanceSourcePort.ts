import { NewAttendanceRecord } from '../../domain/entities/AttendanceRecord';

/**
 * Puerto de origen de marcaciones (5.5). El primer adaptador es manual/web;
 * conectar un reloj biometrico real solo requiere implementar esta interfaz,
 * sin tocar el dominio.
 */
export interface RawPunch {
  employeeCode: string;
  timestamp: Date;
  type?: 'CHECK_IN' | 'CHECK_OUT';
  deviceId?: string;
}

export interface AttendanceSourcePort {
  readonly name: string;
  fetchPunches(from: Date, to: Date): Promise<RawPunch[]>;
  toRecords(punches: RawPunch[], resolveEmployeeId: (code: string) => string | undefined): NewAttendanceRecord[];
}
