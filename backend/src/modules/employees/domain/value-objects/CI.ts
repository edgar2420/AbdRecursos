import { ValidationError } from '../../../../shared/domain/errors';

export class CI {
  private constructor(public readonly value: string) {}

  static create(raw: string): CI {
    const normalized = raw.trim().toUpperCase().replace(/\s+/g, '');
    if (!/^[0-9]{5,10}(-[0-9A-Z]{1,3})?$/.test(normalized)) {
      throw new ValidationError(`C.I. invalida: "${raw}". Formato esperado: 1234567 o 1234567-1A`);
    }
    return new CI(normalized);
  }

  toString(): string {
    return this.value;
  }
}

export const CI_EXTENSIONS = ['LP', 'CB', 'SC', 'OR', 'PT', 'CH', 'TJ', 'BE', 'PD'] as const;
export type CIExtension = (typeof CI_EXTENSIONS)[number];
