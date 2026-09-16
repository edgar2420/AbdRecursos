import { Paginated, PageQuery } from '../../../../shared/domain/pagination';
import { ImportLog, ImportRow, ImportStatus, ImportType } from '../entities/ImportLog';

export interface ImportRepository {
  create(data: {
    type: ImportType;
    fileName: string;
    uploadedBy: string;
    totalRows: number;
    validRows: number;
    errorRows: number;
    rows: ImportRow[];
  }): Promise<ImportLog>;
  findById(id: string, withRows?: boolean): Promise<ImportLog | null>;
  list(query: PageQuery & { type?: ImportType; status?: ImportStatus }): Promise<Paginated<ImportLog>>;
  markProcessed(id: string, processedRows: number, status: ImportStatus): Promise<ImportLog>;
  validRows(id: string): Promise<ImportRow[]>;
  allRows(id: string): Promise<ImportRow[]>;
}
