export interface HeadcountByGroup {
  groupId: string | null;
  groupName: string;
  total: number;
}

export interface DashboardCounters {
  headcount: number;
  hiresInPeriod: number;
  terminationsInPeriod: number;
  pendingVacations: number;
  approvedVacationDays: number;
  lactationActive: number;
  lactationExpiringSoon: number;
  payslipsThisMonth: number;
  payslipsNetTotal: number;
  attendanceLateCount: number;
  attendanceAbsenceCount: number;
  openJustifications: number;
}

export interface ReportFilters {
  from: Date;
  to: Date;
  departmentId?: string;
  employeeIds?: string[];
}

export interface ReportRepository {
  counters(filters: ReportFilters): Promise<DashboardCounters>;
  headcountByDepartment(employeeIds?: string[]): Promise<HeadcountByGroup[]>;
  headcountByContractType(employeeIds?: string[]): Promise<HeadcountByGroup[]>;
  payrollByMonth(year: number, employeeIds?: string[]): Promise<{ month: number; total: number; count: number }[]>;
  turnoverByMonth(year: number): Promise<{ month: number; hires: number; terminations: number }[]>;
}
