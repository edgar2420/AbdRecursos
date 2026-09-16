export type ContractType = 'INDEFINIDO' | 'PLAZO_FIJO' | 'EVENTUAL' | 'CONSULTORIA';
export type EmployeeStatus = 'ACTIVE' | 'ON_LEAVE' | 'TERMINATED';

export interface Employee {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  fullName: string;
  ci: string;
  ciExtension: string | null;
  birthDate: Date | null;
  gender: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  photoUrl: string | null;
  hireDate: Date;
  terminationDate: Date | null;
  contractType: ContractType;
  baseSalary: number;
  bankName: string | null;
  bankAccount: string | null;
  afpName: string | null;
  afpNumber: string | null;
  status: EmployeeStatus;
  isActive: boolean;
  jobProtection: boolean;
  jobProtectionUntil: Date | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  emergencyContactRelation: string | null;
  departmentId: string | null;
  departmentName: string | null;
  positionId: string | null;
  positionName: string | null;
  supervisorId: string | null;
  supervisorName: string | null;
  createdAt: Date;
}

export interface NewEmployee {
  employeeCode: string;
  firstName: string;
  lastName: string;
  ci: string;
  ciExtension?: string | null;
  birthDate?: Date | null;
  gender?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  photoUrl?: string | null;
  hireDate: Date;
  contractType: ContractType;
  baseSalary: number;
  bankName?: string | null;
  bankAccount?: string | null;
  afpName?: string | null;
  afpNumber?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  emergencyContactRelation?: string | null;
  departmentId?: string | null;
  positionId?: string | null;
  supervisorId?: string | null;
}

export type UpdateEmployeeData = Partial<Omit<NewEmployee, 'employeeCode'>> & {
  status?: EmployeeStatus;
  jobProtection?: boolean;
  jobProtectionUntil?: Date | null;
  terminationDate?: Date | null;
};

export type EmployeeChangeType =
  | 'HIRE'
  | 'PROMOTION'
  | 'SALARY_CHANGE'
  | 'DEPARTMENT_CHANGE'
  | 'POSITION_CHANGE'
  | 'CONTRACT_CHANGE'
  | 'TERMINATION'
  | 'REACTIVATION';

export interface EmployeeHistoryEntry {
  id: string;
  employeeId: string;
  changeType: EmployeeChangeType;
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  effectiveDate: Date;
  notes: string | null;
  createdAt: Date;
}
