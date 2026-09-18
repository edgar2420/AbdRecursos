export interface PageMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface Paginated<T> {
  data: T[];
  meta: PageMeta;
}

export interface Envelope<T> {
  data: T;
  meta?: Record<string, unknown>;
}

export type Role = 'EMPLOYEE' | 'SUPERVISOR' | 'HR' | 'ADMIN';

export interface SessionUser {
  id: string;
  email: string;
  role: Role;
  employeeId: string | null;
  mustChangePassword?: boolean;
  lastLoginAt?: string | null;
}

export interface Employee {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  fullName: string;
  ci: string;
  ciExtension: string | null;
  birthDate: string | null;
  gender: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  hireDate: string;
  terminationDate: string | null;
  contractType: 'INDEFINIDO' | 'PLAZO_FIJO' | 'EVENTUAL' | 'CONSULTORIA';
  baseSalary: number;
  bankName: string | null;
  bankAccount: string | null;
  afpName: string | null;
  afpNumber: string | null;
  status: 'ACTIVE' | 'ON_LEAVE' | 'TERMINATED';
  isActive: boolean;
  jobProtection: boolean;
  jobProtectionUntil: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  emergencyContactRelation: string | null;
  departmentId: string | null;
  departmentName: string | null;
  positionId: string | null;
  positionName: string | null;
  supervisorId: string | null;
  supervisorName: string | null;
}

export interface EmployeeHistoryEntry {
  id: string;
  changeType: string;
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  effectiveDate: string;
  notes: string | null;
}

export interface CatalogItem {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  employeeCount?: number;
}

export interface EmployeeOption {
  id: string;
  label: string;
  departmentId: string | null;
}

export type VacationStatus =
  | 'PENDING_SUPERVISOR'
  | 'PENDING_HR'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED';

export interface VacationRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  departmentName: string | null;
  startDate: string;
  endDate: string;
  workingDays: number;
  reason: string | null;
  status: VacationStatus;
  supervisorApprovedByName: string | null;
  supervisorApprovalIsEmergency: boolean;
  emergencyReason: string | null;
  hrApprovedByName: string | null;
  rejectedByName: string | null;
  rejectionReason: string | null;
  createdAt: string;
}

export interface GestionBalance {
  numero: number;
  etiqueta: string;
  inicio: string;
  fin: string;
  cumplida: boolean;
  diasOtorgados: number;
  diasAcreditados: number;
  takenDays: number;
  pendingDays: number;
  saldoGestion: number;
}

export interface VacationBalance {
  employeeId: string;
  periodYear: number;
  entitledDays: number;
  takenDays: number;
  pendingDays: number;
  availableDays: number;
  yearsOfService: number;
  gestiones: GestionBalance[];
  gestionEnCurso: { etiqueta: string; fin: string; diasQueOtorgara: number } | null;
}

export interface CalendarEntry {
  requestId: string;
  employeeId: string;
  employeeName: string;
  departmentName: string | null;
  startDate: string;
  endDate: string;
  workingDays: number;
  status: VacationStatus;
}

export interface PayslipLine {
  type: 'EARNING' | 'DEDUCTION';
  code: string;
  concept: string;
  quantity: number | null;
  amount: number;
}

export interface Payslip {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  departmentName: string | null;
  periodYear: number;
  periodMonth: number;
  status: 'DRAFT' | 'ISSUED' | 'CANCELLED';
  workedDays: number;
  baseSalary: number;
  totalEarnings: number;
  totalDeductions: number;
  netPay: number;
  issuedAt: string | null;
  issuedByName: string | null;
  details: PayslipLine[];
}

export interface AguinaldoRow {
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  baseSalary: number;
  monthsWorked: number;
  entitled: boolean;
  amount: number;
  doubleAguinaldo: boolean;
  detail: string;
}

