import { ColumnSpec } from '../../../../shared/infrastructure/excel/ExcelService';
import { ImportRow, ImportType } from '../entities/ImportLog';

export interface RowValidation {
  isValid: boolean;
  errors: string[];
  /** Fila normalizada (tipos ya convertidos) que se persistira al confirmar. */
  data: Record<string, unknown>;
}

/**
 * Puerto del modulo generico de importacion (2.8): cada tipo de carga
 * (empleados, asistencia, horarios) implementa esta interfaz y el flujo
 * subir -> validar -> previsualizar -> confirmar es el mismo para todos.
 */
export interface ImportProcessor {
  readonly type: ImportType;
  readonly sheetName: string;
  readonly columns: ColumnSpec[];
  /** Carga catalogos y datos de referencia una sola vez por importacion. */
  prepare(): Promise<void>;
  validateRow(raw: Record<string, unknown>, rowNumber: number): Promise<RowValidation>;
  processRows(rows: ImportRow[], actorId: string): Promise<{ processed: number; errors: string[] }>;
}
