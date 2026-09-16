export interface Schedule {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  toleranceMinutes: number;
  weekDays: number[];
  isNightShift: boolean;
  isActive: boolean;
  assignedCount?: number;
}

export interface NewSchedule {
  name: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  toleranceMinutes: number;
  weekDays: number[];
  isNightShift?: boolean;
}

export interface ScheduleAssignment {
  id: string;
  scheduleId: string;
  scheduleName: string;
  startTime: string;
  endTime: string;
  toleranceMinutes: number;
  weekDays: number[];
  employeeId: string;
  employeeName: string;
  departmentName: string | null;
  validFrom: Date;
  validUntil: Date | null;
  isActive: boolean;
}

export interface NewScheduleAssignment {
  scheduleId: string;
  employeeId: string;
  validFrom: Date;
  validUntil?: Date | null;
}
