import { Paginated, PageQuery } from '../../../../shared/domain/pagination';
import {
  AttendanceJustification,
  AttendanceRecord,
  JustificationStatus,
  NewAttendanceRecord,
} from '../entities/AttendanceRecord';

export interface AttendanceFilters extends PageQuery {
  employeeId?: string;
  employeeIds?: string[];
  departmentId?: string;
  type?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

export interface AttendanceRepository {
  create(data: NewAttendanceRecord): Promise<AttendanceRecord>;
  createMany(data: NewAttendanceRecord[]): Promise<number>;
  list(filters: AttendanceFilters): Promise<Paginated<AttendanceRecord>>;
  listBetween(from: Date, to: Date, employeeIds?: string[]): Promise<AttendanceRecord[]>;
  lastRecordOfDay(employeeId: string, date: Date): Promise<AttendanceRecord | null>;
  countLateInMonth(employeeIds: string[], year: number, month: number): Promise<number>;
  findById(id: string): Promise<AttendanceRecord | null>;
  update(id: string, data: { timestamp?: Date; notes?: string | null; lateMinutes?: number }): Promise<AttendanceRecord>;

  createJustification(data: {
    employeeId: string;
    date: Date;
    reason: string;
    attachmentUrl?: string | null;
  }): Promise<AttendanceJustification>;
  listJustifications(
    filters: PageQuery & { employeeIds?: string[]; status?: JustificationStatus; dateFrom?: Date; dateTo?: Date },
  ): Promise<Paginated<AttendanceJustification>>;
  findJustification(id: string): Promise<AttendanceJustification | null>;
  reviewJustification(
    id: string,
    data: { status: JustificationStatus; reviewedBy: string; reviewNotes?: string | null },
  ): Promise<AttendanceJustification>;
  approvedJustificationDates(employeeIds: string[], from: Date, to: Date): Promise<{ employeeId: string; date: Date }[]>;
}
