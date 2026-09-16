import { LegalParameterRepository } from '../../domain/repositories/LegalParameterRepository';
import { LegalParameterSet } from '../../domain/services/LegalParameterSet';

/**
 * Resuelve los parametros vigentes en una fecha. Cachea por dia porque los
 * parametros cambian por gestion, no por request.
 */
export class GetLegalParameters {
  private cache = new Map<string, { set: LegalParameterSet; loadedAt: number }>();
  private static readonly TTL_MS = 60_000;

  constructor(private readonly repository: LegalParameterRepository) {}

  async execute(at: Date = new Date()): Promise<LegalParameterSet> {
    const key = at.toISOString().slice(0, 10);
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.loadedAt < GetLegalParameters.TTL_MS) return cached.set;

    const parameters = await this.repository.findEffective(at);
    const set = new LegalParameterSet(parameters, at);
    this.cache.set(key, { set, loadedAt: Date.now() });
    return set;
  }

  invalidate(): void {
    this.cache.clear();
  }
}
