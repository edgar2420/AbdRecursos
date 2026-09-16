export type LegalValueType = 'number' | 'boolean' | 'string' | 'json';

export interface LegalParameter {
  id: string;
  key: string;
  value: string;
  valueType: LegalValueType;
  description: string | null;
  unit: string | null;
  validFrom: Date;
  validUntil: Date | null;
}

export interface NewLegalParameter {
  key: string;
  value: string;
  valueType: LegalValueType;
  description?: string | null;
  unit?: string | null;
  validFrom: Date;
  validUntil?: Date | null;
  createdBy?: string | null;
}
