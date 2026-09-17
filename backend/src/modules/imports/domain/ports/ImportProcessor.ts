import { ColumnSpec } from '../../../../shared/infrastructure/excel/ExcelService';
import { ImportRow, ImportType } from '../entities/ImportLog';

export interface RowValidation {
  isValid: boolean;
  errors: string[];
  data: Record<string, unknown>;
}

export interface ImportProcessor {
  readonly type: ImportType;
  readonly sheetName: string;
  readonly columns: ColumnSpec[];
  prepare(): Promise<void>;
  validateRow(raw: Record<string, unknown>, rowNumber: number): Promise<RowValidation>;
  processRows(rows: ImportRow[], actorId: string): Promise<{ processed: number; errors: string[] }>;
}
