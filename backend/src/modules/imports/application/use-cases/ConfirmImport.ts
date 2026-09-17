import { AuditLoggerPort } from '../../../../shared/application/AuditLogger';
import { BusinessRuleError, NotFoundError, ValidationError } from '../../../../shared/domain/errors';
import { AccessActor, EmployeeAccessPolicy } from '../../../employees/domain/services/EmployeeAccessPolicy';
import { ImportLog, ImportType } from '../../domain/entities/ImportLog';
import { ImportProcessor } from '../../domain/ports/ImportProcessor';
import { ImportRepository } from '../../domain/repositories/ImportRepository';

export class ConfirmImport {
  constructor(
    private readonly imports: ImportRepository,
    private readonly processors: Map<ImportType, ImportProcessor>,
    private readonly policy: EmployeeAccessPolicy,
    private readonly audit: AuditLoggerPort,
  ) {}

  async execute(actor: AccessActor, importId: string): Promise<ImportLog & { errors: string[] }> {
    this.policy.assertCanManage(actor);
    const log = await this.imports.findById(importId);
    if (!log) throw new NotFoundError('Importacion');
    if (log.status === 'PROCESSED') throw new BusinessRuleError('Esta importacion ya fue procesada');

    const processor = this.processors.get(log.type);
    if (!processor) throw new ValidationError(`Tipo de importacion no soportado: ${log.type}`);

    const rows = await this.imports.validRows(importId);
    if (rows.length === 0) throw new BusinessRuleError('No hay filas validas para procesar');

    await processor.prepare();
    const result = await processor.processRows(rows, actor.userId);
    const updated = await this.imports.markProcessed(
      importId,
      result.processed,
      result.processed > 0 ? 'PROCESSED' : 'FAILED',
    );

    await this.audit.log({
      userId: actor.userId,
      action: 'IMPORT_CONFIRMED',
      entity: 'ImportLog',
      entityId: importId,
      changes: { type: log.type, processed: result.processed, errors: result.errors.length },
    });
    return { ...updated, errors: result.errors };
  }
}
