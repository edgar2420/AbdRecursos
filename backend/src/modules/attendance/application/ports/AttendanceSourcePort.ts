import { NewAttendanceRecord } from '../../domain/entities/AttendanceRecord';

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
