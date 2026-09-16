import { z } from 'zod';
import { pageQuerySchema } from '../../../../shared/infrastructure/http/query';

const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Formato de hora invalido (HH:mm)');

export const listLactationSchema = pageQuerySchema.extend({
  employeeId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  isActive: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
});

export const createLactationSchema = z.object({
  employeeId: z.string().uuid(),
  birthDate: z.coerce.date(),
  childName: z.string().trim().max(80).optional(),
  startDate: z.coerce.date().optional(),
  slot1Start: timeSchema.optional(),
  slot1End: timeSchema.optional(),
  slot2Start: timeSchema.optional(),
  slot2End: timeSchema.optional(),
  documentUrl: z.string().url().max(500).optional(),
  notes: z.string().trim().max(300).optional(),
});

export const updateLactationSchema = z.object({
  childName: z.string().trim().max(80).optional(),
  slot1Start: timeSchema.optional(),
  slot1End: timeSchema.optional(),
  slot2Start: timeSchema.optional(),
  slot2End: timeSchema.optional(),
  notes: z.string().trim().max(300).optional(),
  isActive: z.boolean().optional(),
});

export const expiringQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).optional(),
});

export const lactationIdParamSchema = z.object({ id: z.string().uuid() });
