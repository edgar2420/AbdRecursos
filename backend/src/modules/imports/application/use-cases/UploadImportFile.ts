import { AuditLoggerPort } from '../../../../shared/application/AuditLogger';
import { BusinessRuleError, ValidationError } from '../../../../shared/domain/errors';
import { SpreadsheetPort } from '../../../../shared/infrastructure/excel/ExcelService';
import { AccessActor, EmployeeAccessPolicy } from '../../../employees/domain/services/EmployeeAccessPolicy';
import { ImportLog, ImportRow, ImportType } from '../../domain/entities/ImportLog';
import { ImportProcessor } from '../../domain/ports/ImportProcessor';
import { ImportRepository } from '../../domain/repositories/ImportRepository';

const MAX_ROWS = 5000;

export class UploadImportFile {
  constructor(
    private readonly imports: ImportRepository,
    private readonly processors: Map<ImportType, ImportProcessor>,
    private readonly excel: SpreadsheetPort,
    private readonly policy: EmployeeAccessPolicy,
    private readonly audit: AuditLoggerPort,
  ) {}

  async execute(
    actor: AccessActor,
    type: ImportType,
    file: { buffer: Buffer; originalname: string },
  ): Promise<ImportLog> {
    this.policy.assertCanManage(actor);
    const processor = this.processors.get(type);
    if (!processor) throw new ValidationError(`Tipo de importacion no soportado: ${type}`);

    const parsed = await this.excel.parse(file.buffer, processor.columns);
    if (parsed.length === 0) throw new BusinessRuleError('El archivo no contiene filas con datos');
    if (parsed.length > MAX_ROWS) {
      throw new BusinessRuleError(`El archivo tiene ${parsed.length} filas; el maximo es ${MAX_ROWS}`);
    }

    await processor.prepare();

    const rows: ImportRow[] = [];
    for (const item of parsed) {
      const result = await processor.validateRow(item.data, item.rowNumber);
      rows.push({
        rowNumber: item.rowNumber,
        isValid: result.isValid,
        errors: result.errors,
        data: result.data,
      });
    }

    const validRows = rows.filter((r) => r.isValid).length;
    const log = await this.imports.create({
      type,
      fileName: file.originalname,
      uploadedBy: actor.userId,
      totalRows: rows.length,
      validRows,
      errorRows: rows.length - validRows,
      rows,
    });

    await this.audit.log({
      userId: actor.userId,
      action: 'IMPORT_UPLOADED',
      entity: 'ImportLog',
      entityId: log.id,
      changes: { type, fileName: file.originalname, totalRows: rows.length, validRows },
    });
    return { ...log, rows };
  }
}
