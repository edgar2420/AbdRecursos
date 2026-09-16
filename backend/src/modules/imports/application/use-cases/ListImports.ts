import { Paginated, PageQuery } from '../../../../shared/domain/pagination';
import { NotFoundError, ValidationError } from '../../../../shared/domain/errors';
import { SpreadsheetPort } from '../../../../shared/infrastructure/excel/ExcelService';
import { AccessActor, EmployeeAccessPolicy } from '../../../employees/domain/services/EmployeeAccessPolicy';
import { ImportLog, ImportStatus, ImportType } from '../../domain/entities/ImportLog';
import { ImportProcessor } from '../../domain/ports/ImportProcessor';
import { ImportRepository } from '../../domain/repositories/ImportRepository';

export class ListImports {
  constructor(
    private readonly imports: ImportRepository,
    private readonly policy: EmployeeAccessPolicy,
  ) {}

  execute(
    actor: AccessActor,
    query: PageQuery & { type?: ImportType; status?: ImportStatus },
  ): Promise<Paginated<ImportLog>> {
    this.policy.assertCanManage(actor);
    return this.imports.list(query);
  }
}

export class GetImportPreview {
  constructor(
    private readonly imports: ImportRepository,
    private readonly policy: EmployeeAccessPolicy,
  ) {}

  async execute(actor: AccessActor, id: string): Promise<ImportLog> {
    this.policy.assertCanManage(actor);
    const log = await this.imports.findById(id, true);
    if (!log) throw new NotFoundError('Importacion');
    return log;
  }
}

/** Log de resultado descargable en Excel, con el detalle de errores por fila (2.8). */
export class DownloadImportLog {
  constructor(
    private readonly imports: ImportRepository,
    private readonly processors: Map<ImportType, ImportProcessor>,
    private readonly excel: SpreadsheetPort,
    private readonly policy: EmployeeAccessPolicy,
  ) {}

  async execute(actor: AccessActor, id: string): Promise<{ buffer: Buffer; fileName: string }> {
    this.policy.assertCanManage(actor);
    const log = await this.imports.findById(id);
    if (!log) throw new NotFoundError('Importacion');
    const processor = this.processors.get(log.type);
    if (!processor) throw new ValidationError('Tipo de importacion no soportado');

    const rows = await this.imports.allRows(id);
    const columns = [
      { key: 'rowNumber', header: 'Fila', width: 10 },
      { key: 'estado', header: 'Estado', width: 14 },
      { key: 'errores', header: 'Errores', width: 60 },
      ...processor.columns,
    ];
    const data = rows.map((r) => ({
      rowNumber: r.rowNumber,
      estado: r.isValid ? 'VALIDA' : 'CON ERROR',
      errores: r.errors.join(' | '),
      ...r.data,
    }));

    return {
      buffer: await this.excel.export('Resultado', columns, data),
      fileName: `log-importacion-${id.slice(0, 8)}.xlsx`,
    };
  }
}

/** Descarga de la plantilla del tipo de importacion solicitado. */
export class DownloadImportTemplate {
  constructor(
    private readonly processors: Map<ImportType, ImportProcessor>,
    private readonly excel: SpreadsheetPort,
    private readonly policy: EmployeeAccessPolicy,
  ) {}

  async execute(actor: AccessActor, type: ImportType): Promise<{ buffer: Buffer; fileName: string }> {
    this.policy.assertCanManage(actor);
    const processor = this.processors.get(type);
    if (!processor) throw new ValidationError(`Tipo de importacion no soportado: ${type}`);
    return {
      buffer: await this.excel.buildTemplate(processor.sheetName, processor.columns),
      fileName: `plantilla-${type.toLowerCase()}.xlsx`,
    };
  }
}