export interface LactationPermit {
  id: string;
  employeeId: string;
  employeeName: string;
  departmentName: string | null;
  birthDate: string;
  childName: string | null;
  startDate: string;
  endDate: string;
  dailyMinutes: number;
  slot1Start: string | null;
  slot1End: string | null;
  slot2Start: string | null;
  slot2End: string | null;
  isActive: boolean;
  notes: string | null;
  daysRemaining: number;
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  departmentName: string | null;
  timestamp: string;
  type: 'CHECK_IN' | 'CHECK_OUT';
  source: string;
  notes: string | null;
  lateMinutes: number;
}

export interface AttendanceReportRow {
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  departmentName: string | null;
  scheduleName: string | null;
  daysPresent: number;
  daysAbsent: number;
  daysJustified: number;
  daysLate: number;
  totalLateMinutes: number;
  workedHours: number;
  overtimeHours: number;
}

export interface AttendanceJustification {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  reason: string;
  attachmentUrl: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewNotes: string | null;
  createdAt: string;
}

export interface AuditLogEntry {
  id: string;
  userId: string | null;
  userName: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  changes: unknown;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
}

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

export interface ScheduleAssignment {
  id: string;
  scheduleId: string;
  scheduleName: string;
  startTime: string;
  endTime: string;
  weekDays: number[];
  employeeId: string;
  employeeName: string;
  departmentName: string | null;
  validFrom: string;
  validUntil: string | null;
  isActive: boolean;
}

export interface ImportRow {
  rowNumber: number;
  isValid: boolean;
  errors: string[];
  data: Record<string, unknown>;
}

export interface ImportLog {
  id: string;
  type: 'EMPLOYEES' | 'ATTENDANCE' | 'SCHEDULES';
  fileName: string;
  status: 'PENDING' | 'VALIDATED' | 'PROCESSED' | 'FAILED';
  totalRows: number;
  validRows: number;
  errorRows: number;
  processedRows: number;
  createdAt: string;
  processedAt: string | null;
  rows?: ImportRow[];
  errors?: string[];
}

export interface LegalParameter {
  id: string;
  key: string;
  value: string;
  valueType: 'number' | 'boolean' | 'string' | 'json';
  description: string | null;
  unit: string | null;
  validFrom: string;
  validUntil: string | null;
}

export interface DashboardData {
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
  turnoverRate: number;
  absenteeismRate: number;
  scope: 'GLOBAL' | 'TEAM' | 'SELF';
  period: { from: string; to: string };
}

export interface HeadcountReport {
  byDepartment: { groupId: string | null; groupName: string; total: number }[];
  byContractType: { groupId: string | null; groupName: string; total: number }[];
}

export type PapeletaTipo = 'HORAS_EXTRAS' | 'SALIDA';
export type PapeletaEstado =
  | 'PENDIENTE_JEFE_AREA'
  | 'PENDIENTE_RRHH'
  | 'APROBADA'
  | 'RECHAZADA'
  | 'ANULADA';

export interface Firma {
  userId: string;
  nombre: string | null;
  fecha: string;
  sello: string;
}

export interface Papeleta {
  id: string;
  numero: string;
  tipo: PapeletaTipo;
  estado: PapeletaEstado;
  employeeId: string;
  employeeNombre: string;
  employeeCodigo: string;
  area: string;
  fecha: string;
  trabajoRealizado: string | null;
  desde: string | null;
  hasta: string | null;
  totalHoras: number | null;
  recargo: 'DIURNA' | 'NOCTURNA' | 'FERIADO' | null;
  salidaMotivo: 'PARTICULAR' | 'OFICIAL' | 'MEDICA' | null;
  motivo: string | null;
  tiempoSolicitado: string | null;
  horaSalida: string | null;
  horaRetorno: string | null;
  attachmentUrl: string | null;
  firmaArea: Firma | null;
  firmaRrhh: Firma | null;
  motivoRechazo: string | null;
  createdAt: string;
}

export interface SystemUser {
  id: string;
  email: string;
  role: Role;
  isActive: boolean;
  employeeId: string | null;
  employeeName?: string | null;
  lastLoginAt: string | null;
}
