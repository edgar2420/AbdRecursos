export interface LactationPermit {
  id: string;
  employeeId: string;
  employeeName: string;
  departmentName: string | null;
  birthDate: Date;
  childName: string | null;
  startDate: Date;
  endDate: Date;
  dailyMinutes: number;
  slot1Start: string | null;
  slot1End: string | null;
  slot2Start: string | null;
  slot2End: string | null;
  documentUrl: string | null;
  isActive: boolean;
  notes: string | null;
  daysRemaining: number;
}

export interface NewLactationPermit {
  employeeId: string;
  birthDate: Date;
  childName?: string | null;
  startDate: Date;
  endDate: Date;
  dailyMinutes: number;
  slot1Start?: string | null;
  slot1End?: string | null;
  slot2Start?: string | null;
  slot2End?: string | null;
  documentUrl?: string | null;
  notes?: string | null;
}
