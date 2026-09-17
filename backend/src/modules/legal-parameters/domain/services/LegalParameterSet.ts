import { BusinessRuleError } from '../../../../shared/domain/errors';
import { LegalParameter } from '../entities/LegalParameter';

export class LegalParameterSet {
  private readonly values: Map<string, LegalParameter>;

  constructor(parameters: LegalParameter[], public readonly effectiveAt: Date) {
    this.values = new Map(parameters.map((p) => [p.key, p]));
  }

  has(key: string): boolean {
    return this.values.has(key);
  }

  number(key: string, fallback?: number): number {
    const raw = this.values.get(key);
    if (!raw) {
      if (fallback !== undefined) return fallback;
      throw new BusinessRuleError(`Falta el parametro legal "${key}". Configurelo en Parametros legales.`);
    }
    const value = Number(raw.value);
    if (Number.isNaN(value)) {
      throw new BusinessRuleError(`El parametro legal "${key}" no es numerico: ${raw.value}`);
    }
    return value;
  }

  boolean(key: string, fallback?: boolean): boolean {
    const raw = this.values.get(key);
    if (!raw) {
      if (fallback !== undefined) return fallback;
      throw new BusinessRuleError(`Falta el parametro legal "${key}".`);
    }
    return raw.value === 'true' || raw.value === '1';
  }

  string(key: string, fallback?: string): string {
    const raw = this.values.get(key);
    if (!raw) {
      if (fallback !== undefined) return fallback;
      throw new BusinessRuleError(`Falta el parametro legal "${key}".`);
    }
    return raw.value;
  }

  snapshot(): Record<string, string> {
    const out: Record<string, string> = {};
    this.values.forEach((p, key) => (out[key] = p.value));
    return out;
  }
}
