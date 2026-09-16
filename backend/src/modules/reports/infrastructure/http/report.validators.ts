import { z } from 'zod';

export const dashboardQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  departmentId: z.string().uuid().optional(),
});

export const payrollQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
});
