import { z } from 'zod';
import { pageQuerySchema } from '../../../../shared/infrastructure/http/query';

export const importTypes = ['EMPLOYEES', 'ATTENDANCE', 'SCHEDULES'] as const;

export const listImportsSchema = pageQuerySchema.extend({
  type: z.enum(importTypes).optional(),
  status: z.enum(['PENDING', 'VALIDATED', 'PROCESSED', 'FAILED']).optional(),
});

export const uploadImportSchema = z.object({ type: z.enum(importTypes) });

export const templateQuerySchema = z.object({ type: z.enum(importTypes) });

export const importIdParamSchema = z.object({ id: z.string().uuid() });
