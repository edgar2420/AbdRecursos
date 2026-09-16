import { z } from 'zod';
import { pageQuerySchema } from '../../../../shared/infrastructure/http/query';

export const listLegalParametersSchema = pageQuerySchema.extend({
  key: z.string().trim().max(60).optional(),
});

export const createLegalParameterSchema = z.object({
  key: z.string().trim().min(2).max(60).regex(/^[A-Z0-9_]+$/, 'Use MAYUSCULAS_CON_GUION_BAJO'),
  value: z.string().trim().min(1).max(200),
  valueType: z.enum(['number', 'boolean', 'string', 'json']).default('number'),
  description: z.string().trim().max(300).optional(),
  unit: z.string().trim().max(20).optional(),
  validFrom: z.coerce.date(),
  validUntil: z.coerce.date().optional(),
});

export const updateLegalParameterSchema = createLegalParameterSchema
  .partial()
  .omit({ key: true, validFrom: true });

export const idParamSchema = z.object({ id: z.string().uuid('Identificador invalido') });
