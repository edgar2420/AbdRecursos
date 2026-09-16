export type AttendanceType = 'CHECK_IN' | 'CHECK_OUT';
export type AttendanceSource = 'WEB' | 'MOBILE' | 'BIOMETRIC' | 'IMPORT' | 'MANUAL_HR';

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  departmentName: string | null;
  timestamp: Date;
  type: AttendanceType;
  source: AttendanceSource;
  deviceId: string | null;
  notes: string | null;
  lateMinutes: number;
}

export interface NewAttendanceRecord {
  employeeId: string;
  timestamp: Date;
  type: AttendanceType;
  source: AttendanceSource;
  deviceId?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  notes?: string | null;
  lateMinutes?: number;
}

export type JustificationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface AttendanceJustification {
  id: string;
  employeeId: string;
  employeeName: string;
  date: Date;
  reason: string;
  attachmentUrl: string | null;
  status: JustificationStatus;
  reviewedAt: Date | null;
  reviewNotes: string | null;
  createdAt: Date;
}
