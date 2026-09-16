export type ImportType = 'EMPLOYEES' | 'ATTENDANCE' | 'SCHEDULES';
export type ImportStatus = 'PENDING' | 'VALIDATED' | 'PROCESSED' | 'FAILED';

export interface ImportRow {
  rowNumber: number;
  isValid: boolean;
  errors: string[];
  data: Record<string, unknown>;
}

export interface ImportLog {
  id: string;
  type: ImportType;
  fileName: string;
  status: ImportStatus;
  totalRows: number;
  validRows: number;
  errorRows: number;
  processedRows: number;
  uploadedBy: string;
  processedAt: Date | null;
  createdAt: Date;
  rows?: ImportRow[];
}
