import { z } from 'zod';
import { pageQuerySchema } from '../../../../shared/infrastructure/http/query';

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Formato de hora invalido (HH:mm)');

export const listSchedulesSchema = pageQuerySchema.extend({
  isActive: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
});

export const createScheduleSchema = z.object({
  name: z.string().trim().min(3).max(60),
  startTime: timeSchema,
  endTime: timeSchema,
  breakMinutes: z.coerce.number().int().min(0).max(240).default(0),
  toleranceMinutes: z.coerce.number().int().min(0).max(120).default(5),
  weekDays: z.array(z.coerce.number().int().min(1).max(7)).min(1, 'Seleccione al menos un dia'),
  isNightShift: z.boolean().default(false),
});

export const updateScheduleSchema = createScheduleSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const listAssignmentsSchema = pageQuerySchema.extend({
  employeeId: z.string().uuid().optional(),
  scheduleId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  at: z.coerce.date().optional(),
});

export const assignScheduleSchema = z.object({
  scheduleId: z.string().uuid(),
  employeeIds: z.array(z.string().uuid()).min(1, 'Seleccione al menos un empleado'),
  validFrom: z.coerce.date(),
  validUntil: z.coerce.date().optional(),
});

export const endAssignmentSchema = z.object({ validUntil: z.coerce.date() });

export const scheduleIdParamSchema = z.object({ id: z.string().uuid() });
