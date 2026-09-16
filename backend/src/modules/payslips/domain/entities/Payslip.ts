export type PayslipStatus = 'DRAFT' | 'ISSUED' | 'CANCELLED';
export type PayslipLineType = 'EARNING' | 'DEDUCTION';

export interface PayslipLine {
  type: PayslipLineType;
  code: string;
  concept: string;
  quantity: number | null;
  amount: number;
  orderIndex: number;
}

export interface Payslip {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  departmentName: string | null;
  periodYear: number;
  periodMonth: number;
  status: PayslipStatus;
  workedDays: number;
  baseSalary: number;
  totalEarnings: number;
  totalDeductions: number;
  netPay: number;
  issuedAt: Date | null;
  createdAt: Date;
  details: PayslipLine[];
}

export interface NewPayslip {
  employeeId: string;
  periodYear: number;
  periodMonth: number;
  workedDays: number;
  baseSalary: number;
  totalEarnings: number;
  totalDeductions: number;
  netPay: number;
  parametersSnapshot: Record<string, string>;
  details: PayslipLine[];
}
