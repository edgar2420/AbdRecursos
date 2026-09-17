import { AuditLoggerPort } from '../../../../shared/application/AuditLogger';
import { NotFoundError, ValidationError } from '../../../../shared/domain/errors';
import { Paginated, PageQuery } from '../../../../shared/domain/pagination';
import { LegalParameter, NewLegalParameter } from '../../domain/entities/LegalParameter';
import { LegalParameterRepository } from '../../domain/repositories/LegalParameterRepository';
import { GetLegalParameters } from './GetLegalParameters';

export class ListLegalParameters {
  constructor(private readonly repository: LegalParameterRepository) {}

  execute(query: PageQuery & { key?: string }): Promise<Paginated<LegalParameter>> {
    return this.repository.list(query);
  }
}

export class CreateLegalParameterVersion {
  constructor(
    private readonly repository: LegalParameterRepository,
    private readonly parameters: GetLegalParameters,
    private readonly audit: AuditLoggerPort,
  ) {}

  async execute(data: NewLegalParameter, actorId: string): Promise<LegalParameter> {
    if (data.valueType === 'number' && Number.isNaN(Number(data.value))) {
      throw new ValidationError(`El valor "${data.value}" no es numerico`);
    }
    await this.repository.closeValidity(data.key, data.validFrom);
    const created = await this.repository.create({ ...data, createdBy: actorId });
    this.parameters.invalidate();
    await this.audit.log({
      userId: actorId,
      action: 'LEGAL_PARAMETER_CREATED',
      entity: 'LegalParameter',
      entityId: created.id,
      changes: { key: data.key, value: data.value, validFrom: data.validFrom },
    });
    return created;
  }
}

export class UpdateLegalParameter {
  constructor(
    private readonly repository: LegalParameterRepository,
    private readonly parameters: GetLegalParameters,
    private readonly audit: AuditLoggerPort,
  ) {}

  async execute(id: string, data: Partial<NewLegalParameter>, actorId: string): Promise<LegalParameter> {
    const current = await this.repository.findById(id);
    if (!current) throw new NotFoundError('Parametro legal');
    const updated = await this.repository.update(id, data);
    this.parameters.invalidate();
    await this.audit.log({
      userId: actorId,
      action: 'LEGAL_PARAMETER_UPDATED',
      entity: 'LegalParameter',
      entityId: id,
      changes: { before: current.value, after: updated.value },
    });
    return updated;
  }
}
