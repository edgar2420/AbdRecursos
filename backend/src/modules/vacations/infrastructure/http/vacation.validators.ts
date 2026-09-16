import { z } from 'zod';
import { pageQuerySchema } from '../../../../shared/infrastructure/http/query';

export const vacationStatuses = [
  'PENDING_SUPERVISOR',
  'PENDING_HR',
  'APPROVED',
  'REJECTED',
  'CANCELLED',
] as const;

export const listVacationsSchema = pageQuerySchema.extend({
  employeeId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  status: z.enum(vacationStatuses).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

export const createVacationSchema = z
  .object({
    employeeId: z.string().uuid().optional(),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    reason: z.string().trim().max(300).optional(),
  })
  .refine((v) => v.endDate >= v.startDate, {
    message: 'La fecha final debe ser posterior o igual a la inicial',
    path: ['endDate'],
  });

export const rejectVacationSchema = z.object({
  reason: z.string().trim().min(5, 'Indique el motivo del rechazo').max(300),
});

export const calendarQuerySchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
});

export const balanceQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
});

export const vacationIdParamSchema = z.object({ id: z.string().uuid() });
export const employeeIdParamSchema = z.object({ employeeId: z.string().uuid() });
